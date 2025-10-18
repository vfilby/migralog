import React from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { format } from 'date-fns';
import { IntensityReading, MedicationDose, Medication } from '../models/types';
import {
  prepareIntensityData,
  prepareMedicationMarkers,
  calculateChartDomain,
  downsampleData,
  shouldEnableZoom,
  getMedicationLabel,
  MedicationMarkerData,
} from '../utils/chartUtils';
import { useTheme, ThemeColors } from '../theme';
import { getPainColor } from '../utils/painScale';

interface IntensityGraphProps {
  episodeId: string;
  intensityReadings: IntensityReading[];
  medicationDoses: MedicationDose[];
  medications: Medication[];
  startTime: number;
  endTime?: number;
  height?: number;
  onMedicationTap?: (markerData: MedicationMarkerData) => void;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: theme.card,
  },
  chartContainer: {
    position: 'relative',
  },
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
  },
  legendText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  preventativeMarker: {
    backgroundColor: '#007AFF',
  },
  rescueMarker: {
    backgroundColor: '#FF9500',
  },
  medicationMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  medicationIcon: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

/**
 * Interactive intensity graph with medication overlays
 * Shows pain intensity over time with medication timing markers
 */
export const IntensityGraph: React.FC<IntensityGraphProps> = ({
  episodeId,
  intensityReadings,
  medicationDoses,
  medications,
  startTime,
  endTime,
  height = 300,
  onMedicationTap,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const screenWidth = Dimensions.get('window').width - 32;

  // Prepare data
  const segments = prepareIntensityData(intensityReadings);
  const medicationMarkers = prepareMedicationMarkers(medicationDoses, medications);
  const domain = calculateChartDomain(intensityReadings, startTime, endTime);

  // Handle empty data
  if (segments.length === 0 || intensityReadings.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.noDataContainer, { height }]}>
          <Text style={styles.noDataText}>No intensity data recorded</Text>
        </View>
      </View>
    );
  }

  // Get peak intensity for line color
  const peakIntensity = Math.max(...intensityReadings.map(r => r.intensity));
  const lineColor = getPainColor(peakIntensity);

  // Handle medication marker tap
  const handleMedicationTap = (markerData: MedicationMarkerData) => {
    if (onMedicationTap) {
      onMedicationTap(markerData);
    } else {
      // Default behavior: show alert with medication info
      Alert.alert(
        markerData.medication.name,
        getMedicationLabel(markerData),
        [{ text: 'OK' }]
      );
    }
  };

  // Chart dimensions
  const padding = { top: 50, bottom: 50, left: 40, right: 20 };
  const chartWidth = screenWidth - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Downsample data if too many points
  const chartData = segments.map(segment => {
    if (segment.length > 100) {
      return downsampleData(segment, 100);
    }
    return segment;
  });

  // Scale functions
  const scaleX = (x: number) => padding.left + ((x - domain.x[0]) / (domain.x[1] - domain.x[0])) * chartWidth;
  const scaleY = (y: number) => padding.top + chartHeight - ((y - domain.y[0]) / (domain.y[1] - domain.y[0])) * chartHeight;

  // Generate axis ticks
  const yTicks = [0, 2, 4, 6, 8, 10];
  const xTicks = 5;
  const xTickValues: number[] = [];
  for (let i = 0; i <= xTicks; i++) {
    const tickValue = domain.x[0] + (i / xTicks) * (domain.x[1] - domain.x[0]);
    xTickValues.push(tickValue);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.chartContainer, { width: screenWidth, height }]}>
        <Svg width={screenWidth} height={height}>
          <Defs>
            <LinearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lineColor} stopOpacity="0.2" />
              <Stop offset="1" stopColor={lineColor} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {/* Y-axis grid lines */}
          {yTicks.map(tick => {
            const y = scaleY(tick);
            return (
              <Line
                key={`y-grid-${tick}`}
                x1={padding.left}
                y1={y}
                x2={screenWidth - padding.right}
                y2={y}
                stroke={theme.borderLight}
                strokeWidth={1}
                strokeDasharray="4, 4"
              />
            );
          })}

          {/* X-axis grid lines */}
          {xTickValues.map((tick, i) => {
            const x = scaleX(tick);
            return (
              <Line
                key={`x-grid-${i}`}
                x1={x}
                y1={padding.top}
                x2={x}
                y2={height - padding.bottom}
                stroke={theme.borderLight}
                strokeWidth={1}
                strokeDasharray="4, 4"
              />
            );
          })}

          {/* Y-axis */}
          <Line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke={theme.border}
            strokeWidth={2}
          />

          {/* X-axis */}
          <Line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={screenWidth - padding.right}
            y2={height - padding.bottom}
            stroke={theme.border}
            strokeWidth={2}
          />

          {/* Y-axis labels */}
          {yTicks.map(tick => {
            const y = scaleY(tick);
            return (
              <SvgText
                key={`y-label-${tick}`}
                x={padding.left - 8}
                y={y + 4}
                fontSize={10}
                fill={theme.textSecondary}
                textAnchor="end"
              >
                {tick}
              </SvgText>
            );
          })}

          {/* X-axis labels */}
          {xTickValues.map((tick, i) => {
            const x = scaleX(tick);
            const label = format(new Date(tick), 'HH:mm');
            return (
              <SvgText
                key={`x-label-${i}`}
                x={x}
                y={height - padding.bottom + 20}
                fontSize={10}
                fill={theme.textSecondary}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            );
          })}

          {/* Render each segment */}
          {chartData.map((segment, segmentIndex) => {
            // Build line path
            const linePath = segment.map((d, i) => {
              const x = scaleX(d.x);
              const y = scaleY(d.y);
              return i === 0 ? `M${x},${y}` : `L${x},${y}`;
            }).join(' ');

            // Build area path
            const areaPath = linePath +
              ` L${scaleX(segment[segment.length - 1].x)},${height - padding.bottom}` +
              ` L${scaleX(segment[0].x)},${height - padding.bottom} Z`;

            return (
              <React.Fragment key={`segment-${segmentIndex}`}>
                {/* Area under line */}
                <Path
                  d={areaPath}
                  fill="url(#chartAreaGradient)"
                />

                {/* Line */}
                <Path
                  d={linePath}
                  stroke={lineColor}
                  strokeWidth={2}
                  fill="none"
                />

                {/* Data points */}
                {segment.map((d, i) => {
                  const x = scaleX(d.x);
                  const y = scaleY(d.y);
                  return (
                    <Circle
                      key={`point-${segmentIndex}-${i}`}
                      cx={x}
                      cy={y}
                      r={3}
                      fill={lineColor}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Medication markers overlay */}
        {medicationMarkers.map((marker, index) => {
          const x = scaleX(marker.timestamp);
          const y = padding.top - 10; // Position above chart area

          const markerColor = marker.type === 'preventative' ? '#007AFF' : '#FF9500';
          const icon = marker.type === 'preventative' ? 'P' : 'R';

          return (
            <TouchableOpacity
              key={`marker-${marker.dose.id}-${index}`}
              style={[
                styles.medicationMarker,
                {
                  left: x - 14,
                  top: y,
                  backgroundColor: markerColor,
                  borderColor: theme.background,
                },
              ]}
              onPress={() => handleMedicationTap(marker)}
              accessibilityLabel={`Medication: ${getMedicationLabel(marker)}`}
              accessibilityRole="button"
            >
              <Text style={styles.medicationIcon}>{icon}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      {medicationMarkers.length > 0 && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendMarker, styles.preventativeMarker]} />
            <Text style={styles.legendText}>Preventative</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendMarker, styles.rescueMarker]} />
            <Text style={styles.legendText}>Rescue</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default IntensityGraph;
