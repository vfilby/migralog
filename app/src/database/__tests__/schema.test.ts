/**
 * Database Schema Validation Tests
 *
 * Tests that verify the database schema definition includes proper constraints,
 * indexes, and data integrity rules.
 */

import { createTables, SCHEMA_VERSION } from '../schema';

describe('Database Schema', () => {
  describe('Schema Version', () => {
    it('should be at version 9', () => {
      expect(SCHEMA_VERSION).toBe(9);
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
    it('should enforce start_time > 0 for episodes', () => {
      expect(createTables).toContain('CHECK(start_time > 0)');
    });

    it('should enforce end_time > start_time for episodes', () => {
      expect(createTables).toContain('CHECK(end_time IS NULL OR end_time > start_time)');
    });

    it('should enforce pain intensity between 0 and 10', () => {
      expect(createTables).toMatch(/CHECK\(.*intensity.*>= 0 AND.*intensity.*<= 10\)/);
    });

    it('should enforce average_intensity <= peak_intensity', () => {
      expect(createTables).toMatch(/average_intensity <= peak_intensity/);
    });

    it('should enforce medication type IN (preventative, rescue)', () => {
      expect(createTables).toContain("CHECK(type IN ('preventative', 'rescue'))");
    });

    it('should enforce dosage_amount > 0', () => {
      expect(createTables).toContain('CHECK(dosage_amount > 0)');
    });

    it('should enforce active IN (0, 1)', () => {
      expect(createTables).toMatch(/active.*CHECK\(active IN \(0, 1\)\)/);
    });

    it('should enforce medication dose status IN (taken, skipped)', () => {
      expect(createTables).toContain("CHECK(status IN ('taken', 'skipped'))");
    });

    it('should enforce amount > 0 when status is taken', () => {
      expect(createTables).toContain("CHECK(status != 'taken' OR amount > 0)");
    });

    it('should enforce daily status IN (green, yellow, red)', () => {
      expect(createTables).toContain("CHECK(status IN ('green', 'yellow', 'red'))");
    });

    it('should enforce status_type only for yellow status', () => {
      expect(createTables).toContain("CHECK(status = 'yellow' OR status_type IS NULL)");
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
