import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import MapView, { Marker } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useEpisodeStore } from '../store/episodeStore';
import { episodeRepository, intensityRepository, symptomLogRepository, episodeNoteRepository } from '../database/episodeRepository';
import { medicationDoseRepository, medicationRepository } from '../database/medicationRepository';
import { Episode, IntensityReading, SymptomLog, MedicationDose, Medication, EpisodeNote } from '../models/types';
import { format, differenceInMinutes } from 'date-fns';
import { getPainColor, getPainLevel } from '../utils/painScale';
import { validateEpisodeEndTime } from '../utils/episodeValidation';
import { locationService } from '../services/locationService';
import { useTheme, ThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EpisodeDetail'>;

type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

type SymptomChange = {
  symptom: string;
  changeType: 'added' | 'removed';
};

type TimelineEvent = {
  id: string;
  timestamp: number;
  type: 'intensity' | 'note' | 'medication' | 'symptom' | 'symptom_initial' | 'end';
  data: IntensityReading | EpisodeNote | MedicationDoseWithDetails | SymptomLog | SymptomChange[] | null;
};

type GroupedTimelineEvent = {
  timestamp: number;
  events: TimelineEvent[];
};

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
  backButton: {
    fontSize: 17,
    color: theme.primary,
    width: 60,
  },
  editButton: {
    fontSize: 17,
    color: theme.primary,
    fontWeight: '600',
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
    padding: 16,
    borderRadius: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  ongoingBadge: {
    backgroundColor: theme.ongoing,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ongoingText: {
    color: theme.ongoingText,
    fontSize: 12,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  detailLabel: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  locationLink: {
    color: theme.primary,
    fontWeight: '600',
  },
  intensityValue: {
    color: theme.danger,
    fontWeight: '600',
  },
  intensityUpdateSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
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
  chipText: {
    fontSize: 14,
    color: theme.text,
  },
  symptomAddedChip: {
    backgroundColor: '#E8F5E9', // Light green background for added symptoms
  },
  symptomAddedText: {
    color: '#2E7D32', // Dark green text for added symptoms
    fontWeight: '600',
  },
  symptomRemovedChip: {
    backgroundColor: '#FFEBEE', // Light red background for removed symptoms
  },
  symptomRemovedText: {
    color: '#C62828', // Dark red text for removed symptoms
    fontWeight: '600',
  },
  locationGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  locationSide: {
    flex: 1,
  },
  locationSideLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  locationItem: {
    fontSize: 15,
    color: theme.text,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 22,
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
  updateActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  saveIntensityButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  saveIntensityButtonText: {
    color: theme.primaryText,
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: theme.card,
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  endButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  endButton: {
    flex: 1,
    backgroundColor: theme.danger,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  endButtonText: {
    color: theme.dangerText,
    fontSize: 17,
    fontWeight: '600',
  },
  endCustomButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.danger,
  },
  endCustomButtonText: {
    color: theme.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalHeader: {
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
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  modalCloseButton: {
    fontSize: 17,
    color: theme.primary,
    fontWeight: '600',
  },
  modalMap: {
    flex: 1,
  },
  modalInfo: {
    backgroundColor: theme.card,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  modalLocationText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalAccuracyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
  },
  actionButtonText: {
    color: theme.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  timelineContainer: {
    paddingLeft: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    paddingBottom: 24,
  },
  timelineLeft: {
    width: 80,
    paddingRight: 16,
    alignItems: 'flex-end',
  },
  timelineTime: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  timelineCenter: {
    width: 32,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.primary,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.borderLight,
    marginTop: 4,
  },
  timelineRight: {
    flex: 1,
    paddingLeft: 16,
  },
  timelineEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  timelineEventContent: {
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  timelineNoteText: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 20,
    marginTop: 4,
  },
  timelineIntensityBar: {
    height: 24,
    backgroundColor: theme.borderLight,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 4,
  },
  timelineIntensityBarFill: {
    height: '100%',
  },
  timelineIntensityValue: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  deleteEventButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
  },
  deleteEventButtonText: {
    fontSize: 14,
    color: theme.danger,
    fontWeight: '500',
  },
  noteInput: {
    backgroundColor: theme.borderLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: theme.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
});

export default function EpisodeDetailScreen({ route, navigation }: Props) {
  const { episodeId } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { endEpisode, addIntensityReading } = useEpisodeStore();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [intensityReadings, setIntensityReadings] = useState<IntensityReading[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [medications, setMedications] = useState<MedicationDoseWithDetails[]>([]);
  const [episodeNotes, setEpisodeNotes] = useState<EpisodeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [customEndTime, setCustomEndTime] = useState<number>(Date.now());

  useFocusEffect(
    React.useCallback(() => {
      loadEpisodeData();
    }, [episodeId])
  );

  const loadEpisodeData = async () => {
    try {
      const [ep, readings, symptoms, meds, notes] = await Promise.all([
        episodeRepository.getById(episodeId),
        intensityRepository.getByEpisodeId(episodeId),
        symptomLogRepository.getByEpisodeId(episodeId),
        medicationDoseRepository.getByEpisodeId(episodeId),
        episodeNoteRepository.getByEpisodeId(episodeId),
      ]);

      // Load medication details for each dose
      const medsWithDetails = await Promise.all(
        meds.map(async (dose) => {
          const medication = await medicationRepository.getById(dose.medicationId);
          return { ...dose, medication: medication || undefined };
        })
      );

      setEpisode(ep);
      setIntensityReadings(readings);
      setSymptomLogs(symptoms);
      setMedications(medsWithDetails);
      setEpisodeNotes(notes);

      // Reverse geocode location if available
      if (ep?.location) {
        const address = await locationService.reverseGeocode(
          ep.location.latitude,
          ep.location.longitude
        );
        setLocationAddress(address);
      }
    } catch (error) {
      console.error('Failed to load episode:', error);
    } finally {
      setLoading(false);
    }
  };

  const endEpisodeNow = async () => {
    if (episode) {
      await endEpisode(episode.id, Date.now());
      navigation.goBack();
    }
  };

  const endEpisodeWithCustomTime = async () => {
    if (episode) {
      // Validate that end time is not before episode start
      const validation = validateEpisodeEndTime(episode.startTime, customEndTime);
      if (!validation.isValid) {
        Alert.alert('Invalid Time', validation.error!);
        return;
      }

      await endEpisode(episode.id, customEndTime);
      setShowEndTimePicker(false);
      navigation.goBack();
    }
  };

  const handleDeleteNote = (noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await episodeNoteRepository.delete(noteId);
              await loadEpisodeData();
            } catch (error) {
              console.error('Failed to delete note:', error);
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  const handleOpenMap = () => {
    setShowMapModal(true);
  };

  // Build unified timeline
  const buildTimeline = (): GroupedTimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // Add initial symptoms as a timeline event (if episode has symptoms)
    if (episode && episode.symptoms && episode.symptoms.length > 0) {
      const initialSymptomChanges: SymptomChange[] = episode.symptoms.map(symptom => ({
        symptom,
        changeType: 'added' as const,
      }));

      events.push({
        id: 'symptoms-initial',
        timestamp: episode.startTime,
        type: 'symptom_initial',
        data: initialSymptomChanges,
      });
    }

    // Add episode summary note (from episode creation) if it exists
    if (episode && episode.notes) {
      events.push({
        id: 'episode-summary',
        timestamp: episode.startTime,
        type: 'note',
        data: {
          id: 'episode-summary',
          episodeId: episode.id,
          note: episode.notes,
          timestamp: episode.startTime,
        } as EpisodeNote,
      });
    }

    // Add intensity readings
    intensityReadings.forEach(reading => {
      events.push({
        id: `intensity-${reading.id}`,
        timestamp: reading.timestamp,
        type: 'intensity',
        data: reading,
      });
    });

    // Add notes
    episodeNotes.forEach(note => {
      events.push({
        id: `note-${note.id}`,
        timestamp: note.timestamp,
        type: 'note',
        data: note,
      });
    });

    // Add symptom logs with deltas
    // Sort symptom logs by time to calculate deltas correctly
    const sortedSymptomLogs = [...symptomLogs].sort((a, b) => a.onsetTime - b.onsetTime);

    // Track current symptom state
    let currentSymptoms = new Set(episode?.symptoms || []);

    sortedSymptomLogs.forEach(symptomLog => {
      // Determine if this is an addition or removal
      const isAdded = symptomLog.resolutionTime === null || symptomLog.resolutionTime === undefined;
      const symptomChanges: SymptomChange[] = [{
        symptom: symptomLog.symptom,
        changeType: isAdded ? 'added' : 'removed',
      }];

      // Update current state
      if (isAdded) {
        currentSymptoms.add(symptomLog.symptom);
      } else {
        currentSymptoms.delete(symptomLog.symptom);
      }

      events.push({
        id: `symptom-${symptomLog.id}`,
        timestamp: symptomLog.onsetTime,
        type: 'symptom',
        data: symptomChanges,
      });
    });

    // Add medications
    medications.forEach(med => {
      events.push({
        id: `medication-${med.id}`,
        timestamp: med.timestamp,
        type: 'medication',
        data: med,
      });
    });

    // Add end event if episode has ended
    if (episode?.endTime) {
      events.push({
        id: 'end',
        timestamp: episode.endTime,
        type: 'end',
        data: null,
      });
    }

    // Sort by timestamp (oldest first)
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);

    // Group events by timestamp
    const grouped = new Map<number, TimelineEvent[]>();
    sortedEvents.forEach(event => {
      const existing = grouped.get(event.timestamp) || [];
      existing.push(event);
      grouped.set(event.timestamp, existing);
    });

    // Convert map to array
    return Array.from(grouped.entries()).map(([timestamp, events]) => ({
      timestamp,
      events,
    }));
  };

  const renderEventContent = (event: TimelineEvent) => {
    switch (event.type) {
      case 'intensity':
        const reading = event.data as IntensityReading;
        // Check if this is the initial intensity (same timestamp as episode start)
        const isInitialIntensity = episode && reading.timestamp === episode.startTime;
        return (
          <View key={event.id} style={{ marginBottom: 12 }}>
            {/* Only show "Intensity Update" label for non-initial readings */}
            {!isInitialIntensity && (
              <Text style={styles.timelineEventTitle}>Intensity Update</Text>
            )}
            <View style={styles.timelineIntensityBar}>
              <View
                style={[
                  styles.timelineIntensityBarFill,
                  {
                    width: `${(reading.intensity / 10) * 100}%`,
                    backgroundColor: getPainColor(reading.intensity),
                  },
                ]}
              />
            </View>
            <Text style={[styles.timelineIntensityValue, { color: getPainColor(reading.intensity) }]}>
              {reading.intensity}/10 - {getPainLevel(reading.intensity).label}
            </Text>
          </View>
        );

      case 'note':
        const note = event.data as EpisodeNote;
        const isEpisodeSummary = note.id === 'episode-summary';
        return (
          <View key={event.id} style={{ marginBottom: 12 }}>
            {/* Only show "Note" title for user-added notes, not episode summary */}
            {!isEpisodeSummary && (
              <Text style={styles.timelineEventTitle}>Note</Text>
            )}
            <Text style={styles.timelineNoteText}>{note.note}</Text>
            {/* Only show delete button for user-added notes, not the episode summary */}
            {!isEpisodeSummary && (
              <TouchableOpacity
                style={styles.deleteEventButton}
                onPress={() => handleDeleteNote(note.id)}
              >
                <Text style={styles.deleteEventButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'symptom':
      case 'symptom_initial':
        // Symptoms are now rendered grouped in renderGroupedTimelineEvent
        return null;

      case 'medication':
        const dose = event.data as MedicationDoseWithDetails;
        return (
          <View key={event.id} style={{ marginBottom: 12 }}>
            <Text style={styles.timelineEventTitle}>Medication Taken</Text>
            <Text style={styles.timelineEventContent}>
              {dose.medication?.name || 'Unknown Medication'} • {dose.amount} × {dose.medication?.dosageAmount}{dose.medication?.dosageUnit}
            </Text>
          </View>
        );

      case 'end':
        return (
          <View key={event.id} style={{ marginBottom: 12 }}>
            <Text style={styles.timelineEventTitle}>Episode Ended</Text>
          </View>
        );

      default:
        return null;
    }
  };

  const renderGroupedTimelineEvent = (group: GroupedTimelineEvent, index: number, isLast: boolean) => {
    const time = format(group.timestamp, 'h:mm a');

    // Separate symptom events from other events
    const symptomEvents = group.events.filter(e => e.type === 'symptom' || e.type === 'symptom_initial');
    const otherEvents = group.events.filter(e => e.type !== 'symptom' && e.type !== 'symptom_initial');

    // Get the primary color for the dot (intensity > medication > note)
    const intensityEvent = group.events.find(e => e.type === 'intensity');
    const medicationEvent = group.events.find(e => e.type === 'medication');
    const endEvent = group.events.find(e => e.type === 'end');

    let dotColor = theme.textSecondary; // Default neutral gray
    if (intensityEvent) {
      const reading = intensityEvent.data as IntensityReading;
      dotColor = getPainColor(reading.intensity);
    } else if (endEvent) {
      dotColor = theme.textSecondary;
    }
    // Medication and note events keep neutral gray

    return (
      <View key={`group-${group.timestamp}`} style={styles.timelineItem}>
        <View style={styles.timelineLeft}>
          <Text style={styles.timelineTime}>{time}</Text>
        </View>
        <View style={styles.timelineCenter}>
          <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
          {!isLast && <View style={styles.timelineLine} />}
        </View>
        <View style={styles.timelineRight}>
          {/* Render non-symptom events */}
          {otherEvents.map(event => renderEventContent(event))}

          {/* Render symptom changes with +/- indicators */}
          {symptomEvents.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.timelineEventTitle}>
                {symptomEvents[0].type === 'symptom_initial' ? 'Initial Symptoms' : 'Symptom Changes'}
              </Text>
              <View style={styles.chipContainer}>
                {symptomEvents.map(event => {
                  const symptomChanges = event.data as SymptomChange[];
                  const isInitial = event.type === 'symptom_initial';

                  return symptomChanges.map((change, idx) => {
                    const isAdded = change.changeType === 'added';

                    // For initial symptoms, use neutral styling without indicators
                    if (isInitial) {
                      return (
                        <View key={`${event.id}-${idx}`} style={styles.chip}>
                          <Text style={styles.chipText}>
                            {change.symptom.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Text>
                        </View>
                      );
                    }

                    // For symptom changes, show +/- with color coding
                    const chipStyle = isAdded ? styles.symptomAddedChip : styles.symptomRemovedChip;
                    const textStyle = isAdded ? styles.symptomAddedText : styles.symptomRemovedText;
                    const indicator = isAdded ? '+ ' : '− ';

                    return (
                      <View key={`${event.id}-${idx}`} style={[styles.chip, chipStyle]}>
                        <Text style={[styles.chipText, textStyle]}>
                          {indicator}{change.symptom.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </View>
                    );
                  });
                })}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading || !episode) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Episode</Text>
          <View style={{ width: 60 }} />
        </View>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const duration = episode.endTime
    ? differenceInMinutes(episode.endTime, episode.startTime)
    : differenceInMinutes(Date.now(), episode.startTime);

  const timeline = buildTimeline();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Episode Details</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NewEpisode', { episodeId })} testID="edit-episode-button">
          <Text style={styles.editButton}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} testID="episode-detail-scroll-view">
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.statusHeader}>
            <Text style={styles.cardTitle}>
              {format(episode.startTime, 'EEEE, MMM d, yyyy')}
            </Text>
            {!episode.endTime && (
              <View style={styles.ongoingBadge}>
                <Text style={styles.ongoingText}>Ongoing</Text>
              </View>
            )}
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Started:</Text>
            <Text style={styles.detailValue}>
              {format(episode.startTime, 'h:mm a')}
            </Text>
          </View>

          {episode.endTime && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ended:</Text>
              <Text style={styles.detailValue}>
                {format(episode.endTime, 'h:mm a')}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration:</Text>
            <Text style={styles.detailValue}>
              {Math.floor(duration / 60)}h {duration % 60}m
            </Text>
          </View>

          {episode.peakIntensity !== undefined && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Peak Intensity:</Text>
              <Text style={[styles.detailValue, { color: getPainColor(episode.peakIntensity), fontWeight: '600' }]}>
                {episode.peakIntensity}/10 - {getPainLevel(episode.peakIntensity).label}
              </Text>
            </View>
          )}

          {episode.averageIntensity !== undefined && episode.averageIntensity !== null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Average Intensity:</Text>
              <Text style={[styles.detailValue, { color: getPainColor(episode.averageIntensity), fontWeight: '600' }]}>
                {episode.averageIntensity.toFixed(1)}/10 - {getPainLevel(episode.averageIntensity).label}
              </Text>
            </View>
          )}

          {/* Location Link */}
          {episode.location && (
            <TouchableOpacity style={styles.detailRow} onPress={handleOpenMap}>
              <Text style={styles.detailLabel}>Location:</Text>
              <Text style={[styles.detailValue, styles.locationLink]}>
                {locationAddress || 'View on Map'} →
              </Text>
            </TouchableOpacity>
          )}

          {/* Action Buttons - Only for ongoing episodes */}
          {!episode.endTime && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('LogUpdate', { episodeId })}
                testID="log-update-button"
              >
                <Text style={styles.actionButtonText}>Log Update</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('LogMedication', { episodeId })}
                testID="log-medication-from-episode-button"
              >
                <Text style={styles.actionButtonText}>Log Medication</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Pain Locations */}
        {episode.locations.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pain Locations</Text>
            <View style={styles.locationGrid}>
              <View style={styles.locationSide}>
                <Text style={styles.locationSideLabel}>Left Side</Text>
                {episode.locations
                  .filter(loc => loc.startsWith('left_'))
                  .map(location => (
                    <Text key={location} style={styles.locationItem}>
                      • {location.replace('left_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                  ))}
              </View>
              <View style={styles.locationSide}>
                <Text style={styles.locationSideLabel}>Right Side</Text>
                {episode.locations
                  .filter(loc => loc.startsWith('right_'))
                  .map(location => (
                    <Text key={location} style={styles.locationItem}>
                      • {location.replace('right_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                  ))}
              </View>
            </View>
          </View>
        )}

        {/* Pain Qualities */}
        {episode.qualities.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pain Quality</Text>
            <View style={styles.chipContainer}>
              {episode.qualities.map(quality => (
                <View key={quality} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {quality.charAt(0).toUpperCase() + quality.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Triggers */}
        {episode.triggers.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Possible Triggers</Text>
            <View style={styles.chipContainer}>
              {episode.triggers.map(trigger => (
                <View key={trigger} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {trigger.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Timeline</Text>
            <View style={styles.timelineContainer}>
              {timeline.map((group, index) =>
                renderGroupedTimelineEvent(group, index, index === timeline.length - 1)
              )}
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* End Episode Buttons */}
      {!episode.endTime && (
        <View style={styles.footer}>
          <View style={styles.endButtonsContainer}>
            <TouchableOpacity style={styles.endButton} onPress={endEpisodeNow} testID="end-now-button">
              <Text style={styles.endButtonText}>End Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.endCustomButton}
              onPress={() => {
                setCustomEndTime(Date.now());
                setShowEndTimePicker(true);
              }}
              testID="end-custom-button"
            >
              <Text style={styles.endCustomButtonText}>End...</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMapModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ width: 60 }} />
            <Text style={styles.modalTitle}>Episode Location</Text>
            <TouchableOpacity onPress={() => setShowMapModal(false)}>
              <Text style={styles.modalCloseButton}>Done</Text>
            </TouchableOpacity>
          </View>

          {episode.location && (
            <MapView
              style={styles.modalMap}
              initialRegion={{
                latitude: episode.location.latitude,
                longitude: episode.location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={{
                  latitude: episode.location.latitude,
                  longitude: episode.location.longitude,
                }}
                title="Episode Started Here"
                description={locationAddress || format(episode.startTime, 'MMM d, yyyy h:mm a')}
              />
            </MapView>
          )}

          <View style={styles.modalInfo}>
            {locationAddress && (
              <Text style={styles.modalLocationText}>{locationAddress}</Text>
            )}
            {episode.location?.accuracy && (
              <Text style={styles.modalAccuracyText}>
                Accuracy: ±{Math.round(episode.location.accuracy)}m
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* End Time Picker Modal */}
      <Modal
        visible={showEndTimePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEndTimePicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
              <Text style={styles.modalCloseButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Set End Time</Text>
            <TouchableOpacity onPress={endEpisodeWithCustomTime}>
              <Text style={styles.modalCloseButton}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <DateTimePicker
              value={new Date(customEndTime)}
              mode="datetime"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setCustomEndTime(selectedDate.getTime());
                }
              }}
              maximumDate={new Date()}
              minimumDate={new Date(episode.startTime)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

