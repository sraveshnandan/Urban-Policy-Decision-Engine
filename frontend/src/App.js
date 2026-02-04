import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import SectorList from './components/SectorList';
import SectorDetail from './components/SectorDetail';
import PolicyCard from './components/PolicyCard';
import TrendChart from './components/TrendChart';
import SectorMap from './components/SectorMap';

function App() {
  // State management
  const [sectors, setSectors] = useState([]);
  const [selectedSectorId, setSelectedSectorId] = useState(1);
  const [sectorStatus, setSectorStatus] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pmHistory, setPmHistory] = useState([]);
  const [sectorsExpanded, setSectorsExpanded] = useState(false);

  // API base URL
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const fetchSectors = async () => {
    try {
      const response = await axios.get(`${API_BASE}/sectors`);
      setSectors(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch sectors:', err);
      setError('Failed to connect to backend. Is the server running?');
    }
  };

  const fetchSectorStatus = async (sectorId, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await axios.get(`${API_BASE}/sector/${sectorId}/status`);
      setSectorStatus(response.data);
      
      // Track PM2.5, PM10, NO2, and CO history for chart
      setPmHistory(prev => {
        const timestamp = new Date().toLocaleTimeString();
        const newEntry = {
          time: timestamp,
          pm25: response.data.readings.pm25,
          pm10: response.data.readings.pm10,
          no2: response.data.readings.no2 || 0,
          co: response.data.readings.co || 0,
          sector: response.data.sector_name
        };
        return [...prev, newEntry].slice(-20);
      });
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch sector status:', err);
      setError('Failed to fetch sector status');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchPolicy = async (sectorId) => {
    try {
      const response = await axios.get(`${API_BASE}/sector/${sectorId}/policy`);
      setPolicy(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch policy:', err);
      setError('Failed to fetch policy');
    }
  };

  const handleSimulatePolicy = async (policyName) => {
    // Save scroll position before update
    const savedScrollY = window.scrollY;
    
    try {
      setLoading(true);
      const response = await axios.post(
        `${API_BASE}/simulate?sector_id=${selectedSectorId}&policy_name=${encodeURIComponent(policyName)}`
      );
      setSimulation(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to simulate policy:', err);
      setError('Failed to simulate policy');
    } finally {
      setLoading(false);
      // Restore scroll after render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, savedScrollY);
        });
      });
    }
  };

  const handleSectorSelect = (sectorId) => {
    setSelectedSectorId(sectorId);
    setSimulation(null); // Clear simulation when sector changes
  };

  useEffect(() => {
    fetchSectors();
  }, []);

  useEffect(() => {
    if (selectedSectorId) {
      fetchSectorStatus(selectedSectorId);
      fetchPolicy(selectedSectorId);
    }
  }, [selectedSectorId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      // Save scroll position before any fetch
      const savedScrollY = window.scrollY;
      
      await fetchSectors();
      if (selectedSectorId) {
        // Don't show loading spinner for background updates
        await fetchSectorStatus(selectedSectorId, false);
        await fetchPolicy(selectedSectorId);
      }
      
      // Restore scroll immediately after fetches complete
      // Use requestAnimationFrame to wait for React to finish rendering
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, savedScrollY);
        });
      });
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [selectedSectorId]);

  // Get severity class for metrics
  const getSeverityClass = (pm25) => {
    if (pm25 > 250) return 'danger';
    if (pm25 > 150) return 'warn';
    return 'safe';
  };

  return (
    <div className="app dark-mode">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>Urban Policy Decision Engine</h1>
            <p>AQI Monitoring • Real-Time Data • Policy Simulation • Smart Governance</p>
          </div>
        </div>
      </header>

      {/* Sector Selector (Top Panel) */}
      <div className="sector-selector-panel">
        <button 
          className="sector-toggle"
          onClick={() => setSectorsExpanded(!sectorsExpanded)}
        >
          📍 {sectors.find(s => s.sector_id === selectedSectorId)?.sector_name || 'Select Sector'} 
          <span className={`toggle-icon ${sectorsExpanded ? 'expanded' : ''}`}>▼</span>
        </button>
        {sectorsExpanded && (
          <div className="sector-list-top">
            <SectorList
              sectors={sectors}
              selectedId={selectedSectorId}
              onSelectSector={(id) => {
                handleSectorSelect(id);
                setSectorsExpanded(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="app-container">
        {/* Left Column: Sector Details & Chart */}
        <main className="main-content">
          {loading && selectedSectorId ? (
            <div className="loading">⏳ Loading sector data...</div>
          ) : (
            <>
              {/* System Metrics Bar */}
              {sectorStatus && sectorStatus.readings && (
                <div className="metrics-bar">
                  <div className="metric-item">
                    <span className="label">PM2.5</span>
                    <span className={`value ${getSeverityClass(sectorStatus.readings.pm25 || 0)}`}>
                      {(sectorStatus.readings.pm25 || 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span className="label">PM10</span>
                    <span className={`value ${getSeverityClass((sectorStatus.readings.pm10 || 0) / 2)}`}>
                      {(sectorStatus.readings.pm10 || 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span className="label">Traffic</span>
                    <span className="value">
                      {((sectorStatus.readings.traffic_index || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="metric-item">
                    <span className="label">Wind</span>
                    <span className="value">
                      {(sectorStatus.readings.wind_speed || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              )}

              {/* Map Section */}
              <SectorMap 
                sectors={sectors}
                selectedSector={sectors.find(s => s.sector_id === selectedSectorId)}
                onSelectSector={handleSectorSelect}
              />

              {/* Sector Status */}
              {sectorStatus && (
                <SectorDetail
                  status={sectorStatus}
                  onRefresh={() => fetchSectorStatus(selectedSectorId)}
                />
              )}
            </>
          )}
        </main>

        {/* Right Column: Chart & Policy */}
        <aside className="side-content">
          {/* PM2.5 Trend Chart */}
          {pmHistory.length > 0 && (
            <TrendChart data={pmHistory} />
          )}

          {/* Policy Recommendation */}
          {policy && (
            <PolicyCard
              policy={policy}
              onSimulate={handleSimulatePolicy}
              simulation={simulation}
            />
          )}
        </aside>
      </div>

      {/* Footer */}
      <footer className="app-footer">
        <p>Urban Policy Decision Engine • MCA Major Project</p>
        <p>Last updated: {new Date().toLocaleTimeString()} • Auto-refresh: 10s</p>
      </footer>
    </div>
  );
}

export default App;
