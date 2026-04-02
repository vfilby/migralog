/**
 * Episode validation utilities
 */

export interface EpisodeEndTimeValidation {
  isValid: boolean;
  error?: string;
}

/**
 * Validates that an episode end time is valid relative to its start time
 *
 * @param startTime - Episode start timestamp in milliseconds
 * @param endTime - Proposed end timestamp in milliseconds
 * @returns Validation result with isValid flag and optional error message
 */
export function validateEpisodeEndTime(
  startTime: number,
  endTime: number
): EpisodeEndTimeValidation {
  if (endTime < startTime) {
    return {
      isValid: false,
      error: 'End time cannot be before the episode start time.',
    };
  }

  return {
    isValid: true,
  };
}
