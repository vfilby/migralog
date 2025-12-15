/**
 * Final Migration Coverage Tests
 *
 * These tests target specific uncovered lines to boost coverage above 70%.
 */

import { migrationRunner } from '../migrations';
import { logger, LogLevel } from '../../utils/logger';

// Mock expo-sqlite
jest.mock('expo-sqlite');

describe('Final Migration Coverage Tests', () => {
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

  describe('Validation Edge Cases', () => {
    it('should validate migration with missing up function', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 20 }]);
      await migrationRunner.initialize(mockDatabase);

      // Test direct validation of migration without up function
      const invalidMigration = {
        version: 20,
        name: 'test',
        up: null, // Missing up function
      };

      const result = await (migrationRunner as any).validateMigration(invalidMigration);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Migration 20 missing 'up' function");
    });

    it('should handle database connection validation failure', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 20 }]) // initialization works
        .mockRejectedValue(new Error('Connection lost')); // validation query fails

      await migrationRunner.initialize(mockDatabase);

      const migration = {
        version: 20,
        name: 'test',
        up: jest.fn(),
      };

      const result = await (migrationRunner as any).validateMigration(migration);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Database connection invalid: Connection lost');
    });
  });

  describe('Backup Scenario Coverage', () => {
    it('should handle backup failure during migration', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }]);

      await migrationRunner.initialize(mockDatabase);

      const failingBackup = jest.fn().mockRejectedValue(new Error('Backup failed'));

      await expect(migrationRunner.runMigrations(failingBackup)).rejects.toThrow(
        'Migration aborted: Failed to create backup'
      );

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[.*\] \[ERROR\]$/),
        'Failed to create backup before migration:',
        { context: expect.any(Error), stack: undefined }
      );
    });

    it('should handle backup failure during rollback', async () => {
      // Create a test migration that supports rollback
      const originalMigrations = require('../migrations');
      const testMigration = {
        version: 20,
        name: 'test_migration',
        up: jest.fn(),
        down: jest.fn(),
      };
      
      const migrationModule = originalMigrations;
      const originalMigrationsArray = migrationModule.migrations || [];
      migrationModule.migrations = [testMigration];

      mockDatabase.getAllAsync.mockResolvedValue([{ version: 20 }]);
      await migrationRunner.initialize(mockDatabase);

      const failingBackup = jest.fn().mockRejectedValue(new Error('Backup failed'));

      await expect(migrationRunner.rollback(19, failingBackup)).rejects.toThrow(
        'Rollback aborted: Failed to create backup'
      );

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[.*\] \[ERROR\]$/),
        'Failed to create backup before rollback:',
        { context: expect.any(Error), stack: undefined }
      );

      // Restore original migrations
      migrationModule.migrations = originalMigrationsArray;
    });

    it('should log backup warnings during rollback', async () => {
      // Create a test migration that supports rollback
      const originalMigrations = require('../migrations');
      const testMigration = {
        version: 20,
        name: 'test_migration',
        up: jest.fn(),
        down: jest.fn().mockResolvedValue(undefined),
      };
      
      const migrationModule = originalMigrations;
      const originalMigrationsArray = migrationModule.migrations || [];
      migrationModule.migrations = [testMigration];

      mockDatabase.getAllAsync.mockResolvedValue([{ version: 20 }]);
      await migrationRunner.initialize(mockDatabase);

      // Rollback without backup function
      await migrationRunner.rollback(19);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[.*\] \[WARN\]$/),
        'No backup function provided, skipping automatic backup'
      );

      // Restore original migrations
      migrationModule.migrations = originalMigrationsArray;
    });
  });

  describe('Complex Migration Scenarios', () => {
    it('should log migration progress messages', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);
      await migrationRunner.runMigrations();

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      // Check migration progress logs
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] \[INFO\]$/), expect.stringMatching(/^Migrating database from version 18 to \d+$/));
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] \[INFO\]$/), 'Running migration 19: add_check_constraints_to_tables');
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] \[INFO\]$/), 'Migration 19 completed successfully');
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] \[INFO\]$/), 'All migrations completed successfully');
    });

    it('should handle rollback with missing down function', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 20 }]);
      await migrationRunner.initialize(mockDatabase);

      // Migration 19's down function throws this specific error
      await expect(migrationRunner.rollback(18)).rejects.toThrow(
        'does not support downgrade'
      );
    });

    it('should handle rollback logging', async () => {
      // Create a test migration that supports rollback
      const originalMigrations = require('../migrations');
      const testMigration = {
        version: 20,
        name: 'test_rollback',
        up: jest.fn(),
        down: jest.fn().mockResolvedValue(undefined),
      };
      
      const migrationModule = originalMigrations;
      const originalMigrationsArray = migrationModule.migrations || [];
      migrationModule.migrations = [testMigration];

      mockDatabase.getAllAsync.mockResolvedValue([{ version: 20 }]);
      await migrationRunner.initialize(mockDatabase);

      await migrationRunner.rollback(19);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] \[INFO\]$/), 'Rolling back database from version 20 to 19');
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] \[INFO\]$/), 'Rollback completed successfully');

      // Restore original migrations
      migrationModule.migrations = originalMigrationsArray;
    });
  });

  describe('Error Path Coverage', () => {
    it('should handle version update failures', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValue([]); // validation passes

      // Make version update fail
      mockDatabase.runAsync.mockRejectedValue(new Error('Version update failed'));

      await migrationRunner.initialize(mockDatabase);

      await expect(migrationRunner.runMigrations()).rejects.toThrow(
        'Migration 19 failed: Version update failed'
      );

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] \[ERROR\]$/), 'Migration 19 failed:', { context: expect.any(Error), stack: undefined });
    });

    it('should handle migration execution SQL failure', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValueOnce([{ version: 18 }])
        .mockResolvedValue([]);

      // Let initialization pass, but make migration SQL fail
      mockDatabase.execAsync
        .mockResolvedValueOnce(undefined) // initialization
        .mockRejectedValue(new Error('CREATE TABLE failed'));

      await migrationRunner.initialize(mockDatabase);

      await expect(migrationRunner.runMigrations()).rejects.toThrow(
        'Migration 19 failed: CREATE TABLE failed'
      );
    });
  });

  describe('Environment and Mock Detection', () => {
    it('should detect Jest worker environment for smoke tests', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 20 }]);
      await migrationRunner.initialize(mockDatabase);

      // Set Jest worker ID
      process.env.JEST_WORKER_ID = '1';

      const result = await (migrationRunner as any).runSmokeTests(19);
      expect(result).toBe(true);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[.*\] \[INFO\]$/),
        'Skipping smoke tests in test environment for migration 19'
      );

      // Restore
      delete process.env.JEST_WORKER_ID;
      (mockDatabase.getAllAsync as any).mock = { calls: [] };
    });

    it('should detect NODE_ENV test for smoke tests', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 20 }]);
      await migrationRunner.initialize(mockDatabase);

      const originalNodeEnv = process.env.NODE_ENV;
      const originalJestWorkerId = process.env.JEST_WORKER_ID;
      
      process.env.NODE_ENV = 'test';
      process.env.JEST_WORKER_ID = undefined as any;

      const result = await (migrationRunner as any).runSmokeTests(19);
      expect(result).toBe(true);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[.*\] \[INFO\]$/),
        'Skipping smoke tests in test environment for migration 19'
      );

      // Restore
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv;
      }
      if (originalJestWorkerId) {
        process.env.JEST_WORKER_ID = originalJestWorkerId;
      }
    });

    it('should detect mocked database functions', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([{ version: 20 }]);
      await migrationRunner.initialize(mockDatabase);

      // Add mock property
      (mockDatabase.getAllAsync as any).mock = { calls: [] };

      const result = await (migrationRunner as any).runSmokeTests(19);
      expect(result).toBe(true);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[.*\] \[INFO\]$/),
        'Skipping smoke tests in test environment for migration 19'
      );
    });
  });
});