// Database schema and initialization

export const SCHEMA_VERSION = 1;

export const createTables = `
  -- Episodes table
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

  -- Intensity readings table
  CREATE TABLE IF NOT EXISTS intensity_readings (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    intensity REAL NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  -- Symptom logs table
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

  -- Medications table
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

  -- Medication schedules table
  CREATE TABLE IF NOT EXISTS medication_schedules (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    time TEXT NOT NULL,
    dosage REAL NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
  );

  -- Medication doses table
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

  -- Medication reminders table
  CREATE TABLE IF NOT EXISTS medication_reminders (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    scheduled_time INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    snoozed_until INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
  );

  -- Indexes for better query performance
  CREATE INDEX IF NOT EXISTS idx_episodes_start_time ON episodes(start_time);
  CREATE INDEX IF NOT EXISTS idx_intensity_readings_episode ON intensity_readings(episode_id);
  CREATE INDEX IF NOT EXISTS idx_symptom_logs_episode ON symptom_logs(episode_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_medication ON medication_doses(medication_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_episode ON medication_doses(episode_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_timestamp ON medication_doses(timestamp);
  CREATE INDEX IF NOT EXISTS idx_medication_reminders_scheduled ON medication_reminders(scheduled_time);
`;
