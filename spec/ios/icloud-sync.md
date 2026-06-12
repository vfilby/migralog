# iCloud Sync

MigraLog uses iCloud to sync migraine tracking data across a user's devices. CloudKit serves as a dumb sync pipe — all data interpretation happens client-side.

## Design Principles

1. **No data loss.** Every design decision prioritizes recoverability. Sync should never destroy data that can't be recovered.
2. **Minimal CloudKit schema.** Once promoted to production, CloudKit record types and fields cannot be renamed or deleted. We commit to as little as possible.
3. **Offline-first.** All data lives in the local SQLite database. Sync is opportunistic — the app works fully without connectivity.
4. **Client-side schema.** The local SQLite schema can evolve freely (add tables, rename columns, change types) without ever touching the CloudKit schema.

## Architecture Overview

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Device A   │         │     CloudKit     │         │   Device B   │
│              │  push   │   Private DB     │  pull   │              │
│  SQLite DB   │────────▶│  MigraLogZone    │────────▶│  SQLite DB   │
│              │◀────────│                  │◀────────│              │
│  Sync Engine │  pull   │  SyncRecord(s)   │  push   │  Sync Engine │
└──────────────┘         └──────────────────┘         └──────────────┘
```

- Each local SQLite row becomes one `SyncRecord` in CloudKit.
- All records live in a single custom `CKRecordZone` (`MigraLogZone`) in the user's private database.
- Zone-based sync provides atomic commits and `CKServerChangeToken` for incremental pulls.

## CloudKit Schema

**Container:** `iCloud.com.eff3.migralog`

The CloudKit schema is intentionally minimal. One record type handles all synced data.

> **WARNING:** Once promoted to production, record types and fields are **permanent**. They cannot be renamed, deleted, or have their types changed. Only new fields and new record types can be added.

### SyncRecord

| Field           | CloudKit Type | Required | Description |
|-----------------|---------------|----------|-------------|
| `tableName`     | String        | Yes      | Local SQLite table name (e.g. `episodes`, `medications`) |
| `recordId`      | String        | Yes      | Local UUID primary key |
| `payload`       | String        | Yes      | JSON-serialized row data |
| `schemaVersion` | Int64         | Yes      | SQLite schema version that produced this payload |
| `updatedAt`     | Int64         | Yes      | Unix epoch milliseconds from the local `updated_at` |
| `deleted`       | Int64         | No       | Soft-delete flag: `1` = tombstone |

**Record name strategy:** `CKRecord.recordName` = `{tableName}:{recordId}` — guarantees uniqueness across tables.

### Why opaque payloads?

The alternative (one CKRecord type per SQLite table, fields mirroring columns) would lock us into the current table structure permanently. With opaque payloads:
- Adding a new SQLite table = just a new `tableName` value, no CloudKit schema change.
- Renaming a column = update the JSON serializer, no CloudKit schema change.
- Removing a table = stop writing records with that `tableName`, no CloudKit schema change.

### Formal schema definition

See [`schemas/sync/cloudkit-schema-v1.json`](schemas/sync/cloudkit-schema-v1.json) (JSON Schema).

## Conflict Resolution

**Strategy:** Last-write-wins using the `updatedAt` field.

CloudKit's built-in `modificationDate` reflects upload time, not edit time, so we carry our own timestamp. When the same record is modified on two devices between syncs, the version with the higher `updatedAt` wins.

The losing payload is **never discarded** — see Data Safety below.

**Timestamp ties merge, not pick (#469):** when two versions carry the *same* `updatedAt` but different payloads, that is usually the same logical version seen through different schemas, not a competing edit. If every column both sides hold a value for agrees, the applier performs a non-destructive column merge — remote non-null values fill locally missing/NULL columns, remote NULLs never overwrite, local-only columns are kept — so both devices converge on the column-union. Only a genuine value disagreement falls back to the deterministic payload-byte tiebreak.

## Schema Evolution (#469)

Payloads are column dictionaries and the applier is column-tolerant: incoming columns the local schema doesn't know are dropped (**migrate-on-read**), so a newer device can always sync to an older one. New synced columns MUST be nullable or have a default, or applying an older payload would fail a NOT NULL constraint.

Migrate-on-read leaves a backfill gap: rows pulled *before* a schema upgrade are missing the dropped columns, and the incremental cursor never redelivers them (the source rows haven't changed). To close it, the engine stamps `sync_zone_state.last_synced_schema` with the synced-column manifest (`SyncedSchemaManifest`, canonical JSON of table → synced columns) after each completed pull. When a migration **adds** synced columns or tables, the stored manifest goes stale and the next pull resets the zone change token once, re-pulling the zone; the timestamp-tie merge above backfills the missing columns. Removals don't trigger a re-pull — nothing was dropped on read.

## Data Safety

Data loss prevention has three layers:

### 1. Automatic backup before first sync

Before the first-ever sync on a device (especially when merging two devices' data), the app automatically snapshots the local database using the existing backup infrastructure. This is the nuclear rollback option.

### 2. Conflict archive (90-day retention)

When a conflict is resolved, the losing payload is preserved in the local `sync_conflicts` table alongside the winning payload. The user can view conflicts and restore the losing version — restoring is just writing the payload back to the local table and queuing it for sync (same codepath as any normal edit).

Rows are purged after 90 days to prevent unbounded growth.

### 3. Soft deletes in CloudKit

Deletes are propagated as a `deleted = 1` flag on the `SyncRecord`, not by removing the CKRecord. The full payload remains in CloudKit. This means:
- The delete propagates to other devices via zone change tokens.
- If a delete was accidental, the payload is still recoverable from CloudKit.
- Tombstones can be purged after a retention period.

### Local sync tables

See [`schemas/sqlite/sync-schema-v1.sql`](schemas/sqlite/sync-schema-v1.sql) for the full DDL. Summary:

| Table                  | Purpose |
|------------------------|---------|
| `sync_config`          | User preferences (enabled, wifi-only) — singleton row |
| `sync_zone_state`      | CloudKit `CKServerChangeToken` cursor per zone |
| `sync_pending_changes` | Outbound change queue (survives app restart) |
| `sync_conflicts`       | Losing payloads from conflict resolution (90-day retention) |

## CloudKit Container Setup

### Prerequisites

- Apple Developer Program membership
- Xcode installed
- The MigraLog iOS project

### 1. Enable iCloud capability in Xcode

1. Open the MigraLog project in Xcode.
2. Select the **MigraLog** target.
3. Go to **Signing & Capabilities**.
4. Click **+ Capability** and add **iCloud**.
5. Check **CloudKit** under iCloud services.
6. Under **Containers**, select `iCloud.com.eff3.migralog`. If it doesn't exist, click **+** and create it with that identifier.

This updates the entitlements file and provisioning profile automatically.

### 2. Configure entitlements

The entitlements file (`MigraLog.entitlements`) should contain:

```xml
<key>com.apple.developer.icloud-services</key>
<array>
    <string>CloudKit</string>
</array>
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
    <string>iCloud.com.eff3.migralog</string>
</array>
```

During development, you can optionally set the environment to target production for testing:

```xml
<key>com.apple.developer.icloud-container-environment</key>
<string>Development</string>
```

### 3. Apply the schema to development

The schema is defined in [`schemas/sync/schema.ckdb`](schemas/sync/schema.ckdb) using CloudKit's declarative schema language.

**Option A: Import via `cktool` (recommended)**

```bash
xcrun cktool import-schema \
  --team-id YOUR_TEAM_ID \
  --container-id iCloud.com.eff3.migralog \
  --environment development \
  --file spec/schemas/sync/schema.ckdb
```

**Option B: Create manually in CloudKit Console**

1. Go to [CloudKit Console](https://icloud.developer.apple.com).
2. Select the container `iCloud.com.eff3.migralog`.
3. Select the **Development** environment.
4. Navigate to **Schema** → **Record Types**.
5. Click **Create New Type** and name it `SyncRecord`.
6. Add the following custom fields:

| Field Name      | Field Type |
|-----------------|------------|
| `tableName`     | String     |
| `recordId`      | String     |
| `payload`       | String     |
| `schemaVersion` | Int(64)    |
| `updatedAt`     | Int(64)    |
| `deleted`       | Int(64)    |

7. Click **Save**.
8. Navigate to **Indexes** for the `SyncRecord` type and add:

| Field Name   | Index Type  | Purpose |
|--------------|-------------|---------|
| `recordName` | QUERYABLE   | Required for all record types |
| `tableName`  | QUERYABLE   | Filter by table during selective sync |

9. Click **Save**.

### 4. Verify the schema

Export the schema from the development container and diff against the checked-in file:

```bash
xcrun cktool export-schema \
  --team-id YOUR_TEAM_ID \
  --container-id iCloud.com.eff3.migralog \
  --environment development \
  --output-file /tmp/exported-schema.ckdb

diff spec/schemas/sync/schema.ckdb /tmp/exported-schema.ckdb
```

### 5. Test in development

- Use CloudKit Console's **Records** section to inspect synced data.
- Run the app on a device signed into an iCloud account (simulator has limited CloudKit support).
- Verify records appear in the `MigraLogZone` custom zone under the private database.

### 6. Deploy schema to production

> **This is irreversible.** Triple-check the schema before proceeding. Record types and fields become **permanent** — they cannot be renamed, deleted, or have their types changed.

1. Verify the development schema matches expectations (step 4 above).
2. In CloudKit Console, click **Deploy Schema to Production...**.
3. Review the changes summary — verify only `SyncRecord` with the 6 fields listed above.
4. Confirm deployment.

After deployment:
- The `SyncRecord` type and all 6 fields are **permanent**.
- New fields can be added to `SyncRecord` later. New record types can be added. Nothing existing can be changed or removed.
- All future schema changes must be made in Development first, then deployed to Production.
- Always update `schema.ckdb` in source control to match what's deployed.
