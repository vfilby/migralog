/**
 * Notification Types for One-Time Notification Scheduling
 *
 * This module defines types for tracking scheduled notifications in the database.
 * Part of the notification suppression system that uses one-time triggers instead
 * of daily recurring notifications.
 */

/**
 * Type of notification - either a reminder or a follow-up reminder
 */
export type NotificationType = 'reminder' | 'followup';

/**
 * Mapping between a scheduled OS notification and database record
 *
 * This allows us to:
 * - Cancel specific day's notifications when medication is logged
 * - Track which notifications are scheduled for reconciliation
 * - Handle grouped notifications (multiple meds at same time)
 */
export interface ScheduledNotificationMapping {
  /** Unique identifier for this mapping */
  id: string;

  /** ID of the medication this notification is for */
  medicationId: string;

  /** ID of the medication schedule */
  scheduleId: string;

  /** Date in YYYY-MM-DD format that this notification is for */
  date: string;

  /** Expo notification ID returned by scheduleNotificationAsync */
  notificationId: string;

  /** Whether this is a reminder or follow-up notification */
  notificationType: NotificationType;

  /** Whether this notification is part of a grouped notification */
  isGrouped: boolean;

  /** Time key for grouping (HH:MM format), used to identify grouped notifications */
  groupKey?: string;

  /** When this mapping was created */
  createdAt?: string;
}

/**
 * Input for creating a new notification mapping (without auto-generated fields)
 */
export type ScheduledNotificationMappingInput = Omit<
  ScheduledNotificationMapping,
  'id' | 'notificationId' | 'createdAt'
>;

/**
 * Data structure for scheduled notification requests
 */
export interface NotificationScheduleRequest {
  /** Notification content */
  content: {
    title: string;
    body: string;
    data: Record<string, unknown>;
    categoryIdentifier: string;
    sound: boolean;
  };

  /** When the notification should fire */
  trigger: Date;

  /** Mapping data to track the notification */
  mapping: ScheduledNotificationMappingInput;
}
