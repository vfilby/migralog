# Database Backup & Recovery Strategy

## Overview

MigraLog implements a comprehensive backup strategy to protect user data from loss during database migrations and general usage. This document outlines the backup system architecture, automatic backup policies, and recovery procedures.

## Backup Types

### 1. Pre-Migration Snapshots

**When**: Automatically created before every database migration

**Purpose**: Provides recovery point if migration fails or causes data corruption

**Implementation**:
- Located in: `src/database/db.ts:71-81`
- Called from: `migrationRunner.runMigrations(createBackup)`
- Storage: JSON format in `${FileSystem.documentDirectory}backups/`

**Behavior**:
- Creates full database snapshot including:
  - All episodes with notes and intensity readings
  - All medications with doses and schedules
  - All daily status logs
  - Complete schema SQL (for version-specific restore)
- Marks backup as automatic (`isAutomatic: true`)
- Includes schema version and app version metadata
- Non-blocking: If backup fails, logs warning but continues migration
  - **Note**: This is intentional - backup failure shouldn't prevent critical bug fixes
  - User should be notified to manually create backup before updating

**Example Scenario**:
```
User opens app → Database v1 detected → Migration needed to v6
1. Create automatic backup (schema v1, all data)
2. Run migrations 2→3→4→5→6
3. If migration 4 fails:
   - Database preserved in partial state (v3 applied, v4 failed)
   - Backup available for restore to v1
   - User guided to Settings > Backup & Recovery
```

### 2. Weekly Automatic Backups

**When**: Automatically every 7 days on app startup

**Purpose**: Regular protection against data loss from app bugs, device issues, or accidental deletion

**Implementation**:
- Located in: `src/services/backupService.ts:729-763`
- Called from: `src/database/db.ts:99-107` (on database initialization)
- Tracking: Last backup time stored in AsyncStorage (`@MigraLog:lastWeeklyBackup`)

**Behavior**:
- Checks time since last weekly backup on every app launch
- If ≥7 days since last backup:
  - Creates automatic backup
  - Updates last backup timestamp
  - Triggers cleanup of old backups
- If <7 days: Logs "Next backup in X days", no action
- Non-blocking: Failure doesn't prevent app from starting

**Schedule Logic**:
```typescript
const WEEKLY_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

if (now - lastBackupTime >= WEEKLY_BACKUP_INTERVAL_MS) {
  createBackup(isAutomatic: true);
  updateLastBackupTime(now);
}
```

## Retention Policy

**Policy**: Keep last 7 automatic backups (≈2 months of weekly backups)

**Constant**: `MAX_AUTO_BACKUPS = 7` (src/services/backupService.ts:36)

**Cleanup Trigger**: After each automatic backup creation

**Implementation**: `src/services/backupService.ts:700-720`

**Logic**:
1. List all backups in backup directory
2. Filter to automatic backups (ID starts with `backup_`)
3. If count > MAX_AUTO_BACKUPS:
   - Sort by timestamp (newest first)
   - Delete backups beyond the 7 newest

**Example**:
```
Existing backups: 7 weekly backups (day 0, 7, 14, 21, 28, 35, 42)
Weekly backup triggered on day 49:
  1. Create new backup (day 49)
  2. Total backups: 8
  3. Delete oldest backup (day 0)
  4. Remaining: 7 backups (day 7, 14, 21, 28, 35, 42, 49)
```

**Manual Backups**: Not subject to automatic cleanup (different ID prefix)

## Backup Storage Format

### File Structure
```
${FileSystem.documentDirectory}backups/
├── backup_1729123456789_abc123.json  (automatic)
├── backup_1729234567890_def456.json  (automatic)
├── manual_1729345678901_ghi789.json  (manual - not auto-deleted)
└── ...
```

### Backup File Format (JSON)
```json
{
  "metadata": {
    "id": "backup_1729123456789_abc123",
    "timestamp": 1729123456789,
    "version": "1.0.0",
    "schemaVersion": 6,
    "episodeCount": 150,
    "medicationCount": 5
  },
  "schemaSQL": "CREATE TABLE episodes (...); CREATE TABLE medications (...); ...",
  "episodes": [ /* array of episode objects */ ],
  "episodeNotes": [ /* array of note objects */ ],
  "intensityReadings": [ /* array of reading objects */ ],
  "dailyStatusLogs": [ /* array of status objects */ ],
  "medications": [ /* array of medication objects */ ],
  "medicationDoses": [ /* array of dose objects */ ],
  "medicationSchedules": [ /* array of schedule objects */ ]
}
```

### Key Fields

**schemaSQL**: Complete CREATE TABLE statements from database at time of backup
- Critical for restoring to exact schema version
- Allows restore to v1, then migrate to current version
- Introduced to fix "restore from newer version" issue

**metadata.schemaVersion**: Database schema version at backup time
- Used to determine if migrations needed after restore
- Prevents restoring v6 backup to v1 database (data loss)

## Recovery Procedures

### Scenario 1: Migration Fails

**Symptoms**:
- App shows error: "Migration X failed verification"
- Database may be in partial state

**Recovery Steps**:
1. App automatically preserves database in current state
2. User sees error message with guidance
3. User navigates to Settings > Backup & Recovery
4. User selects most recent automatic backup (created before migration)
5. User taps "Restore from Backup"
6. App restores database to pre-migration state
7. App may need to be updated to fix migration bug before re-attempting

**Technical Details**:
- No automatic rollback attempted (prevents making corruption worse)
- Backup created before migration ensures safe recovery point
- User data preserved in known state

### Scenario 2: Data Lost or Corrupted

**Symptoms**:
- Episodes missing
- Medication history incomplete
- App crashes on data access

**Recovery Steps**:
1. User navigates to Settings > Backup & Recovery
2. User views list of available backups (sorted by date)
3. User selects backup from before data loss occurred
4. User taps "Restore from Backup"
5. App restores all data from selected backup
6. If backup is from older schema version, migrations run automatically

**Data Loss Window**: Maximum 7 days (between weekly backups)

### Scenario 3: Accidental Deletion

**Symptoms**:
- User accidentally deleted episode/medication
- User wants to recover specific data

**Recovery Steps**:
1. Immediate recovery: Restore from most recent backup
2. Historical recovery: Browse backup list, select backup from before deletion
3. Partial recovery: Export backup file, extract specific data, manually re-enter

**Limitation**: Cannot restore individual items, must restore entire database

## Testing Coverage

### Unit Tests (src/services/__tests__/backupService.test.ts)

**Weekly Backup Strategy** (13 tests):
- ✅ Create backup when no previous backup exists
- ✅ Create backup when 7+ days have passed
- ✅ Skip backup when <7 days have passed
- ✅ Handle backup creation failure gracefully
- ✅ Update last backup timestamp correctly
- ✅ Return correct last backup time
- ✅ Calculate days until next backup correctly
- ✅ Trigger cleanup when MAX_AUTO_BACKUPS exceeded

**Backup Creation** (7 tests):
- ✅ Create backup with all data
- ✅ Include schema SQL in backup
- ✅ Clean up old automatic backups
- ✅ Handle creation errors

**Backup Restore** (6 tests):
- ✅ Restore backup with schema migration
- ✅ Restore old backup (legacy format)
- ✅ Reject restore from newer schema version
- ✅ Run migrations after restore
- ✅ Validate backup structure

**Total Coverage**: 46/46 tests passing

### Integration Tests

**Database Initialization** (src/database/db.ts):
- Weekly backup check on app startup
- Pre-migration snapshot creation
- Non-blocking error handling

## API Reference

### BackupService Methods

#### `checkAndCreateWeeklyBackup(db?: SQLite.SQLiteDatabase): Promise<BackupMetadata | null>`

Checks if weekly backup is needed and creates one if 7+ days have passed.

**Returns**: Backup metadata if created, null if not needed or failed

**Usage**:
```typescript
const { backupService } = await import('../services/backupService');
await backupService.checkAndCreateWeeklyBackup(db);
```

#### `getLastWeeklyBackupTime(): Promise<number>`

Returns timestamp of last weekly backup.

**Returns**: Unix timestamp in milliseconds, or 0 if no backup exists

#### `getDaysUntilNextWeeklyBackup(): Promise<number>`

Calculates days remaining until next weekly backup.

**Returns**: Number of days (0 if backup needed now)

#### `createBackup(isAutomatic?: boolean, db?: SQLite.SQLiteDatabase): Promise<BackupMetadata>`

Creates backup immediately.

**Parameters**:
- `isAutomatic`: If true, backup is subject to retention policy cleanup
- `db`: Database instance (optional, used during migrations to avoid circular dependency)

**Returns**: Backup metadata including ID, file size, counts

#### `restoreBackup(backupId: string): Promise<void>`

Restores database from backup file.

**Process**:
1. Validate backup file format
2. Check schema version compatibility
3. Drop all current tables
4. Execute schema SQL from backup
5. Insert all data (preserving IDs)
6. Run migrations if backup is older version

**Throws**: Error if backup invalid or restore fails

## Migration Recovery Architecture

### Critical Safety Features (src/database/migrations.ts)

1. **Transaction-based Rollbacks** (lines 44-125, 157-252, 300-396)
   - All table recreation operations wrapped in BEGIN/COMMIT
   - Automatic ROLLBACK on failure
   - Prevents partial execution (e.g., DROP succeeds but RENAME fails)

2. **Row Count Verification** (lines 87-94, 208-215, 352-359)
   - Verifies backup table contains all rows before DROP
   - Aborts if counts don't match
   - Prevents silent data loss (e.g., 950/1000 rows copied)

3. **No Automatic Rollback on Smoke Test Failure** (lines 655-687)
   - Preserves database in current state
   - Guides user to manual backup restore
   - Prevents automatic rollback from making corruption worse

4. **Pre-Migration Backup Requirement** (lines 613-625)
   - Backup created before any migration starts
   - Migration aborted if backup fails
   - Ensures safe recovery point always exists

## Recommendations

### For Users

1. **Before Major App Updates**: Manually create backup before updating
2. **Important Data Entry**: Create manual backup after recording critical episodes
3. **Regular Monitoring**: Check Settings > Backup & Recovery weekly to verify backups exist
4. **Storage Management**: Export/delete old manual backups to free space

### For Developers

1. **Testing Migrations**: Always test with large datasets (1000+ episodes) before release
2. **Backup Verification**: Verify backup/restore works on target schema version
3. **Error Messages**: Include "restore from backup" guidance in all migration errors
4. **Retention Policy**: Adjust MAX_AUTO_BACKUPS if users report insufficient backup history

### For Production

1. **Monitor Backup Failures**: Log backup creation failures to analytics
2. **Storage Warnings**: Alert user if backup directory approaching storage limits
3. **Backup Integrity**: Periodically verify random backups are restorable
4. **Schema Compatibility**: Test restore from all previous schema versions

## Future Enhancements

### Phase 1: Improved User Experience
- Show backup status on Dashboard
- Notify user when weekly backup created
- Show storage used by backups

### Phase 2: Cloud Sync
- Optional cloud backup (encrypted)
- Multi-device restore
- Automatic backup before cloud sync

### Phase 3: Selective Restore
- Restore individual episodes
- Restore date range
- Merge backup with current data

### Phase 4: Advanced Recovery
- Diff view between backup and current state
- Preview backup contents before restore
- Restore to separate profile (compare before overwriting)

## Troubleshooting

### "No backups available"
- Check Settings > Backup & Recovery
- Create manual backup immediately
- Verify app has storage permissions

### "Backup creation failed"
- Check device storage (need 10-50 MB typically)
- Check app has filesystem permissions
- Try manual backup from Settings

### "Cannot restore backup from newer schema version"
- Update app to latest version
- Restore will work after update
- Do NOT downgrade app version

### "Restore failed - database may be corrupt"
- Try different backup (older or newer)
- Export backup file for data recovery
- Contact support with backup file

## Conclusion

The backup strategy provides multiple layers of protection:
1. **Pre-migration snapshots** prevent data loss during updates
2. **Weekly automatic backups** protect against app/device issues
3. **7-backup retention** balances storage with recovery window
4. **Manual backups** allow user control for critical data

Combined with transaction-safe migrations and row count verification, users have strong protection against data loss in a healthcare app where data is irreplaceable.
