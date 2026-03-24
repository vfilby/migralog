/**
 * Date and time formatting utilities for episodes and daily status
 *
 * These functions provide episode-specific date/time formatting operations
 * that handle edge cases like multi-day episodes and ongoing episodes.
 *
 * All functions support locale-aware formatting using the device's locale
 * settings for 12/24 hour time format and locale-specific date formats.
 */

import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import {
  getDeviceLocale,
  getTimeFormatString,
  getDateTimeFormatString,
  getShortDateTimeFormatString,
} from './localeUtils';

/**
 * Format episode time range with intelligent date display
 *
 * Shows just times when start/end are on the target date,
 * or includes dates when the episode spans multiple days.
 * Automatically uses 12-hour or 24-hour format based on device locale.
 *
 * @param startTime - Episode start timestamp (milliseconds)
 * @param endTime - Episode end timestamp (milliseconds), null/undefined for ongoing
 * @param targetDate - The date being viewed (YYYY-MM-DD format)
 * @returns Formatted time string like "10:00 AM - 2:00 PM" or "Jan 14, 10:00 PM - 8:00 AM"
 */
export function formatEpisodeTimeRange(
  startTime: number,
  endTime: number | null | undefined,
  targetDate: string
): string {
  try {
    const startDate = new Date(startTime);
    // Validate start date is valid
    if (isNaN(startDate.getTime())) {
      return 'Unknown time';
    }

    const locale = getDeviceLocale();
    const timeFormat = getTimeFormatString();
    const shortDateTimeFormat = getShortDateTimeFormatString();
    const targetDateObj = new Date(targetDate + 'T00:00:00');
    const startIsOnTargetDate = isSameDay(startDate, targetDateObj);

    // Helper to format start time for ongoing episodes
    const formatOngoingStart = () =>
      startIsOnTargetDate
        ? `Started at ${format(startDate, timeFormat, { locale })}`
        : `Started ${format(startDate, shortDateTimeFormat, { locale })}`;

    // Check if we have a valid end time
    if (!endTime) {
      return formatOngoingStart();
    }

    const endDate = new Date(endTime);
    if (isNaN(endDate.getTime())) {
      return formatOngoingStart();
    }

    // Completed episode - format time range
    const endIsOnTargetDate = isSameDay(endDate, targetDateObj);

    // If both start and end are on the target date, just show times
    if (startIsOnTargetDate && endIsOnTargetDate) {
      return `${format(startDate, timeFormat, { locale })} - ${format(endDate, timeFormat, { locale })}`;
    }

    // Multi-day episode - show dates with times
    const startStr = startIsOnTargetDate
      ? format(startDate, timeFormat, { locale })
      : format(startDate, shortDateTimeFormat, { locale });
    const endStr = endIsOnTargetDate
      ? format(endDate, timeFormat, { locale })
      : format(endDate, shortDateTimeFormat, { locale });

    return `${startStr} - ${endStr}`;
  } catch {
    return 'Unknown time';
  }
}

/**
 * Format episode duration as human-readable string
 *
 * @param startTime - Episode start timestamp (milliseconds)
 * @param endTime - Episode end timestamp (milliseconds), uses now if not provided
 * @returns Formatted duration like "2h 30m" or "45m"
 */
export function formatEpisodeDuration(
  startTime: number,
  endTime?: number | null
): string {
  try {
    const end = endTime || Date.now();
    const durationMs = end - startTime;

    // Handle invalid or negative duration
    if (isNaN(durationMs) || durationMs < 0) {
      return 'Unknown duration';
    }

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  } catch {
    return 'Unknown duration';
  }
}

/**
 * Format duration in hours to a human-readable string with days
 *
 * For durations >= 24 hours, shows days and hours (e.g., "1 day, 2 hours")
 * For durations < 24 hours, shows just hours (e.g., "5 hours")
 * Useful for episode summary cards where a more verbose format is preferred.
 *
 * @param hours - Duration in hours (can be fractional, will be rounded)
 * @returns Formatted duration like "1 day, 2 hours" or "5 hours"
 */
export function formatDurationLong(hours: number): string {
  // Handle edge cases
  if (isNaN(hours) || hours < 0) {
    return 'Unknown duration';
  }

  const roundedHours = Math.round(hours);

  if (roundedHours >= 24) {
    const days = Math.floor(roundedHours / 24);
    const remainingHours = roundedHours % 24;
    if (remainingHours === 0) {
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
    return `${days} ${days === 1 ? 'day' : 'days'}, ${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'}`;
  }

  return `${roundedHours} ${roundedHours === 1 ? 'hour' : 'hours'}`;
}

/**
 * Format a timestamp with relative date labels (Today, Yesterday, or full date)
 *
 * Provides user-friendly relative formatting for recent dates while
 * showing full dates for older timestamps.
 * Automatically uses 12-hour or 24-hour format based on device locale.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param timeFormat - Optional time format string override (default: auto-detected from locale)
 * @returns Formatted string like "Today, 2:30 PM", "Yesterday, 10:00 AM", or "Jan 15, 2024 2:30 PM"
 */
export function formatRelativeDate(
  timestamp: number,
  timeFormat?: string
): string {
  try {
    const date = new Date(timestamp);

    // Validate date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }

    const locale = getDeviceLocale();
    const effectiveTimeFormat = timeFormat ?? getTimeFormatString();
    const timeStr = format(date, effectiveTimeFormat, { locale });

    if (isToday(date)) {
      return `Today, ${timeStr}`;
    } else if (isYesterday(date)) {
      return `Yesterday, ${timeStr}`;
    } else {
      // For older dates, use the full date-time format but with custom time format if provided
      const dateTimeFormat = timeFormat
        ? `MMM d, yyyy ${timeFormat}`
        : getDateTimeFormatString();
      return format(date, dateTimeFormat, { locale });
    }
  } catch {
    return 'Unknown time';
  }
}

/**
 * Format a timestamp to a simple time string
 *
 * Convenience wrapper for consistent time formatting across the app.
 * Automatically uses 12-hour or 24-hour format based on device locale.
 *
 * @param timestamp - Unix timestamp in milliseconds or Date object
 * @param formatStr - Optional format string override (default: auto-detected from locale)
 * @returns Formatted time string
 */
export function formatTime(
  timestamp: number | Date,
  formatStr?: string
): string {
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }

    const locale = getDeviceLocale();
    const effectiveFormat = formatStr ?? getTimeFormatString();
    return format(date, effectiveFormat, { locale });
  } catch {
    return 'Unknown time';
  }
}

/**
 * Format a timestamp to a date-time string
 *
 * Convenience wrapper for consistent date-time formatting across the app.
 * Automatically uses 12-hour or 24-hour format based on device locale.
 *
 * @param timestamp - Unix timestamp in milliseconds or Date object
 * @param formatStr - Optional format string override (default: auto-detected from locale)
 * @returns Formatted date-time string like "Jan 15, 2024 2:30 PM"
 */
export function formatDateTime(
  timestamp: number | Date,
  formatStr?: string
): string {
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }

    const locale = getDeviceLocale();
    const effectiveFormat = formatStr ?? getDateTimeFormatString();
    return format(date, effectiveFormat, { locale });
  } catch {
    return 'Unknown time';
  }
}

/**
 * Check if the current locale uses 12-hour time format
 *
 * Exported for cases where consumers need to know the time format preference
 * without formatting a specific time.
 *
 * @returns true if 12-hour format, false if 24-hour format
 */
export { uses12HourClock } from './localeUtils';

/**
 * Get today's date as a string in YYYY-MM-DD format using LOCAL timezone.
 *
 * IMPORTANT: This function uses local date components to avoid UTC conversion issues.
 * Using `new Date().toISOString().split('T')[0]` returns UTC date, which can be
 * a different date than the user's local date (e.g., 11pm PST on Dec 14 would
 * return "2025-12-15" in UTC).
 *
 * Always use this function instead of toISOString() when you need the user's
 * local date for notification scheduling, dose logging, or any user-facing date.
 *
 * @returns Date string in YYYY-MM-DD format in local timezone
 *
 * @example
 * // At 11pm PST on Dec 14, 2025:
 * toLocalDateString()  // "2025-12-14" (correct)
 * new Date().toISOString().split('T')[0]  // "2025-12-15" (WRONG!)
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get a date string for N days from a reference date in YYYY-MM-DD format using LOCAL timezone.
 *
 * IMPORTANT: This function uses local date components to avoid UTC conversion issues.
 * See toLocalDateString() for details.
 *
 * @param days - Number of days to add (positive) or subtract (negative)
 * @param from - Reference date (defaults to today)
 * @returns Date string in YYYY-MM-DD format in local timezone
 *
 * @example
 * // Get tomorrow's date
 * toLocalDateStringOffset(1)  // "2025-12-15" (if today is Dec 14)
 *
 * // Get yesterday's date
 * toLocalDateStringOffset(-1)  // "2025-12-13" (if today is Dec 14)
 */
export function toLocalDateStringOffset(days: number, from: Date = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

/**
 * Create a Date object for a specific date and time in LOCAL timezone.
 *
 * IMPORTANT: This function constructs the date using local time components directly
 * to avoid UTC parsing issues. Using `new Date("YYYY-MM-DD")` parses as UTC midnight,
 * which can result in the wrong local date in western timezones.
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM format (24-hour)
 * @returns Date object for the specified date and time in local timezone
 *
 * @example
 * // Create a date for 2:30 PM on Dec 14, 2025 in local timezone
 * localDateTimeFromStrings("2025-12-14", "14:30")
 */
export function localDateTimeFromStrings(dateString: string, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const [year, month, day] = dateString.split('-').map(Number);
  // Use Date constructor with local time components (month is 0-indexed)
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/**
 * Format time until a future date as a compact relative string
 *
 * Returns a short representation of how long until the given date,
 * useful for showing when scheduled events will occur.
 *
 * @param date - The future date/time
 * @returns Compact relative time like "now", "30m", "2h", "1 day", "3 days"
 *
 * @example
 * // 30 minutes from now
 * formatTimeUntil(futureDate)  // "30m"
 *
 * // 2 hours from now
 * formatTimeUntil(futureDate)  // "2h"
 *
 * // Tomorrow
 * formatTimeUntil(futureDate)  // "1 day"
 */
export function formatTimeUntil(date: Date | number): string {
  try {
    const targetDate = date instanceof Date ? date : new Date(date);

    if (isNaN(targetDate.getTime())) {
      return 'Unknown';
    }

    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  } catch {
    return 'Unknown';
  }
}
