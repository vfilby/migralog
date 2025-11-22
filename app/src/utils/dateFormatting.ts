/**
 * Date and time formatting utilities for episodes and daily status
 *
 * These functions provide episode-specific date/time formatting operations
 * that handle edge cases like multi-day episodes and ongoing episodes.
 */

import { format, isSameDay, isToday, isYesterday } from 'date-fns';

/**
 * Format episode time range with intelligent date display
 *
 * Shows just times when start/end are on the target date,
 * or includes dates when the episode spans multiple days.
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

    const targetDateObj = new Date(targetDate + 'T00:00:00');
    const startIsOnTargetDate = isSameDay(startDate, targetDateObj);

    // Helper to format start time for ongoing episodes
    const formatOngoingStart = () =>
      startIsOnTargetDate
        ? `Started at ${format(startDate, 'h:mm a')}`
        : `Started ${format(startDate, 'MMM d, h:mm a')}`;

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
      return `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`;
    }

    // Multi-day episode - show dates with times
    const startStr = startIsOnTargetDate
      ? format(startDate, 'h:mm a')
      : format(startDate, 'MMM d, h:mm a');
    const endStr = endIsOnTargetDate
      ? format(endDate, 'h:mm a')
      : format(endDate, 'MMM d, h:mm a');

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
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param timeFormat - Time format string (default: 'h:mm a')
 * @returns Formatted string like "Today, 2:30 PM", "Yesterday, 10:00 AM", or "Jan 15, 2024 2:30 PM"
 */
export function formatRelativeDate(
  timestamp: number,
  timeFormat: string = 'h:mm a'
): string {
  try {
    const date = new Date(timestamp);

    // Validate date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }

    const timeStr = format(date, timeFormat);

    if (isToday(date)) {
      return `Today, ${timeStr}`;
    } else if (isYesterday(date)) {
      return `Yesterday, ${timeStr}`;
    } else {
      return format(date, `MMM d, yyyy ${timeFormat}`);
    }
  } catch {
    return 'Unknown time';
  }
}

/**
 * Format a timestamp to a simple time string
 *
 * Convenience wrapper for consistent time formatting across the app.
 *
 * @param timestamp - Unix timestamp in milliseconds or Date object
 * @param formatStr - Format string (default: 'h:mm a' for "2:30 PM")
 * @returns Formatted time string
 */
export function formatTime(
  timestamp: number | Date,
  formatStr: string = 'h:mm a'
): string {
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }

    return format(date, formatStr);
  } catch {
    return 'Unknown time';
  }
}

/**
 * Format a timestamp to a date-time string
 *
 * Convenience wrapper for consistent date-time formatting across the app.
 *
 * @param timestamp - Unix timestamp in milliseconds or Date object
 * @param formatStr - Format string (default: 'MMM d, yyyy h:mm a')
 * @returns Formatted date-time string like "Jan 15, 2024 2:30 PM"
 */
export function formatDateTime(
  timestamp: number | Date,
  formatStr: string = 'MMM d, yyyy h:mm a'
): string {
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }

    return format(date, formatStr);
  } catch {
    return 'Unknown time';
  }
}
