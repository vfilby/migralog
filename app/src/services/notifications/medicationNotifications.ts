// Re-export notification categories for backward compatibility
export { MEDICATION_REMINDER_CATEGORY, MULTIPLE_MEDICATION_REMINDER_CATEGORY } from './notificationCategories';

// Re-export notification action handlers for backward compatibility
export {
  handleTakeNow,
  handleSnooze,
  handleTakeAllNow,
  handleRemindLater,
  handleSkip,
  handleSkipAll,
} from './medicationNotificationHandlers';

// Re-export scheduling functions for backward compatibility
export {
  scheduleNotificationsForDays,
  scheduleGroupedNotificationsForDays,
} from './medicationNotificationScheduling';

// Re-export cancellation/dismissal functions for backward compatibility
export {
  cancelMedicationNotifications,
  cancelScheduledMedicationReminder,
  dismissMedicationNotification,
  cancelNotificationForDate,
} from './medicationNotificationCancellation';

// Re-export reconciliation/management functions for backward compatibility
export {
  calculateNotificationDays,
  fixNotificationScheduleInconsistencies,
  rescheduleAllMedicationNotifications,
  rescheduleAllNotifications,
  topUpNotifications,
  reconcileNotifications,
  rebalanceNotifications,
} from './medicationNotificationReconciliation';
