import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { useAnalyticsStore } from '../store/analyticsStore';
import { dailyStatusRepository } from '../database/dailyStatusRepository';
import { DailyStatusLog, TimeRangeDays } from '../models/types';
import {
  calculateEpisodeFrequency,
  calculateDurationMetrics,
  formatDuration,
  formatDateToYYYYMMDD,
} from '../utils/analyticsUtils';

interface EpisodeStatisticsProps {
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
    marginTop: 8,
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

  // Use the analytics store for episodes (follows Components → Stores → Repositories pattern)
  const { episodes, dateRange, setDateRange } = useAnalyticsStore();
  const [dailyStatuses, setDailyStatuses] = useState<DailyStatusLog[]>([]);

  // Update the store's date range when the selected range changes
  useEffect(() => {
    setDateRange(selectedRange);
  }, [selectedRange, setDateRange]);

  // Load daily statuses directly from repository for the date range
  // This prevents issues with the shared store being overwritten by the calendar
  useEffect(() => {
    const loadData = async () => {
      const startDateStr = formatDateToYYYYMMDD(dateRange.startDate);
      const endDateStr = formatDateToYYYYMMDD(dateRange.endDate);

      const statuses = await dailyStatusRepository.getDateRange(startDateStr, endDateStr);
      setDailyStatuses(statuses);
    };

    loadData();
  }, [dateRange]);

  const statistics = useMemo(() => {
    const { startDate, endDate } = dateRange;

    // Calculate actual total days in range (inclusive)
    // Normalize dates to midnight for accurate day counting
    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.round((normalizedEnd.getTime() - normalizedStart.getTime()) / msPerDay) + 1;

    // Calculate episode frequency (total count)
    const episodeFrequency = calculateEpisodeFrequency(episodes, startDate, endDate);

    // Categorize each day with priority: episode > daily status
    // This ensures mutually exclusive categories that sum to 100%

    // Filter episodes to only those that touch the date range
    // Use endDate (end of day) for filtering, not normalizedEnd (midnight)
    const relevantEpisodes = episodes.filter(episode => {
      const episodeStart = new Date(episode.startTime);
      // For ongoing episodes (no endTime), use current time to include all days up to now
      const episodeEnd = episode.endTime ? new Date(episode.endTime) : new Date();

      // Episode touches range if it starts before range ends AND ends after range starts
      return episodeEnd >= startDate && episodeStart <= endDate;
    });

    // Create maps for fast lookup
    const episodeDaysSet = new Set<string>();
    relevantEpisodes.forEach(episode => {
      const episodeStart = new Date(episode.startTime);
      // For ongoing episodes (no endTime), use current time to include all days up to now
      const episodeEnd = episode.endTime ? new Date(episode.endTime) : new Date();

      // Mark all days this episode spans (but only within the date range)
      // Use normalizedStart for start boundary, but endDate for end boundary
      // to ensure episodes on the current day are included
      const current = new Date(Math.max(episodeStart.getTime(), normalizedStart.getTime()));
      current.setHours(0, 0, 0, 0);
      const end = new Date(Math.min(episodeEnd.getTime(), endDate.getTime()));
      end.setHours(0, 0, 0, 0);

      while (current <= end) {
        episodeDaysSet.add(formatDateToYYYYMMDD(current));
        current.setDate(current.getDate() + 1);
      }
    });

    // Filter daily statuses to only those in our date range
    // This ensures we're not affected by whatever month the calendar is showing
    const startDateStr = formatDateToYYYYMMDD(normalizedStart);
    const endDateStr = formatDateToYYYYMMDD(normalizedEnd);
    const relevantDailyStatuses = dailyStatuses.filter(log =>
      log.date >= startDateStr && log.date <= endDateStr
    );

    const statusMap = new Map<string, 'green' | 'yellow' | 'red'>();
    relevantDailyStatuses.forEach(log => {
      statusMap.set(log.date, log.status);
    });

    // Categorize each day
    let migraineDays = 0;
    let notClearDays = 0;
    let clearDays = 0;
    let unknownDays = 0;

    const currentDate = new Date(normalizedStart);
    for (let i = 0; i < totalDays; i++) {
      const dateStr = formatDateToYYYYMMDD(currentDate);

      // Priority 1: Check if this is a migraine day (has episode)
      if (episodeDaysSet.has(dateStr)) {
        migraineDays++;
      } else {
        // Priority 2: Check daily status
        const status = statusMap.get(dateStr);
        if (status === 'green') {
          clearDays++;
        } else if (status === 'yellow') {
          notClearDays++;
        } else {
          // No episode and no status (or red status without episode, which shouldn't happen)
          unknownDays++;
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate percentages
    const migraineDaysPercent = Math.round((migraineDays / totalDays) * 100);
    const notClearDaysPercent = Math.round((notClearDays / totalDays) * 100);
    const clearDaysPercent = Math.round((clearDays / totalDays) * 100);
    const unknownDaysPercent = Math.round((unknownDays / totalDays) * 100);

    // Calculate duration metrics
    const durationMetrics = calculateDurationMetrics(
      episodes.filter(ep => ep.startTime >= startDate.getTime() && ep.startTime <= endDate.getTime())
    );

    return {
      totalDays,
      migraineDays,
      migraineDaysPercent,
      notClearDays,
      notClearDaysPercent,
      clearDays,
      clearDaysPercent,
      unknownDays,
      unknownDaysPercent,
      episodeFrequency,
      durationMetrics,
    };
  }, [dateRange, episodes, dailyStatuses]);

  const hasEpisodes = statistics.episodeFrequency > 0;

  return (
    <View style={styles.container} testID="episode-statistics" accessibilityRole="summary">
      {/* Day Statistics */}
      <Text style={styles.sectionTitle} accessibilityRole="header">Day Statistics</Text>
      <View style={styles.durationCard} testID="day-statistics-card" accessible accessibilityLabel="Day statistics">
        <View style={styles.durationRow} testID="migraine-days-row">
          <Text style={styles.durationRowLabel}>Migraine Days:</Text>
          <Text
            style={styles.durationRowValue}
            accessibilityLabel={`Migraine days: ${statistics.migraineDays} (${statistics.migraineDaysPercent}%)`}
          >
            {statistics.migraineDays} ({statistics.migraineDaysPercent}%)
          </Text>
        </View>

        <View style={styles.durationRow} testID="not-clear-days-row">
          <Text style={styles.durationRowLabel}>Not Clear Days:</Text>
          <Text
            style={styles.durationRowValue}
            accessibilityLabel={`Not clear days: ${statistics.notClearDays} (${statistics.notClearDaysPercent}%)`}
          >
            {statistics.notClearDays} ({statistics.notClearDaysPercent}%)
          </Text>
        </View>

        <View style={styles.durationRow} testID="clear-days-row">
          <Text style={styles.durationRowLabel}>Clear Days:</Text>
          <Text
            style={styles.durationRowValue}
            accessibilityLabel={`Clear days: ${statistics.clearDays} (${statistics.clearDaysPercent}%)`}
          >
            {statistics.clearDays} ({statistics.clearDaysPercent}%)
          </Text>
        </View>

        <View style={[styles.durationRow, styles.durationRowLast]} testID="unknown-days-row">
          <Text style={styles.durationRowLabel}>Unknown Days:</Text>
          <Text
            style={styles.durationRowValue}
            accessibilityLabel={`Unknown days: ${statistics.unknownDays} (${statistics.unknownDaysPercent}%)`}
          >
            {statistics.unknownDays} ({statistics.unknownDaysPercent}%)
          </Text>
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
