import { z } from 'zod';
import { TimestampSchema, NotesSchema } from './common.schema';

/**
 * Calendar Overlay Validation Schemas
 *
 * Validates calendar overlay data before database writes, ensuring:
 * - Valid date format (YYYY-MM-DD)
 * - String length limits
 * - End date is on or after start date
 */

// Date format validation (YYYY-MM-DD)
const DateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;

export const OverlayDateStringSchema = z.string()
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
  );

// Calendar overlay schema
// endDate is optional - when undefined/null, the overlay is ongoing/open-ended
export const CalendarOverlaySchema = z.object({
  id: z.string().min(1, 'ID is required'),
  startDate: OverlayDateStringSchema,
  endDate: OverlayDateStringSchema.optional(),
  label: z.string().min(1, 'Label is required').max(200, 'Label must be <= 200 characters'),
  notes: NotesSchema,
  excludeFromStats: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).refine(
  (data) => data.endDate === undefined || data.endDate >= data.startDate,
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  }
);

// Export types inferred from schemas
export type ValidatedCalendarOverlay = z.infer<typeof CalendarOverlaySchema>;
