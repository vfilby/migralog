import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import MonthlyCalendarView from '../components/MonthlyCalendarView';
import TimeRangeSelector from '../components/TimeRangeSelector';
import EpisodeStatistics from '../components/EpisodeStatistics';
import MedicationUsageStatistics from '../components/MedicationUsageStatistics';

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
  statisticsHeaderContainer: {
    backgroundColor: theme.background,
  },
  statisticsHeader: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
});

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [selectedTimeRange, setSelectedTimeRange] = useState<7 | 30 | 90>(30);

  return (
    <View style={styles.container} testID="analytics-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Trends & Analytics</Text>
      </View>

      <ScrollView style={styles.content} stickyHeaderIndices={[2]} testID="analytics-scroll-view">
        {/* Monthly Calendar View */}
        <MonthlyCalendarView />

        {/* Statistics Header */}
        <View style={styles.statisticsHeaderContainer}>
          <Text style={styles.statisticsHeader}>Statistics</Text>
        </View>

        {/* Time Range Selector - Sticky when scrolling */}
        <TimeRangeSelector
          selectedRange={selectedTimeRange}
          onRangeChange={setSelectedTimeRange}
        />

        {/* Episode Statistics */}
        <EpisodeStatistics selectedRange={selectedTimeRange} />

        {/* Medication Usage Statistics */}
        <MedicationUsageStatistics selectedRange={selectedTimeRange} />
      </ScrollView>
    </View>
  );
}

