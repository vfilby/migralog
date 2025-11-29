import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { getPainColor, PAIN_SCALE } from '../../utils/painScale';
import { IntensityReading } from '../../models/types';

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
}

const IntensitySparkline: React.FC<IntensitySparklineProps> = ({
  readings,
  episodeEndTime,
  width = 120,
  height = 40,
  color,
}) => {
  // Interpolate intensity readings using 5-minute intervals with sample-and-hold
  const interpolatedData = useMemo(() => {
    if (!readings || readings.length === 0) {
      return [];
    }

    // Ensure we have valid data and sort by timestamp
    const validReadings = readings
      .filter(r => typeof r.intensity === 'number' && !isNaN(r.intensity) && typeof r.timestamp === 'number')
      .sort((a, b) => a.timestamp - b.timestamp);

    if (validReadings.length === 0) {
      return [];
    }
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

    // Apply Reverse (Look-Ahead) Exponential Moving Average for smoothing
    // Process from end to start so the curve anticipates changes instead of lagging
    // Higher alpha = more responsive (less smooth), lower alpha = smoother
    // alpha = 0.30 provides light smoothing with high responsiveness
    const alpha = 0.30;
    const smoothed: Array<{ timestamp: number; intensity: number }> = new Array(data.length);

    // Process backwards from end to start
    for (let index = data.length - 1; index >= 0; index--) {
      if (index === data.length - 1) {
        // Last point uses raw value
        smoothed[index] = data[index];
      } else {
        // Reverse EMA formula: EMA(t) = alpha * value(t) + (1 - alpha) * EMA(t+1)
        // Looks ahead to the next point instead of back to the previous
        const ema = alpha * data[index].intensity + (1 - alpha) * smoothed[index + 1].intensity;
        smoothed[index] = { timestamp: data[index].timestamp, intensity: ema };
      }
    }

    return smoothed;
  }, [readings, episodeEndTime]);

  // Early return after all hooks
  if (interpolatedData.length === 0) {
    return null;
  }

  // Ensure we have valid data and sort by timestamp
  const validReadings = readings
    .filter(r => typeof r.intensity === 'number' && !isNaN(r.intensity) && typeof r.timestamp === 'number')
    .sort((a, b) => a.timestamp - b.timestamp);

  // Find min/max for scaling
  const minIntensity = 0; // Always start from 0 for pain scale
  const maxIntensity = 10; // Max pain scale

  // Calculate path
  const padding = 4;
  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);
  const xStep = chartWidth / (interpolatedData.length - 1 || 1);

  // Generate path coordinates using linear segments (EMA-smoothed)
  const pathData = interpolatedData
    .map((point, index) => {
      const x = padding + (index * xStep);
      const normalizedY = (point.intensity - minIntensity) / (maxIntensity - minIntensity);
      // Invert Y coordinate (SVG Y increases downward)
      const y = padding + chartHeight - (normalizedY * chartHeight);

      if (index === 0) {
        return `M ${x},${y}`;
      } else {
        return `L ${x},${y}`;
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

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        <Defs>
          {/* Pain scale gradient for background - bottom (green) to top (purple) */}
          <LinearGradient id="painGradientBg" x1="0" y1="1" x2="0" y2="0">
            {/* Create gradient stops for each pain level */}
            {PAIN_SCALE.map((level, index) => (
              <Stop
                key={`bg-${level.value}`}
                offset={`${(index / (PAIN_SCALE.length - 1)) * 100}%`}
                stopColor={level.color}
                stopOpacity="0.15"
              />
            ))}
          </LinearGradient>

          {/* Pain scale gradient for line stroke - bottom (green) to top (purple) */}
          {/* Use userSpaceOnUse to map gradient to absolute pain scale (0-10), not path bounding box */}
          <LinearGradient
            id="painGradientLine"
            x1="0"
            y1={height - padding}
            x2="0"
            y2={padding}
            gradientUnits="userSpaceOnUse"
          >
            {/* Create gradient stops for each pain level */}
            {PAIN_SCALE.map((level, index) => (
              <Stop
                key={`line-${level.value}`}
                offset={`${(index / (PAIN_SCALE.length - 1)) * 100}%`}
                stopColor={level.color}
                stopOpacity="1"
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
          fill="url(#painGradientBg)"
          rx={4}
        />

        {/* Sparkline path */}
        <Path
          d={pathData}
          stroke={color || "url(#painGradientLine)"}
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
