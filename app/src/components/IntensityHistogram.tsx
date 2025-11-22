import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { useEpisodeStore } from '../store/episodeStore';
import { intensityRepository } from '../database/episodeRepository';
import { IntensityReading } from '../models/types';
import {
  getDateRangeForDays,
  calculateIntensityHistogram,
  IntensityHistogramData,
} from '../utils/analyticsUtils';
import { getPainColor } from '../utils/painScale';

interface IntensityHistogramProps {
  selectedRange: 7 | 30 | 90;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  histogramContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 8,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  bar: {
    width: '80%',
    minHeight: 4,
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    marginTop: 4,
  },
  countLabel: {
    fontSize: 10,
    color: theme.text,
    marginBottom: 2,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    justifyContent: 'center',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: theme.textSecondary,
  },
});

export default function IntensityHistogram({ selectedRange }: IntensityHistogramProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { episodes } = useEpisodeStore();
  const [intensityReadings, setIntensityReadings] = useState<IntensityReading[]>([]);

  // Load all intensity readings from the repository
  useEffect(() => {
    const loadData = async () => {
      const readings = await intensityRepository.getAll();
      setIntensityReadings(readings);
    };

    loadData();
  }, []);

  const histogramData = useMemo(() => {
    const { startDate, endDate } = getDateRangeForDays(selectedRange);
    return calculateIntensityHistogram(episodes, intensityReadings, startDate, endDate);
  }, [selectedRange, episodes, intensityReadings]);

  // Calculate max count for scaling bars
  const maxCount = useMemo(() => {
    return Math.max(...histogramData.map(d => d.count), 1);
  }, [histogramData]);

  // Check if there are any episodes with intensity readings
  const hasData = useMemo(() => {
    return histogramData.some(d => d.count > 0);
  }, [histogramData]);

  // Group intensity levels for legend
  const legendItems = [
    { label: 'Mild (1-3)', color: getPainColor(2) },
    { label: 'Moderate (4-6)', color: getPainColor(5) },
    { label: 'Severe (7-10)', color: getPainColor(8) },
  ];

  return (
    <View style={styles.container} testID="intensity-histogram">
      <Text style={styles.sectionTitle} accessibilityRole="header">Peak Intensity Distribution</Text>

      <View style={styles.card} testID="histogram-card">
        {!hasData ? (
          <View style={styles.emptyContainer} testID="histogram-empty-state">
            <Text style={styles.emptyText}>No intensity data in selected period</Text>
          </View>
        ) : (
          <>
            <View
              style={styles.histogramContainer}
              testID="histogram-bars"
              accessibilityRole="none"
              accessibilityLabel={`Histogram showing episode counts by peak intensity level`}
            >
              {histogramData.map((item: IntensityHistogramData) => {
                const barHeight = item.count > 0
                  ? Math.max((item.count / maxCount) * 100, 8)
                  : 4;
                const barColor = getPainColor(item.intensity);

                return (
                  <View
                    key={item.intensity}
                    style={styles.barContainer}
                    testID={`histogram-bar-${item.intensity}`}
                  >
                    {item.count > 0 && (
                      <Text style={styles.countLabel}>{item.count}</Text>
                    )}
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor: item.count > 0 ? barColor : theme.border,
                        },
                      ]}
                      accessibilityLabel={`Intensity ${item.intensity}: ${item.count} episodes`}
                    />
                    <Text style={styles.barLabel}>{item.intensity}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.legendContainer} testID="histogram-legend">
              {legendItems.map((item, index) => (
                <View key={index} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
