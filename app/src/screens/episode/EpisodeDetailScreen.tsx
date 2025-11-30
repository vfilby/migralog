import React, { useState } from 'react';
import { logger } from '../../utils/logger';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActionSheetIOS, useWindowDimensions } from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { useEpisodeStore } from '../../store/episodeStore';
import { episodeRepository, intensityRepository, symptomLogRepository, episodeNoteRepository, painLocationLogRepository } from '../../database/episodeRepository';
import { medicationDoseRepository, medicationRepository } from '../../database/medicationRepository';
import { Episode, IntensityReading, SymptomLog, EpisodeNote, PainLocationLog } from '../../models/types';
import { differenceInMinutes } from 'date-fns';
import { locationService } from '../../services/locationService';
import { useTheme, ThemeColors } from '../../theme';
import { validateEpisodeEndTime } from '../../utils/episodeValidation';
import { shouldShowMedicationInTimeline } from '../../utils/timelineFilters';
import { groupEventsByDay, DayGroup } from '../../utils/timelineGrouping';
import { formatDateTime } from '../../utils/dateFormatting';
import {
  EpisodeStatusCard,
  EpisodeInfoCards,
  EpisodeTimeline,
  EpisodeActions,
  EpisodeModals,
} from '../../components/episode';
import { 
  MedicationDoseWithDetails, 
  TimelineEvent,
  SymptomChange,
  PainLocationChange
} from '../../components/episode/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EpisodeDetail'>;







const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 80,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerSide: {
    minWidth: 60,
    alignItems: 'flex-start',
  },
  headerSideRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    flexShrink: 1,
    flexGrow: 1,
    textAlign: 'center',
  },
  backButton: {
    fontSize: 17,
    color: theme.primary,
    paddingVertical: 4,
  },
  editButton: {
    fontSize: 17,
    color: theme.primary,
    fontWeight: '600',
    paddingVertical: 4,
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
});

export default function EpisodeDetailScreen({ route, navigation }: Props) {
  const { episodeId } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const { endEpisode, updateEpisode, reopenEpisode } = useEpisodeStore();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [intensityReadings, setIntensityReadings] = useState<IntensityReading[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [painLocationLogs, setPainLocationLogs] = useState<PainLocationLog[]>([]);
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [episodeId])
  );

  const loadEpisodeData = async () => {
    try {
      const [ep, readings, symptoms, painLocs, meds, notes] = await Promise.all([
        episodeRepository.getById(episodeId),
        intensityRepository.getByEpisodeId(episodeId),
        symptomLogRepository.getByEpisodeId(episodeId),
        painLocationLogRepository.getByEpisodeId(episodeId),
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
      setPainLocationLogs(painLocs);
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
      logger.error('Failed to load episode:', error);
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



  const editEpisodeEndTime = async () => {
    if (!episode) return;

    // Validate that end time is not before episode start
    const validation = validateEpisodeEndTime(episode.startTime, customEndTime);
    if (!validation.isValid) {
      Alert.alert('Invalid Time', validation.error!);
      return;
    }

    // Edit the end time of completed episode
    await updateEpisode(episode.id, { endTime: customEndTime });
    await loadEpisodeData(); // Reload to reflect changes
    setShowEndTimePicker(false);
  };

  const handleCustomTimeAction = async () => {
    if (episode?.endTime) {
      // Episode is already ended - we're editing the end time
      await editEpisodeEndTime();
    } else {
      // Episode is ongoing - we're ending it
      await endEpisodeWithCustomTime();
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
              logger.error('Failed to delete note:', error);
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  const endEpisodeWithCustomTime = async () => {
    if (episode) {
      await endEpisode(episode.id, customEndTime);
      navigation.goBack();
    }
  };

  const handleIntensityLongPress = (reading: IntensityReading) => {
    const confirmDelete = () => {
      Alert.alert(
        'Delete Intensity Reading',
        `Delete this intensity reading of ${reading.intensity}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await intensityRepository.delete(reading.id);
                await loadEpisodeData();
              } catch (error) {
                logger.error('Failed to delete intensity reading:', error);
                Alert.alert('Error', 'Failed to delete intensity reading');
              }
            },
          },
        ]
      );
    };

    Alert.alert(
      'Intensity Options',
      formatDateTime(reading.timestamp),
      [
        {
          text: 'Edit',
          onPress: () => navigation.navigate('EditIntensityReading', { readingId: reading.id }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ],
      { cancelable: true }
    );
  };

  const handleNoteLongPress = (note: EpisodeNote) => {
    Alert.alert(
      'Note Options',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => navigation.navigate('EditEpisodeNote', { noteId: note.id }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteNote(note.id),
        },
      ]
    );
  };

  const handleMedicationLongPress = (dose: MedicationDoseWithDetails) => {
    Alert.alert(
      'Medication Options',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => navigation.navigate('EditMedicationDose', { doseId: dose.id }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await medicationDoseRepository.delete(dose.id);
              await loadEpisodeData();
            } catch (error) {
              logger.error('Failed to delete medication dose:', error);
              Alert.alert('Error', 'Failed to delete medication dose');
            }
          },
        },
      ]
    );
  };

  const handleSymptomLongPress = (log: SymptomLog) => {
    const confirmDelete = () => {
      Alert.alert(
        'Delete Symptom Change',
        'Are you sure you want to delete this symptom change?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await symptomLogRepository.delete(log.id);
                await loadEpisodeData();
              } catch (error) {
                logger.error('Failed to delete symptom change:', error);
                Alert.alert('Error', 'Failed to delete symptom change');
              }
            },
          },
        ]
      );
    };

    Alert.alert(
      'Symptom Options',
      formatDateTime(log.onsetTime),
      [
        {
          text: 'Edit',
          onPress: () => navigation.navigate('EditSymptomLog', { symptomLogId: log.id }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ],
      { cancelable: true }
    );
  };

  const handlePainLocationLongPress = (log: PainLocationLog) => {
    const confirmDelete = () => {
      Alert.alert(
        'Delete Pain Location Update',
        'Are you sure you want to delete this pain location update?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await painLocationLogRepository.delete(log.id);
                await loadEpisodeData();
              } catch (error) {
                logger.error('Failed to delete pain location update:', error);
                Alert.alert('Error', 'Failed to delete pain location update');
              }
            },
          },
        ]
      );
    };

    Alert.alert(
      'Pain Location Options',
      formatDateTime(log.timestamp),
      [
        {
          text: 'Edit',
          onPress: () => navigation.navigate('EditPainLocationLog', { painLocationLogId: log.id }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ],
      { cancelable: true }
    );
  };

  const handleOpenMap = () => {
    setShowMapModal(true);
  };

  // Build unified timeline with multi-day grouping
  const buildTimeline = (): DayGroup[] => {
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
        data: {
          changes: initialSymptomChanges,
        },
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
        data: {
          log: symptomLog,
          changes: symptomChanges,
        },
      });
    });

    // Add initial pain locations as a timeline event (if episode has pain locations)
    if (episode && episode.locations && episode.locations.length > 0) {
      const initialPainLocationChanges: PainLocationChange[] = episode.locations.map(location => ({
        location,
        changeType: 'added' as const,
      }));

      events.push({
        id: 'pain-locations-initial',
        timestamp: episode.startTime,
        type: 'pain_location_initial',
        data: {
          changes: initialPainLocationChanges,
        },
      });
    }

    // Add pain location logs with deltas (changes in pain location areas over time)
    // Sort pain location logs by time to calculate deltas correctly
    const sortedPainLocationLogs = [...painLocationLogs].sort((a, b) => a.timestamp - b.timestamp);

    // Track current pain location state
    let currentPainLocations = new Set(episode?.locations || []);

    sortedPainLocationLogs.forEach(painLoc => {
      const newLocations = new Set(painLoc.painLocations);
      const locationChanges: PainLocationChange[] = [];

      // Find additions (in new but not in current)
      painLoc.painLocations.forEach(location => {
        if (!currentPainLocations.has(location)) {
          locationChanges.push({
            location,
            changeType: 'added',
          });
        }
      });

      // Find removals (in current but not in new)
      currentPainLocations.forEach(location => {
        if (!newLocations.has(location)) {
          locationChanges.push({
            location,
            changeType: 'removed',
          });
        }
      });

      // Find unchanged (in both current and new)
      painLoc.painLocations.forEach(location => {
        if (currentPainLocations.has(location)) {
          locationChanges.push({
            location,
            changeType: 'unchanged',
          });
        }
      });

      // Add event if there are any locations to show (changes or unchanged)
      if (locationChanges.length > 0) {
        events.push({
          id: `pain-location-${painLoc.id}`,
          timestamp: painLoc.timestamp,
          type: 'pain_location',
          data: {
            log: painLoc,
            changes: locationChanges,
          },
        });
      }

      // Update current state
      currentPainLocations = newLocations;
    });

    // Add medications - only show rescue medications or skipped scheduled medications
    // Exclude preventative medications that were taken as scheduled
    medications.forEach(med => {
      if (shouldShowMedicationInTimeline(med)) {
        events.push({
          id: `medication-${med.id}`,
          timestamp: med.timestamp,
          type: 'medication',
          data: med,
        });
      }
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

    // Group events by day using the utility function
    if (!episode) {
      return [];
    }
    return groupEventsByDay(events, episode.startTime, episode.endTime || null);
  };

  // Computed values
  const duration = episode ? differenceInMinutes(episode.endTime || Date.now(), episode.startTime) : 0;
  const timeline = episode ? buildTimeline() : [];
  const sparklineWidth = screenWidth - 64; // Match original card padding and margins

  if (loading || !episode) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerSide}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.backButton}>Back</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.title}>Episode</Text>
            <View style={styles.headerSideRight} />
          </View>
        </View>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }
  

  const handleEpisodeEndLongPress = () => {
    if (!episode) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit End Time', 'Reopen Episode'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            // Edit End Time - show date/time picker with current end time
            if (episode.endTime) {
              setCustomEndTime(episode.endTime);
              setShowEndTimePicker(true);
            }
          } else if (buttonIndex === 2) {
            // Reopen Episode - confirm and set endTime to null
            Alert.alert(
              'Reopen Episode',
              'This will mark the episode as ongoing. Are you sure?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Reopen', 
                  style: 'destructive',
                  onPress: async () => {
                    try {
                        await reopenEpisode(episode.id);
                        await loadEpisodeData(); // Reload to reflect changes
                    } catch (error) {
                      logger.error('Failed to reopen episode:', error);
                      Alert.alert('Error', 'Failed to reopen episode. Please try again.');
                    }
                  }
                }
              ]
            );
          }
        }
      );
    } else {
      Alert.alert(
        'Episode End Actions',
        episode.endTime ? formatDateTime(episode.endTime) : '',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Edit End Time', 
            onPress: () => {
              if (episode.endTime) {
                setCustomEndTime(episode.endTime);
                setShowEndTimePicker(true);
              }
            }
          },
          { 
            text: 'Reopen Episode', 
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Reopen Episode',
                'This will mark the episode as ongoing. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Reopen', 
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await reopenEpisode(episode.id);
                        await loadEpisodeData(); // Reload to reflect changes
                      } catch (error) {
                        logger.error('Failed to reopen episode:', error);
                        Alert.alert('Error', 'Failed to reopen episode. Please try again.');
                      }
                    }
                  }
                ]
              );
            }
          }
        ]
      );
    }
  };

  return (
    <View style={styles.container} testID="episode-detail-screen">
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              accessibilityHint="Returns to the previous screen"
            >
              <Text style={styles.backButton}>Back</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Episode Details</Text>
          <View style={styles.headerSideRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('NewEpisode', { episodeId })}
              testID="edit-episode-button"
              accessibilityRole="button"
              accessibilityLabel="Edit episode"
              accessibilityHint="Opens the edit screen to modify episode details"
            >
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} testID="episode-detail-scroll-view">
        {/* Status Card */}
        <EpisodeStatusCard
          episode={episode}
          duration={duration}
          locationAddress={locationAddress}
          onOpenMap={handleOpenMap}
          onNavigateToLogUpdate={() => navigation.navigate('LogUpdate', { episodeId })}
          onNavigateToLogMedication={() => navigation.navigate('LogMedication', { episodeId })}
        />


        {/* Pain Qualities */}
        {/* Episode Info Cards - Qualities and Triggers */}
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
          onSymptomLongPress={handleSymptomLongPress}
          onPainLocationLongPress={handlePainLocationLongPress}
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

