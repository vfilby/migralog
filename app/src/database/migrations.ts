import * as SQLite from 'expo-sqlite';

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
      // SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
      // For now, just log that rollback is not supported
      console.warn('Rollback for migration 2 not implemented (SQLite limitation)');
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

      console.log('Added notification fields to medication_schedules table');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      // SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
      console.warn('Rollback for migration 4 not implemented (SQLite limitation)');
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

      console.log('Created daily_status_logs table with indexes');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync('DROP TABLE IF EXISTS daily_status_logs;');
      await db.execAsync('DROP INDEX IF EXISTS idx_daily_status_date;');
      await db.execAsync('DROP INDEX IF EXISTS idx_daily_status_status;');
      console.log('Dropped daily_status_logs table and indexes');
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

      console.log('Added status column to medication_doses table');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      // SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
      console.warn('Rollback for migration 6 not implemented (SQLite limitation)');
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

  async runMigrations(createBackup?: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
    if (!this.db) {
      throw new Error('MigrationRunner not initialized');
    }

    const currentVersion = await this.getCurrentVersion();
    const targetVersion = await this.getTargetVersion();

    if (currentVersion >= targetVersion) {
      console.log('Database is up to date, no migrations needed');
      return;
    }

    console.log(`Migrating database from version ${currentVersion} to ${targetVersion}`);

    // Create backup before migration if backup function provided
    if (createBackup) {
      try {
        console.log('Creating automatic backup before migration...');
        await createBackup(this.db);
        console.log('Backup created successfully');
      } catch (error) {
        console.error('Failed to create backup before migration:', error);
        throw new Error('Migration aborted: Failed to create backup');
      }
    } else {
      console.warn('No backup function provided, skipping automatic backup');
    }

    // Run pending migrations in order
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    pendingMigrations.sort((a, b) => a.version - b.version);

    for (const migration of pendingMigrations) {
      try {
        console.log(`Running migration ${migration.version}: ${migration.name}`);
        await migration.up(this.db);

        // Update schema version
        await this.db.runAsync(
          'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
          [migration.version, Date.now()]
        );

        console.log(`Migration ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error);
        throw new Error(`Migration ${migration.version} failed: ${(error as Error).message}`);
      }
    }

    console.log('All migrations completed successfully');
  }

  async rollback(toVersion: number, createBackup?: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
    if (!this.db) {
      throw new Error('MigrationRunner not initialized');
    }

    const currentVersion = await this.getCurrentVersion();

    if (toVersion >= currentVersion) {
      console.log('No rollback needed');
      return;
    }

    console.log(`Rolling back database from version ${currentVersion} to ${toVersion}`);

    // Create backup before rollback if backup function provided
    if (createBackup) {
      try {
        console.log('Creating automatic backup before rollback...');
        await createBackup(this.db);
        console.log('Backup created successfully');
      } catch (error) {
        console.error('Failed to create backup before rollback:', error);
        throw new Error('Rollback aborted: Failed to create backup');
      }
    } else {
      console.warn('No backup function provided, skipping automatic backup');
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
        console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
        await migration.down(this.db);

        // Update schema version
        const newVersion = migration.version - 1;
        await this.db.runAsync(
          'UPDATE schema_version SET version = ?, updated_at = ? WHERE id = 1',
          [newVersion, Date.now()]
        );

        console.log(`Rollback of migration ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`Rollback of migration ${migration.version} failed:`, error);
        throw new Error(`Rollback failed: ${(error as Error).message}`);
      }
    }

    console.log('Rollback completed successfully');
  }
}

export const migrationRunner = new MigrationRunner();
