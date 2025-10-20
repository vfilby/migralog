import { z } from 'zod';

/**
 * Medication Validation Schemas
 *
 * Validates medication data before database writes, ensuring:
 * - Valid dosage amounts (positive numbers)
 * - Valid medication types and frequencies
 * - Time format validation (HH:mm)
 * - Effectiveness ratings within 0-10 range
 * - String length limits
 * - Date range validations (startDate < endDate)
 */

// Medication type enum
export const MedicationTypeSchema = z.enum(['preventative', 'rescue']);

// Schedule frequency enum
export const ScheduleFrequencySchema = z.enum(['daily', 'monthly', 'quarterly']);

// Dose status enum
export const DoseStatusSchema = z.enum(['taken', 'skipped']);

// Time format validation (HH:mm in 24-hour format)
const TimeFormatRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

export const TimeStringSchema = z.string()
  .regex(TimeFormatRegex, 'Time must be in HH:mm format (24-hour)')
  .refine(
    (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
    },
    {
      message: 'Invalid time: hours must be 0-23, minutes must be 0-59',
    }
  );

// Medication schema
export const MedicationSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string()
    .min(1, 'Medication name is required')
    .max(200, 'Medication name must be <= 200 characters')
    .trim(),
  type: MedicationTypeSchema,
  dosageAmount: z.number()
    .positive('Dosage amount must be positive')
    .finite('Dosage amount must be a finite number'),
  dosageUnit: z.string()
    .min(1, 'Dosage unit is required')
    .max(50, 'Dosage unit must be <= 50 characters')
    .trim(),
  defaultDosage: z.number()
    .positive('Default dosage must be positive')
    .finite('Default dosage must be a finite number')
    .optional(),
  scheduleFrequency: ScheduleFrequencySchema.optional(),
  photoUri: z.string()
    .max(500, 'Photo URI must be <= 500 characters')
    .optional(),
  startDate: z.number()
    .int('Start date must be an integer')
    .positive('Start date must be positive')
    .optional(),
  endDate: z.number()
    .int('End date must be an integer')
    .positive('End date must be positive')
    .optional(),
  active: z.boolean(),
  notes: z.string()
    .max(5000, 'Notes must be <= 5000 characters')
    .optional(),
  createdAt: z.number()
    .int('Created at must be an integer')
    .positive('Created at must be positive'),
  updatedAt: z.number()
    .int('Updated at must be an integer')
    .positive('Updated at must be positive'),
}).refine(
  (data) => {
    // Validate that endDate is after startDate if both are present
    if (data.endDate && data.startDate) {
      return data.endDate > data.startDate;
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
).refine(
  (data) => {
    // Preventative medications should have a schedule frequency
    if (data.type === 'preventative' && !data.scheduleFrequency) {
      return false;
    }
    return true;
  },
  {
    message: 'Preventative medications must have a schedule frequency',
    path: ['scheduleFrequency'],
  }
);

// Medication schedule schema
export const MedicationScheduleSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  medicationId: z.string().min(1, 'Medication ID is required'),
  time: TimeStringSchema,
  dosage: z.number()
    .positive('Dosage must be positive')
    .finite('Dosage must be a finite number'),
  enabled: z.boolean(),
  notificationId: z.string()
    .max(500, 'Notification ID must be <= 500 characters')
    .optional(),
  reminderEnabled: z.boolean().optional(),
});

// Effectiveness rating (0-10 scale)
export const EffectivenessRatingSchema = z.number()
  .min(0, 'Effectiveness rating must be >= 0')
  .max(10, 'Effectiveness rating must be <= 10');

// Medication dose schema
export const MedicationDoseSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  medicationId: z.string().min(1, 'Medication ID is required'),
  timestamp: z.number()
    .int('Timestamp must be an integer')
    .positive('Timestamp must be positive'),
  amount: z.number()
    .nonnegative('Amount must be non-negative') // Allow 0 for skipped doses
    .finite('Amount must be a finite number'),
  status: DoseStatusSchema.optional(),
  episodeId: z.string()
    .min(1, 'Episode ID cannot be empty when provided')
    .optional(),
  effectivenessRating: EffectivenessRatingSchema.optional(),
  timeToRelief: z.number()
    .int('Time to relief must be an integer')
    .positive('Time to relief must be positive')
    .max(1440, 'Time to relief must be <= 1440 minutes (24 hours)')
    .optional(),
  sideEffects: z.array(z.string().max(200, 'Side effect must be <= 200 characters'))
    .optional(),
  notes: z.string()
    .max(5000, 'Notes must be <= 5000 characters')
    .optional(),
  createdAt: z.number()
    .int('Created at must be an integer')
    .positive('Created at must be positive'),
}).refine(
  (data) => {
    // Skipped doses can have amount 0, but taken doses must have positive amount
    if (data.status === 'skipped') {
      return true; // Allow any amount for skipped doses
    }
    // For taken doses (or no status specified), amount must be positive
    return data.amount > 0;
  },
  {
    message: 'Amount must be positive for taken doses',
    path: ['amount'],
  }
);

// Medication reminder schema
export const MedicationReminderSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  medicationId: z.string().min(1, 'Medication ID is required'),
  scheduledTime: z.number()
    .int('Scheduled time must be an integer')
    .positive('Scheduled time must be positive'),
  completed: z.boolean(),
  snoozedUntil: z.number()
    .int('Snoozed until must be an integer')
    .positive('Snoozed until must be positive')
    .optional(),
  completedAt: z.number()
    .int('Completed at must be an integer')
    .positive('Completed at must be positive')
    .optional(),
}).refine(
  (data) => {
    // If completed is true, completedAt should be present
    if (data.completed && !data.completedAt) {
      return false;
    }
    return true;
  },
  {
    message: 'Completed at timestamp is required when reminder is completed',
    path: ['completedAt'],
  }
).refine(
  (data) => {
    // If snoozedUntil is present, it should be after scheduledTime
    if (data.snoozedUntil) {
      return data.snoozedUntil > data.scheduledTime;
    }
    return true;
  },
  {
    message: 'Snoozed until time must be after scheduled time',
    path: ['snoozedUntil'],
  }
);

// Export types inferred from schemas
export type ValidatedMedication = z.infer<typeof MedicationSchema>;
export type ValidatedMedicationSchedule = z.infer<typeof MedicationScheduleSchema>;
export type ValidatedMedicationDose = z.infer<typeof MedicationDoseSchema>;
export type ValidatedMedicationReminder = z.infer<typeof MedicationReminderSchema>;
