import { logger } from '../utils/logger';

/**
 * Database Row Types
 *
 * These types represent the exact structure of rows as they come from SQLite.
 * They use snake_case column names and primitive types (TEXT, INTEGER, REAL).
 *
 * Key differences from domain models:
 * - Column names use snake_case (e.g., start_time instead of startTime)
 * - JSON fields are TEXT (need to be parsed)
 * - Booleans are stored as INTEGER (0 or 1)
 * - NULL values are possible for optional fields
 */

/**
 * Episodes Table Row
 * Represents a migraine episode with pain details and timestamps
 */
export interface EpisodeRow {
  id: string;
  start_time: number;
  end_time: number | null;
  locations: string; // JSON array of PainLocation
  qualities: string; // JSON array of string
  symptoms: string; // JSON array of string
  triggers: string; // JSON array of string
  notes: string | null;
  peak_intensity: number | null;
  average_intensity: number | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_timestamp: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * Intensity Readings Table Row
 * Tracks pain intensity measurements over time for an episode
 */
export interface IntensityReadingRow {
  id: string;
  episode_id: string;
  timestamp: number;
  intensity: number;
  created_at: number;
  updated_at: number;
}

/**
 * Symptom Logs Table Row
 * Records individual symptoms during an episode with timing and severity
 */
export interface SymptomLogRow {
  id: string;
  episode_id: string;
  symptom: string;
  onset_time: number;
  resolution_time: number | null;
  severity: number | null;
  created_at: number;
}

/**
 * Pain Location Logs Table Row
 * Tracks changes in pain location areas over time during an episode
 */
export interface PainLocationLogRow {
  id: string;
  episode_id: string;
  timestamp: number;
  pain_locations: string; // JSON array of PainLocation (e.g., ['left_temple', 'right_eye'])
  created_at: number;
  updated_at: number;
}

/**
 * Episode Notes Table Row
 * Timestamped notes attached to an episode
 */
export interface EpisodeNoteRow {
  id: string;
  episode_id: string;
  timestamp: number;
  note: string;
  created_at: number;
}

/**
 * Medications Table Row
 * Stores medication information including dosage and schedule
 */
export interface MedicationRow {
  id: string;
  name: string;
  type: string; // 'preventative' | 'rescue'
  dosage_amount: number;
  dosage_unit: string;
  default_dosage: number | null;
  schedule_frequency: string | null;
  photo_uri: string | null;
  active: number; // 0 or 1
  notes: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Medication Schedules Table Row
 * Defines when a medication should be taken
 */
export interface MedicationScheduleRow {
  id: string;
  medication_id: string;
  time: string; // HH:mm format in 24-hour time (e.g., "09:30", "14:00"), local timezone
  dosage: number;
  enabled: number; // 0 or 1
  notification_id: string | null;
  reminder_enabled: number; // 0 or 1
}

/**
 * Medication Doses Table Row
 * Records when medication was actually taken
 */
export interface MedicationDoseRow {
  id: string;
  medication_id: string;
  timestamp: number;
  amount: number;
  dosage_amount: number | null; // Snapshot of medication dosage at time of logging
  dosage_unit: string | null; // Snapshot of medication unit at time of logging
  status: string; // 'taken' | 'skipped' | 'missed'
  episode_id: string | null;
  effectiveness_rating: number | null;
  time_to_relief: number | null;
  side_effects: string | null; // JSON array of string
  notes: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Medication Reminders Table Row
 * Tracks scheduled medication reminders and their completion status
 */
export interface MedicationReminderRow {
  id: string;
  medication_id: string;
  scheduled_time: number;
  completed: number; // 0 or 1
  snoozed_until: number | null;
  completed_at: number | null;
}

/**
 * Daily Status Logs Table Row
 * Records daily health status (green/yellow/red)
 */
export interface DailyStatusLogRow {
  id: string;
  date: string; // YYYY-MM-DD format
  status: string; // 'green' | 'yellow' | 'red'
  status_type: string | null;
  notes: string | null;
  prompted: number; // 0 or 1
  created_at: number;
  updated_at: number;
}

/**
 * Type guard to check if a value is a valid array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if a value is a string array
 */
export function isStringArray(value: unknown): value is string[] {
  return isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Type guard to check if a value is a valid PainLocation array
 * Note: We use lenient validation (string array) for backwards compatibility
 * with existing user data that may contain old/deprecated pain location values
 */
export function isPainLocationArray(value: unknown): value is import('../models/types').PainLocation[] {
  // For backwards compatibility, just check if it's a string array
  // Don't validate specific values as users may have old data
  return isStringArray(value);
}

/**
 * Type guard to check if a value is a valid PainQuality array
 * Note: We use lenient validation (string array) for backwards compatibility
 */
export function isPainQualityArray(value: unknown): value is import('../models/types').PainQuality[] {
  // For backwards compatibility, just check if it's a string array
  return isStringArray(value);
}

/**
 * Type guard to check if a value is a valid Symptom array
 * Note: We use lenient validation (string array) for backwards compatibility
 */
export function isSymptomArray(value: unknown): value is import('../models/types').Symptom[] {
  // For backwards compatibility, just check if it's a string array
  return isStringArray(value);
}

/**
 * Type guard to check if a value is a valid Trigger array
 * Note: We use lenient validation (string array) for backwards compatibility
 */
export function isTriggerArray(value: unknown): value is import('../models/types').Trigger[] {
  // For backwards compatibility, just check if it's a string array
  return isStringArray(value);
}

/**
 * Safely parse JSON with type checking
 * Returns the parsed value if valid, or the default value if parsing fails
 */
export function safeJSONParse<T>(
  jsonString: string | null | undefined,
  defaultValue: T,
  validator?: (value: unknown) => value is T
): T {
  if (!jsonString) {
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (validator && !validator(parsed)) {
      logger.warn('[DB] JSON validation failed, using default value. Invalid data:', parsed);
      return defaultValue;
    }
    return parsed as T;
  } catch (error) {
    logger.error('[DB] Failed to parse JSON:', error);
    return defaultValue;
  }
}
