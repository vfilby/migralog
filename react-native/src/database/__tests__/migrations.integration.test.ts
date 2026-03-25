/**
 * Integration Tests for Database Migrations (After Squashing)
 *
 * All migrations have been squashed into the base schema (schema.ts).
 * These tests verify that:
 * 1. Fresh databases are created at version 20 directly
 * 2. No migrations are needed for new installs
 * 3. Schema structure matches expected final state
 * 4. Foreign key constraints work correctly
 *
 * Note: better-sqlite3 has a different API than expo-sqlite, so we create
 * an adapter to make the migration code work with both.
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

// Import migrations - we'll need to dynamically load them
const getMigrations = () => {
  // Reset the module cache to get fresh migrations
  jest.resetModules();
  const migrationsModule = require('../migrations');
  return migrationsModule.migrationRunner;
};

describe('Migration Integration Tests (Squashed Schema)', () => {
  let db: Database.Database;
  let adapter: BetterSQLiteAdapter;

  beforeEach(() => {
    // Create fresh in-memory database for each test
    db = new Database(':memory:');
    adapter = new BetterSQLiteAdapter(db);
  });

  afterEach(() => {
    if (adapter) {
      adapter.close();
    }
  });

  describe('Fresh Database Creation', () => {
    it('should create database at SCHEMA_VERSION without migrations', async () => {
      const { SCHEMA_VERSION } = require('../schema');
      // Create schema
      await adapter.execAsync(createTables);

      // Initialize migration runner
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      // Verify version is set to SCHEMA_VERSION
      const version = await adapter.getAllAsync<{ version: number }>(
        'SELECT version FROM schema_version WHERE id = 1'
      );
      expect(version).toHaveLength(1);
      expect(version[0].version).toBe(SCHEMA_VERSION);

      // Verify no migrations are needed
      const needsMigration = await migrationRunner.needsMigration();
      expect(needsMigration).toBe(false);
    });

    it('should create all expected tables with correct schema', async () => {
      // Create schema
      await adapter.execAsync(createTables);

      // Initialize migration runner
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      // Verify all expected tables exist
      const tables = await adapter.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('episodes');
      expect(tableNames).toContain('intensity_readings');
      expect(tableNames).toContain('symptom_logs');
      expect(tableNames).toContain('pain_location_logs');
      expect(tableNames).toContain('medications');
      expect(tableNames).toContain('medication_schedules');
      expect(tableNames).toContain('medication_doses');
      expect(tableNames).toContain('medication_reminders');
      expect(tableNames).toContain('daily_status_logs');
      expect(tableNames).toContain('schema_version');
    });

    it('should have correct columns in episodes table', async () => {
      await adapter.execAsync(createTables);

      const columns = await adapter.getAllAsync<any>('PRAGMA table_info(episodes)');
      const columnNames = columns.map((c: any) => c.name);

      // Core columns
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('start_time');
      expect(columnNames).toContain('end_time');
      expect(columnNames).toContain('locations');
      expect(columnNames).toContain('qualities');
      expect(columnNames).toContain('symptoms');
      expect(columnNames).toContain('triggers');
      expect(columnNames).toContain('notes');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');

      // Location columns (from migration 2)
      expect(columnNames).toContain('latitude');
      expect(columnNames).toContain('longitude');
      expect(columnNames).toContain('location_accuracy');
      expect(columnNames).toContain('location_timestamp');

      // These columns were removed in migration 13
      expect(columnNames).not.toContain('peak_intensity');
      expect(columnNames).not.toContain('average_intensity');
    });

    it('should have correct columns in medications table', async () => {
      await adapter.execAsync(createTables);

      const columns = await adapter.getAllAsync<any>('PRAGMA table_info(medications)');
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('type');
      expect(columnNames).toContain('dosage_amount');
      expect(columnNames).toContain('dosage_unit');
      expect(columnNames).toContain('default_quantity'); // renamed from default_dosage in migration 14
      expect(columnNames).toContain('category'); // added in migration 16
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');

      // These columns were removed in migration 11
      expect(columnNames).not.toContain('start_date');
      expect(columnNames).not.toContain('end_date');
    });

    it('should have correct columns in medication_doses table', async () => {
      await adapter.execAsync(createTables);

      const columns = await adapter.getAllAsync<any>('PRAGMA table_info(medication_doses)');
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('medication_id');
      expect(columnNames).toContain('timestamp');
      expect(columnNames).toContain('quantity'); // renamed from amount in migration 15
      expect(columnNames).toContain('status'); // added in migration 6
      expect(columnNames).toContain('dosage_amount'); // added in migration 10
      expect(columnNames).toContain('dosage_unit'); // added in migration 10
      expect(columnNames).toContain('updated_at'); // added in migration 12

      // Old column name should not exist
      expect(columnNames).not.toContain('amount');
    });

    it('should have correct columns in medication_schedules table', async () => {
      await adapter.execAsync(createTables);

      const columns = await adapter.getAllAsync<any>('PRAGMA table_info(medication_schedules)');
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('medication_id');
      expect(columnNames).toContain('time');
      expect(columnNames).toContain('timezone'); // added in migration 19
      expect(columnNames).toContain('dosage');
      expect(columnNames).toContain('enabled');
    });

    it('should have composite indexes created', async () => {
      await adapter.execAsync(createTables);

      const indexes = await adapter.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index'"
      );
      const indexNames = indexes.map(i => i.name);

      // Composite indexes from migration 9
      expect(indexNames).toContain('idx_episodes_date_range');
      expect(indexNames).toContain('idx_medications_active_type');
      expect(indexNames).toContain('idx_medication_doses_med_time');
      expect(indexNames).toContain('idx_reminders_incomplete');
      expect(indexNames).toContain('idx_intensity_readings_time');
      expect(indexNames).toContain('idx_daily_status_date_status');
    });
  });

  describe('Foreign Key Constraint Tests', () => {
    beforeEach(async () => {
      await adapter.execAsync(createTables);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
    });

    it('should enforce CASCADE delete on episode -> intensity_readings', async () => {
      const episodeId = 'ep-cascade-test';
      const readingId = 'reading-test';

      // Create episode with intensity reading
      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(episodeId, Date.now(), '[]', '[]', '[]', '[]', Date.now(), Date.now());

      db.prepare(`
        INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(readingId, episodeId, Date.now(), 7.0, Date.now(), Date.now());

      // Delete episode
      db.prepare('DELETE FROM episodes WHERE id = ?').run(episodeId);

      // Verify intensity reading was cascade deleted
      const readings = await adapter.getAllAsync('SELECT * FROM intensity_readings');
      expect(readings).toHaveLength(0);
    });

    it('should enforce SET NULL on episode deletion for medication_doses', async () => {
      const medicationId = 'med-test';
      const episodeId = 'ep-test';
      const doseId = 'dose-test';

      // Create medication
      db.prepare(`
        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(medicationId, 'Test Med', 'rescue', 100, 'mg', Date.now(), Date.now());

      // Create episode
      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(episodeId, Date.now(), '[]', '[]', '[]', '[]', Date.now(), Date.now());

      // Create dose linked to both
      db.prepare(`
        INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(doseId, medicationId, Date.now(), 1, 'taken', Date.now(), Date.now());

      // Link dose to episode
      db.prepare('UPDATE medication_doses SET episode_id = ? WHERE id = ?').run(episodeId, doseId);

      // Delete episode
      db.prepare('DELETE FROM episodes WHERE id = ?').run(episodeId);

      // Verify dose still exists but episode_id is NULL
      const doses = await adapter.getAllAsync<any>('SELECT * FROM medication_doses');
      expect(doses).toHaveLength(1);
      expect(doses[0].episode_id).toBeNull();
    });

    it('should enforce CASCADE delete on medication -> medication_doses', async () => {
      const medicationId = 'med-cascade';
      const doseId = 'dose-cascade';

      // Create medication
      db.prepare(`
        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(medicationId, 'Test Med', 'rescue', 100, 'mg', Date.now(), Date.now());

      // Create dose
      db.prepare(`
        INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(doseId, medicationId, Date.now(), 1, 'taken', Date.now(), Date.now());

      // Delete medication
      db.prepare('DELETE FROM medications WHERE id = ?').run(medicationId);

      // Verify dose was cascade deleted
      const doses = await adapter.getAllAsync('SELECT * FROM medication_doses');
      expect(doses).toHaveLength(0);
    });
  });

  describe('Data Integrity Tests', () => {
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

      expect(() => {
        db.prepare(`
          INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('med-2', 'Test', 'preventative', 100, 'mg', Date.now(), Date.now());
      }).not.toThrow();

      expect(() => {
        db.prepare(`
          INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('med-3', 'Test', 'other', 100, 'mg', Date.now(), Date.now());
      }).not.toThrow();

      // Invalid type should fail
      expect(() => {
        db.prepare(`
          INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('med-4', 'Test', 'invalid', 100, 'mg', Date.now(), Date.now());
      }).toThrow();
    });

    it('should enforce CHECK constraint on medication_doses status', async () => {
      const medicationId = 'med-status-test';

      // Create medication
      db.prepare(`
        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(medicationId, 'Test', 'rescue', 100, 'mg', Date.now(), Date.now());

      // Valid statuses should work
      expect(() => {
        db.prepare(`
          INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('dose-1', medicationId, Date.now(), 1, 'taken', Date.now(), Date.now());
      }).not.toThrow();

      expect(() => {
        db.prepare(`
          INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('dose-2', medicationId, Date.now(), 0, 'skipped', Date.now(), Date.now());
      }).not.toThrow();

      // Invalid status should fail
      expect(() => {
        db.prepare(`
          INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('dose-3', medicationId, Date.now(), 1, 'invalid', Date.now(), Date.now());
      }).toThrow();
    });

    it('should enforce quantity > 0 when status is taken', async () => {
      const medicationId = 'med-quantity-test';

      // Create medication
      db.prepare(`
        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(medicationId, 'Test', 'rescue', 100, 'mg', Date.now(), Date.now());

      // status=taken with quantity=0 should fail
      expect(() => {
        db.prepare(`
          INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('dose-fail', medicationId, Date.now(), 0, 'taken', Date.now(), Date.now());
      }).toThrow();

      // status=skipped with quantity=0 should work
      expect(() => {
        db.prepare(`
          INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run('dose-ok', medicationId, Date.now(), 0, 'skipped', Date.now(), Date.now());
      }).not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should complete fresh database initialization quickly', async () => {
      const startTime = Date.now();

      await adapter.execAsync(createTables);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be very fast since no migrations need to run
      expect(duration).toBeLessThan(100); // Less than 100ms
    });

    it('should not run any migrations for fresh database', async () => {
      await adapter.execAsync(createTables);

      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      const { SCHEMA_VERSION } = require('../schema');

      // Track if runMigrations does anything
      const versionBefore = await adapter.getAllAsync<{ version: number }>(
        'SELECT version FROM schema_version'
      );

      await migrationRunner.runMigrations();

      const versionAfter = await adapter.getAllAsync<{ version: number }>(
        'SELECT version FROM schema_version'
      );

      // Version should remain at SCHEMA_VERSION
      expect(versionBefore[0].version).toBe(SCHEMA_VERSION);
      expect(versionAfter[0].version).toBe(SCHEMA_VERSION);
    });
  });
});
