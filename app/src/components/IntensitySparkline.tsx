import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { IntensityReading } from '../models/types';
import { prepareIntensityData, downsampleData } from '../utils/chartUtils';
import { useTheme } from '../theme';
import { getPainColor } from '../utils/painScale';

interface IntensitySparklineProps {
  intensityReadings: IntensityReading[];
  peakIntensity?: number;
  width?: number;
  height?: number;
}

/**
 * Mini sparkline graph showing intensity trend
 * Non-interactive, simplified visualization for cards and summaries
 */
export const IntensitySparkline: React.FC<IntensitySparklineProps> = ({
  intensityReadings,
  peakIntensity,
  width = 80,
  height = 40,
}) => {
  const { theme } = useTheme();

  if (!intensityReadings || intensityReadings.length === 0) {
    return null;
  }

  // Prepare data
  const segments = prepareIntensityData(intensityReadings);
  if (segments.length === 0) {
    return null;
  }

  // Use first segment only for sparkline (simplified view)
  let data = segments[0];

  // Downsample if too many points
  if (data.length > 20) {
    data = downsampleData(data, 20);
  }

  // Determine line color based on peak intensity
  const lineColor = peakIntensity ? getPainColor(peakIntensity) : theme.primary;

  // Calculate SVG path
  const minX = Math.min(...data.map(d => d.x));
  const maxX = Math.max(...data.map(d => d.x));
  const minY = 0;
  const maxY = 10;

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Scale functions
  const scaleX = (x: number) => padding + ((x - minX) / (maxX - minX)) * chartWidth;
  const scaleY = (y: number) => height - padding - ((y - minY) / (maxY - minY)) * chartHeight;

  // Build path
  const pathData = data.map((d, i) => {
    const x = scaleX(d.x);
    const y = scaleY(d.y);
    return i === 0 ? `M${x},${y}` : `L${x},${y}`;
  }).join(' ');

  // Build area path (with bottom edge)
  const areaPathData = pathData +
    ` L${scaleX(data[data.length - 1].x)},${height - padding}` +
    ` L${scaleX(data[0].x)},${height - padding} Z`;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.3" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Area under line */}
        <Path
          d={areaPathData}
          fill="url(#areaGradient)"
        />

        {/* Line */}
        <Path
          d={pathData}
          stroke={lineColor}
          strokeWidth={1.5}
          fill="none"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

export default IntensitySparkline;
