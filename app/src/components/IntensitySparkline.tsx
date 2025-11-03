import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { getPainColor, PAIN_SCALE } from '../utils/painScale';
import { IntensityReading } from '../models/types';

interface IntensitySparklineProps {
  /**
   * Array of intensity readings with timestamps
   */
  readings: IntensityReading[];
  /**
   * Episode end time (for completed episodes) or undefined for ongoing
   */
  episodeEndTime?: number;
  /**
   * Width of the sparkline in pixels
   */
  width?: number;
  /**
   * Height of the sparkline in pixels
   */
  height?: number;
  /**
   * Color of the line (defaults to peak intensity color)
   */
  color?: string;
  /**
   * Highlight the peak intensity point
   */
  showPeak?: boolean;
}

const IntensitySparkline: React.FC<IntensitySparklineProps> = ({
  readings,
  episodeEndTime,
  width = 120,
  height = 40,
  color,
  showPeak = true,
}) => {
  if (!readings || readings.length === 0) {
    return null;
  }

  // Ensure we have valid data and sort by timestamp
  const validReadings = readings
    .filter(r => typeof r.intensity === 'number' && !isNaN(r.intensity) && typeof r.timestamp === 'number')
    .sort((a, b) => a.timestamp - b.timestamp);

  if (validReadings.length === 0) {
    return null;
  }

  // Interpolate intensity readings using 5-minute intervals with sample-and-hold
  const interpolatedData = useMemo(() => {
    const startTime = validReadings[0].timestamp;
    const endTime = episodeEndTime || Date.now(); // Use current time for ongoing episodes
    const intervalMs = 5 * 60 * 1000; // 5 minutes in milliseconds

    const data: Array<{ timestamp: number; intensity: number }> = [];

    // Generate 5-minute intervals
    for (let time = startTime; time <= endTime; time += intervalMs) {
      // Find the last reading before or at this time (sample-and-hold)
      let intensity = 0;
      for (let i = validReadings.length - 1; i >= 0; i--) {
        if (validReadings[i].timestamp <= time) {
          intensity = validReadings[i].intensity;
          break;
        }
      }

      data.push({ timestamp: time, intensity });
    }

    // Apply Exponential Moving Average (EMA) for smoothing
    // Higher alpha = more responsive (less smooth), lower alpha = smoother
    // alpha = 0.30 provides light smoothing with high responsiveness
    const alpha = 0.30;
    const smoothed: Array<{ timestamp: number; intensity: number }> = [];

    data.forEach((point, index) => {
      if (index === 0) {
        smoothed.push(point);
      } else {
        // EMA formula: EMA(t) = alpha * value(t) + (1 - alpha) * EMA(t-1)
        const ema = alpha * point.intensity + (1 - alpha) * smoothed[index - 1].intensity;
        smoothed.push({ timestamp: point.timestamp, intensity: ema });
      }
    });

    return smoothed;
  }, [validReadings, episodeEndTime]);

  // Find min/max for scaling
  const minIntensity = 0; // Always start from 0 for pain scale
  const maxIntensity = 10; // Max pain scale
  const peakIntensity = Math.max(...interpolatedData.map(d => d.intensity));
  const peakPoint = interpolatedData.reduce((max, point) =>
    point.intensity > max.intensity ? point : max
  , interpolatedData[0]);

  // Calculate path
  const padding = 4;
  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);
  const xStep = chartWidth / (interpolatedData.length - 1 || 1);

  // Generate smooth path coordinates using quadratic curves
  const pathData = interpolatedData
    .map((point, index) => {
      const x = padding + (index * xStep);
      const normalizedY = (point.intensity - minIntensity) / (maxIntensity - minIntensity);
      // Invert Y coordinate (SVG Y increases downward)
      const y = padding + chartHeight - (normalizedY * chartHeight);

      if (index === 0) {
        return `M ${x},${y}`;
      } else {
        // Use quadratic bezier curve for smooth interpolation
        const prevX = padding + ((index - 1) * xStep);
        const prevPoint = interpolatedData[index - 1];
        const prevNormalizedY = (prevPoint.intensity - minIntensity) / (maxIntensity - minIntensity);
        const prevY = padding + chartHeight - (prevNormalizedY * chartHeight);

        // Control point is midway between points
        const cpX = (prevX + x) / 2;

        return `Q ${cpX},${prevY} ${x},${y}`;
      }
    })
    .join(' ');

  // Calculate positions for all logged readings
  const readingPoints = validReadings.map(reading => {
    // Find the closest interpolated point to this reading's timestamp
    const closestIndex = interpolatedData.findIndex(p => p.timestamp >= reading.timestamp);
    const index = closestIndex !== -1 ? closestIndex : interpolatedData.length - 1;

    const x = padding + (index * xStep);
    const normalizedY = (reading.intensity - minIntensity) / (maxIntensity - minIntensity);
    const y = padding + chartHeight - (normalizedY * chartHeight);

    return {
      x,
      y,
      intensity: reading.intensity,
      color: getPainColor(reading.intensity),
    };
  });

  const lineColor = color || getPainColor(peakIntensity);

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        <Defs>
          {/* Pain scale gradient - bottom (green) to top (purple) */}
          <LinearGradient id="painGradient" x1="0" y1="1" x2="0" y2="0">
            {/* Create gradient stops for each pain level */}
            {PAIN_SCALE.map((level, index) => (
              <Stop
                key={level.value}
                offset={`${(index / (PAIN_SCALE.length - 1)) * 100}%`}
                stopColor={level.color}
                stopOpacity="0.15"
              />
            ))}
          </LinearGradient>
        </Defs>

        {/* Background gradient showing pain scale */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="url(#painGradient)"
          rx={4}
        />

        {/* Sparkline path */}
        <Path
          d={pathData}
          stroke={lineColor}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* All logged intensity reading markers */}
        {readingPoints.map((point, index) => (
          <Circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={3}
            fill={point.color}
            stroke="white"
            strokeWidth={1.5}
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default IntensitySparkline;
