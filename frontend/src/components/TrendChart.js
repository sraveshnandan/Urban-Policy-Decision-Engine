import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import './TrendChart.css';

/**
 * TrendChart Component
 * Displays PM2.5, PM10, NO2, and CO trends over time using a line chart
 */
function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return null;
  }

  // Get the latest values for summary
  const latestPM25 = data[data.length - 1]?.pm25 || 0;
  const latestPM10 = data[data.length - 1]?.pm10 || 0;
  const latestNO2 = data[data.length - 1]?.no2 || 0;
  const latestCO = data[data.length - 1]?.co || 0;
  const previousPM25 = data[data.length - 2]?.pm25 || latestPM25;
  const trend25 = latestPM25 >= previousPM25 ? '📈' : '📉';
  const trend10 = latestPM10 >= (data[data.length - 2]?.pm10 || latestPM10) ? '📈' : '📉';
  const trendNO2 = latestNO2 >= (data[data.length - 2]?.no2 || latestNO2) ? '📈' : '📉';
  const trendCO = latestCO >= (data[data.length - 2]?.co || latestCO) ? '📈' : '📉';

  // Prepare data for chart - show simplified x-axis labels
  const chartData = data.map((item, index) => ({
    ...item,
    displayTime: index % 3 === 0 ? item.time.split(' ')[1] : '', // Show every 3rd time
  }));

  const pm25Color = '#00ffc8';
  const pm10Color = '#64c8ff';
  const no2Color = '#a78bfa';
  const coColor = '#fbbf24';
  const gridColor = '#3a3a4e';
  const textColor = '#e0e0e0';
  const tooltipBg = '#1e1e2e';
  const tooltipBorder = '#667eea';

  return (
    <div className="trend-chart dark">
      <div className="chart-header">
        <h3>📊 Air Quality Trends (Last {data.length} Readings)</h3>
        <div className="trend-summary">
          <span className="trend-value">PM2.5: {latestPM25.toFixed(1)} µg/m³ {trend25}</span>
          <span className="trend-value">PM10: {latestPM10.toFixed(1)} µg/m³ {trend10}</span>
          <span className="trend-value">NO₂: {latestNO2.toFixed(1)} ppb {trendNO2}</span>
          <span className="trend-value">CO: {latestCO.toFixed(2)} ppm {trendCO}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="displayTime"
            stroke={textColor}
            style={{ fontSize: '0.85rem' }}
          />
          <YAxis
            stroke={textColor}
            style={{ fontSize: '0.85rem' }}
            label={{ value: 'PM2.5 (µg/m³)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `2px solid ${tooltipBorder}`,
              borderRadius: '8px',
              color: textColor,
            }}
            formatter={(value) => [value.toFixed(2), 'PM Level']}
            labelStyle={{ color: textColor }}
          />
          <Legend wrapperStyle={{ color: textColor }} />
          <Line
            type="monotone"
            dataKey="pm25"
            stroke={pm25Color}
            dot={false}
            strokeWidth={3}
            isAnimationActive={false}
            name="PM2.5 (µg/m³)"
          />
          <Line
            type="monotone"
            dataKey="pm10"
            stroke={pm10Color}
            dot={false}
            strokeWidth={3}
            isAnimationActive={false}
            name="PM10 (µg/m³)"
          />
          <Line
            type="monotone"
            dataKey="no2"
            stroke={no2Color}
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
            name="NO₂ (ppb)"
          />
          <Line
            type="monotone"
            dataKey="co"
            stroke={coColor}
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
            name="CO (ppm)"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="trend-info">
        <p>
          ℹ️ The chart displays real-time air quality trends for PM2.5, PM10, NO₂, and CO.
          Upward trends indicate increasing pollution levels in the selected sector.
        </p>
      </div>
    </div>
  );
}

export default TrendChart;
