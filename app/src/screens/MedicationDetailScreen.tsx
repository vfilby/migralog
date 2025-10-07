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
  const { colors } = useTheme();
  const [medication, setMedication] = useState<Medication | null>(null);
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [doses, setDoses] = useState<MedicationDose[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMedicationData();
  }, [medicationId]);

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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medication Details</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('EditMedication', { medicationId })}
        >
          <Text style={[styles.editButton, { color: colors.primary }]}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Medication Info */}
        <View style={styles.section}>
          <Text style={styles.medicationName}>{medication.name}</Text>
          <View style={styles.typeBadge}>
            <Text style={[styles.typeBadgeText, {
              color: medication.type === 'preventative' ? colors.success : colors.warning
            }]}>
              {medication.type === 'preventative' ? 'Preventative' : 'Rescue'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dosage:</Text>
            <Text style={styles.infoValue}>
              {medication.dosageAmount}{medication.dosageUnit}
            </Text>
          </View>

          {medication.defaultDosage && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Default Doses:</Text>
              <Text style={styles.infoValue}>{medication.defaultDosage}</Text>
            </View>
          )}

          {medication.scheduleFrequency && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Frequency:</Text>
              <Text style={styles.infoValue}>{medication.scheduleFrequency}</Text>
            </View>
          )}

          {medication.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.infoLabel}>Notes:</Text>
              <Text style={styles.notesText}>{medication.notes}</Text>
            </View>
          )}
        </View>

        {/* Schedules (Preventative only) */}
        {medication.type === 'preventative' && schedules.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            {schedules.map((schedule) => (
              <View key={schedule.id} style={styles.scheduleItem}>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleTime}>{schedule.time}</Text>
                  <Text style={styles.scheduleDosage}>
                    {schedule.dosage} dose{schedule.dosage > 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.scheduleToggle}>
                  <Text style={styles.toggleLabel}>Reminders</Text>
                  <Switch
                    value={schedule.enabled}
                    onValueChange={() => handleToggleNotification(schedule)}
                    trackColor={{ false: '#E5E5EA', true: colors.primary }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 7-Day Timeline (Preventative Daily only) */}
        {last7Days.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last 7 Days</Text>
            <View style={styles.timeline}>
              {last7Days.map((day, index) => (
                <View key={index} style={styles.timelineDay}>
                  <Text style={styles.dayLabel}>{format(day.date, 'EEE')}</Text>
                  <View style={[
                    styles.dayIndicator,
                    day.taken ? { backgroundColor: colors.success } : { backgroundColor: '#E5E5EA' }
                  ]} />
                  <Text style={styles.dayDate}>{format(day.date, 'd')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 30-Day Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity (30 days)</Text>
          {doses.length === 0 ? (
            <Text style={styles.emptyText}>No doses logged in the last 30 days</Text>
          ) : (
            <>
              <View style={styles.logSummary}>
                <Text style={styles.logSummaryText}>
                  {doses.length} dose{doses.length !== 1 ? 's' : ''} logged
                </Text>
              </View>
              {doses.slice(0, 10).map((dose) => (
                <View key={dose.id} style={styles.logItem}>
                  <View style={styles.logItemLeft}>
                    <Text style={styles.logDate}>
                      {format(new Date(dose.timestamp), 'MMM d, yyyy')}
                    </Text>
                    <Text style={styles.logTime}>
                      {format(new Date(dose.timestamp), 'h:mm a')}
                    </Text>
                  </View>
                  <View style={styles.logItemRight}>
                    <Text style={styles.logAmount}>
                      {dose.amount} × {medication.dosageAmount}{medication.dosageUnit}
                    </Text>
                    {dose.notes && (
                      <Text style={styles.logNotes} numberOfLines={1}>{dose.notes}</Text>
                    )}
                  </View>
                </View>
              ))}
              {doses.length > 10 && (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => navigation.navigate('MedicationLog')}
                >
                  <Text style={[styles.viewAllText, { color: colors.primary }]}>
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
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    fontSize: 17,
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  editButton: {
    fontSize: 17,
    fontWeight: '400',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  medicationName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    marginBottom: 16,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  infoLabel: {
    fontSize: 17,
    color: '#8E8E93',
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000',
  },
  notesContainer: {
    marginTop: 12,
  },
  notesText: {
    fontSize: 15,
    color: '#000',
    marginTop: 4,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000',
  },
  scheduleDosage: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 2,
  },
  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#8E8E93',
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
    color: '#8E8E93',
    fontWeight: '500',
  },
  dayIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dayDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  logSummary: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  logSummaryText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  logItemLeft: {
    flex: 1,
  },
  logDate: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000',
  },
  logTime: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 2,
  },
  logItemRight: {
    alignItems: 'flex-end',
  },
  logAmount: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000',
  },
  logNotes: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    maxWidth: 150,
  },
  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
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
