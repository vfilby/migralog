/**
 * Analytics utility functions for date range filtering and duration formatting
 */

/**
 * Formats a date as YYYY-MM-DD string in local timezone
 *
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * formatDateToYYYYMMDD(new Date('2024-01-15T10:30:00'));
 * // Returns: "2024-01-15"
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the start and end dates for a time range going back N days from today
 *
 * @param days - Number of days to go back from today (e.g., 7, 30, 90)
 * @returns Object containing startDate (N days ago at 00:00:00) and endDate (today at 23:59:59.999)
 *
 * @example
 * // Get date range for last 7 days
 * const range = getDateRangeForDays(7);
 * console.log(range.startDate); // 7 days ago at midnight
 * console.log(range.endDate);   // Today at end of day
 */
export function getDateRangeForDays(days: number): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return { startDate, endDate };
}

/**
 * Filters an array of items by a date range based on a specified date property
 *
 * @template T - Type of items in the array
 * @param items - Array of items to filter
 * @param dateKey - Property name that contains the date/timestamp value
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 * @returns Filtered array containing only items within the date range
 *
 * @example
 * // Filter episodes by date range
 * const episodes = [
 *   { id: 1, startTime: new Date('2024-01-01').getTime() },
 *   { id: 2, startTime: new Date('2024-01-15').getTime() },
 * ];
 * const filtered = filterItemsByDateRange(
 *   episodes,
 *   'startTime',
 *   new Date('2024-01-10'),
 *   new Date('2024-01-20')
 * );
 * console.log(filtered); // Only episode 2
 */
export function filterItemsByDateRange<T>(
  items: T[],
  dateKey: keyof T,
  startDate: Date,
  endDate: Date
): T[] {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return items.filter(item => {
    const itemDate = item[dateKey];

    // Handle both Date objects and timestamps (numbers)
    const itemTime = itemDate instanceof Date
      ? itemDate.getTime()
      : typeof itemDate === 'number'
      ? itemDate
      : NaN;

    if (isNaN(itemTime)) {
      return false;
    }

    return itemTime >= startTime && itemTime <= endTime;
  });
}

/**
 * Formats a duration in milliseconds to a human-readable string
 *
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted string (e.g., "2h 30m", "45m", "1h")
 *
 * @example
 * formatDuration(9000000);  // "2h 30m"
 * formatDuration(2700000);  // "45m"
 * formatDuration(3600000);  // "1h"
 * formatDuration(0);        // "0m"
 * formatDuration(-100);     // "0m"
 */
export function formatDuration(milliseconds: number): string {
  // Handle negative or zero values
  if (milliseconds <= 0) {
    return '0m';
  }

  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Episode-related Analytics Functions
 */

interface Episode {
  id: string;
  startTime: number;
  endTime?: number;
}

interface DailyStatusLog {
  id: string;
  date: string; // YYYY-MM-DD format
  status: 'green' | 'yellow' | 'red';
}

/**
 * Counts the number of unique days with episodes within a date range
 *
 * @param episodes - Array of episodes to analyze
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 * @returns Number of unique days that had at least one episode
 *
 * @example
 * const episodes = [
 *   { id: '1', startTime: new Date('2024-01-15T10:00:00').getTime(), endTime: new Date('2024-01-15T14:00:00').getTime() },
 *   { id: '2', startTime: new Date('2024-01-15T18:00:00').getTime(), endTime: new Date('2024-01-16T02:00:00').getTime() },
 * ];
 * calculateMigraineDays(episodes, new Date('2024-01-01'), new Date('2024-01-31')); // 2 (days: 15th and 16th)
 */
export function calculateMigraineDays(episodes: Episode[], startDate: Date, endDate: Date): number {
  const uniqueDays = new Set<string>();

  // Normalize range dates to local midnight
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  episodes.forEach(episode => {
    // Skip episodes without a start time
    if (!episode.startTime) {
      return;
    }

    const episodeStart = new Date(episode.startTime);
    const episodeEnd = episode.endTime ? new Date(episode.endTime) : new Date();

    // Check if episode overlaps with date range
    if (episodeEnd < rangeStart || episodeStart > rangeEnd) {
      return;
    }

    // Determine the effective range for this episode
    const effectiveStartTime = Math.max(episodeStart.getTime(), rangeStart.getTime());
    const effectiveEndTime = Math.min(episodeEnd.getTime(), rangeEnd.getTime());

    // Create dates for the start and end, normalized to midnight
    const startDay = new Date(effectiveStartTime);
    startDay.setHours(0, 0, 0, 0);

    const endDay = new Date(effectiveEndTime);
    endDay.setHours(0, 0, 0, 0);

    // Iterate through all days from start to end
    const currentDay = new Date(startDay);
    while (currentDay <= endDay) {
      const dateStr = formatDateToYYYYMMDD(currentDay);
      uniqueDays.add(dateStr);
      currentDay.setDate(currentDay.getDate() + 1);
    }
  });

  return uniqueDays.size;
}

/**
 * Counts the total number of episodes within a date range
 *
 * @param episodes - Array of episodes to count
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 * @returns Total number of episodes that started within the date range
 *
 * @example
 * const episodes = [
 *   { id: '1', startTime: new Date('2024-01-15T10:00:00').getTime() },
 *   { id: '2', startTime: new Date('2024-01-20T10:00:00').getTime() },
 * ];
 * calculateEpisodeFrequency(episodes, new Date('2024-01-01'), new Date('2024-01-31')); // 2
 */
export function calculateEpisodeFrequency(episodes: Episode[], startDate: Date, endDate: Date): number {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return episodes.filter(episode => {
    if (!episode.startTime) {
      return false;
    }

    return episode.startTime >= startTime && episode.startTime <= endTime;
  }).length;
}

/**
 * Categorizes days within a date range by their status
 *
 * @param dailyStatusLogs - Array of daily status logs
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 * @returns Object with counts for clear days (green), unclear days (yellow), and untracked days
 *
 * @example
 * const logs = [
 *   { id: '1', date: '2024-01-15', status: 'green' },
 *   { id: '2', date: '2024-01-16', status: 'yellow' },
 *   { id: '3', date: '2024-01-17', status: 'red' },
 * ];
 * categorizeDays(logs, new Date('2024-01-15'), new Date('2024-01-20'));
 * // { clear: 1, unclear: 1, untracked: 3 } (15=green, 16=yellow, 17=red counts as unclear, 18-20=untracked)
 */
export function categorizeDays(
  dailyStatusLogs: DailyStatusLog[],
  startDate: Date,
  endDate: Date
): { clear: number; unclear: number; untracked: number } {

  // Create a map of dates to statuses
  const statusMap = new Map<string, 'green' | 'yellow' | 'red'>();
  dailyStatusLogs.forEach(log => {
    statusMap.set(log.date, log.status);
  });

  // Normalize dates to midnight
  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(0, 0, 0, 0);

  // Calculate total days in range (inclusive)
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((normalizedEnd.getTime() - normalizedStart.getTime()) / msPerDay) + 1;

  let clear = 0;
  let unclear = 0;

  // Iterate through each day in the range
  const currentDate = new Date(normalizedStart);

  for (let i = 0; i < totalDays; i++) {
    const dateStr = formatDateToYYYYMMDD(currentDate);
    const status = statusMap.get(dateStr);

    if (status === 'green') {
      clear++;
    } else if (status === 'yellow' || status === 'red') {
      unclear++;
    }
    // If no status, it remains untracked (counted below)

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const untracked = totalDays - clear - unclear;

  return { clear, unclear, untracked };
}

/**
 * Calculates duration statistics for episodes (shortest, longest, average)
 *
 * @param episodes - Array of episodes to analyze (must have both startTime and endTime)
 * @returns Object with shortest, longest, and average durations in milliseconds (null if no complete episodes)
 *
 * @example
 * const episodes = [
 *   { id: '1', startTime: 1000, endTime: 5000 },      // 4 seconds
 *   { id: '2', startTime: 2000, endTime: 12000 },     // 10 seconds
 *   { id: '3', startTime: 3000 },                     // No endTime, ignored
 * ];
 * calculateDurationMetrics(episodes);
 * // { shortest: 4000, longest: 10000, average: 7000 }
 */
export function calculateDurationMetrics(
  episodes: Episode[]
): { shortest: number | null; longest: number | null; average: number | null } {
  // Filter episodes that have both start and end times
  const completedEpisodes = episodes.filter(ep => ep.startTime !== undefined && ep.endTime !== undefined);

  if (completedEpisodes.length === 0) {
    return { shortest: null, longest: null, average: null };
  }

  const durations = completedEpisodes.map(ep => ep.endTime! - ep.startTime);

  const shortest = Math.min(...durations);
  const longest = Math.max(...durations);
  const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;

  return {
    shortest,
    longest,
    average: Math.round(average)
  };
}

/**
 * Medication-related Analytics Functions
 */

interface Medication {
  id: string;
  name: string;
  type: 'preventative' | 'rescue' | 'other';
  category?: 'otc' | 'nsaid' | 'triptan' | 'cgrp' | 'preventive' | 'supplement' | 'other';
}

interface MedicationDose {
  id: string;
  medicationId: string;
  scheduleId?: string;
  timestamp: number;
  status?: 'taken' | 'skipped';
}

interface MedicationSchedule {
  id: string;
  medicationId: string;
  time: string; // HH:mm format
  timezone: string;
  dosage: number;
  enabled: boolean;
}

/**
 * Calculates preventative medication compliance as a percentage
 *
 * @param medications - Array of all medications
 * @param doses - Array of medication doses
 * @param schedules - Array of medication schedules
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 * @returns Compliance percentage (0-100) for preventative medications
 *
 * @example
 * const medications = [
 *   { id: '1', name: 'Topiramate', type: 'preventative', category: 'preventive' },
 * ];
 * const schedules = [
 *   { id: 's1', medicationId: '1', time: '08:00', dosage: 1, enabled: true },
 * ];
 * const doses = [
 *   { id: 'd1', medicationId: '1', scheduleId: 's1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' },
 * ];
 * calculatePreventativeCompliance(medications, doses, schedules, new Date('2024-01-15'), new Date('2024-01-15'));
 * // Returns: 100
 */
export function calculatePreventativeCompliance(
  medications: Medication[],
  doses: MedicationDose[],
  schedules: MedicationSchedule[],
  startDate: Date,
  endDate: Date
): number {
  // Filter for preventative medications only
  const preventativeMedications = medications.filter(m => m.type === 'preventative');

  if (preventativeMedications.length === 0) {
    return 0;
  }

  // Get schedules for preventative medications that are enabled
  const preventativeSchedules = schedules.filter(s => {
    const medication = preventativeMedications.find(m => m.id === s.medicationId);
    return medication && s.enabled;
  });

  if (preventativeSchedules.length === 0) {
    return 0;
  }

  // Normalize date range
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(0, 0, 0, 0);

  // Calculate total days in range (inclusive)
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / msPerDay) + 1;

  // Calculate expected doses (schedules per day * days)
  const scheduledDosesPerDay = preventativeSchedules.length;
  const totalScheduledDoses = scheduledDosesPerDay * totalDays;

  // For filtering doses, use end of day for the end date
  const rangeEndForDoses = new Date(endDate);
  rangeEndForDoses.setHours(23, 59, 59, 999);

  // Filter doses that are taken (not skipped) within date range and for preventative meds
  const preventativeMedicationIds = new Set(preventativeMedications.map(m => m.id));
  const takenDoses = doses.filter(d => {
    if (!preventativeMedicationIds.has(d.medicationId)) {
      return false;
    }
    // Status defaults to 'taken' if not specified, so only exclude if explicitly 'skipped'
    if (d.status === 'skipped') {
      return false;
    }
    return d.timestamp >= rangeStart.getTime() && d.timestamp <= rangeEndForDoses.getTime();
  });

  const totalTakenDoses = takenDoses.length;

  // Calculate compliance percentage
  if (totalScheduledDoses === 0) {
    return 0;
  }

  const compliance = (totalTakenDoses / totalScheduledDoses) * 100;
  return Math.min(Math.round(compliance), 100); // Cap at 100%
}

/**
 * Counts the number of unique days where NSAID medication was taken
 *
 * @param medications - Array of all medications
 * @param doses - Array of medication doses
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 * @returns Number of unique days with NSAID doses
 *
 * @example
 * const medications = [
 *   { id: '1', name: 'Ibuprofen', type: 'rescue', category: 'nsaid' },
 * ];
 * const doses = [
 *   { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' },
 *   { id: 'd2', medicationId: '1', timestamp: new Date('2024-01-15T16:00:00').getTime(), status: 'taken' },
 *   { id: 'd3', medicationId: '1', timestamp: new Date('2024-01-17T08:00:00').getTime(), status: 'taken' },
 * ];
 * calculateNSAIDUsage(medications, doses, new Date('2024-01-01'), new Date('2024-01-31'));
 * // Returns: 2 (15th and 17th)
 */
export function calculateNSAIDUsage(
  medications: Medication[],
  doses: MedicationDose[],
  startDate: Date,
  endDate: Date
): number {
  // Filter for NSAID medications
  const nsaidMedications = medications.filter(m => m.category === 'nsaid');

  if (nsaidMedications.length === 0) {
    return 0;
  }

  const nsaidMedicationIds = new Set(nsaidMedications.map(m => m.id));

  // Normalize date range
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  // Filter NSAID doses within date range
  const nsaidDoses = doses.filter(d => {
    if (!nsaidMedicationIds.has(d.medicationId)) {
      return false;
    }
    if (d.status === 'skipped') {
      return false;
    }
    return d.timestamp >= rangeStart.getTime() && d.timestamp <= rangeEnd.getTime();
  });

  // Count unique days
  const uniqueDays = new Set<string>();
  nsaidDoses.forEach(dose => {
    const doseDate = new Date(dose.timestamp);
    const dateStr = `${doseDate.getFullYear()}-${String(doseDate.getMonth() + 1).padStart(2, '0')}-${String(doseDate.getDate()).padStart(2, '0')}`;
    uniqueDays.add(dateStr);
  });

  return uniqueDays.size;
}

/**
 * Calculates per-medication statistics (total doses and unique days with doses)
 *
 * @param medications - Array of all medications
 * @param doses - Array of medication doses
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 * @returns Array of stats for each medication with doses in the range
 *
 * @example
 * const medications = [
 *   { id: '1', name: 'Sumatriptan', type: 'rescue', category: 'triptan' },
 *   { id: '2', name: 'Ibuprofen', type: 'rescue', category: 'nsaid' },
 * ];
 * const doses = [
 *   { id: 'd1', medicationId: '1', timestamp: new Date('2024-01-15T08:00:00').getTime(), status: 'taken' },
 *   { id: 'd2', medicationId: '1', timestamp: new Date('2024-01-15T16:00:00').getTime(), status: 'taken' },
 *   { id: 'd3', medicationId: '1', timestamp: new Date('2024-01-17T08:00:00').getTime(), status: 'taken' },
 *   { id: 'd4', medicationId: '2', timestamp: new Date('2024-01-20T08:00:00').getTime(), status: 'taken' },
 * ];
 * calculatePerMedicationStats(medications, doses, new Date('2024-01-01'), new Date('2024-01-31'));
 * // Returns: [
 * //   { medicationId: '1', medicationName: 'Sumatriptan', totalDoses: 3, daysWithDoses: 2 },
 * //   { medicationId: '2', medicationName: 'Ibuprofen', totalDoses: 1, daysWithDoses: 1 },
 * // ]
 */
export function calculatePerMedicationStats(
  medications: Medication[],
  doses: MedicationDose[],
  startDate: Date,
  endDate: Date
): Array<{ medicationId: string; medicationName: string; totalDoses: number; daysWithDoses: number }> {
  // Normalize date range
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  // Filter doses within date range (exclude skipped doses)
  const relevantDoses = doses.filter(d => {
    if (d.status === 'skipped') {
      return false;
    }
    return d.timestamp >= rangeStart.getTime() && d.timestamp <= rangeEnd.getTime();
  });

  // Group doses by medication
  const medicationDosesMap = new Map<string, MedicationDose[]>();
  relevantDoses.forEach(dose => {
    const existing = medicationDosesMap.get(dose.medicationId) || [];
    existing.push(dose);
    medicationDosesMap.set(dose.medicationId, existing);
  });

  // Calculate stats for each medication
  const stats: Array<{ medicationId: string; medicationName: string; totalDoses: number; daysWithDoses: number }> = [];

  medicationDosesMap.forEach((medDoses, medicationId) => {
    const medication = medications.find(m => m.id === medicationId);
    if (!medication) {
      return; // Skip if medication not found
    }

    const totalDoses = medDoses.length;

    // Count unique days
    const uniqueDays = new Set<string>();
    medDoses.forEach(dose => {
      const doseDate = new Date(dose.timestamp);
      const dateStr = `${doseDate.getFullYear()}-${String(doseDate.getMonth() + 1).padStart(2, '0')}-${String(doseDate.getDate()).padStart(2, '0')}`;
      uniqueDays.add(dateStr);
    });

    stats.push({
      medicationId,
      medicationName: medication.name,
      totalDoses,
      daysWithDoses: uniqueDays.size,
    });
  });

  return stats;
}

/**
 * Intensity Histogram Analytics Functions
 */

export interface IntensityReading {
  id: string;
  episodeId: string;
  timestamp: number;
  intensity: number; // 1-10 scale
}

export interface IntensityHistogramData {
  intensity: number; // 1-10
  count: number;
}

/**
 * Calculates the distribution of episodes by their peak (maximum) intensity level.
 * Returns an array of counts for each intensity level (1-10).
 *
 * @param episodes - Array of episodes to analyze
 * @param intensityReadings - Array of all intensity readings
 * @param startDate - Start of the date range (inclusive)
 * @param endDate - End of the date range (inclusive)
 * @returns Array of histogram data with intensity level and count for each level 1-10
 *
 * @example
 * const episodes = [
 *   { id: '1', startTime: new Date('2024-01-15').getTime() },
 *   { id: '2', startTime: new Date('2024-01-16').getTime() },
 * ];
 * const readings = [
 *   { id: 'r1', episodeId: '1', timestamp: Date.now(), intensity: 7 },
 *   { id: 'r2', episodeId: '1', timestamp: Date.now(), intensity: 5 },
 *   { id: 'r3', episodeId: '2', timestamp: Date.now(), intensity: 8 },
 * ];
 * calculateIntensityHistogram(episodes, readings, startDate, endDate);
 * // Returns: [
 * //   { intensity: 1, count: 0 },
 * //   { intensity: 2, count: 0 },
 * //   ...
 * //   { intensity: 7, count: 1 },  // Episode 1 had max intensity 7
 * //   { intensity: 8, count: 1 },  // Episode 2 had max intensity 8
 * //   ...
 * // ]
 */
export function calculateIntensityHistogram(
  episodes: Episode[],
  intensityReadings: IntensityReading[],
  startDate: Date,
  endDate: Date
): IntensityHistogramData[] {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  // Filter episodes within date range
  const relevantEpisodes = episodes.filter(episode => {
    if (!episode.startTime) {
      return false;
    }
    return episode.startTime >= startTime && episode.startTime <= endTime;
  });

  // Group intensity readings by episode ID
  const readingsByEpisode = new Map<string, number[]>();
  intensityReadings.forEach(reading => {
    const existing = readingsByEpisode.get(reading.episodeId) || [];
    existing.push(reading.intensity);
    readingsByEpisode.set(reading.episodeId, existing);
  });

  // Initialize histogram with all intensity levels (1-10)
  const histogram: IntensityHistogramData[] = [];
  for (let i = 1; i <= 10; i++) {
    histogram.push({ intensity: i, count: 0 });
  }

  // Calculate max intensity for each relevant episode and update histogram
  relevantEpisodes.forEach(episode => {
    const readings = readingsByEpisode.get(episode.id);
    if (readings && readings.length > 0) {
      const maxIntensity = Math.max(...readings);
      // Ensure intensity is within bounds (1-10)
      const boundedIntensity = Math.min(Math.max(Math.round(maxIntensity), 1), 10);
      histogram[boundedIntensity - 1].count++;
    }
  });

  return histogram;
}
