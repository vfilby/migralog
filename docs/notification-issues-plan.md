# Notification Issues Investigation & Fix Plan

## Overview

Three issues were reported with the notification system:
1. Follow-up notifications not sent as critical alerts
2. Logging medication doesn't dismiss all existing notifications
3. Medication grouping not working

## Issue 1: Critical Alerts Missing from Follow-up Notifications

### Root Cause

The **one-time notification system** is missing the iOS `interruptionLevel: 'critical'` property. While `critical: true` is set, iOS requires BOTH properties for proper critical alert behavior.

### Affected Code

| File | Function | Line | Issue |
|------|----------|------|-------|
| `medicationNotifications.ts` | `scheduleNotificationsForDays()` | ~1815-1831 | Follow-up notifications missing `interruptionLevel: 'critical'` |
| `medicationNotifications.ts` | `topUpNotifications()` | ~1940-1960 | Completely missing critical alert handling |

### Working Reference

The daily trigger system (`scheduleFollowUpForScheduledNotification()` at line 579) correctly sets both:
```typescript
...(useCriticalAlerts && { critical: true } as any),
...(interruptionLevel && { interruptionLevel } as any),
```

### Fix Required

Add `interruptionLevel: 'critical'` alongside `critical: true` in both `scheduleNotificationsForDays()` and `topUpNotifications()`:

```typescript
// In follow-up notification scheduling:
...(effectiveSettings.criticalAlertsEnabled && { critical: true } as unknown as Record<string, unknown>),
...(effectiveSettings.criticalAlertsEnabled && { interruptionLevel: 'critical' } as unknown as Record<string, unknown>),
```

---

## Issue 2: Notification Dismissal Gaps When Logging Doses

### Root Cause

The app has **two overlapping notification systems** that are not properly coordinated:

1. **One-Time Notification System** (database-backed in `scheduled_notifications` table)
   - Cancelled via `cancelNotificationForDate()`
   - IS properly called when logging doses

2. **Foreground Follow-Up System** (memory-backed in `followUpNotifications` Map)
   - Cancelled via `cancelFollowUpReminder()`
   - NOT called when logging doses from the app

### Affected Code

| File | Function | Line | Issue |
|------|----------|------|-------|
| `medicationStore.ts` | `logDose()` | ~265-278 | Missing call to `cancelFollowUpReminder()` |
| `notificationService.ts` | `scheduleFollowUpReminder()` | ~710-804 | Follow-ups not persisted across restarts |
| `notificationService.ts` | `cancelFollowUpReminder()` | ~809-820 | No fallback when Map entry is missing |

### Problematic Scenarios

**Scenario 1: Log dose from app while foreground notification active**
1. Notification received in foreground → `scheduleFollowUpReminder()` stores in Map
2. User logs dose from app
3. `medicationStore.logDose()` cancels one-time notifications ✓
4. MISSING: Does not cancel foreground follow-up ✗
5. Result: Foreground follow-up fires later

**Scenario 2: Log dose after app restart**
1. Notification received, follow-up scheduled in Map
2. App is killed/restarted
3. Map is now empty (not persisted)
4. User logs dose → `cancelFollowUpReminder()` finds nothing
5. Result: Follow-up fires because its ID was lost

### Fixes Required

1. **In `medicationStore.logDose()`**: Add call to cancel foreground follow-ups
   ```typescript
   // After dismissMedicationNotification:
   await notificationService.cancelForegroundFollowUps(medicationId, scheduleId);
   ```

2. **Create public method in NotificationService**: Expose foreground follow-up cancellation
   ```typescript
   public async cancelForegroundFollowUps(medicationId: string, scheduleId: string): Promise<void> {
     const key = `${medicationId}:${scheduleId}`;
     await this.cancelFollowUpReminder(key);
   }
   ```

3. **Add fallback mechanism**: Scan scheduled notifications to find and cancel any matching the logged medication when Map entry is missing

4. **Consider persisting follow-ups**: Use `scheduled_notifications` table to track foreground follow-ups so they survive app restarts

---

## Issue 3: Medication Grouping Not Working

### Root Cause

The grouping logic in `rescheduleAllNotifications()` is sound, but there are potential **timing issues**:

1. When `addSchedule()` saves a new schedule, `rescheduleAllMedicationNotifications()` runs
2. If the database commit isn't complete before grouping logic queries medications, the new schedule won't be included
3. Race conditions between saving and rescheduling

### Affected Code

| File | Function | Line | Issue |
|------|----------|------|-------|
| `medicationStore.ts` | `addSchedule()` | ~659-683 | No direct notification scheduling |
| `medicationNotifications.ts` | `rescheduleAllNotifications()` | ~1392-1475 | May query before DB commit completes |
| `EditMedicationScreen.tsx` | save handler | ~396 | Immediate call may race with DB |

### Grouping Logic (Working)

The grouping logic at lines 1415-1424 correctly:
- Groups medications by `schedule.time`
- Creates single notifications for 1 medication
- Creates grouped notifications for 2+ medications at same time

### Fixes Required

1. **Ensure database commit before rescheduling**:
   - Add await/sync point after `addSchedule()` before calling `rescheduleAllMedicationNotifications()`
   - Or use transaction completion callback

2. **Add debugging/logging**:
   - Log what medications are being grouped
   - Log the resulting notification IDs
   - This will help verify if grouping is actually running

3. **Consider direct scheduling in addSchedule()**:
   - Instead of relying on full reschedule, have `addSchedule()` trigger grouping check for its time slot

---

## Implementation Priority

1. **Issue 1 (Critical Alerts)** - Simple fix, high impact
   - Add missing `interruptionLevel` properties
   - ~15 minutes of work

2. **Issue 2 (Dismissal Gaps)** - Medium complexity, high impact
   - Add public cancellation method
   - Call from `logDose()`
   - Add fallback scanning
   - ~1-2 hours of work

3. **Issue 3 (Grouping)** - Investigation needed, medium impact
   - Add logging first to verify actual behavior
   - May require database sync improvements
   - ~2-3 hours including investigation

---

## Testing Plan

### Issue 1 Testing
1. Enable critical alerts for a medication
2. Allow reminder to fire
3. Wait for follow-up notification
4. Verify follow-up displays as critical alert (bypasses Do Not Disturb)

### Issue 2 Testing
1. Let notification fire while app is in foreground
2. Log dose from the app (not notification action)
3. Verify no follow-up notification appears
4. Test after app restart as well

### Issue 3 Testing
1. Create two medications with same schedule time (e.g., 09:00)
2. Enable notifications for both
3. Wait for 09:00 notification
4. Verify single grouped notification appears (not two separate)
