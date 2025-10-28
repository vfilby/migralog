/**
 * Database Schema Validation Tests
 *
 * Tests that verify the database schema definition includes proper constraints,
 * indexes, and data integrity rules.
 */

import { createTables, SCHEMA_VERSION } from '../schema';

/**
 * Helper function to extract individual table definitions from the schema
 */
function parseTableDefinitions(schema: string): Map<string, string> {
  const tables = new Map<string, string>();
  const tableRegex = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\);/g;

  let match;
  while ((match = tableRegex.exec(schema)) !== null) {
    const tableName = match[1];
    const tableDefinition = match[2];
    tables.set(tableName, tableDefinition);
  }

  return tables;
}

describe('Database Schema', () => {
  let tables: Map<string, string>;

  beforeAll(() => {
    tables = parseTableDefinitions(createTables);
  });
  describe('Schema Version', () => {
    it('should be at version 18', () => {
      expect(SCHEMA_VERSION).toBe(18);
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should define CASCADE DELETE for intensity_readings', () => {
      expect(createTables).toContain('FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE');
    });

    it('should define CASCADE DELETE for symptom_logs', () => {
      expect(createTables).toMatch(/symptom_logs.*FOREIGN KEY \(episode_id\) REFERENCES episodes\(id\) ON DELETE CASCADE/s);
    });

    it('should define CASCADE DELETE for medication_doses from medications', () => {
      expect(createTables).toMatch(/medication_doses.*FOREIGN KEY \(medication_id\) REFERENCES medications\(id\) ON DELETE CASCADE/s);
    });

    it('should define SET NULL for medication_doses episode_id', () => {
      expect(createTables).toMatch(/FOREIGN KEY \(episode_id\) REFERENCES episodes\(id\) ON DELETE SET NULL/);
    });
  });

  describe('CHECK Constraints', () => {
    describe('episodes table', () => {
      it('should enforce start_time > 0', () => {
        const episodesTable = tables.get('episodes');
        expect(episodesTable).toContain('CHECK(start_time > 0)');
      });

      it('should enforce end_time > start_time', () => {
        const episodesTable = tables.get('episodes');
        expect(episodesTable).toContain('CHECK(end_time IS NULL OR end_time > start_time)');
      });



      it('should enforce notes length <= 5000', () => {
        const episodesTable = tables.get('episodes');
        expect(episodesTable).toContain('CHECK(length(notes) <= 5000)');
      });

      it('should enforce created_at > 0', () => {
        const episodesTable = tables.get('episodes');
        expect(episodesTable).toContain('CHECK(created_at > 0)');
      });

      it('should enforce updated_at > 0', () => {
        const episodesTable = tables.get('episodes');
        expect(episodesTable).toContain('CHECK(updated_at > 0)');
      });
    });

    describe('intensity_readings table', () => {
      it('should enforce timestamp > 0', () => {
        const table = tables.get('intensity_readings');
        expect(table).toContain('CHECK(timestamp > 0)');
      });

      it('should enforce intensity between 0 and 10', () => {
        const table = tables.get('intensity_readings');
        expect(table).toContain('CHECK(intensity >= 0 AND intensity <= 10)');
      });

      it('should enforce created_at > 0', () => {
        const table = tables.get('intensity_readings');
        expect(table).toContain('CHECK(created_at > 0)');
      });
    });

    describe('symptom_logs table', () => {
      it('should enforce onset_time > 0', () => {
        const table = tables.get('symptom_logs');
        expect(table).toContain('CHECK(onset_time > 0)');
      });

      it('should enforce resolution_time > onset_time', () => {
        const table = tables.get('symptom_logs');
        expect(table).toContain('CHECK(resolution_time IS NULL OR resolution_time > onset_time)');
      });

      it('should enforce severity between 0 and 10', () => {
        const table = tables.get('symptom_logs');
        expect(table).toContain('CHECK(severity IS NULL OR (severity >= 0 AND severity <= 10))');
      });

      it('should enforce created_at > 0', () => {
        const table = tables.get('symptom_logs');
        expect(table).toContain('CHECK(created_at > 0)');
      });
    });

    describe('pain_location_logs table', () => {
      it('should enforce timestamp > 0', () => {
        const table = tables.get('pain_location_logs');
        expect(table).toContain('CHECK(timestamp > 0)');
      });

      it('should enforce created_at > 0', () => {
        const table = tables.get('pain_location_logs');
        expect(table).toContain('CHECK(created_at > 0)');
      });
    });

    describe('medications table', () => {
      it('should enforce name length between 1 and 200', () => {
        const table = tables.get('medications');
        expect(table).toContain('CHECK(length(name) > 0 AND length(name) <= 200)');
      });

      it('should enforce type IN (preventative, rescue, other)', () => {
        const table = tables.get('medications');
        expect(table).toContain("CHECK(type IN ('preventative', 'rescue', 'other'))");
      });

      it('should enforce dosage_amount > 0', () => {
        const table = tables.get('medications');
        expect(table).toContain('CHECK(dosage_amount > 0)');
      });

      it('should enforce dosage_unit length between 1 and 50', () => {
        const table = tables.get('medications');
        expect(table).toContain('CHECK(length(dosage_unit) > 0 AND length(dosage_unit) <= 50)');
      });

      it('should enforce default_quantity > 0 when not null', () => {
        const table = tables.get('medications');
        expect(table).toContain('CHECK(default_quantity IS NULL OR default_quantity > 0)');
      });

      it('should enforce schedule_frequency IN (daily, monthly, quarterly)', () => {
        const table = tables.get('medications');
        expect(table).toContain("CHECK(schedule_frequency IS NULL OR schedule_frequency IN ('daily', 'monthly', 'quarterly'))");
      });

      it('should enforce photo_uri length <= 500', () => {
        const table = tables.get('medications');
        expect(table).toContain('CHECK(photo_uri IS NULL OR length(photo_uri) <= 500)');
      });

      it('should enforce active IN (0, 1)', () => {
        const table = tables.get('medications');
        expect(table).toContain('CHECK(active IN (0, 1))');
      });

      it('should enforce notes length <= 5000', () => {
        const table = tables.get('medications');
        expect(table).toContain('CHECK(notes IS NULL OR length(notes) <= 5000)');
      });

      it('should enforce created_at > 0', () => {
        const table = tables.get('medications');
        expect(table).toContain('CHECK(created_at > 0)');
      });

      it('should enforce updated_at > 0', () => {
        const table = tables.get('medications');
        expect(table).toContain('CHECK(updated_at > 0)');
      });
    });

    describe('medication_schedules table', () => {
      it('should enforce time format HH:MM', () => {
        const table = tables.get('medication_schedules');
        expect(table).toContain("CHECK(time GLOB '[0-2][0-9]:[0-5][0-9]')");
      });

      it('should enforce dosage > 0', () => {
        const table = tables.get('medication_schedules');
        expect(table).toContain('CHECK(dosage > 0)');
      });

      it('should enforce enabled IN (0, 1)', () => {
        const table = tables.get('medication_schedules');
        expect(table).toContain('CHECK(enabled IN (0, 1))');
      });
    });

    describe('medication_doses table', () => {
      it('should enforce timestamp > 0', () => {
        const table = tables.get('medication_doses');
        expect(table).toContain('CHECK(timestamp > 0)');
      });

      it('should enforce amount >= 0', () => {
        const table = tables.get('medication_doses');
        expect(table).toContain('CHECK(quantity >= 0)');
      });

      it('should enforce status IN (taken, skipped)', () => {
        const table = tables.get('medication_doses');
        expect(table).toContain("CHECK(status IN ('taken', 'skipped'))");
      });

      it('should enforce amount > 0 when status is taken', () => {
        const table = tables.get('medication_doses');
        expect(table).toContain("CHECK(status != 'taken' OR quantity > 0)");
      });

      it('should enforce effectiveness_rating between 0 and 10', () => {
        const table = tables.get('medication_doses');
        expect(table).toContain('CHECK(effectiveness_rating IS NULL OR (effectiveness_rating >= 0 AND effectiveness_rating <= 10))');
      });

      it('should enforce time_to_relief between 0 and 1440 minutes', () => {
        const table = tables.get('medication_doses');
        expect(table).toContain('CHECK(time_to_relief IS NULL OR (time_to_relief > 0 AND time_to_relief <= 1440))');
      });

      it('should enforce notes length <= 5000', () => {
        const table = tables.get('medication_doses');
        expect(table).toContain('CHECK(notes IS NULL OR length(notes) <= 5000)');
      });

      it('should enforce created_at > 0', () => {
        const table = tables.get('medication_doses');
        expect(table).toContain('CHECK(created_at > 0)');
      });
    });

    describe('medication_reminders table', () => {
      it('should enforce scheduled_time > 0', () => {
        const table = tables.get('medication_reminders');
        expect(table).toContain('CHECK(scheduled_time > 0)');
      });

      it('should enforce completed IN (0, 1)', () => {
        const table = tables.get('medication_reminders');
        expect(table).toContain('CHECK(completed IN (0, 1))');
      });

      it('should enforce snoozed_until > scheduled_time', () => {
        const table = tables.get('medication_reminders');
        expect(table).toContain('CHECK(snoozed_until IS NULL OR snoozed_until > scheduled_time)');
      });

      it('should enforce completed_at > 0 when not null', () => {
        const table = tables.get('medication_reminders');
        expect(table).toContain('CHECK(completed_at IS NULL OR completed_at > 0)');
      });

      it('should enforce completed_at is set when completed', () => {
        const table = tables.get('medication_reminders');
        expect(table).toContain('CHECK(completed = 0 OR completed_at IS NOT NULL)');
      });
    });

    describe('daily_status_logs table', () => {
      it('should enforce date format YYYY-MM-DD', () => {
        const table = tables.get('daily_status_logs');
        expect(table).toContain("CHECK(date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')");
      });

      it('should enforce status IN (green, yellow, red)', () => {
        const table = tables.get('daily_status_logs');
        expect(table).toContain("CHECK(status IN ('green', 'yellow', 'red'))");
      });

      it('should enforce status_type IN (prodrome, postdrome, anxiety, other)', () => {
        const table = tables.get('daily_status_logs');
        expect(table).toContain("CHECK(status_type IS NULL OR status_type IN ('prodrome', 'postdrome', 'anxiety', 'other'))");
      });

      it('should enforce notes length <= 5000', () => {
        const table = tables.get('daily_status_logs');
        expect(table).toContain('CHECK(notes IS NULL OR length(notes) <= 5000)');
      });

      it('should enforce prompted IN (0, 1)', () => {
        const table = tables.get('daily_status_logs');
        expect(table).toContain('CHECK(prompted IN (0, 1))');
      });

      it('should enforce status_type only for yellow status', () => {
        const table = tables.get('daily_status_logs');
        expect(table).toContain("CHECK(status = 'yellow' OR status_type IS NULL)");
      });

      it('should enforce created_at > 0', () => {
        const table = tables.get('daily_status_logs');
        expect(table).toContain('CHECK(created_at > 0)');
      });

      it('should enforce updated_at > 0', () => {
        const table = tables.get('daily_status_logs');
        expect(table).toContain('CHECK(updated_at > 0)');
      });
    });
  });

  describe('Indexes', () => {
    it('should define basic indexes on foreign keys', () => {
      expect(createTables).toContain('CREATE INDEX IF NOT EXISTS idx_intensity_readings_episode ON intensity_readings(episode_id)');
      expect(createTables).toContain('CREATE INDEX IF NOT EXISTS idx_symptom_logs_episode ON symptom_logs(episode_id)');
      expect(createTables).toContain('CREATE INDEX IF NOT EXISTS idx_medication_doses_medication ON medication_doses(medication_id)');
    });

    it('should define composite index for episode date range queries', () => {
      expect(createTables).toContain('CREATE INDEX IF NOT EXISTS idx_episodes_date_range ON episodes(start_time, end_time)');
    });

    it('should define partial index for active medications', () => {
      expect(createTables).toContain('CREATE INDEX IF NOT EXISTS idx_medications_active_type ON medications(active, type) WHERE active = 1');
    });

    it('should define composite index for medication dose history', () => {
      expect(createTables).toContain('CREATE INDEX IF NOT EXISTS idx_medication_doses_med_time ON medication_doses(medication_id, timestamp DESC)');
    });

    it('should define partial index for incomplete reminders', () => {
      expect(createTables).toContain('CREATE INDEX IF NOT EXISTS idx_reminders_incomplete ON medication_reminders(medication_id, scheduled_time) WHERE completed = 0');
    });

    it('should define composite index for intensity readings timeline', () => {
      expect(createTables).toContain('CREATE INDEX IF NOT EXISTS idx_intensity_readings_time ON intensity_readings(episode_id, timestamp)');
    });

    it('should define composite index for daily status calendar views', () => {
      expect(createTables).toContain('CREATE INDEX IF NOT EXISTS idx_daily_status_date_status ON daily_status_logs(date, status)');
    });
  });

  describe('Table Definitions', () => {
    it('should define episodes table', () => {
      expect(createTables).toContain('CREATE TABLE IF NOT EXISTS episodes');
    });

    it('should define intensity_readings table', () => {
      expect(createTables).toContain('CREATE TABLE IF NOT EXISTS intensity_readings');
    });

    it('should define symptom_logs table', () => {
      expect(createTables).toContain('CREATE TABLE IF NOT EXISTS symptom_logs');
    });

    it('should define medications table', () => {
      expect(createTables).toContain('CREATE TABLE IF NOT EXISTS medications');
    });

    it('should define medication_doses table', () => {
      expect(createTables).toContain('CREATE TABLE IF NOT EXISTS medication_doses');
    });

    it('should define medication_schedules table', () => {
      expect(createTables).toContain('CREATE TABLE IF NOT EXISTS medication_schedules');
    });

    it('should define medication_reminders table', () => {
      expect(createTables).toContain('CREATE TABLE IF NOT EXISTS medication_reminders');
    });

    it('should define daily_status_logs table', () => {
      expect(createTables).toContain('CREATE TABLE IF NOT EXISTS daily_status_logs');
    });
  });
});
