import React, { useCallback } from 'react';
import { logger } from '../utils/logger';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEpisodeStore } from '../store/episodeStore';
import { useMedicationStore, TodaysMedication } from '../store/medicationStore';
import { format, isToday } from 'date-fns';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import EpisodeCard from '../components/EpisodeCard';
import DailyStatusWidget from '../components/DailyStatusWidget';
import { useTheme, ThemeColors } from '../theme';

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
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: theme.text,
    flexShrink: 1,
  },
  settingsButton: {
    padding: 8,
  },
  card: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'stretch',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  compactName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    flexShrink: 0,
  },
  compactTime: {
    fontSize: 13,
    color: theme.textSecondary,
    flexShrink: 0,
  },
  compactButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compactLogButton: {
    backgroundColor: theme.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    flexShrink: 1,
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
    flexShrink: 0,
  },
  compactSkipButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  compactStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
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

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { currentEpisode, episodes, loadCurrentEpisode, loadEpisodes } = useEpisodeStore();
  const {
    rescueMedications,
    loadMedications,
    loadSchedules,
    loadRecentDoses,
    logDose,
    deleteDose,
  } = useMedicationStore();

  // Get primitive values from store to compute today's medications
  const preventativeMedications = useMedicationStore(state => state.preventativeMedications);
  const schedules = useMedicationStore(state => state.schedules);
  const doses = useMedicationStore(state => state.doses);

  // Compute today's medications in the component
  const todaysMedications = React.useMemo(() => {
    const todayMeds: TodaysMedication[] = [];

    for (const med of preventativeMedications) {
      if (med.scheduleFrequency !== 'daily') {
        continue;
      }

      // Get schedules for this medication
      const medSchedules = schedules.filter(s => s.medicationId === med.id);
      // Get doses for this medication
      const medDoses = doses.filter(d => d.medicationId === med.id);

      for (const schedule of medSchedules) {
        // Parse schedule time (HH:mm format)
        const [hours, minutes] = schedule.time.split(':').map(Number);
        const doseTime = new Date();
        doseTime.setHours(hours, minutes, 0, 0);

        // Find the most recent dose logged today
        const todaysDoses = medDoses.filter(dose => {
          const doseDate = new Date(dose.timestamp);
          return isToday(doseDate);
        });

        // Sort by timestamp descending and take the most recent one
        const latestDose = todaysDoses.length > 0
          ? todaysDoses.sort((a, b) => b.timestamp - a.timestamp)[0]
          : undefined;

        // Show all scheduled medications for today
        todayMeds.push({
          medication: med,
          schedule,
          doseTime,
          taken: latestDose?.status === 'taken',
          takenAt: latestDose?.status === 'taken' ? new Date(latestDose.timestamp) : undefined,
          skipped: latestDose?.status === 'skipped',
          doseId: latestDose?.id,
        });
      }
    }

    // Sort by time
    todayMeds.sort((a, b) => a.doseTime.getTime() - b.doseTime.getTime());

    return todayMeds;
  }, [preventativeMedications, schedules, doses]);

  // Load data when screen comes into focus (handles both tab navigation AND modal dismissal)
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        // Load episodes and medications first
        await Promise.all([
          loadCurrentEpisode(),
          loadEpisodes(),
          loadMedications(),
        ]);

        // THEN load schedules and doses (they depend on medications being loaded)
        // Today's medications are computed from store state, so no separate load needed
        await Promise.all([
          loadSchedules(),
          loadRecentDoses(1),
        ]);
      };
      loadData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])  // Empty deps - store functions are stable, only run on focus
  );

  const handleTakeMedication = async (item: TodaysMedication) => {
    try {
      const now = Date.now();

      // Save to database - this will update the store's doses array
      await logDose({
        medicationId: item.medication.id,
        timestamp: now,
        quantity: item.schedule.dosage,
        dosageAmount: item.medication.dosageAmount,
        dosageUnit: item.medication.dosageUnit,
        episodeId: currentEpisode?.id,
        updatedAt: now,
      });

      // UI will automatically update via the store selector
    } catch (error) {
      logger.error('Failed to log medication:', error);
      Alert.alert('Error', 'Failed to log medication');
    }
  };

  const handleSkipMedication = async (item: TodaysMedication) => {
    try {
      const now = Date.now();

      // Save skip to database with status 'skipped' and quantity 0
      await logDose({
        medicationId: item.medication.id,
        timestamp: now,
        quantity: 0, // 0 quantity indicates skipped
        dosageAmount: item.medication.dosageAmount,
        dosageUnit: item.medication.dosageUnit,
        status: 'skipped',
        episodeId: currentEpisode?.id,
        updatedAt: now,
      });

      // UI will automatically update via the store selector
    } catch (error) {
      logger.error('Failed to skip medication:', error);
      Alert.alert('Error', 'Failed to skip medication');
    }
  };

  const handleUndoAction = async (item: TodaysMedication) => {
    try {
      // Delete from database - this will update the store's doses array
      if (item.doseId) {
        await deleteDose(item.doseId);
      }

      // UI will automatically update via the store selector
    } catch (error) {
      logger.error('Failed to undo medication:', error);
      Alert.alert('Error', 'Failed to undo');
    }
  };

  const styles = createStyles(theme);

  return (
    <ScrollView style={styles.container} testID="dashboard-screen">
      <View style={styles.header}>
        <Text style={styles.title} testID="dashboard-title">MigraLog</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
          testID="settings-button"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          accessibilityHint="Open app settings"
        >
          <Ionicons name="settings-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Daily Status Widget */}
      <DailyStatusWidget />

      {/* Today's Medications */}
      {todaysMedications.length > 0 && (
        <View style={styles.card} testID="todays-medications-card">
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
                  <TouchableOpacity
                    style={styles.compactLeft}
                    onPress={() => navigation.navigate('MedicationDetail', { medicationId: item.medication.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.medication.name} at ${format(item.doseTime, 'h:mm a')}`}
                    accessibilityHint="View medication details"
                  >
                    <Text style={styles.compactName}>{item.medication.name}</Text>
                    <Text style={styles.compactTime}>{format(item.doseTime, 'h:mm a')}</Text>
                  </TouchableOpacity>
                  <View style={styles.compactStatus}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                    <Text style={styles.compactStatusText}>
                      Taken at {item.takenAt && format(item.takenAt, 'h:mm a')}
                    </Text>
                    <TouchableOpacity
                      style={styles.compactUndoButton}
                      onPress={() => handleUndoAction(item)}
                      accessibilityRole="button"
                      accessibilityLabel="Undo medication log"
                      accessibilityHint={`Remove log for ${item.medication.name}`}
                    >
                      <Text style={styles.compactUndoText}>Undo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : item.skipped ? (
                <View style={styles.compactRow}>
                  <TouchableOpacity
                    style={styles.compactLeft}
                    onPress={() => navigation.navigate('MedicationDetail', { medicationId: item.medication.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.medication.name} at ${format(item.doseTime, 'h:mm a')}`}
                    accessibilityHint="View medication details"
                  >
                    <Text style={styles.compactName}>{item.medication.name}</Text>
                    <Text style={styles.compactTime}>{format(item.doseTime, 'h:mm a')}</Text>
                  </TouchableOpacity>
                  <View style={styles.compactStatus}>
                    <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                    <Text style={styles.compactSkippedText}>Skipped</Text>
                    <TouchableOpacity
                      style={styles.compactUndoButton}
                      onPress={() => handleUndoAction(item)}
                      accessibilityRole="button"
                      accessibilityLabel="Undo medication skip"
                      accessibilityHint={`Remove skip for ${item.medication.name}`}
                    >
                      <Text style={styles.compactUndoText}>Undo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.compactRow}>
                  <TouchableOpacity
                    style={styles.compactLeft}
                    onPress={() => navigation.navigate('MedicationDetail', { medicationId: item.medication.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.medication.name} at ${format(item.doseTime, 'h:mm a')}`}
                    accessibilityHint="View medication details"
                  >
                    <Text style={styles.compactName}>{item.medication.name}</Text>
                    <Text style={styles.compactTime}>{format(item.doseTime, 'h:mm a')}</Text>
                  </TouchableOpacity>
                  <View style={styles.compactButtons}>
                    <TouchableOpacity
                      style={styles.compactLogButton}
                      onPress={() => handleTakeMedication(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Log ${item.schedule.dosage} ${item.medication.dosageAmount}${item.medication.dosageUnit} of ${item.medication.name}`}
                      accessibilityHint="Mark this medication as taken"
                    >
                      <Text style={styles.compactLogButtonText}>
                        Log {item.schedule.dosage} × {item.medication.dosageAmount}{item.medication.dosageUnit}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.compactSkipButton}
                      onPress={() => handleSkipMedication(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Skip ${item.medication.name}`}
                      accessibilityHint="Mark this medication as skipped"
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
            accessibilityRole="button"
            accessibilityLabel="Start Episode"
            accessibilityHint="Record a new migraine episode"
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
            accessibilityRole="button"
            accessibilityLabel="Log Medication"
            accessibilityHint="Record rescue medication taken"
          >
            <Text style={styles.secondaryButtonText}>Log Medication</Text>
          </TouchableOpacity>
        )}
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
            {episodes.filter(ep => ep.endTime).slice(0, 3).map((episode, index, arr) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                compact
                isLast={index === arr.length - 1}
                onPress={() => navigation.navigate('EpisodeDetail', { episodeId: episode.id })}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
