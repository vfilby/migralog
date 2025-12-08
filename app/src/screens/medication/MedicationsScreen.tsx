import React, { useEffect, useState } from 'react';
import { logger } from '../../utils/logger';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMedicationStore } from '../../store/medicationStore';
import { useEpisodeStore } from '../../store/episodeStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { MedicationSchedule } from '../../models/types';
import { useTheme, ThemeColors } from '../../theme';
import { isToday } from 'date-fns';
import MedicationCard from '../../components/medication/MedicationCard';

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
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: theme.text,
    flexShrink: 0,
    flexBasis: '100%',
  },
  archivedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  archivedLinkText: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: '500',
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
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
    lineHeight: 20,
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
    justifyContent: 'center',
    marginTop: 12,
  },
  singleLogButtonText: {
    color: theme.primaryText,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  medicationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'center',
  },
  quickLogButton: {
    flex: 1,
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogButtonText: {
    color: theme.primaryText,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailedLogButton: {
    flex: 1,
    backgroundColor: theme.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.primary,
  },
  detailedLogButtonText: {
    color: theme.primary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
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
  const { 
    preventativeMedications, 
    rescueMedications, 
    otherMedications, 
    loadMedications, 
    logDose, 
    deleteDose, 
    getDosesByMedicationId, 
    getSchedulesByMedicationId,
    loadSchedules 
  } = useMedicationStore();
  const { currentEpisode, loadCurrentEpisode } = useEpisodeStore();
  const [medicationSchedules, setMedicationSchedules] = useState<Record<string, MedicationSchedule[]>>({});
  const [scheduleLogStates, setScheduleLogStates] = useState<Record<string, ScheduleLogState>>({});

  // Load data on initial mount
  useEffect(() => {
    loadMedications();
    loadCurrentEpisode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also reload data when screen gains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMedications();
      loadCurrentEpisode();
      loadSchedulesAndDoses();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  useEffect(() => {
    loadSchedulesAndDoses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preventativeMedications]);

  const loadSchedulesAndDoses = async () => {
    try {
      // Load all schedules for preventative medications
      await loadSchedules();
      
      const schedules: Record<string, MedicationSchedule[]> = {};
      const logStates: Record<string, ScheduleLogState> = {};

      for (const med of preventativeMedications) {
        // Use store method to get schedules from state
        const medSchedules = getSchedulesByMedicationId(med.id);
        schedules[med.id] = medSchedules;

        // Load today's doses for this medication using store method
        const doses = await getDosesByMedicationId(med.id, 50);

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


  const handleQuickLog = async (medicationId: string, scheduleId: string, dosage: number, _scheduleTime?: string) => {
    try {
      const now = Date.now();

      // Find the medication to get its dosage info
      const medication = preventativeMedications.find(m => m.id === medicationId);
      if (!medication) {
        throw new Error('Medication not found');
      }

      // Log to database first to get the ID
      const dose = await logDose({
        medicationId,
        timestamp: now,
        quantity: dosage,
        dosageAmount: medication.dosageAmount,
        dosageUnit: medication.dosageUnit,
        episodeId: currentEpisode?.id,
        updatedAt: now,
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
      // Find the medication to get its dosage info
      const medication = rescueMedications.find(m => m.id === medicationId);
      if (!medication) {
        throw new Error('Medication not found');
      }

      const timestamp = Date.now();
      await logDose({
        medicationId,
        timestamp,
        quantity: dosage,
        dosageAmount: medication.dosageAmount,
        dosageUnit: medication.dosageUnit,
        episodeId: currentEpisode?.id,
        updatedAt: timestamp,
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
        <Text style={styles.title} numberOfLines={1}>Medications</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('ArchivedMedications')}
          testID="archived-medications-link"
          accessibilityRole="button"
          accessibilityLabel="Archived medications"
          accessibilityHint="Opens the list of archived medications"
        >
          <View style={styles.archivedLink}>
            <Ionicons name="archive-outline" size={20} color={theme.primary} />
            <Text style={styles.archivedLinkText}>Archived</Text>
          </View>
        </TouchableOpacity>
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
              <MedicationCard
                key={med.id}
                medication={med}
                type="preventative"
                schedules={medicationSchedules[med.id] || []}
                scheduleLogStates={scheduleLogStates}
                onPress={() => navigation.navigate('MedicationDetail', { medicationId: med.id })}
                onScheduleLog={handleQuickLog}
                onUndoLog={handleUndoLog}
                showScheduleButtons={true}
                testID={`preventative-medication-${med.id}`}
              />
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
              <MedicationCard
                key={med.id}
                medication={med}
                type="rescue"
                onPress={() => navigation.navigate('MedicationDetail', { medicationId: med.id })}
                onQuickLog={handleRescueQuickLog}
                onDetailedLog={(medicationId) => navigation.navigate('LogMedication', { medicationId })}
                showQuickActions={true}
                testID={`rescue-medication-${med.id}`}
              />
            ))
          )}
        </View>

        {/* Other Medications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other</Text>
          {otherMedications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No other medications</Text>
            </View>
          ) : (
            otherMedications.map((med) => (
              <MedicationCard
                key={med.id}
                medication={med}
                type="other"
                onPress={() => navigation.navigate('MedicationDetail', { medicationId: med.id })}
                testID={`other-medication-${med.id}`}
              />
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddMedication')}
          accessibilityRole="button"
          accessibilityLabel="Add medication"
          accessibilityHint="Opens the screen to add a new medication"
        >
          <Text style={styles.addButtonText}>+ Add Medication</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

