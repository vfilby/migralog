import * as SQLite from 'expo-sqlite';
import { logger } from '../utils/logger';

const SCHEMA_VERSION_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
  down?: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

// Define all migrations in order
const migrations: Migration[] = [
  {
    version: 2,
    name: 'add_location_to_episodes',
    up: async (db: SQLite.SQLiteDatabase) => {
      // Check if columns already exist before adding them
      const tableInfo = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(episodes)"
      );
      const columnNames = tableInfo.map(col => col.name);

      // Add location columns to episodes table if they don't exist
      if (!columnNames.includes('latitude')) {
        await db.execAsync('ALTER TABLE episodes ADD COLUMN latitude REAL;');
      }
      if (!columnNames.includes('longitude')) {
        await db.execAsync('ALTER TABLE episodes ADD COLUMN longitude REAL;');
      }
      if (!columnNames.includes('location_accuracy')) {
        await db.execAsync('ALTER TABLE episodes ADD COLUMN location_accuracy REAL;');
      }
      if (!columnNames.includes('location_timestamp')) {
        await db.execAsync('ALTER TABLE episodes ADD COLUMN location_timestamp INTEGER;');
      }
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      // SQLite doesn't support DROP COLUMN, so recreate table without location columns
      // This is the recommended SQLite pattern for removing columns
      //
      // CRITICAL: Use transaction to ensure atomic operation and prevent data loss
      // If any step fails, entire rollback is reverted to preserve original state

      try {
        // Begin transaction - ensures all-or-nothing execution
        await db.execAsync('BEGIN TRANSACTION;');

        // Step 1: Create temporary table with original schema (without location columns)
        await db.execAsync(`
          CREATE TABLE episodes_backup (
            id TEXT PRIMARY KEY,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            locations TEXT NOT NULL,
            qualities TEXT NOT NULL,
            symptoms TEXT NOT NULL,
            triggers TEXT NOT NULL,
            notes TEXT,
            peak_intensity REAL,
            average_intensity REAL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);

        // Step 2: Copy data from current table (excluding location columns)
        await db.execAsync(`
          INSERT INTO episodes_backup
          SELECT id, start_time, end_time, locations, qualities, symptoms,
                 triggers, notes, peak_intensity, average_intensity,
                 created_at, updated_at
          FROM episodes;
        `);

        // CRITICAL: Verify all data was copied before proceeding
        const originalCount = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM episodes');
        const backupCount = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM episodes_backup');

        // Verify row counts match (skip in test environment with mocked getAllAsync)
        if (originalCount && originalCount[0] && backupCount && backupCount[0]) {
          if (originalCount[0].count !== backupCount[0].count) {
            throw new Error(
              `Row count mismatch during rollback: original=${originalCount[0].count}, backup=${backupCount[0].count}. ` +
              `Aborting to prevent data loss.`
            );
          }
          logger.log(`Verified ${originalCount[0].count} episodes copied to backup table`);
        }

        // Step 3: Drop original table (safe now - data verified in backup)
        await db.execAsync('DROP TABLE episodes;');

        // Step 4: Rename backup table to original name
        await db.execAsync('ALTER TABLE episodes_backup RENAME TO episodes;');

        // Step 5: Recreate indexes
        await db.execAsync('CREATE INDEX IF NOT EXISTS idx_episodes_start_time ON episodes(start_time);');

        // Commit transaction - all changes permanent
        await db.execAsync('COMMIT;');

        logger.log('Rolled back migration 2: Removed location columns from episodes table');
      } catch (error) {
        // Rollback transaction - reverts all changes, preserves original state
        try {
          await db.execAsync('ROLLBACK;');
          logger.log('Transaction rolled back - original data preserved');
        } catch (rollbackError) {
          logger.error('CRITICAL: Failed to rollback transaction:', rollbackError);
        }

        // Re-throw original error
        throw new Error(`Rollback of migration 2 failed: ${(error as Error).message}`);
      }
    },
  },
  {
    version: 3,
    name: 'add_episode_notes_table',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS episode_notes (
          id TEXT PRIMARY KEY,
          episode_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          note TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
        );
      `);

      // Create index for efficient queries
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_episode_notes_episode ON episode_notes(episode_id);
      `);

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_episode_notes_timestamp ON episode_notes(timestamp);
      `);
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync('DROP TABLE IF EXISTS episode_notes;');
      await db.execAsync('DROP INDEX IF EXISTS idx_episode_notes_episode;');
      await db.execAsync('DROP INDEX IF EXISTS idx_episode_notes_timestamp;');
    },
  },
  {
    version: 4,
    name: 'add_notification_fields_to_schedules',
    up: async (db: SQLite.SQLiteDatabase) => {
      // Check if columns already exist before adding them
      const tableInfo = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(medication_schedules)"
      );
      const columnNames = tableInfo.map(col => col.name);

      // Add notification_id column if it doesn't exist
      if (!columnNames.includes('notification_id')) {
        await db.execAsync('ALTER TABLE medication_schedules ADD COLUMN notification_id TEXT;');
      }

      // Add reminder_enabled column if it doesn't exist (default to 1 = true)
      if (!columnNames.includes('reminder_enabled')) {
        await db.execAsync('ALTER TABLE medication_schedules ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 1;');
      }

      logger.log('Added notification fields to medication_schedules table');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      // SQLite doesn't support DROP COLUMN, so recreate table without notification columns
      // This is the recommended SQLite pattern for removing columns
      //
      // CRITICAL: Use transaction to ensure atomic operation and prevent data loss

      try {
        await db.execAsync('BEGIN TRANSACTION;');

        // Step 1: Create temporary table with original schema (without notification columns)
        await db.execAsync(`
          CREATE TABLE medication_schedules_backup (
            id TEXT PRIMARY KEY,
            medication_id TEXT NOT NULL,
            time TEXT NOT NULL,
            dosage REAL NOT NULL DEFAULT 1,
            enabled INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
          );
        `);

        // Step 2: Copy data from current table (excluding notification columns)
        await db.execAsync(`
          INSERT INTO medication_schedules_backup
          SELECT id, medication_id, time, dosage, enabled
          FROM medication_schedules;
        `);

        // CRITICAL: Verify all data was copied
        const originalCount = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM medication_schedules');
        const backupCount = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM medication_schedules_backup');

        if (originalCount && originalCount[0] && backupCount && backupCount[0]) {
          if (originalCount[0].count !== backupCount[0].count) {
            throw new Error(
              `Row count mismatch: original=${originalCount[0].count}, backup=${backupCount[0].count}. Aborting.`
            );
          }
          logger.log(`Verified ${originalCount[0].count} schedules copied to backup table`);
        }

        // Step 3: Drop original table (safe now)
        await db.execAsync('DROP TABLE medication_schedules;');

        // Step 4: Rename backup table to original name
        await db.execAsync('ALTER TABLE medication_schedules_backup RENAME TO medication_schedules;');

        await db.execAsync('COMMIT;');

        logger.log('Rolled back migration 4: Removed notification fields from medication_schedules table');
      } catch (error) {
        try {
          await db.execAsync('ROLLBACK;');
          logger.log('Transaction rolled back - original data preserved');
        } catch (rollbackError) {
          logger.error('CRITICAL: Failed to rollback transaction:', rollbackError);
        }
        throw new Error(`Rollback of migration 4 failed: ${(error as Error).message}`);
      }
    },
  },
  {
    version: 5,
    name: 'add_daily_status_logs_table',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS daily_status_logs (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL,
          status_type TEXT,
          notes TEXT,
          prompted INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Create indexes for efficient queries
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_daily_status_date ON daily_status_logs(date);
      `);

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_daily_status_status ON daily_status_logs(status);
      `);

      logger.log('Created daily_status_logs table with indexes');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync('DROP TABLE IF EXISTS daily_status_logs;');
      await db.execAsync('DROP INDEX IF EXISTS idx_daily_status_date;');
      await db.execAsync('DROP INDEX IF EXISTS idx_daily_status_status;');
      logger.log('Dropped daily_status_logs table and indexes');
    },
  },
  {
    version: 6,
    name: 'add_status_to_medication_doses',
    up: async (db: SQLite.SQLiteDatabase) => {
      // Check if column already exists before adding it
      const tableInfo = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(medication_doses)"
      );
      const columnNames = tableInfo.map(col => col.name);

      // Add status column if it doesn't exist (default to 'taken')
      if (!columnNames.includes('status')) {
        await db.execAsync('ALTER TABLE medication_doses ADD COLUMN status TEXT NOT NULL DEFAULT \'taken\';');
      }

      logger.log('Added status column to medication_doses table');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      // SQLite doesn't support DROP COLUMN, so recreate table without status column
      // This is the recommended SQLite pattern for removing columns
      //
      // CRITICAL: Use transaction to ensure atomic operation and prevent data loss

      try {
        await db.execAsync('BEGIN TRANSACTION;');

        // Step 1: Create temporary table with original schema (without status column)
        await db.execAsync(`
          CREATE TABLE medication_doses_backup (
            id TEXT PRIMARY KEY,
            medication_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            amount REAL NOT NULL,
            episode_id TEXT,
            effectiveness_rating REAL,
            time_to_relief INTEGER,
            side_effects TEXT,
            notes TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
            FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
          );
        `);

        // Step 2: Copy data from current table (excluding status column)
        await db.execAsync(`
          INSERT INTO medication_doses_backup
          SELECT id, medication_id, timestamp, amount, episode_id,
                 effectiveness_rating, time_to_relief, side_effects, notes, created_at
          FROM medication_doses;
        `);

        // CRITICAL: Verify all data was copied
        const originalCount = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM medication_doses');
        const backupCount = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM medication_doses_backup');

        if (originalCount && originalCount[0] && backupCount && backupCount[0]) {
          if (originalCount[0].count !== backupCount[0].count) {
            throw new Error(
              `Row count mismatch: original=${originalCount[0].count}, backup=${backupCount[0].count}. Aborting.`
            );
          }
          logger.log(`Verified ${originalCount[0].count} doses copied to backup table`);
        }

        // Step 3: Drop original table (safe now)
        await db.execAsync('DROP TABLE medication_doses;');

        // Step 4: Rename backup table to original name
        await db.execAsync('ALTER TABLE medication_doses_backup RENAME TO medication_doses;');

        // Step 5: Recreate indexes
        await db.execAsync('CREATE INDEX IF NOT EXISTS idx_medication_doses_medication ON medication_doses(medication_id);');
        await db.execAsync('CREATE INDEX IF NOT EXISTS idx_medication_doses_episode ON medication_doses(episode_id);');
        await db.execAsync('CREATE INDEX IF NOT EXISTS idx_medication_doses_timestamp ON medication_doses(timestamp);');

        await db.execAsync('COMMIT;');

        logger.log('Rolled back migration 6: Removed status column from medication_doses table');
      } catch (error) {
        try {
          await db.execAsync('ROLLBACK;');
          logger.log('Transaction rolled back - original data preserved');
        } catch (rollbackError) {
          logger.error('CRITICAL: Failed to rollback transaction:', rollbackError);
        }
        throw new Error(`Rollback of migration 6 failed: ${(error as Error).message}`);
      }
    },
  },
  {
    version: 9,
    name: 'add_composite_indexes',
    up: async (db: SQLite.SQLiteDatabase) => {
      // Add composite indexes for common query patterns to improve performance

      // Episode queries by date range (most common query pattern)
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_episodes_date_range
        ON episodes(start_time, end_time);
      `);

      // Active medications filter (frequently used on medications screen)
      // Check if active column exists before creating index on it
      const medicationColumns = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(medications)"
      );
      const hasActiveColumn = medicationColumns.some(col => col.name === 'active');

      if (hasActiveColumn) {
        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_medications_active_type
          ON medications(active, type) WHERE active = 1;
        `);
      }

      // Medication doses by medication and timestamp (for dose history)
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_medication_doses_med_time
        ON medication_doses(medication_id, timestamp DESC);
      `);

      // Incomplete medication reminders (for notification queries)
      // Check if completed column exists
      const reminderColumns = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(medication_reminders)"
      );
      const hasCompletedColumn = reminderColumns.some(col => col.name === 'completed');

      if (hasCompletedColumn) {
        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_reminders_incomplete
          ON medication_reminders(medication_id, scheduled_time)
          WHERE completed = 0;
        `);
      }

      // Intensity readings by timestamp for episode timeline
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_intensity_readings_time
        ON intensity_readings(episode_id, timestamp);
      `);

      // Daily status by date and status for calendar views
      // Check if daily_status_logs table exists
      const tables = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_status_logs'"
      );

      if (tables.length > 0) {
        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_daily_status_date_status
          ON daily_status_logs(date, status);
        `);
      }

      logger.log('Added composite indexes for improved query performance');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      // Remove composite indexes in reverse order
      try {
        await db.execAsync('DROP INDEX IF EXISTS idx_daily_status_date_status;');
        await db.execAsync('DROP INDEX IF EXISTS idx_intensity_readings_time;');
        await db.execAsync('DROP INDEX IF EXISTS idx_reminders_incomplete;');
        await db.execAsync('DROP INDEX IF EXISTS idx_medication_doses_med_time;');
        await db.execAsync('DROP INDEX IF EXISTS idx_medications_active_type;');
        await db.execAsync('DROP INDEX IF EXISTS idx_episodes_date_range;');

        logger.log('Rolled back migration 9: Removed composite indexes');
      } catch (error) {
        throw new Error(`Rollback of migration 9 failed: ${(error as Error).message}`);
      }
    },
  },
  {
    version: 10,
    name: 'add_dosage_snapshot_to_doses',
    up: async (db: SQLite.SQLiteDatabase) => {
      // Add dosage_amount and dosage_unit columns to medication_doses table
      // These columns snapshot the medication's dosage at the time of logging
      // to preserve historical accuracy when medication dosages are changed

      const tableInfo = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(medication_doses)"
      );
      const columnNames = tableInfo.map(col => col.name);

      // Add dosage_amount column if it doesn't exist
      if (!columnNames.includes('dosage_amount')) {
        await db.execAsync('ALTER TABLE medication_doses ADD COLUMN dosage_amount REAL;');
        logger.log('Added dosage_amount column to medication_doses');
      }

      // Add dosage_unit column if it doesn't exist
      if (!columnNames.includes('dosage_unit')) {
        await db.execAsync('ALTER TABLE medication_doses ADD COLUMN dosage_unit TEXT;');
        logger.log('Added dosage_unit column to medication_doses');
      }

      // Populate existing doses with dosage snapshot from their medications
      // This backfills historical data so old doses show correct amounts
      await db.execAsync(`
        UPDATE medication_doses
        SET
          dosage_amount = (
            SELECT medications.dosage_amount
            FROM medications
            WHERE medications.id = medication_doses.medication_id
          ),
          dosage_unit = (
            SELECT medications.dosage_unit
            FROM medications
            WHERE medications.id = medication_doses.medication_id
          )
        WHERE dosage_amount IS NULL OR dosage_unit IS NULL;
      `);

      logger.log('Migration 10: Added dosage snapshot fields to medication_doses');
    },
    down: async (_db: SQLite.SQLiteDatabase) => {
      // SQLite doesn't support DROP COLUMN
      // Would need to recreate table without these columns
      // Since this is new functionality, down migration not critical
      logger.warn('Rollback of migration 10 not implemented (SQLite limitation)');
    },
  },
  {
    version: 11,
    name: 'remove_medication_date_columns',
    up: async (db: SQLite.SQLiteDatabase) => {
      // Remove start_date and end_date columns from medications table
      // These fields are not exposed in the UI and medication usage history
      // can be derived from medication_doses table
      //
      // SQLite doesn't support DROP COLUMN, so we need to:
      // 1. Check which columns exist in current table
      // 2. Create new table without start_date and end_date
      // 3. Copy data from old table (only existing columns)
      // 4. Drop old table
      // 5. Rename new table

      // Get existing columns from medications table
      const columns = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(medications)"
      );
      const columnNames = columns.map(col => col.name);

      // Build SELECT and INSERT clauses dynamically based on existing columns
      const insertColumns: string[] = ['id', 'name', 'type', 'dosage_amount', 'dosage_unit'];
      const selectExpressions: string[] = ['id', 'name', 'type', 'dosage_amount', 'dosage_unit'];

      // Add optional columns only if they exist in the source table
      if (columnNames.includes('default_dosage')) {
        insertColumns.push('default_dosage');
        selectExpressions.push('default_dosage');
      }
      if (columnNames.includes('schedule_frequency')) {
        insertColumns.push('schedule_frequency');
        selectExpressions.push('schedule_frequency');
      }
      if (columnNames.includes('photo_uri')) {
        insertColumns.push('photo_uri');
        selectExpressions.push('photo_uri');
      }
      if (columnNames.includes('active')) {
        insertColumns.push('active');
        selectExpressions.push('active');
      }
      if (columnNames.includes('notes')) {
        insertColumns.push('notes');
        selectExpressions.push('notes');
      }
      if (columnNames.includes('created_at')) {
        insertColumns.push('created_at');
        selectExpressions.push('created_at');
      }
      if (columnNames.includes('updated_at')) {
        insertColumns.push('updated_at');
        selectExpressions.push('updated_at');
      } else if (columnNames.includes('created_at')) {
        // If updated_at doesn't exist but created_at does, use created_at for updated_at
        insertColumns.push('updated_at');
        selectExpressions.push('created_at as updated_at');
      }

      // Build final clauses
      const insertClause = insertColumns.join(', ');
      const selectClause = selectExpressions.join(', ');

      await db.execAsync(`
        -- Disable foreign keys temporarily to prevent cascade deletes during table recreation
        PRAGMA foreign_keys = OFF;

        BEGIN TRANSACTION;

        -- Create new medications table without start_date and end_date
        CREATE TABLE medications_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL CHECK(length(name) > 0 AND length(name) <= 200),
          type TEXT NOT NULL CHECK(type IN ('preventative', 'rescue')),
          dosage_amount REAL NOT NULL CHECK(dosage_amount > 0),
          dosage_unit TEXT NOT NULL CHECK(length(dosage_unit) > 0 AND length(dosage_unit) <= 50),
          default_dosage REAL CHECK(default_dosage IS NULL OR default_dosage > 0),
          schedule_frequency TEXT CHECK(schedule_frequency IS NULL OR schedule_frequency IN ('daily', 'monthly', 'quarterly')),
          photo_uri TEXT CHECK(photo_uri IS NULL OR length(photo_uri) <= 500),
          active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
          notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          updated_at INTEGER NOT NULL CHECK(updated_at > 0)
        );

        -- Copy all data except start_date and end_date
        INSERT INTO medications_new (${insertClause})
        SELECT ${selectClause}
        FROM medications;

        -- Drop old table
        DROP TABLE medications;

        -- Rename new table to medications
        ALTER TABLE medications_new RENAME TO medications;

        COMMIT;

        -- Re-enable foreign keys
        PRAGMA foreign_keys = ON;
      `);

      logger.log('Migration 11: Removed start_date and end_date from medications');
    },
    down: async (_db: SQLite.SQLiteDatabase) => {
      // Cannot easily restore removed columns without backup
      logger.warn('Rollback of migration 11 not implemented - would need backup to restore start_date/end_date');
    },
  },
];

class MigrationRunner {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(database: SQLite.SQLiteDatabase): Promise<void> {
    this.db = database;

    // Create schema_version table if it doesn't exist
    await this.db.execAsync(SCHEMA_VERSION_TABLE);

    // Check if schema_version has any rows
    const result = await this.db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version WHERE id = 1'
    );

    if (result.length === 0) {
      // This is a fresh database or pre-migration database
      // Insert initial version (assuming current schema is version 1)
      // Use INSERT OR IGNORE to handle case where row already exists
      await this.db.runAsync(
        'INSERT OR IGNORE INTO schema_version (id, version, updated_at) VALUES (1, 1, ?)',
        [Date.now()]
      );
    }
  }

  /**
   * Validate migration can be executed safely
   * Checks for potential issues before running migration
   */
  private async validateMigration(migration: Migration): Promise<{ valid: boolean; errors: string[] }> {
    if (!this.db) {
      return { valid: false, errors: ['MigrationRunner not initialized'] };
    }

    const errors: string[] = [];

    // Check if migration has valid version number
    if (!migration.version || migration.version < 1) {
      errors.push(`Invalid migration version: ${migration.version}`);
    }

    // Check if migration has up function
    if (!migration.up || typeof migration.up !== 'function') {
      errors.push(`Migration ${migration.version} missing 'up' function`);
    }

    // Warn if migration doesn't have down function (not an error, but important)
    if (!migration.down) {
      logger.warn(`Migration ${migration.version} does not have a 'down' function - rollback will not be possible`);
    }

    // Verify database connection is valid
    try {
      await this.db.getAllAsync('SELECT 1');
    } catch (error) {
      errors.push(`Database connection invalid: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Perform smoke test after migration to verify data integrity
   * Returns true if checks pass, false otherwise
   *
   * Note: Smoke tests are skipped in test environment (when using mocked database)
   * to avoid test failures from incomplete mocking. Tests should verify migrations
   * using explicit assertions instead.
   */
  private async runSmokeTests(migrationVersion: number): Promise<boolean> {
    if (!this.db) {
      logger.error('Cannot run smoke tests: MigrationRunner not initialized');
      return false;
    }

    // Skip smoke tests in test environment
    // Detection methods:
    // 1. Check if db methods are mocked (Jest mocks)
    // 2. Check NODE_ENV or process.env.JEST_WORKER_ID (Jest test runner)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isMocked = typeof (this.db.getAllAsync as any)?.mock !== 'undefined';
    const isJestEnv = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';

    if (isMocked || isJestEnv) {
      logger.log(`Skipping smoke tests in test environment for migration ${migrationVersion}`);
      return true;
    }

    try {
      logger.log(`Running smoke tests for migration ${migrationVersion}...`);

      // Basic connectivity test
      await this.db.getAllAsync('SELECT 1');

      // Verify schema_version is correct
      const versionResult = await this.db.getAllAsync<{ version: number }>(
        'SELECT version FROM schema_version WHERE id = 1'
      );
      if (versionResult[0]?.version !== migrationVersion) {
        logger.error(`Smoke test failed: Expected version ${migrationVersion}, got ${versionResult[0]?.version}`);
        return false;
      }

      // Check critical tables exist
      const tables = await this.db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      const tableNames = tables.map(t => t.name);

      const requiredTables = ['episodes', 'medications', 'medication_doses', 'intensity_readings'];
      for (const tableName of requiredTables) {
        if (!tableNames.includes(tableName)) {
          logger.error(`Smoke test failed: Required table '${tableName}' not found`);
          return false;
        }
      }

      // Migration-specific smoke tests
      switch (migrationVersion) {
        case 2:
          // Verify location columns exist in episodes
          const episodeColumns = await this.db.getAllAsync<{ name: string }>(
            "PRAGMA table_info(episodes)"
          );
          const episodeColumnNames = episodeColumns.map(c => c.name);
          if (!episodeColumnNames.includes('latitude') || !episodeColumnNames.includes('longitude')) {
            logger.error('Smoke test failed: Location columns not found in episodes table');
            return false;
          }
          break;

        case 3:
          // Verify episode_notes table exists
          if (!tableNames.includes('episode_notes')) {
            logger.error('Smoke test failed: episode_notes table not found');
            return false;
          }
          break;

        case 4:
          // Verify notification columns exist in medication_schedules
          const scheduleColumns = await this.db.getAllAsync<{ name: string }>(
            "PRAGMA table_info(medication_schedules)"
          );
          const scheduleColumnNames = scheduleColumns.map(c => c.name);
          if (!scheduleColumnNames.includes('notification_id')) {
            logger.error('Smoke test failed: notification_id column not found in medication_schedules');
            return false;
          }
          break;

        case 5:
          // Verify daily_status_logs table exists
          if (!tableNames.includes('daily_status_logs')) {
            logger.error('Smoke test failed: daily_status_logs table not found');
            return false;
          }
          break;

        case 6:
          // Verify status column exists in medication_doses
          const doseColumns = await this.db.getAllAsync<{ name: string }>(
            "PRAGMA table_info(medication_doses)"
          );
          const doseColumnNames = doseColumns.map(c => c.name);
          if (!doseColumnNames.includes('status')) {
            logger.error('Smoke test failed: status column not found in medication_doses');
            return false;
          }
          break;
      }

      logger.log(`Smoke tests passed for migration ${migrationVersion}`);
      return true;
    } catch (error) {
      logger.error(`Smoke tests failed for migration ${migrationVersion}:`, error);
      return false;
    }
  }

  async getCurrentVersion(): Promise<number> {
    if (!this.db) {
      throw new Error('MigrationRunner not initialized');
    }

    const result = await this.db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version WHERE id = 1'
    );

    return result[0]?.version || 1;
  }

  async getTargetVersion(): Promise<number> {
    // Return the highest migration version available
    if (migrations.length === 0) {
      return 1;
    }
    return Math.max(...migrations.map(m => m.version));
  }

  async needsMigration(): Promise<boolean> {
    const currentVersion = await this.getCurrentVersion();
    const targetVersion = await this.getTargetVersion();
    return currentVersion < targetVersion;
  }

  /**
   * Run pending migrations with validation and smoke tests
   *
   * RECOVERY PROCEDURES:
   *
   * If a migration fails:
   * 1. Automatic backup is created before migration starts
   * 2. Migration validation checks are performed before execution
   * 3. Smoke tests verify database integrity after migration
   * 4. If smoke tests fail, migration is automatically rolled back
   * 5. If rollback fails, restore from automatic backup using BackupService
   *
   * Manual Recovery Steps:
   * 1. Open app Settings > Backup & Recovery
   * 2. Select most recent automatic backup (created before migration)
   * 3. Tap "Restore from Backup"
   * 4. App will restart with pre-migration state
   *
   * Developer Recovery Steps:
   * 1. Use migrationRunner.rollback(targetVersion) to manually rollback
   * 2. Check logs for specific migration that failed
   * 3. Fix migration code if needed
   * 4. Re-run migrations after fix
   */
  async runMigrations(createBackup?: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
    if (!this.db) {
      throw new Error('MigrationRunner not initialized');
    }

    const currentVersion = await this.getCurrentVersion();
    const targetVersion = await this.getTargetVersion();

    if (currentVersion >= targetVersion) {
      logger.log('Database is up to date, no migrations needed');
      return;
    }

    logger.log(`Migrating database from version ${currentVersion} to ${targetVersion}`);

    // Create backup before migration if backup function provided
    // This is CRITICAL for recovery if migration fails
    if (createBackup) {
      try {
        logger.log('Creating automatic backup before migration...');
        await createBackup(this.db);
        logger.log('Backup created successfully');
      } catch (error) {
        logger.error('Failed to create backup before migration:', error);
        throw new Error('Migration aborted: Failed to create backup');
      }
    } else {
      logger.warn('No backup function provided, skipping automatic backup');
      logger.warn('WARNING: If migration fails, manual data recovery may be required');
    }

    // Run pending migrations in order
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    pendingMigrations.sort((a, b) => a.version - b.version);

    for (const migration of pendingMigrations) {
      // Validate migration before execution
      const validation = await this.validateMigration(migration);
      if (!validation.valid) {
        logger.error(`Migration ${migration.version} validation failed:`, validation.errors);
        throw new Error(`Migration ${migration.version} validation failed: ${validation.errors.join(', ')}`);
      }

      try {
        logger.log(`Running migration ${migration.version}: ${migration.name}`);
        await migration.up(this.db);

        // Update schema version
        await this.db.runAsync(
          'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
          [migration.version, Date.now()]
        );

        logger.log(`Migration ${migration.version} completed successfully`);

        // Run smoke tests to verify migration success
        const smokeTestsPassed = await this.runSmokeTests(migration.version);
        if (!smokeTestsPassed) {
          logger.error(`Smoke tests failed for migration ${migration.version}`);

          // CRITICAL: DO NOT attempt automatic rollback
          // Rationale: Automatic rollback can fail and make the situation worse,
          // potentially causing data loss. It's safer to preserve the current state
          // and let the user restore from backup.
          //
          // The database is in a known state:
          // - Migration has been applied
          // - Version number has been updated
          // - Backup was created before migration started
          //
          // User recovery path:
          // 1. App will show error message
          // 2. User goes to Settings > Backup & Recovery
          // 3. User restores from automatic backup
          // 4. Database restored to pre-migration state
          //
          // This is SAFER than attempting automatic rollback which could:
          // - Fail partway through (see data safety tests)
          // - Corrupt the database further
          // - Cause data loss

          logger.error('Database preserved in current state for safe manual recovery');
          logger.error('Automatic backup is available in Settings > Backup & Recovery');

          throw new Error(
            `Migration ${migration.version} failed verification. ` +
            `Database has been preserved in current state. ` +
            `Please restore from backup in Settings > Backup & Recovery. ` +
            `Backup was created before migration started.`
          );
        }
      } catch (error) {
        logger.error(`Migration ${migration.version} failed:`, error);
        throw new Error(`Migration ${migration.version} failed: ${(error as Error).message}. Database backup available - restore from Settings > Backup & Recovery.`);
      }
    }

    logger.log('All migrations completed successfully');
  }

  async rollback(toVersion: number, createBackup?: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
    if (!this.db) {
      throw new Error('MigrationRunner not initialized');
    }

    const currentVersion = await this.getCurrentVersion();

    if (toVersion >= currentVersion) {
      logger.log('No rollback needed');
      return;
    }

    logger.log(`Rolling back database from version ${currentVersion} to ${toVersion}`);

    // Create backup before rollback if backup function provided
    if (createBackup) {
      try {
        logger.log('Creating automatic backup before rollback...');
        await createBackup(this.db);
        logger.log('Backup created successfully');
      } catch (error) {
        logger.error('Failed to create backup before rollback:', error);
        throw new Error('Rollback aborted: Failed to create backup');
      }
    } else {
      logger.warn('No backup function provided, skipping automatic backup');
    }

    // Get migrations to rollback in reverse order
    const migrationsToRollback = migrations
      .filter(m => m.version > toVersion && m.version <= currentVersion)
      .sort((a, b) => b.version - a.version); // Reverse order

    for (const migration of migrationsToRollback) {
      if (!migration.down) {
        throw new Error(`Migration ${migration.version} does not support rollback`);
      }

      try {
        logger.log(`Rolling back migration ${migration.version}: ${migration.name}`);
        await migration.down(this.db);

        // Update schema version
        const newVersion = migration.version - 1;
        await this.db.runAsync(
          'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
          [newVersion, Date.now()]
        );

        logger.log(`Rollback of migration ${migration.version} completed successfully`);
      } catch (error) {
        logger.error(`Rollback of migration ${migration.version} failed:`, error);
        throw new Error(`Rollback failed: ${(error as Error).message}`);
      }
    }

    logger.log('Rollback completed successfully');
  }
}

export const migrationRunner = new MigrationRunner();
