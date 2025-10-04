// Core data types for the Pain Tracking app

export type PainLocation =
  | 'left_eye'
  | 'right_eye'
  | 'left_temple'
  | 'right_temple'
  | 'left_neck'
  | 'right_neck'
  | 'left_head'
  | 'right_head';

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

export interface Episode {
  id: string;
  startTime: number; // Unix timestamp
  endTime?: number; // Unix timestamp, optional if ongoing
  locations: PainLocation[];
  qualities: PainQuality[];
  symptoms: Symptom[];
  triggers: Trigger[];
  notes?: string;
  peakIntensity?: number; // 0-10
  averageIntensity?: number; // 0-10
  createdAt: number;
  updatedAt: number;
}

export interface IntensityReading {
  id: string;
  episodeId: string;
  timestamp: number;
  intensity: number; // 0-10 scale
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
  startDate?: number;
  endDate?: number;
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
}

export interface MedicationDose {
  id: string;
  medicationId: string;
  timestamp: number;
  amount: number; // Number of dosage units taken
  episodeId?: string; // Link to episode if rescue medication
  effectivenessRating?: number; // 0-10
  timeToRelief?: number; // Minutes
  sideEffects?: string[];
  notes?: string;
  createdAt: number;
}

export interface MedicationReminder {
  id: string;
  medicationId: string;
  scheduledTime: number;
  completed: boolean;
  snoozedUntil?: number;
  completedAt?: number;
}
