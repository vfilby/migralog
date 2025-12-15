// Main notification service
export {
  notificationService,
  handleIncomingNotification,
} from './notificationService';

// Re-export types
export type { NotificationPermissions } from './permissionManager';

// Re-export specialized functions for testing or advanced use
export {
  requestPermissions,
  getPermissions,
} from './permissionManager';

export {
  scheduleNotification,
  cancelNotification,
  cancelAllNotifications,
  getAllScheduledNotifications,
  dismissNotification,
  getPresentedNotifications,
} from './notificationScheduler';

export {
  MEDICATION_REMINDER_CATEGORY,
  MULTIPLE_MEDICATION_REMINDER_CATEGORY,
  handleTakeNow,
  handleSnooze,
  handleTakeAllNow,
  handleRemindLater,
  scheduleSingleNotification,
  scheduleMultipleNotification,
  cancelMedicationNotifications,
  cancelScheduledMedicationReminder,
  dismissMedicationNotification,
  rescheduleAllMedicationNotifications,
  rescheduleAllNotifications,
  fixNotificationScheduleInconsistencies,
} from './medicationNotifications';

export {
  handleDailyCheckinNotification,
} from './dailyCheckinNotifications';
