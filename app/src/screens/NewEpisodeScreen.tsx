import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useEpisodeStore } from '../store/episodeStore';
import { PainLocation, PainQuality, Symptom, Trigger } from '../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'NewEpisode'>;

const PAIN_LOCATIONS: { value: PainLocation; label: string }[] = [
  { value: 'left_temple', label: 'Left Temple' },
  { value: 'right_temple', label: 'Right Temple' },
  { value: 'forehead', label: 'Forehead' },
  { value: 'back_of_head', label: 'Back of Head' },
  { value: 'top_of_head', label: 'Top of Head' },
  { value: 'neck', label: 'Neck' },
  { value: 'whole_head', label: 'Whole Head' },
];

const PAIN_QUALITIES: { value: PainQuality; label: string }[] = [
  { value: 'throbbing', label: 'Throbbing' },
  { value: 'sharp', label: 'Sharp' },
  { value: 'dull', label: 'Dull' },
  { value: 'pressure', label: 'Pressure' },
  { value: 'stabbing', label: 'Stabbing' },
  { value: 'burning', label: 'Burning' },
];

const SYMPTOMS: { value: Symptom; label: string }[] = [
  { value: 'nausea', label: 'Nausea' },
  { value: 'vomiting', label: 'Vomiting' },
  { value: 'visual_disturbances', label: 'Visual Disturbances' },
  { value: 'aura', label: 'Aura' },
  { value: 'light_sensitivity', label: 'Light Sensitivity' },
  { value: 'sound_sensitivity', label: 'Sound Sensitivity' },
  { value: 'smell_sensitivity', label: 'Smell Sensitivity' },
  { value: 'dizziness', label: 'Dizziness' },
  { value: 'confusion', label: 'Confusion' },
];

const TRIGGERS: { value: Trigger; label: string }[] = [
  { value: 'stress', label: 'Stress' },
  { value: 'lack_of_sleep', label: 'Lack of Sleep' },
  { value: 'weather_change', label: 'Weather Change' },
  { value: 'bright_lights', label: 'Bright Lights' },
  { value: 'loud_sounds', label: 'Loud Sounds' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'caffeine', label: 'Caffeine' },
  { value: 'food', label: 'Food' },
  { value: 'hormonal', label: 'Hormonal' },
  { value: 'exercise', label: 'Exercise' },
];

export default function NewEpisodeScreen({ navigation }: Props) {
  const { startEpisode, addIntensityReading } = useEpisodeStore();
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [intensity, setIntensity] = useState(5);
  const [locations, setLocations] = useState<PainLocation[]>([]);
  const [qualities, setQualities] = useState<PainQuality[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleSelection = <T,>(item: T, list: T[], setList: (list: T[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const episode = await startEpisode({
        startTime: startTime.getTime(),
        locations,
        qualities,
        symptoms,
        triggers,
        notes: notes.trim() || undefined,
      });

      // Add initial intensity reading
      if (intensity > 0) {
        await addIntensityReading(episode.id, intensity);
      }

      navigation.navigate('MainTabs');
    } catch (error) {
      console.error('Failed to create episode:', error);
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Start Episode</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Start Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Start Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.timeText}>{format(startTime, 'MMM d, yyyy h:mm a')}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={startTime}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setStartTime(date);
              }}
            />
          )}
        </View>

        {/* Initial Intensity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Initial Pain Intensity</Text>
          <View style={styles.intensityContainer}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.intensityButton,
                  intensity === value && styles.intensityButtonActive,
                ]}
                onPress={() => setIntensity(value)}
              >
                <Text
                  style={[
                    styles.intensityText,
                    intensity === value && styles.intensityTextActive,
                  ]}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pain Locations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pain Location (Optional)</Text>
          <View style={styles.chipContainer}>
            {PAIN_LOCATIONS.map(item => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.chip,
                  locations.includes(item.value) && styles.chipActive,
                ]}
                onPress={() => toggleSelection(item.value, locations, setLocations)}
              >
                <Text
                  style={[
                    styles.chipText,
                    locations.includes(item.value) && styles.chipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pain Quality */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pain Quality (Optional)</Text>
          <View style={styles.chipContainer}>
            {PAIN_QUALITIES.map(item => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.chip,
                  qualities.includes(item.value) && styles.chipActive,
                ]}
                onPress={() => toggleSelection(item.value, qualities, setQualities)}
              >
                <Text
                  style={[
                    styles.chipText,
                    qualities.includes(item.value) && styles.chipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Symptoms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptoms (Optional)</Text>
          <View style={styles.chipContainer}>
            {SYMPTOMS.map(item => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.chip,
                  symptoms.includes(item.value) && styles.chipActive,
                ]}
                onPress={() => toggleSelection(item.value, symptoms, setSymptoms)}
              >
                <Text
                  style={[
                    styles.chipText,
                    symptoms.includes(item.value) && styles.chipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Triggers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Possible Triggers (Optional)</Text>
          <View style={styles.chipContainer}>
            {TRIGGERS.map(item => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.chip,
                  triggers.includes(item.value) && styles.chipActive,
                ]}
                onPress={() => toggleSelection(item.value, triggers, setTriggers)}
              >
                <Text
                  style={[
                    styles.chipText,
                    triggers.includes(item.value) && styles.chipTextActive,
                  ]}
                >
                  {item.label}
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
            placeholder="Any additional details..."
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
            {saving ? 'Starting Episode...' : 'Start Episode'}
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
  intensityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intensityButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  intensityButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  intensityText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  intensityTextActive: {
    color: '#fff',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  chipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  chipTextActive: {
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
