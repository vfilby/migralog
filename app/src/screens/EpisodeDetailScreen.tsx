/**
 * Episode Detail Screen - Refactored version
 * 
 * This screen has been refactored from 1,641 lines to ~500 lines by extracting:
 * - EpisodeStatusCard: Basic episode info and action buttons
 * - EpisodeInfoCards: Pain qualities and triggers display
 * - EpisodeTimeline: Timeline visualization with events
 * - EpisodeActions: End episode action buttons
 * - EpisodeModals: Map and time picker modals
 * 
 * The core logic and data fetching remains in this component while
 * presentation concerns have been extracted to focused components.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Alert,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Episode, IntensityReading, SymptomLog, MedicationDose, Medication, EpisodeNote, PainLocationLog, PainLocation } from '../models/types';
import { useEpisodeStore } from '../store/episodeStore';
import { useMedicationStore } from '../store/medicationStore';
import { useTheme } from '../theme';
import { locationService } from '../services/locationService';
import { 
  EpisodeStatusCard, 
  EpisodeInfoCards,
  EpisodeTimeline,
  EpisodeActions,
  EpisodeModals,
} from '../components/episode';
import { format } from 'date-fns';
import { useMedicationStatusStyles } from '../utils/medicationStyling';

// Type definitions
type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

type SymptomChange = {
  symptom: string;
  changeType: 'added' | 'removed';
};

type PainLocationChange = {
  location: PainLocation;
  changeType: 'added' | 'removed' | 'unchanged';
};

type TimelineEvent = {
  id: string;
  timestamp: number;
  type: 'intensity' | 'note' | 'medication' | 'symptom' | 'symptom_initial' | 'pain_location' | 'pain_location_initial' | 'end';
  data: IntensityReading | EpisodeNote | MedicationDoseWithDetails | SymptomLog | SymptomChange[] | PainLocationLog | PainLocationChange[] | null;
};

type DayGroup = {
  date: number;
  dateLabel: string;
  events: TimelineEvent[];
};

interface Props {
  route: {
    params: {
      episodeId: string;
    };
  };
  navigation: any;
}

export default function EpisodeDetailScreen({ route, navigation }: Props) {
  const { episodeId } = route.params;
  const { theme } = useTheme();
  const { getStatusStyle } = useMedicationStatusStyles();
  const styles = createStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const { endEpisode, updateEpisode, reopenEpisode } = useEpisodeStore();
  
  // State
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [intensityReadings, setIntensityReadings] = useState<IntensityReading[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [painLocationLogs, setPainLocationLogs] = useState<PainLocationLog[]>([]);
  const [medications, setMedications] = useState<MedicationDoseWithDetails[]>([]);
  const [episodeNotes, setEpisodeNotes] = useState<EpisodeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeline, setTimeline] = useState<DayGroup[]>([]);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [customEndTime, setCustomEndTime] = useState<number>(Date.now());
  const [locationAddress, setLocationAddress] = useState<string | null>(null);

  // Calculate sparkline width
  const sparklineWidth = screenWidth - 64; // Account for padding and margins

  // Navigation setup
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ paddingLeft: 16 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
      ),
      headerRight: () => episode && !episode.endTime ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('NewEpisode', { episodeId })}
          style={{ paddingRight: 16 }}
        >
          <Text style={{ color: theme.primary, fontSize: 17 }}>Edit</Text>
        </TouchableOpacity>
      ) : null,
    });
  }, [navigation, episode, theme]);

  // Load episode data
  const loadEpisodeData = useCallback(async () => {
    try {
      // Import database repositories
      const episodeRepository = require('../database/episodeRepository').episodeRepository;
      const medicationRepository = require('../database/medicationRepository').medicationRepository;

      // Load episode
      const loadedEpisode = await episodeRepository.findById(episodeId);
      if (!loadedEpisode) {
        navigation.goBack();
        return;
      }
      setEpisode(loadedEpisode);

      // Load related data
      const [readings, symptoms, locations, doses, notes] = await Promise.all([
        episodeRepository.getIntensityReadings(episodeId),
        episodeRepository.getSymptomLogs(episodeId),
        episodeRepository.getPainLocationLogs(episodeId),
        episodeRepository.getMedicationDoses(episodeId),
        episodeRepository.getNotes(episodeId),
      ]);

      setIntensityReadings(readings);
      setSymptomLogs(symptoms);
      setPainLocationLogs(locations);
      setEpisodeNotes(notes);

      // Load medication details for doses
      const medicationIds = [...new Set(doses.map(d => d.medicationId))];
      const medicationMap = new Map<string, Medication>();
      
      for (const medId of medicationIds) {
        const med = await medicationRepository.findById(medId);
        if (med) {
          medicationMap.set(medId, med);
        }
      }

      const dosesWithDetails: MedicationDoseWithDetails[] = doses.map(dose => ({
        ...dose,
        medication: medicationMap.get(dose.medicationId),
      }));

      setMedications(dosesWithDetails);

      // Reverse geocode location
      if (loadedEpisode.location) {
        try {
          const address = await getReverseGeocodingDescription(
            loadedEpisode.location.latitude,
            loadedEpisode.location.longitude
          );
          setLocationAddress(address);
        } catch (error) {
          console.error('Failed to reverse geocode:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load episode data:', error);
      Alert.alert('Error', 'Failed to load episode details');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [episodeId, navigation]);

  // Build timeline
  useEffect(() => {
    if (!episode) return;

    const buildTimeline = () => {
      const allEvents: TimelineEvent[] = [];

      // Add intensity readings
      intensityReadings.forEach(reading => {
        allEvents.push({
          id: `intensity-${reading.id}`,
          timestamp: reading.timestamp,
          type: 'intensity',
          data: reading,
        });
      });

      // Add notes
      if (episode.notes) {
        allEvents.push({
          id: 'episode-summary',
          timestamp: episode.startTime,
          type: 'note',
          data: { id: 'episode-summary', note: episode.notes } as EpisodeNote,
        });
      }

      episodeNotes.forEach(note => {
        allEvents.push({
          id: `note-${note.id}`,
          timestamp: note.timestamp,
          type: 'note',
          data: note,
        });
      });

      // Process symptoms
      const initialSymptoms = episode.symptoms || [];
      if (initialSymptoms.length > 0) {
        allEvents.push({
          id: 'symptom-initial',
          timestamp: episode.startTime,
          type: 'symptom_initial',
          data: initialSymptoms.map(s => ({ symptom: s, changeType: 'added' })) as SymptomChange[],
        });
      }

      // Process symptom changes
      symptomLogs.forEach((log, index) => {
        const prevSymptoms = index === 0 ? initialSymptoms : symptomLogs[index - 1].symptoms;
        const changes: SymptomChange[] = [];
        
        // Find added symptoms
        log.symptoms.forEach(symptom => {
          if (!prevSymptoms.includes(symptom)) {
            changes.push({ symptom, changeType: 'added' });
          }
        });
        
        // Find removed symptoms
        prevSymptoms.forEach(symptom => {
          if (!log.symptoms.includes(symptom)) {
            changes.push({ symptom, changeType: 'removed' });
          }
        });

        if (changes.length > 0) {
          allEvents.push({
            id: `symptom-${log.id}`,
            timestamp: log.timestamp,
            type: 'symptom',
            data: changes,
          });
        }
      });

      // Process pain locations
      const initialLocations = episode.painLocations || [];
      if (initialLocations.length > 0) {
        allEvents.push({
          id: 'pain-location-initial',
          timestamp: episode.startTime,
          type: 'pain_location_initial',
          data: initialLocations.map(l => ({ location: l, changeType: 'added' })) as PainLocationChange[],
        });
      }

      // Process pain location changes
      painLocationLogs.forEach((log, index) => {
        const prevLocations = index === 0 ? initialLocations : painLocationLogs[index - 1].locations;
        const changes: PainLocationChange[] = [];
        
        // Find added locations
        log.locations.forEach(location => {
          if (!prevLocations.includes(location)) {
            changes.push({ location, changeType: 'added' });
          }
        });
        
        // Find removed locations
        prevLocations.forEach(location => {
          if (!log.locations.includes(location)) {
            changes.push({ location, changeType: 'removed' });
          }
        });

        if (changes.length > 0) {
          allEvents.push({
            id: `pain-location-${log.id}`,
            timestamp: log.timestamp,
            type: 'pain_location',
            data: changes,
          });
        }
      });

      // Add medications
      medications.forEach(dose => {
        allEvents.push({
          id: `medication-${dose.id}`,
          timestamp: dose.timestamp,
          type: 'medication',
          data: dose,
        });
      });

      // Add episode end
      if (episode.endTime) {
        allEvents.push({
          id: 'episode-end',
          timestamp: episode.endTime,
          type: 'end',
          data: null,
        });
      }

      // Sort events by timestamp
      allEvents.sort((a, b) => a.timestamp - b.timestamp);

      // Group events by day
      const dayGroups = new Map<string, DayGroup>();
      
      allEvents.forEach(event => {
        const date = new Date(event.timestamp);
        date.setHours(0, 0, 0, 0);
        const dateKey = date.toISOString();
        
        if (!dayGroups.has(dateKey)) {
          dayGroups.set(dateKey, {
            date: date.getTime(),
            dateLabel: format(date, 'EEE, MMM d'),
            events: [],
          });
        }
        
        dayGroups.get(dateKey)!.events.push(event);
      });

      // Convert to array and sort
      const sortedDayGroups = Array.from(dayGroups.values()).sort((a, b) => a.date - b.date);
      
      setTimeline(sortedDayGroups);
    };

    buildTimeline();
  }, [episode, intensityReadings, symptomLogs, painLocationLogs, medications, episodeNotes]);

  // Initial load
  useEffect(() => {
    loadEpisodeData();
  }, [loadEpisodeData]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEpisodeData();
  }, [loadEpisodeData]);

  // Calculate duration
  const calculateDuration = () => {
    if (!episode) return 0;
    const end = episode.endTime || Date.now();
    return Math.floor((end - episode.startTime) / 1000 / 60);
  };

  // Action handlers
  const endEpisodeNow = async () => {
    if (!episode) return;
    Alert.alert(
      'End Episode',
      'Are you sure you want to end this episode now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Episode',
          onPress: async () => {
            await endEpisode(episodeId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleCustomTimeAction = async () => {
    if (!episode || !customEndTime) return;

    if (episode.endTime) {
      // Update existing end time
      await updateEpisode(episodeId, { endTime: customEndTime });
      setEpisode({ ...episode, endTime: customEndTime });
      setShowEndTimePicker(false);
    } else {
      // End episode with custom time
      await endEpisode(episodeId, customEndTime);
      navigation.goBack();
    }
  };

  const handleOpenMap = () => {
    if (episode?.location) {
      openAddressInMaps(episode.location.latitude, episode.location.longitude);
    }
  };

  // Long press handlers
  const handleIntensityLongPress = (reading: IntensityReading) => {
    Alert.alert(
      'Intensity Reading',
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => navigation.navigate('EditIntensityReading', { readingId: reading.id }),
        },
      ]
    );
  };

  const handleNoteLongPress = (note: EpisodeNote) => {
    Alert.alert(
      'Note',
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit', onPress: () => navigation.navigate('EditEpisodeNote', { noteId: note.id }) },
      ]
    );
  };

  const handleMedicationLongPress = (dose: MedicationDoseWithDetails) => {
    if (dose.status === 'pending' || dose.status === 'skipped') {
      Alert.alert(
        'Scheduled Medication',
        `This medication is ${dose.status}. You can edit it from the medication schedule.`,
        [
          { text: 'OK', style: 'default' },
          { text: 'Go to Schedule', onPress: () => navigation.navigate('Medications') },
        ]
      );
    } else {
      Alert.alert(
        'Medication Dose',
        'What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit', onPress: () => navigation.navigate('EditMedicationDose', { doseId: dose.id }) },
        ]
      );
    }
  };

  const handleEpisodeEndLongPress = () => {
    if (!episode?.endTime) return;
    
    Alert.alert(
      'Episode End Time',
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit End Time',
          onPress: () => {
            setCustomEndTime(episode.endTime!);
            setShowEndTimePicker(true);
          },
        },
        {
          text: 'Reopen Episode',
          style: 'destructive',
          onPress: async () => {
            await reopenEpisode(episodeId);
            loadEpisodeData();
          },
        },
      ]
    );
  };

  if (loading || !episode) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Episode Status Card */}
        <EpisodeStatusCard
          episode={episode}
          duration={calculateDuration()}
          locationAddress={locationAddress}
          onOpenMap={handleOpenMap}
          onNavigateToLogUpdate={() => navigation.navigate('LogUpdate', { episodeId })}
          onNavigateToLogMedication={() => navigation.navigate('LogMedication', { episodeId })}
        />

        {/* Episode Info Cards */}
        <EpisodeInfoCards
          qualities={episode.qualities}
          triggers={episode.triggers}
        />

        {/* Timeline */}
        <EpisodeTimeline
          timeline={timeline}
          intensityReadings={intensityReadings}
          episode={episode}
          sparklineWidth={sparklineWidth}
          onIntensityLongPress={handleIntensityLongPress}
          onNoteLongPress={handleNoteLongPress}
          onMedicationLongPress={handleMedicationLongPress}
          onEpisodeEndLongPress={handleEpisodeEndLongPress}
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* End Episode Actions */}
      <EpisodeActions
        episode={episode}
        onEndEpisodeNow={endEpisodeNow}
        onShowCustomEndTime={() => {
          setCustomEndTime(Date.now());
          setShowEndTimePicker(true);
        }}
      />

      {/* Modals */}
      <EpisodeModals
        showMapModal={showMapModal}
        showEndTimePicker={showEndTimePicker}
        episode={episode}
        locationAddress={locationAddress}
        customEndTime={customEndTime}
        onCloseMapModal={() => setShowMapModal(false)}
        onCloseEndTimePicker={() => setShowEndTimePicker(false)}
        onCustomTimeChange={setCustomEndTime}
        onCustomTimeAction={handleCustomTimeAction}
      />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
});