import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SectorMap.css';

// Fix for default marker icons in Leaflet with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/**
 * SectorMap Component
 * Displays an interactive map with color-coded markers based on air quality
 */
function SectorMap({ sectors, selectedSector, onSelectSector }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // Sector coordinates (simulated for Indian cities)
  const sectorCoordinates = {
    1: { lat: 28.6139, lon: 77.2090, name: 'Delhi - Connaught Place' },
    2: { lat: 28.5355, lon: 77.3910, name: 'Noida' },
    3: { lat: 28.4595, lon: 77.0266, name: 'Gurgaon' },
    4: { lat: 28.7041, lon: 77.1025, name: 'North Delhi' },
    5: { lat: 28.5245, lon: 77.1855, name: 'South Delhi' },
    6: { lat: 19.0760, lon: 72.8777, name: 'Mumbai' },
    7: { lat: 12.9716, lon: 77.5946, name: 'Bangalore' },
    8: { lat: 22.5726, lon: 88.3639, name: 'Kolkata' },
  };

  // Get color based on PM2.5 severity
  const getSeverityColor = (pm25) => {
    if (pm25 > 250) return '#dc2626'; // Hazardous - Red
    if (pm25 > 200) return '#ef4444'; // Very Unhealthy - Light Red
    if (pm25 > 150) return '#f97316'; // Unhealthy - Orange
    if (pm25 > 100) return '#facc15'; // Unhealthy for Sensitive - Yellow
    return '#22c55e'; // Moderate - Green
  };

  // Get severity label
  const getSeverityLabel = (pm25) => {
    if (pm25 > 250) return 'Hazardous';
    if (pm25 > 200) return 'Very Unhealthy';
    if (pm25 > 150) return 'Unhealthy';
    if (pm25 > 100) return 'Unhealthy for Sensitive';
    return 'Moderate';
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map centered on Delhi
    mapInstanceRef.current = L.map(mapRef.current, {
      center: [28.6139, 77.2090],
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Add dark-themed tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when sectors change
  useEffect(() => {
    if (!mapInstanceRef.current || !sectors.length) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for each sector
    sectors.forEach(sector => {
      const coords = sectorCoordinates[sector.sector_id];
      if (!coords) return;

      const color = getSeverityColor(sector.pm25);
      const isSelected = selectedSector?.sector_id === sector.sector_id;
      const size = isSelected ? 20 : 14;

      // Create custom icon
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="marker-pulse ${isSelected ? 'selected' : ''}" style="
            background-color: ${color};
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            border: 3px solid ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.8)'};
            box-shadow: 0 0 ${isSelected ? '20px' : '10px'} ${color};
          ">
            ${isSelected ? '<div class="pulse-ring" style="border-color: ' + color + '"></div>' : ''}
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      // Create marker
      const marker = L.marker([coords.lat, coords.lon], { icon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div class="map-popup">
            <h4>${sector.sector_name}</h4>
            <div class="popup-stat">
              <span>PM2.5:</span>
              <strong style="color: ${color}">${sector.pm25.toFixed(1)} µg/m³</strong>
            </div>
            <div class="popup-stat">
              <span>Status:</span>
              <strong style="color: ${color}">${getSeverityLabel(sector.pm25)}</strong>
            </div>
            <div class="popup-stat">
              <span>Traffic:</span>
              <strong>${(sector.traffic_index * 100).toFixed(0)}%</strong>
            </div>
          </div>
        `);

      marker.on('click', () => {
        if (onSelectSector) {
          onSelectSector(sector.sector_id);
        }
      });

      markersRef.current.push(marker);
    });

  }, [sectors, selectedSector, onSelectSector]);

  // Fly to selected sector
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedSector) return;

    const coords = sectorCoordinates[selectedSector.sector_id];
    if (coords) {
      mapInstanceRef.current.flyTo([coords.lat, coords.lon], 12, {
        duration: 1.5,
      });
    }
  }, [selectedSector]);

  return (
    <div className="sector-map-container">
      <h2>🌍 Pollution Intelligence Map</h2>
      <div className="map-wrapper">
        <div ref={mapRef} className="leaflet-map"></div>
      </div>
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
          <span>Moderate (0-100)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#facc15' }}></span>
          <span>Sensitive (100-150)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#f97316' }}></span>
          <span>Unhealthy (150-200)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>
          <span>Very Unhealthy (200-250)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#dc2626' }}></span>
          <span>Hazardous (250+)</span>
        </div>
      </div>
    </div>
  );
}

export default SectorMap;
