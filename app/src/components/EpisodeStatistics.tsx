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
  durationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
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

    // Calculate migraine days (unique days with episodes)
    const migraineDays = calculateMigraineDays(episodes, startDate, endDate);

    // Calculate episode frequency (total count)
    const episodeFrequency = calculateEpisodeFrequency(episodes, startDate, endDate);

    // Categorize days by status
    const dayCategorization = categorizeDays(dailyStatuses, startDate, endDate);

    // Calculate duration metrics
    const durationMetrics = calculateDurationMetrics(
      episodes.filter(ep => ep.startTime >= startDate.getTime() && ep.startTime <= endDate.getTime())
    );

    return {
      migraineDays,
      episodeFrequency,
      dayCategorization,
      durationMetrics,
    };
  }, [selectedRange, episodes, dailyStatuses]);

  const hasEpisodes = statistics.episodeFrequency > 0;

  return (
    <View style={styles.container} testID="episode-statistics">
      <Text style={styles.sectionTitle}>Episode Statistics</Text>

      {!hasEpisodes ? (
        <View style={styles.emptyContainer} testID="empty-state">
          <Text style={styles.emptyText}>No episodes in selected period</Text>
        </View>
      ) : (
        <>
          {/* Episode & Day Counts */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard} testID="migraine-days-card">
              <Text style={styles.statValue} accessibilityLabel={`${statistics.migraineDays} migraine days`}>
                {statistics.migraineDays}
              </Text>
              <Text style={styles.statLabel}>Migraine Days</Text>
            </View>

            <View style={styles.statCard} testID="total-episodes-card">
              <Text style={styles.statValue} accessibilityLabel={`${statistics.episodeFrequency} total episodes`}>
                {statistics.episodeFrequency}
              </Text>
              <Text style={styles.statLabel}>Total Episodes</Text>
            </View>
          </View>

          {/* Day Categorization */}
          <View style={[styles.statsGrid, { marginTop: 12 }]}>
            <View style={styles.statCard} testID="clear-days-card">
              <Text style={styles.statValue} accessibilityLabel={`${statistics.dayCategorization.clear} clear days`}>
                {statistics.dayCategorization.clear}
              </Text>
              <Text style={styles.statLabel}>Clear Days</Text>
            </View>

            <View style={styles.statCard} testID="unclear-days-card">
              <Text style={styles.statValue} accessibilityLabel={`${statistics.dayCategorization.unclear} unclear days`}>
                {statistics.dayCategorization.unclear}
              </Text>
              <Text style={styles.statLabel}>Unclear Days</Text>
            </View>

            <View style={styles.statCard} testID="untracked-days-card">
              <Text style={styles.statValue} accessibilityLabel={`${statistics.dayCategorization.untracked} untracked days`}>
                {statistics.dayCategorization.untracked}
              </Text>
              <Text style={styles.statLabel}>Untracked Days</Text>
            </View>
          </View>

          {/* Duration Metrics */}
          <View style={styles.durationCard} testID="duration-metrics-card">
            <Text style={styles.durationTitle}>Episode Durations</Text>

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
        </>
      )}
    </View>
  );
}
