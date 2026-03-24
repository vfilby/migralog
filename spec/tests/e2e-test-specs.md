# E2E Test Specifications

Framework-agnostic end-to-end test specifications for MigraineTracker.
These specs describe **what** to test and **expected behavior**, not **how** to automate it.

> **Current implementation**: Detox (JavaScript) — `/react-native/e2e/`
>
> These specs should be sufficient to rewrite E2E tests in any framework
> (Maestro, Appium, XCUITest, etc.).

---

## Prerequisites & Setup

### Test Environment

- **Device**: iPhone simulator, iOS 17+
- **Screen size**: 375×812 (iPhone SE/13 mini baseline)
- **Database**: Reset to empty state before each test suite unless noted
- **Fixtures**: Some tests require pre-loaded fixture data (medications with schedules, logged doses, episodes)

### Fixture Data

When tests require fixtures, load these entities:

| Entity | Name | Details |
|--------|------|---------|
| Preventative medication | Test Topiramate | 50mg, daily at 8:00 AM, with schedule |
| Preventative medication | Test Magnesium | 400mg, daily at 8:00 AM, with schedule |
| Rescue medication | Test Ibuprofen | 400mg, as needed |
| Episode (closed) | — | Yesterday, 4h duration, intensity 3→7→4 |

### Common Helpers

- **Reset database**: Clear all data, return to dashboard
- **Reset with fixtures**: Clear and load fixture data above
- **Skip onboarding**: Bypass welcome flow, land on dashboard
- **Wait for animation**: Pause 300–500ms after navigation transitions
- **Scroll to element**: Scroll a view until a target element is visible

---

## Test Suite 1: Onboarding Workflow

### 1.1 Complete onboarding flow

**Preconditions**: Fresh app install (no onboarding completed)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | App launches | Welcome screen visible with "Welcome to MigraLog" |
| 2 | Tap "Continue" | Medical Disclaimer screen appears |
| 3 | Tap "Continue" | Notification Permissions screen appears |
| 4 | Tap "Continue" | System notification permission dialog appears |
| 5 | Grant notification permission ("Allow") | Permission granted, may see Critical Alerts dialog |
| 6 | If Critical Alerts dialog: tap "Allow" | Critical alerts enabled |
| 7 | Screen advances to Location Services | "Location Services" screen visible with "Finish Setup" |
| 8 | Tap "Finish Setup" | System location permission dialog appears |
| 9 | Grant location ("Allow While Using App") | Permission granted |
| 10 | Dashboard appears | "MigraLog" title visible, onboarding complete |

### 1.2 Cached permissions (subsequent launches)

**Preconditions**: Permissions already granted from prior run

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate through all 4 onboarding steps | No system dialogs appear (permissions cached) |
| 2 | Complete onboarding | Dashboard visible |

---

## Test Suite 2: Episode Lifecycle

### 2.1 Complete episode lifecycle (create → edit → update → end)

**Preconditions**: Database reset, onboarding complete

| Step | Action | Expected Result |
|------|--------|-----------------|
| **Phase 1: Create** | | |
| 1 | Tap "Start Episode" on dashboard | New Episode form appears |
| 2 | Tap "Save" (accept defaults) | Episode created, returns to dashboard |
| 3 | Dashboard shows active episode card | Card shows "Ongoing" badge, start time |
| **Phase 1.5: Auto red day** | | |
| 4 | Navigate to Trends tab | Calendar visible |
| 5 | Verify today's date | Today has red (episode) status dot |
| **Phase 2: View details** | | |
| 6 | Navigate to dashboard, tap active episode card | Episode Detail screen shows "Ongoing" badge |
| 7 | Verify detail fields | Start time, duration (updating), location visible |
| **Phase 3: Edit episode** | | |
| 8 | Tap "Edit" button | Edit mode opens |
| 9 | Select symptoms: Nausea, Light Sensitivity | Symptoms selected (chips highlighted) |
| 10 | Select triggers: Stress, Lack of Sleep | Triggers selected |
| 11 | Add note: "Started with stress and poor sleep" | Note text entered |
| 12 | Save edits | Returns to detail view with edits visible |
| **Phase 4: Log intensity update** | | |
| 13 | Tap "Log Update" | Log Update form appears |
| 14 | Adjust intensity slider to 7 | Slider shows 7, color reflects pain scale |
| 15 | Select additional symptoms: Sound Sensitivity, Dizziness | Symptoms added |
| 16 | Add note: "Pain getting worse with new symptoms" | Note entered |
| 17 | Save update | Returns to detail, timeline updated |
| **Phase 5: Verify timeline** | | |
| 18 | Scroll to Timeline section | Timeline visible |
| 19 | Verify timeline entries | Shows ALL event types merged chronologically: intensity readings, symptom changes, pain location changes, notes |
| 20 | Timeline has colored dots | Dots colored by pain scale (green→red→purple), each event type has a distinct icon |
| 21 | Sparkline visible and updated | Intensity line chart (min 80pt tall) rendered above timeline, shows new reading added in step 14 |
| **Phase 6: End episode** | | |
| 22 | Scroll to bottom action bar | "End Now" and "End..." buttons visible |
| 23 | Tap "End Now" | Episode ended |
| 24 | "Ongoing" badge removed | Status shows resolved |
| **Phase 6.5: Calendar verification** | | |
| 25 | Navigate to Trends tab | Calendar shows red day(s) for episode date(s) |
| **Phase 7: History** | | |
| 26 | Navigate to Episodes tab | Episode appears in list as first item |
| 27 | Episode card shows sparkline | Intensity sparkline with colored dots visible |
| 28 | Episode card shows duration | Resolved duration displayed |

### 2.2 Custom end time

**Preconditions**: Active episode exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open episode detail | "Ongoing" badge visible |
| 2 | Tap "End..." button | Date/time picker modal appears |
| 3 | Select a time in the past | Time selected |
| 4 | Confirm | Episode ended with custom time |
| 5 | Navigate to Episodes tab | Episode card shows no "Ongoing" badge, has "Ended:" label |

### 2.3 Cancel custom end time

**Preconditions**: Active episode exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open episode detail, tap "End..." | Date/time picker appears |
| 2 | Tap "Cancel" | Modal dismissed |
| 3 | Episode still active | "Ongoing" badge still visible |

---

## Test Suite 3: Daily Status Tracking

### 3.1 Full daily status workflow

**Preconditions**: Database reset

| Step | Action | Expected Result |
|------|--------|-----------------|
| **Phase 1: Calendar** | | |
| 1 | Navigate to Trends tab | Calendar with month navigation visible |
| 2 | Navigate to previous month | Previous month's calendar shown |
| **Phase 2: Green day** | | |
| 3 | Tap a past date on calendar | Daily Status prompt appears |
| 4 | Tap "Clear" (green button) | Green day type selected |
| 5 | Tap "Save" | Status saved, calendar shows green dot on that date |
| **Phase 3: Yellow day** | | |
| 6 | Tap a different past date | Daily Status prompt appears |
| 7 | Tap "Not Clear" (yellow button) | Yellow day options appear |
| 8 | Select "Prodrome" type | Type selected |
| 9 | Enter note text | Note saved |
| 10 | Tap "Save" | Calendar shows yellow dot on that date |
| **Phase 4: Episode creates red day** | | |
| 11 | Go to Dashboard, start episode | Episode created |
| 12 | Navigate to Trends | Today has red dot (auto-created) |
| **Phase 5: End episode** | | |
| 13 | Go to Dashboard, end episode | Episode ended |
| **Phase 6: Verify calendar** | | |
| 14 | Navigate to Trends | Green, yellow, and red dots all visible on correct dates |

### 3.2 Yellow day without type selection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap past date, tap "Not Clear" | Yellow day form appears |
| 2 | Save without selecting type | Saves successfully (type is optional) |

### 3.3 Skip daily status prompt

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap past date to open prompt | Daily Status prompt visible |
| 2 | Tap "Skip" | Returns to Trends without saving |

### 3.4 Dashboard widget visibility

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On dashboard | "How was yesterday?" widget visible |
| 2 | Log yesterday as green via calendar | Widget changes to "logged" state |
| 3 | Widget shows logged status | "Yesterday logged as Clear day" with Undo button |

### 3.5 Undo daily status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log yesterday as green | Widget shows logged state |
| 2 | Tap "Undo" on widget | Widget returns to prompt state |
| 3 | Calendar updated | Green dot removed from yesterday |

---

## Test Suite 4: Medication Tracking

### 4.1 Preventative medication logging

**Preconditions**: Fixture data loaded (medications with schedules)

| Step | Action | Expected Result |
|------|--------|-----------------|
| **Phase 1: Dashboard** | | |
| 1 | Verify dashboard | "Today's Medications" card visible with medications |
| **Phase 2: Log medication** | | |
| 2 | Find medication with "Log" and "Skip" buttons | Buttons visible for unlogged medication |
| 3 | Tap "Log" button (shows "Log 1 × 50mg") | Medication logged |
| **Phase 3: Verify UI** | | |
| 4 | Wait for UI update | "Taken at [time]" label appears with ✓ icon |
| 5 | "Undo" button visible | Undo option shown |
| 6 | Original "Log" button NOT visible | Replaced by taken status |
| **Phase 4: Undo** | | |
| 7 | Tap "Undo" | Medication returns to pending state |
| 8 | "Log" and "Skip" buttons reappear | Ready for re-logging |
| **Phase 5: Skip** | | |
| 9 | Tap "Skip" | "Skipped" label appears with ✕ icon |
| 10 | "Log" and "Skip" buttons hidden | Replaced by skipped status |

### 4.2 Rescue medication logging

**Preconditions**: Fixture data loaded

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap "Log Medication" button on dashboard | Log Medication modal appears |
| 2 | Verify rescue medication listed | "Test Ibuprofen" visible in list |
| 3 | Close modal | Returns to dashboard |

### 4.3 Status sync between Dashboard and Medications screen

**Preconditions**: Fixture data loaded

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify unlogged medication on dashboard | Skip/Log buttons visible |
| 2 | Navigate to Medications tab | Medications screen loads |
| 3 | Return to Dashboard, skip medication | "Skipped" status shown |
| 4 | Navigate to Medications tab | Dose shows "[time] dose skipped" |
| 5 | Return to Dashboard, undo skip | Buttons reappear |
| 6 | Log the medication | "Taken at [time]" shown |
| 7 | Navigate to Medications tab | Dose shows "[time] dose taken at [time]" |

---

## Test Suite 5: Medication Dose Edit/Delete

### 5.1 Delete a medication dose

**Preconditions**: Fixture data loaded

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Medications tab, tap medication | Medication detail screen |
| 2 | Tap "Log Dose Now" | Dose logged |
| 3 | Scroll to "Recent Activity" section | Today's dose visible |
| 4 | Long-press dose entry | Action menu with "Delete" option |
| 5 | Tap "Delete", confirm in dialog | Dose removed |
| 6 | Verify | "No doses logged in the last 30 days" message |

### 5.2 Edit dose amount

**Preconditions**: Dose logged for medication

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long-press dose entry | Action menu appears |
| 2 | Tap "Edit" | Edit modal opens with current amount |
| 3 | Change amount from 1 to 4 | Amount field updated |
| 4 | Tap "Save" | Modal closes |
| 5 | Verify | "4 × 50mg" visible (was "1 × 50mg") |
| 6 | Navigate away and back | Change persists |

### 5.3 Cancel edit preserves original

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long-press dose, tap "Edit" | Edit modal opens |
| 2 | Tap "Cancel" | Modal dismissed |
| 3 | Original amount unchanged | "1 × 50mg" still visible |

### 5.4 Cancel delete preserves dose

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long-press dose, tap "Delete" | Confirmation dialog appears |
| 2 | Tap "Cancel" | Dialog dismissed |
| 3 | Dose still visible | Entry unchanged |

---

## Test Suite 6: Medication Archiving

### 6.1 Archive and restore workflow

**Preconditions**: Fixture data loaded

| Step | Action | Expected Result |
|------|--------|-----------------|
| **Phase 1–2: Navigate** | | |
| 1 | Go to Medications tab | "Test Topiramate" visible |
| 2 | Tap medication | Detail screen opens |
| **Phase 3–4: Archive** | | |
| 3 | Scroll to "Archive Medication" button, tap | Confirmation alert appears |
| 4 | Confirm "Archive" | Medication archived |
| **Phase 5: Verify hidden** | | |
| 5 | Return to Medications list | "Test Topiramate" NOT visible in active list |
| **Phase 6–7: Find in archive** | | |
| 6 | Tap "Archived" link | "Archived Medications" screen opens |
| 7 | Medication visible | "Test Topiramate" shown with "Restore" button |
| **Phase 8: Restore** | | |
| 8 | Tap "Restore", confirm | Medication restored |
| **Phase 9: Verify restored** | | |
| 9 | Go back to active list | "Test Topiramate" visible again |
| **Phase 10: Dose history preserved** | | |
| 10 | Go to Dashboard | "Today's Medications" card shows medication |
| 11 | Log a dose | Dose logs successfully |

### 6.2 Archive medication with active reminders

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Archive medication that has daily schedule | Medication archived |
| 2 | Go to Dashboard | Archived medication NOT in "Today's Medications" |
| 3 | Restore the medication | Medication re-activated |
| 4 | Go to Dashboard | Medication appears in "Today's Medications" again |

---

## Test Suite 7: Trends & Analytics

### 7.1 Navigation and main components

**Preconditions**: Database reset

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Trends tab | "Trends & Analytics" title visible |
| 2 | Calendar visible | Month navigation (‹ ›) and weekday headers |
| 3 | Time range selector visible | Buttons: 7d, 14d, 30d, 60d, 90d |
| 4 | Statistics section visible | Section header present |

### 7.2 Time range switching

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap "7d" button | Button selected (highlighted), stats update |
| 2 | Tap "90d" button | Button selected, stats show broader range |
| 3 | Tap "30d" button | Returns to 30-day view |

### 7.3 Empty state

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | No episodes in database | "No episodes in selected period" message |
| 2 | Day statistics still visible | Shows migraine days, not-clear days, clear days, unknown days (all zero) |

### 7.4 Statistics with data

**Preconditions**: Fixture data loaded

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll to duration metrics | Total episodes, shortest/longest/average duration visible |
| 2 | Values are non-zero | Reflect fixture episode data |

### 7.5 Medication usage empty state

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | No medication doses logged | "No rescue medication usage in selected period" |

### 7.6 Medication usage with data

**Preconditions**: Fixture data with medication doses

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll to medication section | "Rescue Medication Usage" header visible |

### 7.7 Calendar month navigation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap ‹ (previous) | Previous month displayed |
| 2 | Tap › (next) | Returns to current month |

### 7.8 Time range persistence across navigation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "90d" time range | 90-day view active |
| 2 | Navigate to Dashboard tab | Dashboard shown |
| 3 | Return to Trends tab | "90d" still selected |

---

## Test Suite 8: Notification Settings

### 8.1 Global notification settings

**Preconditions**: Fixture data loaded

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap settings gear on dashboard | Settings screen opens |
| 2 | Scroll to and tap "Notifications" | Notification Settings screen opens |
| 3 | Verify settings visible | Time-Sensitive, Follow-up Reminder, Critical Alerts toggles (or "Enable Notifications" if permission not granted) |

### 8.2 Per-medication notification overrides

**Preconditions**: Fixture data loaded

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to Medications tab, tap "Test Topiramate" | Detail screen |
| 2 | Scroll to "Notification Overrides" section | Section visible |
| 3 | Tap to expand | Shows per-medication notification toggles |

---

## Test Suite 9: Error Handling

### 9.1 Database error toast

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger database error (via test deep link or action) | Error toast appears: "Failed to log medication" |
| 2 | Toast auto-dismisses or is dismissible | App remains responsive |

### 9.2 Multiple errors without crash

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger error 3 times in succession | Each may show toast |
| 2 | Verify app responsive | Dashboard still functional |

### 9.3 Dose edit validation

**Preconditions**: Fixture data, dose logged

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open dose edit modal | Edit form visible |
| 2 | Set amount to 0 | Invalid value entered |
| 3 | Tap "Save" | "Invalid Amount" validation alert appears |
| 4 | Dismiss alert | Can correct the value |

### 9.4 Interaction with deleted data

**Preconditions**: Fixture data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log a dose | Dose appears in recent activity |
| 2 | Delete the dose | Dose removed |
| 3 | Verify | "No doses logged in the last 30 days" message |

---

## Test Suite 10: Accessibility

### 10.1 Dashboard accessibility labels

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify dashboard loads | "MigraLog" title visible |
| 2 | Check Settings button | Has accessibility label "Settings" |
| 3 | Check "Start Episode" button | Has accessibility label |
| 4 | Check Daily Status Widget buttons | "Clear day" and "Not clear day" labels |

### 10.2 Navigation accessibility

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Settings button is tappable and labeled | Accessible |
| 2 | Tab bar items are labeled | Each tab has text label |
| 3 | Navigate between all tabs | All transitions work |

### 10.3 Form accessibility

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open New Episode screen | Form loads |
| 2 | "Save" button has accessibility label | Accessible |
| 3 | "Cancel" button has accessibility label | Accessible |

### 10.4 Touch target sizes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | All interactive elements | Minimum 44×44 point touch targets |
| 2 | Settings button tappable | Responds to tap |
| 3 | Medication log/skip buttons tappable | Respond to tap (when fixtures loaded) |

### 10.5 High contrast elements

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Interactive elements visible | Sufficient contrast |
| 2 | Navigate to Settings | Theme options (Light/Dark/System) visible |

### 10.6 Accessibility hints

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Settings button | Has accessibility hint |
| 2 | Start Episode button | Has accessibility hint |

---

## Test ID Reference

Key `testID` values used across the app for element identification:

### Dashboard
- `dashboard-title`, `settings-button`, `start-episode-button`, `log-medication-button`
- `todays-medications-card`, `active-episode-card`, `daily-status-widget`
- `daily-status-widget-logged`, `undo-status-button`

### Episodes
- `episodes-screen`, `episode-card-{index}`, `save-episode-button`
- `edit-episode-button`, `end-now-button`, `end-custom-button`
- `log-update-button`, `episode-detail-scroll`

### Medications
- `medications-screen`, `medication-card-{name}`, `log-dose-button`
- `archive-medication-button`, `archived-medications-link`
- `restore-medication-{name}`, `dose-amount-input`
- `log-medication-title`

### Trends
- `trends-screen`, `calendar-previous`, `calendar-next`
- `calendar-day-{YYYY-MM-DD}`, `time-range-{N}` (7, 14, 30, 60, 90)
- `duration-metrics-card`, `day-statistics-card`
- `total-episodes-row`, `migraine-days-row`, `clear-days-row`

### Daily Status
- `green-day-button`, `yellow-day-button`, `save-status-button`
- `skip-button`, `daily-status-notes-input`
- `yellow-type-prodrome`, `yellow-type-postdrome`

### Settings
- `notification-settings`, `theme-light`, `theme-dark`, `theme-system`

### Navigation
- Tab bar items for Dashboard, Episodes, Medications, Trends/Analytics
