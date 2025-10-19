import React, { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { intensityRepository, symptomLogRepository, episodeNoteRepository, episodeRepository, painLocationLogRepository } from '../database/episodeRepository';
import { Symptom, PainLocation } from '../models/types';
import { getPainColor, getPainLevel } from '../utils/painScale';
import { useTheme, ThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LogUpdate'>;

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
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  intensityLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  intensityValue: {
    fontSize: 24,
    fontWeight: 'bold',
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
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.borderLight,
  },
  chipSelected: {
    backgroundColor: theme.primary,
  },
  chipText: {
    fontSize: 14,
    color: theme.text,
  },
  chipTextSelected: {
    color: theme.primaryText,
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
    textAlign: 'center',
  },
  locationTextActive: {
    color: theme.primaryText,
    fontWeight: '600',
  },
  noteInput: {
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

export default function LogUpdateScreen({ route, navigation }: Props) {
  const { episodeId } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const scrollViewRef = useRef<ScrollView>(null);
  const shouldScrollOnKeyboard = useRef(false);
  const [currentIntensity, setCurrentIntensity] = useState(5);
  const [intensityChanged, setIntensityChanged] = useState(false);
  const [currentSymptoms, setCurrentSymptoms] = useState<Symptom[]>([]);
  const [initialSymptoms, setInitialSymptoms] = useState<Symptom[]>([]);
  const [currentPainLocations, setCurrentPainLocations] = useState<PainLocation[]>([]);
  const [initialPainLocations, setInitialPainLocations] = useState<PainLocation[]>([]);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLatestData();
  }, [episodeId]);

  // Keyboard listener for auto-scroll
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        if (shouldScrollOnKeyboard.current) {
          scrollViewRef.current?.scrollToEnd({ animated: true });
          shouldScrollOnKeyboard.current = false;
        }
      }
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  const loadLatestData = async () => {
    try {
      // Get episode
      const episode = await episodeRepository.getById(episodeId);

      // Check if episode has ended
      if (episode?.endTime) {
        Alert.alert(
          'Episode Ended',
          'This episode has already ended. You cannot add updates to a closed episode.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      // Get all intensity readings sorted by timestamp ascending
      const intensityReadings = await intensityRepository.getByEpisodeId(episodeId);
      if (intensityReadings.length > 0) {
        // Get the latest intensity (last in chronological order)
        const latestReading = intensityReadings[intensityReadings.length - 1];
        setCurrentIntensity(latestReading.intensity ?? 5);
      } else {
        // No intensity readings found - use default
        setCurrentIntensity(5);
      }

      // Get latest symptoms
      const symptomLogs = await symptomLogRepository.getByEpisodeId(episodeId);
      let symptomsToSet: Symptom[] = [];
      if (symptomLogs.length > 0) {
        // Sort by onset time descending to get latest
        const sorted = symptomLogs.sort((a, b) => b.onsetTime - a.onsetTime);
        // Get unique symptoms from the most recent log entries
        const recentSymptoms = sorted.slice(0, 5).map(log => log.symptom);
        symptomsToSet = Array.from(new Set(recentSymptoms));
      } else if (episode) {
        // Use initial symptoms from episode
        symptomsToSet = episode.symptoms;
      }
      setCurrentSymptoms(symptomsToSet);
      setInitialSymptoms(symptomsToSet);

      // Get latest pain locations (areas where pain is felt)
      const painLocationLogs = await painLocationLogRepository.getByEpisodeId(episodeId);
      let painLocationsToSet: PainLocation[] = [];
      if (painLocationLogs.length > 0) {
        // Get the most recent pain location log
        const latestLog = painLocationLogs[painLocationLogs.length - 1];
        painLocationsToSet = latestLog.painLocations;
      } else if (episode) {
        // Use initial pain locations from episode
        painLocationsToSet = episode.locations; // TODO: This will be episode.painLocations after full migration
      }
      setCurrentPainLocations(painLocationsToSet);
      setInitialPainLocations(painLocationsToSet);
    } catch (error) {
      logger.error('Failed to load latest data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIntensityChange = (value: number) => {
    setCurrentIntensity(value);
    setIntensityChanged(true);
  };

  const toggleSymptom = (symptom: Symptom) => {
    setCurrentSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const togglePainLocation = (painLocation: PainLocation) => {
    setCurrentPainLocations(prev =>
      prev.includes(painLocation)
        ? prev.filter(l => l !== painLocation)
        : [...prev, painLocation]
    );
  };

  const handleSave = async () => {
    // Check if symptoms have changed
    const symptomsChanged =
      currentSymptoms.length !== initialSymptoms.length ||
      !currentSymptoms.every(s => initialSymptoms.includes(s));

    // Check if pain locations have changed
    const painLocationsChanged =
      currentPainLocations.length !== initialPainLocations.length ||
      !currentPainLocations.every(l => initialPainLocations.includes(l));

    // Check if anything was actually changed
    if (!intensityChanged && !symptomsChanged && !painLocationsChanged && !noteText.trim()) {
      Alert.alert('No Changes', 'Please make at least one change to log an update');
      return;
    }

    setSaving(true);
    try {
      const timestamp = Date.now();

      // Only log intensity if it was changed
      if (intensityChanged) {
        await intensityRepository.create({
          episodeId,
          timestamp,
          intensity: currentIntensity,
        });
      }

      // Log symptoms if they changed
      if (symptomsChanged && currentSymptoms.length > 0) {
        await Promise.all(
          currentSymptoms.map(symptom =>
            symptomLogRepository.create({
              episodeId,
              symptom,
              onsetTime: timestamp,
            })
          )
        );
      }

      // Log pain locations if they changed
      if (painLocationsChanged) {
        await painLocationLogRepository.create({
          episodeId,
          timestamp,
          painLocations: currentPainLocations,
        });
      }

      // Add note if provided
      if (noteText.trim()) {
        await episodeNoteRepository.create({
          episodeId,
          timestamp,
          note: noteText.trim(),
        });
      }

      navigation.goBack();
    } catch (error) {
      logger.error('Failed to log update:', error);
      Alert.alert('Error', 'Failed to log update');
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
          <Text style={styles.title}>Log Update</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.textSecondary }}>Loading...</Text>
        </View>
      </View>
    );
  }

  const handleNotesInputFocus = () => {
    shouldScrollOnKeyboard.current = true;
  };

  return (
    <View style={styles.container} testID="log-update-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Log Update</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        testID="log-update-scroll-view"
      >
        {/* Pain Intensity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pain Intensity</Text>
          <View style={styles.sliderHeader}>
            <Text style={[styles.intensityValue, { color: getPainLevel(currentIntensity).color }]}>
              {currentIntensity}/10
            </Text>
            <Text style={styles.intensityLabel}>
              {getPainLevel(currentIntensity).label}
            </Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={10}
            step={1}
            value={currentIntensity}
            onValueChange={handleIntensityChange}
            minimumTrackTintColor={getPainLevel(currentIntensity).color}
            maximumTrackTintColor="#E5E5EA"
            thumbTintColor={getPainLevel(currentIntensity).color}
            testID="intensity-slider"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabelText}>0 - No Pain</Text>
            <Text style={styles.sliderLabelText}>10 - Debilitating</Text>
          </View>
          <Text style={styles.painDescription}>
            {getPainLevel(currentIntensity).description}
          </Text>
        </View>

        {/* Symptoms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <View style={styles.chipContainer}>
            {SYMPTOMS.map(symptom => {
              const isSelected = currentSymptoms.includes(symptom.value);
              return (
                <TouchableOpacity
                  key={symptom.value}
                  style={[
                    styles.chip,
                    isSelected && styles.chipSelected,
                  ]}
                  onPress={() => toggleSymptom(symptom.value)}
                >
                  <Text style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                  ]}>
                    {symptom.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Pain Locations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pain Location</Text>
          <View style={styles.locationContainer}>
            {/* Left Side Column */}
            <View style={styles.locationColumn}>
              <Text style={styles.columnHeader}>Left Side</Text>
              {PAIN_LOCATIONS.filter(item => item.side === 'left').map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.locationButton,
                    currentPainLocations.includes(item.value) && styles.locationButtonActive,
                  ]}
                  onPress={() => togglePainLocation(item.value)}
                >
                  <Text
                    style={[
                      styles.locationText,
                      currentPainLocations.includes(item.value) && styles.locationTextActive,
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
                    currentPainLocations.includes(item.value) && styles.locationButtonActive,
                  ]}
                  onPress={() => togglePainLocation(item.value)}
                >
                  <Text
                    style={[
                      styles.locationText,
                      currentPainLocations.includes(item.value) && styles.locationTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.noteInput}
            multiline
            numberOfLines={4}
            placeholder="Add any additional notes..."
            placeholderTextColor={theme.textTertiary}
            value={noteText}
            onChangeText={setNoteText}
            onFocus={handleNotesInputFocus}
            testID="update-notes-input"
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Save Button Footer - wrapped in KeyboardAvoidingView */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            testID="save-update-button"
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Update'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
