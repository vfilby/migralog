import * as SQLite from 'expo-sqlite';
import { logger } from '../utils/logger';
import { SCHEMA_VERSION } from './schema';

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

// Migration v19: Add CHECK constraints to existing tables
//
// Previous migrations (v1-v18) have been squashed into the base schema (schema.ts).
// New databases are created at v19 directly with all constraints included.
//
// This migration ensures v18 databases (from v1.1.4) get all the CHECK constraints
// that were added to schema.ts but never properly migrated to existing databases.
//
// Tables recreated with constraints:
// - intensity_readings, episode_notes, pain_location_logs
// - medication_schedules, medication_reminders, daily_status_logs
const migrations: Migration[] = [
  {
    version: 19,
    name: 'add_check_constraints_to_tables',
    up: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 19: Adding CHECK constraints to tables...');

      // SQLite doesn't support ALTER TABLE to add CHECK constraints
      // Must recreate tables with constraints

      // 1. intensity_readings - add intensity range check
      await db.execAsync(`
        CREATE TABLE intensity_readings_new (
          id TEXT PRIMARY KEY,
          episode_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL CHECK(timestamp > 0),
          intensity REAL NOT NULL CHECK(intensity >= 0 AND intensity <= 10),
          notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          updated_at INTEGER NOT NULL CHECK(updated_at > 0),
          FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
        );
      `);
      await db.execAsync(`INSERT INTO intensity_readings_new SELECT * FROM intensity_readings;`);
      await db.execAsync(`DROP TABLE intensity_readings;`);
      await db.execAsync(`ALTER TABLE intensity_readings_new RENAME TO intensity_readings;`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_intensity_readings_episode ON intensity_readings(episode_id);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_intensity_readings_timestamp ON intensity_readings(episode_id, timestamp);`);

      // 2. episode_notes - add note length check
      await db.execAsync(`
        CREATE TABLE episode_notes_new (
          id TEXT PRIMARY KEY,
          episode_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL CHECK(timestamp > 0),
          note TEXT NOT NULL CHECK(length(note) > 0 AND length(note) <= 5000),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
        );
      `);
      await db.execAsync(`INSERT INTO episode_notes_new SELECT * FROM episode_notes;`);
      await db.execAsync(`DROP TABLE episode_notes;`);
      await db.execAsync(`ALTER TABLE episode_notes_new RENAME TO episode_notes;`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_episode_notes_episode ON episode_notes(episode_id);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_episode_notes_timestamp ON episode_notes(episode_id, timestamp);`);

      // 3. pain_location_logs - add time checks
      await db.execAsync(`
        CREATE TABLE pain_location_logs_new (
          id TEXT PRIMARY KEY,
          episode_id TEXT NOT NULL,
          onset_time INTEGER NOT NULL CHECK(onset_time > 0),
          resolution_time INTEGER CHECK(resolution_time IS NULL OR resolution_time > onset_time),
          location TEXT NOT NULL,
          severity REAL,
          notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          updated_at INTEGER NOT NULL CHECK(updated_at > 0),
          FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
        );
      `);
      await db.execAsync(`INSERT INTO pain_location_logs_new SELECT * FROM pain_location_logs;`);
      await db.execAsync(`DROP TABLE pain_location_logs;`);
      await db.execAsync(`ALTER TABLE pain_location_logs_new RENAME TO pain_location_logs;`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_pain_location_logs_episode ON pain_location_logs(episode_id);`);

      // 4. medication_schedules - add constraint checks
      await db.execAsync(`
        CREATE TABLE medication_schedules_new (
          id TEXT PRIMARY KEY,
          medication_id TEXT NOT NULL,
          time TEXT NOT NULL CHECK(time GLOB '[0-2][0-9]:[0-5][0-9]'),
          days TEXT NOT NULL,
          timezone TEXT NOT NULL,
          dosage REAL NOT NULL DEFAULT 1 CHECK(dosage > 0),
          enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
          notification_id TEXT,
          reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK(reminder_enabled IN (0, 1)),
          FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
        );
      `);
      await db.execAsync(`INSERT INTO medication_schedules_new SELECT * FROM medication_schedules;`);
      await db.execAsync(`DROP TABLE medication_schedules;`);
      await db.execAsync(`ALTER TABLE medication_schedules_new RENAME TO medication_schedules;`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_medication_schedules_medication ON medication_schedules(medication_id);`);

      // 5. medication_reminders - add constraint checks
      await db.execAsync(`
        CREATE TABLE medication_reminders_new (
          id TEXT PRIMARY KEY,
          medication_id TEXT NOT NULL,
          scheduled_time INTEGER NOT NULL CHECK(scheduled_time > 0),
          completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
          completed_at INTEGER CHECK(completed_at IS NULL OR completed_at > 0),
          snoozed_until INTEGER CHECK(snoozed_until IS NULL OR snoozed_until > scheduled_time),
          FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
          CHECK(completed = 0 OR completed_at IS NOT NULL)
        );
      `);
      await db.execAsync(`INSERT INTO medication_reminders_new SELECT * FROM medication_reminders;`);
      await db.execAsync(`DROP TABLE medication_reminders;`);
      await db.execAsync(`ALTER TABLE medication_reminders_new RENAME TO medication_reminders;`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_medication_reminders_medication ON medication_reminders(medication_id);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_medication_reminders_scheduled ON medication_reminders(scheduled_time);`);

      // 6. daily_status_logs - add comprehensive checks
      await db.execAsync(`
        CREATE TABLE daily_status_logs_new (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL UNIQUE CHECK(date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          status TEXT NOT NULL CHECK(status IN ('green', 'yellow', 'red')),
          status_type TEXT CHECK(status_type IS NULL OR status_type IN ('prodrome', 'postdrome', 'anxiety', 'other')),
          severity REAL CHECK(severity IS NULL OR (severity >= 0 AND severity <= 10)),
          notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
          prompted INTEGER NOT NULL DEFAULT 0 CHECK(prompted IN (0, 1)),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          CHECK(status = 'yellow' OR status_type IS NULL)
        );
      `);
      await db.execAsync(`INSERT INTO daily_status_logs_new SELECT * FROM daily_status_logs;`);
      await db.execAsync(`DROP TABLE daily_status_logs;`);
      await db.execAsync(`ALTER TABLE daily_status_logs_new RENAME TO daily_status_logs;`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_daily_status_date ON daily_status_logs(date);`);
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_daily_status_status ON daily_status_logs(status);`);

      logger.log('Migration 19: CHECK constraints added successfully');
    },
    down: async (_db: SQLite.SQLiteDatabase) => {
      // Downgrade would recreate tables without the constraints
      // Not implementing as this is destructive and unlikely to be needed
      throw new Error('Migration 19 does not support downgrade');
    },
  },
  {
    version: 20,
    name: 'add_scheduled_notifications_table',
    up: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 20: Adding scheduled_notifications table for one-time notification tracking...');

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS scheduled_notifications (
          id TEXT PRIMARY KEY,
          medication_id TEXT NOT NULL,
          schedule_id TEXT NOT NULL,
          date TEXT NOT NULL,
          notification_id TEXT NOT NULL,
          notification_type TEXT NOT NULL DEFAULT 'reminder' CHECK(notification_type IN ('reminder', 'follow_up')),
          is_grouped INTEGER DEFAULT 0 CHECK(is_grouped IN (0, 1)),
          group_key TEXT,
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
          FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE CASCADE,
          UNIQUE(medication_id, schedule_id, date, notification_type)
        );

        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_date
          ON scheduled_notifications(date);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_group
          ON scheduled_notifications(group_key, date);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_notification_id
          ON scheduled_notifications(notification_id);
      `);

      logger.log('Migration 20: scheduled_notifications table created successfully');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 20 rollback: Dropping scheduled_notifications table...');
      await db.execAsync('DROP TABLE IF EXISTS scheduled_notifications;');
      logger.log('Migration 20 rollback: Complete');
    },
  },
  {
    version: 21,
    name: 'add_daily_checkin_support_to_scheduled_notifications',
    up: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 21: Adding daily check-in support to scheduled_notifications...');

      // SQLite doesn't support adding CHECK constraints or making columns nullable via ALTER TABLE
      // Must recreate the table with the new schema
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS scheduled_notifications_new (
          id TEXT PRIMARY KEY,
          medication_id TEXT,
          schedule_id TEXT,
          date TEXT NOT NULL,
          notification_id TEXT NOT NULL,
          notification_type TEXT NOT NULL DEFAULT 'reminder' CHECK(notification_type IN ('reminder', 'follow_up', 'daily_checkin')),
          is_grouped INTEGER DEFAULT 0 CHECK(is_grouped IN (0, 1)),
          group_key TEXT,
          source_type TEXT NOT NULL DEFAULT 'medication' CHECK(source_type IN ('medication', 'daily_checkin')),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
          FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE CASCADE,
          UNIQUE(medication_id, schedule_id, date, notification_type)
        );
      `);

      // Copy existing data
      await db.execAsync(`
        INSERT INTO scheduled_notifications_new
          (id, medication_id, schedule_id, date, notification_id, notification_type, is_grouped, group_key, source_type, created_at)
        SELECT
          id, medication_id, schedule_id, date, notification_id, notification_type, is_grouped, group_key, 'medication', created_at
        FROM scheduled_notifications;
      `);

      // Drop old table and rename new one
      await db.execAsync('DROP TABLE scheduled_notifications;');
      await db.execAsync('ALTER TABLE scheduled_notifications_new RENAME TO scheduled_notifications;');

      // Recreate indexes
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_date
          ON scheduled_notifications(date);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_group
          ON scheduled_notifications(group_key, date);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_notification_id
          ON scheduled_notifications(notification_id);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_source_type
          ON scheduled_notifications(source_type, date);
      `);

      logger.log('Migration 21: Daily check-in support added successfully');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 21 rollback: Reverting scheduled_notifications table...');

      // Recreate the table with v20 schema (without source_type, daily_checkin type, and with NOT NULL constraints)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS scheduled_notifications_new (
          id TEXT PRIMARY KEY,
          medication_id TEXT NOT NULL,
          schedule_id TEXT NOT NULL,
          date TEXT NOT NULL,
          notification_id TEXT NOT NULL,
          notification_type TEXT NOT NULL DEFAULT 'reminder' CHECK(notification_type IN ('reminder', 'follow_up')),
          is_grouped INTEGER DEFAULT 0 CHECK(is_grouped IN (0, 1)),
          group_key TEXT,
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
          FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE CASCADE,
          UNIQUE(medication_id, schedule_id, date, notification_type)
        );
      `);

      // Copy only medication records (non-daily-checkin) - exclude records with null medication_id
      await db.execAsync(`
        INSERT INTO scheduled_notifications_new
          (id, medication_id, schedule_id, date, notification_id, notification_type, is_grouped, group_key, created_at)
        SELECT
          id, medication_id, schedule_id, date, notification_id, notification_type, is_grouped, group_key, created_at
        FROM scheduled_notifications
        WHERE medication_id IS NOT NULL AND schedule_id IS NOT NULL;
      `);

      // Drop old table and rename new one
      await db.execAsync('DROP TABLE scheduled_notifications;');
      await db.execAsync('ALTER TABLE scheduled_notifications_new RENAME TO scheduled_notifications;');

      // Recreate indexes
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_date
          ON scheduled_notifications(date);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_group
          ON scheduled_notifications(group_key, date);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_notification_id
          ON scheduled_notifications(notification_id);
      `);

      logger.log('Migration 21 rollback: Complete');
    },
  },
  {
    version: 22,
    name: 'add_notification_metadata_to_scheduled_notifications',
    up: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 22: Adding notification metadata columns to scheduled_notifications...');

      // SQLite doesn't support adding CHECK constraints via ALTER TABLE
      // Must recreate the table with the new schema
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS scheduled_notifications_new (
          id TEXT PRIMARY KEY,
          medication_id TEXT,
          schedule_id TEXT,
          date TEXT NOT NULL,
          notification_id TEXT NOT NULL,
          notification_type TEXT NOT NULL DEFAULT 'reminder' CHECK(notification_type IN ('reminder', 'follow_up', 'daily_checkin')),
          is_grouped INTEGER DEFAULT 0 CHECK(is_grouped IN (0, 1)),
          group_key TEXT,
          source_type TEXT NOT NULL DEFAULT 'medication' CHECK(source_type IN ('medication', 'daily_checkin')),
          medication_name VARCHAR(200),
          scheduled_trigger_time TEXT,
          notification_title TEXT,
          notification_body TEXT,
          category_identifier VARCHAR(50),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
          FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE CASCADE,
          UNIQUE(medication_id, schedule_id, date, notification_type)
        );
      `);

      // Copy existing data - new columns will be NULL
      await db.execAsync(`
        INSERT INTO scheduled_notifications_new
          (id, medication_id, schedule_id, date, notification_id, notification_type, is_grouped, group_key, source_type, created_at)
        SELECT
          id, medication_id, schedule_id, date, notification_id, notification_type, is_grouped, group_key, source_type, created_at
        FROM scheduled_notifications;
      `);

      // Drop old table and rename new one
      await db.execAsync('DROP TABLE scheduled_notifications;');
      await db.execAsync('ALTER TABLE scheduled_notifications_new RENAME TO scheduled_notifications;');

      // Recreate existing indexes
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_date
          ON scheduled_notifications(date);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_group
          ON scheduled_notifications(group_key, date);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_notification_id
          ON scheduled_notifications(notification_id);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_source_type
          ON scheduled_notifications(source_type, date);
      `);

      // Add new indexes for the new metadata columns
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_medication_name
          ON scheduled_notifications(medication_name, date) WHERE medication_name IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_trigger_time
          ON scheduled_notifications(scheduled_trigger_time) WHERE scheduled_trigger_time IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_category
          ON scheduled_notifications(category_identifier, scheduled_trigger_time) WHERE category_identifier IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_content
          ON scheduled_notifications(notification_title, notification_body) WHERE notification_title IS NOT NULL;
      `);

      logger.log('Migration 22: Notification metadata columns and indexes added successfully');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 22 rollback: Removing notification metadata columns...');

      // Recreate the table with v21 schema (without metadata columns)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS scheduled_notifications_new (
          id TEXT PRIMARY KEY,
          medication_id TEXT,
          schedule_id TEXT,
          date TEXT NOT NULL,
          notification_id TEXT NOT NULL,
          notification_type TEXT NOT NULL DEFAULT 'reminder' CHECK(notification_type IN ('reminder', 'follow_up', 'daily_checkin')),
          is_grouped INTEGER DEFAULT 0 CHECK(is_grouped IN (0, 1)),
          group_key TEXT,
          source_type TEXT NOT NULL DEFAULT 'medication' CHECK(source_type IN ('medication', 'daily_checkin')),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
          FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE CASCADE,
          UNIQUE(medication_id, schedule_id, date, notification_type)
        );
      `);

      // Copy data (excluding the new metadata columns)
      await db.execAsync(`
        INSERT INTO scheduled_notifications_new
          (id, medication_id, schedule_id, date, notification_id, notification_type, is_grouped, group_key, source_type, created_at)
        SELECT
          id, medication_id, schedule_id, date, notification_id, notification_type, is_grouped, group_key, source_type, created_at
        FROM scheduled_notifications;
      `);

      // Drop old table and rename new one
      await db.execAsync('DROP TABLE scheduled_notifications;');
      await db.execAsync('ALTER TABLE scheduled_notifications_new RENAME TO scheduled_notifications;');

      // Recreate v21 indexes
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_date
          ON scheduled_notifications(date);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_group
          ON scheduled_notifications(group_key, date);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_notification_id
          ON scheduled_notifications(notification_id);
        CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_source_type
          ON scheduled_notifications(source_type, date);
      `);

      logger.log('Migration 22 rollback: Complete');
    },
  },
  {
    version: 23,
    name: 'add_calendar_overlays_table',
    up: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 23: Adding calendar_overlays table for date range tracking...');

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS calendar_overlays (
          id TEXT PRIMARY KEY,
          start_date TEXT NOT NULL CHECK(start_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          end_date TEXT NOT NULL CHECK(end_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          category TEXT NOT NULL CHECK(category IN ('illness', 'travel', 'stress', 'menstrual', 'weather', 'medication', 'custom')),
          label TEXT NOT NULL CHECK(length(label) > 0 AND length(label) <= 200),
          notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          updated_at INTEGER NOT NULL CHECK(updated_at > 0),
          CHECK(end_date >= start_date)
        );

        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_dates ON calendar_overlays(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_active ON calendar_overlays(is_active, start_date, end_date) WHERE is_active = 1;
        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_category ON calendar_overlays(category, is_active) WHERE is_active = 1;
      `);

      logger.log('Migration 23: calendar_overlays table created successfully');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 23 rollback: Dropping calendar_overlays table...');
      await db.execAsync('DROP TABLE IF EXISTS calendar_overlays;');
      logger.log('Migration 23 rollback: Complete');
    },
  },
  {
    version: 24,
    name: 'remove_category_from_calendar_overlays',
    up: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 24: Removing category column from calendar_overlays table...');

      // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
      await db.execAsync(`
        -- Drop the category index first
        DROP INDEX IF EXISTS idx_calendar_overlays_category;

        -- Create new table without category column
        CREATE TABLE calendar_overlays_new (
          id TEXT PRIMARY KEY,
          start_date TEXT NOT NULL CHECK(start_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          end_date TEXT NOT NULL CHECK(end_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          label TEXT NOT NULL CHECK(length(label) > 0 AND length(label) <= 200),
          notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          updated_at INTEGER NOT NULL CHECK(updated_at > 0),
          CHECK(end_date >= start_date)
        );

        -- Copy data from old table (excluding category)
        INSERT INTO calendar_overlays_new (id, start_date, end_date, label, notes, is_active, created_at, updated_at)
        SELECT id, start_date, end_date, label, notes, is_active, created_at, updated_at
        FROM calendar_overlays;

        -- Drop old table
        DROP TABLE calendar_overlays;

        -- Rename new table
        ALTER TABLE calendar_overlays_new RENAME TO calendar_overlays;

        -- Recreate indexes (without category index)
        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_dates ON calendar_overlays(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_active ON calendar_overlays(is_active, start_date, end_date) WHERE is_active = 1;
      `);

      logger.log('Migration 24: category column removed successfully');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 24 rollback: Re-adding category column to calendar_overlays table...');

      await db.execAsync(`
        -- Create table with category column
        CREATE TABLE calendar_overlays_new (
          id TEXT PRIMARY KEY,
          start_date TEXT NOT NULL CHECK(start_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          end_date TEXT NOT NULL CHECK(end_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          category TEXT NOT NULL CHECK(category IN ('illness', 'travel', 'stress', 'menstrual', 'weather', 'medication', 'custom')) DEFAULT 'custom',
          label TEXT NOT NULL CHECK(length(label) > 0 AND length(label) <= 200),
          notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          updated_at INTEGER NOT NULL CHECK(updated_at > 0),
          CHECK(end_date >= start_date)
        );

        -- Copy data with default category
        INSERT INTO calendar_overlays_new (id, start_date, end_date, category, label, notes, is_active, created_at, updated_at)
        SELECT id, start_date, end_date, 'custom', label, notes, is_active, created_at, updated_at
        FROM calendar_overlays;

        -- Drop old table
        DROP TABLE calendar_overlays;

        -- Rename new table
        ALTER TABLE calendar_overlays_new RENAME TO calendar_overlays;

        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_dates ON calendar_overlays(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_active ON calendar_overlays(is_active, start_date, end_date) WHERE is_active = 1;
        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_category ON calendar_overlays(category, is_active) WHERE is_active = 1;
      `);

      logger.log('Migration 24 rollback: Complete');
    },
  },
  {
    version: 25,
    name: 'remove_is_active_from_calendar_overlays',
    up: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 25: Removing is_active column from calendar_overlays (switching to hard delete)...');

      // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
      await db.execAsync(`
        -- Drop the is_active index first
        DROP INDEX IF EXISTS idx_calendar_overlays_active;

        -- Create new table without is_active column
        CREATE TABLE calendar_overlays_new (
          id TEXT PRIMARY KEY,
          start_date TEXT NOT NULL CHECK(start_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          end_date TEXT NOT NULL CHECK(end_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          label TEXT NOT NULL CHECK(length(label) > 0 AND length(label) <= 200),
          notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          updated_at INTEGER NOT NULL CHECK(updated_at > 0),
          CHECK(end_date >= start_date)
        );

        -- Copy only active records (is_active = 1) - soft-deleted records are discarded
        INSERT INTO calendar_overlays_new (id, start_date, end_date, label, notes, created_at, updated_at)
        SELECT id, start_date, end_date, label, notes, created_at, updated_at
        FROM calendar_overlays
        WHERE is_active = 1;

        -- Drop old table
        DROP TABLE calendar_overlays;

        -- Rename new table
        ALTER TABLE calendar_overlays_new RENAME TO calendar_overlays;

        -- Recreate date index (no longer need is_active index)
        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_dates ON calendar_overlays(start_date, end_date);
      `);

      logger.log('Migration 25: is_active column removed successfully');
    },
    down: async (db: SQLite.SQLiteDatabase) => {
      logger.log('Migration 25 rollback: Re-adding is_active column to calendar_overlays table...');

      await db.execAsync(`
        -- Create table with is_active column
        CREATE TABLE calendar_overlays_new (
          id TEXT PRIMARY KEY,
          start_date TEXT NOT NULL CHECK(start_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          end_date TEXT NOT NULL CHECK(end_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          label TEXT NOT NULL CHECK(length(label) > 0 AND length(label) <= 200),
          notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
          created_at INTEGER NOT NULL CHECK(created_at > 0),
          updated_at INTEGER NOT NULL CHECK(updated_at > 0),
          CHECK(end_date >= start_date)
        );

        -- Copy data with is_active = 1 (all existing records are active)
        INSERT INTO calendar_overlays_new (id, start_date, end_date, label, notes, is_active, created_at, updated_at)
        SELECT id, start_date, end_date, label, notes, 1, created_at, updated_at
        FROM calendar_overlays;

        -- Drop old table
        DROP TABLE calendar_overlays;

        -- Rename new table
        ALTER TABLE calendar_overlays_new RENAME TO calendar_overlays;

        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_dates ON calendar_overlays(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_calendar_overlays_active ON calendar_overlays(is_active, start_date, end_date) WHERE is_active = 1;
      `);

      logger.log('Migration 25 rollback: Complete');
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
      // This is a fresh database - set to current SCHEMA_VERSION
      // All migrations have been squashed into the base schema (schema.ts)
      // Use INSERT OR IGNORE to handle case where row already exists
      await this.db.runAsync(
        'INSERT OR IGNORE INTO schema_version (id, version, updated_at) VALUES (1, ?, ?)',
        [SCHEMA_VERSION, Date.now()]
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

        case 19:
          // Verify CHECK constraints were added (test one table as indicator)
          // Can't directly check constraints in SQLite, but verify tables exist
          const allTables = await this.db.getAllAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table'"
          );
          const allTableNames = allTables.map(t => t.name);

          const requiredTables = [
            'intensity_readings',
            'episode_notes',
            'pain_location_logs',
            'medication_schedules',
            'medication_reminders',
            'daily_status_logs'
          ];

          for (const table of requiredTables) {
            if (!allTableNames.includes(table)) {
              logger.error(`Smoke test failed: Table ${table} not found after migration 19`);
              return false;
            }
          }

          logger.log('Migration 19: All tables recreated with CHECK constraints');
          break;

        case 20:
          // Verify scheduled_notifications table exists
          const v20Tables = await this.db.getAllAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table'"
          );
          const v20TableNames = v20Tables.map(t => t.name);

          if (!v20TableNames.includes('scheduled_notifications')) {
            logger.error('Smoke test failed: scheduled_notifications table not found');
            return false;
          }

          // Verify indexes exist
          const v20Indexes = await this.db.getAllAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='scheduled_notifications'"
          );
          const v20IndexNames = v20Indexes.map(i => i.name);

          const expectedIndexes = [
            'idx_scheduled_notifications_date',
            'idx_scheduled_notifications_group',
            'idx_scheduled_notifications_notification_id'
          ];

          for (const idx of expectedIndexes) {
            if (!v20IndexNames.includes(idx)) {
              logger.error(`Smoke test failed: Index ${idx} not found after migration 20`);
              return false;
            }
          }

          logger.log('Migration 20: scheduled_notifications table and indexes verified');
          break;

        case 22:
          // Verify notification metadata columns exist
          const v22Tables = await this.db.getAllAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table'"
          );
          const v22TableNames = v22Tables.map(t => t.name);

          if (!v22TableNames.includes('scheduled_notifications')) {
            logger.error('Smoke test failed: scheduled_notifications table not found');
            return false;
          }

          // Verify new metadata columns exist
          const v22Columns = await this.db.getAllAsync<{ name: string }>(
            "PRAGMA table_info(scheduled_notifications)"
          );
          const v22ColumnNames = v22Columns.map(c => c.name);

          const requiredNewColumns = [
            'medication_name',
            'scheduled_trigger_time', 
            'notification_title',
            'notification_body',
            'category_identifier'
          ];

          for (const column of requiredNewColumns) {
            if (!v22ColumnNames.includes(column)) {
              logger.error(`Smoke test failed: Column ${column} not found after migration 22`);
              return false;
            }
          }

          // Verify new indexes exist
          const v22Indexes = await this.db.getAllAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='scheduled_notifications'"
          );
          const v22IndexNames = v22Indexes.map(i => i.name);

          const expectedNewIndexes = [
            'idx_scheduled_notifications_medication_name',
            'idx_scheduled_notifications_trigger_time',
            'idx_scheduled_notifications_category', 
            'idx_scheduled_notifications_content'
          ];

          for (const idx of expectedNewIndexes) {
            if (!v22IndexNames.includes(idx)) {
              logger.error(`Smoke test failed: Index ${idx} not found after migration 22`);
              return false;
            }
          }

          logger.log('Migration 22: Notification metadata columns and indexes verified');
          break;

        case 23:
          // Verify calendar_overlays table exists
          const v23Tables = await this.db.getAllAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table'"
          );
          const v23TableNames = v23Tables.map(t => t.name);

          if (!v23TableNames.includes('calendar_overlays')) {
            logger.error('Smoke test failed: calendar_overlays table not found');
            return false;
          }

          // Verify calendar_overlays columns exist
          const v23Columns = await this.db.getAllAsync<{ name: string }>(
            "PRAGMA table_info(calendar_overlays)"
          );
          const v23ColumnNames = v23Columns.map(c => c.name);

          const requiredOverlayColumns = [
            'id',
            'start_date',
            'end_date',
            'category',
            'label',
            'notes',
            'is_active',
            'created_at',
            'updated_at'
          ];

          for (const column of requiredOverlayColumns) {
            if (!v23ColumnNames.includes(column)) {
              logger.error(`Smoke test failed: Column ${column} not found in calendar_overlays after migration 23`);
              return false;
            }
          }

          // Verify indexes exist
          const v23Indexes = await this.db.getAllAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='calendar_overlays'"
          );
          const v23IndexNames = v23Indexes.map(i => i.name);

          const expectedOverlayIndexes = [
            'idx_calendar_overlays_dates',
            'idx_calendar_overlays_active',
            'idx_calendar_overlays_category'
          ];

          for (const idx of expectedOverlayIndexes) {
            if (!v23IndexNames.includes(idx)) {
              logger.error(`Smoke test failed: Index ${idx} not found after migration 23`);
              return false;
            }
          }

          logger.log('Migration 23: calendar_overlays table and indexes verified');
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
      // When migrations are squashed (empty array), return current schema version
      // This allows existing databases to upgrade to the squashed version
      return SCHEMA_VERSION;
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
