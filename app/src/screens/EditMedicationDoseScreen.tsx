import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { medicationDoseRepository, medicationRepository } from '../database/medicationRepository';
import { MedicationDose, Medication } from '../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useTheme, ThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditMedicationDose'>;

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
    minWidth: 60,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
    color: theme.textSecondary,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  medicationDosage: {
    fontSize: 16,
    color: theme.textSecondary,
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
  timeButton: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 17,
    color: theme.primary,
    fontWeight: '500',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  amountButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountButtonText: {
    fontSize: 24,
    color: theme.primaryText,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
  },
  totalDosage: {
    fontSize: 15,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  quickButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.border,
  },
  quickButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  quickButtonTextActive: {
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
  deleteButton: {
    backgroundColor: theme.danger,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    color: theme.dangerText,
    fontSize: 17,
    fontWeight: '600',
  },
});

export default function EditMedicationDoseScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { doseId } = route.params;

  const [dose, setDose] = useState<MedicationDose | null>(null);
  const [medication, setMedication] = useState<Medication | null>(null);
  const [timestamp, setTimestamp] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDose = useCallback(async () => {
    try {
      setLoading(true);
      const loadedDose = await medicationDoseRepository.getById(doseId);

      if (!loadedDose) {
        Alert.alert('Error', 'Medication dose not found');
        navigation.goBack();
        return;
      }

      const loadedMedication = await medicationRepository.getById(loadedDose.medicationId);

      if (!loadedMedication) {
        Alert.alert('Error', 'Medication not found');
        navigation.goBack();
        return;
      }

      setDose(loadedDose);
      setMedication(loadedMedication);
      setTimestamp(new Date(loadedDose.timestamp));
      setAmount(loadedDose.quantity.toString());
      setNotes(loadedDose.notes || '');
    } catch (error) {
      logger.error('Failed to load medication dose:', error);
      Alert.alert('Error', 'Failed to load medication dose');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [doseId, navigation]);

  useEffect(() => {
    loadDose();
  }, [loadDose]);

  const handleSave = async () => {
    if (!dose || !medication || !timestamp) return;

    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      await medicationDoseRepository.update(dose.id, {
        timestamp: timestamp.getTime(),
        quantity: parseFloat(amount),
        notes: notes.trim() || undefined,
      });

      navigation.goBack();
    } catch (error) {
      logger.error('Failed to update medication dose:', error);
      Alert.alert('Error', 'Failed to update medication dose');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!dose) return;

    Alert.alert(
      'Delete Dose',
      'Are you sure you want to delete this medication dose?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await medicationDoseRepository.delete(dose.id);
              navigation.goBack();
            } catch (error) {
              logger.error('Failed to delete medication dose:', error);
              Alert.alert('Error', 'Failed to delete medication dose');
            }
          },
        },
      ]
    );
  };

  if (loading || !medication || !timestamp) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityHint="Return to previous screen"
          >
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Medication</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityHint="Discard changes and return to previous screen"
        >
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Medication</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Medication Info */}
        <View style={styles.card}>
          <Text style={styles.medicationName}>{medication.name}</Text>
          <Text style={styles.medicationDosage}>
            {medication.dosageAmount}{medication.dosageUnit} per dose
          </Text>
        </View>

        {/* Time Taken */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time Taken</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Change time, currently ${format(timestamp, 'MMM d, yyyy h:mm a')}`}
            accessibilityHint="Opens date and time picker"
          >
            <Text style={styles.timeText}>
              {format(timestamp, 'MMM d, yyyy h:mm a')}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={timestamp}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setTimestamp(date);
              }}
            />
          )}
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Number of Doses ({medication.dosageAmount}{medication.dosageUnit} each)
          </Text>
          <View style={styles.amountContainer}>
            <TouchableOpacity
              style={styles.amountButton}
              onPress={() => {
                const current = parseFloat(amount) || 0;
                if (current > 0.5) setAmount((current - 0.5).toString());
              }}
              accessibilityRole="button"
              accessibilityLabel="Decrease dose amount"
              accessibilityHint="Decreases the number of doses by 0.5"
            >
              <Text style={styles.amountButtonText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              accessibilityLabel="Dose amount"
              accessibilityHint="Number of doses taken"
            />
            <TouchableOpacity
              style={styles.amountButton}
              onPress={() => {
                const current = parseFloat(amount) || 0;
                setAmount((current + 0.5).toString());
              }}
              accessibilityRole="button"
              accessibilityLabel="Increase dose amount"
              accessibilityHint="Increases the number of doses by 0.5"
            >
              <Text style={styles.amountButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.totalDosage}>
            Total: {parseFloat(amount || '0') * medication.dosageAmount}
            {medication.dosageUnit}
          </Text>
        </View>

        {/* Quick Amount Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Select</Text>
          <View style={styles.quickButtonsContainer}>
            {[0.5, 1, 1.5, 2, 2.5, 3].map(value => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.quickButton,
                  parseFloat(amount) === value && styles.quickButtonActive,
                ]}
                onPress={() => setAmount(value.toString())}
                accessibilityRole="button"
                accessibilityLabel={`Set dose amount to ${value}`}
                accessibilityHint={`Select ${value} dose${value > 1 ? 's' : ''}`}
                accessibilityState={{ selected: parseFloat(amount) === value }}
              >
                <Text
                  style={[
                    styles.quickButtonText,
                    parseFloat(amount) === value && styles.quickButtonTextActive,
                  ]}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            numberOfLines={4}
            placeholder="Any details about effectiveness, side effects, etc..."
            placeholderTextColor={theme.textTertiary}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save and Delete Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          accessibilityHint="Saves the edited medication dose and returns to previous screen"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Delete dose"
          accessibilityHint="Permanently deletes this medication dose"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.deleteButtonText}>Delete Dose</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
