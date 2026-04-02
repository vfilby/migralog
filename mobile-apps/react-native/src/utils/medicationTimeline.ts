/**
 * Medication Timeline Utilities
 * Provides functions for calculating medication timeline status
 */

import { MedicationDose } from '../models/types';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export interface TimelineDayStatus {
  date: Date;
  taken: boolean;
  skipped: boolean;
}

/**
 * Calculate the status of doses for a specific day
 * Determines if doses were taken, skipped, or nothing logged
 *
 * @param doses - Array of medication doses to check
 * @param dayStart - Start timestamp of the day
 * @param dayEnd - End timestamp of the day
 * @returns Status object with date, taken, and skipped flags
 */
export function calculateDayStatus(
  doses: MedicationDose[],
  dayStart: number,
  dayEnd: number
): Omit<TimelineDayStatus, 'date'> {
  const dosesOnDay = doses.filter(
    d => d.timestamp >= dayStart && d.timestamp <= dayEnd
  );

  // Check if there are any taken (non-skipped) doses
  const takenToday = dosesOnDay.some(d => d.status !== 'skipped');

  // Check if ALL doses were skipped (and there's at least one)
  const allSkipped = dosesOnDay.length > 0 && dosesOnDay.every(d => d.status === 'skipped');

  return {
    taken: takenToday,
    skipped: allSkipped,
  };
}

/**
 * Generate timeline status for the last N days
 * Returns an array of timeline day statuses from N days ago to today
 *
 * @param doses - Array of medication doses
 * @param days - Number of days to include (default 7)
 * @returns Array of TimelineDayStatus objects, ordered from oldest to newest
 */
export function getLast7DaysTimeline(
  doses: MedicationDose[],
  days: number = 7
): TimelineDayStatus[] {
  const timeline: TimelineDayStatus[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dayStart = startOfDay(date).getTime();
    const dayEnd = endOfDay(date).getTime();

    const status = calculateDayStatus(doses, dayStart, dayEnd);

    timeline.push({
      date,
      ...status,
    });
  }

  return timeline;
}
