import React from 'react';
import './SectorDetail.css';

/**
 * SectorDetail Component
 * Displays comprehensive air quality status for a selected sector
 * Including readings, severity level, and pollution cause analysis
 */
function SectorDetail({ status, onRefresh }) {
  if (!status) return null;

  const { readings, severity, pollution_cause, sector_name } = status;

  /**
   * Get human-readable severity label
   */
  const getSeverityLabel = (sev) => {
    const labels = {
      'moderate': 'Moderate',
      'unhealthy_for_sensitive': 'Unhealthy for Sensitive Groups',
      'unhealthy': 'Unhealthy',
      'very_unhealthy': 'Very Unhealthy',
      'hazardous': 'Hazardous'
    };
    return labels[sev] || sev;
  };

  /**
   * Get color code for severity level
   */
  const getSeverityColor = (sev) => {
    const colors = {
      'moderate': '#4caf50',
      'unhealthy_for_sensitive': '#ffc107',
      'unhealthy': '#ff9800',
      'very_unhealthy': '#ff6b6b',
      'hazardous': '#f44336'
    };
    return colors[sev] || '#999';
  };

  /**
   * Determine if readings indicate safe conditions
   */
  const isSafe = severity === 'moderate';

  return (
    <div className="sector-detail">
      {/* Header */}
      <div className="detail-header">
        <h2>{sector_name}</h2>
        <button className="button button-secondary" onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>

      {/* Severity Alert */}
      <div className={`severity-alert ${severity}`}>
        <div className="alert-icon">
          {isSafe ? '✅' : '⚠️'}
        </div>
        <div className="alert-content">
          <h3>{getSeverityLabel(severity)}</h3>
          <p>
            {isSafe
              ? 'Air quality is within acceptable range. Continue monitoring.'
              : 'Air quality is degraded. Policy intervention may be needed.'}
          </p>
        </div>
      </div>

      {/* Air Quality Readings Grid */}
      <div className="readings-grid">
        {/* PM2.5 */}
        <div className="reading-card">
          <h4>PM2.5</h4>
          <div className="reading-value" style={{ color: getSeverityColor(severity) }}>
            {readings.pm25.toFixed(1)}
          </div>
          <p className="reading-unit">μg/m³</p>
          <p className="reading-note">Fine Particulate Matter</p>
          <div className="reading-scale">
            <div className="scale-item" style={{ backgroundColor: '#4caf50' }}>
              0-50
            </div>
            <div className="scale-item" style={{ backgroundColor: '#ffc107' }}>
              51-150
            </div>
            <div className="scale-item" style={{ backgroundColor: '#ff9800' }}>
              151-250
            </div>
            <div className="scale-item" style={{ backgroundColor: '#f44336' }}>
              251+
            </div>
          </div>
        </div>

        {/* PM10 */}
        <div className="reading-card">
          <h4>PM10</h4>
          <div className="reading-value">{readings.pm10.toFixed(1)}</div>
          <p className="reading-unit">μg/m³</p>
          <p className="reading-note">Coarse Particulate Matter</p>
        </div>

        {/* Traffic Index */}
        <div className="reading-card">
          <h4>Traffic Index</h4>
          <div className="reading-value" style={{ color: '#ff9800' }}>
            {(readings.traffic_index * 100).toFixed(0)}%
          </div>
          <p className="reading-unit">Congestion Level</p>
          <p className="reading-note">
            {readings.traffic_index > 0.7
              ? 'Heavy traffic'
              : readings.traffic_index > 0.4
              ? 'Moderate traffic'
              : 'Light traffic'}
          </p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${readings.traffic_index * 100}%`,
                backgroundColor:
                  readings.traffic_index > 0.7
                    ? '#f44336'
                    : readings.traffic_index > 0.4
                    ? '#ff9800'
                    : '#4caf50'
              }}
            ></div>
          </div>
        </div>

        {/* Wind Speed */}
        <div className="reading-card">
          <h4>Wind Speed</h4>
          <div className="reading-value" style={{ color: '#2196f3' }}>
            {readings.wind_speed.toFixed(1)}
          </div>
          <p className="reading-unit">m/s</p>
          <p className="reading-note">
            {readings.wind_speed < 2
              ? 'Poor dispersal ↓'
              : readings.wind_speed < 3
              ? 'Moderate dispersal →'
              : 'Good dispersal ↑'}
          </p>
        </div>
      </div>

      {/* Pollution Cause Analysis */}
      <div className="pollution-analysis">
        <h3>💡 Pollution Cause Analysis</h3>
        <p className="cause-text">{pollution_cause}</p>
        <div className="cause-details">
          <div className="cause-item">
            <span className="cause-label">PM10/PM25 Ratio:</span>
            <span className="cause-value">
              {(readings.pm10 / readings.pm25).toFixed(1)}
            </span>
          </div>
          {readings.pm10 / readings.pm25 > 2 ? (
            <div className="cause-insight">
              High ratio suggests dust/construction as primary source
            </div>
          ) : (
            <div className="cause-insight">
              Balanced ratio suggests traffic-related particulates
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="recommendations">
        <h3>📋 Current Status Summary</h3>
        <ul>
          <li>
            <strong>PM2.5 Level:</strong>{' '}
            {readings.pm25 > 250
              ? 'Critical - Immediate action recommended'
              : readings.pm25 > 200
              ? 'Severe - Action needed'
              : readings.pm25 > 150
              ? 'High - Monitor closely'
              : 'Within acceptable range'}
          </li>
          <li>
            <strong>Traffic Impact:</strong>{' '}
            {readings.traffic_index > 0.7
              ? 'High - Traffic control measures may help'
              : readings.traffic_index > 0.4
              ? 'Moderate - Traffic is a contributing factor'
              : 'Low - Traffic is not a primary concern'}
          </li>
          <li>
            <strong>Wind Conditions:</strong>{' '}
            {readings.wind_speed < 2
              ? 'Poor - Pollution will accumulate'
              : 'Good - Natural dispersal occurring'}
          </li>
        </ul>
      </div>
    </div>
  );
}

export default SectorDetail;
