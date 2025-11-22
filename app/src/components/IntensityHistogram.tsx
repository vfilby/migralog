import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { episodeRepository, intensityRepository } from '../database/episodeRepository';
import { Episode, IntensityReading, TimeRangeDays } from '../models/types';
import {
  getDateRangeForDays,
  calculateIntensityHistogram,
  IntensityHistogramData,
} from '../utils/analyticsUtils';
import { getPainColor } from '../utils/painScale';

interface IntensityHistogramProps {
  selectedRange: TimeRangeDays;
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
});

export default function IntensityHistogram({ selectedRange }: IntensityHistogramProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [intensityReadings, setIntensityReadings] = useState<IntensityReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load episodes by date range and all intensity readings
  // This ensures we get ALL episodes in the selected range, not just the first 50
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { startDate, endDate } = getDateRangeForDays(selectedRange);
        const [rangeEpisodes, readings] = await Promise.all([
          episodeRepository.getByDateRange(startDate.getTime(), endDate.getTime()),
          intensityRepository.getAll(),
        ]);
        setEpisodes(rangeEpisodes);
        setIntensityReadings(readings);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedRange]);

  const histogramData = useMemo(() => {
    // Don't calculate until data is loaded
    if (isLoading) {
      return Array.from({ length: 10 }, (_, i) => ({ intensity: i + 1, count: 0 }));
    }
    const { startDate, endDate } = getDateRangeForDays(selectedRange);
    return calculateIntensityHistogram(episodes, intensityReadings, startDate, endDate);
  }, [selectedRange, episodes, intensityReadings, isLoading]);

  // Calculate max count for scaling bars
  const maxCount = useMemo(() => {
    return Math.max(...histogramData.map(d => d.count), 1);
  }, [histogramData]);

  // Check if there are any episodes with intensity readings
  const hasData = useMemo(() => {
    return histogramData.some(d => d.count > 0);
  }, [histogramData]);


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
          </>
        )}
      </View>
    </View>
  );
}
