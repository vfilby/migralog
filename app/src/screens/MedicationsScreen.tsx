import React, { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMedicationStore } from '../store/medicationStore';
import { useEpisodeStore } from '../store/episodeStore';
import { medicationRepository, medicationScheduleRepository, medicationDoseRepository } from '../database/medicationRepository';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Medication, MedicationSchedule } from '../models/types';
import { useTheme, ThemeColors } from '../theme';
import { format, isToday } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
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
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  scheduleLogContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
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
  singleLogButton: {
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  singleLogButtonText: {
    color: theme.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  medicationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickLogButton: {
    flex: 1,
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickLogButtonText: {
    color: theme.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  detailedLogButton: {
    flex: 1,
    backgroundColor: theme.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.primary,
  },
  detailedLogButtonText: {
    color: theme.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  addButton: {
    backgroundColor: theme.primary,
    margin: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: theme.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  loggedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 120,
  },
  loggedText: {
    fontSize: 13,
    color: theme.success,
    fontWeight: '500',
  },
  loggedNotificationsContainer: {
    marginTop: 12,
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
  undoButton: {
    marginLeft: 4,
    padding: 4,
  },
  undoButtonText: {
    fontSize: 12,
    color: theme.primary,
    textDecorationLine: 'underline',
  },
});

interface ScheduleLogState {
  logged: boolean;
  skipped?: boolean;
  loggedAt?: Date;
  doseId?: string;
}

export default function MedicationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { preventativeMedications, rescueMedications, loadMedications, logDose, deleteDose, loading } = useMedicationStore();
  const { currentEpisode, loadCurrentEpisode } = useEpisodeStore();
  const [medicationSchedules, setMedicationSchedules] = useState<Record<string, MedicationSchedule[]>>({});
  const [scheduleLogStates, setScheduleLogStates] = useState<Record<string, ScheduleLogState>>({});

  // Load data on initial mount
  useEffect(() => {
    loadMedications();
    loadCurrentEpisode();
  }, []);

  // Also reload data when screen gains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMedications();
      loadCurrentEpisode();
      loadSchedulesAndDoses();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    loadSchedulesAndDoses();
  }, [preventativeMedications]);

  const loadSchedulesAndDoses = async () => {
    try {
      const schedules: Record<string, MedicationSchedule[]> = {};
      const logStates: Record<string, ScheduleLogState> = {};

      for (const med of preventativeMedications) {
        const medSchedules = await medicationScheduleRepository.getByMedicationId(med.id);
        schedules[med.id] = medSchedules;

        // Load today's doses for this medication
        const doses = await medicationDoseRepository.getByMedicationId(med.id, 50);

        // Check which schedules have been logged or skipped today
        // Use the same logic as DashboardScreen: any dose logged today counts as taken/skipped
        const todaysDoses = doses.filter(dose => {
          const doseDate = new Date(dose.timestamp);
          return isToday(doseDate);
        });

        // If there are any doses logged today, mark the most recent one
        if (todaysDoses.length > 0) {
          // Sort by timestamp descending and take the most recent one
          const latestDose = todaysDoses.sort((a, b) => b.timestamp - a.timestamp)[0];

          // Mark all schedules with the latest dose status
          for (const schedule of medSchedules) {
            const stateKey = `${med.id}-${schedule.id}`;
            logStates[stateKey] = {
              logged: latestDose.status === 'taken',
              skipped: latestDose.status === 'skipped',
              loggedAt: new Date(latestDose.timestamp),
              doseId: latestDose.id,
            };
          }
        }
      }

      setMedicationSchedules(schedules);
      setScheduleLogStates(logStates);
    } catch (error) {
      logger.error('Failed to load schedules and doses:', error);
    }
  };

  const formatScheduleDetails = (medication: Medication): string | null => {
    const schedules = medicationSchedules[medication.id];
    if (!schedules || schedules.length === 0) return null;

    if (medication.scheduleFrequency === 'daily') {
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
    } else if (medication.scheduleFrequency === 'monthly' || medication.scheduleFrequency === 'quarterly') {
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

  const handleQuickLog = async (medicationId: string, scheduleId: string, dosage: number, scheduleTime?: string) => {
    try {
      const now = Date.now();

      // Log to database first to get the ID
      const dose = await logDose({
        medicationId,
        timestamp: now,
        amount: dosage,
        episodeId: currentEpisode?.id,
      });

      // Update UI with optimistic state
      const stateKey = `${medicationId}-${scheduleId}`;
      setScheduleLogStates(prev => ({
        ...prev,
        [stateKey]: {
          logged: true,
          loggedAt: new Date(now),
          doseId: dose.id,
        }
      }));
    } catch (error) {
      logger.error('Failed to quick log medication:', error);
      Alert.alert('Error', 'Failed to log medication');
    }
  };

  const handleUndoLog = async (medicationId: string, scheduleId: string, doseId: string) => {
    try {
      // Optimistically update UI
      const stateKey = `${medicationId}-${scheduleId}`;
      setScheduleLogStates(prev => {
        const newState = { ...prev };
        delete newState[stateKey];
        return newState;
      });

      // Delete from database
      await deleteDose(doseId);
    } catch (error) {
      logger.error('Failed to undo log:', error);
      Alert.alert('Error', 'Failed to undo');
      // Reload on error to sync with database
      loadSchedulesAndDoses();
    }
  };

  const handleRescueQuickLog = async (medicationId: string, dosage: number) => {
    try {
      await logDose({
        medicationId,
        timestamp: Date.now(),
        amount: dosage,
        episodeId: currentEpisode?.id,
      });
      Alert.alert('Success', 'Medication logged successfully');
    } catch (error) {
      logger.error('Failed to quick log medication:', error);
      Alert.alert('Error', 'Failed to log medication');
    }
  };


  return (
    <View style={styles.container} testID="medications-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Medications</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Preventative Medications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preventative</Text>
          {preventativeMedications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No preventative medications</Text>
            </View>
          ) : (
            preventativeMedications.map((med) => (
              <TouchableOpacity
                key={med.id}
                style={styles.medicationCard}
                onPress={() => navigation.navigate('MedicationDetail', { medicationId: med.id })}
              >
                <View style={styles.medicationHeader}>
                  <Text style={styles.medicationName}>{med.name}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: theme.success + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: theme.success }]}>Preventative</Text>
                  </View>
                </View>
                <View style={styles.medicationDetails}>
                  <Text style={styles.dosageText}>
                    {med.defaultDosage || 1} × {med.dosageAmount}{med.dosageUnit}
                  </Text>
                  {med.scheduleFrequency && (
                    <Text style={styles.frequencyText}>
                      {med.scheduleFrequency.charAt(0).toUpperCase() + med.scheduleFrequency.slice(1)}
                      {formatScheduleDetails(med) && ` ${formatScheduleDetails(med)}`}
                    </Text>
                  )}
                </View>
                {med.notes && (
                  <Text style={styles.notes} numberOfLines={2}>{med.notes}</Text>
                )}
                {med.scheduleFrequency === 'daily' && medicationSchedules[med.id]?.length > 0 && (
                  <View>
                    {/* Show logged/skipped notifications first */}
                    {medicationSchedules[med.id].some(schedule => {
                      const stateKey = `${med.id}-${schedule.id}`;
                      return scheduleLogStates[stateKey]?.logged || scheduleLogStates[stateKey]?.skipped;
                    }) && (
                      <View style={styles.loggedNotificationsContainer}>
                        {medicationSchedules[med.id].map((schedule) => {
                          const stateKey = `${med.id}-${schedule.id}`;
                          const logState = scheduleLogStates[stateKey];

                          if (!logState?.logged && !logState?.skipped) return null;

                          const [hours, minutes] = schedule.time.split(':');
                          const date = new Date();
                          date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
                          const scheduleTimeStr = format(date, 'h:mm a');

                          return (
                            <View key={schedule.id} style={styles.loggedNotification}>
                              <Ionicons
                                name={logState.logged ? "checkmark-circle" : "close-circle"}
                                size={16}
                                color={logState.logged ? theme.success : theme.textSecondary}
                              />
                              <Text style={[
                                styles.loggedNotificationText,
                                logState.skipped && { color: theme.textSecondary }
                              ]}>
                                {logState.logged && `${scheduleTimeStr} dose taken at ${logState.loggedAt && format(logState.loggedAt, 'h:mm a')}`}
                                {logState.skipped && `${scheduleTimeStr} dose skipped`}
                              </Text>
                              {logState.doseId && (
                                <TouchableOpacity
                                  style={styles.undoButton}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleUndoLog(med.id, schedule.id, logState.doseId!);
                                  }}
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
                    <View style={styles.scheduleLogContainer}>
                      {medicationSchedules[med.id].map((schedule) => {
                        const [hours, minutes] = schedule.time.split(':');
                        const date = new Date();
                        date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
                        const timeStr = format(date, 'h:mm a');
                        const stateKey = `${med.id}-${schedule.id}`;
                        const logState = scheduleLogStates[stateKey];

                        if (logState?.logged || logState?.skipped) {
                          return null; // Don't show button if already logged or skipped
                        }

                        return (
                          <TouchableOpacity
                            key={schedule.id}
                            style={styles.scheduleLogButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleQuickLog(med.id, schedule.id, schedule.dosage, timeStr);
                            }}
                          >
                            <Text style={styles.scheduleLogButtonText}>Log {timeStr}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Rescue Medications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rescue</Text>
          {rescueMedications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No rescue medications</Text>
            </View>
          ) : (
            rescueMedications.map((med) => (
              <TouchableOpacity
                key={med.id}
                style={styles.medicationCard}
                onPress={() => navigation.navigate('MedicationDetail', { medicationId: med.id })}
              >
                <View style={styles.medicationHeader}>
                  <Text style={styles.medicationName}>{med.name}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: theme.primary }]}>Rescue</Text>
                  </View>
                </View>
                <View style={styles.medicationDetails}>
                  <Text style={styles.dosageText}>
                    {med.defaultDosage || 1} × {med.dosageAmount}{med.dosageUnit}
                  </Text>
                </View>
                {med.notes && (
                  <Text style={styles.notes} numberOfLines={2}>{med.notes}</Text>
                )}
                <View style={styles.medicationActions}>
                  <TouchableOpacity
                    style={styles.quickLogButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleRescueQuickLog(med.id, med.defaultDosage || 1);
                    }}
                  >
                    <Text style={styles.quickLogButtonText}>Quick Log</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.detailedLogButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      navigation.navigate('LogMedication', { medicationId: med.id });
                    }}
                  >
                    <Text style={styles.detailedLogButtonText}>Log Details</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>


        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddMedication')}
        >
          <Text style={styles.addButtonText}>+ Add Medication</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

