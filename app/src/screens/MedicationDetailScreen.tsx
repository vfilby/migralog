import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Medication, MedicationDose, MedicationSchedule } from '../models/types';
import { medicationRepository, medicationDoseRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { notificationService } from '../services/notificationService';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicationDetail'>;

export default function MedicationDetailScreen({ route, navigation }: Props) {
  const { medicationId } = route.params;
  const { theme } = useTheme();
  const [medication, setMedication] = useState<Medication | null>(null);
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [doses, setDoses] = useState<MedicationDose[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMedicationData();
  }, [medicationId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMedicationData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadMedicationData = async () => {
    try {
      const med = await medicationRepository.getById(medicationId);
      if (!med) {
        Alert.alert('Error', 'Medication not found');
        navigation.goBack();
        return;
      }

      setMedication(med);

      // Load schedules for preventative medications
      if (med.type === 'preventative') {
        const scheds = await medicationScheduleRepository.getByMedicationId(medicationId);
        setSchedules(scheds);
      }

      // Load last 30 days of doses
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const allDoses = await medicationDoseRepository.getByMedicationId(medicationId);
      const recentDoses = allDoses.filter(d => d.timestamp >= thirtyDaysAgo);
      setDoses(recentDoses);
    } catch (error) {
      console.error('Failed to load medication data:', error);
      Alert.alert('Error', 'Failed to load medication details');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotification = async (schedule: MedicationSchedule) => {
    if (!medication) return;

    try {
      const newEnabledState = !schedule.enabled;

      // Update schedule in database
      await medicationScheduleRepository.update(schedule.id, {
        enabled: newEnabledState,
      });

      // Cancel or schedule notification
      if (newEnabledState) {
        // Schedule new notification
        const notificationId = await notificationService.scheduleNotification(
          medication,
          { ...schedule, enabled: true }
        );

        if (notificationId) {
          await medicationScheduleRepository.update(schedule.id, {
            notificationId,
          });
        }
      } else {
        // Cancel notification
        if (schedule.notificationId) {
          await notificationService.cancelNotification(schedule.notificationId);
          await medicationScheduleRepository.update(schedule.id, {
            notificationId: undefined,
          });
        }
      }

      // Reload data
      await loadMedicationData();
    } catch (error) {
      console.error('Failed to toggle notification:', error);
      Alert.alert('Error', 'Failed to update notification');
    }
  };

  const getLast7DaysTimeline = () => {
    const timeline = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayStart = startOfDay(date).getTime();
      const dayEnd = endOfDay(date).getTime();

      const takenToday = doses.some(
        d => d.timestamp >= dayStart && d.timestamp <= dayEnd
      );

      timeline.push({
        date,
        taken: takenToday,
      });
    }
    return timeline;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backButton, { color: theme.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!medication) {
    return null;
  }

  const last7Days = medication.type === 'preventative' && medication.scheduleFrequency === 'daily'
    ? getLast7DaysTimeline()
    : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Medication Details</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('EditMedication', { medicationId })}
        >
          <Text style={[styles.editButton, { color: theme.primary }]}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Medication Info */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.medicationHeader}>
            <Text style={[styles.medicationName, { color: theme.text }]}>{medication.name}</Text>
            <View style={[styles.typeBadge, {
              backgroundColor: medication.type === 'preventative'
                ? theme.success + '20'
                : theme.primary + '20'
            }]}>
              <Text style={[styles.typeBadgeText, {
                color: medication.type === 'preventative' ? theme.success : theme.primary
              }]}>
                {medication.type === 'preventative' ? 'Preventative' : 'Rescue'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Dosage:</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {medication.dosageAmount}{medication.dosageUnit}
            </Text>
          </View>

          {medication.defaultDosage && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Default Doses:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{medication.defaultDosage}</Text>
            </View>
          )}

          {medication.scheduleFrequency && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Frequency:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{medication.scheduleFrequency}</Text>
            </View>
          )}

          {medication.notes && (
            <View style={styles.notesContainer}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Notes:</Text>
              <Text style={[styles.notesText, { color: theme.text }]}>{medication.notes}</Text>
            </View>
          )}
        </View>

        {/* Schedules (Preventative only) */}
        {medication.type === 'preventative' && schedules.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Schedule</Text>
            {schedules.map((schedule, index) => (
              <View key={schedule.id}>
                <View style={styles.scheduleItemRow}>
                  <View style={styles.scheduleLeft}>
                    <Text style={[styles.scheduleTime, { color: theme.text }]}>{schedule.time}</Text>
                    <Text style={[styles.scheduleDosage, { color: theme.textSecondary }]}>
                      {schedule.dosage} dose{schedule.dosage > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.scheduleToggle}>
                    <Text style={[styles.toggleLabel, { color: theme.textSecondary }]}>Reminders</Text>
                    <Switch
                      value={schedule.enabled}
                      onValueChange={() => handleToggleNotification(schedule)}
                      trackColor={{ false: theme.border, true: theme.primary }}
                    />
                  </View>
                </View>
                {index < schedules.length - 1 && (
                  <View style={[styles.separator, { backgroundColor: theme.border }]} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* 7-Day Timeline (Preventative Daily only) */}
        {last7Days.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Last 7 Days</Text>
            <View style={styles.timeline}>
              {last7Days.map((day, index) => (
                <View key={index} style={styles.timelineDay}>
                  <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>{format(day.date, 'EEE')}</Text>
                  <View style={[
                    styles.dayIndicator,
                    day.taken ? { backgroundColor: theme.success } : { backgroundColor: theme.border }
                  ]} />
                  <Text style={[styles.dayDate, { color: theme.textSecondary }]}>{format(day.date, 'd')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 30-Day Log */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity (30 days)</Text>
          {doses.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No doses logged in the last 30 days</Text>
          ) : (
            <>
              <View style={styles.logSummary}>
                <Text style={[styles.logSummaryText, { color: theme.textSecondary }]}>
                  {doses.length} dose{doses.length !== 1 ? 's' : ''} logged
                </Text>
              </View>
              {doses.slice(0, 10).map((dose, index) => (
                <View key={dose.id}>
                  <View style={styles.logItem}>
                    <View style={styles.logItemLeft}>
                      <Text style={[styles.logDate, { color: theme.text }]}>
                        {format(new Date(dose.timestamp), 'MMM d, yyyy')}
                      </Text>
                      <Text style={[styles.logTime, { color: theme.textSecondary }]}>
                        {format(new Date(dose.timestamp), 'h:mm a')}
                      </Text>
                    </View>
                    <View style={styles.logItemRight}>
                      <Text style={[styles.logAmount, { color: theme.text }]}>
                        {dose.amount} × {medication.dosageAmount}{medication.dosageUnit}
                      </Text>
                      {dose.notes && (
                        <Text style={[styles.logNotes, { color: theme.textSecondary }]} numberOfLines={1}>{dose.notes}</Text>
                      )}
                    </View>
                  </View>
                  {index < doses.slice(0, 10).length - 1 && (
                    <View style={[styles.separator, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
              {doses.length > 10 && (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => navigation.navigate('MedicationLog')}
                >
                  <Text style={[styles.viewAllText, { color: theme.primary }]}>
                    View All ({doses.length})
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: 17,
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  editButton: {
    fontSize: 17,
    fontWeight: '400',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  medicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  medicationName: {
    fontSize: 28,
    fontWeight: '700',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 17,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '500',
  },
  notesContainer: {
    marginTop: 12,
  },
  notesText: {
    fontSize: 15,
    marginTop: 4,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  scheduleItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleLeft: {
    flex: 1,
  },
  separator: {
    height: 1,
    marginVertical: 12,
  },
  scheduleTime: {
    fontSize: 17,
    fontWeight: '500',
  },
  scheduleDosage: {
    fontSize: 15,
    marginTop: 2,
  },
  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 15,
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineDay: {
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  dayIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dayDate: {
    fontSize: 13,
  },
  logSummary: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  logSummaryText: {
    fontSize: 15,
    fontWeight: '500',
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logItemLeft: {
    flex: 1,
  },
  logDate: {
    fontSize: 17,
    fontWeight: '500',
  },
  logTime: {
    fontSize: 15,
    marginTop: 2,
  },
  logItemRight: {
    alignItems: 'flex-end',
  },
  logAmount: {
    fontSize: 17,
    fontWeight: '500',
  },
  logNotes: {
    fontSize: 13,
    marginTop: 2,
    maxWidth: 150,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 24,
  },
  viewAllButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 17,
    fontWeight: '500',
  },
});
