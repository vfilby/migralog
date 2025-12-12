# Notification Suppression Research

## Problem Statement

The app currently uses `handleIncomingNotification` (line 46 in `notificationService.ts`) to suppress medication reminder notifications when doses have already been logged. **This approach only works when the app is in the foreground.**

When the app is backgrounded or killed:
1. `setNotificationHandler` callback does not run
2. Notifications fire regardless of whether medication was logged
3. Users see reminders for medications they've already taken

## Current Architecture

### How Notifications Are Scheduled

Notifications use **DAILY recurring triggers**:

```typescript
trigger: {
  type: Notifications.SchedulableTriggerInputTypes.DAILY,
  hour: 9,
  minute: 30,
}
```

This means the OS schedules a notification to fire every day at 9:30 AM. The notification persists across app restarts and app updates.

### Current Suppression Flow (Foreground Only)

```
Notification fires (OS)
    → handleIncomingNotification runs (foreground only)
        → Check if dose logged today
        → If logged: return { shouldShowBanner: false }
        → If not logged: return { shouldShowBanner: true }
```

**Problem**: If app is backgrounded, `handleIncomingNotification` never runs, and the notification always shows.

## Expo-Notifications Limitations

### 1. No "Skip Next Occurrence"

Expo-notifications does NOT support cancelling a single occurrence of a recurring notification. You can only:
- **Cancel entirely**: Remove the DAILY schedule completely
- **Keep entirely**: Notification fires every day

There is no `skipNextOccurrence()` or similar API.

### 2. setNotificationHandler is Foreground-Only

From Expo docs:
> "setNotificationHandler sets the handler function responsible for deciding what to do with a notification that is received when the app is in foreground."

### 3. registerTaskAsync - Push Notifications Only

Expo provides `registerTaskAsync` for background notification handling, but it **only works with push notifications from a remote server**, not local scheduled notifications.

From Expo docs:
> "Call registerTaskAsync to set a callback (task) that runs when a notification is received while the app is in foreground, background, or terminated."

However, the task receives a `NotificationTaskPayload` which comes from:
- **Android**: FCM (Firebase Cloud Messaging) remote payload
- **iOS**: APNs (Apple Push Notification service) remote payload

**Local scheduled notifications do not trigger `registerTaskAsync` when backgrounded or terminated.**

| Notification Type | `setNotificationHandler` | `registerTaskAsync` |
|-------------------|--------------------------|---------------------|
| **Local scheduled** | Foreground only | Never runs |
| **Push notification** | Foreground only | Foreground, Background, Terminated |

### 4. Push Notification Alternative

To use `registerTaskAsync` for suppression, you would need:
- A backend server to send push notifications
- Server-side logic to check if dose is logged before sending
- Internet connectivity for notifications to work

This adds significant infrastructure complexity and removes offline capability.

### 5. Cancellation Methods Available

```typescript
// Cancel a specific notification by ID
await Notifications.cancelScheduledNotificationAsync(notificationId);

// Cancel all notifications
await Notifications.cancelAllScheduledNotificationsAsync();
```

These work when called from app code but cannot be triggered automatically when app is backgrounded.

---

## DAILY Recurring vs N One-Time Notifications

### DAILY Recurring Triggers (Current Approach)

The current system uses `Notifications.SchedulableTriggerInputTypes.DAILY`:

```typescript
trigger: {
  type: Notifications.SchedulableTriggerInputTypes.DAILY,
  hour: 9,
  minute: 30,
}
```

**How it works:**
- OS schedules one notification that repeats every day at the specified time
- Single notification ID represents the entire recurring series
- Persists across app restarts and updates
- Managed entirely by the OS

**Advantages:**
- Simple to set up (one call per schedule)
- No database tracking needed
- No top-up logic required
- Works indefinitely without app interaction

**Disadvantages:**
- **All-or-nothing cancellation**: Cannot cancel just today's occurrence
- **No granular control**: Cancel the notification = cancel ALL future occurrences
- **Suppression requires foreground**: Must use `setNotificationHandler` which only runs when app is in foreground
- **No way to "skip" a day**: User logging a dose before notification time cannot prevent that day's notification from firing (unless app is foregrounded)

### N One-Time Notifications (Proposed Approach)

Schedule individual one-time notifications for each day:

```typescript
// Day 1
trigger: new Date('2024-03-15T09:30:00')

// Day 2
trigger: new Date('2024-03-16T09:30:00')

// ... up to Day N
```

**How it works:**
- Each day has its own notification with unique ID
- Database tracks `{ date → notificationId }` mappings
- App tops up notifications on each interaction
- Cancellation is per-day

**Advantages:**
- **Granular cancellation**: Cancel just March 15th without affecting March 16th
- **Background suppression works**: Cancel notification when dose logged, regardless of app state
- **Skip functionality**: User can dismiss today without affecting tomorrow
- **Predictable behavior**: What you schedule is what fires

**Disadvantages:**
- More complex to manage
- Requires database table for mappings
- Limited by iOS 64 notification cap
- Requires periodic top-up (on app interaction)

### Why We're Switching

The fundamental limitation of DAILY triggers is that **you cannot suppress a single occurrence**.

| Scenario | DAILY Trigger | One-Time Notifications |
|----------|---------------|------------------------|
| User logs dose at 9:00 AM, notification scheduled for 9:20 AM | ❌ Notification fires anyway (unless app in foreground) | ✅ Cancel today's notification |
| User wants to skip today but get reminded tomorrow | ❌ Must cancel entire series, hope app reopens to reschedule | ✅ Cancel today, tomorrow already scheduled |
| User takes action from notification | ✅ Works (app wakes to handle) | ✅ Works |
| App not opened for 30 days | ✅ Notifications continue forever | ⚠️ Notifications stop after N days |

The only scenario where DAILY triggers win is the edge case of a user not opening the app for extended periods. But users with medication reminders are inherently engaged users who interact with the app regularly.

### Managing the Transition

During migration, we need to:

1. **Cancel all DAILY notifications** - Both reminders and follow-ups
2. **Schedule N one-time notifications** - For each medication schedule
3. **Track in database** - Store `{ medicationId, scheduleId, date, notificationId }`
4. **Update all scheduling code** - Replace DAILY triggers with one-time triggers
5. **Add top-up logic** - Ensure notifications are replenished on each app interaction

---

## Recommended Solution: N One-Time Notifications

Instead of using DAILY recurring triggers, schedule **N one-time notifications** (e.g., calculated based on iOS 64 limit) and cancel individual days as needed.

### Why This Approach

| Aspect | DAILY Recurring + Touch Points | N One-Time Notifications |
|--------|--------------------------------|--------------------------|
| Cancel single day | Complex (cancel all, reschedule) | Simple (cancel that day's ID) |
| User doesn't open app | Notifications stop after 1 day | Notifications continue for N days |
| Grouped notifications | Complex reschedule logic | Cancel one, recreate for remaining |
| App startup work | Reschedule everything | Top up to N if below threshold |
| Complexity | High | **Lower** |

### Core Strategy

1. **On medication schedule created**: Schedule N one-time notifications (e.g., 30 days)
2. **On dose logged**: Cancel just that day's notification (and recreate grouped if needed)
3. **On app open**: Check scheduled count, top up to N if below threshold

### Data Model

Store notification ID mappings in the database:

```typescript
// New table or extend medication_schedules
interface ScheduledNotification {
  id: string;
  medicationId: string;
  scheduleId: string;
  date: string;           // "2024-03-15"
  notificationId: string; // Expo notification ID
  isGrouped: boolean;     // Part of a grouped notification?
  groupKey?: string;      // e.g., "09:20" for grouping
}
```

### Flow Diagrams

#### Initial Setup (Medication Schedule Created)

```
User creates medication with 9:20 AM schedule
    → scheduleNotificationsForDays(medicationId, scheduleId, 30)
        → For each of next 30 days:
            → Check: Other meds at 9:20 on this day?
            → If yes: Create/update grouped notification
            → If no: Create single notification
            → Store { date, notificationId } mapping
```

#### Scenario 1.1: User Logs Medication BEFORE Notification Time

```
User logs dose at 9:00 AM (notification scheduled for 9:20 AM today)
    → logDose() in medicationStore
        → cancelNotificationForDate(medicationId, scheduleId, today)
            → Look up today's notificationId from mapping
            → Is it grouped?
                → No: Cancel it directly
                → Yes: Cancel grouped, recreate for remaining meds
            → Remove mapping entry
        → Dose recorded in database

Tomorrow 9:20 AM:
    → Tomorrow's notification fires normally (already scheduled)
```

#### Scenario 1.5: Grouped Notification - One Med Logged

```
Group notification exists for today 9:20 AM: [Med A, Med B, Med C]
User logs Med A at 9:00 AM

    → cancelNotificationForDate(MedA, scheduleA, today)
        → Look up today's notification
        → It's grouped (contains Med A, B, C)
        → Cancel the grouped notification
        → Check: Which meds NOT logged for today?
            → Med B, Med C still pending
        → Create new notification for today 9:20 AM with [Med B, Med C]
        → Update mappings for Med B, Med C to new notification ID
        → Remove mapping for Med A

9:20 AM: Notification fires for [Med B, Med C] only
```

#### Scenario: User Logs All Meds in Group

```
User logs Med A → Group becomes [Med B, Med C]
User logs Med B → Group becomes [Med C] (now single notification)
User logs Med C → Cancel notification, nothing to show

Result: No 9:20 notification today
```

#### App Startup: Top Up Notifications

```
App opens
    → checkAndTopUpNotifications()
        → For each active medication schedule:
            → Count scheduled notifications for this schedule
            → If count < threshold:
                → Schedule more to bring up to N
                → Handle grouping with other medications
```

### Notification Actions

Each notification action is an opportunity to manage notification schedules:

#### Single Medication Actions

| Action | Behavior |
|--------|----------|
| **Take Now** | Log dose, cancel today's reminder + follow-up, top up schedules |
| **Skip** | Cancel today's reminder + follow-up (no dose logged), top up schedules |
| **Snooze 10min** | Cancel current, schedule one-time snooze notification |

#### Grouped Medication Actions

| Action | Behavior |
|--------|----------|
| **Take All** | Log all doses, cancel today's group reminder + follow-up, top up schedules |
| **Skip All** | Cancel today's group reminder + follow-up (no doses logged), top up schedules |
| **Remind Later** | Cancel current group, schedule one-time snooze for group |
| **View Details** | Open app (triggers top up on app open) |

#### Skip Action Flow

```
User receives 9:20 AM notification for Med A
User taps "Skip"
    → handleSkip(medicationId, scheduleId)
        → Cancel today's 9:20 reminder (already presented, dismiss it)
        → Cancel today's 9:50 follow-up
        → Do NOT log a dose
        → Top up notification schedules
    → User is not bothered again today for this medication
    → Tomorrow's 9:20 notification will fire normally
```

#### Why Skip is Important

"Skip" gives users a way to:
1. Acknowledge they saw the reminder without taking the medication
2. Suppress the follow-up notification (critical alert) for today
3. Trigger the schedule top-up without opening the app

This is especially valuable for the critical alert follow-ups that break through DND.

### Implementation Components

#### 1. Schedule N Notifications

```typescript
/**
 * Schedule N days of one-time notifications for a medication schedule.
 * Handles grouping with other medications at the same time.
 */
async function scheduleNotificationsForDays(
  medicationId: string,
  scheduleId: string,
  days: number = 30
): Promise<void> {
  const medication = await medicationRepository.getById(medicationId);
  const schedule = medication?.schedule?.find(s => s.id === scheduleId);
  if (!medication || !schedule) return;

  const [hours, minutes] = schedule.time.split(':').map(Number);

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    date.setHours(hours, minutes, 0, 0);

    const dateKey = date.toISOString().split('T')[0]; // "2024-03-15"

    // Check for other medications at this time on this date
    const otherMedsAtTime = await getOtherMedicationsAtTime(schedule.time, dateKey, medicationId);

    if (otherMedsAtTime.length > 0) {
      // Grouped notification
      await scheduleOrUpdateGroupedNotification(date, dateKey, [
        { medicationId, scheduleId, medication },
        ...otherMedsAtTime
      ]);
    } else {
      // Single notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${medication.name}`,
          body: `${schedule.dosage} dose(s)`,
          data: { medicationId, scheduleId, date: dateKey },
          categoryIdentifier: MEDICATION_REMINDER_CATEGORY,
        },
        trigger: date,
      });

      // Store mapping
      await saveNotificationMapping({
        medicationId,
        scheduleId,
        date: dateKey,
        notificationId,
        isGrouped: false,
      });
    }
  }
}
```

#### 2. Cancel Notification for Date

```typescript
/**
 * Cancel a specific day's notification when dose is logged.
 * Handles grouped notifications by recreating for remaining meds.
 */
async function cancelNotificationForDate(
  medicationId: string,
  scheduleId: string,
  date: string  // "2024-03-15"
): Promise<void> {
  const mapping = await getNotificationMapping(medicationId, scheduleId, date);
  if (!mapping) return;

  if (!mapping.isGrouped) {
    // Simple case: cancel single notification
    await Notifications.cancelScheduledNotificationAsync(mapping.notificationId);
    await deleteNotificationMapping(mapping.id);
  } else {
    // Grouped: cancel and recreate for remaining medications
    await Notifications.cancelScheduledNotificationAsync(mapping.notificationId);

    // Get all medications in this group that are NOT logged today
    const remainingMeds = await getRemainingMedsInGroup(mapping.groupKey, date, medicationId);

    if (remainingMeds.length > 0) {
      // Recreate notification for remaining meds
      const schedule = await getScheduleById(scheduleId);
      const [hours, minutes] = schedule.time.split(':').map(Number);
      const notifDate = new Date(date);
      notifDate.setHours(hours, minutes, 0, 0);

      if (remainingMeds.length === 1) {
        // Now a single notification
        const med = remainingMeds[0];
        const newNotificationId = await scheduleSingleNotification(med, notifDate, date);
        await updateNotificationMapping(med.medicationId, med.scheduleId, date, newNotificationId, false);
      } else {
        // Still grouped
        const newNotificationId = await scheduleGroupedNotification(remainingMeds, notifDate, date);
        for (const med of remainingMeds) {
          await updateNotificationMapping(med.medicationId, med.scheduleId, date, newNotificationId, true);
        }
      }
    }

    // Remove mapping for the logged medication
    await deleteNotificationMapping(mapping.id);
  }
}
```

#### 3. Top Up on App Open

```typescript
/**
 * Called on app startup to ensure we have N days of notifications scheduled.
 */
async function topUpNotifications(targetDays: number = 30, threshold: number = 15): Promise<void> {
  const medications = await medicationRepository.getActive();

  for (const medication of medications) {
    if (medication.type !== 'preventative' || medication.scheduleFrequency !== 'daily') continue;

    const schedules = await medicationScheduleRepository.getByMedicationId(medication.id);

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;

      const scheduledCount = await countScheduledNotifications(medication.id, schedule.id);

      if (scheduledCount < threshold) {
        const daysToAdd = targetDays - scheduledCount;
        const startDate = await getLastScheduledDate(medication.id, schedule.id);
        await scheduleNotificationsFromDate(medication.id, schedule.id, startDate, daysToAdd);
      }
    }
  }
}
```

### Atomicity and Error Handling

Scheduling a notification and saving its mapping to the database are two separate operations. If one succeeds and the other fails, we get out of sync—either an orphaned notification the app can't manage, or a database entry pointing to a non-existent notification.

#### The Problem

```typescript
// NOT ATOMIC - dangerous!
const notificationId = await Notifications.scheduleNotificationAsync({...});
// If this fails, we have orphaned notification we can't cancel
await saveNotificationMapping({...notificationId...});
```

#### Solution: Compensating Transaction + Reconciliation

**Primary Strategy**: If the database save fails, immediately cancel the notification we just scheduled.

```typescript
async function scheduleNotificationAtomic(
  content: NotificationContentInput,
  trigger: Date,
  mapping: NotificationMappingData
): Promise<string> {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content,
    trigger,
  });

  try {
    await saveNotificationMapping({
      ...mapping,
      notificationId,
    });
    return notificationId;
  } catch (dbError) {
    // Compensating transaction: rollback the notification
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (cancelError) {
      // Log for reconciliation to handle later
      console.error('Failed to cancel orphaned notification:', notificationId);
    }
    throw dbError;
  }
}
```

**Safety Net**: Run reconciliation on app startup to catch any edge cases where both operations partially failed.

```typescript
async function reconcileNotifications(): Promise<void> {
  // Get all scheduled notifications from OS
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIds = new Set(scheduled.map(n => n.identifier));

  // Get all mappings from DB
  const mappings = await getAllNotificationMappings();
  const mappedIds = new Set(mappings.map(m => m.notificationId));

  // Find orphaned mappings (DB has ID that OS doesn't have)
  for (const mapping of mappings) {
    if (!scheduledIds.has(mapping.notificationId)) {
      console.warn('Removing orphaned mapping:', mapping.notificationId);
      await deleteNotificationMapping(mapping.id);
    }
  }

  // Find orphaned notifications (OS has ID that DB doesn't have)
  for (const notification of scheduled) {
    if (!mappedIds.has(notification.identifier)) {
      // Only cancel if it's one of our medication notifications
      if (notification.content.data?.medicationId) {
        console.warn('Cancelling orphaned notification:', notification.identifier);
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  }
}
```

#### Batch Operations

For top-up operations that schedule multiple notifications at once, wrap the entire batch:

```typescript
async function scheduleNotificationsBatch(
  notifications: Array<{content, trigger, mapping}>
): Promise<void> {
  const scheduled: Array<{id: string, mapping}> = [];

  try {
    // Schedule all notifications
    for (const n of notifications) {
      const id = await Notifications.scheduleNotificationAsync({
        content: n.content,
        trigger: n.trigger,
      });
      scheduled.push({id, mapping: n.mapping});
    }

    // Save all mappings in single transaction
    await saveMappingsBatch(scheduled.map(s => ({
      ...s.mapping,
      notificationId: s.id,
    })));
  } catch (error) {
    // Rollback: cancel all notifications we scheduled
    await Promise.allSettled(
      scheduled.map(s =>
        Notifications.cancelScheduledNotificationAsync(s.id)
      )
    );
    throw error;
  }
}
```

#### Error Handling Summary

| Scenario | Handling |
|----------|----------|
| Schedule succeeds, DB save fails | Cancel the notification (compensating transaction) |
| Schedule fails | No cleanup needed, throw error |
| Both succeed | Normal operation |
| Cancel during rollback fails | Log error, reconciliation will clean up on next app open |
| DB and OS out of sync | `reconcileNotifications()` fixes on app startup |

#### When to Run Reconciliation

```typescript
// In App.tsx or app initialization
useEffect(() => {
  async function initNotifications() {
    // Run reconciliation first to ensure clean state
    await reconcileNotifications();
    // Then top up notifications
    await topUpNotifications();
  }
  initNotifications();
}, []);
```

This two-layer approach (compensating transactions + reconciliation) ensures the database and OS notification state stay in sync even when individual operations fail.

---

### iOS Notification Limit Consideration

iOS has a limit of **64 scheduled local notifications** per app.

#### Realistic Usage Calculation

A typical user with multiple medications:

| Component | Per Day |
|-----------|---------|
| Med A - 9am reminder | 1 |
| Med A - 9am follow-up | 1 |
| Med B - 2pm reminder | 1 |
| Med B - 2pm follow-up | 1 |
| Med C - 9pm reminder | 1 |
| Med C - 9pm follow-up | 1 |
| How's My Day | 1 |
| **Total** | **7** |

```
64 notifications / 7 per day = ~9 days of coverage
```

#### Why 9 Days is Acceptable

Users with many notification schedules are **high-engagement users** who interact with the app frequently:
- Opening the app to log doses
- Using notification actions ("Take Now", "Take All", "Skip")
- Checking medication history

**The correlation works in our favor**: Heavy notification users interact daily, so 9 days provides ample buffer.

#### Dynamic N Calculation

```typescript
const TOTAL_LIMIT = 64;
const RESERVED_SLOTS = 5; // For snooze notifications, etc.
const availableSlots = TOTAL_LIMIT - RESERVED_SLOTS;

// Count total notification types per day
const notificationsPerDay = calculateNotificationsPerDay(medications, settings);

// Calculate N
const N = Math.floor(availableSlots / notificationsPerDay);
```

| User Profile | Notifications/Day | Days Covered |
|--------------|-------------------|--------------|
| Light (1 med, no follow-up) | 2 | 29 days |
| Moderate (2 meds + follow-ups + HMD) | 5 | 11 days |
| Heavy (3 meds + follow-ups + HMD) | 7 | 8 days |

#### Rebalancing When Schedules Change

When a user adds a new medication schedule, the notifications-per-day count increases, which means N must decrease to stay under 64.

**Example: User adds a 4th medication**

Before:
- 3 meds × 2 (reminder + follow-up) + HMD = 7/day
- N = 59 / 7 = **8 days**
- Total scheduled: 7 × 8 = 56 notifications

After adding 4th med:
- 4 meds × 2 + HMD = 9/day
- N = 59 / 9 = **6 days**
- Need to reduce from 56 to 54 notifications

**Rebalancing Flow:**

```
User adds new medication schedule
    → calculateNewN(existingSchedules + newSchedule)
    → If newN < currentN:
        → For each existing schedule:
            → Cancel notifications beyond day newN
            → Delete mappings for cancelled notifications
    → Schedule newN days for the new medication
    → Update all schedules to use newN going forward
```

**Implementation:**

```typescript
async function rebalanceNotifications(): Promise<void> {
  // Calculate new N based on current medication count
  const notificationsPerDay = await calculateNotificationsPerDay();
  const newN = Math.floor((TOTAL_LIMIT - RESERVED_SLOTS) / notificationsPerDay);

  // Get all scheduled notifications grouped by schedule
  const allMappings = await getAllNotificationMappings();

  for (const [scheduleKey, mappings] of groupBySchedule(allMappings)) {
    // Sort by date ascending
    const sorted = mappings.sort((a, b) => a.date.localeCompare(b.date));

    // Keep only the first newN days
    const toKeep = sorted.slice(0, newN);
    const toCancel = sorted.slice(newN);

    // Cancel excess notifications
    for (const mapping of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(mapping.notificationId);
      await deleteNotificationMapping(mapping.id);
    }
  }

  // Store newN for future scheduling
  await saveCurrentN(newN);
}
```

**When to Rebalance:**

| Event | Action |
|-------|--------|
| Add medication schedule | Recalculate N, rebalance if N decreased |
| Remove medication schedule | Recalculate N, can schedule more days (top-up) |
| Enable/disable follow-ups | Recalculate N, rebalance or top-up accordingly |
| Enable/disable HMD | Recalculate N, rebalance or top-up accordingly |

**Edge Case: N Falls Below Minimum**

If a user adds so many schedules that N < 3 days, we should:
1. Warn the user that notification coverage is limited
2. Suggest consolidating schedules to the same time (grouping)
3. Consider making follow-ups optional for some medications

```typescript
const MINIMUM_N = 3;

if (newN < MINIMUM_N) {
  // Show warning to user
  showNotificationCoverageWarning(newN);
  // Still use the calculated N, even if low
}
```

### Database Schema Addition

```sql
CREATE TABLE scheduled_notifications (
  id TEXT PRIMARY KEY,
  medication_id TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  date TEXT NOT NULL,           -- "2024-03-15"
  notification_id TEXT NOT NULL, -- Expo notification ID
  is_grouped INTEGER DEFAULT 0,
  group_key TEXT,               -- e.g., "09:20"
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
  FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE CASCADE,
  UNIQUE(medication_id, schedule_id, date)
);

CREATE INDEX idx_scheduled_notifications_date ON scheduled_notifications(date);
CREATE INDEX idx_scheduled_notifications_group ON scheduled_notifications(group_key, date);
```

### Top-Up Triggers

Notification schedules should be topped up on **any app interaction**:

| Trigger | How It Happens |
|---------|----------------|
| App opens | `App.tsx` startup code |
| "Take Now" action | `handleTakeNow()` response handler |
| "Take All" action | `handleTakeAllNow()` response handler |
| "Skip" action | `handleSkip()` response handler |
| "Skip All" action | `handleSkipAll()` response handler |
| Dose logged in app | `logDose()` in medicationStore |

This ensures every user interaction resets the N-day window.

### Test Scenarios from Spec

| Scenario | Current | N One-Time Approach |
|----------|---------|---------------------|
| 1.1: Log both before 9:20 | ❌ (bg only) | ✅ Cancel today's notifications |
| 1.2: Log from notification | ✅ | ✅ |
| 1.3: Dismiss without logging | ✅ | ✅ |
| 1.4: Snooze | ✅ | ✅ (schedule one-time snooze) |
| 1.5: Log one, other pending | ❌ (bg only) | ✅ Recreate group for remaining |
| 1.6: Log both at 10pm | ❌ (bg only) | ✅ Cancel tomorrow's (already scheduled) |
| 2.1: Log before notification | ❌ (bg only) | ✅ |
| 2.2: Log after notification | ✅ | ✅ |
| 3.1: Disable notifications | ✅ | ✅ Cancel all scheduled |
| 3.2: Re-enable notifications | ✅ | ✅ Schedule N days |
| 4.1: App force-quit | ❌ | ✅ Notifications pre-scheduled |
| 4.2: Device restart | ✅ | ✅ Notifications persist |
| NEW: Skip action | N/A | ✅ Cancel today's reminder + follow-up |

### Migration Path

#### Phase 1: Add Database Table
- Create `scheduled_notifications` table
- Add repository functions for CRUD operations

#### Phase 2: Implement Core Functions
- `scheduleNotificationsForDays()`
- `cancelNotificationForDate()`
- `topUpNotifications()`

#### Phase 3: Add Skip Action
- Add "Skip" button to single medication notification category
- Add "Skip All" button to grouped medication notification category
- Implement `handleSkip()` and `handleSkipAll()` handlers

#### Phase 4: Integrate with Existing Code
- Modify `logDose()` to call `cancelNotificationForDate()`
- Modify app startup to call `topUpNotifications()`
- Modify medication creation to schedule N notifications
- Add top-up calls to all notification action handlers

#### Phase 5: Migration Script
- Cancel all existing DAILY notifications
- Schedule N one-time notifications for each medication
- Populate `scheduled_notifications` table

#### Phase 6: Remove Old Code
- Remove `handleIncomingNotification` suppression logic (keep as fallback initially)
- Remove DAILY trigger scheduling code

### Comparison Summary

| Aspect | Current (DAILY + Handler) | N One-Time Notifications |
|--------|---------------------------|--------------------------|
| Background suppression | ❌ Doesn't work | ✅ Works |
| User opens app daily | ✅ Works | ✅ Works |
| User absent 30+ days | ❌ Wrong notifications | ⚠️ Notifications stop |
| Grouped handling | Complex | Manageable |
| iOS 64 notification limit | N/A | Must consider |
| Database requirements | None | New table needed |
| Code complexity | Simpler (but broken) | More complex (but works) |

### Recommendation

Implement the **N One-Time Notifications** approach. Key advantages:

1. **Solves the core problem**: Background suppression works
2. **Simpler than touch points**: No complex rescheduling logic
3. **Graceful degradation**: User without app for 30 days is an acceptable edge case
4. **Granular control**: Cancel specific days without affecting others

Implementation priorities:
1. Database schema for notification mappings
2. Single medication scheduling and cancellation
3. Grouped notification handling
4. App startup top-up logic
5. Migration from DAILY triggers
