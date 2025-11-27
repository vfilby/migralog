import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { useTheme, ThemeColors } from '../../theme';
import { Medication, MedicationSchedule } from '../../models/types';
import { formatMedicationDosage } from '../../utils/medicationFormatting';
import MedicationBadges, { MedicationType } from './MedicationBadges';
import MedicationQuickActions from './MedicationQuickActions';
import MedicationScheduleStatus, { ScheduleLogState } from './MedicationScheduleStatus';

export interface MedicationCardProps {
  medication: Medication;
  type: MedicationType;
  schedules?: MedicationSchedule[];
  scheduleLogStates?: Record<string, ScheduleLogState>;
  onPress: () => void;
  onQuickLog?: (medicationId: string, quantity: number) => void;
  onDetailedLog?: (medicationId: string) => void;
  onScheduleLog?: (medicationId: string, scheduleId: string, dosage: number, timeStr: string) => void;
  onUndoLog?: (medicationId: string, scheduleId: string, doseId: string) => void;
  showScheduleButtons?: boolean;
  showQuickActions?: boolean;
  testID?: string;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  medicationCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicationHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  medicationTitleContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  medicationThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  medicationDetails: {
    gap: 4,
  },
  dosageText: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: '500',
  },
  frequencyText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  notes: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
});

export default function MedicationCard({
  medication,
  type,
  schedules = [],
  scheduleLogStates = {},
  onPress,
  onQuickLog,
  onDetailedLog,
  onScheduleLog,
  onUndoLog,
  showScheduleButtons = false,
  showQuickActions = false,
  testID
}: MedicationCardProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const formatScheduleDetails = (med: Medication): string | null => {
    if (!schedules || schedules.length === 0) return null;

    if (med.scheduleFrequency === 'daily') {
      // Format times: "at 9:00 AM, 6:00 PM"
      const times = schedules
        .map(s => {
          try {
            const [hours, minutes] = s.time.split(':');
            const date = new Date();
            date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
            return format(date, 'h:mm a');
          } catch {
            return s.time;
          }
        })
        .join(', ');
      return `at ${times}`;
    } else if (med.scheduleFrequency === 'monthly' || med.scheduleFrequency === 'quarterly') {
      // Format date: "— Last taken: Jan 15, 2025"
      const lastSchedule = schedules[0];
      if (lastSchedule && lastSchedule.time) {
        try {
          const date = new Date(lastSchedule.time);
          return `— Last taken: ${format(date, 'MMM d, yyyy')}`;
        } catch {
          return `— Last taken: ${lastSchedule.time}`;
        }
      }
    }
    return null;
  };

  const accessibilityLabel = `${medication.name} ${type} medication`;
  const accessibilityHint = "Opens details and history for this medication";

  return (
    <TouchableOpacity
      style={styles.medicationCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      <View style={styles.medicationHeader}>
        <View style={styles.medicationTitleContainer}>
          <Text style={styles.medicationName}>{medication.name}</Text>
          <MedicationBadges 
            type={type} 
            category={medication.category}
            testID={testID ? `${testID}-badges` : undefined}
          />
        </View>
        {medication.photoUri && (
          <Image
            source={{ uri: medication.photoUri }}
            style={styles.medicationThumbnail}
            resizeMode="cover"
            accessibilityLabel={`Photo of ${medication.name}`}
          />
        )}
      </View>

      <View style={styles.medicationDetails}>
        <Text style={styles.dosageText}>
          {formatMedicationDosage(medication.defaultQuantity || 1, medication.dosageAmount, medication.dosageUnit)}
        </Text>
        {medication.scheduleFrequency && (
          <Text style={styles.frequencyText}>
            {medication.scheduleFrequency.charAt(0).toUpperCase() + medication.scheduleFrequency.slice(1)}
            {formatScheduleDetails(medication) && ` ${formatScheduleDetails(medication)}`}
          </Text>
        )}
      </View>

      {medication.notes && (
        <View style={{ width: '100%' }}>
          <Text style={styles.notes} numberOfLines={2} ellipsizeMode="tail">
            {medication.notes}
          </Text>
        </View>
      )}

      {/* Schedule Status for daily medications */}
      {medication.scheduleFrequency === 'daily' && schedules.length > 0 && onScheduleLog && onUndoLog && (
        <MedicationScheduleStatus
          medicationId={medication.id}
          medicationName={medication.name}
          schedules={schedules}
          scheduleLogStates={scheduleLogStates}
          onQuickLog={onScheduleLog}
          onUndoLog={onUndoLog}
          showLogButtons={showScheduleButtons}
          testID={testID ? `${testID}-schedule` : undefined}
        />
      )}

      {/* Quick Actions for rescue medications */}
      {showQuickActions && onQuickLog && onDetailedLog && (
        <MedicationQuickActions
          medicationId={medication.id}
          medicationName={medication.name}
          defaultQuantity={medication.defaultQuantity}
          onQuickLog={onQuickLog}
          onDetailedLog={onDetailedLog}
          testID={testID ? `${testID}-actions` : undefined}
        />
      )}
    </TouchableOpacity>
  );
}