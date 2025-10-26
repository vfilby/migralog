import React, { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { medicationDoseRepository, medicationRepository } from '../database/medicationRepository';
import { MedicationDose, Medication } from '../models/types';
import { format } from 'date-fns';
import { formatDoseWithSnapshot, formatDosageWithUnit } from '../utils/medicationFormatting';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicationLog'>;

type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

export default function MedicationLogScreen({ navigation }: Props) {
  const [doses, setDoses] = useState<MedicationDoseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDoses();
    });
    return unsubscribe;
  }, [navigation]);

  const loadDoses = async () => {
    setLoading(true);
    try {
      const allDoses = await medicationDoseRepository.getAll();

      // Load medication details for each dose
      const dosesWithDetails = await Promise.all(
        allDoses.map(async (dose) => {
          const medication = await medicationRepository.getById(dose.medicationId);
          return { ...dose, medication: medication || undefined };
        })
      );

      setDoses(dosesWithDetails);
    } catch (error) {
      logger.error('Failed to load medication log:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const now = new Date();
    const date = new Date(timestamp);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date >= today) {
      return `Today, ${format(date, 'h:mm a')}`;
    } else if (date >= yesterday) {
      return `Yesterday, ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy h:mm a');
    }
  };

  return (
    <View style={styles.container} testID="medication-log-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Medication Log</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : doses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No medications logged yet</Text>
          <Text style={styles.emptySubtext}>
            Log your first dose from the Dashboard or Episodes
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {doses.map(dose => (
            <View key={dose.id} style={styles.doseCard}>
              <View style={styles.doseHeader}>
                <View style={styles.doseInfo}>
                  <Text style={styles.medicationName}>
                    {dose.medication?.name || 'Unknown Medication'}
                  </Text>
                  <Text style={styles.doseTime}>{formatDate(dose.timestamp)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigation.navigate('EditMedicationDose', { doseId: dose.id })}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.doseDetails}>
                <Text style={styles.doseAmount}>
                  {dose.medication
                    ? formatDoseWithSnapshot(dose, dose.medication)
                    : `${dose.quantity} doses`}
                  {dose.medication && (
                    <>
                      {' = '}
                      {formatDosageWithUnit(
                        dose.quantity * (dose.dosageAmount ?? dose.medication.dosageAmount),
                        dose.dosageUnit ?? dose.medication.dosageUnit
                      )}
                    </>
                  )}
                </Text>
                {dose.notes && (
                  <Text style={styles.doseNotes}>{dose.notes}</Text>
                )}
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  backButton: {
    fontSize: 17,
    color: '#007AFF',
    width: 60,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#C7C7CC',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  doseCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  doseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  doseInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  doseTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  doseDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 12,
  },
  doseAmount: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
    marginBottom: 4,
  },
  doseNotes: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
});
