import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import {
  Episode,
  IntensityReading,
  EpisodeNote,
  MedicationDose,
  Medication,
  PainLocation,
} from '../../models/types';
import { getPainColor, getPainLevel } from '../../utils/painScale';
import { formatMedicationDoseDisplay } from '../../utils/medicationFormatting';
import { useMedicationStatusStyles } from '../../utils/medicationStyling';

// Type definitions
type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

// Constants
const PAIN_LOCATIONS: { value: PainLocation; label: string; side: 'left' | 'right' }[] = [
  { value: 'left_eye', label: 'Eye', side: 'left' },
  { value: 'left_temple', label: 'Temple', side: 'left' },
  { value: 'left_neck', label: 'Neck', side: 'left' },
  { value: 'left_head', label: 'Head', side: 'left' },
  { value: 'left_teeth', label: 'Teeth/Jaw', side: 'left' },
  { value: 'right_eye', label: 'Eye', side: 'right' },
  { value: 'right_temple', label: 'Temple', side: 'right' },
  { value: 'right_neck', label: 'Neck', side: 'right' },
  { value: 'right_head', label: 'Head', side: 'right' },
  { value: 'right_teeth', label: 'Teeth/Jaw', side: 'right' },
];

interface TimelineEvent {
  id: string;
  type: 'intensity' | 'note' | 'symptom' | 'symptom_initial' | 'pain_location' | 'pain_location_initial' | 'medication' | 'end';
  timestamp: number;
  data: IntensityReading | EpisodeNote | MedicationDoseWithDetails | SymptomChange[] | PainLocationChange[] | null;
}

interface GroupedTimelineEvent {
  timestamp: number;
  events: TimelineEvent[];
}

interface SymptomChange {
  symptom: string;
  changeType: 'added' | 'removed';
}

interface PainLocationChange {
  location: string;
  changeType: 'added' | 'removed' | 'unchanged';
}

interface TimelineEventRendererProps {
  group: GroupedTimelineEvent;
  index: number;
  isLast: boolean;
  dateLabel?: React.ReactNode;
  episode: Episode;
  onIntensityLongPress: (reading: IntensityReading) => void;
  onNoteLongPress: (note: EpisodeNote) => void;
  onMedicationLongPress: (dose: MedicationDoseWithDetails) => void;
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
  onEpisodeEndLongPress,
}) => {
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
            <View style={styles.chipContainer}>
              {symptomEvents.map(event => {
                const symptomChanges = event.data as SymptomChange[];
                const isInitial = event.type === 'symptom_initial';

                return symptomChanges.map((change, idx) => {
                  const isAdded = change.changeType === 'added';

                  if (isInitial) {
                    return (
                      <View key={`${event.id}-${idx}`} style={styles.chip}>
                        <Text style={styles.chipText}>
                          {change.symptom.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </View>
                    );
                  }

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

        {/* Render pain location changes */}
        {painLocationEvents.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.timelineEventTitle}>
              {painLocationEvents[0].type === 'pain_location_initial' ? 'Initial Pain Locations' : 'Pain Location Changes'}
            </Text>
            <View style={styles.chipContainer}>
              {painLocationEvents.map(event => {
                const locationChanges = event.data as PainLocationChange[];
                const isInitial = event.type === 'pain_location_initial';

                return locationChanges.map((change, idx) => {
                  const location = PAIN_LOCATIONS.find(l => l.value === change.location);
                  const sideLabel = location?.side === 'left' ? 'Left' : 'Right';
                  const locationLabel = location ? `${sideLabel} ${location.label}` : change.location;

                  if (isInitial || change.changeType === 'unchanged') {
                    return (
                      <View key={`${event.id}-${idx}`} style={styles.chip}>
                        <Text style={styles.chipText}>
                          {locationLabel}
                        </Text>
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
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  timelineCenter: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 2,
  },
  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#E0E0E0',
    marginTop: 4,
  },
  timelineRight: {
    flex: 1,
    paddingLeft: 12,
  },
  timelineEventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  timelineEventContent: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  timelineNoteText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  timelineIntensityBar: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  timelineIntensityBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  timelineIntensityValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 12,
    color: '#666',
  },
  symptomAddedChip: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  symptomAddedText: {
    color: '#2E7D32',
    fontWeight: '500',
  },
  symptomRemovedChip: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  symptomRemovedText: {
    color: '#C62828',
    fontWeight: '500',
  },
});