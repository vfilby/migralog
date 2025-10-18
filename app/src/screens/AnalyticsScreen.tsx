import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useEpisodeStore } from '../store/episodeStore';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { useTheme, ThemeColors } from '../theme';
import MonthlyCalendarView from '../components/MonthlyCalendarView';

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.card,
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: theme.text,
  },
  content: {
    flex: 1,
  },
  section: {
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
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: theme.textTertiary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 20,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 8,
  },
});

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { episodes, loadEpisodes } = useEpisodeStore();
  const [stats, setStats] = useState({
    totalEpisodes: 0,
    averageDuration: 0,
    averageIntensity: 0,
    episodesThisMonth: 0,
  });

  useEffect(() => {
    loadEpisodes();
  }, []);

  useEffect(() => {
    if (episodes.length === 0) return;

    const now = Date.now();
    const monthStart = startOfMonth(now).getTime();
    const monthEnd = endOfMonth(now).getTime();

    const completedEpisodes = episodes.filter(ep => ep.endTime);
    const episodesThisMonth = episodes.filter(
      ep => ep.startTime >= monthStart && ep.startTime <= monthEnd
    );

    const totalDuration = completedEpisodes.reduce((sum, ep) => {
      return sum + (ep.endTime! - ep.startTime);
    }, 0);

    const totalIntensity = episodes.reduce((sum, ep) => {
      return sum + (ep.peakIntensity || 0);
    }, 0);

    setStats({
      totalEpisodes: episodes.length,
      averageDuration: completedEpisodes.length > 0
        ? totalDuration / completedEpisodes.length / 3600000 // Convert to hours
        : 0,
      averageIntensity: episodes.length > 0
        ? totalIntensity / episodes.length
        : 0,
      episodesThisMonth: episodesThisMonth.length,
    });
  }, [episodes]);

  return (
    <View style={styles.container} testID="analytics-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Trends & Analytics</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Monthly Calendar View */}
        <MonthlyCalendarView />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Month</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.episodesThisMonth}</Text>
              <Text style={styles.statLabel}>Episodes</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalEpisodes}</Text>
              <Text style={styles.statLabel}>Total Episodes</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats.averageDuration.toFixed(1)}h
              </Text>
              <Text style={styles.statLabel}>Avg Duration</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats.averageIntensity.toFixed(1)}/10
              </Text>
              <Text style={styles.statLabel}>Avg Intensity</Text>
            </View>
          </View>
        </View>

        {episodes.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No data yet
            </Text>
            <Text style={styles.emptySubtext}>
              Start tracking episodes to see insights
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <View style={styles.card}>
            <Text style={styles.featureText}>• Pattern recognition</Text>
            <Text style={styles.featureText}>• Trigger analysis</Text>
            <Text style={styles.featureText}>• Medication effectiveness</Text>
            <Text style={styles.featureText}>• Exportable reports</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

