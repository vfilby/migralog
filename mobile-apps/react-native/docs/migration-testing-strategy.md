# Database Migration Testing Strategy

## Current State Analysis

### Existing Tests (Unit Tests with Mocks)
**File**: `src/database/__tests__/migrations.test.ts`

**Coverage**:
- ✅ Initialization
- ✅ Backup before migration (mocked)
- ✅ Version tracking
- ✅ Migration ordering

**Gaps**:
- ❌ No actual SQL execution
- ❌ No real database state verification
- ❌ No rollback testing
- ❌ No failure scenario testing
- ❌ No data preservation testing
- ❌ No smoke test verification (skipped in test env)

## Comprehensive Testing Strategy

### Test Pyramid

```
                    E2E Tests (1-2)
                  /               \
         Integration Tests (15-20)
        /                          \
    Unit Tests (13 existing)
```

### 1. Unit Tests (Existing - 13 tests)
**Purpose**: Test individual functions in isolation
**Technology**: Jest with mocks
**Scope**: Already implemented

### 2. Integration Tests (NEW - Need to Add)
**Purpose**: Test actual database operations with real SQLite
**Technology**: Jest with real expo-sqlite database
**Scope**:

#### A. Migration Forward Tests (6 tests)
- Test each migration 2, 3, 4, 5, 6 individually
- Verify SQL executes successfully
- Verify schema changes applied correctly
- Verify data preserved during column additions

#### B. Migration Rollback Tests (5 tests)
- Test rollback for migration 2 (table recreation)
- Test rollback for migration 3 (DROP TABLE)
- Test rollback for migration 4 (table recreation)
- Test rollback for migration 5 (DROP TABLE)
- Test rollback for migration 6 (table recreation)
- Verify data preservation during rollback

#### C. Failure Scenario Tests (8 tests)
1. **Migration fails mid-execution** → should rollback
2. **Smoke test fails** → should trigger automatic rollback
3. **Backup fails** → should abort before migration
4. **Database locked** → should handle gracefully
5. **Invalid migration SQL** → should rollback
6. **Partial migration** → should rollback to consistent state
7. **Version mismatch** → should detect and handle
8. **Foreign key constraint violation** → should rollback

#### D. Data Integrity Tests (6 tests)
1. **Migrate with existing episodes** → data preserved
2. **Migrate with existing medications** → data preserved
3. **Migrate with relationships (doses → medications)** → FK preserved
4. **Rollback with data** → data preserved
5. **Multiple forward migrations** → cumulative data preserved
6. **Forward then rollback** → data state restored

#### E. Smoke Test Integration (3 tests)
1. **Smoke tests run in production mode** → verify table checks
2. **Smoke tests detect missing columns** → trigger rollback
3. **Smoke tests detect missing tables** → trigger rollback

### 3. E2E Tests (Optional - 1-2 tests)
**Purpose**: Test full app migration flow
**Technology**: Detox or manual testing
**Scope**:
- Fresh install → migrations run → app functional
- App upgrade simulation → migrations run → data preserved

## Implementation Plan

### Phase 1: Integration Test Infrastructure
**File**: `src/database/__tests__/migrations.integration.test.ts`

Setup:
```typescript
import * as SQLite from 'expo-sqlite';
import { migrationRunner } from '../migrations';

describe('Migration Integration Tests', () => {
  let db: SQLite.SQLiteDatabase;

  beforeEach(async () => {
    // Create real in-memory SQLite database
    db = await SQLite.openDatabaseAsync(':memory:');

    // Create initial schema (version 1)
    await setupVersion1Schema(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });
});
```

### Phase 2: Migration Forward Tests
Test each migration individually:
```typescript
describe('Migration 2: add_location_to_episodes', () => {
  it('should add location columns to episodes table', async () => {
    // Setup: Create v1 schema with sample data
    await db.execAsync(CREATE_V1_SCHEMA);
    await db.runAsync('INSERT INTO episodes ...');

    // Execute: Run migration
    await migrationRunner.initialize(db);
    await migrationRunner.runMigrations();

    // Verify: Check columns exist
    const columns = await db.getAllAsync("PRAGMA table_info(episodes)");
    expect(columns.find(c => c.name === 'latitude')).toBeDefined();
    expect(columns.find(c => c.name === 'longitude')).toBeDefined();

    // Verify: Data preserved
    const episodes = await db.getAllAsync('SELECT * FROM episodes');
    expect(episodes).toHaveLength(1);
  });
});
```

### Phase 3: Rollback Tests
Test rollback actually works:
```typescript
describe('Migration Rollback', () => {
  it('should rollback migration 2 and remove location columns', async () => {
    // Setup: Migrate to v2
    await setupVersion1Schema(db);
    await migrationRunner.initialize(db);
    await migrationRunner.runMigrations();

    // Insert data with location
    await db.runAsync(`
      INSERT INTO episodes (id, ..., latitude, longitude)
      VALUES (?, ..., ?, ?)
    `, ['ep1', ..., 40.7, -74.0]);

    // Execute: Rollback to v1
    await migrationRunner.rollback(1);

    // Verify: Location columns removed
    const columns = await db.getAllAsync("PRAGMA table_info(episodes)");
    expect(columns.find(c => c.name === 'latitude')).toBeUndefined();

    // Verify: Episode data preserved (without location)
    const episodes = await db.getAllAsync('SELECT * FROM episodes');
    expect(episodes).toHaveLength(1);
    expect(episodes[0].id).toBe('ep1');
  });
});
```

### Phase 4: Failure Scenario Tests
Test error handling:
```typescript
describe('Migration Failure Scenarios', () => {
  it('should rollback if smoke tests fail', async () => {
    // Setup: Mock migration that passes but creates bad state
    const badMigration = {
      version: 7,
      name: 'bad_migration',
      up: async (db) => {
        // Creates table but wrong schema
        await db.execAsync('CREATE TABLE bad_table (id TEXT)');
      },
      down: async (db) => {
        await db.execAsync('DROP TABLE bad_table');
      }
    };

    // Inject bad migration temporarily
    migrations.push(badMigration);

    // Execute: Should detect failure and rollback
    await expect(migrationRunner.runMigrations()).rejects.toThrow();

    // Verify: Database state rolled back
    const tables = await db.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    expect(tables.find(t => t.name === 'bad_table')).toBeUndefined();

    // Cleanup
    migrations.pop();
  });
});
```

### Phase 5: Data Integrity Tests
Test complex scenarios:
```typescript
describe('Data Integrity', () => {
  it('should preserve foreign key relationships during migration', async () => {
    // Setup: Create medication and dose with FK
    await setupVersion1Schema(db);
    await db.runAsync('INSERT INTO medications (id, name, ...) VALUES (?, ?, ...)',
      ['med1', 'Aspirin', ...]);
    await db.runAsync('INSERT INTO medication_doses (id, medication_id, ...) VALUES (?, ?, ...)',
      ['dose1', 'med1', ...]);

    // Execute: Migrate through all versions
    await migrationRunner.initialize(db);
    await migrationRunner.runMigrations();

    // Verify: FK still valid
    const doses = await db.getAllAsync(
      'SELECT * FROM medication_doses WHERE medication_id = ?',
      ['med1']
    );
    expect(doses).toHaveLength(1);

    // Verify: Cascade delete still works
    await db.runAsync('DELETE FROM medications WHERE id = ?', ['med1']);
    const dosesAfter = await db.getAllAsync('SELECT * FROM medication_doses');
    expect(dosesAfter).toHaveLength(0);
  });
});
```

## Test Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Migration Execution | 100% | ~60% (mocked) |
| Rollback Logic | 100% | 0% |
| Error Handling | 90% | 30% |
| Data Preservation | 95% | 0% |
| Smoke Tests | 100% | 0% (skipped) |

## Test Execution Strategy

### Local Development
```bash
# Run all migration tests
npm test -- migrations

# Run integration tests only
npm test -- migrations.integration

# Run with coverage
npm test -- migrations --coverage
```

### CI/CD
- Run unit tests on every commit
- Run integration tests on every PR
- Require 90%+ coverage for migrations.ts

## Risk Assessment

### High Risk Areas (Need Integration Tests)
1. ⚠️ **Table recreation in rollback** - Complex SQL, data loss risk
2. ⚠️ **Foreign key preservation** - Data integrity risk
3. ⚠️ **Smoke test accuracy** - False positives/negatives
4. ⚠️ **Concurrent migrations** - Race conditions

### Medium Risk Areas (Need Some Integration Tests)
5. ⚠️ **Backup timing** - Backup created too late
6. ⚠️ **Version tracking** - Version not updated correctly
7. ⚠️ **Error messages** - User doesn't know how to recover

### Low Risk Areas (Unit Tests Sufficient)
8. ✓ **Initialization** - Simple logic
9. ✓ **Version comparison** - Pure function

## Success Criteria

Migration testing is complete when:
- [ ] All migrations have integration tests
- [ ] All rollbacks tested with real database
- [ ] 90%+ code coverage on migrations.ts
- [ ] At least 5 failure scenarios tested
- [ ] Data integrity verified across migrations
- [ ] Smoke tests verified in non-test mode
- [ ] Documentation updated with test examples
- [ ] CI/CD runs integration tests automatically

## Next Steps

1. **Create integration test file** - `migrations.integration.test.ts`
2. **Add test utilities** - Schema creation helpers
3. **Implement Phase 2** - Migration forward tests (6 tests)
4. **Implement Phase 3** - Rollback tests (5 tests)
5. **Implement Phase 4** - Failure scenarios (8 tests)
6. **Implement Phase 5** - Data integrity (6 tests)
7. **Add smoke test verification** - (3 tests)
8. **Update CI/CD** - Run integration tests
9. **Document** - Add examples to README

Total: **28 new integration tests** needed for comprehensive coverage.
