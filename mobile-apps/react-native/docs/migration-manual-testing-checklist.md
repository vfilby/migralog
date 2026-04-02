# Database Migration Manual Testing Checklist

## Purpose
This checklist ensures database migrations work correctly on real devices before releasing to production. While automated tests verify the SQL logic, manual testing catches platform-specific issues and validates the complete migration flow.

## Testing Environment Setup

### Prerequisites
- [ ] iOS simulator/device with app installed
- [ ] Android emulator/device with app installed (optional, iOS first)
- [ ] Test data fixtures ready (see Test Data section below)
- [ ] Backup of current database state

### Test Data Fixtures
Create test data before migration testing:
- **2 Episodes**: One ongoing, one completed with all fields populated
- **3 Medications**: Include schedules, doses, and relationships
- **5 Medication Doses**: Linked to medications and episodes
- **2 Daily Status Logs**: Different status types
- **Location Data**: At least one episode with GPS coordinates

## Pre-Release Testing Checklist

### 1. Fresh Install (New Users)
**Purpose**: Verify migrations run correctly on fresh install

- [ ] Uninstall app completely
- [ ] Install current version from TestFlight/internal build
- [ ] Launch app for first time
- [ ] Create test episode with all fields
- [ ] Check database schema version: should be latest (v6)
- [ ] Verify all features work:
  - [ ] Create episode with location
  - [ ] Add episode notes
  - [ ] Create medication with schedule
  - [ ] Log medication dose
  - [ ] Record daily status
- [ ] Check Settings > About > Database Version shows: v6

**Expected Result**: All features functional, no migration errors

---

### 2. Upgrade from Previous Version
**Purpose**: Verify migrations preserve existing data during upgrade

#### Step 1: Setup Old Version
- [ ] Install previous app version (v1.x) from App Store/TestFlight
- [ ] Create comprehensive test data:
  ```
  Episodes:
  - Episode 1: Ongoing episode, start_time set
  - Episode 2: Completed episode with end_time

  Medications:
  - Medication 1: "Aspirin" with 2 schedules
  - Medication 2: "Ibuprofen" with 1 schedule
  - Medication 3: "Rizatriptan" no schedule

  Doses:
  - 3 doses for Aspirin (linked to Episode 1)
  - 2 doses for Ibuprofen (not linked to episode)
  ```
- [ ] Note exact counts:
  - Episodes: ___
  - Medications: ___
  - Doses: ___
  - Schedules: ___

#### Step 2: Perform Upgrade
- [ ] Install current version (with migrations)
- [ ] Launch app
- [ ] Observe migration process (should see logs or progress indicator)
- [ ] App completes launch successfully

#### Step 3: Verify Data Preserved
- [ ] All episodes still visible in Episodes list
- [ ] Episode details intact:
  - [ ] Start/end times correct
  - [ ] Pain locations preserved
  - [ ] Symptoms preserved
  - [ ] Notes preserved
- [ ] All medications visible in Medications list
- [ ] Medication details intact:
  - [ ] Names correct
  - [ ] Dosages correct
  - [ ] Schedules preserved
- [ ] All doses visible in history
- [ ] Dose details intact:
  - [ ] Timestamps correct
  - [ ] Amounts correct
  - [ ] Episode links preserved (verify FK relationships)

#### Step 4: Verify New Features Work
- [ ] Can add location to new episode (migration 2)
- [ ] Can add note to episode (migration 3)
- [ ] Medication schedule notifications work (migration 4)
- [ ] Can log daily status (migration 5)
- [ ] Can mark dose as skipped/missed (migration 6)

**Expected Result**:
- All existing data preserved
- All new features functional
- No errors in logs
- Database version: v6

---

### 3. Migration Failure Recovery
**Purpose**: Verify automatic rollback and recovery procedures work

⚠️ **WARNING**: This test requires intentionally corrupting the database. Use test device only.

#### Setup
- [ ] Start with clean v1 database with test data
- [ ] Create automatic backup before test

#### Test Automatic Rollback (Simulated)
Since we can't easily force migration failure in production, verify rollback logic through code review:
- [ ] Code review: Verify `runMigrations()` catches errors
- [ ] Code review: Verify `runSmokeTests()` triggers rollback on failure
- [ ] Code review: Verify backup is created before migration

#### Test Manual Recovery
- [ ] Navigate to Settings > Backup & Recovery
- [ ] Verify automatic backup exists (check timestamp)
- [ ] Tap "Restore from Backup"
- [ ] Select most recent backup
- [ ] Confirm restoration
- [ ] App restarts
- [ ] Verify data restored to pre-migration state
- [ ] Database version should be earlier version

**Expected Result**:
- Automatic backup created before migration
- Manual restore works correctly
- No data loss

---

### 4. Rollback Testing (Developer Only)
**Purpose**: Verify rollback functions work correctly

⚠️ **DEVELOPER ONLY**: Requires dev tools and debug builds

#### Test Rollback Migration 2 (Location Columns)
- [ ] Start with v2 database (location columns exist)
- [ ] Insert episode with location data
- [ ] Use dev tools: `migrationRunner.rollback(1)`
- [ ] Verify schema at v1:
  ```sql
  PRAGMA table_info(episodes); -- Should NOT have latitude/longitude
  ```
- [ ] Verify episode data preserved (without location)
- [ ] Migrate forward: `migrationRunner.runMigrations()`
- [ ] Verify back at v6
- [ ] Verify everything works

#### Test Rollback Migration 3 (Episode Notes)
- [ ] Start with v3 database
- [ ] Create episode note
- [ ] Rollback to v2: `migrationRunner.rollback(2)`
- [ ] Verify `episode_notes` table dropped
- [ ] Verify indexes dropped
- [ ] Migrate forward again
- [ ] Verify everything works

#### Test Rollback Migration 4 (Notification Fields)
- [ ] Start with v4 database
- [ ] Create schedule with notification
- [ ] Rollback to v3: `migrationRunner.rollback(3)`
- [ ] Verify notification_id column removed
- [ ] Verify schedule data preserved
- [ ] Migrate forward again
- [ ] Verify everything works

#### Test Rollback Migration 6 (Status Column)
- [ ] Start with v6 database
- [ ] Create dose with status='skipped'
- [ ] Rollback to v5: `migrationRunner.rollback(5)`
- [ ] Verify status column removed
- [ ] Verify dose data preserved
- [ ] Verify foreign keys intact
- [ ] Migrate forward again
- [ ] Verify everything works

**Expected Result**:
- Each rollback executes without errors
- Data preserved during rollback
- Forward migration works after rollback
- No orphaned indexes or tables

---

### 5. Database Integrity Checks
**Purpose**: Verify foreign key relationships remain valid

- [ ] Delete medication that has doses
  - Expected: Doses deleted (CASCADE)
- [ ] Delete episode that has doses linked
  - Expected: Dose episode_id set to NULL (SET NULL)
- [ ] Delete medication that has schedules
  - Expected: Schedules deleted (CASCADE)
- [ ] Create dose with invalid medication_id
  - Expected: Error (FK constraint enforced)

**Expected Result**: All foreign key constraints enforced correctly

---

### 6. Performance Testing
**Purpose**: Ensure migrations complete in reasonable time

- [ ] Create large dataset:
  - 50 episodes
  - 10 medications
  - 100 doses
  - 30 daily status logs
- [ ] Time fresh install migration: ___ seconds
- [ ] Time upgrade migration: ___ seconds

**Expected Result**:
- Fresh install: < 2 seconds
- Upgrade: < 5 seconds

---

### 7. Platform-Specific Testing

#### iOS Testing
- [ ] Test on iOS 15+ (minimum supported version)
- [ ] Test on iOS 18+ (latest version)
- [ ] Test on iPhone with different storage levels:
  - [ ] Low storage (< 1GB free)
  - [ ] Normal storage (> 5GB free)

#### Android Testing (Optional)
- [ ] Test on Android 12+ (minimum supported version)
- [ ] Test on different manufacturers (Samsung, Google, etc.)

**Expected Result**: Migrations work on all platform versions

---

## Post-Migration Verification

After any migration test, verify:

### Data Integrity
- [ ] All episode counts match pre-migration
- [ ] All medication counts match pre-migration
- [ ] All dose counts match pre-migration
- [ ] All timestamps unchanged
- [ ] All relationships (FK) intact

### Schema Verification
- [ ] Check database version in Settings
- [ ] Verify all expected tables exist:
  ```sql
  SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
  ```
  Expected tables:
  - episodes
  - episode_notes (v3+)
  - intensity_readings
  - symptom_logs
  - medications
  - medication_schedules
  - medication_doses
  - medication_reminders
  - daily_status_logs (v5+)
  - schema_version

- [ ] Verify all expected columns exist (use PRAGMA table_info)

### Functional Testing
- [ ] Create new episode
- [ ] Edit existing episode
- [ ] Delete episode
- [ ] Create medication
- [ ] Log dose
- [ ] View analytics
- [ ] Export data (if feature exists)

---

## Error Scenarios to Test

### Migration Interrupted
- [ ] Force quit app during migration
- [ ] Restart app
- [ ] Verify database in consistent state
- [ ] Verify automatic backup available

### Low Storage
- [ ] Test migration with < 100MB free storage
- [ ] Verify error handling
- [ ] Verify user notified of issue

### Corrupted Database
- [ ] Manually corrupt database file
- [ ] Launch app
- [ ] Verify error handling
- [ ] Verify recovery options presented

---

## Test Results Template

### Test Session Information
- **Date**: ___________
- **Tester**: ___________
- **App Version**: ___________
- **Platform**: iOS / Android
- **Device**: ___________
- **OS Version**: ___________

### Results Summary
- [ ] ✅ Fresh Install
- [ ] ✅ Upgrade from Previous Version
- [ ] ✅ Migration Failure Recovery
- [ ] ✅ Rollback Testing
- [ ] ✅ Database Integrity
- [ ] ✅ Performance
- [ ] ✅ Platform-Specific

### Issues Found
| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| 1       |             | High/Med/Low | Open/Fixed |
| 2       |             | High/Med/Low | Open/Fixed |

### Notes
(Any additional observations or concerns)

---

## Pre-Release Sign-Off

Before releasing any version with database migrations:

- [ ] All automated tests pass (605+ tests)
- [ ] Manual testing checklist completed
- [ ] No high severity issues
- [ ] All medium severity issues documented
- [ ] Backup/restore verified working
- [ ] Migration performance acceptable
- [ ] Developer sign-off: ___________
- [ ] QA sign-off: ___________

---

## Emergency Rollback Plan

If critical issues discovered after release:

1. **Immediate Actions**:
   - Pause app release/rollout
   - Document issue details
   - Assess user impact

2. **Recovery Options**:
   - Option A: Release hotfix with rollback to previous version
   - Option B: Release patch with migration fix
   - Option C: Provide manual recovery instructions to users

3. **User Communication**:
   - Prepare user notification
   - Update app description with workaround
   - Post to support channels

4. **Post-Mortem**:
   - Document root cause
   - Update test checklist to catch similar issues
   - Review migration code quality

---

## Notes for Testers

- **Test on fresh device**: Always test on a clean device state
- **Document everything**: Screenshot any unexpected behavior
- **Preserve test databases**: Keep database files for debugging
- **Test incrementally**: Don't skip migration versions
- **Verify logs**: Check console logs for warnings/errors
- **Test edge cases**: Empty databases, very large databases, corrupt data
- **Time migrations**: Note if any migration takes > 5 seconds

## Automation Future

Future improvements to automate this testing:
- Maestro/Detox E2E tests for upgrade scenarios
- Database seeding scripts for test data
- Automated schema verification
- Performance benchmarking in CI/CD
