import React, { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { medicationRepository } from '../database/medicationRepository';
import { useMedicationStore } from '../store/medicationStore';
import { Medication } from '../models/types';
import { useTheme, ThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ArchivedMedications'>;

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  backButton: {
    fontSize: 17,
    color: theme.primary,
    minWidth: 60,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: theme.textSecondary,
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
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: theme.textTertiary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  medicationCard: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  medicationType: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  restoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.primary,
    borderRadius: 6,
  },
  restoreButtonText: {
    fontSize: 14,
    color: theme.primaryText,
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
});

export default function ArchivedMedicationsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [archivedMedications, setArchivedMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const { unarchiveMedication } = useMedicationStore();

  useEffect(() => {
    loadArchivedMedications();
  }, []);

  const loadArchivedMedications = async () => {
    setLoading(true);
    try {
      const archived = await medicationRepository.getArchived();
      setArchivedMedications(archived);
    } catch (error) {
      logger.error('Failed to load archived medications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnarchive = (medicationId: string, medicationName: string) => {
    Alert.alert(
      'Unarchive Medication',
      `Are you sure you want to restore ${medicationName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              await unarchiveMedication(medicationId);
              await loadArchivedMedications(); // Refresh list
            } catch (error) {
              logger.error('Failed to unarchive medication:', error);
              Alert.alert('Error', 'Failed to restore medication');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container} testID="archived-medications-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Archived Medications</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : archivedMedications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No archived medications</Text>
          <Text style={styles.emptySubtext}>
            Archived medications will appear here
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {archivedMedications.map(med => (
            <View key={med.id} style={styles.medicationCard}>
              <View style={styles.medicationHeader}>
                <View style={styles.medicationInfo}>
                  <Text style={styles.medicationName}>{med.name}</Text>
                  <Text style={styles.medicationType}>
                    {med.type.charAt(0).toUpperCase() + med.type.slice(1)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={() => handleUnarchive(med.id, med.name)}
                  testID={`restore-medication-${med.name}`}
                >
                  <Text style={styles.restoreButtonText}>Restore</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.medicationDetails}>
                <Text style={styles.dosageText}>
                  {med.defaultQuantity || 1} × {med.dosageAmount}{med.dosageUnit}
                </Text>
                {med.scheduleFrequency && (
                  <Text style={styles.frequencyText}>{med.scheduleFrequency}</Text>
                )}
              </View>
              {med.notes && (
                <Text style={styles.notes} numberOfLines={2}>{med.notes}</Text>
              )}
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}
