## Scenario 1

_Situation_: User has two medication reminder notification scheduled for 9:20 and a followup scheduled for 9:50.


1. Action: user takes both medications and logs them before 9:20
    1.1 Outcome: user does not receive the 9:20 medication reminder notification  
    1.2 Outcome: user does not receive the 9:50 medication reminder notification
2. Action: user receives the notification and logs them from the notification
    2.1 Outcome: medication is logged correctly
    2.2 Outcome: notification is dismissed
    2.3 Outcome: user does not receive 9:50 notification 
3. Action: user dismisses the 9:20 notification without logging medication
    3.1 Outcome: notification is dismissed
    3.2 Outcome: user still receives the 9:50 follow-up notification
    3.3 Outcome: medications remain unlogged
4. Action: user snoozes the 9:20 notification
    4.1 Outcome: notification is dismissed temporarily
    4.2 Outcome: notification reappears after snooze duration
    4.3 Outcome: follow-up notification timing unchanged (still triggers at 9:50)
5. Action: user logs one medication before 9:20, other medication is not logged
    5.1 Outcome: user receives 9:20 notification for the unlogged medication only
    5.2 Outcome: user still receives 9:50 follow-up notification for the unlogged medication
6. Action: user logs both medications at 10pm from the app
    6.1 Both the reminder and the followup notification are dismissed.

## Scenario 2

_Situation_: User has a medication reminder scheduled for 10:00 AM.

1. Action: user logs medication at 9:55 AM (before notification)
    1.1 Outcome: medication is recorded with timestamp 9:55 AM
    1.2 Outcome: 10:00 AM notification is cancelled
2. Action: user logs medication at 10:05 AM in the application (after notification time)
    2.1 Outcome: notification is dismissed
    2.2 Outcome: medication is recorded with timestamp 10:05 AM
3. Action: user logs same medication multiple times in one day
    3.1 Outcome: each log is recorded separately with its own timestamp
    3.2 Outcome: next scheduled notification still triggers at originally scheduled time

## Scenario 3

_Situation_: User has multiple medication reminders scheduled throughout the day (8:00 AM, 12:00 PM, 6:00 PM).

1. Action: user disables all notifications in app settings at 7:00 AM
    1.1 Outcome: no notifications are triggered for any scheduled times
    1.2 Outcome: medication reminders remain in schedule but silent
    1.3 Outcome: user can still manually log medications
2. Action: user re-enables notifications at 1:00 PM
    2.1 Outcome: past notifications (8:00 AM, 12:00 PM) are NOT retroactively sent
    2.2 Outcome: future notifications (6:00 PM) will trigger normally
3. Action: user modifies medication schedule while notification is pending
    3.1 Outcome: pending notification is cancelled
    3.2 Outcome: new notification scheduled based on updated time
    3.3 Outcome: follow-up notifications are rescheduled accordingly

## Scenario 4

_Situation_: App is force-quit or device is restarted. User has pending medication reminders.

1. Action: app is force-quit at 9:00 AM, notification scheduled for 9:30 AM
    1.1 Outcome: notification still triggers at 9:30 AM (handled by OS)
    1.2 Outcome: user can log medication from notification action
    1.3 Outcome: when app reopens, notification state syncs correctly
2. Action: device restarts, multiple notifications were scheduled
    2.1 Outcome: all scheduled notifications are re-registered on app launch
    2.2 Outcome: past-due notifications are NOT triggered
    2.3 Outcome: future notifications continue on schedule

## Scenario 5

_Situation_: user has a how's my day reminder scheduled at 9pm

1. Action: user has an active episode 
    1.1 Outcome: user does not receive the "HMD" notification
2. Action: user an an active episode early in the day that is now finished
    2.1 Outcome: user does not receive the "HMD" notification
3. Action: user logs their day before 9pm
    3.1 Outcome: user does not receive the "HMD" notification
4. Action: user does not have an active episode and they haven't logged their day
    4.1 outcome: user receives the HMD notification