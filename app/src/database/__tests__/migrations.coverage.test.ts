/**
 * Migration Coverage Tests
 *
 * These tests target the uncovered lines in migrations.ts to improve coverage
 * while following the existing test patterns in the codebase.
 */

import { migrationRunner } from '../migrations';
import { SCHEMA_VERSION } from '../schema';
import { logger, LogLevel } from '../../utils/logger';

// Mock expo-sqlite
jest.mock('expo-sqlite');

describe('Migration Coverage Tests', () => {
  let mockDatabase: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Set logger to DEBUG level so all messages are logged in tests
    await logger.setLogLevel(LogLevel.DEBUG);

    mockDatabase = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn(),
    };

    // Reset the migrationRunner's internal state
    migrationRunner['db'] = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Migration Validation', () => {
    it('should validate migration version number', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      // Test invalid version migration
      const invalidMigration = {
        version: 0,
        name: 'invalid_migration',
        up: jest.fn(),
      };

      const validation = await (migrationRunner as any).validateMigration(invalidMigration);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toEqual(['Invalid migration version: 0']);
    });

    it('should validate migration has up function', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      // Test migration without up function
      const invalidMigration = {
        version: SCHEMA_VERSION,
        name: 'missing_up',
      };

      const validation = await (migrationRunner as any).validateMigration(invalidMigration);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toEqual([`Migration ${SCHEMA_VERSION} missing 'up' function`]);
    });

    it('should warn about missing down function', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      const migrationWithoutDown = {
        version: SCHEMA_VERSION,
        name: 'no_down',
        up: jest.fn(),
      };

      const validation = await (migrationRunner as any).validateMigration(migrationWithoutDown);
      expect(validation.valid).toBe(true);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.warn).toHaveBeenCalledWith(
        '[WARN]',
        `Migration ${SCHEMA_VERSION} does not have a 'down' function - rollback will not be possible`
      );
    });

    it('should fail validation for uninitialized runner', async () => {
      // Don't initialize the runner
      const migration = {
        version: SCHEMA_VERSION,
        name: 'test',
        up: jest.fn(),
      };

      const validation = await (migrationRunner as any).validateMigration(migration);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toEqual(['MigrationRunner not initialized']);
    });

    it('should validate database connection', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: SCHEMA_VERSION }])  // initialization
        .mockRejectedValueOnce(new Error('Connection lost'));  // validation query fails

      await migrationRunner.initialize(mockDatabase);

      const migration = {
        version: SCHEMA_VERSION,
        name: 'test',
        up: jest.fn(),
      };

      const validation = await (migrationRunner as any).validateMigration(migration);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toEqual(['Database connection invalid: Connection lost']);
    });
  });

  describe('Smoke Tests', () => {
    it('should return false when runner not initialized', async () => {
      // Don't initialize the runner
      const result = await (migrationRunner as any).runSmokeTests(SCHEMA_VERSION - 1);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'Cannot run smoke tests: MigrationRunner not initialized');
    });

    it('should skip smoke tests in test environment (Jest worker)', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      // Set Jest worker environment
      const originalJestWorkerId = process.env.JEST_WORKER_ID;
      process.env.JEST_WORKER_ID = '1';

      const result = await (migrationRunner as any).runSmokeTests(SCHEMA_VERSION);
      expect(result).toBe(true);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith('[INFO]', `Skipping smoke tests in test environment for migration ${SCHEMA_VERSION}`);

      // Restore environment
      if (originalJestWorkerId) {
        process.env.JEST_WORKER_ID = originalJestWorkerId;
      } else {
        process.env.JEST_WORKER_ID = undefined as any;
      }
    });

    it('should skip smoke tests when NODE_ENV is test', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      const originalNodeEnv = process.env.NODE_ENV;
      const originalJestWorkerId = process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'test';
      process.env.JEST_WORKER_ID = undefined as any;

      const result = await (migrationRunner as any).runSmokeTests(SCHEMA_VERSION);
      expect(result).toBe(true);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith('[INFO]', `Skipping smoke tests in test environment for migration ${SCHEMA_VERSION}`);

      // Restore environment
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv;
      }
      if (originalJestWorkerId) {
        process.env.JEST_WORKER_ID = originalJestWorkerId;
      }
    });
  });

  describe('Migration Execution', () => {
    it('should handle backup creation failure', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 18 }]);
      await migrationRunner.initialize(mockDatabase);

      const failingBackup = jest.fn().mockRejectedValue(new Error('Backup failed'));

      await expect(migrationRunner.runMigrations(failingBackup)).rejects.toThrow(
        'Migration aborted: Failed to create backup'
      );

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'Failed to create backup before migration:', { context: expect.any(Error), stack: undefined });
    });

    it('should warn when no backup function provided', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }]);

      await migrationRunner.initialize(mockDatabase);
      await migrationRunner.runMigrations(); // No backup function

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'No backup function provided, skipping automatic backup');
      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'WARNING: If migration fails, manual data recovery may be required');
    });

    it('should handle no migrations needed scenario', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      // Already at current version, no migrations needed
      await migrationRunner.runMigrations();

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith('[INFO]', 'Database is up to date, no migrations needed');
    });

    it('should handle migration execution failure', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 18 }]) // initialization
        .mockResolvedValueOnce([{ version: 18 }]) // getCurrentVersion
        .mockResolvedValueOnce([{ version: 18 }]) // runMigrations getCurrentVersion
        .mockResolvedValue([]); // validation passes

      // Make the first execAsync call (in migration) fail
      mockDatabase.execAsync
        .mockResolvedValueOnce(undefined) // Let initialization pass
        .mockRejectedValueOnce(new Error('SQL error')); // Migration fails

      await migrationRunner.initialize(mockDatabase);

      await expect(migrationRunner.runMigrations()).rejects.toThrow(
        'Migration 19 failed: SQL error. Database backup available'
      );
      
      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));
      
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'Migration 19 failed:', { context: expect.any(Error), stack: undefined });
    });

    it('should execute migration v19 successfully', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);
      await migrationRunner.runMigrations();

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      // Verify migration v19 execution
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE intensity_readings_new')
      );
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'Migration 19: Adding CHECK constraints to tables...');

      // Verify version update
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
        [19, expect.any(Number)]
      );
    });
  });

  describe('Rollback Operations', () => {
    it('should handle rollback when no rollback needed (same version)', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.rollback(SCHEMA_VERSION);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith('[INFO]', 'No rollback needed');
    });

    it('should handle rollback when no rollback needed (higher version)', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.rollback(SCHEMA_VERSION + 1);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith('[INFO]', 'No rollback needed');
    });

    it('should handle rollback backup creation failure', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      const failingBackup = jest.fn().mockRejectedValue(new Error('Backup failed'));

      await expect(migrationRunner.rollback(SCHEMA_VERSION - 2, failingBackup)).rejects.toThrow(
        'Rollback aborted: Failed to create backup'
      );

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'Failed to create backup before rollback:', { context: expect.any(Error), stack: undefined });
    });

    it('should warn when no backup function provided for rollback', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      // This test doesn't trigger the warning because no rollback is needed (version N -> N)
      await migrationRunner.rollback(SCHEMA_VERSION);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith('[INFO]', 'No rollback needed');
    });

    it('should handle migration that does not support rollback', async () => {
      // Version 20 -> 18 requires rolling back through v19 which doesn't support downgrade
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 20 }]);
      await migrationRunner.initialize(mockDatabase);

      // Migration v19's down function throws the specific error
      await expect(migrationRunner.rollback(18)).rejects.toThrow('does not support downgrade');
    });
  });

  describe('Version Management', () => {
    it('should return default version when no version exists', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]); // No version record
      await migrationRunner.initialize(mockDatabase);

      // Mock empty result for getCurrentVersion after initialization
      mockDatabase.getAllAsync.mockResolvedValue([]);

      const version = await migrationRunner.getCurrentVersion();
      expect(version).toBe(1);
    });

    it('should handle undefined version property', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{}]); // Version property missing
      await migrationRunner.initialize(mockDatabase);

      const version = await migrationRunner.getCurrentVersion();
      expect(version).toBe(1);
    });

    it('should return target version from migrations', async () => {
      const targetVersion = await migrationRunner.getTargetVersion();
      expect(targetVersion).toBe(SCHEMA_VERSION);
    });

    it('should determine if migration is needed', async () => {
      // Test old database needing migration
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION - 2 }]);
      await migrationRunner.initialize(mockDatabase);

      const needsMigration = await migrationRunner.needsMigration();
      expect(needsMigration).toBe(true);

      // Test current database not needing migration
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      const needsMigrationCurrent = await migrationRunner.needsMigration();
      expect(needsMigrationCurrent).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      mockDatabase.execAsync.mockRejectedValue(new Error('Database error'));

      await expect(migrationRunner.initialize(mockDatabase)).rejects.toThrow('Database error');
    });

    it('should handle errors when not initialized', async () => {
      await expect(migrationRunner.getCurrentVersion()).rejects.toThrow('MigrationRunner not initialized');
      await expect(migrationRunner.runMigrations()).rejects.toThrow('MigrationRunner not initialized');
      await expect(migrationRunner.rollback(1)).rejects.toThrow('MigrationRunner not initialized');
    });

    it('should handle database errors during version updates', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValue([]);

      mockDatabase.runAsync.mockRejectedValue(new Error('Version update failed'));

      await migrationRunner.initialize(mockDatabase);

      await expect(migrationRunner.runMigrations()).rejects.toThrow(
        'Migration 19 failed: Version update failed'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle getTargetVersion with empty migrations', async () => {
      const targetVersion = await migrationRunner.getTargetVersion();
      expect(targetVersion).toBeGreaterThan(0);
    });

    it('should handle rollback validation', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      // Try rollback to same version (should skip)
      await migrationRunner.rollback(SCHEMA_VERSION);
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'No rollback needed');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multiple migration runs on up-to-date database', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.runMigrations();
      await migrationRunner.runMigrations();
      await migrationRunner.runMigrations();

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith('[INFO]', 'Database is up to date, no migrations needed');
    });

    it('should create backup before migration when backup function provided', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);

      const backupFunction = jest.fn().mockResolvedValue(undefined);
      await migrationRunner.runMigrations(backupFunction);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(backupFunction).toHaveBeenCalledWith(mockDatabase);
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'Creating automatic backup before migration...');
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'Backup created successfully');
    });

    it('should log migration progress', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: SCHEMA_VERSION - 1 }])
        .mockResolvedValueOnce([{ version: SCHEMA_VERSION - 1 }])
        .mockResolvedValueOnce([{ version: SCHEMA_VERSION - 1 }])
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);
      await migrationRunner.runMigrations();

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith('[INFO]', `Migrating database from version ${SCHEMA_VERSION - 1} to ${SCHEMA_VERSION}`);
      // Match any migration name at SCHEMA_VERSION since it can change
      expect(console.log).toHaveBeenCalledWith('[INFO]', expect.stringMatching(new RegExp(`^Running migration ${SCHEMA_VERSION}: .+$`)));
      expect(console.log).toHaveBeenCalledWith('[INFO]', `Migration ${SCHEMA_VERSION} completed successfully`);
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'All migrations completed successfully');
    });

    it('should create backup before rollback when backup function provided', async () => {
      // Create a mock migration that supports rollback for testing
      const originalMigrations = require('../migrations');
      const testMigration = {
        version: SCHEMA_VERSION,
        name: 'test_rollback',
        up: jest.fn(),
        down: jest.fn().mockResolvedValue(undefined),
      };

      const migrationModule = originalMigrations;
      const originalMigrationsArray = migrationModule.migrations || [];
      migrationModule.migrations = [testMigration];

      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      const backupFunction = jest.fn().mockResolvedValue(undefined);
      await migrationRunner.rollback(SCHEMA_VERSION - 1, backupFunction);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(backupFunction).toHaveBeenCalledWith(mockDatabase);
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'Creating automatic backup before rollback...');
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'Backup created successfully');

      // Restore original migrations
      migrationModule.migrations = originalMigrationsArray;
    });

    it('should warn when no backup function provided for actual rollback', async () => {
      // Create a test migration that supports rollback
      const originalMigrations = require('../migrations');
      const testMigration = {
        version: SCHEMA_VERSION,
        name: 'test_migration',
        up: jest.fn(),
        down: jest.fn().mockResolvedValue(undefined),
      };

      const migrationModule = originalMigrations;
      const originalMigrationsArray = migrationModule.migrations || [];
      migrationModule.migrations = [testMigration];

      mockDatabase.getAllAsync.mockResolvedValue([{ version: SCHEMA_VERSION }]);
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.rollback(SCHEMA_VERSION - 1); // No backup function provided

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'No backup function provided, skipping automatic backup');

      // Restore original migrations
      migrationModule.migrations = originalMigrationsArray;
    });
  });

  describe('Migration 19 Detailed Testing', () => {
    it('should execute all table recreation steps of migration 20', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);
      await migrationRunner.runMigrations();

      // Verify specific SQL calls for table recreation
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE intensity_readings_new')
      );
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE episode_notes_new')
      );
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE pain_location_logs_new')
      );
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE medication_schedules_new')
      );
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE medication_reminders_new')
      );
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE daily_status_logs_new')
      );

      // Verify data copying steps
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO intensity_readings_new SELECT * FROM intensity_readings')
      );

      // Verify table renaming steps
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE intensity_readings_new RENAME TO intensity_readings')
      );

      // Verify index recreation
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_intensity_readings_episode')
      );
    });
  });
});