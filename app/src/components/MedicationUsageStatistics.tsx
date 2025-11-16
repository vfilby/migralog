import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { useMedicationStore } from '../store/medicationStore';
import {
  getDateRangeForDays,
  calculatePerMedicationStats,
} from '../utils/analyticsUtils';

interface MedicationUsageStatisticsProps {
  selectedRange: 7 | 30 | 90;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  card: {
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
  medicationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 8,
  },
  medicationItemLast: {
    borderBottomWidth: 0,
  },
  medicationName: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
    flex: 0,
  },
  medicationStats: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'right',
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
});

export default function MedicationUsageStatistics({ selectedRange }: MedicationUsageStatisticsProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { medications, doses } = useMedicationStore();

  const statistics = useMemo(() => {
    const { startDate, endDate } = getDateRangeForDays(selectedRange);

    // Calculate per-medication stats
    const allMedicationStats = calculatePerMedicationStats(
      medications,
      doses,
      startDate,
      endDate
    );

    // Filter for rescue medications only
    const rescueMedicationIds = new Set(
      medications.filter(m => m.type === 'rescue').map(m => m.id)
    );
    const rescueMedicationStats = allMedicationStats.filter(stat =>
      rescueMedicationIds.has(stat.medicationId)
    );

    // Sort medications by total doses (descending)
    rescueMedicationStats.sort((a, b) => b.totalDoses - a.totalDoses);

    return {
      rescueMedicationStats,
    };
  }, [selectedRange, medications, doses]);

  const hasMedicationData = statistics.rescueMedicationStats.length > 0;

  return (
    <View style={styles.container} testID="medication-usage-statistics" accessibilityRole="summary">
      <Text style={styles.sectionTitle} accessibilityRole="header">Rescue Medication Usage</Text>

      {!hasMedicationData ? (
        <View style={styles.emptyContainer} testID="empty-state">
          <Text style={styles.emptyText}>No rescue medication usage in selected period</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {/* Rescue Medication Breakdown */}
          {statistics.rescueMedicationStats.map((stat, index) => (
            <View
              key={stat.medicationId}
              style={[
                styles.medicationItem,
                index === statistics.rescueMedicationStats.length - 1 ? styles.medicationItemLast : {},
              ]}
              testID={`medication-item-${stat.medicationId}`}
            >
              <Text style={styles.medicationName}>{stat.medicationName}</Text>
              <Text
                style={styles.medicationStats}
                accessibilityLabel={`${stat.medicationName}: ${stat.totalDoses} doses on ${stat.daysWithDoses} days`}
              >
                {stat.totalDoses} {stat.totalDoses === 1 ? 'dose' : 'doses'} on {stat.daysWithDoses} {stat.daysWithDoses === 1 ? 'day' : 'days'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
