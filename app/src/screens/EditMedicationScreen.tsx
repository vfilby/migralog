import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useMedicationStore } from '../store/medicationStore';
import { medicationRepository, medicationScheduleRepository } from '../database/medicationRepository';
import { MedicationType, Medication, ScheduleFrequency, MedicationSchedule } from '../models/types';
import MedicationScheduleManager from '../components/MedicationScheduleManager';
import { useTheme, ThemeColors } from '../theme';
import { notificationService } from '../services/notificationService';

type Props = NativeStackScreenProps<RootStackParamList, 'EditMedication'>;

const DOSAGE_UNITS = ['mg', 'ml', 'tablets', 'capsules', 'drops', 'puffs', 'minutes', 'other'];

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
  cancelButton: {
    fontSize: 17,
    color: theme.primary,
    width: 60,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: theme.textSecondary,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  typeButtonTextActive: {
    color: theme.primaryText,
  },
  input: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.text,
  },
  photoContainer: {
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: theme.background,
  },
  changePhotoButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.primary,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  changePhotoText: {
    color: theme.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  addPhotoButton: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  addPhotoText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.primary,
    marginBottom: 4,
  },
  addPhotoSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  dosageContainer: {
    gap: 12,
  },
  dosageInput: {
    marginBottom: 0,
  },
  unitPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  unitButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  unitButtonText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  unitButtonTextActive: {
    color: theme.primaryText,
  },
  helperText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 8,
  },
  frequencyContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyButton: {
    flex: 1,
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
  },
  frequencyButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  frequencyButtonText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  frequencyButtonTextActive: {
    color: theme.primaryText,
  },
  notesInput: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  footer: {
    backgroundColor: theme.card,
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  saveButton: {
    backgroundColor: theme.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: theme.textTertiary,
  },
  saveButtonText: {
    color: theme.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
});

export default function EditMedicationScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { medicationId } = route.params;
  const { updateMedication } = useMedicationStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<MedicationType>('rescue');
  const [dosageAmount, setDosageAmount] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [defaultDosage, setDefaultDosage] = useState('1');
  const [scheduleFrequency, setScheduleFrequency] = useState<ScheduleFrequency>('daily');
  const [schedules, setSchedules] = useState<Omit<MedicationSchedule, 'id' | 'medicationId'>[]>([]);
  const [existingScheduleIds, setExistingScheduleIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMedication = useCallback(async () => {
    try {
      const med = await medicationRepository.getById(medicationId);
      if (med) {
        setName(med.name);
        setType(med.type);
        setDosageAmount(med.dosageAmount.toString());
        setDosageUnit(med.dosageUnit);
        setDefaultDosage(med.defaultDosage?.toString() || '1');
        setScheduleFrequency(med.scheduleFrequency || 'daily');
        setNotes(med.notes || '');
        setPhotoUri(med.photoUri);

        // Load existing schedules
        const existingSchedules = await medicationScheduleRepository.getByMedicationId(medicationId);
        setExistingScheduleIds(existingSchedules.map(s => s.id));
        setSchedules(existingSchedules.map(s => ({
          time: s.time,
          dosage: s.dosage,
          enabled: s.enabled,
        })));
      }
    } catch (error) {
      logger.error('Failed to load medication:', error);
      Alert.alert('Error', 'Failed to load medication');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [medicationId, navigation]);

  useEffect(() => {
    loadMedication();
  }, [loadMedication]);

  const pickImage = async (useCamera: boolean) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please grant camera/photo library access');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Update Photo',
      'Choose a photo of your medication',
      [
        { text: 'Take Photo', onPress: () => pickImage(true) },
        { text: 'Choose from Library', onPress: () => pickImage(false) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a medication name');
      return;
    }

    if (!dosageAmount || isNaN(parseFloat(dosageAmount))) {
      Alert.alert('Error', 'Please enter a valid dosage amount');
      return;
    }

    setSaving(true);
    try {
      await updateMedication(medicationId, {
        name: name.trim(),
        type,
        dosageAmount: parseFloat(dosageAmount),
        dosageUnit,
        defaultDosage: defaultDosage ? parseFloat(defaultDosage) : undefined,
        scheduleFrequency: type === 'preventative' ? scheduleFrequency : undefined,
        photoUri,
        notes: notes.trim() || undefined,
      });

      // Update schedules if preventative medication
      if (type === 'preventative') {
        // Delete all existing schedules
        await Promise.all(
          existingScheduleIds.map(id => medicationScheduleRepository.delete(id))
        );

        // Create new schedules
        for (const schedule of schedules) {
          // Create the schedule in the database
          await medicationScheduleRepository.create({
            medicationId,
            time: schedule.time,
            dosage: schedule.dosage,
            enabled: schedule.enabled,
            reminderEnabled: true,
          });
        }

        // Reschedule all medication notifications with grouping
        // This will cancel all existing notifications and recreate them with proper grouping
        const permissions = await notificationService.getPermissions();
        if (permissions.granted && scheduleFrequency === 'daily') {
          try {
            await notificationService.rescheduleAllMedicationNotifications();
            logger.log('[EditMedication] Notifications rescheduled with grouping');
          } catch (error) {
            logger.error('[EditMedication] Failed to reschedule notifications:', error);
            // Don't fail the whole operation if notification fails
          }
        }
      }

      navigation.goBack();
    } catch (error) {
      logger.error('Failed to update medication:', error);
      Alert.alert('Error', 'Failed to update medication');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Medication</Text>
          <View style={{ width: 60 }} />
        </View>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="edit-medication-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Medication</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Medication Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'rescue' && styles.typeButtonActive,
              ]}
              onPress={() => setType('rescue')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'rescue' && styles.typeButtonTextActive,
                ]}
              >
                Rescue
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'preventative' && styles.typeButtonActive,
              ]}
              onPress={() => setType('preventative')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'preventative' && styles.typeButtonTextActive,
                ]}
              >
                Preventative
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Medication Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medication Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Advil, Sumatriptan"
            placeholderTextColor={theme.textTertiary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Photo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo (Optional)</Text>
          {photoUri ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={showImageOptions}
              >
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={showImageOptions}
            >
              <Text style={styles.addPhotoText}>+ Add Photo</Text>
              <Text style={styles.addPhotoSubtext}>
                Take a picture or choose from your library
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dosage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Single Dose Amount *</Text>
          <View style={styles.dosageContainer}>
            <TextInput
              style={[styles.input, styles.dosageInput]}
              placeholder="200"
              placeholderTextColor={theme.textTertiary}
              value={dosageAmount}
              onChangeText={setDosageAmount}
              keyboardType="decimal-pad"
            />
            <View style={styles.unitPicker}>
              {DOSAGE_UNITS.map(unit => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.unitButton,
                    dosageUnit === unit && styles.unitButtonActive,
                  ]}
                  onPress={() => setDosageUnit(unit)}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      dosageUnit === unit && styles.unitButtonTextActive,
                    ]}
                  >
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Default Dosage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Number of Doses Typically Taken</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 2 (for 2 tablets)"
            placeholderTextColor={theme.textTertiary}
            value={defaultDosage}
            onChangeText={setDefaultDosage}
            keyboardType="decimal-pad"
          />
          <Text style={styles.helperText}>
            For example, if you take 3 tablets of 200mg Advil, enter 3
          </Text>
        </View>

        {/* Schedule Frequency (for preventative) */}
        {type === 'preventative' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule Frequency</Text>
            <View style={styles.frequencyContainer}>
              <TouchableOpacity
                style={[
                  styles.frequencyButton,
                  scheduleFrequency === 'daily' && styles.frequencyButtonActive,
                ]}
                onPress={() => setScheduleFrequency('daily')}
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    scheduleFrequency === 'daily' && styles.frequencyButtonTextActive,
                  ]}
                >
                  Daily
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.frequencyButton,
                  scheduleFrequency === 'monthly' && styles.frequencyButtonActive,
                ]}
                onPress={() => setScheduleFrequency('monthly')}
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    scheduleFrequency === 'monthly' && styles.frequencyButtonTextActive,
                  ]}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.frequencyButton,
                  scheduleFrequency === 'quarterly' && styles.frequencyButtonActive,
                ]}
                onPress={() => setScheduleFrequency('quarterly')}
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    scheduleFrequency === 'quarterly' && styles.frequencyButtonTextActive,
                  ]}
                >
                  Quarterly
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Schedule Manager (for preventative) */}
        {type === 'preventative' && (
          <View style={styles.section}>
            <MedicationScheduleManager
              scheduleFrequency={scheduleFrequency}
              schedules={schedules}
              onSchedulesChange={setSchedules}
            />
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            numberOfLines={4}
            placeholder="Any additional information..."
            placeholderTextColor={theme.textTertiary}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
