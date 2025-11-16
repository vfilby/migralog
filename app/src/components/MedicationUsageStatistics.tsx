import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { useMedicationStore } from '../store/medicationStore';
import {
  getDateRangeForDays,
  calculatePreventativeCompliance,
  calculateNSAIDUsage,
  calculatePerMedicationStats,
} from '../utils/analyticsUtils';

interface MedicationUsageStatisticsProps {
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
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  metricRowLast: {
    borderBottomWidth: 0,
  },
  metricLabel: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  medicationListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
    marginBottom: 8,
  },
  medicationItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  medicationItemLast: {
    borderBottomWidth: 0,
  },
  medicationName: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 4,
  },
  medicationStats: {
    fontSize: 14,
    color: theme.textSecondary,
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
  const { medications, doses, schedules } = useMedicationStore();

  const statistics = useMemo(() => {
    const { startDate, endDate } = getDateRangeForDays(selectedRange);

    // Calculate preventative compliance
    const preventativeCompliance = calculatePreventativeCompliance(
      medications,
      doses,
      schedules,
      startDate,
      endDate
    );

    // Calculate NSAID usage (days)
    const nsaidUsage = calculateNSAIDUsage(
      medications,
      doses,
      startDate,
      endDate
    );

    // Calculate per-medication stats
    const perMedicationStats = calculatePerMedicationStats(
      medications,
      doses,
      startDate,
      endDate
    );

    // Sort medications by total doses (descending)
    perMedicationStats.sort((a, b) => b.totalDoses - a.totalDoses);

    return {
      preventativeCompliance,
      nsaidUsage,
      perMedicationStats,
    };
  }, [selectedRange, medications, doses, schedules]);

  const hasPreventativeMedications = medications.some(m => m.type === 'preventative');
  const hasMedicationData = statistics.perMedicationStats.length > 0;

  return (
    <View style={styles.container} testID="medication-usage-statistics">
      <Text style={styles.sectionTitle}>Medication Usage</Text>

      {!hasMedicationData ? (
        <View style={styles.emptyContainer} testID="empty-state">
          <Text style={styles.emptyText}>No medication usage in selected period</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {/* Preventative Compliance */}
          <View style={styles.metricRow} testID="preventative-compliance-row">
            <Text style={styles.metricLabel}>Preventative Compliance:</Text>
            <Text
              style={styles.metricValue}
              accessibilityLabel={`Preventative compliance: ${hasPreventativeMedications ? `${statistics.preventativeCompliance}%` : 'N/A'}`}
            >
              {hasPreventativeMedications ? `${statistics.preventativeCompliance}%` : 'N/A'}
            </Text>
          </View>

          {/* NSAID Usage */}
          <View style={[styles.metricRow, styles.metricRowLast]} testID="nsaid-usage-row">
            <Text style={styles.metricLabel}>NSAID Usage:</Text>
            <Text
              style={styles.metricValue}
              accessibilityLabel={`NSAID usage: ${statistics.nsaidUsage} days`}
            >
              {statistics.nsaidUsage} {statistics.nsaidUsage === 1 ? 'day' : 'days'}
            </Text>
          </View>

          {/* Per-Medication Breakdown */}
          {statistics.perMedicationStats.length > 0 && (
            <>
              <Text style={styles.medicationListTitle}>Per-Medication Breakdown</Text>
              {statistics.perMedicationStats.map((stat, index) => (
                <View
                  key={stat.medicationId}
                  style={[
                    styles.medicationItem,
                    index === statistics.perMedicationStats.length - 1 ? styles.medicationItemLast : {},
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
            </>
          )}
        </View>
      )}
    </View>
  );
}
