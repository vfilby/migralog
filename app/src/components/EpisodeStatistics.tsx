import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { useEpisodeStore } from '../store/episodeStore';
import { useDailyStatusStore } from '../store/dailyStatusStore';
import {
  getDateRangeForDays,
  calculateMigraineDays,
  calculateEpisodeFrequency,
  categorizeDays,
  calculateDurationMetrics,
  formatDuration,
} from '../utils/analyticsUtils';

interface EpisodeStatisticsProps {
  selectedRange: 7 | 30 | 90;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 20,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: theme.card,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  durationCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 20,
    marginTop: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  durationRowLast: {
    borderBottomWidth: 0,
  },
  durationRowLabel: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  durationRowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
});

export default function EpisodeStatistics({ selectedRange }: EpisodeStatisticsProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { episodes } = useEpisodeStore();
  const { dailyStatuses } = useDailyStatusStore();

  const statistics = useMemo(() => {
    const { startDate, endDate } = getDateRangeForDays(selectedRange);

    // Calculate total days in range
    const totalDays = selectedRange;

    // Calculate migraine days (unique days with episodes)
    const migraineDays = calculateMigraineDays(episodes, startDate, endDate);

    // Calculate episode frequency (total count)
    const episodeFrequency = calculateEpisodeFrequency(episodes, startDate, endDate);

    // Categorize days by status
    const dayCategorization = categorizeDays(dailyStatuses, startDate, endDate);

    // Calculate percentages
    const migraineDaysPercent = Math.round((migraineDays / totalDays) * 100);
    const clearDaysPercent = Math.round((dayCategorization.clear / totalDays) * 100);
    const notClearDays = dayCategorization.unclear + dayCategorization.untracked;
    const notClearDaysPercent = Math.round((notClearDays / totalDays) * 100);

    // Calculate duration metrics
    const durationMetrics = calculateDurationMetrics(
      episodes.filter(ep => ep.startTime >= startDate.getTime() && ep.startTime <= endDate.getTime())
    );

    return {
      totalDays,
      migraineDays,
      migraineDaysPercent,
      episodeFrequency,
      dayCategorization,
      clearDaysPercent,
      notClearDays,
      notClearDaysPercent,
      durationMetrics,
    };
  }, [selectedRange, episodes, dailyStatuses]);

  const hasEpisodes = statistics.episodeFrequency > 0;

  return (
    <View style={styles.container} testID="episode-statistics" accessibilityRole="summary">
      {/* Day Statistics */}
      <Text style={styles.sectionTitle} accessibilityRole="header">Day Statistics</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard} testID="migraine-days-card" accessible accessibilityLabel={`${statistics.migraineDays} migraine days, ${statistics.migraineDaysPercent}% of the selected period`}>
          <Text style={styles.statValue}>
            {statistics.migraineDays}
          </Text>
          <Text style={styles.statLabel}>Migraine Days ({statistics.migraineDaysPercent}%)</Text>
        </View>

        <View style={styles.statCard} testID="clear-days-card" accessible accessibilityLabel={`${statistics.dayCategorization.clear} clear days, ${statistics.clearDaysPercent}% of the selected period`}>
          <Text style={styles.statValue}>
            {statistics.dayCategorization.clear}
          </Text>
          <Text style={styles.statLabel}>Clear Days ({statistics.clearDaysPercent}%)</Text>
        </View>

        <View style={styles.statCard} testID="not-clear-days-card" accessible accessibilityLabel={`${statistics.notClearDays} not clear days, ${statistics.notClearDaysPercent}% of the selected period`}>
          <Text style={styles.statValue}>
            {statistics.notClearDays}
          </Text>
          <Text style={styles.statLabel}>Not Clear Days ({statistics.notClearDaysPercent}%)</Text>
        </View>
      </View>

      {/* Episode Statistics */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]} accessibilityRole="header">Episode Statistics</Text>

      {!hasEpisodes ? (
        <View style={styles.emptyContainer} testID="empty-state">
          <Text style={styles.emptyText}>No episodes in selected period</Text>
        </View>
      ) : (
        <View style={styles.durationCard} testID="duration-metrics-card" accessible accessibilityLabel="Episode statistics">
          <View style={styles.durationRow} testID="total-episodes-row">
            <Text style={styles.durationRowLabel}>Total Episodes:</Text>
            <Text
              style={styles.durationRowValue}
              accessibilityLabel={`Total episodes: ${statistics.episodeFrequency}`}
            >
              {statistics.episodeFrequency}
            </Text>
          </View>

          <View style={styles.durationRow} testID="shortest-duration-row">
            <Text style={styles.durationRowLabel}>Shortest Episode:</Text>
            <Text
              style={styles.durationRowValue}
              accessibilityLabel={`Shortest episode: ${statistics.durationMetrics.shortest !== null ? formatDuration(statistics.durationMetrics.shortest) : 'N/A'}`}
            >
              {statistics.durationMetrics.shortest !== null
                ? formatDuration(statistics.durationMetrics.shortest)
                : 'N/A'}
            </Text>
          </View>

          <View style={styles.durationRow} testID="longest-duration-row">
            <Text style={styles.durationRowLabel}>Longest Episode:</Text>
            <Text
              style={styles.durationRowValue}
              accessibilityLabel={`Longest episode: ${statistics.durationMetrics.longest !== null ? formatDuration(statistics.durationMetrics.longest) : 'N/A'}`}
            >
              {statistics.durationMetrics.longest !== null
                ? formatDuration(statistics.durationMetrics.longest)
                : 'N/A'}
            </Text>
          </View>

          <View style={[styles.durationRow, styles.durationRowLast]} testID="average-duration-row">
            <Text style={styles.durationRowLabel}>Average Duration:</Text>
            <Text
              style={styles.durationRowValue}
              accessibilityLabel={`Average duration: ${statistics.durationMetrics.average !== null ? formatDuration(statistics.durationMetrics.average) : 'N/A'}`}
            >
              {statistics.durationMetrics.average !== null
                ? formatDuration(statistics.durationMetrics.average)
                : 'N/A'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
