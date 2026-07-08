import Foundation
import GRDB

// Schema creation, sync-table/trigger setup, and index definitions for the v25
// baseline schema. Split out of DatabaseManager.swift to keep that file focused on
// queue ownership and the migration registry (and under the file_length limit).
extension DatabaseManager {
    /// Create the v25 baseline schema. Later registered migrations evolve it to the
    /// current version; see spec/schemas/sqlite/schema-v37.sql for the current end-state.
    // swiftlint:disable:next function_body_length
    static func createSchema(in db: Database) throws {
        // Episodes table
        try db.execute(sql: """
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
            )
            """)

        // Intensity readings table
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS intensity_readings (
                id TEXT PRIMARY KEY,
                episode_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL CHECK(timestamp > 0),
                intensity REAL NOT NULL CHECK(intensity >= 0 AND intensity <= 10),
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER NOT NULL CHECK(updated_at > 0),
                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
            )
            """)

        // Symptom logs table
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS symptom_logs (
                id TEXT PRIMARY KEY,
                episode_id TEXT NOT NULL,
                symptom TEXT NOT NULL,
                onset_time INTEGER NOT NULL CHECK(onset_time > 0),
                resolution_time INTEGER CHECK(resolution_time IS NULL OR resolution_time > onset_time),
                severity REAL CHECK(severity IS NULL OR (severity >= 0 AND severity <= 10)),
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER CHECK(updated_at IS NULL OR updated_at > 0),
                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
            )
            """)

        // Pain location logs table
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS pain_location_logs (
                id TEXT PRIMARY KEY,
                episode_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL CHECK(timestamp > 0),
                pain_locations TEXT NOT NULL,
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER NOT NULL CHECK(updated_at > 0),
                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
            )
            """)

        // Episode notes table
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS episode_notes (
                id TEXT PRIMARY KEY,
                episode_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL CHECK(timestamp > 0),
                note TEXT NOT NULL CHECK(length(note) > 0 AND length(note) <= 5000),
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER CHECK(updated_at IS NULL OR updated_at > 0),
                FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
            )
            """)

        // Medications table
        try db.execute(sql: """
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
                updated_at INTEGER NOT NULL CHECK(updated_at > 0),
                min_interval_hours REAL CHECK(min_interval_hours IS NULL OR min_interval_hours > 0),
                excluded_from_safety_warnings INTEGER CHECK(excluded_from_safety_warnings IS NULL OR excluded_from_safety_warnings IN (0, 1))
            )
            """)

        // Medication schedules table
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS medication_schedules (
                id TEXT PRIMARY KEY,
                medication_id TEXT NOT NULL,
                time TEXT NOT NULL CHECK(time GLOB '[0-2][0-9]:[0-5][0-9]'),
                timezone TEXT NOT NULL,
                dosage REAL NOT NULL DEFAULT 1 CHECK(dosage > 0),
                enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
                notification_id TEXT,
                reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK(reminder_enabled IN (0, 1)),
                created_at INTEGER CHECK(created_at IS NULL OR created_at > 0),
                updated_at INTEGER CHECK(updated_at IS NULL OR updated_at > 0),
                FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
            )
            """)

        // Medication doses table
        try db.execute(sql: """
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
            )
            """)

        // Medication reminders table
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS medication_reminders (
                id TEXT PRIMARY KEY,
                medication_id TEXT NOT NULL,
                scheduled_time INTEGER NOT NULL CHECK(scheduled_time > 0),
                completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
                snoozed_until INTEGER CHECK(snoozed_until IS NULL OR snoozed_until > scheduled_time),
                completed_at INTEGER CHECK(completed_at IS NULL OR completed_at > 0),
                FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
                CHECK(completed = 0 OR completed_at IS NOT NULL)
            )
            """)

        // Daily status logs table
        try db.execute(sql: """
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
            )
            """)

        // Calendar overlays table
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS calendar_overlays (
                id TEXT PRIMARY KEY,
                start_date TEXT NOT NULL CHECK(start_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
                end_date TEXT CHECK(end_date IS NULL OR end_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
                label TEXT NOT NULL CHECK(length(label) > 0 AND length(label) <= 200),
                notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
                exclude_from_stats INTEGER NOT NULL DEFAULT 0 CHECK(exclude_from_stats IN (0, 1)),
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER NOT NULL CHECK(updated_at > 0),
                CHECK(end_date IS NULL OR end_date >= start_date)
            )
            """)

        // Scheduled notifications table
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS scheduled_notifications (
                id TEXT PRIMARY KEY,
                medication_id TEXT,
                schedule_id TEXT,
                date TEXT NOT NULL,
                notification_id TEXT NOT NULL,
                notification_type TEXT NOT NULL DEFAULT 'reminder' CHECK(notification_type IN ('reminder', 'follow_up', 'daily_checkin')),
                is_grouped INTEGER DEFAULT 0 CHECK(is_grouped IN (0, 1)),
                group_key TEXT,
                source_type TEXT NOT NULL DEFAULT 'medication' CHECK(source_type IN ('medication', 'daily_checkin')),
                medication_name TEXT CHECK(medication_name IS NULL OR length(medication_name) <= 200),
                scheduled_trigger_time TEXT,
                notification_title TEXT,
                notification_body TEXT,
                category_identifier TEXT CHECK(category_identifier IS NULL OR length(category_identifier) <= 50),
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
                FOREIGN KEY (schedule_id) REFERENCES medication_schedules(id) ON DELETE CASCADE,
                UNIQUE(medication_id, schedule_id, date, notification_type)
            )
            """)

        // Category usage limits table (MOH risk thresholds per medication category)
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS category_usage_limits (
                category TEXT PRIMARY KEY,
                max_days INTEGER NOT NULL,
                window_days INTEGER NOT NULL
            )
            """)

        // Create all indexes
        try DatabaseManager.createIndexes(in: db)

        // Local sync-state tables (#434), device-local. The change-capture triggers are
        // NOT created here — they reference category_safety_rules (created in v28), so
        // they're created by the v32 migration once every synced table exists.
        try DatabaseManager.createSyncStateTables(in: db)
        try DatabaseManager.createSyncConfig(in: db)
    }

    /// Create `sync_config` (#434): the device-local on/off switch for iCloud sync plus
    /// last-sync status. Idempotent — called from createSchema and the v33 migration.
    static func createSyncConfig(in db: Database) throws {
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS sync_config (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
                last_synced_at INTEGER,
                last_error TEXT
            )
            """)
        try db.execute(sql: "INSERT OR IGNORE INTO sync_config (id, enabled) VALUES (1, 0)")
    }

    /// Create the device-local sync-state tables for iCloud sync (#434): the outbound
    /// change queue, the per-zone server-change-token cursor, and the conflict archive.
    /// These are NOT synced. Idempotent — called from createSchema (fresh installs) and
    /// the v30/v31 migrations (upgrades). sync_config arrives later with the settings UI.
    static func createSyncStateTables(in db: Database) throws {
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS sync_pending_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                change_type TEXT NOT NULL CHECK(change_type IN ('upsert', 'delete')),
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                retry_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                UNIQUE(table_name, record_id)
            )
            """)
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS sync_zone_state (
                zone_name TEXT PRIMARY KEY,
                server_change_token BLOB,
                last_sync_at INTEGER CHECK(last_sync_at IS NULL OR last_sync_at > 0),
                last_error TEXT,
                last_error_at INTEGER CHECK(last_error_at IS NULL OR last_error_at > 0),
                last_synced_schema TEXT
            )
            """)
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_sync_pending_created ON sync_pending_changes(created_at)")
        // Conflict archive (v31): preserves the losing side of last-write-wins for 90 days.
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS sync_conflicts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                losing_side TEXT NOT NULL CHECK(losing_side IN ('local', 'remote')),
                payload TEXT NOT NULL,
                winning_payload TEXT NOT NULL,
                resolved_at INTEGER NOT NULL CHECK(resolved_at > 0),
                expires_at INTEGER NOT NULL CHECK(expires_at > resolved_at)
            )
            """)
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_sync_conflicts_expires ON sync_conflicts(expires_at)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_sync_conflicts_record ON sync_conflicts(table_name, record_id)")
    }

    /// v34 (#463): add the nullable `payload` column to sync_pending_changes and rebuild
    /// the capture triggers so DELETEs retain the deleted row's data for recoverable
    /// tombstones. Existing installs already created the old payload-free triggers in v32,
    /// so they are dropped and re-created here with `includePayload: true`. Idempotent: the
    /// column is added only when missing, and the triggers are dropped before re-creation.
    static func addSyncPayloadColumn(in db: Database) throws {
        let columns = try Row.fetchAll(db, sql: "PRAGMA table_info(sync_pending_changes)")
        let hasPayload = columns.contains { (row: Row) in (row["name"] as String?) == "payload" }
        if !hasPayload {
            try db.execute(sql: "ALTER TABLE sync_pending_changes ADD COLUMN payload TEXT")
        }

        // Drop the old (payload-free) capture triggers so they can be re-created with the
        // delete-payload variant. Each synced table has insert/update/delete triggers.
        for table in SyncableTable.allCases {
            for suffix in ["insert", "update", "delete"] {
                try db.execute(sql: "DROP TRIGGER IF EXISTS sync_capture_\(table.tableName)_\(suffix)")
            }
        }
        try DatabaseManager.createSyncCaptureTriggers(in: db, includePayload: true)
    }

    /// v36 (#469): add the nullable `last_synced_schema` column (the synced-column
    /// manifest, see SyncedSchemaManifest) to sync_zone_state when missing. Fresh
    /// installs already create it in createSyncStateTables.
    static func addLastSyncedSchemaColumn(in db: Database) throws {
        let columns = try Row.fetchAll(db, sql: "PRAGMA table_info(sync_zone_state)")
        let hasColumn = columns.contains { (row: Row) in
            (row["name"] as String?) == "last_synced_schema"
        }
        if !hasColumn {
            try db.execute(sql: "ALTER TABLE sync_zone_state ADD COLUMN last_synced_schema TEXT")
        }
    }

    /// Create `tracking_options` (v35): user customization of the pain-quality /
    /// symptom / trigger pick lists. Rows are either custom options (is_built_in = 0,
    /// `value` is the user's text verbatim) or visibility overrides hiding a built-in
    /// (is_built_in = 1, `value` is the built-in's snake_case raw value). Visible
    /// built-ins have no row — only deviations from the defaults are stored. Synced
    /// via SyncableTable.trackingOptions. Idempotent.
    static func createTrackingOptionsTable(in db: Database) throws {
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS tracking_options (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL CHECK(category IN ('pain_quality', 'symptom', 'trigger')),
                value TEXT NOT NULL CHECK(length(value) > 0 AND length(value) <= 100),
                is_built_in INTEGER NOT NULL DEFAULT 0 CHECK(is_built_in IN (0, 1)),
                is_hidden INTEGER NOT NULL DEFAULT 0 CHECK(is_hidden IN (0, 1)),
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER CHECK(updated_at IS NULL OR updated_at > 0),
                UNIQUE(category, value)
            )
            """)
        try db.execute(sql: """
            CREATE INDEX IF NOT EXISTS idx_tracking_options_category
            ON tracking_options(category)
            """)
    }

    /// Create the change-capture machinery for iCloud sync (#434): the sync_capture_state
    /// control row plus one AFTER INSERT/UPDATE/DELETE trigger per synced table. Each
    /// trigger enqueues the row into sync_pending_changes — but only while capture is
    /// `enabled` (off until sync is switched on, so the queue can't grow unbounded) and
    /// not `suppressed` (the applier suppresses its own writes to avoid an echo loop).
    /// Device-local; idempotent.
    ///
    /// `includePayload` controls whether the DELETE triggers capture the deleted row's
    /// synced columns as a JSON `payload` for recoverable tombstones (#463). It MUST be
    /// false at v32 (the `payload` column does not exist until v34) and true from v34 on,
    /// once the column has been added. INSERT/UPDATE (upsert) triggers always set
    /// `payload = NULL` — the live row is re-read at push time.
    static func createSyncCaptureTriggers(in db: Database, includePayload: Bool) throws {
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS sync_capture_state (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
                suppressed INTEGER NOT NULL DEFAULT 0 CHECK(suppressed IN (0, 1))
            )
            """)
        try db.execute(sql: "INSERT OR IGNORE INTO sync_capture_state (id, enabled, suppressed) VALUES (1, 0, 0)")

        // Epoch milliseconds, matching TimestampHelper.now.
        let nowMillis = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)"
        let guardClause = """
            WHEN COALESCE((SELECT enabled FROM sync_capture_state WHERE id = 1), 0) = 1
             AND COALESCE((SELECT suppressed FROM sync_capture_state WHERE id = 1), 0) = 0
            """

        for table in SyncableTable.allCases {
            let name = table.tableName
            // Skip tables that don't exist yet: on fresh installs the v32/v34 migrations
            // run before the migrations that create later synced tables (e.g.
            // tracking_options in v35), and a CREATE TRIGGER on a missing table fails.
            // The creating migration re-runs this helper once the table exists.
            let tableExists = try Bool.fetchOne(
                db,
                sql: "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = ?",
                arguments: [name]
            ) ?? false
            guard tableExists else { continue }
            // The DELETE trigger snapshots the deleted row's synced columns as JSON so the
            // tombstone is recoverable. Built only when includePayload is true (the column
            // exists from v34 on). OLD.<col> references the about-to-be-deleted row.
            let deletePayloadExpr = "json_object(" + table.syncedColumns
                .map { "'\($0)', OLD.\($0)" }
                .joined(separator: ", ") + ")"

            let events: [(suffix: String, timing: String, idRef: String, change: String)] = [
                ("insert", "AFTER INSERT", "NEW.id", "upsert"),
                ("update", "AFTER UPDATE", "NEW.id", "upsert"),
                ("delete", "AFTER DELETE", "OLD.id", "delete"),
            ]
            for event in events {
                // Only the DELETE trigger captures a payload; upserts re-read the live row at push time.
                let payloadExpr = event.change == "delete" ? deletePayloadExpr : "NULL"
                let columnList = includePayload
                    ? "(table_name, record_id, change_type, created_at, retry_count, last_error, payload)"
                    : "(table_name, record_id, change_type, created_at, retry_count, last_error)"
                let valuesList = includePayload
                    ? "('\(name)', \(event.idRef), '\(event.change)', \(nowMillis), 0, NULL, \(payloadExpr))"
                    : "('\(name)', \(event.idRef), '\(event.change)', \(nowMillis), 0, NULL)"
                let payloadConflictAssignment = includePayload
                    ? ",\n                            payload = \(payloadExpr)"
                    : ""
                try db.execute(sql: """
                    CREATE TRIGGER IF NOT EXISTS sync_capture_\(name)_\(event.suffix)
                    \(event.timing) ON \(name)
                    \(guardClause)
                    BEGIN
                        INSERT INTO sync_pending_changes
                            \(columnList)
                        VALUES \(valuesList)
                        ON CONFLICT(table_name, record_id) DO UPDATE SET
                            change_type = '\(event.change)',
                            created_at = \(nowMillis),
                            retry_count = 0,
                            last_error = NULL\(payloadConflictAssignment);
                    END
                    """)
            }
        }
    }

    private static func createIndexes(in db: Database) throws {
        // Primary lookup indexes
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_episodes_start_time ON episodes(start_time)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_intensity_readings_episode ON intensity_readings(episode_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_symptom_logs_episode ON symptom_logs(episode_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_pain_location_logs_episode ON pain_location_logs(episode_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_medication_doses_medication ON medication_doses(medication_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_medication_doses_episode ON medication_doses(episode_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_medication_doses_timestamp ON medication_doses(timestamp)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_medication_reminders_scheduled ON medication_reminders(scheduled_time)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_daily_status_date ON daily_status_logs(date)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_daily_status_status ON daily_status_logs(status)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_episode_notes_episode ON episode_notes(episode_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_episode_notes_timestamp ON episode_notes(episode_id, timestamp)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_date ON scheduled_notifications(date)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_group ON scheduled_notifications(group_key, date)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_notification_id ON scheduled_notifications(notification_id)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_source_type ON scheduled_notifications(source_type, date)")

        // Composite indexes
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_episodes_date_range ON episodes(start_time, end_time)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_medications_active_type ON medications(active, type) WHERE active = 1")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_medication_doses_med_time ON medication_doses(medication_id, timestamp DESC)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_reminders_incomplete ON medication_reminders(medication_id, scheduled_time) WHERE completed = 0")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_intensity_readings_time ON intensity_readings(episode_id, timestamp)")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_daily_status_date_status ON daily_status_logs(date, status)")

        // Scheduled notifications metadata indexes
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_medication_name ON scheduled_notifications(medication_name, date) WHERE medication_name IS NOT NULL")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_trigger_time ON scheduled_notifications(scheduled_trigger_time) WHERE scheduled_trigger_time IS NOT NULL")
        // swiftlint:disable:next line_length
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_category ON scheduled_notifications(category_identifier, scheduled_trigger_time) WHERE category_identifier IS NOT NULL")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_content ON scheduled_notifications(notification_title, notification_body) WHERE notification_title IS NOT NULL")

        // Calendar overlays indexes
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_calendar_overlays_dates ON calendar_overlays(start_date, end_date)")
    }
}
