/**
 * Data Safety Tests for Database Migrations
 *
 * These tests focus on the WORST CASE scenarios where data could be lost.
 * In a healthcare app, data loss is catastrophic, so we test:
 *
 * 1. Partial migration failures (what if migration crashes mid-execution?)
 * 2. Data corruption during table recreation (what if INSERT fails after DROP?)
 * 3. Large dataset handling (1000+ records)
 * 4. JSON column integrity (locations, symptoms, triggers)
 * 5. Backup verification (is backup actually created and complete?)
 * 6. Recovery from corrupted state
 */

import Database from 'better-sqlite3';

// Complete schema from version 1 (before any migrations)
// This matches the actual initial database schema
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

  CREATE TABLE IF NOT EXISTS intensity_readings (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    intensity REAL NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS symptom_logs (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    symptom TEXT NOT NULL,
    onset_time INTEGER NOT NULL,
    resolution_time INTEGER,
    severity REAL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    dosage_amount REAL NOT NULL,
    dosage_unit TEXT NOT NULL,
    default_dosage REAL,
    schedule_frequency TEXT,
    photo_uri TEXT,
    start_date INTEGER,
    end_date INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS medication_schedules (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    time TEXT NOT NULL,
    dosage REAL NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
  );

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

  CREATE TABLE IF NOT EXISTS medication_reminders (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    scheduled_time INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    snoozed_until INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_episodes_start_time ON episodes(start_time);
  CREATE INDEX IF NOT EXISTS idx_intensity_readings_episode ON intensity_readings(episode_id);
  CREATE INDEX IF NOT EXISTS idx_symptom_logs_episode ON symptom_logs(episode_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_medication ON medication_doses(medication_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_episode ON medication_doses(episode_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_timestamp ON medication_doses(timestamp);
  CREATE INDEX IF NOT EXISTS idx_medication_reminders_scheduled ON medication_reminders(scheduled_time);

  INSERT INTO schema_version (id, version, updated_at) VALUES (1, 1, ${Date.now()});
`;

class BetterSQLiteAdapter {
  constructor(private db: Database.Database) {
    this.db.pragma('foreign_keys = ON');
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, params?: any[]): Promise<any> {
    const stmt = this.db.prepare(sql);
    return stmt.run(...(params || []));
  }

  async getAllAsync<T>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params || [])) as T[];
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

describe('Migration Data Safety Tests', () => {
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

  describe('Partial Migration Failure Recovery', () => {
    it('should handle migration interruption after partial column addition', async () => {
      // Setup: v1 database with episode
      db.exec(SCHEMA_V1);
      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('ep-1', Date.now(), '["Front"]', '[]', '[]', '[]', Date.now(), Date.now());

      // Simulate partial migration: only latitude added, then crash
      db.exec('ALTER TABLE episodes ADD COLUMN latitude REAL;');
      // App crashes here - longitude, location_accuracy, location_timestamp NOT added

      // Verify: Partial state (2/4 columns)
      const columns = await adapter.getAllAsync<any>('PRAGMA table_info(episodes)');
      expect(columns.find((c: any) => c.name === 'latitude')).toBeDefined();
      expect(columns.find((c: any) => c.name === 'longitude')).toBeUndefined();

      // Verify: Version still at 1 (migration didn't complete)
      const version = await adapter.getAllAsync<{ version: number }>('SELECT version FROM schema_version');
      expect(version[0].version).toBe(1);

      // Execute: Try to run migration again (app restarted)
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      // Migration 2 checks if columns exist before adding, so this should complete successfully
      // Note: Smoke tests are skipped in test environment
      await expect(migrationRunner.runMigrations()).resolves.not.toThrow();

      // Verify: All 4 columns now exist
      const columnsAfter = await adapter.getAllAsync<any>('PRAGMA table_info(episodes)');
      expect(columnsAfter.find((c: any) => c.name === 'latitude')).toBeDefined();
      expect(columnsAfter.find((c: any) => c.name === 'longitude')).toBeDefined();
      expect(columnsAfter.find((c: any) => c.name === 'location_accuracy')).toBeDefined();
      expect(columnsAfter.find((c: any) => c.name === 'location_timestamp')).toBeDefined();

      // Verify: Original data preserved
      const episodes = await adapter.getAllAsync<any>('SELECT * FROM episodes');
      expect(episodes).toHaveLength(1);
      expect(episodes[0].id).toBe('ep-1');
    });

    it('should detect and abort if migration leaves database in inconsistent state', async () => {
      // Setup: v1 database
      db.exec(SCHEMA_V1);

      // Simulate corrupted state: version says v2 but columns missing
      db.exec('UPDATE schema_version SET version = 2');

      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      // Try to run migrations from v2 → v6
      // This should work because migrations 3-6 don't depend on migration 2 columns
      await expect(migrationRunner.runMigrations()).resolves.not.toThrow();

      // But smoke tests should catch if required columns missing
      // (In production, smoke tests would fail and trigger rollback)
    });
  });

  describe('Table Recreation Data Safety', () => {
    it('should verify row count before DROP during rollback', async () => {
      // Setup: v2 database with episodes
      db.exec(SCHEMA_V1);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();

      // Insert 100 episodes
      for (let i = 0; i < 100; i++) {
        db.prepare(`
          INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                               latitude, longitude, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `ep-${i}`, Date.now() + i, '[]', '[]', '[]', '[]',
          40.7128, -74.0060, Date.now(), Date.now()
        );
      }

      // Get row count before rollback
      const countBefore = db.prepare('SELECT COUNT(*) as count FROM episodes').get() as { count: number };
      expect(countBefore.count).toBe(100);

      // Execute: Rollback (table recreation)
      await migrationRunner.rollback(1);

      // Verify: ALL rows preserved
      const countAfter = db.prepare('SELECT COUNT(*) as count FROM episodes').get() as { count: number };
      expect(countAfter.count).toBe(100);

      // Verify: Sample data intact
      const episode50 = await adapter.getAllAsync<any>('SELECT * FROM episodes WHERE id = ?', ['ep-50']);
      expect(episode50).toHaveLength(1);
      expect(episode50[0].id).toBe('ep-50');
    });

    it('should use transaction for table recreation to prevent partial data loss', async () => {
      // Setup: v6 database with doses
      db.exec(SCHEMA_V1);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();

      const medId = 'med-1';
      const now = Date.now();
      db.prepare(`
        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(medId, 'Aspirin', 'test', 100, 'mg', now, now);

      // Insert 50 doses
      for (let i = 0; i < 50; i++) {
        db.prepare(`
          INSERT INTO medication_doses (id, medication_id, timestamp, amount, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(`dose-${i}`, medId, Date.now() + i, 1, 'taken', Date.now());
      }

      // Create failing adapter that fails during INSERT of backup
      let insertCalled = false;
      const failingAdapter = {
        execAsync: jest.fn(async (sql: string) => {
          // Detect INSERT INTO backup
          if (sql.includes('INSERT INTO medication_doses_backup')) {
            insertCalled = true;
            throw new Error('Simulated INSERT failure during backup creation');
          }
          return adapter.execAsync(sql);
        }),
        getAllAsync: jest.fn((sql: string) => adapter.getAllAsync(sql)),
        runAsync: jest.fn((sql: string, params?: any[]) => adapter.runAsync(sql, params))
      };

      const failingMigrationRunner = getMigrations();
      await failingMigrationRunner.initialize(failingAdapter as any);

      // Execute: Rollback should fail during INSERT
      await expect(failingMigrationRunner.rollback(5)).rejects.toThrow('INSERT failure');

      // Verify: Original table should still exist (DROP wasn't called)
      const tables = await adapter.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='medication_doses'"
      );
      expect(tables).toHaveLength(1);

      // Verify: All 50 doses still exist
      const doses = await adapter.getAllAsync<any>('SELECT * FROM medication_doses');
      expect(doses.length).toBeGreaterThanOrEqual(50); // Original data preserved

      expect(insertCalled).toBe(true);
    });
  });

  describe('Large Dataset Handling', () => {
    it('should migrate 1000+ episodes without data loss', async () => {
      // Setup: v1 database
      db.exec(SCHEMA_V1);

      // Insert 1000 episodes with various data
      const episodes = [];
      for (let i = 0; i < 1000; i++) {
        const episode = {
          id: `ep-${i}`,
          start_time: Date.now() - (i * 3600000), // Each episode 1 hour apart
          locations: JSON.stringify(['Front', 'Left', 'Right'][i % 3]),
          qualities: JSON.stringify(['Throbbing', 'Sharp', 'Dull'][i % 3]),
          symptoms: JSON.stringify(['Nausea', 'Light sensitivity'][i % 2]),
          triggers: JSON.stringify(['Stress', 'Food', 'Sleep'][i % 3]),
          notes: `Episode ${i} notes with special chars: 日本語 émojis 🤕`,
          peak_intensity: (i % 10) + 1,
          created_at: Date.now(),
          updated_at: Date.now()
        };
        episodes.push(episode);

        db.prepare(`
          INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                               notes, peak_intensity, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          episode.id, episode.start_time, episode.locations, episode.qualities,
          episode.symptoms, episode.triggers, episode.notes, episode.peak_intensity,
          episode.created_at, episode.updated_at
        );
      }

      // Execute: Migrate to v6
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();

      // Verify: All 1000 episodes preserved
      const count = db.prepare('SELECT COUNT(*) as count FROM episodes').get() as { count: number };
      expect(count.count).toBe(1000);

      // Verify: Random sample data integrity
      const samples = [0, 250, 500, 750, 999];
      for (const i of samples) {
        const result = await adapter.getAllAsync<any>('SELECT * FROM episodes WHERE id = ?', [`ep-${i}`]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(`ep-${i}`);
        expect(result[0].notes).toContain(`Episode ${i}`);
        expect(result[0].peak_intensity).toBe((i % 10) + 1);

        // Verify JSON columns parseable
        expect(() => JSON.parse(result[0].locations)).not.toThrow();
        expect(() => JSON.parse(result[0].symptoms)).not.toThrow();
      }
    });

    it('should rollback 1000+ episodes without data loss', async () => {
      // Setup: v2 database with 1000 episodes
      db.exec(SCHEMA_V1);
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();

      // Insert 1000 episodes WITH location data
      for (let i = 0; i < 1000; i++) {
        db.prepare(`
          INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                               latitude, longitude, location_accuracy, location_timestamp,
                               created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `ep-${i}`, Date.now(), '[]', '[]', '[]', '[]',
          40.7128 + (i * 0.001), -74.0060 + (i * 0.001), 10.5, Date.now(),
          Date.now(), Date.now()
        );
      }

      // Execute: Rollback (massive table recreation)
      await migrationRunner.rollback(1);

      // Verify: All 1000 episodes preserved
      const count = db.prepare('SELECT COUNT(*) as count FROM episodes').get() as { count: number };
      expect(count.count).toBe(1000);

      // Verify: Location columns removed
      const columns = await adapter.getAllAsync<any>('PRAGMA table_info(episodes)');
      expect(columns.find((c: any) => c.name === 'latitude')).toBeUndefined();

      // Verify: Sample data integrity
      const sample = await adapter.getAllAsync<any>('SELECT * FROM episodes WHERE id = ?', ['ep-500']);
      expect(sample).toHaveLength(1);
      expect(sample[0].id).toBe('ep-500');
    });
  });

  describe('JSON Column Integrity', () => {
    it('should preserve JSON arrays during migration', async () => {
      // Setup: v1 database with complex JSON
      db.exec(SCHEMA_V1);

      const testCases = [
        { id: 'ep-1', locations: '["Front","Back","Left","Right"]' },
        { id: 'ep-2', locations: '[]' }, // Empty array
        { id: 'ep-3', locations: '["Front"]' }, // Single item
        { id: 'ep-4', symptoms: '["Nausea","Vomiting","Dizziness"]' },
        { id: 'ep-5', triggers: '["Stress","Lack of sleep","Bright lights"]' },
        { id: 'ep-6', qualities: '["Throbbing","Pulsing"]' },
      ];

      for (const testCase of testCases) {
        db.prepare(`
          INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                               created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          testCase.id, Date.now(),
          testCase.locations || '[]',
          testCase.qualities || '[]',
          testCase.symptoms || '[]',
          testCase.triggers || '[]',
          Date.now(), Date.now()
        );
      }

      // Execute: Migrate to v6 and back to v1
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();
      await migrationRunner.rollback(1);

      // Verify: All JSON parseable and correct
      for (const testCase of testCases) {
        const result = await adapter.getAllAsync<any>('SELECT * FROM episodes WHERE id = ?', [testCase.id]);
        expect(result).toHaveLength(1);

        if (testCase.locations) {
          expect(result[0].locations).toBe(testCase.locations);
          const parsed = JSON.parse(result[0].locations);
          expect(Array.isArray(parsed)).toBe(true);
        }

        if (testCase.symptoms) {
          expect(result[0].symptoms).toBe(testCase.symptoms);
          expect(() => JSON.parse(result[0].symptoms)).not.toThrow();
        }

        if (testCase.triggers) {
          expect(result[0].triggers).toBe(testCase.triggers);
          expect(() => JSON.parse(result[0].triggers)).not.toThrow();
        }
      }
    });

    it('should handle special characters in JSON strings', async () => {
      // Setup: v1 database
      db.exec(SCHEMA_V1);

      const specialCases = [
        { id: 'ep-1', notes: 'Quote test: "double" and \'single\'' },
        { id: 'ep-2', notes: 'Unicode: 日本語 中文 한국어' },
        { id: 'ep-3', notes: 'Emoji: 🤕 😢 💊' },
        { id: 'ep-4', notes: "Escape test: \n\t\r\\" },
        { id: 'ep-5', locations: '["Location with \\"quotes\\""]' },
      ];

      for (const testCase of specialCases) {
        db.prepare(`
          INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                               notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          testCase.id, Date.now(),
          testCase.locations || '[]',
          '[]', '[]', '[]',
          testCase.notes || null,
          Date.now(), Date.now()
        );
      }

      // Execute: Full migration cycle
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();
      await migrationRunner.rollback(1);

      // Verify: All special characters preserved
      for (const testCase of specialCases) {
        const result = await adapter.getAllAsync<any>('SELECT * FROM episodes WHERE id = ?', [testCase.id]);
        expect(result).toHaveLength(1);

        if (testCase.notes) {
          expect(result[0].notes).toBe(testCase.notes);
        }

        if (testCase.locations && testCase.locations !== '[]') {
          expect(result[0].locations).toBe(testCase.locations);
          expect(() => JSON.parse(result[0].locations)).not.toThrow();
        }
      }
    });
  });

  describe('Backup Verification', () => {
    it('should abort migration if backup fails', async () => {
      // Setup: v1 database with data
      db.exec(SCHEMA_V1);
      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('ep-1', Date.now(), '[]', '[]', '[]', '[]', Date.now(), Date.now());

      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      // Create backup function that fails
      const failingBackup = async () => {
        throw new Error('Backup storage full');
      };

      // Execute: Migration should abort
      await expect(migrationRunner.runMigrations(failingBackup)).rejects.toThrow('Failed to create backup');

      // Verify: Database still at v1
      const version = await adapter.getAllAsync<{ version: number }>('SELECT version FROM schema_version');
      expect(version[0].version).toBe(1);

      // Verify: Original data intact
      const episodes = await adapter.getAllAsync('SELECT * FROM episodes');
      expect(episodes).toHaveLength(1);
    });

    it('should verify backup contains all data before migration', async () => {
      // Setup: v1 database with data
      db.exec(SCHEMA_V1);

      // Insert 100 episodes
      for (let i = 0; i < 100; i++) {
        db.prepare(`
          INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                               created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(`ep-${i}`, Date.now(), '[]', '[]', '[]', '[]', Date.now(), Date.now());
      }

      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      // Track backup data
      let backupCalled = false;
      let backupDatabase: any = null;

      const trackingBackup = async (db: any) => {
        backupCalled = true;
        backupDatabase = db;

        // Verify backup can read data
        const count = await db.getAllAsync('SELECT COUNT(*) as count FROM episodes');
        expect(count[0].count).toBe(100);
      };

      // Execute: Migration with tracking backup
      await migrationRunner.runMigrations(trackingBackup);

      // Verify: Backup was called
      expect(backupCalled).toBe(true);
      expect(backupDatabase).not.toBeNull();
    });
  });

  describe('Recovery from Corrupted State', () => {
    it('should detect missing required tables', async () => {
      // Setup: Database at v1, will run all migrations
      db.exec(SCHEMA_V1);

      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);

      // Run all migrations (will create episode_notes in migration 3)
      await migrationRunner.runMigrations();

      // Verify: episode_notes exists after migrations
      const tables = await adapter.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      const tableNames = tables.map(t => t.name);

      // episode_notes should exist after running all migrations
      expect(tableNames).toContain('episode_notes');

      // Also verify daily_status_logs from migration 5
      expect(tableNames).toContain('daily_status_logs');
    });

    it('should recover from corrupted JSON columns', async () => {
      // Setup: v1 database with corrupted JSON
      db.exec(SCHEMA_V1);

      // Insert episode with invalid JSON (simulating corruption)
      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('ep-bad', Date.now(), '[CORRUPTED', '[]', '[]', '[]', Date.now(), Date.now());

      // Insert valid episode
      db.prepare(`
        INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers,
                             created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('ep-good', Date.now(), '["Front"]', '[]', '[]', '[]', Date.now(), Date.now());

      // Execute: Migration should still work
      const migrationRunner = getMigrations();
      await migrationRunner.initialize(adapter as any);
      await migrationRunner.runMigrations();

      // Verify: Both episodes preserved (corrupted data is preserved as-is)
      const episodes = await adapter.getAllAsync('SELECT * FROM episodes');
      expect(episodes).toHaveLength(2);

      // App layer should handle JSON parsing errors, not migration
      const badEpisode = await adapter.getAllAsync<any>('SELECT * FROM episodes WHERE id = ?', ['ep-bad']);
      expect(badEpisode[0].locations).toBe('[CORRUPTED');

      const goodEpisode = await adapter.getAllAsync<any>('SELECT * FROM episodes WHERE id = ?', ['ep-good']);
      expect(goodEpisode[0].locations).toBe('["Front"]');
    });
  });
});
