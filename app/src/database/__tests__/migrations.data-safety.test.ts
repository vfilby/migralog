/**
 * Migration Data Safety Tests (After Squashing)
 *
 * All migrations have been squashed into the base schema (schema.ts).
 * These tests verify that:
 * 1. Fresh databases are created correctly with all required tables
 * 2. Schema integrity is maintained
 * 3. No data loss can occur (since no migrations run)
 */

import Database from 'better-sqlite3';
import { createTables } from '../schema';

/**
 * Adapter to make better-sqlite3 work with expo-sqlite migration code
 */
class BetterSQLiteAdapter {
  constructor(private db: Database.Database) {
    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');
  }

  async execAsync(sql: string): Promise<void> {
    try {
      this.db.exec(sql);
    } catch (error) {
      throw new Error(`SQL execution failed: ${(error as Error).message}\nSQL: ${sql}`);
    }
  }

  async runAsync(sql: string, params?: any[]): Promise<any> {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(...(params || []));
    } catch (error) {
      throw new Error(`SQL run failed: ${(error as Error).message}\nSQL: ${sql}`);
    }
  }

  async getAllAsync<T>(sql: string, params?: any[]): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...(params || [])) as T[];
    } catch (error) {
      throw new Error(`SQL query failed: ${(error as Error).message}\nSQL: ${sql}`);
    }
  }

  close(): void {
    this.db.close();
  }
}

const getMigrations = () => {
  jest.resetModules();
  const migrationsModule = require('../migrations');
  return migrationsModule.migrationRunner;
};

describe('Migration Data Safety Tests (Squashed Schema)', () => {
  let db: Database.Database;
  let adapter: BetterSQLiteAdapter;

  beforeEach(() => {
    db = new Database(':memory:');
    adapter = new BetterSQLiteAdapter(db);
  });

  afterEach(() => {
    if (adapter) {
      adapter.close();
    }
  });

  describe('Fresh Database Creation', () => {
    it('should create all required tables without data loss risk', async () => {
      // Create schema
      await adapter.execAsync(createTables);

      // Initialize migration runner
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      // Verify all required tables exist
      const tables = await adapter.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );

      const tableNames = tables.map(t => t.name);

      // Core tables
      expect(tableNames).toContain('episodes');
      expect(tableNames).toContain('intensity_readings');
      expect(tableNames).toContain('medications');
      expect(tableNames).toContain('medication_doses');
      expect(tableNames).toContain('medication_schedules');
      expect(tableNames).toContain('medication_reminders');
      expect(tableNames).toContain('symptom_logs');
      expect(tableNames).toContain('pain_location_logs');
      expect(tableNames).toContain('daily_status_logs');
      expect(tableNames).toContain('schema_version');
    });

    it('should set up foreign key constraints correctly', async () => {
      await adapter.execAsync(createTables);

      // Verify foreign keys are enabled
      const fkStatus = db.pragma('foreign_keys', { simple: true });
      expect(fkStatus).toBe(1);

      // Create a medication
      const medId = 'med-test';
      db.prepare(`
        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(medId, 'Test Med', 'rescue', 100, 'mg', Date.now(), Date.now());

      // Create a dose
      const doseId = 'dose-test';
      db.prepare(`
        INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(doseId, medId, Date.now(), 1, 'taken', Date.now(), Date.now());

      // Deleting medication should cascade delete dose
      db.prepare('DELETE FROM medications WHERE id = ?').run(medId);

      const doses = await adapter.getAllAsync('SELECT * FROM medication_doses');
      expect(doses).toHaveLength(0);
    });
  });

  describe('JSON Column Integrity', () => {
    beforeEach(async () => {
      await adapter.execAsync(createTables);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
    });

    it('should preserve JSON array columns for episodes', async () => {
      const episodeId = 'ep-json-test';
      const locations = ['Front', 'Left', 'Back'];
      const qualities = ['Throbbing', 'Sharp'];
      const symptoms = ['Nausea', 'Light Sensitivity'];
      const triggers = ['Stress', 'Lack of sleep'];

      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        episodeId,
        Date.now(),
        JSON.stringify(locations),
        JSON.stringify(qualities),
        JSON.stringify(symptoms),
        JSON.stringify(triggers),
        Date.now(),
        Date.now()
      );

      // Retrieve and verify
      const episodes = await adapter.getAllAsync<any>('SELECT * FROM episodes');
      expect(episodes).toHaveLength(1);

      const episode = episodes[0];
      expect(JSON.parse(episode.locations)).toEqual(locations);
      expect(JSON.parse(episode.qualities)).toEqual(qualities);
      expect(JSON.parse(episode.symptoms)).toEqual(symptoms);
      expect(JSON.parse(episode.triggers)).toEqual(triggers);
    });
  });

  describe('Large Dataset Handling', () => {
    beforeEach(async () => {
      await adapter.execAsync(createTables);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
    });

    it('should handle inserting and querying large number of episodes', async () => {
      const episodeCount = 1000;

      // Insert many episodes
      const insertStmt = db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < episodeCount; i++) {
        insertStmt.run(
          `ep-${i}`,
          Date.now() - i * 1000,
          '["Front"]',
          '["Throbbing"]',
          '[]',
          '[]',
          Date.now(),
          Date.now()
        );
      }

      // Verify all episodes were inserted
      const episodes = await adapter.getAllAsync('SELECT * FROM episodes');
      expect(episodes).toHaveLength(episodeCount);
    });

    it('should handle complex relationships with many records', async () => {
      // Create medication
      const medId = 'med-complex';
      db.prepare(`
        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(medId, 'Test Med', 'rescue', 100, 'mg', Date.now(), Date.now());

      // Create episode
      const epId = 'ep-complex';
      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(epId, Date.now(), '[]', '[]', '[]', '[]', Date.now(), Date.now());

      // Create many intensity readings
      const readingCount = 100;
      const insertReading = db.prepare(`
        INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < readingCount; i++) {
        insertReading.run(
          `reading-${i}`,
          epId,
          Date.now() + i * 1000,
          Math.random() * 10,
          Date.now(),
          Date.now()
        );
      }

      // Verify cascade delete works with many related records
      db.prepare('DELETE FROM episodes WHERE id = ?').run(epId);

      const readings = await adapter.getAllAsync('SELECT * FROM intensity_readings');
      expect(readings).toHaveLength(0);
    });
  });

  describe('Schema Version Integrity', () => {
    it('should maintain version 20 after initialization', async () => {
      await adapter.execAsync(createTables);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      const version = await adapter.getAllAsync<{ version: number }>(
        'SELECT version FROM schema_version WHERE id = 1'
      );

      expect(version).toHaveLength(1);
      expect(version[0].version).toBe(20);
    });

    it('should not allow version modification through normal operations', async () => {
      await adapter.execAsync(createTables);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      // Try to run migrations (should be no-op)
      await migrationRunner.runMigrations();

      // Version should still be 19
      const version = await adapter.getAllAsync<{ version: number }>(
        'SELECT version FROM schema_version WHERE id = 1'
      );

      expect(version[0].version).toBe(20);
    });
  });

  describe('Data Validation', () => {
    beforeEach(async () => {
      await adapter.execAsync(createTables);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
    });

    it('should enforce CHECK constraints on medication type', async () => {
      // Valid types should work
      expect(() => {
        db.prepare(`
          INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('med-1', 'Test', 'rescue', 100, 'mg', Date.now(), Date.now());
      }).not.toThrow();

      // Invalid type should fail
      expect(() => {
        db.prepare(`
          INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('med-2', 'Test', 'invalid', 100, 'mg', Date.now(), Date.now());
      }).toThrow();
    });

    it('should enforce quantity > 0 when status is taken', async () => {
      const medId = 'med-validation';
      db.prepare(`
        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(medId, 'Test', 'rescue', 100, 'mg', Date.now(), Date.now());

      // status=taken with quantity=0 should fail
      expect(() => {
        db.prepare(`
          INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('dose-fail', medId, Date.now(), 0, 'taken', Date.now(), Date.now());
      }).toThrow();

      // status=skipped with quantity=0 should work
      expect(() => {
        db.prepare(`
          INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('dose-ok', medId, Date.now(), 0, 'skipped', Date.now(), Date.now());
      }).not.toThrow();
    });
  });
});
