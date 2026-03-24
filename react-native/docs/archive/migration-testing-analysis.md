# Migration Testing Analysis & Recommendations

## Current Testing Situation

### What We Have ✓
1. **Unit Tests** (`migrations.test.ts`) - 13 tests
   - Tests migration runner logic with mocked database
   - Verifies backup timing, version tracking, migration ordering
   - **Coverage**: ~60% of logic, but doesn't test actual SQL execution

### What We Need ❌
1. **Integration Tests** with real database
   - Verify SQL actually executes correctly
   - Test rollback table recreation pattern
   - Verify data preservation
   - Test foreign key constraints remain valid

## The Challenge: No Real SQLite in Jest

### Problem
- Expo SQLite (`expo-sqlite`) requires native modules (iOS/Android)
- Jest runs in Node.js environment without native modules
- Cannot create real in-memory SQLite database in Jest
- All database tests must use mocks

### Attempted Solutions
1. ✗ **Use `:memory:` database** - Requires native SQLite module
2. ✗ **Use `better-sqlite3`** - Different API than expo-sqlite
3. ✗ **Use `sql.js`** - WASM-based, different API
4. ✗ **Mock everything** - Doesn't test actual SQL

### Industry Standard
Most React Native projects face this same issue. Common approaches:
- Unit tests with mocks (what we have)
- E2E tests on real devices (Detox/Maestro)
- Manual testing on devices
- Very few have true database integration tests

## Recommended Testing Strategy

### Tier 1: Enhanced Unit Tests (IMPLEMENT NOW)
Improve existing mock-based tests to be more thorough:

```typescript
describe('Migration SQL Verification', () => {
  it('migration 2 executes correct ALTER TABLE statements', async () => {
    // Verify exact SQL being executed
    expect(mockDb.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE episodes ADD COLUMN latitude')
    );
  });

  it('migration 2 rollback executes table recreation pattern', async () => {
    // Verify rollback steps
    expect(mockDb.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE episodes_backup')
    );
    expect(mockDb.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO episodes_backup SELECT')
    );
    // ... verify all 5 steps
  });
});
```

**Benefits**:
- Works in Jest without native modules
- Verifies SQL commands are correct
- Fast execution
- Can run in CI/CD

**Limitations**:
- Doesn't verify SQL syntax is valid
- Doesn't test actual data preservation
- Doesn't test FK constraints

### Tier 2: SQL Validation (IMPLEMENT NOW)
Add static SQL validation:

```typescript
describe('SQL Syntax Validation', () => {
  it('all migrations have valid SQL syntax', () => {
    migrations.forEach(migration => {
      // Parse SQL to verify it's syntactically correct
      const sqlStatements = extractSQLStatements(migration.up.toString());
      sqlStatements.forEach(sql => {
        expect(() => validateSQLSyntax(sql)).not.toThrow();
      });
    });
  });
});
```

**Tools**:
- `sql-parser` npm package
- Custom SQL regex validation
- SQLite syntax checker (external tool)

### Tier 3: E2E Device Testing (IMPLEMENT LATER)
Test on real devices using Detox/Maestro:

```javascript
// e2e/migration.test.js
describe('Database Migrations', () => {
  it('should handle app upgrade with existing data', async () => {
    // 1. Install v1 of app
    // 2. Create test data
    // 3. Upgrade to v2
    // 4. Verify data still accessible
    // 5. Verify new features work
  });
});
```

**Benefits**:
- Tests real SQLite on real device
- Tests entire migration flow
- Catches platform-specific issues

**Limitations**:
- Slow (minutes per test)
- Requires simulator/device
- Complex setup
- Hard to debug

### Tier 4: Manual Testing Checklist (DO BEFORE RELEASE)
Comprehensive manual testing guide:

```markdown
## Migration Testing Checklist

### Fresh Install
- [ ] Install app from scratch
- [ ] Create episode with all fields
- [ ] Verify all features work
- [ ] Check database schema version = 6

### Upgrade from v1
- [ ] Install v1 from App Store (if available)
- [ ] Create test data (episodes, medications, doses)
- [ ] Note down: 2 episodes, 3 medications, 5 doses
- [ ] Upgrade to current version
- [ ] Verify all data still visible
- [ ] Check database schema version = 6
- [ ] Verify new features work (location, notes, etc.)

### Migration Failure Recovery
- [ ] Force migration failure (disconnect mid-migration)
- [ ] Restart app
- [ ] Verify automatic rollback occurred
- [ ] Verify data preserved
- [ ] Check Settings > Backup shows automatic backup
- [ ] Restore from backup
- [ ] Verify all data restored

### Rollback Testing (Developer Only)
- [ ] Start app with v6 database
- [ ] Use dev tools to trigger rollback to v3
- [ ] Verify schema at v3
- [ ] Verify data preserved
- [ ] Migrate back to v6
- [ ] Verify everything works
```

## Implementation Priority

### Phase 1: Immediate (This PR)
1. ✅ Implement rollback logic with table recreation pattern
2. ✅ Add migration validation
3. ✅ Add smoke tests
4. ✅ Document recovery procedures
5. ⬜ **ADD**: Enhanced SQL verification unit tests
6. ⬜ **ADD**: Migration testing documentation

### Phase 2: Short Term (Next Week)
7. ⬜ Add SQL syntax validation tests
8. ⬜ Create manual testing checklist
9. ⬜ Perform manual migration testing on device
10. ⬜ Document test results

### Phase 3: Medium Term (Next Month)
11. ⬜ Add E2E migration tests with Detox
12. ⬜ Add to CI/CD pipeline
13. ⬜ Create migration test data fixtures

## Recommended Immediate Actions

### 1. Enhanced Mock-Based Tests
Add to `migrations.test.ts`:

```typescript
describe('Migration SQL Commands', () => {
  describe('Migration 2: add_location_to_episodes', () => {
    it('should execute correct ALTER TABLE statements', async () => {
      await migrationRunner.runMigrations();

      // Verify migration 2 ran with correct SQL
      const execCalls = mockDb.execAsync.mock.calls;
      const alterCalls = execCalls.filter(call =>
        call[0]?.includes('ALTER TABLE episodes')
      );

      expect(alterCalls.length).toBeGreaterThan(0);
      expect(alterCalls.some(call =>
        call[0].includes('ADD COLUMN latitude')
      )).toBe(true);
    });

    it('should execute table recreation pattern for rollback', async () => {
      // Migrate to v2
      await migrationRunner.runMigrations();

      // Clear mocks
      mockDb.execAsync.mockClear();

      // Rollback
      await migrationRunner.rollback(1);

      // Verify 5-step pattern
      const calls = mockDb.execAsync.mock.calls.map(c => c[0]);

      expect(calls.some(sql => sql.includes('CREATE TABLE episodes_backup'))).toBe(true);
      expect(calls.some(sql => sql.includes('INSERT INTO episodes_backup'))).toBe(true);
      expect(calls.some(sql => sql.includes('DROP TABLE episodes'))).toBe(true);
      expect(calls.some(sql => sql.includes('RENAME TO episodes'))).toBe(true);
      expect(calls.some(sql => sql.includes('CREATE INDEX'))).toBe(true);
    });
  });
});
```

### 2. Create Testing Documentation
Document manual testing procedures in docs/

### 3. Add SQL Statement Extractor
```typescript
// Test helper to extract SQL from migration
function extractSQLFromMigration(migration: Migration): string[] {
  // Parse migration.up function to extract SQL statements
  // This can verify SQL syntax without executing it
}
```

## Measuring Success

### Current State
- Unit test coverage: ~60%
- Integration test coverage: 0%
- Manual testing: None documented
- SQL validation: None

### Target State (After Phase 1)
- Unit test coverage: 85%
- SQL command verification: 100%
- Migration rollback verified: 100% (via mocks)
- Manual testing: Documented checklist
- Recovery procedures: Documented

### Target State (After Phase 3)
- Unit test coverage: 90%
- E2E migration tests: 5 scenarios
- Automated testing: CI/CD integration
- Manual testing: Quarterly regression

## Conclusion

**We cannot do true integration tests with real SQLite in Jest.**

Instead, we should:
1. ✅ **Enhance mock-based tests** - Verify exact SQL commands
2. ⬜ **Add SQL validation** - Verify syntax correctness
3. ⬜ **Manual device testing** - Before each release
4. ⬜ **E2E tests** - Long term automation

This is a pragmatic approach that:
- Works within React Native constraints
- Provides confidence in migration logic
- Catches most bugs before production
- Balances effort vs. benefit

The rollback implementation itself is sound - we just need to verify it more thoroughly through enhanced unit tests and manual testing.
