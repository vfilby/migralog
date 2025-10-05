import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useMedicationStore } from '../store/medicationStore';
import { useEpisodeStore } from '../store/episodeStore';
import { medicationRepository } from '../database/medicationRepository';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Medication } from '../models/types';
import { useTheme, ThemeColors } from '../theme';

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
  editButton: {
    fontSize: 17,
    color: theme.primary,
    fontWeight: '600',
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
    alignItems: 'center',
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  editModeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
  archiveText: {
    fontSize: 14,
    color: theme.danger,
    fontWeight: '500',
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
  archivedCard: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  archivedMedicationInfo: {
    flex: 1,
  },
  archivedMedicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 2,
  },
  medicationType: {
    fontSize: 13,
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
});

export default function MedicationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { preventativeMedications, rescueMedications, loadMedications, logDose, archiveMedication, unarchiveMedication, loading } = useMedicationStore();
  const { currentEpisode, loadCurrentEpisode } = useEpisodeStore();
  const [isEditMode, setIsEditMode] = useState(false);
  const [archivedMedications, setArchivedMedications] = useState<Medication[]>([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMedications();
      loadCurrentEpisode();
      if (isEditMode) {
        loadArchivedMedications();
      }
    });
    return unsubscribe;
  }, [navigation, isEditMode]);

  useEffect(() => {
    if (isEditMode) {
      loadArchivedMedications();
    }
  }, [isEditMode]);

  const loadArchivedMedications = async () => {
    try {
      const archived = await medicationRepository.getArchived();
      setArchivedMedications(archived);
    } catch (error) {
      console.error('Failed to load archived medications:', error);
    }
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

  const handleArchive = (medicationId: string, medicationName: string) => {
    Alert.alert(
      'Archive Medication',
      `Are you sure you want to archive ${medicationName}? It will be hidden from your active list but kept in your history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveMedication(medicationId);
              loadArchivedMedications(); // Refresh archived list
            } catch (error) {
              console.error('Failed to archive medication:', error);
              Alert.alert('Error', 'Failed to archive medication');
            }
          },
        },
      ]
    );
  };

  const handleUnarchive = (medicationId: string, medicationName: string) => {
    Alert.alert(
      'Restore Medication',
      `Restore ${medicationName} to your active medications?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              await unarchiveMedication(medicationId);
              loadArchivedMedications(); // Refresh archived list
            } catch (error) {
              console.error('Failed to restore medication:', error);
              Alert.alert('Error', 'Failed to restore medication');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Medications</Text>
        <TouchableOpacity onPress={() => setIsEditMode(!isEditMode)}>
          <Text style={styles.editButton}>{isEditMode ? 'Done' : 'Edit'}</Text>
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
            preventativeMedications.map(med => (
              <View key={med.id} style={styles.medicationCard}>
                <View style={styles.medicationHeader}>
                  <Text style={styles.medicationName}>{med.name}</Text>
                  {isEditMode && (
                    <View style={styles.editModeButtons}>
                      <TouchableOpacity onPress={() => navigation.navigate('EditMedication', { medicationId: med.id })}>
                        <Text style={styles.editText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleArchive(med.id, med.name)}>
                        <Text style={styles.archiveText}>Archive</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.medicationDetails}>
                  <Text style={styles.dosageText}>
                    {med.defaultDosage || 1} × {med.dosageAmount}{med.dosageUnit}
                  </Text>
                  {med.scheduleFrequency && (
                    <Text style={styles.frequencyText}>
                      {med.scheduleFrequency.charAt(0).toUpperCase() + med.scheduleFrequency.slice(1)}
                    </Text>
                  )}
                </View>
                {med.notes && (
                  <Text style={styles.notes} numberOfLines={2}>{med.notes}</Text>
                )}
              </View>
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
            rescueMedications.map(med => (
              <View key={med.id} style={styles.medicationCard}>
                <View style={styles.medicationHeader}>
                  <Text style={styles.medicationName}>{med.name}</Text>
                  {isEditMode && (
                    <View style={styles.editModeButtons}>
                      <TouchableOpacity onPress={() => navigation.navigate('EditMedication', { medicationId: med.id })}>
                        <Text style={styles.editText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleArchive(med.id, med.name)}>
                        <Text style={styles.archiveText}>Archive</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.medicationDetails}>
                  <Text style={styles.dosageText}>
                    {med.defaultDosage || 1} × {med.dosageAmount}{med.dosageUnit}
                  </Text>
                </View>
                {med.notes && (
                  <Text style={styles.notes} numberOfLines={2}>{med.notes}</Text>
                )}
                {!isEditMode && (
                  <View style={styles.medicationActions}>
                    <TouchableOpacity
                      style={styles.quickLogButton}
                      onPress={() => handleQuickLog(med.id, med.defaultDosage || 1)}
                    >
                      <Text style={styles.quickLogButtonText}>Quick Log</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.detailedLogButton}
                      onPress={() => navigation.navigate('LogMedication', { medicationId: med.id })}
                    >
                      <Text style={styles.detailedLogButtonText}>Log Details</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Archived Medications Section - Only in Edit Mode */}
        {isEditMode && archivedMedications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Archived</Text>
            {archivedMedications.map(med => (
              <View key={med.id} style={styles.archivedCard}>
                <View style={styles.medicationHeader}>
                  <View style={styles.archivedMedicationInfo}>
                    <Text style={styles.archivedMedicationName}>{med.name}</Text>
                    <Text style={styles.medicationType}>
                      {med.type.charAt(0).toUpperCase() + med.type.slice(1)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.restoreButton}
                    onPress={() => handleUnarchive(med.id, med.name)}
                  >
                    <Text style={styles.restoreButtonText}>Restore</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.medicationDetails}>
                  <Text style={styles.dosageText}>
                    {med.defaultDosage || 1} × {med.dosageAmount}{med.dosageUnit}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

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

