# Notification Suppression Implementation Plan

This plan implements the "N One-Time Notifications" approach from `notification-suppression-research.md`. Each phase can be implemented and tested independently.

---

## Phase 1: Database Schema

### 1.1 Add Migration v20

**File:** `app/src/database/migrations.ts`
**Location:** After `migrateToV19()` function (around line 160)

Add new migration:

```typescript
async function migrateToV20(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS scheduled_notifications (
      id TEXT PRIMARY KEY,
      medication_id TEXT NOT NULL,
      schedule_id TEXT NOT NULL,
      date TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      notification_type TEXT NOT NULL DEFAULT 'reminder',
      is_grouped INTEGER DEFAULT 0,
      group_key TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
      FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE CASCADE,
      UNIQUE(medication_id, schedule_id, date, notification_type)
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_date
      ON scheduled_notifications(date);
    CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_group
      ON scheduled_notifications(group_key, date);
    CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_notification_id
      ON scheduled_notifications(notification_id);
  `);
}
```

**File:** `app/src/database/schema.ts`
**Location:** Line 3

Update schema version:
```typescript
export const SCHEMA_VERSION = 20;
```

### 1.2 Create Repository

**File:** `app/src/database/scheduledNotificationRepository.ts` (new file)

Create CRUD operations:
- `saveMapping(mapping: ScheduledNotificationMapping): Promise<void>`
- `saveMappingsBatch(mappings: ScheduledNotificationMapping[]): Promise<void>`
- `getMapping(medicationId, scheduleId, date, type?): Promise<ScheduledNotificationMapping | null>`
- `getMappingsByNotificationId(notificationId): Promise<ScheduledNotificationMapping[]>`
- `getMappingsBySchedule(medicationId, scheduleId): Promise<ScheduledNotificationMapping[]>`
- `getMappingsByGroupKey(groupKey, date): Promise<ScheduledNotificationMapping[]>`
- `deleteMapping(id): Promise<void>`
- `deleteMappingsBySchedule(medicationId, scheduleId): Promise<void>`
- `countBySchedule(medicationId, scheduleId): Promise<number>`
- `getLastScheduledDate(medicationId, scheduleId): Promise<string | null>`
- `getAllMappings(): Promise<ScheduledNotificationMapping[]>`

### 1.3 Add Types

**File:** `app/src/types/notifications.ts` (new file)

```typescript
export type NotificationType = 'reminder' | 'followup';

export interface ScheduledNotificationMapping {
  id: string;
  medicationId: string;
  scheduleId: string;
  date: string;              // "2024-03-15"
  notificationId: string;    // Expo notification ID
  notificationType: NotificationType;
  isGrouped: boolean;
  groupKey?: string;         // "09:20" for grouping
  createdAt?: string;
}
```

---

## Phase 2: Core Scheduling Functions

### 2.1 Create Atomic Scheduling Helper

**File:** `app/src/services/notifications/notificationScheduler.ts`
**Location:** After existing functions (around line 120)

Add:
```typescript
export async function scheduleNotificationAtomic(
  content: Notifications.NotificationContentInput,
  trigger: Date,
  mapping: Omit<ScheduledNotificationMapping, 'id' | 'notificationId' | 'createdAt'>
): Promise<string>
```

This function:
1. Schedules the notification
2. Saves the mapping
3. On DB failure, cancels the notification (compensating transaction)

### 2.2 Create Batch Scheduling Helper

**File:** `app/src/services/notifications/notificationScheduler.ts`
**Location:** After `scheduleNotificationAtomic`

Add:
```typescript
export async function scheduleNotificationsBatch(
  notifications: Array<{
    content: Notifications.NotificationContentInput;
    trigger: Date;
    mapping: Omit<ScheduledNotificationMapping, 'id' | 'notificationId' | 'createdAt'>;
  }>
): Promise<string[]>
```

### 2.3 Update scheduleSingleNotification

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** Line 599-666

Change from:
```typescript
trigger: {
  type: Notifications.SchedulableTriggerInputTypes.DAILY,
  hour: hours,
  minute: minutes,
}
```

To one-time trigger with atomic scheduling. The function signature changes to accept a `targetDate` parameter.

### 2.4 Update scheduleMultipleNotification

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** Line 671-761

Same change as 2.3 - switch from DAILY to one-time trigger with date parameter.

### 2.5 Create scheduleNotificationsForDays

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** After `scheduleMultipleNotification` (around line 762)

New function that:
1. Calculates N based on iOS 64 limit
2. Loops through N days
3. For each day, checks for grouping with other medications
4. Calls atomic scheduling helper
5. Schedules follow-ups if enabled

---

## Phase 3: Cancellation Logic

### 3.1 Create cancelNotificationForDate

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** After `cancelScheduledMedicationReminder` (around line 850)

New function:
```typescript
export async function cancelNotificationForDate(
  medicationId: string,
  scheduleId: string,
  date: string,
  notificationType: NotificationType = 'reminder'
): Promise<void>
```

This function:
1. Looks up mapping by (medicationId, scheduleId, date, type)
2. If not grouped: cancel notification, delete mapping
3. If grouped: cancel notification, recreate for remaining meds, update their mappings

### 3.2 Integrate into logDose

**File:** `app/src/store/medicationStore.ts`
**Location:** Line 268-270 (inside `logDose` action)

Current code:
```typescript
if (dose.scheduleId) {
  await notificationService.dismissMedicationNotification(dose.medicationId, dose.scheduleId);
}
```

Add after dismiss:
```typescript
// Cancel today's scheduled reminder and follow-up
const today = new Date().toISOString().split('T')[0];
await medicationNotifications.cancelNotificationForDate(dose.medicationId, dose.scheduleId, today, 'reminder');
await medicationNotifications.cancelNotificationForDate(dose.medicationId, dose.scheduleId, today, 'followup');
```

### 3.3 Update handleTakeNow

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** Line 23-111

After logging the dose (around line 80), add cancellation for today's follow-up and call top-up.

### 3.4 Update handleTakeAllNow

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** Line 198-351

After logging all doses (around line 300), add cancellation for all medications' follow-ups and call top-up.

---

## Phase 4: Skip Action

### 4.1 Add Skip Button to Single Medication Category

**File:** `app/src/services/notifications/notificationService.ts`
**Location:** Line 440-453 (MEDICATION_REMINDER_CATEGORY actions)

Add after SNOOZE_10:
```typescript
{
  identifier: 'SKIP',
  buttonTitle: 'Skip',
  options: {
    isDestructive: false,
    isAuthenticationRequired: false,
  },
},
```

### 4.2 Add Skip All Button to Grouped Category

**File:** `app/src/services/notifications/notificationService.ts`
**Location:** Line 461-476 (MULTIPLE_MEDICATION_REMINDER_CATEGORY actions)

Add after REMIND_LATER:
```typescript
{
  identifier: 'SKIP_ALL',
  buttonTitle: 'Skip All',
  options: {
    isDestructive: false,
    isAuthenticationRequired: false,
  },
},
```

### 4.3 Create handleSkip Function

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** After `handleSnooze` (around line 184)

New function:
```typescript
export async function handleSkip(
  medicationId: string,
  scheduleId: string
): Promise<void>
```

This function:
1. Cancels today's reminder (already shown, just clean up mapping)
2. Cancels today's follow-up
3. Does NOT log a dose
4. Calls top-up

### 4.4 Create handleSkipAll Function

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** After `handleSkip`

New function for grouped notifications.

### 4.5 Route Skip Actions

**File:** `app/src/services/notifications/notificationService.ts`
**Location:** Line 508-554 (switch statement in `handleNotificationResponse`)

Add cases:
```typescript
case 'SKIP':
  await handleSkip(medicationId, scheduleId);
  break;
case 'SKIP_ALL':
  await handleSkipAll(response.notification.request.content.data);
  break;
```

---

## Phase 5: Top-Up and Reconciliation

### 5.1 Create topUpNotifications

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** After `rescheduleAllNotifications` (around line 1325)

New function:
```typescript
export async function topUpNotifications(
  threshold: number = 3
): Promise<void>
```

This function:
1. Gets all active medication schedules
2. For each schedule, counts scheduled notifications
3. If count < threshold, calculates how many to add
4. Schedules additional notifications up to calculated N

### 5.2 Create reconcileNotifications

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** After `topUpNotifications`

New function:
```typescript
export async function reconcileNotifications(): Promise<void>
```

This function:
1. Gets all scheduled notifications from OS
2. Gets all mappings from DB
3. Removes orphaned mappings (DB has ID, OS doesn't)
4. Cancels orphaned notifications (OS has ID, DB doesn't)

### 5.3 Create rebalanceNotifications

**File:** `app/src/services/notifications/medicationNotifications.ts`
**Location:** After `reconcileNotifications`

New function:
```typescript
export async function rebalanceNotifications(): Promise<void>
```

This function:
1. Calculates new N based on current medication count
2. If N decreased, cancels notifications beyond N days
3. Updates stored N value

### 5.4 Integrate into App Startup

**File:** `app/App.tsx`
**Location:** Line 83 (after `rescheduleAllNotifications()`)

Replace or augment:
```typescript
// Old: await notificationService.rescheduleAllNotifications();

// New:
await medicationNotifications.reconcileNotifications();
await medicationNotifications.topUpNotifications();
```

### 5.5 Add Top-Up to Action Handlers

Each notification action handler should call `topUpNotifications()` at the end:

| Handler | File | Location |
|---------|------|----------|
| `handleTakeNow` | medicationNotifications.ts | ~Line 105 |
| `handleSnooze` | medicationNotifications.ts | ~Line 180 |
| `handleTakeAllNow` | medicationNotifications.ts | ~Line 345 |
| `handleRemindLater` | medicationNotifications.ts | ~Line 458 |
| `handleSkip` | medicationNotifications.ts | new |
| `handleSkipAll` | medicationNotifications.ts | new |

---

## Phase 6: Migration Script

### 6.1 Create One-Time Migration

**File:** `app/src/services/notifications/notificationMigration.ts` (new file)

Function to run once on app update:
```typescript
export async function migrateToOneTimeNotifications(): Promise<void>
```

This function:
1. Cancels all existing DAILY notifications
2. Schedules N one-time notifications for each active schedule
3. Populates `scheduled_notifications` table
4. Marks migration as complete in AsyncStorage

### 6.2 Call Migration on App Start

**File:** `app/App.tsx`
**Location:** Line 73-83 (initialization block)

Add before reconcile/top-up:
```typescript
await migrateToOneTimeNotifications(); // No-op if already migrated
await medicationNotifications.reconcileNotifications();
await medicationNotifications.topUpNotifications();
```

---

## Phase 7: Cleanup

### 7.1 Remove Foreground Suppression Logic

**File:** `app/src/services/notifications/notificationService.ts`
**Location:** Line 46-389 (`handleIncomingNotification`)

The complex suppression logic in `handleIncomingNotification` can be simplified since cancellation now happens at schedule time. Keep as fallback initially, then remove once stable.

### 7.2 Remove DAILY Trigger References

After migration is stable:
- Remove old `scheduleSingleNotification` DAILY logic
- Remove old `scheduleMultipleNotification` DAILY logic
- Update any comments referencing DAILY triggers

---

## Testing Checklist

### Unit Tests
- [ ] `scheduledNotificationRepository` CRUD operations
- [ ] `scheduleNotificationAtomic` compensating transaction
- [ ] `cancelNotificationForDate` grouped/ungrouped cases
- [ ] `topUpNotifications` threshold logic
- [ ] `reconcileNotifications` orphan detection

### Integration Tests
- [ ] Log dose cancels today's notification
- [ ] Skip action cancels reminder + follow-up
- [ ] App startup reconciles and tops up
- [ ] Adding medication triggers rebalance
- [ ] Grouped notification recreation

### Manual E2E Tests
- [ ] Scenario 1.1: Log before notification time
- [ ] Scenario 1.5: Log one of grouped medications
- [ ] Scenario 1.6: Log after notification time
- [ ] Skip action suppresses follow-up
- [ ] App killed, notification still fires for unlogged meds
- [ ] App killed, notification does NOT fire for logged meds

---

## File Summary

| File | Changes |
|------|---------|
| `app/src/database/migrations.ts` | Add v20 migration |
| `app/src/database/schema.ts` | Update version to 20 |
| `app/src/database/scheduledNotificationRepository.ts` | **New file** |
| `app/src/types/notifications.ts` | **New file** |
| `app/src/services/notifications/notificationScheduler.ts` | Add atomic helpers |
| `app/src/services/notifications/medicationNotifications.ts` | Major changes |
| `app/src/services/notifications/notificationService.ts` | Add Skip actions |
| `app/src/services/notifications/notificationMigration.ts` | **New file** |
| `app/src/store/medicationStore.ts` | Integrate cancellation |
| `app/App.tsx` | Update initialization |
