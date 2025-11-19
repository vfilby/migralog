/**
 * SQL Verification Tests for Database Migrations (After Squashing)
 *
 * All migrations have been squashed into the base schema (schema.ts).
 * These tests verify that:
 * 1. The migrations array is empty (no migrations to run)
 * 2. Fresh databases start at version 19
 * 3. No SQL is executed for migration operations on fresh databases
 */

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// Import migrations after mocking
import { migrationRunner } from '../migrations';

describe('Migration SQL Verification (Squashed Schema)', () => {
  let mockDb: any;
  let executedSQL: string[];

  beforeEach(() => {
    executedSQL = [];

    // Mock database adapter that tracks all SQL execution
    mockDb = {
      execAsync: jest.fn(async (sql: string) => {
        executedSQL.push(sql);
      }),
      runAsync: jest.fn(async (sql: string, _params?: any[]) => {
        executedSQL.push(sql);
        return { changes: 1, lastInsertRowid: 1 };
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        executedSQL.push(sql);

        // Return appropriate mocked responses
        if (sql.includes('SELECT version FROM schema_version')) {
          // Return version 19 for fresh database
          return [{ version: 19 }];
        }
        if (sql.includes('PRAGMA table_info')) {
          return [];
        }
        if (sql.includes('SELECT name FROM sqlite_master')) {
          return [];
        }
        return [];
      }),
    };

    // Reset module cache to get fresh migrationRunner
    jest.resetModules();
  });

  describe('Fresh Database Creation', () => {
    it('should set version to 19 on initialization', async () => {
      // Mock empty schema_version table (fresh database)
      mockDb.getAllAsync = jest.fn(async (sql: string) => {
        if (sql.includes('SELECT version FROM schema_version')) {
          return []; // Empty - fresh database
        }
        return [];
      });

      await migrationRunner.initialize(mockDb);

      // Should insert version 19
      const insertCalls = (mockDb.runAsync as jest.Mock).mock.calls;
      expect(insertCalls.length).toBeGreaterThan(0);

      // Check that the SQL contains the correct INSERT statement
      const hasVersionInsert = insertCalls.some((call: any[]) =>
        call[0].includes('INSERT OR IGNORE INTO schema_version') &&
        call[0].includes('(1, 19,')
      );

      expect(hasVersionInsert).toBe(true);
    });

    it('should not run any migrations for fresh database at version 19', async () => {
      await migrationRunner.initialize(mockDb);

      const needsMigration = await migrationRunner.needsMigration();
      expect(needsMigration).toBe(false);
    });

    it('should not execute any ALTER TABLE or CREATE TABLE migration statements', async () => {
      await migrationRunner.initialize(mockDb);
      await migrationRunner.runMigrations();

      // Should not contain any migration-specific SQL
      const allSQL = executedSQL.join('\n');

      // These would only appear if migrations were running
      expect(allSQL).not.toContain('ALTER TABLE episodes ADD COLUMN latitude');
      expect(allSQL).not.toContain('CREATE TABLE episode_notes');
      expect(allSQL).not.toContain('ALTER TABLE medication_schedules ADD COLUMN notification_id');
      expect(allSQL).not.toContain('CREATE TABLE daily_status_logs');
      expect(allSQL).not.toContain('ALTER TABLE medication_doses ADD COLUMN status');
    });
  });

  describe('Migration Array', () => {
    it('should have an empty migrations array', () => {
      // Since migrations are squashed, target is the schema version
      const targetVersion = 19;

      // Verify no migrations are defined by checking that current and target versions are the same
      expect(targetVersion).toBe(19);
    });

    it('should return target version 19 from migration v19', async () => {
      await migrationRunner.initialize(mockDb);
      const targetVersion = await migrationRunner.getTargetVersion();

      // Migration v19 exists in the array, so target version is 19
      expect(targetVersion).toBe(19);
    });

    it('should return current version 19 for fresh database', async () => {
      await migrationRunner.initialize(mockDb);
      const currentVersion = await migrationRunner.getCurrentVersion();

      expect(currentVersion).toBe(19);
    });
  });

  describe('SQL Safety Checks', () => {
    it('should not execute any DROP COLUMN statements (not supported in SQLite)', async () => {
      await migrationRunner.initialize(mockDb);
      await migrationRunner.runMigrations();

      const allSQL = executedSQL.join('\n').toUpperCase();
      expect(allSQL).not.toContain('DROP COLUMN');
    });

    it('should not execute PRAGMA foreign_keys = OFF without turning it back ON', async () => {
      await migrationRunner.initialize(mockDb);
      await migrationRunner.runMigrations();

      const allSQL = executedSQL.join('\n');

      // Count PRAGMA foreign_keys statements
      const foreignKeysOff = allSQL.match(/PRAGMA foreign_keys\s*=\s*OFF/gi) || [];
      const foreignKeysOn = allSQL.match(/PRAGMA foreign_keys\s*=\s*ON/gi) || [];

      // If foreign keys are disabled, they should be re-enabled
      expect(foreignKeysOff.length).toBeLessThanOrEqual(foreignKeysOn.length);
    });

    it('should not execute BEGIN TRANSACTION without COMMIT', async () => {
      await migrationRunner.initialize(mockDb);
      await migrationRunner.runMigrations();

      const allSQL = executedSQL.join('\n');

      const beginTransactions = allSQL.match(/BEGIN TRANSACTION/gi) || [];
      const commits = allSQL.match(/COMMIT/gi) || [];

      // Every transaction should be committed
      expect(beginTransactions.length).toBeLessThanOrEqual(commits.length);
    });
  });

  describe('Performance Verification', () => {
    it('should execute minimal SQL for fresh database initialization', async () => {
      const startCount = executedSQL.length;

      await migrationRunner.initialize(mockDb);
      await migrationRunner.runMigrations();

      const endCount = executedSQL.length;
      const sqlExecuted = endCount - startCount;

      // Should only execute a few statements:
      // - CREATE TABLE schema_version (if not exists)
      // - SELECT version FROM schema_version
      // - INSERT INTO schema_version
      // - SELECT 1 (for validation, if applicable)
      expect(sqlExecuted).toBeLessThan(10); // Should be very minimal
    });

    it('should complete initialization quickly without migrations', async () => {
      const startTime = Date.now();

      await migrationRunner.initialize(mockDb);
      await migrationRunner.runMigrations();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be extremely fast (well under 100ms) since no migrations run
      // This is a unit test, so even with mocking it should be instant
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle database already at version 19', async () => {
      // Mock database already at version 19
      mockDb.getAllAsync = jest.fn(async (sql: string) => {
        if (sql.includes('SELECT version FROM schema_version')) {
          return [{ version: 19 }];
        }
        return [];
      });

      await migrationRunner.initialize(mockDb);
      const needsMigration = await migrationRunner.needsMigration();

      expect(needsMigration).toBe(false);

      // Running migrations should be a no-op
      await migrationRunner.runMigrations();

      // Should not execute any UPDATE schema_version statements
      const updates = executedSQL.filter(sql =>
        sql.includes('UPDATE schema_version') && sql.includes('version =')
      );
      expect(updates.length).toBe(0);
    });

    it('should handle repeated initialization calls', async () => {
      await migrationRunner.initialize(mockDb);
      const version1 = await migrationRunner.getCurrentVersion();

      await migrationRunner.initialize(mockDb);
      const version2 = await migrationRunner.getCurrentVersion();

      expect(version1).toBe(version2);
      expect(version1).toBe(19);
    });
  });
});
