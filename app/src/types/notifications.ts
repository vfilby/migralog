/**
 * Notification Types for One-Time Notification Scheduling
 *
 * This module defines types for tracking scheduled notifications in the database.
 * Part of the notification suppression system that uses one-time triggers instead
 * of daily recurring notifications.
 */

/**
 * Type of notification - reminder, follow-up, or daily check-in
 */
export type NotificationType = 'reminder' | 'follow_up' | 'daily_checkin';

/**
 * Source type - whether notification is for medication or daily check-in
 */
export type NotificationSourceType = 'medication' | 'daily_checkin';

/**
 * Mapping between a scheduled OS notification and database record
 *
 * This allows us to:
 * - Cancel specific day's notifications when medication is logged
 * - Track which notifications are scheduled for reconciliation
 * - Handle grouped notifications (multiple meds at same time)
 * - Track daily check-in notifications
 * - Cross-reference notifications for dismissal using multiple matching strategies
 */
export interface ScheduledNotificationMapping {
  /** Unique identifier for this mapping */
  id: string;

  /** ID of the medication this notification is for (null for daily check-in) */
  medicationId: string | null;

  /** ID of the medication schedule (null for daily check-in) */
  scheduleId: string | null;

  /** Date in YYYY-MM-DD format that this notification is for */
  date: string;

  /** Expo notification ID returned by scheduleNotificationAsync */
  notificationId: string;

  /** Whether this is a reminder, follow-up, or daily check-in notification */
  notificationType: NotificationType;

  /** Whether this notification is part of a grouped notification */
  isGrouped: boolean;

  /** Time key for grouping (HH:MM format), used to identify grouped notifications */
  groupKey?: string;

  /** Source type - 'medication' or 'daily_checkin' */
  sourceType: NotificationSourceType;

  /** Medication name for text-based matching fallback */
  medicationName?: string;

  /** Exact trigger time for time-based matching */
  scheduledTriggerTime?: Date;

  /** Notification title for content matching */
  notificationTitle?: string;

  /** Notification body for content matching */
  notificationBody?: string;

  /** Category identifier for category-based matching */
  categoryIdentifier?: string;

  /** When this mapping was created */
  createdAt?: string;
}

/**
 * Input for creating a new notification mapping (without auto-generated fields)
 * sourceType defaults to 'medication' if not specified
 */
export type ScheduledNotificationMappingInput = Omit<
  ScheduledNotificationMapping,
  'id' | 'notificationId' | 'createdAt' | 'sourceType'
> & {
  sourceType?: NotificationSourceType;
};

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
