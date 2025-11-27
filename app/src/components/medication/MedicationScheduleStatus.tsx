import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTheme, ThemeColors } from '../../theme';
import { MedicationSchedule } from '../../models/types';

export interface ScheduleLogState {
  logged: boolean;
  skipped?: boolean;
  loggedAt?: Date;
  doseId?: string;
}

export interface MedicationScheduleStatusProps {
  medicationId: string;
  medicationName: string;
  schedules: MedicationSchedule[];
  scheduleLogStates: Record<string, ScheduleLogState>;
  onQuickLog: (medicationId: string, scheduleId: string, dosage: number, timeStr: string) => void;
  onUndoLog: (medicationId: string, scheduleId: string, doseId: string) => void;
  showLogButtons?: boolean;
  testID?: string;
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: 12,
  },
  loggedNotificationsContainer: {
    marginBottom: 8,
    gap: 6,
  },
  loggedNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  loggedNotificationText: {
    fontSize: 13,
    color: theme.success,
    fontWeight: '500',
    flex: 1,
  },
  skippedNotificationText: {
    color: theme.textSecondary,
  },
  undoButton: {
    marginLeft: 4,
    padding: 4,
  },
  undoButtonText: {
    fontSize: 12,
    color: theme.primary,
    textDecorationLine: 'underline',
  },
  scheduleLogContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  scheduleLogButton: {
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  scheduleLogButtonText: {
    color: theme.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default function MedicationScheduleStatus({
  medicationId,
  medicationName,
  schedules,
  scheduleLogStates,
  onQuickLog,
  onUndoLog,
  showLogButtons = true,
  testID
}: MedicationScheduleStatusProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Check if any schedules are logged or skipped
  const hasLoggedOrSkipped = schedules.some(schedule => {
    const stateKey = `${medicationId}-${schedule.id}`;
    const logState = scheduleLogStates[stateKey];
    return logState?.logged || logState?.skipped;
  });

  // Get unlogged schedules for log buttons
  const unloggedSchedules = schedules.filter(schedule => {
    const stateKey = `${medicationId}-${schedule.id}`;
    const logState = scheduleLogStates[stateKey];
    return !logState?.logged && !logState?.skipped;
  });

  const formatScheduleTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return format(date, 'h:mm a');
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* Show logged/skipped notifications */}
      {hasLoggedOrSkipped && (
        <View style={styles.loggedNotificationsContainer} testID={testID ? `${testID}-logged` : undefined}>
          {schedules.map((schedule) => {
            const stateKey = `${medicationId}-${schedule.id}`;
            const logState = scheduleLogStates[stateKey];

            if (!logState?.logged && !logState?.skipped) return null;

            const scheduleTimeStr = formatScheduleTime(schedule.time);

            return (
              <View 
                key={schedule.id} 
                style={styles.loggedNotification}
                testID={testID ? `${testID}-logged-${schedule.id}` : undefined}
              >
                <Ionicons
                  name={logState.logged ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={logState.logged ? theme.success : theme.textSecondary}
                />
                <Text style={[
                  styles.loggedNotificationText,
                  logState.skipped && styles.skippedNotificationText
                ]}>
                  {logState.logged && logState.loggedAt && 
                    `${scheduleTimeStr} dose taken at ${format(logState.loggedAt, 'h:mm a')}`
                  }
                  {logState.logged && !logState.loggedAt && 
                    `${scheduleTimeStr} dose taken`
                  }
                  {logState.skipped && `${scheduleTimeStr} dose skipped`}
                </Text>
                {logState.doseId && (
                  <TouchableOpacity
                    style={styles.undoButton}
                    onPress={() => onUndoLog(medicationId, schedule.id, logState.doseId!)}
                    accessibilityRole="button"
                    accessibilityLabel="Undo"
                    accessibilityHint="Removes this logged dose"
                    testID={testID ? `${testID}-undo-${schedule.id}` : undefined}
                  >
                    <Text style={styles.undoButtonText}>Undo</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Show log buttons for unlogged schedules */}
      {showLogButtons && unloggedSchedules.length > 0 && (
        <View style={styles.scheduleLogContainer} testID={testID ? `${testID}-buttons` : undefined}>
          {unloggedSchedules.map((schedule) => {
            const scheduleTimeStr = formatScheduleTime(schedule.time);

            return (
              <TouchableOpacity
                key={schedule.id}
                style={styles.scheduleLogButton}
                onPress={() => onQuickLog(medicationId, schedule.id, schedule.dosage, scheduleTimeStr)}
                accessibilityRole="button"
                accessibilityLabel={`Log ${scheduleTimeStr} dose`}
                accessibilityHint={`Records that you took your ${scheduleTimeStr} dose of ${medicationName}`}
                testID={testID ? `${testID}-log-${schedule.id}` : undefined}
              >
                <Text style={styles.scheduleLogButtonText}>Log {scheduleTimeStr}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}