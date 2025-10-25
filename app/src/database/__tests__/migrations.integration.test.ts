/**
 * Integration Tests for Database Migrations
 *
 * These tests use better-sqlite3 to create a REAL in-memory SQLite database
 * and verify that:
 * 1. SQL executes successfully
 * 2. Data is preserved during migrations
 * 3. Rollbacks work correctly
 * 4. Foreign key constraints are maintained
 * 5. Failure scenarios are handled properly
 *
 * Note: better-sqlite3 has a different API than expo-sqlite, so we create
 * an adapter to make the migration code work with both.
 */

import Database from 'better-sqlite3';

// Schema from version 1 (before any migrations)
const SCHEMA_V1 = `
  CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS episodes (
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

  CREATE INDEX IF NOT EXISTS idx_episodes_start_time ON episodes(start_time);

  CREATE TABLE IF NOT EXISTS intensity_readings (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    intensity REAL NOT NULL,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_intensity_readings_episode ON intensity_readings(episode_id);

  CREATE TABLE IF NOT EXISTS symptom_logs (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    symptom TEXT NOT NULL,
    severity TEXT,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_symptom_logs_episode ON symptom_logs(episode_id);

  CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    dosage_amount REAL NOT NULL,
    dosage_unit TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS medication_schedules (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    time TEXT NOT NULL,
    dosage REAL NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_medication_schedules_medication ON medication_schedules(medication_id);

  CREATE TABLE IF NOT EXISTS medication_doses (
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

  CREATE INDEX IF NOT EXISTS idx_medication_doses_medication ON medication_doses(medication_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_episode ON medication_doses(episode_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_timestamp ON medication_doses(timestamp);

  CREATE TABLE IF NOT EXISTS medication_reminders (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    scheduled_time INTEGER NOT NULL,
    notification_id TEXT,
    dismissed INTEGER NOT NULL DEFAULT 0,
    taken INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
  );

  INSERT INTO schema_version (id, version, updated_at) VALUES (1, 1, ${Date.now()});
`;

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

describe('Migration Integration Tests (Real Database)', () => {
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

  describe('Data Preservation Tests', () => {
    describe('Migration 2: add_location_to_episodes', () => {
      it('should preserve episode data when adding location columns', async () => {
        // Setup: Create v1 database with test episode
        db.exec(SCHEMA_V1);

        const testEpisode = {
          id: 'ep-test-1',
          start_time: Date.now(),
          end_time: null,
          locations: JSON.stringify(['Front', 'Left']),
          qualities: JSON.stringify(['Throbbing']),
          symptoms: JSON.stringify(['Nausea']),
          triggers: JSON.stringify(['Stress']),
          notes: 'Test episode',
          peak_intensity: 7.5,
          average_intensity: 6.0,
          created_at: Date.now(),
          updated_at: Date.now()
        };

        db.prepare(`
          INSERT INTO episodes (id, start_time, end_time, locations, qualities, symptoms,
                               triggers, notes, peak_intensity, average_intensity,
                               created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          testEpisode.id, testEpisode.start_time, testEpisode.end_time,
          testEpisode.locations, testEpisode.qualities, testEpisode.symptoms,
          testEpisode.triggers, testEpisode.notes, testEpisode.peak_intensity,
          testEpisode.average_intensity, testEpisode.created_at, testEpisode.updated_at
        );

        // Execute: Run migration 2
        const migrationRunner = getMigrations();
        await migrationRunner.initialize(adapter as any);
        await migrationRunner.runMigrations();

        // Verify: Data preserved and new columns added
        const episodes = await adapter.getAllAsync<any>('SELECT * FROM episodes');
        expect(episodes).toHaveLength(1);
        expect(episodes[0].id).toBe(testEpisode.id);
        expect(episodes[0].start_time).toBe(testEpisode.start_time);
        expect(episodes[0].locations).toBe(testEpisode.locations);
        expect(episodes[0].notes).toBe(testEpisode.notes);
        expect(episodes[0].peak_intensity).toBe(testEpisode.peak_intensity);

        // Verify new columns exist and are null
        expect(episodes[0]).toHaveProperty('latitude');
        expect(episodes[0]).toHaveProperty('longitude');
        expect(episodes[0].latitude).toBeNull();
        expect(episodes[0].longitude).toBeNull();
      });

      it('should preserve episode data during rollback from v2 to v1', async () => {
        // Setup: Migrate to v2 and add episode with location
        db.exec(SCHEMA_V1);
        const migrationRunner = getMigrations();
        await migrationRunner.initialize(adapter as any);
        await migrationRunner.runMigrations();

        const testEpisode = {
          id: 'ep-test-2',
          start_time: Date.now(),
          locations: JSON.stringify(['Back']),
          qualities: JSON.stringify(['Sharp']),
          symptoms: JSON.stringify([]),
          triggers: JSON.stringify([]),
          latitude: 40.7128,
          longitude: -74.0060,
          location_accuracy: 10.5,
          location_timestamp: Date.now(),
          created_at: Date.now(),
          updated_at: Date.now()
        };

        db.prepare(`
          INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                               latitude, longitude, location_accuracy, location_timestamp,
                               created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          testEpisode.id, testEpisode.start_time, testEpisode.locations,
          testEpisode.qualities, testEpisode.symptoms, testEpisode.triggers,
          testEpisode.latitude, testEpisode.longitude, testEpisode.location_accuracy,
          testEpisode.location_timestamp, testEpisode.created_at, testEpisode.updated_at
        );

        // Execute: Rollback to v1
        await migrationRunner.rollback(1);

        // Verify: Core data preserved, location columns removed
        const episodes = await adapter.getAllAsync<any>('SELECT * FROM episodes');
        expect(episodes).toHaveLength(1);
        expect(episodes[0].id).toBe(testEpisode.id);
        expect(episodes[0].start_time).toBe(testEpisode.start_time);
        expect(episodes[0].locations).toBe(testEpisode.locations);

        // Location columns should NOT exist
        expect(episodes[0]).not.toHaveProperty('latitude');
        expect(episodes[0]).not.toHaveProperty('longitude');
      });
    });

    describe('Migration 6: add_status_to_medication_doses', () => {
      it('should preserve dose and FK relationships when adding status column', async () => {
        // Setup: Create v1 database with medication and doses
        db.exec(SCHEMA_V1);

        const medicationId = 'med-test-1';
        const episodeId = 'ep-test-1';
        const doseId = 'dose-test-1';

        // Create medication
        db.prepare(`
          INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(medicationId, 'Aspirin', 'rescue', 500, 'mg', Date.now());

        // Create episode
        db.prepare(`
          INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                               created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(episodeId, Date.now(), '[]', '[]', '[]', '[]', Date.now(), Date.now());

        // Create dose linked to both
        db.prepare(`
          INSERT INTO medication_doses (id, medication_id, timestamp, amount, episode_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(doseId, medicationId, Date.now(), 2, episodeId, Date.now());

        // Execute: Migrate to v6
        const migrationRunner = getMigrations();
        await migrationRunner.initialize(adapter as any);
        await migrationRunner.runMigrations();

        // Verify: Dose data and relationships preserved
        const doses = await adapter.getAllAsync<any>('SELECT * FROM medication_doses');
        expect(doses).toHaveLength(1);
        expect(doses[0].id).toBe(doseId);
        expect(doses[0].medication_id).toBe(medicationId);
        expect(doses[0].episode_id).toBe(episodeId);
        expect(doses[0].amount).toBe(2);

        // New status column should exist with default value
        expect(doses[0].status).toBe('taken');
      });

      it('should preserve FK constraints during rollback', async () => {
        // Setup: Migrate to v6
        db.exec(SCHEMA_V1);
        const migrationRunner = getMigrations();
        await migrationRunner.initialize(adapter as any);
        await migrationRunner.runMigrations();

        const medicationId = 'med-test-2';
        const doseId = 'dose-test-2';

        // Create medication and dose (after v11 migration, need to add updated_at)
        db.prepare(`
          INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(medicationId, 'Ibuprofen', 'rescue', 200, 'mg', Date.now(), Date.now());

        db.prepare(`
          INSERT INTO medication_doses (id, medication_id, timestamp, amount, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(doseId, medicationId, Date.now(), 1, 'skipped', Date.now());

        // Execute: Rollback to v5
        await migrationRunner.rollback(5);

        // Verify: FK still enforced - deleting medication should cascade
        db.prepare('DELETE FROM medications WHERE id = ?').run(medicationId);
        const doses = await adapter.getAllAsync<any>('SELECT * FROM medication_doses');
        expect(doses).toHaveLength(0); // Cascade delete worked
      });
    });
  });

  describe('Failure Scenario Tests', () => {
    it('should handle SQL execution failure during migration', async () => {
      // Setup: v1 database
      db.exec(SCHEMA_V1);

      // Create test data
      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('ep-1', Date.now(), '[]', '[]', '[]', '[]', Date.now(), Date.now());

      // Create failing adapter that throws error on execAsync
      let callCount = 0;
      const failingAdapter = {
        execAsync: jest.fn(async (sql: string) => {
          callCount++;
          // Let schema_version table creation succeed
          if (sql.includes('CREATE TABLE IF NOT EXISTS schema_version')) {
            return adapter.execAsync(sql);
          }
          // Let first migration check succeed
          if (callCount <= 2) {
            return adapter.execAsync(sql);
          }
          // Fail on actual migration
          if (sql.includes('ALTER TABLE episodes ADD COLUMN')) {
            throw new Error('Simulated SQL execution failure');
          }
          return adapter.execAsync(sql);
        }),
        getAllAsync: jest.fn((sql: string) => adapter.getAllAsync(sql)),
        runAsync: jest.fn((sql: string, params?: any[]) => adapter.runAsync(sql, params))
      };

      const migrationRunner = getMigrations();
      await migrationRunner.initialize(failingAdapter as any);

      // Execute: Migration should fail
      await expect(migrationRunner.runMigrations()).rejects.toThrow();

      // Verify: Original data still exists (check with real adapter)
      const episodes = await adapter.getAllAsync('SELECT * FROM episodes');
      expect(episodes).toHaveLength(1);
    });

    it('should validate database connection before migration', async () => {
      db.exec(SCHEMA_V1);

      // Create adapter that fails on validation check
      const failingAdapter = {
        execAsync: jest.fn(async (sql: string) => {
          // Let schema_version creation succeed
          if (sql.includes('CREATE TABLE IF NOT EXISTS schema_version')) {
            return adapter.execAsync(sql);
          }
          throw new Error('Connection failed');
        }),
        getAllAsync: jest.fn(async (sql: string) => {
          // Let version check succeed
          if (sql.includes('SELECT version FROM schema_version')) {
            return adapter.getAllAsync(sql);
          }
          // Fail on validation check (SELECT 1)
          if (sql === 'SELECT 1') {
            throw new Error('Connection failed');
          }
          return adapter.getAllAsync(sql);
        }),
        runAsync: jest.fn(async (sql: string, params?: any[]) => {
          // Let initial version insert succeed
          if (sql.includes('INSERT OR IGNORE INTO schema_version')) {
            return adapter.runAsync(sql, params);
          }
          return adapter.runAsync(sql, params);
        })
      };

      const migrationRunner = getMigrations();
      await migrationRunner.initialize(failingAdapter as any);

      // Execute: Migration should fail validation
      await expect(migrationRunner.runMigrations()).rejects.toThrow('validation failed');
    });
  });

  describe('Foreign Key Constraint Tests', () => {
    it('should maintain CASCADE delete through all migrations', async () => {
      // Setup: v1 database with full data chain
      db.exec(SCHEMA_V1);

      const episodeId = 'ep-cascade-test';
      const readingId = 'reading-test';

      // Create episode with intensity reading
      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(episodeId, Date.now(), '[]', '[]', '[]', '[]', Date.now(), Date.now());

      db.prepare(`
        INSERT INTO intensity_readings (id, episode_id, timestamp, intensity)
        VALUES (?, ?, ?, ?)
      `).run(readingId, episodeId, Date.now(), 7.0);

      // Execute: Migrate through all versions
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();

      // Verify: DELETE CASCADE still works after all migrations
      db.prepare('DELETE FROM episodes WHERE id = ?').run(episodeId);

      const readings = await adapter.getAllAsync('SELECT * FROM intensity_readings');
      expect(readings).toHaveLength(0); // Cascade worked
    });

    it('should maintain SET NULL behavior through migrations', async () => {
      // Setup: v1 database
      db.exec(SCHEMA_V1);

      const medicationId = 'med-setnull-test';
      const episodeId = 'ep-setnull-test';
      const doseId = 'dose-setnull-test';

      // Create full chain
      db.prepare(`
        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(medicationId, 'Test Med', 'test', 100, 'mg', Date.now());

      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(episodeId, Date.now(), '[]', '[]', '[]', '[]', Date.now(), Date.now());

      db.prepare(`
        INSERT INTO medication_doses (id, medication_id, timestamp, amount, episode_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(doseId, medicationId, Date.now(), 1, episodeId, Date.now());

      // Execute: Migrate through all versions
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();

      // Verify: DELETE SET NULL still works
      db.prepare('DELETE FROM episodes WHERE id = ?').run(episodeId);

      const doses = await adapter.getAllAsync<any>('SELECT * FROM medication_doses');
      expect(doses).toHaveLength(1);
      expect(doses[0].episode_id).toBeNull(); // SET NULL worked
    });
  });

  describe('Schema Integrity Tests', () => {
    it('should create all expected tables through migrations', async () => {
      // Setup: v1 database
      db.exec(SCHEMA_V1);

      // Execute: Run all migrations
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();

      // Verify: All expected tables exist
      const tables = await adapter.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('episodes');
      expect(tableNames).toContain('episode_notes'); // Migration 3
      expect(tableNames).toContain('daily_status_logs'); // Migration 5
      expect(tableNames).toContain('medications');
      expect(tableNames).toContain('medication_doses');
      expect(tableNames).toContain('medication_schedules');
      expect(tableNames).toContain('schema_version');
    });

    it('should verify column types are correct after migrations', async () => {
      db.exec(SCHEMA_V1);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();

      // Check episodes table schema
      const episodeColumns = await adapter.getAllAsync<any>('PRAGMA table_info(episodes)');
      const latitudeCol = episodeColumns.find((c: any) => c.name === 'latitude');
      const longitudeCol = episodeColumns.find((c: any) => c.name === 'longitude');

      expect(latitudeCol).toBeDefined();
      expect(latitudeCol.type).toBe('REAL');
      expect(longitudeCol).toBeDefined();
      expect(longitudeCol.type).toBe('REAL');

      // Check medication_doses status column
      const doseColumns = await adapter.getAllAsync<any>('PRAGMA table_info(medication_doses)');
      const statusCol = doseColumns.find((c: any) => c.name === 'status');

      expect(statusCol).toBeDefined();
      expect(statusCol.type).toBe('TEXT');
      expect(statusCol.notnull).toBe(1);
      expect(statusCol.dflt_value).toBe("'taken'");
    });
  });

  describe('Version Tracking Tests', () => {
    it('should update version after each migration', async () => {
      db.exec(SCHEMA_V1);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      // Start at v1
      let version = await adapter.getAllAsync<{ version: number }>('SELECT version FROM schema_version');
      expect(version[0].version).toBe(1);

      // Run migrations
      await migrationRunner.runMigrations();

      // Should be at latest version (10)
      version = await adapter.getAllAsync<{ version: number }>('SELECT version FROM schema_version');
      expect(version[0].version).toBe(10);
    });

    it('should track version during rollback', async () => {
      db.exec(SCHEMA_V1);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();

      // Rollback to v3
      await migrationRunner.rollback(3);

      const version = await adapter.getAllAsync<{ version: number }>('SELECT version FROM schema_version');
      expect(version[0].version).toBe(3);
    });
  });
});
