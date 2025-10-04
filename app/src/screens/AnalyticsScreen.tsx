import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useEpisodeStore } from '../store/episodeStore';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';

export default function AnalyticsScreen() {
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trends & Analytics</Text>
      </View>

      <ScrollView style={styles.content}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#000',
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
    color: '#000',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#C7C7CC',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureText: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
  },
});
