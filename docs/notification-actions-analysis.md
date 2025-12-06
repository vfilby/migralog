# Notification Actions Analysis

This document maps all notification-related actions in the app to their expected effects on scheduled and presented notifications. The goal is to provide a clear understanding of notification lifecycle management and serve as a basis for regression testing.

## Table of Contents

1. [Notification Types](#notification-types)
2. [Action Matrix](#action-matrix)
3. [Detailed Action Flows](#detailed-action-flows)
4. [Known Issues and Edge Cases](#known-issues-and-edge-cases)
5. [Regression Test Plan](#regression-test-plan)

---

## Notification Types

### 1. Medication Reminders

| Property | Value |
|----------|-------|
| Category | `MEDICATION_REMINDER_CATEGORY` |
| Trigger | DAILY at configured time |
| Data Fields | `medicationId`, `scheduleId`, `medicationName`, `isFollowUp` |
| Actions | "Take Now", "Snooze 10min", "Skip" (TODO: not yet implemented) |

### 2. Grouped Medication Reminders

| Property | Value |
|----------|-------|
| Category | `MULTIPLE_MEDICATION_REMINDER_CATEGORY` |
| Trigger | DAILY at configured time |
| Data Fields | `medicationIds[]`, `scheduleIds[]`, `medicationNames[]`, `originalTime`, `isFollowUp` |
| Actions | "Take All", "Remind Later", "View Details", "Skip All" (TODO: not yet implemented) |

### 3. Follow-up Reminders

| Property | Value |
|----------|-------|
| Category | Same as parent (single or multiple) |
| Trigger | DAILY at original time + delay |
| Data Fields | Same as parent + `isFollowUp: true` |
| Actions | Same as parent notification (single: "Take Now", "Snooze 10min", "Skip"; grouped: "Take All", "Remind Later", "View Details", "Skip All") |
| Notes | Scheduled alongside primary notification, not dynamically |

### 4. Daily Check-in

| Property | Value |
|----------|-------|
| Category | `DAILY_CHECKIN` |
| Trigger | DAILY at configured time (default 9pm) |
| Data Fields | `type: 'daily_checkin'`, `date` |
| Actions | "Clear Day", "Not Clear" |

---

## Notification Workflow Diagrams

These diagrams show all possible paths through each notification's lifecycle, including user-initiated actions and automatic/hidden system behaviors.

### Single Medication Reminder Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: SCHEDULING                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Medication Created/Updated                                                 │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Schedule        │──No──▶ [No Notification]                               │
│  │ Enabled?        │                                                        │
│  └────────┬────────┘                                                        │
│           │ Yes                                                             │
│           ▼                                                                 │
│  [Schedule PRIMARY Notification]                                            │
│  DAILY trigger at configured time                                           │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Follow-up       │──No──▶ [Primary Only]                                  │
│  │ Enabled?        │                                                        │
│  └────────┬────────┘                                                        │
│           │ Yes                                                             │
│           ▼                                                                 │
│  [Schedule FOLLOW-UP Notification]                                          │
│  DAILY trigger at time + delay (15/30/45/60 min)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: BEFORE NOTIFICATION FIRES (No action needed!)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Primary + Follow-up Scheduled for 8:00 AM / 8:30 AM]                      │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────┐                                            │
│  │ User logs dose before 8 AM? │                                            │
│  └──────────────┬──────────────┘                                            │
│                 │                                                           │
│                 ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │ DO NOTHING to the scheduled notifications.                  │            │
│  │                                                             │            │
│  │ Dose is saved to database. That's it.                       │            │
│  │                                                             │            │
│  │ When 8:00 AM fires → handleIncomingNotification() checks    │            │
│  │ database → finds dose logged → suppresses notification.     │            │
│  │                                                             │            │
│  │ When 8:30 AM fires → same check → suppresses follow-up.     │            │
│  │                                                             │            │
│  │ DAILY schedule preserved for tomorrow. ✓                    │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: PRIMARY NOTIFICATION FIRES (8:00 AM)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Notification fires] ──▶ handleIncomingNotification()                      │
│           │                                                                 │
│           ▼                                                                 │
│  ┌────────────────────────────┐                                             │
│  │ Already logged for today's │──Yes──▶ [SUPPRESS: Don't show notification] │
│  │ schedule?                  │                                             │
│  └────────────┬───────────────┘                                             │
│               │ No                                                          │
│               ▼                                                             │
│  [SHOW NOTIFICATION with actions: "Take Now", "Snooze 10min", "Skip"*]      │
│  * Skip not yet implemented                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: USER ACTIONS ON PRIMARY NOTIFICATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: "Take Now"                                                   │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  1. Log dose to database (with note "Logged from notification")      │   │
│  │  2. Dismiss primary notification from tray                           │   │
│  │  3. Cancel follow-up reminder                                        │   │
│  │  Result: Dose recorded, no further notifications                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: "Snooze 10min"                                               │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  1. Cancel follow-up reminder (if tracked)                           │   │
│  │  2. Schedule ONE-TIME notification for now + 10 minutes              │   │
│  │  3. Primary notification dismissed                                   │   │
│  │  Note: Original DAILY schedule unchanged (fires again tomorrow)      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: "Skip" [TODO: NOT IMPLEMENTED]                               │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  Expected behavior:                                                  │   │
│  │  1. Dismiss notification                                             │   │
│  │  2. Cancel follow-up                                                 │   │
│  │  3. Optionally record "skipped" for tracking                         │   │
│  │  4. NO dose logged                                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: Tap Notification (opens app)                                 │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  1. App opens to medication screen                                   │   │
│  │  2. Notification remains in tray until:                              │   │
│  │     - User logs dose from app ──▶ Cancel scheduled + Dismiss + Cancel│   │
│  │                                    follow-up                         │   │
│  │     - User manually dismisses                                        │   │
│  │     - Follow-up fires and replaces it                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: Ignore / Swipe Away                                          │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  1. Notification removed from tray                                   │   │
│  │  2. Follow-up still scheduled (will fire at 8:30 AM)                 │   │
│  │  3. No dose recorded                                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: FOLLOW-UP NOTIFICATION FIRES (8:30 AM)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Follow-up fires] ──▶ handleIncomingNotification()                         │
│           │                                                                 │
│           ▼                                                                 │
│  ┌────────────────────────────┐                                             │
│  │ Already logged for today's │──Yes──▶ [SUPPRESS: Don't show]              │
│  │ schedule?                  │                                             │
│  └────────────┬───────────────┘                                             │
│               │ No                                                          │
│               ▼                                                             │
│  [SHOW FOLLOW-UP with same actions as primary]                              │
│                                                                             │
│  User actions have same effects as primary, plus:                           │
│  - "Take Now" also dismisses primary if still in tray                       │
│  - Follow-up has isFollowUp=true flag (prevents recursive follow-ups)       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Grouped Medication Reminder Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: SCHEDULING                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Multiple medications scheduled at same time: Med A, Med B, Med C @ 8 AM]  │
│           │                                                                 │
│           ▼                                                                 │
│  [Schedule GROUPED Notification]                                            │
│  - Contains: medicationIds[], scheduleIds[], medicationNames[]              │
│  - Single notification for all meds at that time                            │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────┐                                                │
│  │ ANY med has follow-up   │──No──▶ [Primary Only]                          │
│  │ enabled?                │                                                │
│  └───────────┬─────────────┘                                                │
│              │ Yes                                                          │
│              ▼                                                              │
│  [Schedule GROUPED Follow-up]                                               │
│  Uses MAX delay from all medications in group                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: BEFORE NOTIFICATION FIRES (No action needed!)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [User logs Med A at 7:30 AM - before grouped notification fires]           │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │ DO NOTHING to the scheduled notification.                   │            │
│  │                                                             │            │
│  │ Med A dose is saved to database. That's it.                 │            │
│  │                                                             │            │
│  │ When 8:00 AM fires → handleIncomingNotification():          │            │
│  │  1. Checks each medication in the group                     │            │
│  │  2. Med A logged → filtered out                             │            │
│  │  3. Med B, Med C not logged → notification shows            │            │
│  │  4. (TODO: Update notification content to only list         │            │
│  │      Med B and Med C, not Med A)                            │            │
│  │                                                             │            │
│  │ If ALL meds logged before fire time → suppress entirely.    │            │
│  │                                                             │            │
│  │ DAILY schedule preserved for tomorrow. ✓                    │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: GROUPED NOTIFICATION FIRES                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Notification fires] ──▶ handleIncomingNotification()                      │
│           │                                                                 │
│           ▼                                                                 │
│  ┌────────────────────────────┐                                             │
│  │ ALL meds already logged    │──Yes──▶ [SUPPRESS]                          │
│  │ for today?                 │                                             │
│  └────────────┬───────────────┘                                             │
│               │ No (at least one not logged)                                │
│               ▼                                                             │
│  [SHOW NOTIFICATION]                                                        │
│  Title: "Medication Reminder"                                               │
│  Body: "Time to take: Med A, Med B, Med C"                                  │
│  Actions: "Take All", "Remind Later", "View Details", "Skip All"*           │
│  * Skip All not yet implemented                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: USER ACTIONS ON GROUPED NOTIFICATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: "Take All"                                                   │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  1. Log dose for EACH medication in the group                        │   │
│  │  2. Dismiss grouped notification                                     │   │
│  │  3. Cancel grouped follow-up                                         │   │
│  │  Result: All doses recorded                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: "Remind Later"                                               │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  1. Cancel grouped follow-up (if tracked)                            │   │
│  │  2. Schedule ONE-TIME grouped notification for now + 10 min          │   │
│  │  3. Grouped notification dismissed                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: "View Details" (opens app)                                   │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  1. App opens to medication list                                     │   │
│  │  2. User can log medications individually                            │   │
│  │                                                                      │   │
│  │  ⚠️  BUG: If user logs ONE med from app:                             │   │
│  │      - ENTIRE grouped notification is cancelled                      │   │
│  │      - Other meds lose their reminder                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: "Skip All" [TODO: NOT IMPLEMENTED]                           │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  Expected behavior:                                                  │   │
│  │  1. Dismiss notification                                             │   │
│  │  2. Cancel follow-up                                                 │   │
│  │  3. Optionally record "skipped" for all meds                         │   │
│  │  4. NO doses logged                                                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Daily Check-in Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: SCHEDULING                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐                                                │
│  │ Daily check-in enabled? │──No──▶ [No Notification]                       │
│  └───────────┬─────────────┘                                                │
│              │ Yes                                                          │
│              ▼                                                              │
│  [Schedule DAILY Notification at configured time (default 9 PM)]            │
│  - Stores scheduledNotificationId for tracking                              │
│  - Data includes: type='daily_checkin', date=today                          │
│                                                                             │
│  Note: Date is set at SCHEDULE time, not fire time (potential stale date)   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: BEFORE NOTIFICATION FIRES                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────┐                                        │
│  │ User logs TODAY's status early? │──No──▶ [Continue to fire time check]   │
│  └────────────────┬────────────────┘                                        │
│                   │ Yes                                                     │
│                   ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │ AUTOMATIC ACTIONS:                                          │            │
│  │  1. Cancel scheduled notification                           │            │
│  │  2. Dismiss if already presented                            │            │
│  │  Result: No notification will fire today                    │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
│  ┌─────────────────────────────────┐                                        │
│  │ User logs PAST day's status?   │                                         │
│  └────────────────┬────────────────┘                                        │
│                   │                                                         │
│                   ▼                                                         │
│  [NO EFFECT on today's notification - only today's date triggers cancel]    │
│                                                                             │
│  ┌─────────────────────────────────┐                                        │
│  │ Active migraine episode?       │                                         │
│  └────────────────┬────────────────┘                                        │
│                   │                                                         │
│                   ▼                                                         │
│  [Notification stays scheduled - will be SUPPRESSED at fire time]           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: NOTIFICATION FIRES (9 PM)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Notification fires] ──▶ handleDailyCheckinNotification()                  │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────┐                                                │
│  │ Active migraine episode?│──Yes──▶ [SUPPRESS: shouldShowBanner=false]     │
│  └───────────┬─────────────┘                                                │
│              │ No                                                           │
│              ▼                                                              │
│  ┌─────────────────────────┐                                                │
│  │ Today already has       │──Yes──▶ [SUPPRESS: shouldShowBanner=false]     │
│  │ status logged?          │                                                │
│  └───────────┬─────────────┘                                                │
│              │ No                                                           │
│              ▼                                                              │
│  [SHOW NOTIFICATION]                                                        │
│  Title: "How was your day?"                                                 │
│  Body: "Tap to log how you're feeling today"                                │
│  Actions: "Clear Day", "Not Clear"                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: USER ACTIONS                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: "Clear Day"                                                  │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  1. Log status = 'green' for today (prompted=true)                   │   │
│  │  2. Cancel scheduled notification                                    │   │
│  │  3. Dismiss notification from tray                                   │   │
│  │  Result: Green day recorded, no more reminders today                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: "Not Clear"                                                  │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  1. Opens app (opensAppToForeground=true)                            │   │
│  │  2. User can:                                                        │   │
│  │     - Log yellow/red status ──▶ Cancel + Dismiss notification        │   │
│  │     - Start migraine episode ──▶ Notification suppressed next fire   │   │
│  │     - Do nothing ──▶ Notification remains, fires again tomorrow      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: Tap Notification                                             │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  Same as "Not Clear" - opens app for user to log status              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION: Ignore / Swipe Away                                          │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  1. Notification dismissed                                           │   │
│  │  2. DAILY trigger means it fires again tomorrow at same time         │   │
│  │  3. No status recorded for today                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ EDGE CASE: STATUS DELETION                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⚠️  BUG: NO REINSTATEMENT AFTER STATUS DELETION                            │
│                                                                             │
│  Scenario:                                                                  │
│  1. User logs today's status at 3 PM                                        │
│  2. System cancels 9 PM notification                                        │
│  3. User deletes/edits status at 4 PM                                       │
│  4. Notification is NOT reinstated                                          │
│  5. User gets no reminder at 9 PM                                           │
│                                                                             │
│  Expected: Notification should be rescheduled when status is deleted        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Timing Scenarios

```
SCENARIO 1: Dose Logged BEFORE Notification Fires (Suppression)
═══════════════════════════════════════════════════════════════════════════════

  7:30 AM                           8:00 AM                    8:30 AM
     │                                 │                          │
     ▼                                 │                          │
  [User logs dose from app]            │                          │
     │                                 │                          │
     └──▶ Save dose to database        │                          │
                                       ▼                          ▼
                               [Notification fires]        [Follow-up fires]
                                       │                          │
                                       ▼                          ▼
                               [handleIncoming...]         [handleIncoming...]
                                       │                          │
                                       ▼                          ▼
                               [Check: logged?]            [Check: logged?]
                                       │                          │
                                       ▼                          ▼
                               [Yes → SUPPRESS]            [Yes → SUPPRESS]
                               
  Result: Neither notification shows. DAILY schedule intact for tomorrow. ✓


SCENARIO 2: Dose Logged AFTER Notification Shows
═══════════════════════════════════════════════════════════════════════════════

  8:00 AM                         8:15 AM                       8:30 AM
     │                               │                             │
     ▼                               ▼                             │
  [Notification fires]         [User opens app,                    │
     │                          logs dose]                         │
     ▼                               │                             │
  [handleIncoming: not logged]       ├──▶ Save dose                │
     │                               └──▶ Dismiss from tray        │
     ▼                                                             ▼
  [Shows in tray]                                          [Follow-up fires]
                                                                   │
                                                                   ▼
                                                           [handleIncoming...]
                                                                   │
                                                                   ▼
                                                           [Check: logged? YES]
                                                                   │
                                                                   ▼
                                                           [SUPPRESS]
                                                           
  Result: Primary shown + dismissed. Follow-up suppressed. ✓


SCENARIO 3: User Taps "Take Now" Action
═══════════════════════════════════════════════════════════════════════════════

  8:00 AM                                                   8:30 AM
     │                                                         │
     ▼                                                         │
  [Notification fires, shows]                                  │
     │                                                         │
     ▼                                                         │
  [User taps "Take Now"]                                       │
     │                                                         │
     ├──▶ handleTakeNow() called                               │
     ├──▶ Dose saved to database                               │
     └──▶ Notification auto-dismissed                          │
                                                               ▼
                                                       [Follow-up fires]
                                                               │
                                                               ▼
                                                       [handleIncoming: logged?]
                                                               │
                                                               ▼
                                                       [Yes → SUPPRESS]
     
  Result: Dose recorded. Follow-up auto-suppressed. No complex cancellation. ✓


SCENARIO 4: User Ignores Primary, Responds to Follow-up
═══════════════════════════════════════════════════════════════════════════════

  8:00 AM                                              8:30 AM
     │                                                    │
     ▼                                                    ▼
  [Primary fires, shows]                            [Follow-up fires]
     │                                                    │
     ▼                                                    ▼
  [User swipes away]                               [handleIncoming: not logged]
     │                                                    │
     │                                                    ▼
     │                                              [Shows in tray]
     │                                                    │
     │                                                    ▼
     │                                             [User taps "Take Now"]
     │                                                    │
     │                                                    ├──▶ Dose saved
     │                                                    └──▶ Follow-up dismissed
     │
  [No dose recorded yet]

  Result: User got second chance via follow-up. ✓


SCENARIO 5: Grouped Notification - Partial Logging (Suppression)
═══════════════════════════════════════════════════════════════════════════════

  7:30 AM                           8:00 AM
     │                                 │
     ▼                                 │
  [User logs Med A only]               │
     │                                 │
     └──▶ Save Med A dose              │
                                       ▼
                              [Grouped notification fires]
                                       │
                                       ▼
                              [handleIncomingNotification()]
                                       │
                                       ▼
                              [Check each med in group:]
                              [  Med A: logged ✓ → filter out]
                              [  Med B: not logged → keep]
                              [  Med C: not logged → keep]
                                       │
                                       ▼
                              [Show notification for Med B, Med C]
                              (TODO: update content to exclude Med A)
                                    
  Result: Med B and Med C still get their reminder! ✓
```

---

## Action Matrix

This matrix shows what happens to notifications when various user actions occur.

### Legend
- **Cancel**: Remove from scheduled notifications (won't fire at all)
- **Suppress**: Notification fires but `handleIncomingNotification()` returns `shouldShowBanner: false` - notification is silently dropped but DAILY schedule remains intact for tomorrow
- **Dismiss**: Remove from notification tray (already presented)
- **Reschedule**: Cancel then re-create notification
- **-**: No effect

### Suppression vs. Cancellation (IMPORTANT)

The app has two strategies for preventing notifications. **Suppression is preferred** because it preserves the DAILY schedule.

| Strategy | How it works | Schedule preserved? | When to use |
|----------|--------------|---------------------|-------------|
| **Suppression** (preferred) | `handleIncomingNotification()` returns `shouldShowBanner: false` | Yes - fires again tomorrow | Daily state checks (already logged, active episode) |
| **Cancellation** (use sparingly) | `cancelScheduledNotificationAsync()` | No - must reschedule | Only for schedule/config changes |

#### When to use Suppression (let notification fire, suppress at display time)
- Dose already logged for today's schedule
- Active migraine episode (for daily check-in)
- Day status already logged (for daily check-in)

#### When to use Cancellation (remove from schedule)
- Schedule disabled by user
- Notification time changed
- Medication archived or deleted
- Global notifications toggled off
- Medication schedule removed

#### Current Problems with Cancellation
Cancellation is currently overused, causing these issues:
1. **Grouped notification bug** - Logging one med cancels reminder for all meds in group
2. **Follow-up tracking complexity** - Must track notification IDs to cancel follow-ups
3. **Orphaned notifications** - Snooze notifications not tracked, can't be cancelled
4. **Reinstatement needed** - After cancelling, must remember to reschedule

#### Refactoring Goal
Remove cancellation calls from dose logging flows. The `handleIncomingNotification()` handler already:
- Checks if single medication was logged → suppresses
- Checks if all grouped medications were logged → suppresses  
- Checks for active episode → suppresses daily check-in
- Checks if day status logged → suppresses daily check-in

**Files requiring changes to remove unnecessary cancellation:**
- `medicationStore.ts:239` - Remove `cancelScheduledMedicationReminder()` call in `logDose()`
- `medicationStore.ts:240` - Remove `dismissMedicationNotification()` call (keep for presented notifications?)
- `dailyStatusStore.ts` - Review `cancelAndDismissForDate()` call

### User Actions vs Notification Effects

**Key:** Suppress = notification fires but is silently dropped, schedule preserved for tomorrow

| User Action | Single Med Scheduled | Single Med Presented | Grouped Med Scheduled | Grouped Med Presented | Follow-up Scheduled | Daily Check-in Scheduled | Daily Check-in Presented |
|-------------|---------------------|---------------------|----------------------|----------------------|--------------------|-----------------------|-----------------------|
| Log medication dose (for that med) | (Suppress)† | Dismiss | (Suppress)† | Dismiss | (Suppress)† | - | - |
| Log medication via "Take Now" | (Suppress)† | Dismiss | - | - | (Suppress)† | - | - |
| Log all via "Take All" | - | - | (Suppress)† | Dismiss | (Suppress)† | - | - |
| Snooze (10min) | - | Dismiss | - | - | - | - | - |
| Remind Later | - | - | - | Dismiss | - | - | - |
| Archive medication | Reschedule (removes med) | - | Reschedule (removes med) | - | Reschedule | - | - |
| Unarchive medication | Reschedule | - | Reschedule | - | Reschedule | - | - |
| Add medication | Reschedule | - | Reschedule | - | Reschedule | - | - |
| Edit medication schedule | Reschedule | - | Reschedule | - | Reschedule | - | - |
| Delete medication | Cancel | - | Reschedule | - | Cancel | - | - |
| Global notifications toggle OFF | Cancel ALL | - | Cancel ALL | - | Cancel ALL | Cancel | - |
| Global notifications toggle ON | Reschedule ALL | - | Reschedule ALL | - | Reschedule ALL | Schedule | - |
| Change med notification time | Reschedule | - | Reschedule | - | Reschedule | - | - |
| Disable specific schedule | Cancel | - | Reschedule | - | Cancel | - | - |
| Enable specific schedule | Schedule | - | Reschedule | - | Schedule | - | - |
| Log daily status (today) | - | - | - | - | - | (Suppress)† | Dismiss |
| Log daily status (past day) | - | - | - | - | - | - | - |
| Start migraine episode | - | - | - | - | - | (Suppress)† | - |
| End migraine episode | - | - | - | - | - | - | - |
| "Clear Day" from notification | - | - | - | - | - | (Suppress)† | Dismiss |
| Change daily check-in time | - | - | - | - | - | Reschedule | - |
| Disable daily check-in | - | - | - | - | - | Cancel | - |
| Enable daily check-in | - | - | - | - | - | Schedule | - |

**Notes:**
- `†` Suppress = `handleIncomingNotification()` checks state and returns `shouldShowBanner: false`. Schedule remains intact for next day.
- Dismiss = Remove already-presented notification from tray
- Cancel/Reschedule = Only used for configuration changes, not daily state changes

---

## Detailed Action Flows

### 1. Logging a Medication Dose

**Entry Points:**
- `MedicationDetailScreen` - Log dose button
- `MedicationScreen` - Quick log
- Notification action - "Take Now"
- Notification action - "Take All"

**Current Code Flow (with unnecessary cancellation):**
```
medicationStore.logDose(medicationId, timestamp, quantity, scheduleId, notes)
  └─> Creates dose record in database
  └─> notificationService.cancelScheduledMedicationReminder(medicationId, scheduleId)  ← REMOVE
  └─> notificationService.dismissMedicationNotification(medicationId, scheduleId)      ← KEEP
```

**Recommended Code Flow (suppression-based):**
```
medicationStore.logDose(medicationId, timestamp, quantity, scheduleId, notes)
  └─> Creates dose record in database
  └─> notificationService.dismissMedicationNotification(medicationId, scheduleId)
        └─> Gets presented notifications
        └─> Dismisses matching notifications (removes from tray if showing)
        
  [Later, when scheduled notification fires:]
  └─> handleIncomingNotification() checks database
  └─> Finds dose already logged → suppresses (shouldShowBanner: false)
  └─> DAILY schedule remains intact for tomorrow
```

**File References:**
- `medicationStore.ts:219-265` - logDose
- `medicationNotifications.ts:627-679` - dismissMedicationNotification
- `notificationService.ts:44-150` - handleIncomingNotification (suppression logic)

---

### 2. Archiving a Medication

**Entry Points:**
- `MedicationDetailScreen` - Archive button
- `EditMedicationScreen` - Archive action

**Code Flow:**
```
medicationStore.archiveMedication(id)
  └─> Set medication.active = false in database
  └─> notificationService.rescheduleAllMedicationNotifications()
        └─> Get all scheduled notifications
        └─> Filter for medication notifications (exclude daily_checkin)
        └─> Cancel filtered notifications
        └─> Get all ACTIVE medications with schedules
        └─> Group by time
        └─> Schedule new notifications (archived med excluded)
```

**File References:**
- `medicationStore.ts:347-373` - archiveMedication
- `medicationNotifications.ts:685-767` - rescheduleAllMedicationNotifications

---

### 3. Unarchiving a Medication

**Entry Points:**
- `ArchivedMedicationsScreen` - Restore button

**Code Flow:**
```
medicationStore.unarchiveMedication(id)
  └─> Set medication.active = true in database
  └─> Check notification permissions
  └─> For each schedule on medication:
        └─> If schedule.notificationEnabled:
              └─> notificationService.scheduleNotification(medication, schedule)
              └─> Update schedule with new notificationId
```

**Issue:** This schedules individual notifications without considering grouping. Should call `rescheduleAllMedicationNotifications()` instead.

**File References:**
- `medicationStore.ts:375-414` - unarchiveMedication

---

### 4. Adding a New Medication

**Entry Points:**
- `AddMedicationScreen` - Save button

**Code Flow:**
```
Save medication
  └─> Create medication record
  └─> Create schedule records
  └─> notificationService.rescheduleAllMedicationNotifications()
        └─> (Same as archive flow)
```

**File References:**
- `AddMedicationScreen.tsx:376-377`

---

### 5. Editing Medication Schedule

**Entry Points:**
- `EditMedicationScreen` - Save button

**Code Flow:**
```
Save medication changes
  └─> Update medication record
  └─> Update schedule records
  └─> notificationService.rescheduleAllMedicationNotifications()
```

**File References:**
- `EditMedicationScreen.tsx:389-390`

---

### 6. Global Notifications Toggle

**Entry Points:**
- `NotificationSettingsScreen` - Master toggle

**Code Flow (Disable):**
```
setNotificationsGloballyEnabled(false)
  └─> Store in AsyncStorage
  └─> cancelAllNotifications()
        └─> Notifications.cancelAllScheduledNotificationsAsync()
```

**Code Flow (Enable):**
```
setNotificationsGloballyEnabled(true)
  └─> Store in AsyncStorage
  └─> rescheduleAllNotifications()
        └─> Cancel ALL scheduled notifications
        └─> Get active medications, group by time
        └─> Schedule medication notifications
        └─> dailyCheckinService.scheduleNotification()
```

**File References:**
- `notificationService.ts:608-624` - setGlobalNotificationsEnabled
- `medicationNotifications.ts:773-848` - rescheduleAllNotifications

---

### 7. Logging Daily Status

**Entry Points:**
- `HomeScreen` - Quick status buttons
- `DailyStatusScreen` - Status selection
- Notification action - "Clear Day"

**Current Code Flow (with unnecessary cancellation):**
```
dailyStatusStore.logDayStatus(date, status, notes, symptoms, prompted)
  └─> Upsert status in database
  └─> dailyCheckinService.cancelAndDismissForDate(date)
        └─> If date !== today: RETURN (no-op)
        └─> cancelNotification()              ← REMOVE cancellation
        └─> Dismiss presented notifications   ← KEEP dismiss
```

**Recommended Code Flow (suppression-based):**
```
dailyStatusStore.logDayStatus(date, status, notes, symptoms, prompted)
  └─> Upsert status in database
  └─> dailyCheckinService.dismissForDate(date)  ← Rename method
        └─> If date !== today: RETURN (no-op)
        └─> Get presented notifications
        └─> Dismiss any with type='daily_checkin'
        
  [Later, when scheduled notification fires:]
  └─> handleDailyCheckinNotification() checks database
  └─> Finds status already logged → suppresses
  └─> DAILY schedule remains intact for tomorrow
```

**File References:**
- `dailyStatusStore.ts:130-167` - logDayStatus
- `dailyCheckinService.ts:367-393` - cancelAndDismissForDate (rename to dismissForDate)

---

### 8. Changing Daily Check-in Settings

**Entry Points:**
- `NotificationSettingsScreen` - Daily check-in section

**Code Flow (Time Change):**
```
Update time in settings store
  └─> dailyCheckinService.rescheduleNotification()
        └─> scheduleNotification()
              └─> cancelNotification() (existing)
              └─> Check global enabled
              └─> Check daily check-in enabled
              └─> Schedule new DAILY notification at new time
```

**Code Flow (Disable):**
```
Update enabled=false in settings store
  └─> dailyCheckinService.cancelNotification()
```

**Code Flow (Enable):**
```
Update enabled=true in settings store
  └─> dailyCheckinService.scheduleNotification()
```

**File References:**
- `NotificationSettingsScreen.tsx:415` - rescheduleNotification call
- `dailyCheckinService.ts:243-311` - scheduleNotification

---

### 9. Snooze / Remind Later Actions

**Entry Points:**
- Notification action - "Snooze 10min" (single medication)
- Notification action - "Remind Later" (grouped medications)

**Code Flow (Single):**
```
handleSnooze(medicationId, scheduleId, minutes)
  └─> Get medication from repository
  └─> Get effective notification settings
  └─> Schedule ONE-TIME notification (DateTrigger) for now + minutes
  └─> Note: Original DAILY notification is NOT cancelled
```

**Code Flow (Grouped):**
```
handleRemindLater(medicationIds, scheduleIds, originalTime, minutes)
  └─> Get all medications
  └─> Determine timeSensitive from any medication's settings
  └─> Schedule ONE-TIME grouped notification for now + minutes
  └─> Note: Original DAILY notification is NOT cancelled
```

**Issue:** Neither snooze nor remind later cancels the original notification. If the user snoozes and then the original fires again the next day, this is correct behavior. But the snooze creates a one-time notification that will show in addition to any daily notifications.

**File References:**
- `medicationNotifications.ts:71-110` - handleSnooze
- `medicationNotifications.ts:198-254` - handleRemindLater

---

## Known Issues and Edge Cases

### Issues Fixed by Moving to Suppression Model

These issues will be resolved by removing cancellation calls and relying on `handleIncomingNotification()` suppression:

#### Issue 1: Grouped Notification Full Cancellation (FIXED BY SUPPRESSION)

**Location:** `medicationNotifications.ts:586-598`

**Problem:** When one medication in a grouped notification is logged, the entire grouped notification is cancelled. Other medications in the group lose their reminder.

**Fix:** Remove `cancelScheduledMedicationReminder()` call from `logDose()`. The `handleIncomingNotification()` already filters out logged medications and shows the notification for remaining ones.

---

#### Issue 2: Follow-up Notification Tracking (FIXED BY SUPPRESSION)

**Location:** `notificationService.ts:160`

**Problem:** The `followUpNotifications` Map only tracks follow-ups created for foreground notifications. Pre-scheduled DAILY follow-up notifications cannot be cancelled.

**Fix:** Don't cancel follow-ups at all. Let them fire and be suppressed by `handleIncomingNotification()` which checks if the medication was logged.

---

#### Issue 8: No Reinstatement After Day Status Deletion (FIXED BY SUPPRESSION)

**Problem:** If a user logs today's status, the daily check-in is cancelled. If they later delete that status entry, the notification is not reinstated.

**Fix:** Don't cancel on status log. Let notification fire and check status in `handleDailyCheckinNotification()`. If status was deleted, notification will show.

---

### Remaining Issues

#### Issue 3: Unarchive Doesn't Respect Grouping

**Location:** `medicationStore.ts:375-414`

**Problem:** `unarchiveMedication()` schedules individual notifications without considering time grouping with other medications.

**Scenario:**
1. Med A at 8:00 AM (active)
2. Med B at 8:00 AM (archived)
3. User unarchives Med B
4. System schedules individual notification for Med B
5. Now there are TWO 8:00 AM notifications instead of one grouped notification

**Fix:** Call `rescheduleAllMedicationNotifications()` instead of scheduling individually.

---

#### Issue 4: Daily Check-in Date Embedded at Schedule Time

**Location:** `dailyCheckinService.ts:279`

**Problem:** The `date` field in notification data is set at schedule time, not at fire time.

```typescript
data: {
  type: 'daily_checkin',
  date: format(new Date(), 'yyyy-MM-dd'),  // <-- Set when scheduled
}
```

**Impact:** Minor - action handlers fall back to current date if stale.

**Fix:** Remove `date` from data, always use current date in handlers.

---

#### Issue 5: Duplicate Android Priority Setting

**Location:** `dailyCheckinService.ts:288-297`

**Problem:** Android priority is set twice with identical values (code duplication).

**Fix:** Remove duplicate.

---

#### Issue 6: Orphaned Snooze Notifications

**Location:** `handleSnooze()` and `handleRemindLater()`

**Problem:** Snooze creates a one-time notification that isn't tracked. If user changes schedule time later that day, the snooze notification still fires.

**Impact:** Minor - snooze fires but will be suppressed if dose was logged.

**Note:** With suppression model, this is mostly a non-issue. Snooze fires, but if user logged the dose, it gets suppressed.

---

#### Issue 7: Race Condition on Notification Suppression

**Location:** `notificationService.ts:44-150`

**Problem:** Async database access during suppression check could cause brief notification appearance.

**Impact:** Low probability, brief flash at worst.

---

### TODO: Features Not Yet Implemented

#### Skip Action for Medication Reminders

Single medication notifications need a "Skip" action that:
1. Dismisses the notification
2. Records a "skipped" entry for tracking (optional)
3. Does NOT log a dose

#### Skip All Action for Grouped Reminders

Same as above but for all medications in the group.

#### Update Grouped Notification Content

When some medications in a group are already logged, the notification content should be updated to only list the remaining medications. Currently shows all medications even if some are logged.

---

## Regression Test Plan

### Testing Strategy

The notification system has three layers that need testing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: SUPPRESSION LOGIC (Unit Tests)                                     │
│ handleIncomingNotification() - decides show vs suppress                     │
│ ─────────────────────────────────────────────────────────────────────────── │
│ • Pure function, easy to test                                               │
│ • Mock database queries (wasLoggedForScheduleToday, getDayStatus, etc.)     │
│ • Verify NotificationBehavior return values                                 │
│ • Test all state combinations                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: ACTION HANDLERS (Unit Tests)                                       │
│ handleTakeNow(), handleSnooze(), handleClearDay(), etc.                     │
│ ─────────────────────────────────────────────────────────────────────────── │
│ • Mock database writes                                                      │
│ • Mock notification dismiss calls                                           │
│ • Verify correct database records created                                   │
│ • Verify correct notifications dismissed                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: SCHEDULING (Unit + Integration Tests)                              │
│ scheduleNotification(), rescheduleAllMedicationNotifications(), etc.        │
│ ─────────────────────────────────────────────────────────────────────────── │
│ • Verify correct trigger types (DAILY vs one-time)                          │
│ • Verify notification content and data                                      │
│ • Verify grouping logic                                                     │
│ • Integration: full flow from add medication → notification scheduled       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Test Category 1: Suppression Logic (handleIncomingNotification)

These tests validate that `handleIncomingNotification()` correctly decides whether to show or suppress a notification based on current database state.

#### Single Medication Notifications

| Test ID | Database State | Notification Data | Expected Result |
|---------|---------------|-------------------|-----------------|
| SUP-S1 | Dose NOT logged for schedule today | `{medicationId, scheduleId}` | SHOW (all flags true) |
| SUP-S2 | Dose LOGGED for schedule today | `{medicationId, scheduleId}` | SUPPRESS (all flags false) |
| SUP-S3 | Medication not found in DB | `{medicationId, scheduleId}` | SHOW (fail-safe) |
| SUP-S4 | Schedule not found on medication | `{medicationId, scheduleId}` | SHOW (fail-safe) |
| SUP-S5 | Database error during check | `{medicationId, scheduleId}` | SHOW (fail-safe) |

#### Grouped Medication Notifications

| Test ID | Database State | Notification Data | Expected Result |
|---------|---------------|-------------------|-----------------|
| SUP-G1 | NONE logged | `{medicationIds: [A,B,C], scheduleIds: [...]}` | SHOW |
| SUP-G2 | ALL logged | `{medicationIds: [A,B,C], scheduleIds: [...]}` | SUPPRESS |
| SUP-G3 | SOME logged (A logged, B+C not) | `{medicationIds: [A,B,C], scheduleIds: [...]}` | SHOW (for B,C) |
| SUP-G4 | One medication not found | `{medicationIds: [A,B,C], ...}` | SHOW (for found ones) |

#### Daily Check-in Notifications

| Test ID | Database State | Notification Data | Expected Result |
|---------|---------------|-------------------|-----------------|
| SUP-D1 | No status logged, no active episode | `{type: 'daily_checkin'}` | SHOW |
| SUP-D2 | Status already logged for today | `{type: 'daily_checkin'}` | SUPPRESS |
| SUP-D3 | Active migraine episode | `{type: 'daily_checkin'}` | SUPPRESS |
| SUP-D4 | Episode ended, no status | `{type: 'daily_checkin'}` | SHOW |

#### Test Implementation Example

```typescript
describe('handleIncomingNotification - Suppression Logic', () => {
  describe('Single Medication', () => {
    it('SUP-S1: should SHOW when dose not logged', async () => {
      // Arrange
      mockMedicationRepository.getById.mockResolvedValue(mockMedication);
      mockMedicationDoseRepository.wasLoggedForScheduleToday.mockResolvedValue(false);
      
      const notification = createMockNotification({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expect(result).toEqual({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      });
    });

    it('SUP-S2: should SUPPRESS when dose already logged', async () => {
      // Arrange
      mockMedicationRepository.getById.mockResolvedValue(mockMedication);
      mockMedicationDoseRepository.wasLoggedForScheduleToday.mockResolvedValue(true);
      
      const notification = createMockNotification({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
      });

      // Act
      const result = await handleIncomingNotification(notification);

      // Assert
      expect(result).toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      });
    });
  });
});
```

---

### Test Category 2: Action Handlers

These tests validate that notification action handlers correctly update database and dismiss notifications.

#### Take Now / Take All Actions

| Test ID | Action | Expected Database Effect | Expected Notification Effect |
|---------|--------|-------------------------|------------------------------|
| ACT-T1 | "Take Now" on single med | Dose record created with correct medicationId, scheduleId, timestamp | Notification dismissed |
| ACT-T2 | "Take All" on grouped | Dose record created for EACH medication | Grouped notification dismissed |
| ACT-T3 | "Take Now" when med not found | No dose created, no crash | Notification dismissed |

#### Snooze / Remind Later Actions

| Test ID | Action | Expected Effect |
|---------|--------|-----------------|
| ACT-SN1 | "Snooze 10min" | One-time notification scheduled for now+10min |
| ACT-SN2 | "Remind Later" on grouped | One-time grouped notification scheduled |
| ACT-SN3 | Snooze preserves original | DAILY notification NOT cancelled |

#### Daily Check-in Actions

| Test ID | Action | Expected Database Effect | Expected Notification Effect |
|---------|--------|-------------------------|------------------------------|
| ACT-DC1 | "Clear Day" | Status='green' record created, prompted=true | Notification dismissed |
| ACT-DC2 | "Not Clear" | No database change | App opens |

---

### Test Category 3: Dismiss Logic

These tests validate that dismiss is called correctly when logging from the app.

| Test ID | Scenario | Expected Behavior |
|---------|----------|-------------------|
| DIS-1 | Log dose, notification in tray | `dismissNotificationAsync` called with correct ID |
| DIS-2 | Log dose, notification NOT in tray | No error, no dismiss call |
| DIS-3 | Log dose for one med in group, group in tray | Grouped notification dismissed |
| DIS-4 | Log daily status, check-in in tray | Daily check-in dismissed |

---

### Test Category 4: Scheduling Logic

These tests validate that notifications are scheduled correctly.

#### Single Medication Scheduling

| Test ID | Scenario | Expected Notification |
|---------|----------|----------------------|
| SCHED-S1 | Med at 8:00 AM, no others at that time | Single notification, DAILY trigger at 8:00 |
| SCHED-S2 | Med with follow-up enabled (30min) | TWO notifications: 8:00 and 8:30 |
| SCHED-S3 | Schedule disabled | No notification scheduled |

#### Grouped Medication Scheduling

| Test ID | Scenario | Expected Notification |
|---------|----------|----------------------|
| SCHED-G1 | Med A + Med B both at 8:00 AM | ONE grouped notification with both IDs |
| SCHED-G2 | Med A at 8:00, Med B at 9:00 | TWO separate notifications |
| SCHED-G3 | 3 meds at 8:00, one has follow-up | Grouped primary + grouped follow-up |

#### Rescheduling

| Test ID | Scenario | Expected Behavior |
|---------|----------|-------------------|
| SCHED-R1 | Archive one med from group | Group recreated without archived med |
| SCHED-R2 | Unarchive med at same time as existing | Group recreated with unarchived med |
| SCHED-R3 | Change med time from 8:00 to 9:00 | Old cancelled, new scheduled at 9:00 |
| SCHED-R4 | Global toggle off | ALL notifications cancelled |
| SCHED-R5 | Global toggle on | ALL notifications rescheduled |

---

### Test Category 5: Integration Tests (Full Flow)

These tests validate complete user flows from action to final state.

#### Medication Flow

| Test ID | User Flow | Verify |
|---------|-----------|--------|
| INT-M1 | Add medication → Wait for notification time → Verify suppression check runs | handleIncomingNotification called with correct data |
| INT-M2 | Log dose from app → Notification fires later → Suppressed | Notification not shown |
| INT-M3 | Notification shows → Tap "Take Now" → Dose recorded | Database has dose, notification dismissed |
| INT-M4 | Ignore notification → Follow-up fires → Tap "Take Now" | Dose recorded, both dismissed |

#### Daily Check-in Flow

| Test ID | User Flow | Verify |
|---------|-----------|--------|
| INT-D1 | Log status from app → Check-in fires later → Suppressed | Notification not shown |
| INT-D2 | Start episode → Check-in fires → Suppressed | Notification not shown |
| INT-D3 | Check-in shows → Tap "Clear Day" → Status recorded | Database has green status |

---

### Test Category 6: Edge Cases

| Test ID | Scenario | Expected Behavior |
|---------|----------|-------------------|
| EDGE-1 | App killed, user taps action | `getLastNotificationResponseAsync` processed on init |
| EDGE-2 | Rapid setting changes | Final state is consistent |
| EDGE-3 | Timezone change | Notifications fire at correct local time |
| EDGE-4 | Database slow during suppression | Notification may briefly appear (acceptable) |
| EDGE-5 | Log dose, immediately delete dose | Next notification shows (suppression re-checks) |

---

### Test Implementation Files

```
app/src/services/__tests__/
├── notificationService.test.ts          # Existing - expand suppression tests
├── notificationSuppression.test.ts      # NEW - focused suppression tests
├── notificationHandlers.test.ts         # NEW - action handler tests  
├── notificationScheduling.test.ts       # NEW - scheduling logic tests
└── notifications/
    └── dailyCheckinService.test.ts      # Existing - expand suppression tests

app/src/__tests__/integration/
├── medicationNotificationFlow.test.ts   # NEW - full medication flows
└── dailyCheckinFlow.test.ts             # NEW - full daily check-in flows
```

---

### Test Utilities

```typescript
// Helper to create mock notification objects
function createMockNotification(data: Record<string, any>): Notifications.Notification {
  return {
    request: {
      identifier: `notif-${Date.now()}`,
      content: {
        title: 'Test Notification',
        body: 'Test body',
        data,
      },
      trigger: { type: 'daily', hour: 8, minute: 0 },
    },
    date: Date.now(),
  } as any;
}

// Helper to set up database state
async function setupDatabaseState(options: {
  medications?: Medication[];
  doses?: MedicationDose[];
  dailyStatuses?: DayStatus[];
  currentEpisode?: Episode | null;
}) {
  // Configure mocks based on options
}

// Helper to verify suppression result
function expectSuppressed(result: Notifications.NotificationBehavior) {
  expect(result).toEqual({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  });
}

function expectShown(result: Notifications.NotificationBehavior) {
  expect(result).toEqual({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  });
}
```

---

### Manual Testing Checklist (Device/Simulator)

Unit tests validate logic, but notifications require device testing for:
- Actual notification appearance
- System notification tray behavior
- Action button functionality
- Background/killed app handling

#### Quick Validation Test (5 minutes)

Use the developer testing tools in Settings → Notifications → Test Notifications:

| Step | Action | Expected |
|------|--------|----------|
| 1 | Trigger test medication notification | Notification appears with actions |
| 2 | Tap "Take Now" | Notification dismisses, dose logged |
| 3 | Trigger same notification again | Should be SUPPRESSED (already logged) |
| 4 | Clear dose from database | - |
| 5 | Trigger notification again | Should SHOW (no longer logged) |

#### Full Regression Test (30 minutes)

**Setup:**
1. Create test medication "Test Med" at a time 2 minutes from now
2. Create second test medication "Test Med 2" at same time (for grouping)
3. Enable follow-up reminders (15 min delay)
4. Enable daily check-in at a time 5 minutes from now

**Test Sequence:**

| # | Wait | Action | Verify |
|---|------|--------|--------|
| 1 | 0 | Observe scheduled notifications | 2 grouped + 1 follow-up + 1 daily check-in |
| 2 | 2min | Let grouped notification fire | Both meds shown in notification |
| 3 | 0 | Tap "Take All" | Both doses logged, notification dismissed |
| 4 | 15min | Wait for follow-up | Should be SUPPRESSED (both logged) |
| 5 | - | Delete one dose record | - |
| 6 | - | Trigger notification manually | Should SHOW (one not logged) |
| 7 | 5min | Let daily check-in fire | Should SHOW |
| 8 | 0 | Tap "Clear Day" | Status logged as green |
| 9 | - | Trigger check-in manually | Should be SUPPRESSED |
| 10 | - | Delete status record | - |
| 11 | - | Trigger check-in manually | Should SHOW |
| 12 | - | Start migraine episode | - |
| 13 | - | Trigger check-in manually | Should be SUPPRESSED |

#### Background/Killed App Test

| # | State | Action | Verify |
|---|-------|--------|--------|
| 1 | App in foreground | Trigger notification, tap action | Works normally |
| 2 | App in background | Trigger notification, tap action | Action processed, app wakes |
| 3 | App killed | Trigger notification, tap action | Action processed on next app launch |
| 4 | App killed | Trigger notification, tap notification body | App opens to correct screen |

---

### Automated E2E Tests (Detox)

For CI/CD, key notification flows can be tested with Detox:

```typescript
// e2e/notificationSuppression.test.ts

describe('Notification Suppression', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should suppress medication notification when dose already logged', async () => {
    // 1. Create medication with schedule
    await element(by.id('add-medication-button')).tap();
    await element(by.id('medication-name-input')).typeText('Test Med');
    // ... complete medication creation
    
    // 2. Log a dose
    await element(by.id('log-dose-button')).tap();
    await element(by.id('confirm-dose')).tap();
    
    // 3. Trigger notification via deep link or test helper
    await device.openURL({ url: 'migralog://test/trigger-notification?medicationId=...' });
    
    // 4. Verify notification was suppressed (no system notification visible)
    // Note: Detox has limited notification verification - may need custom native module
    
    // 5. Alternatively, verify via app state
    await expect(element(by.id('notification-debug-last-result'))).toHaveText('suppressed');
  });
});
```

**Note:** Full notification E2E testing is limited because:
- Detox cannot directly inspect system notification tray
- DAILY triggers can't be easily simulated
- Requires custom test hooks or debug endpoints

**Recommended approach:**
1. Unit test suppression logic thoroughly (handleIncomingNotification)
2. Integration test action handlers
3. Manual device testing for actual notification appearance
4. Debug/test mode in app that shows suppression decisions

---

## Implementation Notes for Tests

### Accessing Notification State

```typescript
import * as Notifications from 'expo-notifications';

// Get all scheduled notifications
const scheduled = await Notifications.getAllScheduledNotificationsAsync();

// Get all presented notifications
const presented = await Notifications.getPresentedNotificationsAsync();

// Filter by type
const medicationNotifications = scheduled.filter(n => 
  n.content.data?.medicationId || n.content.data?.medicationIds
);

const dailyCheckinNotifications = scheduled.filter(n =>
  n.content.data?.type === 'daily_checkin'
);
```

### Mocking for Unit Tests

```typescript
jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));
```

---

## File Reference Index

| File | Key Functions |
|------|--------------|
| `medicationNotifications.ts` | `scheduleSingleNotification`, `scheduleMultipleNotification`, `cancelScheduledMedicationReminder`, `dismissMedicationNotification`, `rescheduleAllMedicationNotifications`, `rescheduleAllNotifications`, `handleTakeNow`, `handleSnooze`, `handleTakeAllNow`, `handleRemindLater` |
| `dailyCheckinService.ts` | `scheduleNotification`, `cancelNotification`, `rescheduleNotification`, `cancelAndDismissForDate`, `handleDailyCheckinNotification`, `handleClearDay` |
| `notificationService.ts` | Main service class, coordinates all notification operations |
| `notificationScheduler.ts` | Low-level `cancelNotification`, `cancelAllNotifications`, `dismissNotification` |
| `notificationUtils.ts` | `areNotificationsGloballyEnabled`, `setNotificationsGloballyEnabled` |
| `notificationSettingsStore.ts` | Settings for medication notifications |
| `dailyCheckinSettingsStore.ts` | Settings for daily check-in |
| `medicationStore.ts` | `logDose`, `archiveMedication`, `unarchiveMedication` |
| `dailyStatusStore.ts` | `logDayStatus` |
