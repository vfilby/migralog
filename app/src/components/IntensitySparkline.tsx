import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { getPainColor } from '../utils/painScale';

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

  // Generate path coordinates
  const pathData = validIntensities
    .map((intensity, index) => {
      const x = padding + (index * xStep);
      const normalizedY = (intensity - minIntensity) / (maxIntensity - minIntensity);
      // Invert Y coordinate (SVG Y increases downward)
      const y = padding + chartHeight - (normalizedY * chartHeight);
      return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
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
