# CloudKit Sync Design — Typed Schema

**Date:** 2026-04-08
**Status:** Draft — pending implementation
**Scope:** CloudKit schema, local schema changes, sync behavior

## Overview

MigraLog syncs migraine tracking data across a user's iOS devices using CloudKit. This design replaces the previously proposed opaque-payload approach with fully typed CKRecord types — one per SQLite table. The local SQLite schema is also restructured to simplify the episode data model.

### Design Principles

1. **No data loss.** Every design decision prioritizes recoverability. Sync should never destroy data that can't be recovered.
2. **Typed CloudKit schema.** One CKRecord type per synced table with typed fields. Enables field-level querying, structured debugging, and potential future field-level merging.
3. **Offline-first.** All data lives in the local SQLite database. Sync is opportunistic — the app works fully without connectivity.
4. **Immutability awareness.** CloudKit record types and fields cannot be renamed or deleted once deployed to production. Fields are chosen conservatively — only what we need today.

### Why Typed Instead of Opaque Payloads

The previous design (`spec/ios/icloud-sync.md`) used a single `SyncRecord` type with a JSON payload field. After evaluation, typed fields were chosen because:

- The local schema is stable (6+ months in production use, v25)
- Typed fields enable server-side querying, structured debugging in CloudKit Console, and potential field-level merge in the future
- The `extras` escape hatch (a String field for future JSON data) can be added to any record type later if needed — CloudKit allows adding fields, just not removing them

## Architecture

```
+--------------+         +------------------+         +--------------+
|   Device A   |         |     CloudKit     |         |   Device B   |
|              |  push   |   Private DB     |  pull   |              |
|  SQLite DB   |--------+|  MigraLogZone    |+--------|  SQLite DB   |
|              |<-------+|                  |+------->|              |
|  Sync Engine |  pull   |  12 Record Types |  push   |  Sync Engine |
+--------------+         +------------------+         +--------------+
```

- Each local SQLite row becomes one CKRecord of the corresponding type.
- All records live in a single custom `CKRecordZone` (`MigraLogZone`) in the user's private database.
- Zone-based sync provides atomic commits and `CKServerChangeToken` for incremental pulls.
- `recordName` = the local UUID `id` for each record (no namespace collision since record types are separate).

**Container:** `iCloud.com.eff3.app.headache-tracker`

## Local Schema Changes

These changes must be applied to the local SQLite schema before CloudKit sync is implemented.

### 1. Slim down the `episodes` table

Remove `locations`, `qualities`, and `symptoms` columns. These are now captured as the first timeline log entries at episode `start_time`.

**Removed columns:**
- `locations` (TEXT, JSON array) — initial locations are now the first `pain_state_logs` entry
- `qualities` (TEXT, JSON array) — initial qualities are now part of the first `pain_state_logs` entry
- `symptoms` (TEXT, JSON array) — initial symptoms are now the first `symptom_logs` entries

**Retained on episode:**
- `triggers` — set once at episode creation, do not evolve over the episode

**Migration:** Existing episodes need their `locations`/`qualities`/`symptoms` arrays converted into first-entry log rows with `timestamp = start_time`. Existing enum raw values (e.g. `"light_sensitivity"`, `"lack_of_sleep"`) become the string values stored in log rows and the `name` field of seeded custom definitions.

### 2. Rename and expand `pain_location_logs` to `pain_state_logs`

Add a `qualities` column (StringList/JSON array of PainQuality strings) alongside the existing `pain_locations` column. This table now captures the full "pain state" snapshot at a point in time.

**New column:**
- `qualities TEXT NOT NULL` — JSON array of pain quality strings (e.g. `["throbbing","pressure"]`)

**Rationale:** Pain quality and location are aspects of the same snapshot ("throbbing at left temple"). The timeline view computes deltas — if only location changed, only location is displayed; if only quality changed, only quality is displayed.

### 3. Add `updated_at` to tables that lack it

For sync (last-write-wins conflict resolution), every synced table needs an `updated_at` timestamp. These tables currently lack one:

- `symptom_logs` — add `updated_at INTEGER NOT NULL CHECK(updated_at > 0)`
- `episode_notes` — add `updated_at INTEGER NOT NULL CHECK(updated_at > 0)`
- `medication_schedules` — add `created_at INTEGER NOT NULL CHECK(created_at > 0)` and `updated_at INTEGER NOT NULL CHECK(updated_at > 0)`

### 4. Split `medication_schedules`

Move device-local notification fields to a new table:

**`medication_schedules`** (synced — schedule definition):
- `id`, `medication_id`, `time`, `timezone`, `dosage`, `enabled`, `created_at`, `updated_at`

**`medication_schedule_notifications`** (device-local — not synced):

```sql
CREATE TABLE IF NOT EXISTS medication_schedule_notifications (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    notification_id TEXT,
    reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK(reminder_enabled IN (0, 1)),
    FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE CASCADE
);
```

### 5. New tables: `custom_symptoms` and `custom_triggers`

User-defined picker lists for symptom and trigger selection.

```sql
CREATE TABLE IF NOT EXISTS custom_symptoms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) > 0 AND length(name) <= 200),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0)
);

CREATE TABLE IF NOT EXISTS custom_triggers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) > 0 AND length(name) <= 200),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0)
);
```

These are picker lists only. Logged data stores the string value directly (e.g. `symptom_logs.symptom = "brain fog"`), not a foreign key. Deleting a custom definition removes it from the picker but does not affect historical logs.

### 6. Seed default custom definitions

On first launch (or migration), seed `custom_symptoms` with the current 9 built-in symptoms and `custom_triggers` with the current 10 built-in triggers. This preserves the current UX while making the lists user-configurable.

### 7. Change `medication_doses` cascade behavior

Current: `FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE`
New: `FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE RESTRICT`

Medications cannot be deleted, only archived (`active = 0`). This FK change enforces that at the database level.

## CloudKit Schema — Record Types

### Common Fields

Every synced record type (except CustomSymptom and CustomTrigger) includes:

| Field | CloudKit Type | Purpose |
|-------|---------------|---------|
| `updatedAt` | Int64 | Local edit timestamp (Unix ms). For last-write-wins conflict resolution. |
| `isDeleted` | Int64 | Soft-delete flag. 0 = active, 1 = tombstone. |

### 1. Episode

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `startTime` | Int64 | No | Unix ms |
| `endTime` | Int64 | Yes | |
| `triggers` | StringList | No | Trigger name strings, set once at creation |
| `notes` | String | Yes | Max 5000 chars |
| `latitude` | Double | Yes | GPS |
| `longitude` | Double | Yes | GPS |
| `locationAccuracy` | Double | Yes | Meters |
| `locationTimestamp` | Int64 | Yes | Unix ms |
| `updatedAt` | Int64 | No | |
| `isDeleted` | Int64 | No | |

QUERYABLE index on `startTime`.

### 2. IntensityReading

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `episodeId` | String | No | References Episode recordName |
| `timestamp` | Int64 | No | Unix ms |
| `intensity` | Double | No | 0-10 scale |
| `updatedAt` | Int64 | No | |
| `isDeleted` | Int64 | No | |

### 3. SymptomLog

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `episodeId` | String | No | References Episode recordName |
| `symptom` | String | No | Symptom name string (user-defined) |
| `onsetTime` | Int64 | No | Unix ms |
| `resolutionTime` | Int64 | Yes | Unix ms |
| `severity` | Double | Yes | 0-10 scale |
| `updatedAt` | Int64 | No | |
| `isDeleted` | Int64 | No | |

### 4. PainStateLog

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `episodeId` | String | No | References Episode recordName |
| `timestamp` | Int64 | No | Unix ms |
| `painLocations` | StringList | No | e.g. ["left_temple","right_eye"] |
| `qualities` | StringList | No | e.g. ["throbbing","pressure"] |
| `updatedAt` | Int64 | No | |
| `isDeleted` | Int64 | No | |

### 5. EpisodeNote

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `episodeId` | String | No | References Episode recordName |
| `timestamp` | Int64 | No | Unix ms |
| `note` | String | No | 1-5000 chars |
| `updatedAt` | Int64 | No | |
| `isDeleted` | Int64 | No | |

### 6. Medication

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `name` | String | No | 1-200 chars |
| `type` | String | No | "preventative", "rescue", "other" |
| `dosageAmount` | Double | No | > 0 |
| `dosageUnit` | String | No | 1-50 chars |
| `defaultQuantity` | Double | Yes | > 0 |
| `scheduleFrequency` | String | Yes | "daily", "monthly", "quarterly" |
| `active` | Int64 | No | 0 or 1 |
| `notes` | String | Yes | Max 5000 chars |
| `category` | String | Yes | "otc", "nsaid", "triptan", etc. |
| `updatedAt` | Int64 | No | |
| `isDeleted` | Int64 | No | |

Note: `photo_uri` is excluded — device-local file path. Photo sync would use CKAsset if needed later.

### 7. MedicationDose

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `medicationId` | String | No | References Medication recordName |
| `timestamp` | Int64 | No | Unix ms |
| `quantity` | Double | No | >= 0 |
| `dosageAmount` | Double | Yes | Snapshot from medication at time of dose |
| `dosageUnit` | String | Yes | Snapshot from medication at time of dose |
| `status` | String | No | "taken" or "skipped" |
| `episodeId` | String | Yes | References Episode recordName (detached on episode delete) |
| `effectivenessRating` | Double | Yes | 0-10 scale |
| `timeToRelief` | Int64 | Yes | Minutes (1-1440) |
| `sideEffects` | StringList | Yes | Free-form strings |
| `notes` | String | Yes | Max 5000 chars |
| `updatedAt` | Int64 | No | |
| `isDeleted` | Int64 | No | |

### 8. MedicationSchedule

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `medicationId` | String | No | References Medication recordName |
| `time` | String | No | "HH:mm" 24-hour format |
| `timezone` | String | No | IANA timezone |
| `dosage` | Double | No | > 0 |
| `enabled` | Int64 | No | 0 or 1 |
| `updatedAt` | Int64 | No | |
| `isDeleted` | Int64 | No | |

Note: `notification_id` and `reminder_enabled` are in a device-local table, not synced.

### 9. DailyStatusLog

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `date` | String | No | "YYYY-MM-DD" |
| `status` | String | No | "green", "yellow", "red" |
| `statusType` | String | Yes | "prodrome", "postdrome", "anxiety", "other" |
| `notes` | String | Yes | Max 5000 chars |
| `prompted` | Int64 | No | 0 or 1 |
| `updatedAt` | Int64 | No | |
| `isDeleted` | Int64 | No | |

QUERYABLE index on `date`.

### 10. CalendarOverlay

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `startDate` | String | No | "YYYY-MM-DD" |
| `endDate` | String | Yes | "YYYY-MM-DD", null = ongoing |
| `label` | String | No | 1-200 chars |
| `notes` | String | Yes | Max 5000 chars |
| `excludeFromStats` | Int64 | No | 0 or 1 |
| `updatedAt` | Int64 | No | |
| `isDeleted` | Int64 | No | |

### 11. CustomSymptom

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `name` | String | No | 1-200 chars |
| `displayOrder` | Int64 | No | Sort order in picker |
| `updatedAt` | Int64 | No | |

No `isDeleted` — actual CKRecord deletion. These are picker definitions only; deleting one has no impact on historical logged data.

### 12. CustomTrigger

| Field | CloudKit Type | Nullable | Notes |
|-------|---------------|----------|-------|
| `name` | String | No | 1-200 chars |
| `displayOrder` | Int64 | No | Sort order in picker |
| `updatedAt` | Int64 | No | |

No `isDeleted` — same rationale as CustomSymptom.

## Deletion Rules

| Record | Can Delete? | Cascade Behavior |
|--------|-------------|-----------------|
| Episode | Yes (soft delete) | Cascades soft-delete to: IntensityReading, SymptomLog, PainStateLog, EpisodeNote. Detaches MedicationDose (sets episodeId = null). |
| Medication | **No.** Archive only (`active = 0`). Must remain as parent reference for dose history. |
| MedicationDose | Yes (soft delete). Explicit only — never cascaded from episode or medication. |
| MedicationSchedule | Yes (soft delete). Explicit only. |
| DailyStatusLog | Yes (soft delete). |
| CalendarOverlay | Yes (soft delete). |
| CustomSymptom | Yes (hard delete). Picker-only; no data references. |
| CustomTrigger | Yes (hard delete). Picker-only; no data references. |
| IntensityReading | Cascaded from Episode only. |
| SymptomLog | Cascaded from Episode only. |
| PainStateLog | Cascaded from Episode only. |
| EpisodeNote | Cascaded from Episode only. |

### Cascade Soft-Delete Across Devices

When Device B receives a soft-deleted Episode:
1. Set `isDeleted = 1` on the Episode locally.
2. Set `isDeleted = 1` on all child records (IntensityReading, SymptomLog, PainStateLog, EpisodeNote) locally.
3. Set `episodeId = null` on any MedicationDose referencing this episode.
4. Queue the child soft-deletes and dose detachments for sync to CloudKit.

## Conflict Resolution

**Strategy:** Last-write-wins per record using the `updatedAt` field.

When pushing a record to CloudKit and a conflict is detected (server version differs):
1. Compare `updatedAt` on both versions — higher timestamp wins.
2. The losing record's full data is saved to the local `sync_conflicts` table with both winning and losing payloads.
3. Conflicts are retained for 90 days, then purged.
4. A user can view conflicts and restore the losing version — restoring writes the data back to the local table and queues it for sync.

**Future enhancement:** Typed fields enable field-level merging (merge non-conflicting field changes). This is not in scope for v1 but the schema supports it.

## Sync Behavior

### What Syncs

| Table | Syncs | CloudKit Record Type |
|-------|-------|---------------------|
| episodes | Yes | Episode |
| intensity_readings | Yes | IntensityReading |
| symptom_logs | Yes | SymptomLog |
| pain_state_logs | Yes | PainStateLog |
| episode_notes | Yes | EpisodeNote |
| medications | Yes | Medication |
| medication_doses | Yes | MedicationDose |
| medication_schedules | Yes | MedicationSchedule |
| daily_status_logs | Yes | DailyStatusLog |
| calendar_overlays | Yes | CalendarOverlay |
| custom_symptoms | Yes | CustomSymptom |
| custom_triggers | Yes | CustomTrigger |
| medication_reminders | No | Device-local notification state |
| scheduled_notifications | No | Device-local notification state |
| medication_schedule_notifications | No | Device-local (split from medication_schedules) |
| sync_config | No | Local sync preferences |
| sync_zone_state | No | Local sync cursor |
| sync_pending_changes | No | Local outbound queue |
| sync_conflicts | No | Local conflict archive |

### Parent-Child Ordering

If a child record (e.g. IntensityReading) arrives via sync before its parent Episode:
1. The child is saved to a local holding queue.
2. After processing all changes in the current batch, retry queued children.
3. If the parent still hasn't arrived, keep in queue for next sync cycle.

This should be rare — parents are typically created and synced before children.

### Data Safety

Three layers of data loss prevention (unchanged from original spec):

1. **Automatic backup before first sync** — snapshot local database before first-ever sync on a device.
2. **Conflict archive (90-day retention)** — losing side of every conflict preserved in `sync_conflicts`.
3. **Soft deletes in CloudKit** — tombstones persist so deletions propagate reliably. Full data remains recoverable.

## CloudKit Container Setup

**Container:** `iCloud.com.eff3.app.headache-tracker`

### Prerequisites

- Apple Developer Program membership
- Xcode installed
- CloudKit capability enabled in Xcode project (Signing & Capabilities)
- Container created or selected in Xcode

### Entitlements

```xml
<key>com.apple.developer.icloud-services</key>
<array>
    <string>CloudKit</string>
</array>
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
    <string>iCloud.com.eff3.app.headache-tracker</string>
</array>
```

### Schema Deployment

1. Create all 12 record types in the Development environment (CloudKit Console or `cktool`).
2. Add fields as specified above.
3. Add QUERYABLE indexes on `recordName` (all types), `startTime` (Episode), `date` (DailyStatusLog).
4. Test thoroughly in Development.
5. Deploy to Production only when confident — **this is irreversible**.

## Migration Plan (High Level)

The following must happen in order:

1. **Local schema migration** (SQLite v26):
   - Create `pain_state_logs` table (rename + add `qualities` column)
   - Create `custom_symptoms` and `custom_triggers` tables with seeded defaults
   - Create `medication_schedule_notifications` table
   - Add `updated_at` to `symptom_logs` and `episode_notes`
   - Migrate existing episode `locations`/`qualities`/`symptoms` to first log entries
   - Move notification fields from `medication_schedules` to `medication_schedule_notifications`
   - Remove `locations`, `qualities`, `symptoms` columns from `episodes`
   - Change `medication_doses` FK from CASCADE to RESTRICT for `medication_id`
   - Update all repositories, view models, and views for the new schema

2. **CloudKit setup** (requires Xcode + Apple Developer account):
   - Enable CloudKit capability in Xcode
   - Create container and record types in Development environment
   - Implement sync engine
   - Test sync between devices

3. **React Native parity** (optional):
   - Apply same local schema changes to React Native app for data export compatibility

## Supersedes

This design supersedes `spec/ios/icloud-sync.md` (opaque payload approach). The local sync state tables from `spec/schemas/sqlite/sync-schema-v1.sql` remain valid and unchanged.
