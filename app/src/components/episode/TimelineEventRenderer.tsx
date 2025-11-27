import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import {
  Episode,
  IntensityReading,
  EpisodeNote,
  SymptomLog,
  PainLocationLog,
  PainLocation,
} from '../../models/types';
import { useTheme, ThemeColors } from '../../theme';
import { getPainColor, getPainLevel } from '../../utils/painScale';
import { formatMedicationDoseDisplay } from '../../utils/medicationFormatting';
import { useMedicationStatusStyles } from '../../utils/medicationStyling';
import { 
  MedicationDoseWithDetails, 
  SymptomChange,
  SymptomEventData, 
  PainLocationChange,
  PainLocationEventData, 
  TimelineEvent, 
  GroupedTimelineEvent,
  PAIN_LOCATIONS
} from './types';

interface TimelineEventRendererProps {
  group: GroupedTimelineEvent;
  index: number;
  isLast: boolean;
  dateLabel?: React.ReactNode;
  episode: Episode;
  onIntensityLongPress: (reading: IntensityReading) => void;
  onNoteLongPress: (note: EpisodeNote) => void;
  onMedicationLongPress: (dose: MedicationDoseWithDetails) => void;
  onSymptomLongPress: (log: SymptomLog) => void;
  onPainLocationLongPress: (log: PainLocationLog) => void;
  onEpisodeEndLongPress: () => void;
}

export const TimelineEventRenderer: React.FC<TimelineEventRendererProps> = ({
  group,
  isLast,
  dateLabel,
  episode,
  onIntensityLongPress,
  onNoteLongPress,
  onMedicationLongPress,
  onSymptomLongPress,
  onPainLocationLongPress,
  onEpisodeEndLongPress,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { getStatusStyle } = useMedicationStatusStyles();

  const renderEventContent = (event: TimelineEvent) => {
    switch (event.type) {
      case 'intensity':
        const reading = event.data as IntensityReading;
        const isInitialIntensity = episode && reading.timestamp === episode.startTime;
        return (
          <TouchableOpacity
            key={event.id}
            style={{ marginBottom: 12 }}
            activeOpacity={isInitialIntensity ? 1 : 0.7}
            onLongPress={!isInitialIntensity ? () => onIntensityLongPress(reading) : undefined}
            delayLongPress={500}
          >
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
              {reading.intensity} - {getPainLevel(reading.intensity).label}
            </Text>
          </TouchableOpacity>
        );

      case 'note':
        const note = event.data as EpisodeNote;
        const isEpisodeSummary = note.id === 'episode-summary';
        return (
          <TouchableOpacity
            key={event.id}
            style={{ marginBottom: 12 }}
            activeOpacity={isEpisodeSummary ? 1 : 0.7}
            onLongPress={!isEpisodeSummary ? () => onNoteLongPress(note) : undefined}
            delayLongPress={500}
          >
            {!isEpisodeSummary && (
              <Text style={styles.timelineEventTitle}>Note</Text>
            )}
            <Text style={styles.timelineNoteText}>{note.note}</Text>
          </TouchableOpacity>
        );

      case 'symptom':
      case 'symptom_initial':
      case 'pain_location':
      case 'pain_location_initial':
        // These are rendered grouped, so return null here
        return null;

      case 'medication':
        const dose = event.data as MedicationDoseWithDetails;
        const isSkipped = dose.status === 'skipped';
        return (
          <TouchableOpacity
            key={event.id}
            style={{ marginBottom: 12 }}
            activeOpacity={0.7}
            onLongPress={() => onMedicationLongPress(dose)}
            delayLongPress={500}
          >
            <Text style={styles.timelineEventTitle}>
              {isSkipped ? 'Medication Skipped' : 'Medication Taken'}
            </Text>
            <Text style={[styles.timelineEventContent, getStatusStyle(dose.status)]}>
              {dose.medication?.name || 'Unknown Medication'} • {formatMedicationDoseDisplay(dose, dose.medication)}
            </Text>
          </TouchableOpacity>
        );

      case 'end':
        return (
          <TouchableOpacity
            key={event.id}
            style={{ marginBottom: 12 }}
            activeOpacity={0.7}
            onLongPress={onEpisodeEndLongPress}
            delayLongPress={500}
          >
            <Text style={styles.timelineEventTitle}>Episode Ended</Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  const time = format(group.timestamp, 'h:mm a');

  // Separate symptom events and pain location events from other events
  const symptomEvents = group.events.filter(e => e.type === 'symptom' || e.type === 'symptom_initial');
  const painLocationEvents = group.events.filter(e => e.type === 'pain_location' || e.type === 'pain_location_initial');
  const otherEvents = group.events.filter(e =>
    e.type !== 'symptom' &&
    e.type !== 'symptom_initial' &&
    e.type !== 'pain_location' &&
    e.type !== 'pain_location_initial'
  );

  // Get the primary color for the dot
  const intensityEvent = group.events.find(e => e.type === 'intensity');
  const endEvent = group.events.find(e => e.type === 'end');

  let dotColor = '#666'; // Default neutral gray
  if (intensityEvent) {
    const reading = intensityEvent.data as IntensityReading;
    dotColor = getPainColor(reading.intensity);
  } else if (endEvent) {
    dotColor = '#666';
  }

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <Text style={styles.timelineTime}>{time}</Text>
        {dateLabel}
      </View>
      <View style={styles.timelineCenter}>
        <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineRight}>
        {/* Render non-symptom events */}
        {otherEvents.map(event => renderEventContent(event))}

        {/* Render symptom changes */}
        {symptomEvents.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.timelineEventTitle}>
              {symptomEvents[0].type === 'symptom_initial' ? 'Initial Symptoms' : 'Symptom Changes'}
            </Text>
{symptomEvents.map(event => {
              const eventData = event.data as SymptomEventData;
              const isInitial = event.type === 'symptom_initial';
              const log = eventData.log;
              const chips = eventData.changes.map((change: SymptomChange, idx: number) => {
                const isAdded = change.changeType === 'added';
                const chipStyle = isAdded ? styles.symptomAddedChip : styles.symptomRemovedChip;
                const textStyle = isAdded ? styles.symptomAddedText : styles.symptomRemovedText;
                const indicator = isAdded ? '+ ' : '− ';
                const label = change.symptom.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

                if (isInitial) {
                  return (
                    <View key={`${event.id}-${idx}`} style={styles.chip}>
                      <Text style={styles.chipText}>{label}</Text>
                    </View>
                  );
                }

                return (
                  <View key={`${event.id}-${idx}`} style={[styles.chip, chipStyle]}>
                    <Text style={[styles.chipText, textStyle]}>
                      {indicator}{label}
                    </Text>
                  </View>
                );
              });

              if (!isInitial && log) {
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.chipGroup}
                    activeOpacity={0.7}
                    delayLongPress={500}
                    onLongPress={() => onSymptomLongPress(log)}
                  >
                    <View style={styles.chipContainer}>{chips}</View>
                  </TouchableOpacity>
                );
              }

              return (
                <View key={event.id} style={styles.chipGroup}>
                  <View style={styles.chipContainer}>{chips}</View>
                </View>
              );
            })}
          </View>
        )}

        {/* Render pain location changes */}
        {painLocationEvents.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.timelineEventTitle}>
              {painLocationEvents[0].type === 'pain_location_initial' ? 'Initial Pain Locations' : 'Pain Location Changes'}
            </Text>
{painLocationEvents.map(event => {
              const eventData = event.data as PainLocationEventData;
              const isInitial = event.type === 'pain_location_initial';
              const log = eventData.log;
              const chips = eventData.changes.map((change: PainLocationChange, idx: number) => {
                const location = PAIN_LOCATIONS.find((l: { value: PainLocation; }) => l.value === change.location);
                const sideLabel = location?.side === 'left' ? 'Left' : 'Right';
                const locationLabel = location ? `${sideLabel} ${location.label}` : change.location;

                if (isInitial || change.changeType === 'unchanged') {
                  return (
                    <View key={`${event.id}-${idx}`} style={styles.chip}>
                      <Text style={styles.chipText}>{locationLabel}</Text>
                    </View>
                  );
                }

                const isAdded = change.changeType === 'added';
                const chipStyle = isAdded ? styles.symptomAddedChip : styles.symptomRemovedChip;
                const textStyle = isAdded ? styles.symptomAddedText : styles.symptomRemovedText;
                const indicator = isAdded ? '+ ' : '− ';

                return (
                  <View key={`${event.id}-${idx}`} style={[styles.chip, chipStyle]}>
                    <Text style={[styles.chipText, textStyle]}>
                      {indicator}{locationLabel}
                    </Text>
                  </View>
                );
              });

              if (!isInitial && log) {
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.chipGroup}
                    activeOpacity={0.7}
                    delayLongPress={500}
                    onLongPress={() => onPainLocationLongPress(log)}
                  >
                    <View style={styles.chipContainer}>{chips}</View>
                  </TouchableOpacity>
                );
              }

              return (
                <View key={event.id} style={styles.chipGroup}>
                  <View style={styles.chipContainer}>{chips}</View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    timelineItem: {
      flexDirection: 'row',
      marginBottom: 24,
    },
    timelineLeft: {
      width: 70,
      alignItems: 'flex-end',
      paddingRight: 12,
    },
    timelineTime: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    timelineCenter: {
      width: 20,
      alignItems: 'center',
    },
    timelineDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginTop: 2,
    },
    timelineLine: {
      width: 1,
      flex: 1,
      backgroundColor: theme.borderLight,
      marginTop: 4,
    },
    timelineRight: {
      flex: 1,
      paddingLeft: 12,
    },
    timelineEventTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    timelineEventContent: {
      fontSize: 16,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    timelineNoteText: {
      fontSize: 16,
      color: theme.text,
      lineHeight: 22,
    },
    timelineIntensityBar: {
      height: 20,
      backgroundColor: theme.borderLight,
      borderRadius: 10,
      marginBottom: 4,
      overflow: 'hidden',
    },
    timelineIntensityBarFill: {
      height: '100%',
      borderRadius: 10,
    },
    timelineIntensityValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    chipGroup: {
      marginTop: 4,
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      backgroundColor: theme.borderLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    chipText: {
      fontSize: 14,
      color: theme.text,
    },
    symptomAddedChip: {
      backgroundColor: '#E8F5E9',
    },
    symptomAddedText: {
      color: '#2E7D32',
      fontWeight: '600',
    },
    symptomRemovedChip: {
      backgroundColor: '#FFEBEE',
    },
    symptomRemovedText: {
      color: '#C62828',
      fontWeight: '600',
    },
  });
