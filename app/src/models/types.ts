// Core data types for the Pain Tracking app

export type PainLocation =
  | 'left_eye'
  | 'right_eye'
  | 'left_temple'
  | 'right_temple'
  | 'left_neck'
  | 'right_neck'
  | 'left_head'
  | 'right_head'
  | 'left_teeth'
  | 'right_teeth';

export type PainQuality =
  | 'throbbing'
  | 'sharp'
  | 'dull'
  | 'pressure'
  | 'stabbing'
  | 'burning';

export type Symptom =
  | 'nausea'
  | 'vomiting'
  | 'visual_disturbances'
  | 'aura'
  | 'light_sensitivity'
  | 'sound_sensitivity'
  | 'smell_sensitivity'
  | 'dizziness'
  | 'confusion';

export type Trigger =
  | 'stress'
  | 'lack_of_sleep'
  | 'weather_change'
  | 'bright_lights'
  | 'loud_sounds'
  | 'alcohol'
  | 'caffeine'
  | 'food'
  | 'hormonal'
  | 'exercise';

export type MedicationType = 'preventative' | 'rescue' | 'other';
export type ScheduleFrequency = 'daily' | 'monthly' | 'quarterly';
export type MedicationCategory = 'otc' | 'nsaid' | 'triptan' | 'cgrp' | 'preventive' | 'supplement' | 'other';

export interface EpisodeLocation {
  latitude: number;
  longitude: number;
  accuracy?: number; // meters
  timestamp: number; // when location was captured
}

export interface Episode {
  id: string;
  startTime: number; // Unix timestamp
  endTime?: number; // Unix timestamp, optional if ongoing
  locations: PainLocation[];
  qualities: PainQuality[];
  symptoms: Symptom[];
  triggers: Trigger[];
  notes?: string;
  location?: EpisodeLocation; // GPS location when episode started
  createdAt: number;
  updatedAt: number;
}

export interface IntensityReading {
  id: string;
  episodeId: string;
  timestamp: number;
  intensity: number; // 0-10 scale
  createdAt: number;
  updatedAt: number;
}

export interface EpisodeNote {
  id: string;
  episodeId: string;
  timestamp: number;
  note: string;
  createdAt: number;
}

export interface SymptomLog {
  id: string;
  episodeId: string;
  symptom: Symptom;
  onsetTime: number;
  resolutionTime?: number;
  severity?: number; // 0-10 scale
  createdAt: number;
}

export interface PainLocationLog {
  id: string;
  episodeId: string;
  timestamp: number;
  painLocations: PainLocation[];  // Pain location areas (e.g., 'left_temple', 'right_eye')
  createdAt: number;
  updatedAt: number;
}

export interface Medication {
  id: string;
  name: string;
  type: MedicationType;
  dosageAmount: number;
  dosageUnit: string; // 'mg', 'ml', 'tablets', etc.
  defaultQuantity?: number; // Number of units (e.g., 3 tablets)
  scheduleFrequency?: ScheduleFrequency; // For preventative: 'daily', 'monthly', 'quarterly'
  photoUri?: string;
  schedule?: MedicationSchedule[];
  active: boolean;
  notes?: string;
  category?: MedicationCategory; // Medication category for tracking and filtering
  createdAt: number;
  updatedAt: number;
}

export interface MedicationSchedule {
  id: string;
  medicationId: string;
  time: string; // HH:mm format for daily, date for monthly/quarterly
  timezone: string; // IANA timezone (e.g., 'America/New_York', 'America/Los_Angeles')
  dosage: number; // Number of doses for this schedule
  enabled: boolean;
  notificationId?: string; // Expo notification identifier
  reminderEnabled?: boolean; // Can disable reminder for this specific schedule
}

export type DoseStatus = 'taken' | 'skipped';

export interface MedicationDose {
  id: string;
  medicationId: string;
  scheduleId?: string; // Link to the schedule that triggered this dose (for preventative medications)
  timestamp: number;
  quantity: number; // Number of dosage units taken (e.g., 2 pills)
  dosageAmount?: number; // Dosage per unit at time of logging (e.g., 50mg per pill) - snapshot for historical accuracy
  dosageUnit?: string; // Unit of dosage at time of logging (e.g., 'mg', 'ml') - snapshot for historical accuracy
  status?: DoseStatus; // Whether dose was taken or skipped (defaults to 'taken')
  episodeId?: string; // Link to episode if rescue medication
  effectivenessRating?: number; // 0-10
  timeToRelief?: number; // Minutes
  sideEffects?: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MedicationReminder {
  id: string;
  medicationId: string;
  scheduledTime: number;
  completed: boolean;
  snoozedUntil?: number;
  completedAt?: number;
}

export type DayStatus = 'green' | 'yellow' | 'red';

// Time range options for analytics filtering
// Define as const array first, then derive type - enables iteration at runtime
export const TIME_RANGE_OPTIONS = [7, 30, 90] as const;
export type TimeRangeDays = (typeof TIME_RANGE_OPTIONS)[number];

export type YellowDayType =
  | 'prodrome'      // Warning signs before episode
  | 'postdrome'     // Recovery period after episode
  | 'anxiety'       // Worried about potential episode
  | 'other';        // Other non-clear states

export interface DailyStatusLog {
  id: string;
  date: string;           // YYYY-MM-DD format
  status: DayStatus;
  statusType?: YellowDayType;  // Only for yellow days
  notes?: string;
  prompted: boolean;      // Was this from daily prompt?
  createdAt: number;
  updatedAt: number;
}

// Backup/Restore types
export interface BackupMetadata {
  id: string;
  timestamp: number;
  version: string;
  schemaVersion: number;
  episodeCount: number;
  medicationCount: number;
  fileSize: number;
  fileName: string;
  // Note: JSON restore was removed in Issue #185, but JSON creation still exists
  // for pre-migration backups and data exports. Only snapshot backups can be restored.
  backupType: 'snapshot' | 'json';
}

export interface BackupData {
  metadata: Omit<BackupMetadata, 'fileSize' | 'fileName' | 'backupType'>;
  schemaSQL?: string; // Complete CREATE TABLE statements for the schema at backup time (optional for backward compatibility)
  episodes: Episode[];
  episodeNotes?: EpisodeNote[]; // Optional for backward compatibility
  intensityReadings?: IntensityReading[]; // Optional for backward compatibility
  dailyStatusLogs?: DailyStatusLog[]; // Optional for backward compatibility
  medications: Medication[];
  medicationDoses: MedicationDose[];
  medicationSchedules: MedicationSchedule[];
}
