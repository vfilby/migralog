import { 
  IntensityReading, 
  EpisodeNote, 
  MedicationDose, 
  Medication, 
  SymptomLog, 
  PainLocationLog, 
  PainLocation 
} from '../../models/types';

// Type definitions for episode components
export type MedicationDoseWithDetails = MedicationDose & {
  medication?: Medication;
};

export interface SymptomChange {
  symptom: string;
  changeType: 'added' | 'removed';
}

export interface SymptomEventData {
  log?: SymptomLog;
  changes: SymptomChange[];
}

export interface PainLocationChange {
  location: PainLocation;
  changeType: 'added' | 'removed' | 'unchanged';
}

export interface PainLocationEventData {
  log?: PainLocationLog;
  changes: PainLocationChange[];
}

export interface TimelineEvent {
  id: string;
  type: 'intensity' | 'note' | 'symptom' | 'symptom_initial' | 'pain_location' | 'pain_location_initial' | 'medication' | 'end';
  timestamp: number;
  data: IntensityReading | EpisodeNote | MedicationDoseWithDetails | SymptomEventData | PainLocationEventData | null;
}

export interface GroupedTimelineEvent {
  timestamp: number;
  events: TimelineEvent[];
}

export interface DayGroup {
  date: number;
  dateLabel: string;
  events: TimelineEvent[];
}

// Constants
export const PAIN_LOCATIONS: { value: PainLocation; label: string; side: 'left' | 'right' }[] = [
  { value: 'left_eye', label: 'Eye', side: 'left' },
  { value: 'left_temple', label: 'Temple', side: 'left' },
  { value: 'left_neck', label: 'Neck', side: 'left' },
  { value: 'left_head', label: 'Head', side: 'left' },
  { value: 'left_teeth', label: 'Teeth/Jaw', side: 'left' },
  { value: 'right_eye', label: 'Eye', side: 'right' },
  { value: 'right_temple', label: 'Temple', side: 'right' },
  { value: 'right_neck', label: 'Neck', side: 'right' },
  { value: 'right_head', label: 'Head', side: 'right' },
  { value: 'right_teeth', label: 'Teeth/Jaw', side: 'right' },
];