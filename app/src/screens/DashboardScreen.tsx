import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEpisodeStore } from '../store/episodeStore';
import { useMedicationStore } from '../store/medicationStore';
import { format, differenceInDays, isToday, parse, isBefore, isAfter, addMinutes } from 'date-fns';
import { MainTabsScreenProps } from '../navigation/types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getPainColor, getPainLevel } from '../utils/painScale';
import EpisodeCard from '../components/EpisodeCard';
import { useTheme, ThemeColors } from '../theme';
import { Medication, MedicationSchedule, MedicationDose } from '../models/types';
import { medicationScheduleRepository, medicationDoseRepository } from '../database/medicationRepository';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.backgroundSecondary,
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
    flex: 1,
  },
  settingsButton: {
    padding: 8,
  },
  card: {
    backgroundColor: theme.card,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: theme.text,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.primary,
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  tapHint: {
    fontSize: 13,
    color: theme.primary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  intensityText: {
    fontSize: 16,
    color: theme.danger,
    marginTop: 8,
    fontWeight: '500',
  },
  actionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: theme.primary,
  },
  secondaryButton: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  primaryButtonText: {
    color: theme.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: theme.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  medicationItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  medicationItemLast: {
    borderBottomWidth: 0,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  compactTime: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  compactButtons: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  compactLogButton: {
    backgroundColor: theme.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  compactLogButtonText: {
    color: theme.primaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  compactSkipButton: {
    backgroundColor: theme.danger,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  compactSkipButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  compactStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  compactStatusText: {
    fontSize: 12,
    color: theme.success,
    fontWeight: '500',
  },
  compactSkippedText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  compactUndoButton: {
    marginLeft: 4,
    padding: 4,
  },
  compactUndoText: {
    fontSize: 11,
    color: theme.primary,
    textDecorationLine: 'underline',
  },
});

interface TodaysMedication {
  medication: Medication;
  schedule: MedicationSchedule;
  doseTime: Date;
  taken: boolean;
  takenAt?: Date;
  skipped: boolean;
  doseId?: string; // ID of the dose record if it was logged
}

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { currentEpisode, episodes, loadCurrentEpisode, loadEpisodes } = useEpisodeStore();
  const { preventativeMedications, rescueMedications, loadMedications, logDose, deleteDose } = useMedicationStore();
  const [todaysMedications, setTodaysMedications] = useState<TodaysMedication[]>([]);

  const loadTodaysMedications = useCallback(async () => {
    try {
      const todayMeds: TodaysMedication[] = [];
      const now = new Date();

      for (const med of preventativeMedications) {
        if (med.scheduleFrequency !== 'daily') continue;

        const schedules = await medicationScheduleRepository.getByMedicationId(med.id);
        const doses = await medicationDoseRepository.getByMedicationId(med.id);

        for (const schedule of schedules) {
          // Parse schedule time (HH:mm format)
          const [hours, minutes] = schedule.time.split(':').map(Number);
          const doseTime = new Date();
          doseTime.setHours(hours, minutes, 0, 0);

          // Check if this dose was taken today
          const takenDose = doses.find(dose => {
            const doseDate = new Date(dose.timestamp);
            return isToday(doseDate) &&
              doseDate.getHours() === hours &&
              Math.abs(doseDate.getMinutes() - minutes) < 30; // Within 30 min window
          });

          // Show if it's upcoming (within next 3 hours), missed (past), or taken
          const threeHoursFromNow = addMinutes(now, 180);
          const shouldShow = isBefore(doseTime, threeHoursFromNow) || takenDose;

          if (shouldShow) {
            todayMeds.push({
              medication: med,
              schedule,
              doseTime,
              taken: !!takenDose,
              takenAt: takenDose ? new Date(takenDose.timestamp) : undefined,
              skipped: false, // Will be set from local state after
              doseId: takenDose?.id,
            });
          }
        }
      }

      // Sort by time
      todayMeds.sort((a, b) => a.doseTime.getTime() - b.doseTime.getTime());

      // Preserve skipped state from current state
      setTodaysMedications(prev => {
        return todayMeds.map(newMed => {
          const existing = prev.find(
            m => m.medication.id === newMed.medication.id && m.schedule.id === newMed.schedule.id
          );
          return {
            ...newMed,
            skipped: existing?.skipped || false,
          };
        });
      });
    } catch (error) {
      console.error('Failed to load todays medications:', error);
    }
  }, [preventativeMedications]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCurrentEpisode();
      loadEpisodes();
      loadMedications();
      loadTodaysMedications();
    });
    return unsubscribe;
  }, [navigation, loadTodaysMedications, loadCurrentEpisode, loadEpisodes, loadMedications]);

  useEffect(() => {
    loadTodaysMedications();
  }, [loadTodaysMedications]);

  const handleTakeMedication = async (item: TodaysMedication) => {
    try {
      const now = Date.now();

      // Save to database first to get the ID
      const dose = await logDose({
        medicationId: item.medication.id,
        timestamp: now,
        amount: item.schedule.dosage,
        episodeId: currentEpisode?.id,
      });

      // Then update UI with the dose ID
      setTodaysMedications(prev =>
        prev.map(med =>
          med.medication.id === item.medication.id && med.schedule.id === item.schedule.id
            ? { ...med, taken: true, takenAt: new Date(now), doseId: dose.id }
            : med
        )
      );
    } catch (error) {
      console.error('Failed to log medication:', error);
      Alert.alert('Error', 'Failed to log medication');
    }
  };

  const handleSkipMedication = (item: TodaysMedication) => {
    // Optimistically update UI immediately
    setTodaysMedications(prev =>
      prev.map(med =>
        med.medication.id === item.medication.id && med.schedule.id === item.schedule.id
          ? { ...med, skipped: true }
          : med
      )
    );
  };

  const handleUndoAction = async (item: TodaysMedication) => {
    try {
      // Optimistically update UI immediately
      setTodaysMedications(prev =>
        prev.map(med =>
          med.medication.id === item.medication.id && med.schedule.id === item.schedule.id
            ? { ...med, taken: false, takenAt: undefined, skipped: false, doseId: undefined }
            : med
        )
      );

      // If it was taken, delete from database
      if (item.doseId) {
        await deleteDose(item.doseId);
      }
    } catch (error) {
      console.error('Failed to undo medication:', error);
      Alert.alert('Error', 'Failed to undo');
      // Reload on error to sync with database
      loadTodaysMedications();
    }
  };

  const lastEpisode = episodes.find(ep => ep.endTime);
  const daysSinceLastEpisode = lastEpisode
    ? differenceInDays(Date.now(), lastEpisode.endTime!)
    : null;

  const styles = createStyles(theme);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} testID="dashboard-title">Pain Tracker</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
          testID="settings-button"
        >
          <Ionicons name="settings-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Today's Medications */}
      {todaysMedications.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Medications</Text>
          {todaysMedications.map((item, index) => (
            <View
              key={`${item.medication.id}-${item.schedule.id}`}
              style={[
                styles.medicationItem,
                index === todaysMedications.length - 1 && styles.medicationItemLast
              ]}
            >
              {item.taken ? (
                <View style={styles.compactRow}>
                  <View style={styles.compactLeft}>
                    <Text style={styles.compactName}>{item.medication.name}</Text>
                    <Text style={styles.compactTime}>{format(item.doseTime, 'h:mm a')}</Text>
                  </View>
                  <View style={styles.compactStatus}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                    <Text style={styles.compactStatusText}>
                      Taken at {item.takenAt && format(item.takenAt, 'h:mm a')}
                    </Text>
                    <TouchableOpacity
                      style={styles.compactUndoButton}
                      onPress={() => handleUndoAction(item)}
                    >
                      <Text style={styles.compactUndoText}>Undo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : item.skipped ? (
                <View style={styles.compactRow}>
                  <View style={styles.compactLeft}>
                    <Text style={styles.compactName}>{item.medication.name}</Text>
                    <Text style={styles.compactTime}>{format(item.doseTime, 'h:mm a')}</Text>
                  </View>
                  <View style={styles.compactStatus}>
                    <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                    <Text style={styles.compactSkippedText}>Skipped</Text>
                    <TouchableOpacity
                      style={styles.compactUndoButton}
                      onPress={() => handleUndoAction(item)}
                    >
                      <Text style={styles.compactUndoText}>Undo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.compactRow}>
                  <View style={styles.compactLeft}>
                    <Text style={styles.compactName}>{item.medication.name}</Text>
                    <Text style={styles.compactTime}>{format(item.doseTime, 'h:mm a')}</Text>
                  </View>
                  <View style={styles.compactButtons}>
                    <TouchableOpacity
                      style={styles.compactLogButton}
                      onPress={() => handleTakeMedication(item)}
                    >
                      <Text style={styles.compactLogButtonText}>
                        Log {item.schedule.dosage} × {item.medication.dosageAmount}{item.medication.dosageUnit}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.compactSkipButton}
                      onPress={() => handleSkipMedication(item)}
                    >
                      <Text style={styles.compactSkipButtonText}>Skip</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        {!currentEpisode && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => navigation.navigate('NewEpisode', {})}
            testID="start-episode-button"
          >
            <Text style={styles.primaryButtonText}>Start Episode</Text>
          </TouchableOpacity>
        )}

        {rescueMedications.length > 0 && (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => {
              navigation.navigate('LogMedication', {
                episodeId: currentEpisode?.id
              });
            }}
            testID="log-medication-button"
          >
            <Text style={styles.secondaryButtonText}>Log Medication</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => navigation.navigate('KeyboardTest')}
          testID="keyboard-test-button"
        >
          <Text style={styles.secondaryButtonText}>Test Keyboard</Text>
        </TouchableOpacity>
      </View>

      {/* Current Episode (if active) */}
      {currentEpisode && (
        <View style={styles.card}>
          <EpisodeCard
            episode={currentEpisode}
            compact
            isLast
            testID="active-episode-card"
            onPress={() => navigation.navigate('EpisodeDetail', { episodeId: currentEpisode.id })}
          />
        </View>
      )}

      {/* Recent Episodes Summary (closed only) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Episodes</Text>
        {episodes.filter(ep => ep.endTime).length === 0 ? (
          <Text style={styles.emptyText}>No closed episodes yet</Text>
        ) : (
          <View>
            {episodes.filter(ep => ep.endTime).slice(0, 3).map((episode, index, array) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                compact
                isLast={index === array.length - 1}
                onPress={() => navigation.navigate('EpisodeDetail', { episodeId: episode.id })}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
