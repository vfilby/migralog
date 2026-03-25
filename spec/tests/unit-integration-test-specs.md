# Unit & Integration Test Specifications

Test specifications for all business logic in MigraineTracker.

> **Coverage target**: 75% line coverage across all business logic modules
>
> **Scope**: Database repositories, state stores, services, utilities, schemas.
> Excludes pure UI rendering (component tests cover that separately).

---

## Coverage Strategy

### What MUST be tested (business logic)

| Layer | Directory | Priority |
|-------|-----------|----------|
| Database repositories | `src/database/` | Critical |
| State stores (Zustand) | `src/store/` | Critical |
| Services | `src/services/` | Critical |
| Utilities | `src/utils/` | High |
| Schemas (Zod validation) | `src/schemas/` | High |
| Hooks with business logic | `src/screens/**/hooks/` | Medium |

### What is OPTIONAL for coverage target

| Layer | Reason |
|-------|--------|
| Screen components (`src/screens/*.tsx`) | Covered by E2E and component tests |
| Shared UI components (`src/components/`) | Visual, covered by component tests |
| Theme/styling (`src/theme/`) | Configuration, no logic |
| Navigation (`src/navigation/`) | Framework glue |

### Mocking strategy

- **Unit tests**: Mock database driver (SQLite), external APIs (Sentry, expo-notifications, expo-location, file system)
- **Integration tests**: Mock database repositories with controlled responses, use real store/service logic
- **Never mock**: Zod schemas, pure utility functions, date calculations

---

## 1. Database Repository Tests

### 1.1 Episode Repository

**Module**: `src/database/episodeRepository.ts`

#### Episode CRUD

| Test | Input | Expected |
|------|-------|----------|
| Create episode with valid data | `{ startTime, location }` | Returns episode with generated ID, timestamps set |
| Create episode with all fields | Full episode object | All fields persisted |
| Get episode by ID (exists) | Valid ID | Returns complete episode |
| Get episode by ID (not found) | Invalid ID | Returns null |
| Get all episodes | — | Returns array sorted by startTime DESC |
| Get episodes by date range | Start/end dates | Only episodes within range returned |
| Get current (active) episode | One active episode | Returns the active episode |
| Get current episode (none active) | All episodes ended | Returns null |
| Update episode fields | Changed endTime, peakIntensity | Fields updated, updatedAt changes |
| Delete episode | Valid ID | Episode removed, returns success |
| Delete all episodes | — | Table emptied |

#### Intensity Reading CRUD

| Test | Input | Expected |
|------|-------|----------|
| Create reading for episode | `{ episodeId, intensity, timestamp }` | Reading created with ID |
| Get readings by episode ID | Episode ID | Returns readings sorted by timestamp |
| Get readings by multiple episode IDs | Array of IDs | Returns grouped readings |
| Update reading intensity | New intensity value | Value updated |
| Update timestamps for episode | Episode ID, time offset | All reading timestamps shifted |

#### Symptom Log CRUD

| Test | Input | Expected |
|------|-------|----------|
| Create symptom log | `{ episodeId, symptoms[], timestamp }` | Log created |
| Get logs by episode ID | Episode ID | Returns all symptom logs |
| Update symptoms list | New symptoms array | Array replaced |
| Delete symptom log | Log ID | Removed |

#### Pain Location Log CRUD

| Test | Input | Expected |
|------|-------|----------|
| Create pain location log | `{ episodeId, locations[], timestamp }` | Log created |
| Get logs by episode ID | Episode ID | Returns all location logs |
| Update locations | New locations array | Array replaced |
| Delete location log | Log ID | Removed |

#### Episode Note CRUD

| Test | Input | Expected |
|------|-------|----------|
| Create note | `{ episodeId, text, timestamp }` | Note created with ID |
| Get notes by episode ID | Episode ID | Returns notes sorted by timestamp |
| Update note text | New text | Text updated |
| Update timestamps for episode | Episode ID, offset | Note timestamps shifted |
| Delete note | Note ID | Removed |

### 1.2 Medication Repository

**Module**: `src/database/medicationRepository.ts`

#### Medication CRUD

| Test | Input | Expected |
|------|-------|----------|
| Create medication | `{ name, dosageAmount, dosageUnit, type }` | Returns medication with ID |
| Create with all optional fields | Including image, notes, category | All fields persisted |
| Get by ID (exists) | Valid ID | Complete medication returned |
| Get by ID (not found) | Invalid ID | Returns null |
| Get all medications | — | Returns all (active + archived) |
| Get active medications | — | Only non-archived returned |
| Get archived medications | — | Only archived returned |
| Update medication fields | Changed name, dosage | Fields updated |
| Archive medication | Medication ID | `isArchived = true` |
| Unarchive medication | Archived medication ID | `isArchived = false` |
| Delete medication | ID | Medication and related data removed |

#### Medication Dose CRUD

| Test | Input | Expected |
|------|-------|----------|
| Create dose | `{ medicationId, amount, timestamp }` | Dose created with ID |
| Create dose with episode link | `{ medicationId, episodeId, ... }` | Episode association stored |
| Get doses by medication ID | Medication ID | Returns doses sorted by timestamp DESC |
| Get doses by episode ID | Episode ID | Returns doses linked to episode |
| Get doses by date range | Start/end dates | Only doses within range |
| Get medication usage counts | Date range | Returns `{ medicationId, count }` per medication |
| Update dose amount | New amount | Amount updated |
| Delete dose | Dose ID | Removed |

#### Medication Schedule CRUD

| Test | Input | Expected |
|------|-------|----------|
| Create schedule | `{ medicationId, type, times[] }` | Schedule created |
| Get schedules by medication ID | Medication ID | Returns schedules |
| Get schedules by multiple IDs | Array of medication IDs | Returns grouped |
| Update schedule | Changed times | Times updated |
| Delete schedule | Schedule ID | Removed |

### 1.3 Daily Status Repository

**Module**: `src/database/dailyStatusRepository.ts`

| Test | Input | Expected |
|------|-------|----------|
| Create daily status | `{ date, status, type?, notes? }` | Status created |
| Get by ID | Status ID | Returns complete status |
| Get by date range | Start/end dates | Returns statuses in range |
| Get month stats | Year, month | Returns `{ date, status }` for each day |
| Update status | New status/type/notes | Fields updated |
| Delete status | Status ID | Removed |
| Create duplicate date | Same date as existing | Rejects or updates (upsert behavior) |

### 1.4 Scheduled Notification Repository

**Module**: `src/database/scheduledNotificationRepository.ts`

| Test | Input | Expected |
|------|-------|----------|
| Create notification mapping | `{ notificationId, entityType, entityId, triggerTime }` | Mapping stored |
| Get by entity | Entity type + ID | Returns all notifications for entity |
| Get all pending | — | Returns notifications with future trigger times |
| Delete by notification ID | Notification ID | Mapping removed |
| Delete by entity | Entity type + ID | All mappings for entity removed |

### 1.5 Database Infrastructure

#### Migrations (`src/database/migrations.ts`)

| Test | Input | Expected |
|------|-------|----------|
| Apply migration to fresh database | Empty DB | All tables created, version set |
| Apply incremental migration | DB at version N | Upgraded to N+1, data preserved |
| Migration idempotency | Run same migration twice | No errors, no data loss |
| Data integrity after migration | Pre-existing data | All data accessible post-migration |

#### Retry Wrapper (`src/database/retryWrapper.ts`)

| Test | Input | Expected |
|------|-------|----------|
| Identify retryable error (SQLITE_BUSY) | Error code 5 | Returns true |
| Identify non-retryable error | Other error codes | Returns false |
| Retry succeeds on 2nd attempt | Transient error then success | Returns result, logged 1 retry |
| Retry exhausts max attempts | Persistent error | Throws after max retries |
| Exponential backoff timing | Multiple retries | Delays increase |

---

## 2. State Store Tests

### 2.1 Episode Store

**Module**: `src/store/episodeStore.ts`

| Test | Action | Expected State |
|------|--------|----------------|
| Load episodes | `loadEpisodes()` | `episodes` populated, `isLoading` false |
| Load episodes (empty) | No episodes in DB | `episodes = []`, `isLoading` false |
| Load episodes (error) | Repository throws | `error` set, `isLoading` false |
| Start episode | `startEpisode({ startTime })` | New episode in `episodes`, `currentEpisode` set |
| Start episode (already active) | Active episode exists | Rejects or handles gracefully |
| End episode | `endEpisode(id, endTime)` | `currentEpisode` cleared, episode updated |
| Reopen episode | `reopenEpisode(id)` | `endTime` cleared, `currentEpisode` set |
| Load episode with details | `loadEpisodeWithDetails(id)` | Returns episode + readings + symptoms + notes + locations |
| Add intensity reading | `addIntensityReading(episodeId, intensity, timestamp)` | Reading added, cache invalidated |
| Update intensity reading | `updateIntensityReading(readingId, newValue)` | Reading updated |
| Delete intensity reading | `deleteIntensityReading(readingId)` | Reading removed |
| Add symptom log | `addSymptomLog(episodeId, symptoms, timestamp)` | Log added |
| Update symptom log | `updateSymptomLog(logId, newSymptoms)` | Symptoms replaced |
| Delete symptom log | `deleteSymptomLog(logId)` | Log removed |
| Add episode note | `addEpisodeNote(episodeId, text, timestamp)` | Note added |
| Update episode note | `updateEpisodeNote(noteId, newText)` | Text updated |
| Delete episode note | `deleteEpisodeNote(noteId)` | Note removed |
| Add pain location log | `addPainLocationLog(episodeId, locations, timestamp)` | Log added |
| Cache invalidation | Any mutation | Relevant cache entries cleared |

### 2.2 Medication Store

**Module**: `src/store/medicationStore.ts`

| Test | Action | Expected State |
|------|--------|----------------|
| Load medications | `loadMedications()` | `medications` populated, split by type |
| Add medication | `addMedication(data)` | Added to list, correct type category |
| Update medication | `updateMedication(id, changes)` | Fields updated in state |
| Delete medication | `deleteMedication(id)` | Removed from list |
| Archive medication | `archiveMedication(id)` | Moved from active to archived |
| Unarchive medication | `unarchiveMedication(id)` | Moved from archived to active |
| Log dose | `logDose(medicationId, amount, timestamp)` | Dose added, recent doses updated |
| Update dose | `updateDose(doseId, changes)` | Dose updated |
| Delete dose | `deleteDose(doseId)` | Dose removed |
| Load schedules | `loadSchedules()` | Schedules populated per medication |
| Add schedule | `addSchedule(medicationId, schedule)` | Schedule added |
| Update schedule | `updateSchedule(scheduleId, changes)` | Schedule updated |
| Delete schedule | `deleteSchedule(scheduleId)` | Schedule removed |
| Load medication with details | `loadMedicationWithDetails(id)` | Returns medication + schedules + recent doses |

### 2.3 Daily Status Store

**Module**: `src/store/dailyStatusStore.ts`

| Test | Action | Expected State |
|------|--------|----------------|
| Load daily statuses | `loadDailyStatuses(dateRange)` | Statuses populated |
| Load month stats | `loadMonthStats(year, month)` | Month data populated |
| Log green day | `logDayStatus(date, 'clear')` | Status saved, calendar updated |
| Log yellow day | `logDayStatus(date, 'not_clear', type)` | Status with type saved |
| Update day status | `updateDayStatus(id, changes)` | Status updated |
| Delete day status | `deleteDayStatus(id)` | Status removed, calendar updated |
| Get episodes for date | `getEpisodesForDate(date)` | Returns episodes overlapping date |
| Check should prompt | `checkShouldPrompt()` | Returns true if yesterday unlogged, false otherwise |

### 2.4 Analytics Store

**Module**: `src/store/analyticsStore.ts`

| Test | Action | Expected State |
|------|--------|----------------|
| Set date range (7 days) | `setDateRange(7)` | Range set, data fetch triggered |
| Set date range (30 days) | `setDateRange(30)` | Range updated, cache checked |
| Fetch analytics data | `fetchAnalyticsData()` | Episodes, intensities loaded for range |
| Cache hit | Same range requested again | No DB query, cached data returned |
| Cache invalidation | `invalidateCache()` | Next fetch goes to DB |
| Refresh data | `refreshData()` | Forces fresh DB query |

### 2.5 Notification Settings Store

**Module**: `src/store/notificationSettingsStore.ts`

| Test | Action | Expected State |
|------|--------|----------------|
| Load settings | `loadSettings()` | Global + per-medication settings loaded |
| Update global settings | `updateGlobalSettings(changes)` | Global prefs updated |
| Update medication settings | `updateMedicationSettings(medId, changes)` | Per-med overrides set |
| Remove medication settings | `removeMedicationSettings(medId)` | Overrides removed, falls back to global |

### 2.6 Onboarding Store

**Module**: `src/store/onboardingStore.ts`

| Test | Action | Expected State |
|------|--------|----------------|
| Check onboarding (not done) | Fresh state | `isComplete = false` |
| Complete onboarding | `completeOnboarding()` | `isComplete = true`, persisted |
| Skip onboarding | `skipOnboarding()` | `isComplete = true` |
| Check after completion | Reload | `isComplete = true` (from storage) |

---

## 3. Service Tests

### 3.1 Notification Service

**Module**: `src/services/notifications/notificationService.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Schedule medication reminders | Medication with daily schedule | Notifications created for each scheduled time |
| Cancel medication reminders | Medication archived | All related notifications cancelled |
| Reschedule after time change | Schedule time updated | Old notifications cancelled, new ones created |
| Handle taken response | User taps "Taken" on notification | Dose logged, follow-up scheduled |
| Handle skipped response | User taps "Skipped" on notification | Dose marked skipped |
| Handle dismissed notification | Notification swiped away | No action taken |
| Schedule daily check-in | Check-in enabled at 8 PM | Recurring notification set |
| Cancel daily check-in | Check-in disabled | Notification cancelled |
| Permission check | No notification permission | Operations gracefully skipped |

### 3.2 Notification Scheduler

**Module**: `src/services/notifications/notificationScheduler.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Schedule atomic notification | Valid trigger time | expo-notifications called, mapping stored in DB |
| Schedule batch notifications | Multiple medications | All notifications created, all mappings stored |
| Cancel atomic notification | Notification ID | expo-notifications cancel called, mapping deleted |
| Dismiss presented notification | Notification ID | Removed from notification center |
| Get presented notifications | Active notifications | Returns list from OS |
| Schedule with past trigger | Time in the past | Notification skipped or handled gracefully |

### 3.3 Notification Handlers

**Module**: `src/services/notifications/medicationNotificationHandlers.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Handle "taken" action | Response with medicationId | `medicationStore.logDose()` called |
| Handle "skipped" action | Response with medicationId | Dose marked as skipped |
| Handle unknown action | Unrecognized action ID | No error, logged |
| Handle expired notification | Old notification response | Gracefully handled |

### 3.4 Notification Suppression

**Module**: `src/services/notifications/medicationNotificationReconciliation.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Suppress duplicate | Same medication + time already notified | Second notification suppressed |
| Allow after dose taken | Dose logged, next scheduled time | Next notification allowed |
| Gap detection | Missed notifications | Gaps identified |

### 3.5 Daily Check-in Service

**Module**: `src/services/notifications/dailyCheckinService.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Schedule check-in | Enabled at 8:00 PM | Notification scheduled for 8 PM daily |
| Update check-in time | Changed to 9:00 PM | Old cancelled, new at 9 PM |
| Disable check-in | User disables | Notification cancelled |
| Check-in already logged | Yesterday logged | No prompt sent |

### 3.6 Backup Service

**Module**: `src/services/backup/BackupServiceImpl.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Create backup | Database has data | Backup file created with all entities |
| Backup includes all entities | Episodes, medications, doses, statuses | All data in backup |
| Restore from valid backup | Valid backup file | All data restored, IDs preserved |
| Restore from corrupted backup | Invalid JSON | Error returned, no data modified |
| Validate backup integrity | Valid backup | Passes validation |
| Validate backup (missing fields) | Incomplete backup | Fails with specific error |
| Export backup to file | Backup data | File written to file system |
| List existing backups | Multiple backups exist | Returns sorted by date DESC |
| Delete backup | Backup ID | File removed |

### 3.7 Backup Utilities

**Module**: `src/services/backup/backupUtils.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Format backup filename | Date input | Returns standardized filename |
| Parse backup metadata | Backup file | Returns date, size, entity counts |
| Validate backup schema version | Supported version | Returns true |
| Validate backup schema version | Unsupported version | Returns false with error |

### 3.8 Location Service

**Module**: `src/services/locationService.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Get current location (permission granted) | GPS available | Returns `{ latitude, longitude, accuracy }` |
| Get current location (no permission) | Permission denied | Returns null, no crash |
| Get current location (timeout) | GPS unresponsive | Returns null after timeout |

### 3.9 Error Logger

**Module**: `src/services/errorLogger.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Log error | Error object | Sentry.captureException called |
| Log error with context | Error + context object | Context attached to Sentry event |
| Log message | String message | Sentry.captureMessage called |
| Log in non-production | Dev environment | Logs to console, not Sentry |

### 3.10 Toast Service

**Module**: `src/services/toastService.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Show success toast | Message string | Toast displayed with success styling |
| Show error toast | Message string | Toast displayed with error styling |
| Show info toast | Message string | Toast displayed with info styling |

---

## 4. Utility Tests

### 4.1 Analytics Utilities

**Module**: `src/utils/analyticsUtils.ts`

| Test | Input | Expected |
|------|-------|----------|
| Get date range for 7 days | `7` | Returns { start: 7 days ago, end: today } |
| Get date range for 30 days | `30` | Returns { start: 30 days ago, end: today } |
| Filter items by date range | Items + range | Only items within range returned |
| Format date to YYYY-MM-DD | Date object | Correct string format |
| Calculate day statistics | Episodes + statuses for month | Correct counts for migraine/clear/not-clear/unknown days |

### 4.2 Date Formatting

**Module**: `src/utils/dateFormatting.ts`

| Test | Input | Expected |
|------|-------|----------|
| To local date string | Date object | Formatted in device locale |
| To local date string with offset | Date + timezone offset | Correct offset applied |
| Local datetime from strings | Date string + time string | Combined Date object |
| Handle timezone boundaries | Midnight edge cases | Correct date (no off-by-one) |

### 4.3 Episode Validation

**Module**: `src/utils/episodeValidation.ts`

| Test | Input | Expected |
|------|-------|----------|
| Valid end time (after start) | End > start | Returns valid |
| Invalid end time (before start) | End < start | Returns error |
| End time equals start time | End == start | Returns error |
| Null end time | No end time | Returns valid (still active) |

### 4.4 Medication Timeline

**Module**: `src/utils/medicationTimeline.ts`

| Test | Input | Expected |
|------|-------|----------|
| Calculate day status (taken) | Dose logged for day | Returns "taken" |
| Calculate day status (skipped) | Dose skipped for day | Returns "skipped" |
| Calculate day status (pending) | No dose, not yet past time | Returns "pending" |
| Calculate day status (missed) | No dose, past scheduled time | Returns "missed" |
| Get last 7 days timeline | Medication with doses | Array of 7 day statuses |
| Get timeline (no schedule) | As-needed medication | Handles gracefully |

### 4.5 Timeline Grouping

**Module**: `src/utils/timelineGrouping.ts`

| Test | Input | Expected |
|------|-------|----------|
| Group events by day | Events across 3 days | 3 groups, each with correct events |
| Group events by timestamp | Events at same time | Grouped together |
| Calculate day stats | Month of events | Correct counts per day |
| Empty events | No events | Empty groups, zero stats |

### 4.6 Timeline Filters

**Module**: `src/utils/timelineFilters.ts`

| Test | Input | Expected |
|------|-------|----------|
| Show medication in timeline (taken) | Taken dose | Returns true |
| Show medication in timeline (skipped) | Skipped dose | Returns true |
| Hide medication in timeline (pending) | Pending dose | Returns false |

### 4.7 Medication Formatting

**Module**: `src/utils/medicationFormatting.ts`

| Test | Input | Expected |
|------|-------|----------|
| Format dosage | `{ amount: 50, unit: "mg" }` | "50mg" |
| Format dosage (tablets) | `{ amount: 2, unit: "tablets" }` | "2 tablets" |
| Format medication display | Full medication object | "Name · Dosage" |

### 4.8 Pain Scale

**Module**: `src/utils/painScale.ts`

| Test | Input | Expected |
|------|-------|----------|
| Get color for intensity 1 | `1` | Green (#2E7D32) |
| Get color for intensity 5 | `5` | Orange (#EF6C00) |
| Get color for intensity 10 | `10` | Purple (#AB47BC) |
| Get label for intensity | Various levels | Appropriate pain level label |
| Boundary values | 0, 10 | Valid colors returned |

### 4.9 General Formatting

**Module**: `src/utils/formatting.ts`

| Test | Input | Expected |
|------|-------|----------|
| Format duration (hours + minutes) | 150 minutes | "2h 30m" |
| Format duration (minutes only) | 45 minutes | "45m" |
| Format duration (ongoing) | No end time | "Xh Ym and ongoing" |

### 4.10 Cache Manager

**Module**: `src/utils/cacheManager.ts`

| Test | Input | Expected |
|------|-------|----------|
| Set and get | Key + value | Value returned |
| Get expired entry | Entry past TTL | Returns null |
| Get non-existent key | Unknown key | Returns null |
| Invalidate specific key | Key | Subsequent get returns null |
| Invalidate by pattern | Pattern string | Matching keys cleared |
| Clear all | — | All entries removed |

### 4.11 Preset Medications

**Module**: `src/utils/presetMedications.ts`

| Test | Input | Expected |
|------|-------|----------|
| Search medications | "topir" | Returns Topiramate and similar |
| Search (no results) | "xyzabc" | Returns empty array |
| Get medication by name | "Sumatriptan" | Returns full medication data |
| Get category name | Category ID | Returns human-readable name |

### 4.12 Color Contrast

**Module**: `src/utils/colorContrast.ts`

| Test | Input | Expected |
|------|-------|----------|
| High contrast pair | Black on white | Ratio ≥ 4.5 (WCAG AA) |
| Low contrast pair | Light gray on white | Ratio < 4.5 |
| Calculate ratio | Two hex colors | Correct contrast ratio |

### 4.13 Logger

**Module**: `src/utils/logger.ts`

| Test | Input | Expected |
|------|-------|----------|
| Log debug message | Message string | Written to debug output |
| Log error | Error object | Written to error output |
| Log with context | Message + context object | Context included |
| Respects log level | Level set to WARN | DEBUG/INFO suppressed |

### 4.14 Sentry Privacy

**Module**: `src/utils/sentryPrivacy.ts`

| Test | Input | Expected |
|------|-------|----------|
| Strip PII from event | Event with user data | PII fields removed |
| Preserve non-PII data | Event with stack trace | Stack trace preserved |
| Handle null/undefined | Missing fields | No crash |

### 4.15 Locale Utils

**Module**: `src/utils/localeUtils.ts`

| Test | Input | Expected |
|------|-------|----------|
| Detect device locale | — | Returns locale string |
| Format date for locale | Date + locale | Correct localized format |

### 4.16 Performance Utils

**Module**: `src/utils/performance.ts`

| Test | Input | Expected |
|------|-------|----------|
| Start measurement | Label | Timer started |
| End measurement | Label | Duration returned |
| Get metrics | — | Returns all recorded metrics |

---

## 5. Schema Validation Tests

### 5.1 Episode Schema

**Module**: `src/schemas/episode.schema.ts`

| Test | Input | Expected |
|------|-------|----------|
| Valid complete episode | All required + optional fields | Passes validation |
| Valid minimal episode | Only required fields | Passes validation |
| Missing required startTime | No startTime | Fails with field error |
| Invalid intensity (> 10) | Intensity 11 | Fails with range error |
| Invalid intensity (< 0) | Intensity -1 | Fails with range error |
| Valid intensity range | Intensity 0–10 | All pass |
| Invalid symptoms array | Non-string in symptoms | Fails with type error |
| Valid date strings | ISO date strings | Passes |
| Invalid date strings | Malformed dates | Fails |

### 5.2 Medication Schema

**Module**: `src/schemas/medication.schema.ts`

| Test | Input | Expected |
|------|-------|----------|
| Valid preventative medication | Type "preventative" + schedule | Passes |
| Valid rescue medication | Type "rescue" + no schedule | Passes |
| Missing name | No name field | Fails |
| Invalid dosage unit | Unknown unit string | Fails |
| Valid dosage units | mg, ml, tablets, capsules, etc. | All pass |
| Invalid medication type | "unknown" | Fails |
| Schedule with daily type | `{ type: "daily", times: ["08:00"] }` | Passes |
| Schedule with invalid time | `{ times: ["25:00"] }` | Fails |

### 5.3 Daily Status Schema

**Module**: `src/schemas/dailyStatus.schema.ts`

| Test | Input | Expected |
|------|-------|----------|
| Valid clear day | `{ date, status: "clear" }` | Passes |
| Valid not-clear day with type | `{ date, status: "not_clear", type: "prodrome" }` | Passes |
| Valid not-clear day without type | `{ date, status: "not_clear" }` | Passes (type optional) |
| Invalid status value | `{ status: "maybe" }` | Fails |
| Valid yellow day types | prodrome, postdrome, migraine_anxiety | All pass |
| Invalid yellow day type | `{ type: "unknown" }` | Fails |
| Missing date | No date field | Fails |

### 5.4 Overlay Schema

**Module**: `src/schemas/overlay.schema.ts`

| Test | Input | Expected |
|------|-------|----------|
| Valid overlay | `{ startDate, endDate, label }` | Passes |
| End before start | `endDate < startDate` | Fails |
| Missing label | No label | Fails |

### 5.5 Common Schema

**Module**: `src/schemas/common.schema.ts`

| Test | Input | Expected |
|------|-------|----------|
| Valid ID format | UUID string | Passes |
| Valid timestamp | ISO 8601 string | Passes |
| Invalid timestamp | Non-date string | Fails |

---

## 6. Integration Tests

### 6.1 Episode Workflow

**Modules**: episodeStore + episodeRepository + related stores

| Test | Scenario | Expected |
|------|----------|----------|
| Start → update → end | Full lifecycle through store | All mutations reach repository, state consistent |
| Start episode creates red day | Episode started | dailyStatusStore reflects red day |
| End episode updates duration | Episode ended | Peak intensity, duration calculated |
| Delete episode clears data | Episode deleted | Related readings, symptoms, notes, locations all deleted |

### 6.2 Medication Workflow

**Modules**: medicationStore + medicationRepository + notificationService

| Test | Scenario | Expected |
|------|----------|----------|
| Add medication with schedule | Create + add schedule | Notifications scheduled |
| Archive medication | Archive | Notifications cancelled, hidden from dashboard |
| Unarchive medication | Unarchive | Notifications rescheduled, visible on dashboard |
| Log dose | Log dose for scheduled medication | Dose recorded, notification dismissed |
| Update schedule | Change time | Old notifications cancelled, new ones scheduled |

### 6.3 Daily Check-in Workflow

**Modules**: dailyStatusStore + dailyCheckinService + notificationService

| Test | Scenario | Expected |
|------|----------|----------|
| Enable daily check-in | Turn on at 8 PM | Notification scheduled |
| Log status suppresses prompt | Yesterday logged | No notification sent |
| Change check-in time | 8 PM → 9 PM | Notification rescheduled |

### 6.4 Backup/Restore Workflow

**Modules**: backupService + all repositories

| Test | Scenario | Expected |
|------|----------|----------|
| Full backup and restore | Create backup, clear DB, restore | All data matches original |
| Backup with large dataset | Many episodes, medications | Completes without error |
| Restore preserves relationships | Restore from backup | Foreign keys intact |

### 6.5 Notification Scheduling Workflow

**Modules**: notificationService + notificationScheduler + medicationStore

| Test | Scenario | Expected |
|------|----------|----------|
| Schedule for 7 days | Daily medication | 7 notifications created |
| Handle taken action | User taps "Taken" | Dose logged, follow-up scheduled |
| Handle skipped action | User taps "Skipped" | Dose marked skipped |
| Reschedule on change | Schedule time changed | All notifications updated |

### 6.6 Settings Workflow

**Modules**: Settings stores + services

| Test | Scenario | Expected |
|------|----------|----------|
| Theme change persists | Switch to dark mode | Theme saved, reloaded on restart |
| Notification toggle | Disable medication reminders | Notifications cancelled |
| Developer mode toggle | Enable developer mode | Developer tools accessible |

### 6.7 Error Handling

**Modules**: All stores + errorLogger

| Test | Scenario | Expected |
|------|----------|----------|
| Repository error during load | DB query fails | Store sets error state, toast shown |
| Repository error during save | DB write fails | Error logged, user notified |
| Network error in location | Location fetch fails | Graceful null return |
| Retry succeeds | Transient DB error | Data saved after retry |
| Retry exhausted | Persistent DB error | Error surfaced to user |

---

## Coverage Gaps to Address

These modules currently lack dedicated test files and should be prioritized:

| Module | Priority | Reason |
|--------|----------|--------|
| `database/overlayRepository.ts` | High | Data persistence for calendar overlays |
| `store/overlayStore.ts` | High | State management for overlays |
| `schemas/overlay.schema.ts` | High | Data validation |
| `schemas/common.schema.ts` | Medium | Shared validation |
| `services/notifications/permissionManager.ts` | Medium | Permission request logic |
| `services/notifications/dailyCheckinNotifications.ts` | Medium | Notification content |
| `services/notifications/notificationUtils.ts` | Low | Helper functions |
| `services/notifications/notificationCategories.ts` | Low | Constants |
| `utils/textScaling.ts` | Low | Accessibility calculation |
| `screens/settings/hooks/*` (6 files) | Low | Debug/dev tools hooks |
