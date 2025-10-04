import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useMedicationStore } from '../store/medicationStore';
import { MedicationType } from '../models/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddMedication'>;

const DOSAGE_UNITS = ['mg', 'ml', 'tablets', 'capsules', 'drops', 'puffs'];
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'As needed'];

export default function AddMedicationScreen({ navigation }: Props) {
  const { addMedication } = useMedicationStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<MedicationType>('rescue');
  const [dosageAmount, setDosageAmount] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [defaultDosage, setDefaultDosage] = useState('1');
  const [frequency, setFrequency] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

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
      await addMedication({
        name: name.trim(),
        type,
        dosageAmount: parseFloat(dosageAmount),
        dosageUnit,
        defaultDosage: defaultDosage ? parseFloat(defaultDosage) : undefined,
        frequency: type === 'preventative' && frequency ? frequency : undefined,
        active: true,
        notes: notes.trim() || undefined,
      });

      navigation.goBack();
    } catch (error) {
      console.error('Failed to add medication:', error);
      Alert.alert('Error', 'Failed to save medication');
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Medication</Text>
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
            placeholderTextColor="#C7C7CC"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Dosage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Single Dose Amount *</Text>
          <View style={styles.dosageContainer}>
            <TextInput
              style={[styles.input, styles.dosageInput]}
              placeholder="200"
              placeholderTextColor="#C7C7CC"
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
            placeholderTextColor="#C7C7CC"
            value={defaultDosage}
            onChangeText={setDefaultDosage}
            keyboardType="decimal-pad"
          />
          <Text style={styles.helperText}>
            For example, if you take 3 tablets of 200mg Advil, enter 3
          </Text>
        </View>

        {/* Frequency (for preventative) */}
        {type === 'preventative' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequency</Text>
            {FREQUENCIES.map(freq => (
              <TouchableOpacity
                key={freq}
                style={[
                  styles.frequencyButton,
                  frequency === freq && styles.frequencyButtonActive,
                ]}
                onPress={() => setFrequency(freq)}
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    frequency === freq && styles.frequencyButtonTextActive,
                  ]}
                >
                  {freq}
                </Text>
              </TouchableOpacity>
            ))}
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
            {saving ? 'Saving...' : 'Save Medication'}
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
    color: '#8E8E93',
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
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  unitButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  unitButtonText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  helperText: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 8,
  },
  frequencyButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  frequencyButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  frequencyButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  frequencyButtonTextActive: {
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
});
