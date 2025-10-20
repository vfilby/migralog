import { z } from 'zod';
import { TimestampSchema, NotesSchema, RequiredNotesSchema } from './common.schema';

/**
 * Episode Validation Schemas
 *
 * Validates episode data before database writes, ensuring:
 * - Valid timestamps (startTime < endTime)
 * - Intensity values within 0-10 range
 * - Valid enum values for locations, qualities, symptoms, triggers
 * - String length limits
 * - Required fields present
 */

// Pain location enum
export const PainLocationSchema = z.enum([
  'left_eye',
  'right_eye',
  'left_temple',
  'right_temple',
  'left_neck',
  'right_neck',
  'left_head',
  'right_head',
  'left_teeth',
  'right_teeth',
]);

// Pain quality enum
export const PainQualitySchema = z.enum([
  'throbbing',
  'sharp',
  'dull',
  'pressure',
  'stabbing',
  'burning',
]);

// Symptom enum
export const SymptomSchema = z.enum([
  'nausea',
  'vomiting',
  'visual_disturbances',
  'aura',
  'light_sensitivity',
  'sound_sensitivity',
  'smell_sensitivity',
  'dizziness',
  'confusion',
]);

// Trigger enum
export const TriggerSchema = z.enum([
  'stress',
  'lack_of_sleep',
  'weather_change',
  'bright_lights',
  'loud_sounds',
  'alcohol',
  'caffeine',
  'food',
  'hormonal',
  'exercise',
]);

// Episode location (GPS coordinates)
export const EpisodeLocationSchema = z.object({
  latitude: z.number()
    .min(-90, 'Latitude must be >= -90')
    .max(90, 'Latitude must be <= 90'),
  longitude: z.number()
    .min(-180, 'Longitude must be >= -180')
    .max(180, 'Longitude must be <= 180'),
  accuracy: z.number()
    .positive('Accuracy must be positive')
    .optional(),
  timestamp: TimestampSchema,
});

// Intensity value (0-10 scale)
export const IntensityValueSchema = z.number()
  .min(0, 'Intensity must be >= 0')
  .max(10, 'Intensity must be <= 10');

// Episode schema
export const EpisodeSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  startTime: TimestampSchema,
  endTime: TimestampSchema.optional(),
  locations: z.array(PainLocationSchema)
    .default([]),
  qualities: z.array(PainQualitySchema)
    .default([]),
  symptoms: z.array(SymptomSchema)
    .default([]),
  triggers: z.array(TriggerSchema)
    .default([]),
  notes: NotesSchema,
  peakIntensity: IntensityValueSchema.optional(),
  averageIntensity: IntensityValueSchema.optional(),
  location: EpisodeLocationSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).refine(
  (data) => {
    // Validate that endTime is after startTime if both are present
    if (data.endTime && data.startTime) {
      return data.endTime > data.startTime;
    }
    return true;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  }
).refine(
  (data) => {
    // Validate that if averageIntensity is present, it's <= peakIntensity
    if (data.averageIntensity !== undefined && data.peakIntensity !== undefined) {
      return data.averageIntensity <= data.peakIntensity;
    }
    return true;
  },
  {
    message: 'Average intensity cannot be greater than peak intensity',
    path: ['averageIntensity'],
  }
);

// Intensity reading schema
export const IntensityReadingSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  episodeId: z.string().min(1, 'Episode ID is required'),
  timestamp: TimestampSchema,
  intensity: IntensityValueSchema,
  createdAt: TimestampSchema,
});

// Episode note schema
export const EpisodeNoteSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  episodeId: z.string().min(1, 'Episode ID is required'),
  timestamp: TimestampSchema,
  note: RequiredNotesSchema,
  createdAt: TimestampSchema,
});

// Symptom log schema
export const SymptomLogSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  episodeId: z.string().min(1, 'Episode ID is required'),
  symptom: SymptomSchema,
  onsetTime: TimestampSchema,
  resolutionTime: TimestampSchema.optional(),
  severity: IntensityValueSchema.optional(),
  createdAt: TimestampSchema,
}).refine(
  (data) => {
    // Validate that resolutionTime is after onsetTime if present
    if (data.resolutionTime) {
      return data.resolutionTime > data.onsetTime;
    }
    return true;
  },
  {
    message: 'Resolution time must be after onset time',
    path: ['resolutionTime'],
  }
);

// Pain location log schema
export const PainLocationLogSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  episodeId: z.string().min(1, 'Episode ID is required'),
  timestamp: TimestampSchema,
  painLocations: z.array(PainLocationSchema)
    .min(1, 'At least one pain location is required'),
  createdAt: TimestampSchema,
});

// Export types inferred from schemas
export type ValidatedEpisode = z.infer<typeof EpisodeSchema>;
export type ValidatedIntensityReading = z.infer<typeof IntensityReadingSchema>;
export type ValidatedEpisodeNote = z.infer<typeof EpisodeNoteSchema>;
export type ValidatedSymptomLog = z.infer<typeof SymptomLogSchema>;
export type ValidatedPainLocationLog = z.infer<typeof PainLocationLogSchema>;
