/**
 * Migration Runner Tests (After Squashing)
 *
 * All migrations have been squashed into the base schema (schema.ts).
 * These tests verify that:
 * 1. Fresh databases are created at version 19 directly
 * 2. No migrations run for fresh databases
 * 3. Migration runner initializes correctly
 */

import { migrationRunner } from '../migrations';
import { logger, LogLevel } from '../../utils/logger';

// Mock expo-sqlite
jest.mock('expo-sqlite');

describe('migrationRunner (Squashed Schema)', () => {
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
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
    };

    // Reset the migrationRunner's internal state
    migrationRunner['db'] = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with database', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 19 }]);

      await migrationRunner.initialize(mockDatabase);

      expect(mockDatabase.execAsync).toHaveBeenCalled();
    });

    it('should create schema_version table if not exists', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);
      mockDatabase.runAsync.mockResolvedValue(undefined);

      await migrationRunner.initialize(mockDatabase);

      expect(mockDatabase.execAsync).toHaveBeenCalled();
      expect(mockDatabase.runAsync).toHaveBeenCalled();
    });

    it('should set version to 19 for fresh database', async () => {
      // Mock empty schema_version table (fresh database)
      mockDatabase.getAllAsync.mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);

      // Should insert version 19
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'INSERT OR IGNORE INTO schema_version (id, version, updated_at) VALUES (1, 19, ?)',
        expect.any(Array)
      );
    });
  });

  describe('getCurrentVersion', () => {
    it('should return current schema version', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 19 }]);
      await migrationRunner.initialize(mockDatabase);

      const version = await migrationRunner.getCurrentVersion();

      expect(version).toBe(19);
    });

    it('should return 19 for fresh database after initialization', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);
      mockDatabase.runAsync.mockResolvedValue(undefined);
      await migrationRunner.initialize(mockDatabase);

      // After init, should return 19
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 19 }]);
      const version = await migrationRunner.getCurrentVersion();

      expect(version).toBe(19);
    });
  });

  describe('getTargetVersion', () => {
    it('should return 19 from migration v19', async () => {
      const targetVersion = await migrationRunner.getTargetVersion();

      // Migration v19 exists in the array, so target version is 19
      expect(targetVersion).toBe(19);
    });
  });

  describe('needsMigration', () => {
    it('should return false for fresh database at version 19', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 19 }]);
      await migrationRunner.initialize(mockDatabase);

      const needsMigration = await migrationRunner.needsMigration();

      // Current version 19, target version 19, so no migration needed
      expect(needsMigration).toBe(false);
    });

    it('should return false after initialization', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([]);
      await migrationRunner.initialize(mockDatabase);

      // After initialization, fresh database should be at v19
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 19 }]);
      const needsMigration = await migrationRunner.needsMigration();

      expect(needsMigration).toBe(false);
    });

    it('should return true for v18 database needing upgrade to v19', async () => {
      // Simulate existing v18 database (from v1.1.4)
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 18 }]);
      await migrationRunner.initialize(mockDatabase);

      const needsMigration = await migrationRunner.needsMigration();

      // Current version 18, target version 19, so migration needed
      expect(needsMigration).toBe(true);
    });
  });

  describe('migration execution', () => {
    it('should upgrade v18 database to v19 by running migration', async () => {
      // Simulate existing v18 database (from v1.1.4)
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 18 }]);
      await migrationRunner.initialize(mockDatabase);

      // Reset mock to track runMigrations calls
      jest.clearAllMocks();

      await migrationRunner.runMigrations();

      // Migration v19 should run - check that execAsync was called for table recreations
      expect(mockDatabase.execAsync).toHaveBeenCalled();

      // Version should be updated to 19
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
        [19, expect.any(Number)]
      );

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith(
        '[INFO]',
        expect.stringContaining('Migration 19')
      );
    });

    it('should not run migrations for fresh database at version 19', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 19 }]);
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.runMigrations();

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith(
        '[INFO]',
        'Database is up to date, no migrations needed'
      );
    });

    it('should not execute any migration SQL for fresh database', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 19 }]);
      await migrationRunner.initialize(mockDatabase);

      const execCallsBefore = mockDatabase.execAsync.mock.calls.length;
      const runCallsBefore = mockDatabase.runAsync.mock.calls.length;

      await migrationRunner.runMigrations();

      const execCallsAfter = mockDatabase.execAsync.mock.calls.length;
      const runCallsAfter = mockDatabase.runAsync.mock.calls.length;

      // Should not execute any additional SQL (beyond initialization)
      expect(execCallsAfter).toBe(execCallsBefore);
      expect(runCallsAfter).toBe(runCallsBefore);
    });

    it('should handle runMigrations being called multiple times', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 19 }]);
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.runMigrations();
      await migrationRunner.runMigrations();
      await migrationRunner.runMigrations();

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      // Should not throw or cause issues
      expect(console.log).toHaveBeenCalledWith(
        '[INFO]',
        'Database is up to date, no migrations needed'
      );
    });
  });

  describe('rollback', () => {
    it('should handle rollback attempt gracefully', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 19 }]);
      await migrationRunner.initialize(mockDatabase);

      // Trying to rollback from 19 to any version should log "No rollback needed"
      await migrationRunner.rollback(19);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith('[INFO]', 'No rollback needed');
    });

    it('should handle rollback to higher version', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 19 }]);
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.rollback(20);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith('[INFO]', 'No rollback needed');
    });
  });

  describe('error handling', () => {
    it('should throw error if not initialized', async () => {
      await expect(migrationRunner.getCurrentVersion()).rejects.toThrow(
        'MigrationRunner not initialized'
      );
    });

    it('should throw error if runMigrations called before initialize', async () => {
      await expect(migrationRunner.runMigrations()).rejects.toThrow(
        'MigrationRunner not initialized'
      );
    });

    it('should throw error if rollback called before initialize', async () => {
      await expect(migrationRunner.rollback(1)).rejects.toThrow(
        'MigrationRunner not initialized'
      );
    });
  });
});
