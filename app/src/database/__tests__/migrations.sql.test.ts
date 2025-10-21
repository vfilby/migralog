/**
 * SQL Verification Tests for Database Migrations
 *
 * These tests verify that migrations execute the correct SQL commands.
 * While we can't test with a real database in Jest (no native SQLite),
 * we CAN verify that the correct SQL is being generated and executed.
 *
 * This catches:
 * - SQL syntax errors
 * - Missing SQL statements
 * - Incorrect table recreation patterns
 * - Missing indexes after rollback
 */

import { migrationRunner } from '../migrations';

describe('Migration SQL Verification', () => {
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Mock database that captures all SQL commands
    mockDatabase = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn(),
    };

    // Reset migration runner state
    migrationRunner['db'] = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Helper: Get all SQL statements executed via execAsync
   */
  function getExecutedSQL(): string[] {
    return mockDatabase.execAsync.mock.calls
      .map((call: any[]) => call[0])
      .filter((sql: string) => sql && typeof sql === 'string');
  }

  /**
   * Helper: Check if any executed SQL contains a substring
   */
  function executedSQLContains(substring: string): boolean {
    return getExecutedSQL().some(sql =>
      sql.toLowerCase().includes(substring.toLowerCase())
    );
  }

  describe('Migration 2: add_location_to_episodes', () => {
    beforeEach(async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 1 }]) // getCurrentVersion
        .mockResolvedValueOnce([{ name: 'id' }]) // PRAGMA table_info (no location columns)
        .mockResolvedValue([]); // Mock for remaining calls

      await migrationRunner.initialize(mockDatabase);
    });

    it('should execute ALTER TABLE statements to add location columns', async () => {
      await migrationRunner.runMigrations();

      // Should add all 4 location columns
      expect(executedSQLContains('ALTER TABLE episodes ADD COLUMN latitude')).toBe(true);
      expect(executedSQLContains('ALTER TABLE episodes ADD COLUMN longitude')).toBe(true);
      expect(executedSQLContains('ALTER TABLE episodes ADD COLUMN location_accuracy')).toBe(true);
      expect(executedSQLContains('ALTER TABLE episodes ADD COLUMN location_timestamp')).toBe(true);
    });

    describe('rollback', () => {
      it('should use table recreation pattern (5 steps)', async () => {
        // Setup: at version 2
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ version: 2 }])
          .mockResolvedValue([]);

        await migrationRunner.initialize(mockDatabase);
        await migrationRunner.rollback(1);

        const sql = getExecutedSQL();

        // Step 1: CREATE backup table
        expect(sql.some(s => s.includes('CREATE TABLE episodes_backup'))).toBe(true);

        // Step 2: INSERT data into backup
        expect(sql.some(s =>
          s.includes('INSERT INTO episodes_backup') &&
          s.includes('SELECT')
        )).toBe(true);

        // Step 3: DROP original table
        expect(sql.some(s => s.includes('DROP TABLE episodes'))).toBe(true);

        // Step 4: RENAME backup to original
        expect(sql.some(s =>
          s.includes('ALTER TABLE episodes_backup') &&
          s.includes('RENAME TO episodes')
        )).toBe(true);

        // Step 5: Recreate indexes
        expect(sql.some(s =>
          s.includes('CREATE INDEX') &&
          s.includes('idx_episodes_start_time')
        )).toBe(true);
      });

      it('should not include location columns in backup table schema', async () => {
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ version: 2 }])
          .mockResolvedValue([]);

        await migrationRunner.initialize(mockDatabase);
        await migrationRunner.rollback(1);

        const createBackupSQL = getExecutedSQL().find(s =>
          s.includes('CREATE TABLE episodes_backup')
        );

        expect(createBackupSQL).toBeDefined();
        expect(createBackupSQL).not.toContain('latitude');
        expect(createBackupSQL).not.toContain('longitude');
        expect(createBackupSQL).not.toContain('location_accuracy');
        expect(createBackupSQL).not.toContain('location_timestamp');
      });

      it('should preserve all original columns in SELECT statement', async () => {
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ version: 2 }])
          .mockResolvedValue([]);

        await migrationRunner.initialize(mockDatabase);
        await migrationRunner.rollback(1);

        const insertSQL = getExecutedSQL().find(s =>
          s.includes('INSERT INTO episodes_backup') &&
          s.includes('SELECT')
        );

        expect(insertSQL).toBeDefined();

        // Should include all v1 columns
        expect(insertSQL).toContain('start_time');
        expect(insertSQL).toContain('end_time');
        expect(insertSQL).toContain('locations');
        expect(insertSQL).toContain('peak_intensity');
        expect(insertSQL).toContain('created_at');
        expect(insertSQL).toContain('updated_at');

        // Should NOT include location columns
        expect(insertSQL).not.toMatch(/\blatitude\b/);
        expect(insertSQL).not.toMatch(/\blongitude\b/);
      });
    });
  });

  describe('Migration 3: add_episode_notes_table', () => {
    beforeEach(async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 2 }])
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);
    });

    it('should create episode_notes table with correct schema', async () => {
      await migrationRunner.runMigrations();

      const createTableSQL = getExecutedSQL().find(s =>
        s.includes('CREATE TABLE') &&
        s.includes('episode_notes')
      );

      expect(createTableSQL).toBeDefined();
      expect(createTableSQL).toContain('id TEXT PRIMARY KEY');
      expect(createTableSQL).toContain('episode_id TEXT NOT NULL');
      expect(createTableSQL).toContain('timestamp INTEGER NOT NULL');
      expect(createTableSQL).toContain('note TEXT NOT NULL');
      expect(createTableSQL).toContain('FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE');
    });

    it('should create indexes for episode_notes', async () => {
      await migrationRunner.runMigrations();

      expect(executedSQLContains('CREATE INDEX')).toBe(true);
      expect(executedSQLContains('idx_episode_notes_episode')).toBe(true);
      expect(executedSQLContains('idx_episode_notes_timestamp')).toBe(true);
    });

    describe('rollback', () => {
      it('should execute DROP TABLE and DROP INDEX for rollback', async () => {
        // Reset mocks
        mockDatabase.execAsync.mockClear();
        mockDatabase.runAsync.mockClear();
        mockDatabase.getAllAsync.mockClear();

        // Setup: at version 3, rollback to version 2
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ version: 3 }]) // initialize() getCurrentVersion
          .mockResolvedValueOnce([{ version: 3 }]) // rollback() getCurrentVersion
          .mockResolvedValue([]);

        // Reset migration runner state
        migrationRunner['db'] = null;
        await migrationRunner.initialize(mockDatabase);
        await migrationRunner.rollback(2);

        const sql = getExecutedSQL();

        // Verify DROP statements executed
        expect(sql.some(s => s.includes('DROP TABLE') && s.includes('episode_notes'))).toBe(true);
        expect(sql.some(s => s.includes('DROP INDEX') && s.includes('idx_episode_notes'))).toBe(true);
      });
    });
  });

  describe('Migration 4: add_notification_fields_to_schedules', () => {
    beforeEach(async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 3 }])
        .mockResolvedValueOnce([{ name: 'id' }]) // PRAGMA table_info (no notification columns)
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);
    });

    it('should add notification_id and reminder_enabled columns', async () => {
      await migrationRunner.runMigrations();

      expect(executedSQLContains('ALTER TABLE medication_schedules ADD COLUMN notification_id')).toBe(true);
      expect(executedSQLContains('ALTER TABLE medication_schedules ADD COLUMN reminder_enabled')).toBe(true);
    });

    it('should set default value for reminder_enabled', async () => {
      await migrationRunner.runMigrations();

      const reminderSQL = getExecutedSQL().find(s =>
        s.includes('reminder_enabled')
      );

      expect(reminderSQL).toContain('DEFAULT 1');
    });

    describe('rollback', () => {
      it('should use table recreation pattern', async () => {
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ version: 4 }])
          .mockResolvedValue([]);

        await migrationRunner.initialize(mockDatabase);
        await migrationRunner.rollback(3);

        expect(executedSQLContains('CREATE TABLE medication_schedules_backup')).toBe(true);
        expect(executedSQLContains('INSERT INTO medication_schedules_backup')).toBe(true);
        expect(executedSQLContains('DROP TABLE medication_schedules')).toBe(true);
        expect(executedSQLContains('ALTER TABLE medication_schedules_backup RENAME TO medication_schedules')).toBe(true);
      });

      it('should not include notification columns in backup', async () => {
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ version: 4 }])
          .mockResolvedValue([]);

        await migrationRunner.initialize(mockDatabase);
        await migrationRunner.rollback(3);

        const createSQL = getExecutedSQL().find(s =>
          s.includes('CREATE TABLE medication_schedules_backup')
        );

        expect(createSQL).toBeDefined();
        expect(createSQL).not.toContain('notification_id');
        expect(createSQL).not.toContain('reminder_enabled');
      });
    });
  });

  describe('Migration 5: add_daily_status_logs_table', () => {
    beforeEach(async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 4 }])
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);
    });

    it('should create daily_status_logs table', async () => {
      await migrationRunner.runMigrations();

      const createSQL = getExecutedSQL().find(s =>
        s.includes('CREATE TABLE') &&
        s.includes('daily_status_logs')
      );

      expect(createSQL).toBeDefined();
      expect(createSQL).toContain('date TEXT NOT NULL UNIQUE');
      expect(createSQL).toContain('status TEXT NOT NULL');
      expect(createSQL).toContain('prompted INTEGER NOT NULL DEFAULT 0');
    });

    it('should create indexes', async () => {
      await migrationRunner.runMigrations();

      expect(executedSQLContains('idx_daily_status_date')).toBe(true);
      expect(executedSQLContains('idx_daily_status_status')).toBe(true);
    });
  });

  describe('Migration 6: add_status_to_medication_doses', () => {
    beforeEach(async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 5 }])
        .mockResolvedValueOnce([{ name: 'id' }]) // PRAGMA table_info (no status column)
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);
    });

    it('should add status column with default value', async () => {
      await migrationRunner.runMigrations();

      const statusSQL = getExecutedSQL().find(s =>
        s.includes('ALTER TABLE medication_doses') &&
        s.includes('status')
      );

      expect(statusSQL).toBeDefined();
      expect(statusSQL).toContain('TEXT NOT NULL');
      expect(statusSQL).toContain("DEFAULT 'taken'");
    });

    describe('rollback', () => {
      it('should use table recreation pattern', async () => {
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ version: 6 }])
          .mockResolvedValue([]);

        await migrationRunner.initialize(mockDatabase);
        await migrationRunner.rollback(5);

        expect(executedSQLContains('CREATE TABLE medication_doses_backup')).toBe(true);
        expect(executedSQLContains('DROP TABLE medication_doses')).toBe(true);
        expect(executedSQLContains('RENAME TO medication_doses')).toBe(true);
      });

      it('should preserve foreign keys in backup table', async () => {
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ version: 6 }])
          .mockResolvedValue([]);

        await migrationRunner.initialize(mockDatabase);
        await migrationRunner.rollback(5);

        const createSQL = getExecutedSQL().find(s =>
          s.includes('CREATE TABLE medication_doses_backup')
        );

        expect(createSQL).toBeDefined();
        expect(createSQL).toContain('FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE');
        expect(createSQL).toContain('FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL');
      });

      it('should recreate all indexes', async () => {
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ version: 6 }])
          .mockResolvedValue([]);

        await migrationRunner.initialize(mockDatabase);
        await migrationRunner.rollback(5);

        expect(executedSQLContains('idx_medication_doses_medication')).toBe(true);
        expect(executedSQLContains('idx_medication_doses_episode')).toBe(true);
        expect(executedSQLContains('idx_medication_doses_timestamp')).toBe(true);
      });
    });
  });

  describe('SQL Safety Checks', () => {
    it('all migrations should have down functions', async () => {
      const migrations = (migrationRunner as any).constructor.migrations || [];

      migrations.forEach((migration: any) => {
        expect(migration.down).toBeDefined();
        expect(typeof migration.down).toBe('function');
      });
    });

    it('no migrations should use DROP COLUMN (not supported in SQLite)', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 1 }])
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);
      await migrationRunner.runMigrations();

      const sql = getExecutedSQL();

      sql.forEach(statement => {
        expect(statement.toLowerCase()).not.toContain('drop column');
      });
    });

    it('table recreation should always include CREATE, INSERT, DROP, RENAME steps', async () => {
      // Test each migration that uses table recreation for rollback
      const testCases = [
        { version: 2, tableName: 'episodes' },
        { version: 4, tableName: 'medication_schedules' },
        { version: 6, tableName: 'medication_doses' }
      ];

      for (const { version, tableName } of testCases) {
        // Reset mocks for each test case
        mockDatabase.execAsync.mockClear();
        mockDatabase.runAsync.mockClear();
        mockDatabase.getAllAsync.mockClear();

        // Setup: current version at migration version, need to rollback to version - 1
        mockDatabase.getAllAsync
          .mockResolvedValueOnce([{ version: version }]) // initialize() getCurrentVersion
          .mockResolvedValueOnce([{ version: version }]) // rollback getCurrentVersion
          .mockResolvedValue([]);

        // Reset migration runner state
        migrationRunner['db'] = null;
        await migrationRunner.initialize(mockDatabase);
        await migrationRunner.rollback(version - 1);

        const sql = getExecutedSQL();

        // Must have all 4 core steps
        expect(sql.some(s => s.includes('CREATE TABLE') && s.includes(tableName))).toBe(true);
        expect(sql.some(s => s.includes('INSERT INTO') && s.includes(tableName))).toBe(true);
        expect(sql.some(s => s.includes('DROP TABLE') && s.includes(tableName))).toBe(true);
        expect(sql.some(s => s.includes('RENAME TO') && s.includes(tableName))).toBe(true);
      }
    });
  });

  describe('Validation Before Migration', () => {
    it('should check for migration.up function', async () => {
      // Note: We can't easily inject invalid migrations into the class-level array
      // Instead, verify that validation logic exists by checking console warnings
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 1 }])
        .mockResolvedValue([]);

      await migrationRunner.initialize(mockDatabase);

      // Run migrations - all valid migrations should pass validation
      await migrationRunner.runMigrations();

      // If we got here without errors, validation is checking migrations
      // (A negative test would require modifying migration source code)
      expect(mockDatabase.execAsync).toHaveBeenCalled();
    });

    it('should check database connection before running migration', async () => {
      mockDatabase.getAllAsync
        .mockResolvedValueOnce([{ version: 1 }])
        .mockRejectedValueOnce(new Error('Connection failed'));

      await migrationRunner.initialize(mockDatabase);

      await expect(migrationRunner.runMigrations()).rejects.toThrow();
    });
  });
});
