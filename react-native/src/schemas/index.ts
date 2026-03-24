/**
 * Validation Schemas Index
 *
 * Central export point for all validation schemas.
 * These schemas validate data before database writes to ensure data integrity.
 */

// Episode schemas
export {
  EpisodeSchema,
  IntensityReadingSchema,
  EpisodeNoteSchema,
  SymptomLogSchema,
  PainLocationLogSchema,
  PainLocationSchema,
  PainQualitySchema,
  SymptomSchema,
  TriggerSchema,
  EpisodeLocationSchema,
  IntensityValueSchema,
  type ValidatedEpisode,
  type ValidatedIntensityReading,
  type ValidatedEpisodeNote,
  type ValidatedSymptomLog,
  type ValidatedPainLocationLog,
} from './episode.schema';

// Medication schemas
export {
  MedicationSchema,
  MedicationScheduleSchema,
  MedicationDoseSchema,
  MedicationReminderSchema,
  MedicationTypeSchema,
  ScheduleFrequencySchema,
  DoseStatusSchema,
  TimeStringSchema,
  EffectivenessRatingSchema,
  type ValidatedMedication,
  type ValidatedMedicationSchedule,
  type ValidatedMedicationDose,
  type ValidatedMedicationReminder,
} from './medication.schema';

// Daily status schemas
export {
  DailyStatusLogSchema,
  DayStatusSchema,
  YellowDayTypeSchema,
  DateStringSchema,
  type ValidatedDailyStatusLog,
} from './dailyStatus.schema';

// Calendar overlay schemas
export {
  CalendarOverlaySchema,
  OverlayDateStringSchema,
  type ValidatedCalendarOverlay,
} from './overlay.schema';
