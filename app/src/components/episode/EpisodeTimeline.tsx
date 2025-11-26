import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Episode, IntensityReading, EpisodeNote, MedicationDose, Medication } from '../../models/types';
import IntensitySparkline from '../IntensitySparkline';
import { TimelineEventRenderer } from './TimelineEventRenderer';

// Type definitions from the main screen
type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

type SymptomChange = {
  symptom: string;
  changeType: 'added' | 'removed';
};

type PainLocationChange = {
  location: string;
  changeType: 'added' | 'removed' | 'unchanged';
};

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

interface DayGroup {
  date: number;
  dateLabel: string;
  events: TimelineEvent[];
}

interface EpisodeTimelineProps {
  timeline: DayGroup[];
  intensityReadings: IntensityReading[];
  episode: Episode;
  sparklineWidth: number;
  onIntensityLongPress: (reading: IntensityReading) => void;
  onNoteLongPress: (note: EpisodeNote) => void;
  onMedicationLongPress: (dose: MedicationDoseWithDetails) => void;
  onEpisodeEndLongPress: () => void;
}

export const EpisodeTimeline: React.FC<EpisodeTimelineProps> = ({
  timeline,
  intensityReadings,
  episode,
  sparklineWidth,
  onIntensityLongPress,
  onNoteLongPress,
  onMedicationLongPress,
  onEpisodeEndLongPress,
}) => {
  const groupEventsByTimestamp = (events: TimelineEvent[]): GroupedTimelineEvent[] => {
    const grouped = new Map<number, TimelineEvent[]>();
    
    events.forEach(event => {
      if (!grouped.has(event.timestamp)) {
        grouped.set(event.timestamp, []);
      }
      grouped.get(event.timestamp)!.push(event);
    });

    return Array.from(grouped.entries())
      .map(([timestamp, events]) => ({ timestamp, events }))
      .sort((a, b) => a.timestamp - b.timestamp);
  };

  const renderDateLabel = (dayGroup: DayGroup) => {
    const isToday = new Date(dayGroup.date).toDateString() === new Date().toDateString();
    const isYesterday = new Date(dayGroup.date).toDateString() === 
      new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

    let dateText = dayGroup.dateLabel;
    if (isToday) dateText = 'Today';
    else if (isYesterday) dateText = 'Yesterday';

    return <Text style={styles.timelineDate}>{dateText}</Text>;
  };

  const renderDayGap = (dayCount: number, isLast: boolean) => {
    return (
      <View style={styles.timelineItem}>
        <View style={styles.timelineLeft} />
        <View style={styles.timelineCenter}>
          <View style={styles.timelineGapDot} />
          {!isLast && <View style={styles.timelineLine} />}
        </View>
        <View style={styles.timelineRight}>
          <Text style={styles.timelineGapText}>
            {dayCount} day{dayCount > 1 ? 's' : ''} with no activity
          </Text>
          <Text style={styles.timelineGapDescription}>No pain logs or medications recorded</Text>
        </View>
      </View>
    );
  };

  if (timeline.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Timeline</Text>

      {/* Intensity Graph */}
      {intensityReadings.length > 0 && (
        <View style={{ marginTop: 8, marginBottom: 16 }}>
          <IntensitySparkline
            readings={intensityReadings}
            episodeEndTime={episode.endTime}
            width={sparklineWidth}
            height={80}
          />
        </View>
      )}

      <View style={styles.timelineContainer}>
        {timeline.map((dayGroup, dayIndex) => {
          const groupedEvents = groupEventsByTimestamp(dayGroup.events);

          // Calculate gap from previous day
          let dayGap = null;
          if (dayIndex > 0) {
            const prevDayGroup = timeline[dayIndex - 1];
            const daysDiff = Math.floor((dayGroup.date - prevDayGroup.date) / (24 * 60 * 60 * 1000));
            if (daysDiff > 1) {
              dayGap = daysDiff - 1;
            }
          }

          return (
            <View key={dayGroup.date}>
              {/* Show gap indicator if there are missing days */}
              {dayGap && renderDayGap(dayGap, false)}

              {/* Render events for this day */}
              {groupedEvents.map((group, eventIndex) => (
                <TimelineEventRenderer
                  key={`${dayGroup.date}-${group.timestamp}`}
                  group={group}
                  index={eventIndex}
                  isLast={eventIndex === groupedEvents.length - 1 && dayIndex === timeline.length - 1}
                  dateLabel={
                    eventIndex === 0 && (timeline.length > 1 || dayIndex > 0) 
                      ? renderDateLabel(dayGroup) 
                      : undefined
                  }
                  episode={episode}
                  onIntensityLongPress={onIntensityLongPress}
                  onNoteLongPress={onNoteLongPress}
                  onMedicationLongPress={onMedicationLongPress}
                  onEpisodeEndLongPress={onEpisodeEndLongPress}
                />
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  timelineContainer: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineLeft: {
    width: 70,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  timelineCenter: {
    width: 20,
    alignItems: 'center',
  },
  timelineRight: {
    flex: 1,
    paddingLeft: 12,
  },
  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#E0E0E0',
    marginTop: 4,
  },
  timelineDate: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
  timelineGapDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
    marginTop: 2,
  },
  timelineGapText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  timelineGapDescription: {
    fontSize: 11,
    color: '#BBB',
    marginTop: 2,
  },
});