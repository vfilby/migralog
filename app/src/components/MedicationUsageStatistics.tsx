import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../theme';
import { useMedicationStore } from '../store/medicationStore';
import { TimeRangeDays } from '../models/types';
import {
  getDateRangeForDays,
  calculatePerMedicationStats,
} from '../utils/analyticsUtils';

interface MedicationUsageStatisticsProps {
  selectedRange: TimeRangeDays;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    padding: 20,
    marginTop: 8,
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
    color: theme.textSecondary,
    flex: 0,
  },
  medicationStats: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
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
  const { medications, doses, schedules, loadSchedules } = useMedicationStore();

  // Load schedules when component mounts
  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const statistics = useMemo(() => {
    const { startDate, endDate } = getDateRangeForDays(selectedRange);

    // Calculate actual days in range (inclusive)
    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.round((normalizedEnd.getTime() - normalizedStart.getTime()) / msPerDay) + 1;

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

    // Calculate preventative medication compliance
    const preventativeMedications = medications.filter(m => m.type === 'preventative');

    // Pre-filter doses once for the date range to improve performance
    const dosesInRange = doses.filter(d =>
      d.status === 'taken' &&
      d.timestamp >= normalizedStart.getTime() &&
      d.timestamp <= normalizedEnd.getTime()
    );

    const preventativeComplianceStats = preventativeMedications.map(medication => {
      // Get enabled schedules for this medication
      const medicationSchedules = schedules.filter(
        s => s.medicationId === medication.id && s.enabled
      );

      // Calculate expected doses (schedules × days in range)
      const expectedDoses = medicationSchedules.length * totalDays;

      // Count actual doses taken (using pre-filtered doses)
      const actualDoses = dosesInRange.filter(d => d.medicationId === medication.id).length;

      // Calculate compliance percentage
      const compliance = expectedDoses > 0
        ? Math.min(Math.round((actualDoses / expectedDoses) * 100), 100)
        : 0;

      return {
        medicationId: medication.id,
        medicationName: medication.name,
        expectedDoses,
        actualDoses,
        compliance,
      };
    });

    // Sort by compliance (descending)
    preventativeComplianceStats.sort((a, b) => b.compliance - a.compliance);

    return {
      rescueMedicationStats,
      preventativeComplianceStats,
    };
  }, [selectedRange, medications, doses, schedules]);

  const hasRescueMedicationData = statistics.rescueMedicationStats.length > 0;
  const hasPreventativeMedicationData = statistics.preventativeComplianceStats.length > 0;

  return (
    <View style={styles.container} testID="medication-usage-statistics" accessibilityRole="summary">
      {/* Rescue Medication Usage */}
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Rescue Medication Usage
      </Text>

      {!hasRescueMedicationData ? (
        <View style={styles.emptyContainer} testID="empty-state">
          <Text style={styles.emptyText}>No rescue medication usage in selected period</Text>
        </View>
      ) : (
        <View style={styles.card} testID="rescue-medication-card">
          {/* Rescue Medication Breakdown */}
          {statistics.rescueMedicationStats.map((stat, index) => (
            <View
              key={stat.medicationId}
              style={[
                styles.medicationItem,
                index === statistics.rescueMedicationStats.length - 1 ? styles.medicationItemLast : {},
              ]}
              testID={`rescue-item-${stat.medicationId}`}
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

      {/* Preventative Medication Compliance */}
      {hasPreventativeMedicationData && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]} accessibilityRole="header">
            Preventative Medication Compliance
          </Text>
          <View style={styles.card} testID="preventative-compliance-card">
            {statistics.preventativeComplianceStats.map((stat, index) => (
              <View
                key={stat.medicationId}
                style={[
                  styles.medicationItem,
                  index === statistics.preventativeComplianceStats.length - 1 ? styles.medicationItemLast : {},
                ]}
                testID={`preventative-item-${stat.medicationId}`}
              >
                <Text style={styles.medicationName}>{stat.medicationName}</Text>
                <Text
                  style={styles.medicationStats}
                  accessibilityLabel={`${stat.medicationName}: ${stat.compliance}% compliance`}
                >
                  {stat.compliance}%
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
