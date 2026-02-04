"""
Urban Policy Decision Engine - Backend API
Using real-time data from OpenAQ API + Open-Meteo Weather
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import random
import threading
import time
import httpx
import asyncio
from datetime import datetime

import os 
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(
    title="Urban Policy Decision Engine",
    description="Air Quality Policy Recommendation System - Real-time Data"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# DATA MODELS
# ============================================================================

class SectorReading(BaseModel):
    sector_id: int
    sector_name: str
    pm25: float
    pm10: float
    traffic_index: float
    wind_speed: float
    timestamp: str


class PolicyRecommendation(BaseModel):
    policy_name: str
    reason: str
    expected_pm25_reduction_percentage: float
    estimated_time_hours: int
    priority: str


# ============================================================================
# SECTOR CONFIGURATION WITH BOUNDING BOXES (Delhi NCR Region)
# ============================================================================

SECTORS_CONFIG = {
    1: {
        "id": 1,
        "name": "South Delhi Commercial",
        "lat": 28.5245,
        "lon": 77.2066,
        "traffic_base": 0.75,
    },
    2: {
        "id": 2,
        "name": "Gurgaon Industrial Hub",
        "lat": 28.4595,
        "lon": 77.0266,
        "traffic_base": 0.45,
    },
    3: {
        "id": 3,
        "name": "Noida Residential Sector",
        "lat": 28.5355,
        "lon": 77.3910,
        "traffic_base": 0.35,
    }
}

# In-memory cache for sector data
SECTORS_DATA = {}

# WAQI API (World Air Quality Index) - Using user's API token
WAQI_TOKEN = os.getenv("WAQI_API_KEY", "demo")
WAQI_BASE = os.getenv("WAQI_BASE", "https://api.waqi.info")

# Station names for Delhi NCR (from WAQI network)
# These are actual monitoring stations in Delhi NCR
WAQI_STATIONS = {
    1: ["@delhi-iitdelhi", "@delhi-rkpuram", "@delhi-lodhi-road"],  # South Delhi
    2: ["@gurgaon", "@gurgaon-sector-51", "@delhi-dwarka-sector-8"],  # Gurgaon area  
    3: ["@noida", "@noida-sector-62", "@delhi-anandvihar"],  # Noida area
}


# ============================================================================
# API INTEGRATION FUNCTIONS
# ============================================================================

def fetch_waqi_geo(lat: float, lon: float) -> dict:
    """
    Fetch air quality using geo coordinates (more accurate)
    Also extracts NO2 and CO for traffic index calculation
    """
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                f"{WAQI_BASE}/feed/geo:{lat};{lon}/",
                params={"token": WAQI_TOKEN}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok":
                    aqi_data = data.get("data", {})
                    iaqi = aqi_data.get("iaqi", {})
                    city = aqi_data.get("city", {}).get("name", "Unknown")
                    
                    pm25 = iaqi.get("pm25", {}).get("v")
                    pm10 = iaqi.get("pm10", {}).get("v")
                    
                    # Traffic-related pollutants (from vehicle emissions)
                    no2 = iaqi.get("no2", {}).get("v")  # Nitrogen Dioxide
                    co = iaqi.get("co", {}).get("v")    # Carbon Monoxide
                    
                    # Calculate traffic index from NO2 and CO
                    # NO2: typical range 0-200, CO: typical range 0-100
                    traffic_index = None
                    if no2 is not None or co is not None:
                        # Normalize and combine: NO2 contributes 60%, CO contributes 40%
                        no2_normalized = min(1.0, (no2 or 0) / 150) if no2 else 0.5
                        co_normalized = min(1.0, (co or 0) / 80) if co else 0.5
                        traffic_index = round(no2_normalized * 0.6 + co_normalized * 0.4, 2)
                    
                    return {
                        "pm25": pm25 if pm25 and 0 < pm25 < 1000 else None,
                        "pm10": pm10 if pm10 and 0 < pm10 < 2000 else None,
                        "no2": no2,
                        "co": co,
                        "traffic_index": traffic_index,
                        "station": city,
                        "stations": 1
                    }
    except Exception as e:
        print(f"WAQI geo fetch error: {e}")
    
    return {"pm25": None, "pm10": None, "no2": None, "co": None, "traffic_index": None, "stations": 0}


def fetch_waqi_data(sector_id: int, lat: float, lon: float) -> dict:
    """
    Fetch air quality data from WAQI API for a sector
    Uses geo-based API for more accurate location data
    """
    # First try geo-based lookup (most accurate)
    geo_data = fetch_waqi_geo(lat, lon)
    if geo_data["pm25"] is not None:
        return geo_data
    
    # Fallback to station-based lookup
    stations = WAQI_STATIONS.get(sector_id, ["delhi"])
    pm25_values = []
    pm10_values = []
    
    try:
        with httpx.Client(timeout=15.0) as client:
            for station in stations[:2]:  # Limit to 2 stations
                try:
                    response = client.get(
                        f"{WAQI_BASE}/feed/{station}/",
                        params={"token": WAQI_TOKEN}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("status") == "ok":
                            aqi_data = data.get("data", {})
                            iaqi = aqi_data.get("iaqi", {})
                            
                            # Get PM2.5 value
                            pm25 = iaqi.get("pm25", {}).get("v")
                            if pm25 and 0 < pm25 < 1000:
                                pm25_values.append(pm25)
                            
                            # Get PM10 value
                            pm10 = iaqi.get("pm10", {}).get("v")
                            if pm10 and 0 < pm10 < 2000:
                                pm10_values.append(pm10)
                                
                except Exception as e:
                    print(f"WAQI station {station} error: {e}")
                    continue
                    
    except Exception as e:
        print(f"WAQI fetch error: {e}")
    
    return {
        "pm25": sum(pm25_values) / len(pm25_values) if pm25_values else None,
        "pm10": sum(pm10_values) / len(pm10_values) if pm10_values else None,
        "no2": None,
        "co": None,
        "traffic_index": None,
        "stations": len(pm25_values)
    }


def fetch_wind_sync(lat: float, lon: float) -> float:
    """
    Fetch wind speed from Open-Meteo API (free, no key required)
    """
    try:
        with httpx.Client(timeout=10.0) as client:
            params = {
                "latitude": lat,
                "longitude": lon,
                "current_weather": "true"
            }
            
            response = client.get(
                "https://api.open-meteo.com/v1/forecast",
                params=params
            )
            
            if response.status_code == 200:
                data = response.json()
                wind_kmh = data.get("current_weather", {}).get("windspeed", 8.0)
                return round(wind_kmh / 3.6, 1)  # Convert km/h to m/s
                
    except Exception as e:
        print(f"Wind fetch error: {e}")
    
    return 2.0  # Default


def initialize_sectors():
    """Initialize sectors with default values"""
    global SECTORS_DATA
    for sector_id, config in SECTORS_CONFIG.items():
        SECTORS_DATA[sector_id] = {
            "id": config["id"],
            "name": config["name"],
            "readings": {
                "pm25": 100.0,
                "pm10": 150.0,
                "no2": 0.0,
                "co": 0.0,
                "traffic_index": config["traffic_base"],
                "wind_speed": 2.0
            },
            "last_update": None,
            "data_source": "initializing"
        }

initialize_sectors()


def update_all_sectors():
    """
    Background thread: Update all sectors from APIs
    """
    while True:
        try:
            for sector_id, config in SECTORS_CONFIG.items():
                lat = config["lat"]
                lon = config["lon"]
                
                # Fetch real data from WAQI API
                aq_data = fetch_waqi_data(sector_id, lat, lon)
                wind = fetch_wind_sync(lat, lon)
                
                readings = SECTORS_DATA[sector_id]["readings"]
                
                # Update with API data or apply variation
                if aq_data["pm25"] is not None:
                    readings["pm25"] = round(aq_data["pm25"], 1)
                    SECTORS_DATA[sector_id]["data_source"] = "waqi_live"
                else:
                    # Small random variation if API unavailable
                    readings["pm25"] = max(20, readings["pm25"] * random.uniform(0.95, 1.05))
                    SECTORS_DATA[sector_id]["data_source"] = "cached"
                
                if aq_data["pm10"] is not None:
                    readings["pm10"] = round(aq_data["pm10"], 1)
                else:
                    readings["pm10"] = max(30, readings["pm10"] * random.uniform(0.95, 1.05))
                
                # Store NO2 and CO values
                if aq_data.get("no2") is not None:
                    readings["no2"] = round(aq_data["no2"], 1)
                if aq_data.get("co") is not None:
                    readings["co"] = round(aq_data["co"], 2)
                
                readings["wind_speed"] = wind
                
                # Traffic index from real NO2/CO data or time-based simulation
                if aq_data.get("traffic_index") is not None:
                    # Use real traffic index derived from NO2 and CO
                    readings["traffic_index"] = aq_data["traffic_index"]
                    traffic_source = "NO2/CO"
                else:
                    # Fallback: Time-based simulation
                    hour = datetime.now().hour
                    if 8 <= hour <= 10 or 17 <= hour <= 19:
                        traffic_mult = 1.3  # Rush hour
                    elif 22 <= hour or hour <= 5:
                        traffic_mult = 0.4  # Night
                    else:
                        traffic_mult = 1.0
                    
                    readings["traffic_index"] = min(1.0, max(0.1,
                        config["traffic_base"] * traffic_mult * random.uniform(0.9, 1.1)
                    ))
                    traffic_source = "simulated"
                
                SECTORS_DATA[sector_id]["last_update"] = get_timestamp()
                
                src_label = "🔴 LIVE" if "live" in SECTORS_DATA[sector_id]['data_source'] else "⚪ cached"
                print(f"[{datetime.now().strftime('%H:%M:%S')}] {config['name']}: "
                      f"PM2.5={readings['pm25']}, PM10={readings['pm10']}, "
                      f"Traffic={readings['traffic_index']:.2f} ({traffic_source}), "
                      f"Wind={readings['wind_speed']}m/s ({src_label})")
                
                time.sleep(2)  # Small delay between sector updates
            
            # Wait 60 seconds before next update cycle
            time.sleep(60)
            
        except Exception as e:
            print(f"Update error: {e}")
            time.sleep(30)


# Start background thread
data_thread = threading.Thread(target=update_all_sectors, daemon=True)
data_thread.start()


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_timestamp():
    return datetime.now().isoformat()


def detect_pollution_cause(pm25: float, pm10: float, traffic_index: float, sector_name: str = "") -> str:
    """
    Intelligent pollution source detection based on pollutant ratios and sector characteristics
    """
    pm_ratio = pm10 / pm25 if pm25 > 0 else 1
    
    # High PM10 relative to PM2.5 suggests dust/construction
    if pm_ratio > 2.5:
        return "Dust and construction activity (high coarse particles)"
    
    # Very low PM10 relative to PM2.5 suggests fine particle sources (traffic/industry)
    elif pm_ratio < 0.8 and traffic_index > 0.25:
        return "Vehicle emissions and industrial pollution (fine particles)"
    
    # Moderate ratio with high traffic indicator
    elif pm_ratio > 0.8 and pm_ratio <= 2.0 and traffic_index > 0.3:
        return "Mixed traffic and dust pollution"
    
    # Industrial sectors with high PM levels
    elif "Industrial" in sector_name and pm25 > 150:
        return "Industrial emissions (high particulate concentration)"
    
    # Residential sectors
    elif "Residential" in sector_name and pm_ratio < 1.5:
        return "Residential emissions and traffic (balanced sources)"
    
    # Commercial areas
    elif "Commercial" in sector_name:
        return "Commercial area pollution (traffic congestion and activities)"
    
    # Default fallback
    else:
        return "Mixed pollution sources (dust, traffic, and industrial)"


# ============================================================================
# SCIENTIFIC COEFFICIENTS (Research-backed)
# Sources: CPCB India Guidelines, WHO, EPA AP-42, Delhi DPCC Studies
# ============================================================================

# Policy effectiveness ranges from peer-reviewed studies
# Format: (min_reduction, typical_reduction, max_reduction)
POLICY_EFFECTIVENESS_RANGES = {
    # Vehicle restrictions - Based on Delhi odd-even studies (IIT Delhi, 2016-2019)
    "Truck Entry Ban (12 hours)": (0.12, 0.18, 0.25),  # Guttikunda et al., 2014
    "Odd-Even Vehicle Scheme": (0.08, 0.14, 0.20),     # EPCA studies
    "Peak Hour Traffic Restrictions": (0.10, 0.16, 0.22),
    
    # Construction/dust - Based on CPCB dust control guidelines
    "Construction Activity Halt & Street Washing": (0.15, 0.22, 0.30),
    "Enhanced Street Cleaning & Dust Control": (0.08, 0.12, 0.18),
    
    # Industrial - Based on DPCC emission inventory
    "Industrial Emission Control + Vehicle Restrictions": (0.20, 0.30, 0.40),
    "Emission Standards Enforcement": (0.10, 0.15, 0.22),
    
    # Incentive programs - Based on Metro ridership impact studies
    "Public Transport Incentive Program": (0.05, 0.10, 0.15),
}

# Source contribution fractions (Delhi-specific from SAFAR/IITM studies)
SOURCE_CONTRIBUTIONS = {
    "vehicles": 0.28,      # 28% of PM2.5 from vehicles
    "dust": 0.21,          # 21% from road/construction dust  
    "industry": 0.22,      # 22% from industries
    "biomass": 0.17,       # 17% from biomass burning
    "secondary": 0.12,     # 12% secondary aerosols
}

def calculate_meteorological_factor(wind_speed: float, hour: int = None) -> float:
    """
    Meteorological adjustment factor based on atmospheric stability.
    Uses Pasquill-Gifford stability classes simplified approach.
    
    References:
    - Turner, D.B. (1970) Workbook of Atmospheric Dispersion Estimates
    - EPA AERMOD documentation
    """
    from datetime import datetime
    
    if hour is None:
        hour = datetime.now().hour
    
    # Daytime vs nighttime stability
    is_daytime = 6 <= hour <= 18
    
    # Wind speed factor (ventilation coefficient proxy)
    if wind_speed < 1.0:
        wind_factor = 0.5  # Very stable, poor dispersion
    elif wind_speed < 2.0:
        wind_factor = 0.65  # Stable
    elif wind_speed < 4.0:
        wind_factor = 0.85  # Neutral
    elif wind_speed < 6.0:
        wind_factor = 1.0   # Slightly unstable
    else:
        wind_factor = 1.1   # Unstable, good dispersion
    
    # Boundary layer effect (mixing height proxy)
    if is_daytime:
        mixing_factor = 1.0  # Better vertical mixing during day
    else:
        mixing_factor = 0.8  # Nocturnal inversion reduces effectiveness
    
    return wind_factor * mixing_factor


def simulate_policy_impact(
    effectiveness_range: tuple,
    wind_speed: float,
    source_match: float = 1.0,  # How well policy targets the actual source
    confidence: str = "medium"
) -> dict:
    """
    Calculate policy impact with uncertainty bounds.
    Returns min, expected, and max reduction estimates.
    """
    min_eff, typ_eff, max_eff = effectiveness_range
    met_factor = calculate_meteorological_factor(wind_speed)
    
    # Adjust for source targeting efficiency
    adj_min = min_eff * met_factor * source_match
    adj_typ = typ_eff * met_factor * source_match
    adj_max = max_eff * met_factor * source_match
    
    return {
        "min_reduction": round(adj_min * 100, 1),
        "expected_reduction": round(adj_typ * 100, 1),
        "max_reduction": round(adj_max * 100, 1),
        "met_factor": round(met_factor, 2),
        "confidence": confidence
    }


def simulate_wind_impact(effectiveness: float, wind_speed: float) -> float:
    """Legacy function - now uses meteorological factor"""
    return effectiveness * calculate_meteorological_factor(wind_speed)


# ============================================================================
# POLICY ENGINE
# ============================================================================

def generate_policy_recommendation(
    sector_id: int,
    pm25: float,
    pm10: float,
    traffic_index: float,
    wind_speed: float
) -> Optional[PolicyRecommendation]:
    
    sector_config = SECTORS_CONFIG.get(sector_id, {})
    sector_name = sector_config.get("name", "")
    pm_ratio = pm10 / pm25 if pm25 > 0 else 1
    
    # Critical: High PM2.5 with heavy traffic and poor wind
    if pm25 > 250 and traffic_index > 0.5 and wind_speed < 2:
        if "Industrial" in sector_name:
            return PolicyRecommendation(
                policy_name="Industrial Emission Control + Vehicle Restrictions",
                reason=f"Critical pollution in industrial area: PM2.5={pm25:.0f}, Traffic index={traffic_index:.1f}, Wind={wind_speed:.1f}m/s",
                expected_pm25_reduction_percentage=35,
                estimated_time_hours=24,
                priority="critical"
            )
        else:
            return PolicyRecommendation(
                policy_name="Truck Entry Ban (12 hours)",
                reason=f"High PM2.5 ({pm25:.0f}) with heavy traffic ({traffic_index:.1f}) and poor wind dispersal ({wind_speed:.1f} m/s).",
                expected_pm25_reduction_percentage=22,
                estimated_time_hours=12,
                priority="critical"
            )
    
    # Severe dust pollution (high PM10 relative to PM2.5)
    if pm10 > 250 and pm_ratio > 2.0:
        return PolicyRecommendation(
            policy_name="Construction Activity Halt & Street Washing",
            reason=f"Severe dust pollution: PM10={pm10:.0f}, PM10/PM2.5 ratio={pm_ratio:.1f} (coarse particles dominant)",
            expected_pm25_reduction_percentage=25,
            estimated_time_hours=12,
            priority="critical"
        )
    
    # High PM2.5 with traffic as primary source
    if pm25 > 200 and traffic_index > 0.3 and pm_ratio < 1.5:
        if "Commercial" in sector_name:
            return PolicyRecommendation(
                policy_name="Peak Hour Traffic Restrictions",
                reason=f"High PM2.5 ({pm25:.0f}) driven by traffic in commercial area (Traffic index: {traffic_index:.1f})",
                expected_pm25_reduction_percentage=20,
                estimated_time_hours=8,
                priority="high"
            )
        elif "Residential" in sector_name:
            return PolicyRecommendation(
                policy_name="Odd-Even Vehicle Scheme",
                reason=f"High PM2.5 ({pm25:.0f}) with moderate traffic impact in residential area",
                expected_pm25_reduction_percentage=18,
                estimated_time_hours=6,
                priority="high"
            )
        else:
            return PolicyRecommendation(
                policy_name="Emission Standards Enforcement",
                reason=f"High PM2.5 ({pm25:.0f}) from traffic-related sources",
                expected_pm25_reduction_percentage=16,
                estimated_time_hours=6,
                priority="high"
            )
    
    # Moderate pollution with poor wind conditions
    if pm25 > 150 and wind_speed < 2:
        return PolicyRecommendation(
            policy_name="Public Transport Incentive Program",
            reason=f"Moderate pollution (PM2.5: {pm25:.0f}) with poor wind dispersal ({wind_speed:.1f} m/s).",
            expected_pm25_reduction_percentage=12,
            estimated_time_hours=4,
            priority="medium"
        )
    
    # Dust-related pollution in low-traffic areas
    if pm10 > 150 and traffic_index < 0.3 and pm_ratio > 1.5:
        return PolicyRecommendation(
            policy_name="Enhanced Street Cleaning & Dust Control",
            reason=f"Notable dust levels (PM10: {pm10:.0f}) with low traffic contribution",
            expected_pm25_reduction_percentage=15,
            estimated_time_hours=6,
                priority="medium"
        )
    
    return None


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/")
def root():
    return {
        "message": "Urban Policy Decision Engine API",
        "version": "2.0.0",
        "status": "running",
        "data_sources": ["OpenAQ (Air Quality)", "Open-Meteo (Weather)"]
    }


@app.get("/sectors", response_model=List[SectorReading])
def get_sectors():
    readings = []
    for sector_id, sector_data in SECTORS_DATA.items():
        readings.append(SectorReading(
            sector_id=sector_data["id"],
            sector_name=sector_data["name"],
            pm25=round(sector_data["readings"]["pm25"], 1),
            pm10=round(sector_data["readings"]["pm10"], 1),
            traffic_index=round(sector_data["readings"]["traffic_index"], 2),
            wind_speed=round(sector_data["readings"]["wind_speed"], 1),
            timestamp=get_timestamp()
        ))
    return readings


@app.get("/sector/{sector_id}/status")
def get_sector_status(sector_id: int):
    if sector_id not in SECTORS_DATA:
        return {"error": "Sector not found"}, 404
    
    sector = SECTORS_DATA[sector_id]
    sector_config = SECTORS_CONFIG.get(sector_id, {})
    readings = sector["readings"]
    
    if readings["pm25"] > 250:
        severity = "hazardous"
    elif readings["pm25"] > 200:
        severity = "very_unhealthy"
    elif readings["pm25"] > 150:
        severity = "unhealthy"
    elif readings["pm25"] > 100:
        severity = "unhealthy_for_sensitive"
    else:
        severity = "moderate"
    
    return {
        "sector_id": sector["id"],
        "sector_name": sector["name"],
        "readings": {
            "pm25": round(readings["pm25"], 1),
            "pm10": round(readings["pm10"], 1),
            "no2": round(readings.get("no2", 0), 1),
            "co": round(readings.get("co", 0), 2),
            "traffic_index": round(readings["traffic_index"], 2),
            "wind_speed": round(readings["wind_speed"], 1)
        },
        "severity": severity,
        "pollution_cause": detect_pollution_cause(
            readings["pm25"], readings["pm10"], readings["traffic_index"],
            sector_config.get("name", "")
        ),
        "data_source": sector.get("data_source", "unknown"),
        "last_update": sector.get("last_update"),
        "timestamp": get_timestamp()
    }


@app.get("/sector/{sector_id}/policy")
def get_sector_policy(sector_id: int):
    if sector_id not in SECTORS_DATA:
        return {"error": "Sector not found"}, 404
    
    sector = SECTORS_DATA[sector_id]
    readings = sector["readings"]
    
    policy = generate_policy_recommendation(
        sector_id, readings["pm25"], readings["pm10"],
        readings["traffic_index"], readings["wind_speed"]
    )
    
    if policy:
        return {
            "sector_id": sector_id,
            "sector_name": sector["name"],
            "has_policy": True,
            "policy": {
                "name": policy.policy_name,
                "reason": policy.reason,
                "expected_pm25_reduction_percentage": policy.expected_pm25_reduction_percentage,
                "estimated_time_hours": policy.estimated_time_hours,
                "priority": policy.priority
            },
            "timestamp": get_timestamp()
        }
    else:
        return {
            "sector_id": sector_id,
            "sector_name": sector["name"],
            "has_policy": False,
            "message": "Pollution levels acceptable. Continue monitoring.",
            "timestamp": get_timestamp()
        }


@app.post("/simulate")
def simulate_policy(sector_id: int, policy_name: str):
    if sector_id not in SECTORS_DATA:
        return {"error": "Sector not found"}, 404
    
    sector = SECTORS_DATA[sector_id]
    readings = sector["readings"]
    current_pm25 = readings["pm25"]
    wind_speed = readings["wind_speed"]
    traffic_index = readings["traffic_index"]
    
    # Get research-backed effectiveness range
    effectiveness_range = POLICY_EFFECTIVENESS_RANGES.get(
        policy_name, 
        (0.08, 0.15, 0.22)  # Default conservative estimate
    )
    
    # Determine source targeting efficiency
    if "Traffic" in policy_name or "Vehicle" in policy_name or "Truck" in policy_name:
        source_match = min(1.0, traffic_index + 0.5)  # Higher if traffic is major source
        confidence = "high" if traffic_index > 0.4 else "medium"
    elif "Construction" in policy_name or "Dust" in policy_name or "Street" in policy_name:
        pm_ratio = readings.get("pm10", current_pm25 * 1.5) / current_pm25 if current_pm25 > 0 else 1
        source_match = min(1.0, (pm_ratio - 1) * 0.5 + 0.5)  # Higher if dust is evident
        confidence = "high" if pm_ratio > 1.5 else "medium"
    elif "Industrial" in policy_name:
        source_match = 0.85 if "Industrial" in sector["name"] else 0.5
        confidence = "high" if "Industrial" in sector["name"] else "low"
    else:
        source_match = 0.7
        confidence = "medium"
    
    # Calculate impact with uncertainty
    impact = simulate_policy_impact(effectiveness_range, wind_speed, source_match, confidence)
    
    # Calculate PM2.5 projections
    expected_reduction = impact["expected_reduction"] / 100
    simulated_pm25 = current_pm25 * (1 - expected_reduction)
    min_pm25 = current_pm25 * (1 - impact["max_reduction"] / 100)
    max_pm25 = current_pm25 * (1 - impact["min_reduction"] / 100)
    
    # Generate explanation
    explanation = f"Based on peer-reviewed studies for similar interventions. "
    if impact["met_factor"] < 0.8:
        explanation += f"Effectiveness reduced due to poor atmospheric dispersion (wind: {wind_speed:.1f} m/s). "
    explanation += f"Confidence: {confidence}. Range: {impact['min_reduction']:.0f}%-{impact['max_reduction']:.0f}%."
    
    return {
        "sector_id": sector_id,
        "sector_name": sector["name"],
        "policy_name": policy_name,
        "current_pm25": round(current_pm25, 1),
        "simulated_pm25_after": round(simulated_pm25, 1),
        "pm25_range": {
            "best_case": round(min_pm25, 1),
            "expected": round(simulated_pm25, 1),
            "worst_case": round(max_pm25, 1)
        },
        "reduction_percentage": round(impact["expected_reduction"], 1),
        "reduction_range": {
            "min": impact["min_reduction"],
            "expected": impact["expected_reduction"],
            "max": impact["max_reduction"]
        },
        "confidence": confidence,
        "methodology": "Based on CPCB/DPCC/IIT Delhi studies",
        "explanation": explanation,
        "wind_speed": round(wind_speed, 1),
        "met_adjustment_factor": impact["met_factor"],
        "timestamp": get_timestamp()
    }


@app.get("/api/status")
def api_status():
    """Check API connection status"""
    sectors_info = {}
    for sid, sdata in SECTORS_DATA.items():
        sectors_info[sdata["name"]] = {
            "data_source": sdata.get("data_source", "unknown"),
            "last_update": sdata.get("last_update")
        }
    
    return {
        "openaq_api": "https://api.openaq.org/v2",
        "weather_api": "https://api.open-meteo.com",
        "sectors": sectors_info,
        "timestamp": get_timestamp()
    }


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("Urban Policy Decision Engine - Real-time Data")
    print("=" * 60)
    print("Data Sources:")
    print("  • WAQI API (Air Quality - Delhi NCR Stations)")
    print("  • Open-Meteo API (Weather/Wind)")
    print("=" * 60)
    print("Server: http://localhost:8000")
    print("Docs:   http://localhost:8000/docs")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
