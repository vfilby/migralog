import { z } from 'zod';

/**
 * Common Validation Schemas
 *
 * Reusable schemas for common field types used across the application.
 * These ensure consistent validation rules throughout the codebase.
 */

/**
 * Timestamp Schema
 * Validates Unix timestamps (milliseconds since epoch)
 * - Must be a positive integer
 * - Used for: startTime, endTime, timestamp, createdAt, updatedAt, scheduledTime, etc.
 */
export const TimestampSchema = z.number()
  .int('Timestamp must be an integer')
  .positive('Timestamp must be positive');

/**
 * Optional Timestamp Schema
 * Same as TimestampSchema but allows undefined
 */
export const OptionalTimestampSchema = TimestampSchema.optional();

/**
 * Notes Schema
 * Validates text notes/comments
 * - Maximum 5000 characters
 * - Used for: episode notes, medication notes, daily status notes, dose notes
 */
export const NotesSchema = z.string()
  .max(5000, 'Notes must be <= 5000 characters')
  .optional();

/**
 * Required Notes Schema
 * Same as NotesSchema but requires at least 1 character
 */
export const RequiredNotesSchema = z.string()
  .min(1, 'Note cannot be empty')
  .max(5000, 'Note must be <= 5000 characters');
