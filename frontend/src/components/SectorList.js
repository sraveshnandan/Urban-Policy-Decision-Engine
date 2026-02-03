import React from 'react';
import './SectorList.css';

/**
 * SectorList Component
 * Displays a list of all city sectors with color-coded pollution severity
 */
function SectorList({ sectors, selectedId, onSelectSector }) {
  /**
   * Determine severity level based on PM2.5 value
   * Used for color-coding the sector cards
   */
  const getSeverityLevel = (pm25) => {
    if (pm25 > 250) return 'hazardous';
    if (pm25 > 200) return 'very-unhealthy';
    if (pm25 > 150) return 'unhealthy';
    if (pm25 > 100) return 'unhealthy-sensitive';
    return 'moderate';
  };

  /**
   * Get human-readable severity label
   */
  const getSeverityLabel = (pm25) => {
    if (pm25 > 250) return 'Hazardous';
    if (pm25 > 200) return 'Very Unhealthy';
    if (pm25 > 150) return 'Unhealthy';
    if (pm25 > 100) return 'Unhealthy for Sensitive';
    return 'Moderate';
  };

  /**
   * Get emoji indicator for severity
   */
  const getSeverityEmoji = (pm25) => {
    if (pm25 > 250) return '🔴';
    if (pm25 > 200) return '🟠';
    if (pm25 > 150) return '🟡';
    if (pm25 > 100) return '🟢';
    return '✅';
  };

  return (
    <div className="sector-list">
      {sectors.length === 0 ? (
        <p className="no-data">Loading sectors...</p>
      ) : (
        sectors.map((sector) => (
          <div
            key={sector.sector_id}
            className={`sector-card ${
              selectedId === sector.sector_id ? 'selected' : ''
            } ${getSeverityLevel(sector.pm25)}`}
            onClick={() => onSelectSector(sector.sector_id)}
          >
            {/* Sector Header */}
            <div className="sector-card-header">
              <h3>{sector.sector_name}</h3>
              <span className="severity-emoji">
                {getSeverityEmoji(sector.pm25)}
              </span>
            </div>

            {/* PM2.5 Value */}
            <div className="sector-metric">
              <span className="label">PM2.5</span>
              <span className="value">{sector.pm25.toFixed(1)}</span>
              <span className="unit">μg/m³</span>
            </div>

            {/* Traffic Index */}
            <div className="sector-metric">
              <span className="label">Traffic</span>
              <span className="value traffic">
                {(sector.traffic_index * 100).toFixed(0)}%
              </span>
            </div>

            {/* Wind Speed */}
            <div className="sector-metric">
              <span className="label">Wind</span>
              <span className="value">{sector.wind_speed.toFixed(1)}</span>
              <span className="unit">m/s</span>
            </div>

            {/* Severity Badge */}
            <div className="sector-severity">
              {getSeverityLabel(sector.pm25)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default SectorList;
