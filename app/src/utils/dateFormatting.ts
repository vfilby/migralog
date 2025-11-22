/**
 * Date and time formatting utilities for episodes and daily status
 *
 * These functions provide episode-specific date/time formatting operations
 * that handle edge cases like multi-day episodes and ongoing episodes.
 */

import { format, isSameDay } from 'date-fns';

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
