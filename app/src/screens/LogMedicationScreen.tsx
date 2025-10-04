import React, { useState, useEffect } from 'react';
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
import { useEpisodeStore } from '../store/episodeStore';
import { medicationRepository } from '../database/medicationRepository';
import { Medication } from '../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'LogMedication'>;

export default function LogMedicationScreen({ route, navigation }: Props) {
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
        episodeId: episodeId || undefined,
        notes: notes.trim() || undefined,
      });

      navigation.goBack();
    } catch (error) {
      console.error('Failed to log medication:', error);
      Alert.alert('Error', 'Failed to log medication');
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
          <Text style={styles.title}>Log Medication</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView style={styles.content}>
          {rescueMedications.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Medication</Text>
              {rescueMedications.map(med => (
                <TouchableOpacity
                  key={med.id}
                  style={styles.medicationCard}
                  onPress={() => setSelectedMedId(med.id)}
                >
                  <View style={styles.medicationInfo}>
                    <Text style={styles.medicationCardName}>{med.name}</Text>
                    <Text style={styles.medicationCardDosage}>
                      {med.dosageAmount}{med.dosageUnit}
                    </Text>
                  </View>
                  <Text style={styles.selectArrow}>›</Text>
                </TouchableOpacity>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Log Medication</Text>
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
            placeholderTextColor="#C7C7CC"
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
  cancelButton: {
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
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  medicationDosage: {
    fontSize: 16,
    color: '#8E8E93',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 17,
    color: '#007AFF',
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
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  totalDosage: {
    fontSize: 15,
    color: '#8E8E93',
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
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  quickButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  quickButtonTextActive: {
    color: '#fff',
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  medicationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
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
    color: '#000',
    marginBottom: 4,
  },
  medicationCardDosage: {
    fontSize: 14,
    color: '#8E8E93',
  },
  selectArrow: {
    fontSize: 24,
    color: '#C7C7CC',
    marginLeft: 8,
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
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#C7C7CC',
    textAlign: 'center',
  },
});
