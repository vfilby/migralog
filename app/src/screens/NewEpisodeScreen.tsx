import React, { useState, useRef, useEffect } from 'react';
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
import { useEpisodeStore } from '../store/episodeStore';
import { PainLocation, PainQuality, Symptom, Trigger, EpisodeLocation } from '../models/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { getPainLevel } from '../utils/painScale';
import { locationService } from '../services/locationService';
import { validateEpisodeEndTime } from '../utils/episodeValidation';
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

export default function NewEpisodeScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { startEpisode, updateEpisode } = useEpisodeStore();
  const episodeId = route.params?.episodeId;
  const isEditing = !!episodeId;

  const scrollViewRef = useRef<ScrollView>(null);
  const shouldScrollOnKeyboard = useRef(false);
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [intensity, setIntensity] = useState(3);
  const [locations, setLocations] = useState<PainLocation[]>([]);
  const [qualities, setQualities] = useState<PainQuality[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<EpisodeLocation | null>(null);
  const [initialReadingId, setInitialReadingId] = useState<string | null>(null);
  const [initialIntensity, setInitialIntensity] = useState<number>(3);
  const [originalStartTime, setOriginalStartTime] = useState<number | null>(null);

  // Load episode data if editing
  useEffect(() => {
    const loadEpisode = async () => {
      if (!episodeId) return;

      try {
        const { episodeRepository, intensityRepository } = await import('../database/episodeRepository');
        const episode = await episodeRepository.getById(episodeId);

        if (episode) {
          setStartTime(new Date(episode.startTime));
          setOriginalStartTime(episode.startTime); // Store original for calculating delta
          setEndTime(episode.endTime ? new Date(episode.endTime) : null);
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
        logger.error('Failed to load episode:', error);
      }
    };

    loadEpisode();
  }, [episodeId]);

  // Request location permission and capture location when screen loads (only for new episodes)
  useEffect(() => {
    if (isEditing) return; // Don't override location when editing

    const captureLocation = async () => {
      try {
        // Silently attempt to get location - don't show errors to user
        const location = await locationService.getCurrentLocation();
        if (location) {
          setGpsLocation(location);
          logger.log('Location captured:', location);
        } else {
          logger.log('Location not available (no permission or error)');
        }
      } catch (error) {
        // Silent failure - location is optional
        logger.log('Failed to capture location:', error);
      }
    };

    captureLocation();
  }, [isEditing]);

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

  const handleNotesInputFocus = () => {
    shouldScrollOnKeyboard.current = true;
  };

  const toggleSelection = <T,>(item: T, list: T[], setList: (list: T[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSave = async () => {
    logger.log('[NewEpisode] handleSave called');
    logger.log('[NewEpisode] isEditing:', isEditing, 'episodeId:', episodeId);

    // Validate end time if provided
    if (endTime) {
      const validation = validateEpisodeEndTime(startTime.getTime(), endTime.getTime());
      if (!validation.isValid) {
        Alert.alert('Invalid End Time', validation.error!);
        return;
      }
    }

    setSaving(true);
    try {
      if (isEditing && episodeId) {
        logger.log('[NewEpisode] Updating existing episode...');

        // Check if start time changed to update initial intensity reading timestamp
        const startTimeChanged = originalStartTime && startTime.getTime() !== originalStartTime;

        // Update existing episode
        await updateEpisode(episodeId, {
          startTime: startTime.getTime(),
          endTime: endTime ? endTime.getTime() : undefined,
          locations,
          qualities,
          symptoms,
          triggers,
          notes: notes.trim() || undefined,
        });
        logger.log('[NewEpisode] Episode updated');

        // Update all timeline entries with matching timestamp if start time changed
        if (startTimeChanged) {
          logger.log('[NewEpisode] Start time changed, updating all timeline entries with original start time...');
          const { intensityRepository, episodeNoteRepository } = await import('../database/episodeRepository');

          // Update intensity readings
          const intensityChanges = await intensityRepository.updateTimestampsForEpisode(
            episodeId,
            originalStartTime,
            startTime.getTime()
          );
          logger.log(`[NewEpisode] Updated ${intensityChanges} intensity reading(s)`);

          // Update episode notes
          const notesChanges = await episodeNoteRepository.updateTimestampsForEpisode(
            episodeId,
            originalStartTime,
            startTime.getTime()
          );
          logger.log(`[NewEpisode] Updated ${notesChanges} episode note(s)`);
        }

        // Update initial intensity reading if it changed
        if (initialReadingId && intensity !== initialIntensity) {
          logger.log('[NewEpisode] Updating intensity reading...');
          const { intensityRepository } = await import('../database/episodeRepository');
          await intensityRepository.update(initialReadingId, { intensity });

          logger.log('[NewEpisode] Intensity updated');
        }

        logger.log('[NewEpisode] Dismissing edit modal...');
        setSaving(false);
        navigation.goBack();
      } else {
        logger.log('[NewEpisode] Creating new episode...');
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
        logger.log('[NewEpisode] Episode created:', episode.id);

        // Add initial intensity reading with the same timestamp as episode start
        if (intensity > 0) {
          logger.log('[NewEpisode] Adding intensity reading...');
          const { intensityRepository } = await import('../database/episodeRepository');
          await intensityRepository.create({
            episodeId: episode.id,
            timestamp: episode.startTime, // Use episode start time for initial reading
            intensity,
          });
          logger.log('[NewEpisode] Intensity reading added');
        }

        logger.log('[NewEpisode] Dismissing new episode modal...');
        setSaving(false);
        navigation.goBack();
      }
    } catch (error) {
      logger.error('[NewEpisode] CATCH BLOCK - Failed to save episode:', error);
      logger.error('[NewEpisode] Error type:', typeof error);
      logger.error('[NewEpisode] Error message:', (error as Error).message);
      logger.error('[NewEpisode] Error stack:', (error as Error).stack);
      setSaving(false);
      Alert.alert('Error', `Failed to save episode: ${(error as Error).message || 'Unknown error'}`);
    }
  };

  return (
    <View style={styles.container} testID="new-episode-screen">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityHint="Discards changes and returns to the previous screen"
        >
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Edit Episode' : 'Start Episode'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1, backgroundColor: theme.background }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        testID="new-episode-scroll-view"
      >
        {/* Start Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Start Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Episode start time, ${format(startTime, 'MMM d, yyyy h:mm a')}`}
            accessibilityHint="Opens date and time picker to change the episode start time"
          >
            <Text style={styles.timeText}>{format(startTime, 'MMM d, yyyy h:mm a')}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={startTime || new Date()}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setStartTime(date);
              }}
            />
          )}
        </View>

        {/* End Time - Only show when editing an episode that has ended */}
        {isEditing && endTime && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>End Time</Text>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowEndDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Episode end time, ${format(endTime, 'MMM d, yyyy h:mm a')}`}
              accessibilityHint="Opens date and time picker to change the episode end time"
            >
              <Text style={styles.timeText}>{format(endTime, 'MMM d, yyyy h:mm a')}</Text>
            </TouchableOpacity>
            {showEndDatePicker && (
              <DateTimePicker
                value={endTime || new Date()}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowEndDatePicker(Platform.OS === 'ios');
                  if (date) setEndTime(date);
                }}
                minimumDate={startTime}
                maximumDate={new Date()}
              />
            )}
          </View>
        )}

        {/* Initial Intensity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Initial Pain Intensity</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.intensityValue, { color: getPainLevel(intensity).color }]}>
                {intensity}
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
                    locations.includes(item.value) && styles.locationButtonActive,
                  ]}
                  onPress={() => toggleSelection(item.value, locations, setLocations)}
                  accessibilityRole="button"
                  accessibilityLabel={`Left ${item.label}`}
                  accessibilityHint={locations.includes(item.value) ? `Tap to deselect left ${item.label.toLowerCase()} as a pain location` : `Tap to select left ${item.label.toLowerCase()} as a pain location`}
                  accessibilityState={{ selected: locations.includes(item.value) }}
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
                  accessibilityRole="button"
                  accessibilityLabel={`Right ${item.label}`}
                  accessibilityHint={locations.includes(item.value) ? `Tap to deselect right ${item.label.toLowerCase()} as a pain location` : `Tap to select right ${item.label.toLowerCase()} as a pain location`}
                  accessibilityState={{ selected: locations.includes(item.value) }}
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
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <View style={styles.chipContainer}>
            {SYMPTOMS.map(item => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.chip,
                  symptoms.includes(item.value) && styles.chipActive,
                ]}
                onPress={() => toggleSelection(item.value, symptoms, setSymptoms)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={symptoms.includes(item.value) ? `Tap to deselect ${item.label.toLowerCase()} as a symptom` : `Tap to select ${item.label.toLowerCase()} as a symptom`}
                accessibilityState={{ selected: symptoms.includes(item.value) }}
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
          <Text style={styles.sectionTitle}>Possible Triggers</Text>
          <View style={styles.chipContainer}>
            {TRIGGERS.map(item => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.chip,
                  triggers.includes(item.value) && styles.chipActive,
                ]}
                onPress={() => toggleSelection(item.value, triggers, setTriggers)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={triggers.includes(item.value) ? `Tap to deselect ${item.label.toLowerCase()} as a trigger` : `Tap to select ${item.label.toLowerCase()} as a trigger`}
                accessibilityState={{ selected: triggers.includes(item.value) }}
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
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            numberOfLines={4}
            placeholder="Any additional details..."
            placeholderTextColor={theme.textTertiary}
            value={notes}
            onChangeText={setNotes}
            onFocus={handleNotesInputFocus}
            blurOnSubmit={true}
            returnKeyType="done"
            testID="episode-notes-input"
          />
        </View>

        {/* Bottom spacer to ensure content is scrollable above footer */}
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
            testID="save-episode-button"
            accessibilityRole="button"
            accessibilityLabel={saving
              ? (isEditing ? 'Saving Changes' : 'Starting Episode')
              : (isEditing ? 'Save Changes' : 'Start Episode')
            }
            accessibilityHint={isEditing ? 'Saves changes to this episode and returns to the previous screen' : 'Creates a new episode with the entered details and returns to the previous screen'}
            accessibilityState={{ disabled: saving }}
          >
            <Text style={styles.saveButtonText}>
              {saving
                ? (isEditing ? 'Saving Changes...' : 'Starting Episode...')
                : (isEditing ? 'Save Changes' : 'Start Episode')
              }
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
