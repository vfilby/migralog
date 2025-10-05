import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useEpisodeStore } from '../store/episodeStore';
import { PainLocation, PainQuality, Symptom, Trigger, EpisodeLocation } from '../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { getPainLevel } from '../utils/painScale';
import { locationService } from '../services/locationService';
import { useTheme, ThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'NewEpisode'>;

const PAIN_LOCATIONS: { value: PainLocation; label: string; side: 'left' | 'right' }[] = [
  { value: 'left_eye', label: 'Eye', side: 'left' },
  { value: 'left_temple', label: 'Temple', side: 'left' },
  { value: 'left_neck', label: 'Neck', side: 'left' },
  { value: 'left_head', label: 'Head', side: 'left' },
  { value: 'left_teeth', label: 'Teeth', side: 'left' },
  { value: 'right_eye', label: 'Eye', side: 'right' },
  { value: 'right_temple', label: 'Temple', side: 'right' },
  { value: 'right_neck', label: 'Neck', side: 'right' },
  { value: 'right_head', label: 'Head', side: 'right' },
  { value: 'right_teeth', label: 'Teeth', side: 'right' },
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
  sliderContainer: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  intensityValue: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  intensityLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  painDescription: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  painDescriptionText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  locationColumn: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
  },
  columnHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  locationButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.borderLight,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  locationButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  locationText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  locationTextActive: {
    color: theme.primaryText,
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
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  chipTextActive: {
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
  saveButtonContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
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

export default function NewEpisodeScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { startEpisode, addIntensityReading, updateEpisode } = useEpisodeStore();
  const episodeId = route.params?.episodeId;
  const isEditing = !!episodeId;

  const scrollViewRef = useRef<ScrollView>(null);
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [intensity, setIntensity] = useState(3);
  const [locations, setLocations] = useState<PainLocation[]>([]);
  const [qualities, setQualities] = useState<PainQuality[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<EpisodeLocation | null>(null);
  const [initialReadingId, setInitialReadingId] = useState<string | null>(null);
  const [initialIntensity, setInitialIntensity] = useState<number>(3);

  // Load episode data if editing
  useEffect(() => {
    const loadEpisode = async () => {
      if (!episodeId) return;

      setLoading(true);
      try {
        const { episodeRepository, intensityRepository } = await import('../database/episodeRepository');
        const episode = await episodeRepository.getById(episodeId);

        if (episode) {
          setStartTime(new Date(episode.startTime));
          setLocations(episode.locations);
          setQualities(episode.qualities);
          setSymptoms(episode.symptoms);
          setTriggers(episode.triggers);
          setNotes(episode.notes || '');
          setGpsLocation(episode.location || null);

          // Load initial intensity reading (first one chronologically)
          const readings = await intensityRepository.getByEpisodeId(episodeId);
          if (readings.length > 0) {
            const firstReading = readings[0]; // readings are sorted by timestamp ASC
            setInitialReadingId(firstReading.id);
            setIntensity(firstReading.intensity);
            setInitialIntensity(firstReading.intensity);
          }
        }
      } catch (error) {
        console.error('Failed to load episode:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEpisode();
  }, [episodeId]);

  // Request location permission and capture location when screen loads (only for new episodes)
  useEffect(() => {
    if (isEditing) return; // Don't override location when editing

    const captureLocation = async () => {
      try {
        const location = await locationService.getLocationWithPermissionRequest();
        if (location) {
          setGpsLocation(location);
          console.log('Location captured:', location);
        }
      } catch (error) {
        console.error('Failed to capture location:', error);
      }
    };

    captureLocation();
  }, [isEditing]);

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
      if (isEditing && episodeId) {
        // Update existing episode
        await updateEpisode(episodeId, {
          startTime: startTime.getTime(),
          locations,
          qualities,
          symptoms,
          triggers,
          notes: notes.trim() || undefined,
        });

        // Update initial intensity reading if it changed
        if (initialReadingId && intensity !== initialIntensity) {
          const { intensityRepository } = await import('../database/episodeRepository');
          await intensityRepository.update(initialReadingId, intensity);

          // Recalculate peak and average intensity
          const readings = await intensityRepository.getByEpisodeId(episodeId);
          const intensities = readings.map(r => r.intensity);
          const peakIntensity = Math.max(...intensities);
          const averageIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;

          await updateEpisode(episodeId, { peakIntensity, averageIntensity });
        }

        // Navigate back to episode detail
        navigation.navigate('EpisodeDetail', { episodeId });
      } else {
        // Create new episode
        const episode = await startEpisode({
          startTime: startTime.getTime(),
          locations,
          qualities,
          symptoms,
          triggers,
          notes: notes.trim() || undefined,
          location: gpsLocation || undefined,
        });

        // Add initial intensity reading
        if (intensity > 0) {
          await addIntensityReading(episode.id, intensity);
        }

        navigation.navigate('MainTabs');
      }
    } catch (error) {
      console.error('Failed to save episode:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Edit Episode' : 'Start Episode'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
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
          <View style={styles.sliderContainer}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.intensityValue, { color: getPainLevel(intensity).color }]}>
                {intensity}/10
              </Text>
              <Text style={styles.intensityLabel}>
                {getPainLevel(intensity).label}
              </Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={10}
              step={1}
              value={intensity}
              onValueChange={setIntensity}
              minimumTrackTintColor={getPainLevel(intensity).color}
              maximumTrackTintColor={theme.border}
              thumbTintColor={getPainLevel(intensity).color}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>0 - No Pain</Text>
              <Text style={styles.sliderLabelText}>10 - Debilitating</Text>
            </View>
            <View style={styles.painDescription}>
              <Text style={styles.painDescriptionText}>
                {getPainLevel(intensity).description}
              </Text>
            </View>
          </View>
        </View>

        {/* Pain Locations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pain Location (Optional)</Text>
          <View style={styles.locationContainer}>
            {/* Left Side Column */}
            <View style={styles.locationColumn}>
              <Text style={styles.columnHeader}>Left Side</Text>
              {PAIN_LOCATIONS.filter(item => item.side === 'left').map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.locationButton,
                    locations.includes(item.value) && styles.locationButtonActive,
                  ]}
                  onPress={() => toggleSelection(item.value, locations, setLocations)}
                >
                  <Text
                    style={[
                      styles.locationText,
                      locations.includes(item.value) && styles.locationTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Right Side Column */}
            <View style={styles.locationColumn}>
              <Text style={styles.columnHeader}>Right Side</Text>
              {PAIN_LOCATIONS.filter(item => item.side === 'right').map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.locationButton,
                    locations.includes(item.value) && styles.locationButtonActive,
                  ]}
                  onPress={() => toggleSelection(item.value, locations, setLocations)}
                >
                  <Text
                    style={[
                      styles.locationText,
                      locations.includes(item.value) && styles.locationTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
            placeholderTextColor={theme.textTertiary}
            value={notes}
            onChangeText={setNotes}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
          />
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving
                ? (isEditing ? 'Saving Changes...' : 'Starting Episode...')
                : (isEditing ? 'Save Changes' : 'Start Episode')
              }
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
