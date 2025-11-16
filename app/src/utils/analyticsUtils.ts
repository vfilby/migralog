/**
 * Analytics utility functions for date range filtering and duration formatting
 */

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
