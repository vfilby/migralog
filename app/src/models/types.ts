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

export type MedicationType = 'preventative' | 'rescue';
export type ScheduleFrequency = 'daily' | 'monthly' | 'quarterly';

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
  defaultDosage?: number; // Number of units (e.g., 3 tablets)
  scheduleFrequency?: ScheduleFrequency; // For preventative: 'daily', 'monthly', 'quarterly'
  photoUri?: string;
  schedule?: MedicationSchedule[];
  active: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MedicationSchedule {
  id: string;
  medicationId: string;
  time: string; // HH:mm format for daily, date for monthly/quarterly
  dosage: number; // Number of doses for this schedule
  enabled: boolean;
  notificationId?: string; // Expo notification identifier
  reminderEnabled?: boolean; // Can disable reminder for this specific schedule
}

export type DoseStatus = 'taken' | 'skipped';

export interface MedicationDose {
  id: string;
  medicationId: string;
  timestamp: number;
  amount: number; // Number of dosage units taken (e.g., 2 pills)
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
