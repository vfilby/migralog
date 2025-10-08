import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useMedicationStore } from '../store/medicationStore';
import { useEpisodeStore } from '../store/episodeStore';
import { medicationRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Medication, MedicationSchedule } from '../models/types';
import { useTheme, ThemeColors } from '../theme';
import { format } from 'date-fns';

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
    backgroundColor: theme.background,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
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
});

export default function MedicationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { preventativeMedications, rescueMedications, loadMedications, logDose, loading } = useMedicationStore();
  const { currentEpisode, loadCurrentEpisode } = useEpisodeStore();
  const [medicationSchedules, setMedicationSchedules] = useState<Record<string, MedicationSchedule[]>>({});

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMedications();
      loadCurrentEpisode();
      loadSchedules();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    loadSchedules();
  }, [preventativeMedications]);

  const loadSchedules = async () => {
    try {
      const schedules: Record<string, MedicationSchedule[]> = {};
      for (const med of preventativeMedications) {
        const medSchedules = await medicationScheduleRepository.getByMedicationId(med.id);
        schedules[med.id] = medSchedules;
      }
      setMedicationSchedules(schedules);
    } catch (error) {
      console.error('Failed to load schedules:', error);
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

  const handleQuickLog = async (medicationId: string, defaultDosage: number) => {
    try {
      await logDose({
        medicationId,
        timestamp: Date.now(),
        amount: defaultDosage || 1,
        episodeId: currentEpisode?.id,
      });
      Alert.alert('Success', 'Medication logged successfully');
    } catch (error) {
      console.error('Failed to quick log medication:', error);
      Alert.alert('Error', 'Failed to log medication');
    }
  };


  return (
    <View style={styles.container}>
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
                      handleQuickLog(med.id, med.defaultDosage || 1);
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

