import { z } from 'zod';

/**
 * Daily Status Validation Schemas
 *
 * Validates daily status log data before database writes, ensuring:
 * - Valid date format (YYYY-MM-DD)
 * - Valid status and status type enums
 * - Status type only present for yellow days
 * - String length limits
 * - No future dates
 */

// Day status enum
export const DayStatusSchema = z.enum(['green', 'yellow', 'red']);

// Yellow day type enum
export const YellowDayTypeSchema = z.enum([
  'prodrome',
  'postdrome',
  'anxiety',
  'other',
]);

// Date format validation (YYYY-MM-DD)
const DateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;

export const DateStringSchema = z.string()
  .regex(DateFormatRegex, 'Date must be in YYYY-MM-DD format')
  .refine(
    (date) => {
      // Validate that it's a valid date
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    },
    {
      message: 'Invalid date string',
    }
  )
  .refine(
    (date) => {
      // Validate date is not in the future
      const parsedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      parsedDate.setHours(0, 0, 0, 0);
      return parsedDate <= today;
    },
    {
      message: 'Date cannot be in the future',
    }
  );

// Daily status log schema
export const DailyStatusLogSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  date: DateStringSchema,
  status: DayStatusSchema,
  statusType: YellowDayTypeSchema.optional(),
  notes: z.string()
    .max(5000, 'Notes must be <= 5000 characters')
    .optional(),
  prompted: z.boolean(),
  createdAt: z.number()
    .int('Created at must be an integer')
    .positive('Created at must be positive'),
  updatedAt: z.number()
    .int('Updated at must be an integer')
    .positive('Updated at must be positive'),
}).refine(
  (data) => {
    // Status type should only be present for yellow days
    if (data.status !== 'yellow' && data.statusType) {
      return false;
    }
    return true;
  },
  {
    message: 'Status type can only be set for yellow days',
    path: ['statusType'],
  }
);

// Export types inferred from schemas
export type ValidatedDailyStatusLog = z.infer<typeof DailyStatusLogSchema>;
