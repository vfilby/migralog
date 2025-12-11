// Database schema and initialization

export const SCHEMA_VERSION = 20;

export const createTables = `
  -- Episodes table
  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    start_time INTEGER NOT NULL CHECK(start_time > 0),
    end_time INTEGER CHECK(end_time IS NULL OR end_time > start_time),
    locations TEXT NOT NULL,
    qualities TEXT NOT NULL,
    symptoms TEXT NOT NULL,
    triggers TEXT NOT NULL,
    notes TEXT CHECK(length(notes) <= 5000),
    latitude REAL CHECK(latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    longitude REAL CHECK(longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
    location_accuracy REAL CHECK(location_accuracy IS NULL OR location_accuracy >= 0),
    location_timestamp INTEGER CHECK(location_timestamp IS NULL OR location_timestamp > 0),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0)
  );

  -- Intensity readings table
  CREATE TABLE IF NOT EXISTS intensity_readings (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL CHECK(timestamp > 0),
    intensity REAL NOT NULL CHECK(intensity >= 0 AND intensity <= 10),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  -- Symptom logs table
  CREATE TABLE IF NOT EXISTS symptom_logs (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    symptom TEXT NOT NULL,
    onset_time INTEGER NOT NULL CHECK(onset_time > 0),
    resolution_time INTEGER CHECK(resolution_time IS NULL OR resolution_time > onset_time),
    severity REAL CHECK(severity IS NULL OR (severity >= 0 AND severity <= 10)),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  -- Pain location logs table (tracks changes in pain location areas over time)
  CREATE TABLE IF NOT EXISTS pain_location_logs (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL CHECK(timestamp > 0),
    pain_locations TEXT NOT NULL,  -- JSON array of PainLocation[] (e.g., ['left_temple', 'right_eye'])
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  -- Episode notes table
  CREATE TABLE IF NOT EXISTS episode_notes (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL CHECK(timestamp > 0),
    note TEXT NOT NULL CHECK(length(note) > 0 AND length(note) <= 5000),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  -- Medications table
  CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) > 0 AND length(name) <= 200),
    type TEXT NOT NULL CHECK(type IN ('preventative', 'rescue', 'other')),
    dosage_amount REAL NOT NULL CHECK(dosage_amount > 0),
    dosage_unit TEXT NOT NULL CHECK(length(dosage_unit) > 0 AND length(dosage_unit) <= 50),
    default_quantity REAL CHECK(default_quantity IS NULL OR default_quantity > 0),
    schedule_frequency TEXT CHECK(schedule_frequency IS NULL OR schedule_frequency IN ('daily', 'monthly', 'quarterly')),
    photo_uri TEXT CHECK(photo_uri IS NULL OR length(photo_uri) <= 500),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
    category TEXT CHECK(category IS NULL OR category IN ('otc', 'nsaid', 'triptan', 'cgrp', 'preventive', 'supplement', 'other')),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0)
  );

  -- Medication schedules table
  CREATE TABLE IF NOT EXISTS medication_schedules (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    time TEXT NOT NULL CHECK(time GLOB '[0-2][0-9]:[0-5][0-9]'),
    timezone TEXT NOT NULL,
    dosage REAL NOT NULL DEFAULT 1 CHECK(dosage > 0),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    notification_id TEXT,
    reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK(reminder_enabled IN (0, 1)),
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
  );

  -- Medication doses table
  CREATE TABLE IF NOT EXISTS medication_doses (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL CHECK(timestamp > 0),
    quantity REAL NOT NULL CHECK(quantity >= 0),
    dosage_amount REAL,
    dosage_unit TEXT,
    status TEXT NOT NULL DEFAULT 'taken' CHECK(status IN ('taken', 'skipped')),
    episode_id TEXT,
    effectiveness_rating REAL CHECK(effectiveness_rating IS NULL OR (effectiveness_rating >= 0 AND effectiveness_rating <= 10)),
    time_to_relief INTEGER CHECK(time_to_relief IS NULL OR (time_to_relief > 0 AND time_to_relief <= 1440)),
    side_effects TEXT,
    notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0),
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL,
    CHECK(status != 'taken' OR quantity > 0)
  );

  -- Medication reminders table
  CREATE TABLE IF NOT EXISTS medication_reminders (
    id TEXT PRIMARY KEY,
    medication_id TEXT NOT NULL,
    scheduled_time INTEGER NOT NULL CHECK(scheduled_time > 0),
    completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
    snoozed_until INTEGER CHECK(snoozed_until IS NULL OR snoozed_until > scheduled_time),
    completed_at INTEGER CHECK(completed_at IS NULL OR completed_at > 0),
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
    CHECK(completed = 0 OR completed_at IS NOT NULL)
  );

  -- Daily status logs table
  CREATE TABLE IF NOT EXISTS daily_status_logs (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE CHECK(date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    status TEXT NOT NULL CHECK(status IN ('green', 'yellow', 'red')),
    status_type TEXT CHECK(status_type IS NULL OR status_type IN ('prodrome', 'postdrome', 'anxiety', 'other')),
    notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
    prompted INTEGER NOT NULL DEFAULT 0 CHECK(prompted IN (0, 1)),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0),
    CHECK(status = 'yellow' OR status_type IS NULL)
  );

  -- Indexes for better query performance
  CREATE INDEX IF NOT EXISTS idx_episodes_start_time ON episodes(start_time);
  CREATE INDEX IF NOT EXISTS idx_intensity_readings_episode ON intensity_readings(episode_id);
  CREATE INDEX IF NOT EXISTS idx_symptom_logs_episode ON symptom_logs(episode_id);
  CREATE INDEX IF NOT EXISTS idx_pain_location_logs_episode ON pain_location_logs(episode_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_medication ON medication_doses(medication_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_episode ON medication_doses(episode_id);
  CREATE INDEX IF NOT EXISTS idx_medication_doses_timestamp ON medication_doses(timestamp);
  CREATE INDEX IF NOT EXISTS idx_medication_reminders_scheduled ON medication_reminders(scheduled_time);
  CREATE INDEX IF NOT EXISTS idx_daily_status_date ON daily_status_logs(date);
  CREATE INDEX IF NOT EXISTS idx_daily_status_status ON daily_status_logs(status);
  CREATE INDEX IF NOT EXISTS idx_episode_notes_episode ON episode_notes(episode_id);
  CREATE INDEX IF NOT EXISTS idx_episode_notes_timestamp ON episode_notes(episode_id, timestamp);

  -- Composite indexes for common query patterns (added in v9)
  CREATE INDEX IF NOT EXISTS idx_episodes_date_range ON episodes(start_time, end_time);
  CREATE INDEX IF NOT EXISTS idx_medications_active_type ON medications(active, type) WHERE active = 1;
  CREATE INDEX IF NOT EXISTS idx_medication_doses_med_time ON medication_doses(medication_id, timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_reminders_incomplete ON medication_reminders(medication_id, scheduled_time) WHERE completed = 0;
  CREATE INDEX IF NOT EXISTS idx_intensity_readings_time ON intensity_readings(episode_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_daily_status_date_status ON daily_status_logs(date, status);
`;
