import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useMedicationStore } from '../store/medicationStore';
import { medicationRepository } from '../database/medicationRepository';
import { Medication } from '../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useTheme, ThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LogMedication'>;

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
  medicationCard: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationCardName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  medicationCardDosage: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  medicationActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  quickLogButton: {
    flex: 1,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogButtonText: {
    color: theme.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  detailsButton: {
    backgroundColor: theme.borderLight,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  detailsButtonText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
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
});

export default function LogMedicationScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { medicationId, episodeId } = route.params;
  const { rescueMedications, loadMedications, logDose } = useMedicationStore();
  const [selectedMedId, setSelectedMedId] = useState<string | null>(medicationId || null);
  const [medication, setMedication] = useState<Medication | null>(null);
  const [timestamp, setTimestamp] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMedications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedMedId) {
      loadMedication(selectedMedId);
    }
     
  }, [selectedMedId]);

  const loadMedication = async (medId: string) => {
    const med = await medicationRepository.getById(medId);
    if (med) {
      setMedication(med);
      setAmount(med.defaultDosage?.toString() || '1');
    }
  };

  const handleQuickLog = async (med: Medication) => {
    try {
      await logDose({
        medicationId: med.id,
        timestamp: Date.now(),
        amount: med.defaultDosage || 1,
        // episodeId determined automatically by timestamp
      });

      navigation.goBack();
    } catch (error) {
      logger.error('Failed to quick log medication:', error);
      Alert.alert('Error', 'Failed to log medication');
    }
  };

  const handleSave = async () => {
    if (!medication) return;

    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      await logDose({
        medicationId: medication.id,
        timestamp: timestamp.getTime(),
        amount: parseFloat(amount),
        // episodeId determined automatically by timestamp
        notes: notes.trim() || undefined,
      });

      navigation.goBack();
    } catch (error) {
      logger.error('Failed to log medication:', error);
      Alert.alert('Error', 'Failed to log medication');
    } finally {
      setSaving(false);
    }
  };

  if (!medication) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title} testID="log-medication-title">Log Medication</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView style={styles.content}>
          {rescueMedications.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Medication</Text>
              {rescueMedications.map(med => (
                <View key={med.id} style={styles.medicationCard}>
                  <View style={styles.medicationInfo}>
                    <Text style={styles.medicationCardName}>{med.name}</Text>
                    <Text style={styles.medicationCardDosage}>
                      {med.dosageAmount}{med.dosageUnit}
                    </Text>
                  </View>
                  <View style={styles.medicationActions}>
                    <TouchableOpacity
                      style={styles.quickLogButton}
                      onPress={() => handleQuickLog(med)}
                    >
                      <Text style={styles.quickLogButtonText}>
                        Log {med.defaultDosage || 1} × {med.dosageAmount}{med.dosageUnit}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.detailsButton}
                      onPress={() => setSelectedMedId(med.id)}
                    >
                      <Text style={styles.detailsButtonText}>Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No rescue medications added yet</Text>
              <Text style={styles.emptySubtext}>Add medications from the Medications tab</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="log-medication-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title} testID="log-medication-title">Log Medication</Text>
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
          >
            <Text style={styles.timeText}>
              {format(timestamp, 'MMM d, yyyy h:mm a')}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={timestamp || new Date()}
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
            >
              <Text style={styles.amountButtonText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.amountButton}
              onPress={() => {
                const current = parseFloat(amount) || 0;
                setAmount((current + 0.5).toString());
              }}
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

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Logging...' : 'Log Medication'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
