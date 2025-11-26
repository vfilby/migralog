import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Episode, IntensityReading, EpisodeNote, SymptomLog, PainLocationLog } from '../../models/types';
import { useTheme, ThemeColors } from '../../theme';
import IntensitySparkline from '../IntensitySparkline';
import { TimelineEventRenderer } from './TimelineEventRenderer';
import { 
  MedicationDoseWithDetails, 
  TimelineEvent, 
  GroupedTimelineEvent, 
  DayGroup 
} from './types';

interface EpisodeTimelineProps {
  timeline: DayGroup[];
  intensityReadings: IntensityReading[];
  episode: Episode;
  sparklineWidth: number;
  onIntensityLongPress: (reading: IntensityReading) => void;
  onNoteLongPress: (note: EpisodeNote) => void;
  onMedicationLongPress: (dose: MedicationDoseWithDetails) => void;
  onSymptomLongPress: (log: SymptomLog) => void;
  onPainLocationLongPress: (log: PainLocationLog) => void;
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
  onSymptomLongPress,
  onPainLocationLongPress,
  onEpisodeEndLongPress,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
        <View style={styles.sparklineContainer} testID="intensity-sparkline-container">
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
              {dayGap && renderDayGap(dayGap, dayIndex === timeline.length - 1)}

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
                  onSymptomLongPress={onSymptomLongPress}
                  onPainLocationLongPress={onPainLocationLongPress}
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

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 8,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    sparklineContainer: {
      marginTop: 8,
      marginBottom: 16,
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
      backgroundColor: theme.borderLight,
      marginTop: 4,
    },
    timelineDate: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    timelineGapDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginTop: 2,
    },
    timelineGapText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    timelineGapDescription: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 2,
    },
  });
