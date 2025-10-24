import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { getPainColor, PAIN_SCALE } from '../utils/painScale';

interface IntensitySparklineProps {
  /**
   * Array of intensity readings (0-10 scale)
   */
  intensities: number[];
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
  intensities,
  width = 120,
  height = 40,
  color,
  showPeak = true,
}) => {
  if (!intensities || intensities.length === 0) {
    return null;
  }

  // Ensure we have valid data
  const validIntensities = intensities.filter(i => typeof i === 'number' && !isNaN(i));
  if (validIntensities.length === 0) {
    return null;
  }

  // Find min/max for scaling
  const minIntensity = 0; // Always start from 0 for pain scale
  const maxIntensity = 10; // Max pain scale
  const peakIntensity = Math.max(...validIntensities);
  const peakIndex = validIntensities.indexOf(peakIntensity);

  // Calculate path
  const padding = 4;
  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);
  const xStep = chartWidth / (validIntensities.length - 1 || 1);

  // Apply Exponential Moving Average (EMA) for smoothing
  const alpha = 0.75; // Smoothing factor (0 < alpha < 1, lower = smoother, higher = more responsive)
  const smoothedIntensities = validIntensities.reduce<number[]>((acc, intensity, index) => {
    if (index === 0) {
      acc.push(intensity);
    } else {
      // EMA formula: EMA(t) = alpha * value(t) + (1 - alpha) * EMA(t-1)
      const ema = alpha * intensity + (1 - alpha) * acc[index - 1];
      acc.push(ema);
    }
    return acc;
  }, []);

  // Generate smooth path coordinates using quadratic curves
  const pathData = smoothedIntensities
    .map((intensity, index) => {
      const x = padding + (index * xStep);
      const normalizedY = (intensity - minIntensity) / (maxIntensity - minIntensity);
      // Invert Y coordinate (SVG Y increases downward)
      const y = padding + chartHeight - (normalizedY * chartHeight);

      if (index === 0) {
        return `M ${x},${y}`;
      } else {
        // Use quadratic bezier curve for smooth interpolation
        const prevX = padding + ((index - 1) * xStep);
        const prevIntensity = smoothedIntensities[index - 1];
        const prevNormalizedY = (prevIntensity - minIntensity) / (maxIntensity - minIntensity);
        const prevY = padding + chartHeight - (prevNormalizedY * chartHeight);

        // Control point is midway between points
        const cpX = (prevX + x) / 2;

        return `Q ${cpX},${prevY} ${x},${y}`;
      }
    })
    .join(' ');

  // Peak point coordinates
  const peakX = padding + (peakIndex * xStep);
  const peakNormalizedY = (peakIntensity - minIntensity) / (maxIntensity - minIntensity);
  const peakY = padding + chartHeight - (peakNormalizedY * chartHeight);

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

        {/* Peak intensity marker */}
        {showPeak && (
          <Circle
            cx={peakX}
            cy={peakY}
            r={3}
            fill={lineColor}
            stroke="white"
            strokeWidth={1.5}
          />
        )}
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
