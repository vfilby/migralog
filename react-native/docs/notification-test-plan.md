# Notification Test Plan

This document provides a structured test plan for verifying notification behavior on the iOS simulator.

## Prerequisites

1. Development build of MigraLog running on iOS simulator
2. Notification permissions granted
3. Simulator in foreground or background (not terminated)

## Quick Setup

> **WARNING**: This will clear all existing medications and create test data!

1. Open MigraLog on the simulator
2. Navigate to **Settings > Developer Tools**
3. Tap **"Setup Notification Tests"**
4. Confirm the setup (acknowledging data will be reset)
5. Note the scheduled times and instructions shown

## Test Scenarios

The setup creates 5 single-medication notifications, each named for the action you should take.
Snooze and Ignore come first since they have follow-up actions to wait for.

| Time | Medication Name | Action to Take | Purpose |
|------|-----------------|----------------|---------|
| +1 min | ACTION: Snooze | Tap "Snooze" | Verify Snooze reschedules notification |
| +2 min | ACTION: Ignore (Follow-up) | Do nothing | Verify follow-up appears at +4 min |
| +3 min | ACTION: Skip This | Tap "Skip" | Verify Skip action works |
| +4 min | ACTION: Take Now | Tap "Take Now" | Verify Take Now logs dose |
| +5 min | TEST: Pre-Take | Log dose before notification | Verify notification is cancelled |

## Detailed Test Instructions

### Test 1: Snooze Action (+1 min)

**When notification appears:**
1. [ ] Notification shows "Time for ACTION: Snooze"
2. [ ] Tap "Snooze" action button
3. [ ] Verify notification dismisses
4. [ ] Verify a new notification appears after snooze delay

### Test 2: Follow-up Test (+2 min, +4 min)

**Initial notification (+2 min):**
1. [ ] Notification shows "Time for ACTION: Ignore (Follow-up)"
2. [ ] Do NOT interact with the notification
3. [ ] Let it sit in notification center

**Follow-up notification (+4 min):**
4. [ ] Follow-up notification appears "Reminder: ACTION: Ignore (Follow-up)"
5. [ ] Body says "Did you take your medication?"
6. [ ] Verify follow-up actions work correctly

### Test 3: Skip Action (+3 min)

**When notification appears:**
1. [ ] Notification shows "Time for ACTION: Skip This"
2. [ ] Tap "Skip" action button
3. [ ] Verify notification dismisses
4. [ ] Check Medications screen - dose should show as "Skipped"

### Test 4: Take Now Action (+4 min)

**When notification appears:**
1. [ ] Notification shows "Time for ACTION: Take Now"
2. [ ] Tap "Take Now" action button
3. [ ] Verify notification dismisses
4. [ ] Check Medications screen - dose should show as "Taken"

### Test 5: Pre-Take Cancellation (+5 min)

**Before notification fires:**
1. [ ] Go to Medications screen immediately after setup
2. [ ] Find "TEST: Pre-Take" medication
3. [ ] Log a dose for it manually (tap the medication, log dose)
4. [ ] Wait past the +5 min mark

**Expected result:**
5. [ ] No notification should appear for "TEST: Pre-Take"
6. [ ] This verifies that taking a dose cancels the pending notification

## App State Testing

After running the action tests, you can also verify behavior in different states:

### Background
1. [ ] Put app in background before notification fires
2. [ ] Verify notification appears on lock screen
3. [ ] Verify actions work from lock screen

### Terminated
1. [ ] Force-quit the app
2. [ ] Verify notification still fires at scheduled time
3. [ ] Verify tapping notification opens app correctly

## Verification Checklist

After completing all tests:

- [ ] Skip action marked dose as skipped
- [ ] Take Now action logged the dose
- [ ] Snooze action rescheduled the notification
- [ ] Follow-up appeared 2 minutes after ignored notification
- [ ] Pre-taken medication did NOT trigger a notification
- [ ] All actions worked from both foreground and background

## Troubleshooting

### Notifications not appearing
- Check Settings > Notifications > MigraLog is enabled
- Verify app has notification permissions
- Check Developer Tools > View Scheduled Notifications

### Actions not working
- Check console logs for errors
- Verify notification categories are registered
- Restart app and try again

### Need to re-run tests
- Tap "Setup Notification Tests" again
- This clears all data and creates fresh test medications

## Clean Up

To restore normal operation after testing:
- Restore from a backup via Settings > Backups
- Or manually re-add your medications

Note: Test data includes real database records so that notification actions work properly.
