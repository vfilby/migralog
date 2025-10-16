import { startOfDay, format, differenceInHours } from 'date-fns';
import { IntensityReading, MedicationDose, Medication } from '../models/types';

export type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

export type TimelineEvent = {
  id: string;
  timestamp: number;
  type: 'intensity' | 'note' | 'medication' | 'symptom' | 'symptom_initial' | 'end';
  data: any;
};

export type DayGroup = {
  date: number; // Start of day timestamp
  dateLabel: string; // e.g., "Monday, Oct 14"
  events: TimelineEvent[];
  stats: DayStats;
};

export type DayStats = {
  peakIntensity: number | null;
  averageIntensity: number | null;
  medicationCount: number;
  hoursInDay: number;
};

/**
 * Groups timeline events by calendar day and calculates per-day statistics
 * @param events - Array of timeline events to group
 * @param episodeStartTime - Episode start timestamp
 * @param episodeEndTime - Episode end timestamp (null if ongoing)
 * @returns Array of day groups with events and statistics
 */
export function groupEventsByDay(
  events: TimelineEvent[],
  episodeStartTime: number,
  episodeEndTime: number | null
): DayGroup[] {
  if (events.length === 0) {
    return [];
  }

  // Group events by day
  const eventsByDay = new Map<number, TimelineEvent[]>();

  events.forEach(event => {
    const dayStart = startOfDay(event.timestamp).getTime();
    const existing = eventsByDay.get(dayStart) || [];
    existing.push(event);
    eventsByDay.set(dayStart, existing);
  });

  // Convert to array and sort by date
  const dayGroups: DayGroup[] = Array.from(eventsByDay.entries())
    .map(([dayStart, dayEvents]) => {
      // Calculate statistics for this day
      const stats = calculateDayStats(dayEvents, episodeStartTime, episodeEndTime, dayStart);

      return {
        date: dayStart,
        dateLabel: format(dayStart, 'EEEE, MMM d'),
        events: dayEvents.sort((a, b) => a.timestamp - b.timestamp),
        stats,
      };
    })
    .sort((a, b) => a.date - b.date);

  return dayGroups;
}

/**
 * Calculates statistics for a single day of the episode
 */
function calculateDayStats(
  dayEvents: TimelineEvent[],
  episodeStartTime: number,
  episodeEndTime: number | null,
  dayStart: number
): DayStats {
  // Calculate intensity stats
  const intensityEvents = dayEvents.filter(e => e.type === 'intensity');
  const intensityValues = intensityEvents.map(e => (e.data as IntensityReading).intensity);

  const peakIntensity = intensityValues.length > 0
    ? Math.max(...intensityValues)
    : null;

  const averageIntensity = intensityValues.length > 0
    ? intensityValues.reduce((sum, val) => sum + val, 0) / intensityValues.length
    : null;

  // Count medications taken this day
  const medicationCount = dayEvents.filter(e => e.type === 'medication').length;

  // Calculate hours in this day (for episodes spanning multiple days)
  const dayEnd = dayStart + 24 * 60 * 60 * 1000; // End of this day
  const actualStart = Math.max(dayStart, episodeStartTime);
  const actualEnd = episodeEndTime
    ? Math.min(dayEnd, episodeEndTime)
    : Math.min(dayEnd, Date.now());

  const hoursInDay = Math.max(0, differenceInHours(actualEnd, actualStart));

  return {
    peakIntensity,
    averageIntensity,
    medicationCount,
    hoursInDay,
  };
}

/**
 * Groups events that occur at the exact same timestamp
 */
export function groupEventsByTimestamp(events: TimelineEvent[]): Array<{ timestamp: number; events: TimelineEvent[] }> {
  const grouped = new Map<number, TimelineEvent[]>();

  events.forEach(event => {
    const existing = grouped.get(event.timestamp) || [];
    existing.push(event);
    grouped.set(event.timestamp, existing);
  });

  return Array.from(grouped.entries())
    .map(([timestamp, events]) => ({ timestamp, events }))
    .sort((a, b) => a.timestamp - b.timestamp);
}
