import Foundation
import GRDB

/// Central database manager. Owns the DatabaseQueue and handles schema creation/migration.
final class DatabaseManager: Sendable {
    /// The current schema version
    static let schemaVersion = 25

    /// Shared singleton for the app's main database
    static let shared = DatabaseManager()

    /// If database initialization failed, this holds the error.
    /// Check this at app launch to show a recovery UI instead of the normal app.
    /// Written once during singleton init, read-only thereafter.
    nonisolated(unsafe) static private(set) var initializationError: Error?

    /// The file URL of the database, available even when initialization failed
    /// so the user can export the file for recovery.
    /// Written once during singleton init, read-only thereafter.
    nonisolated(unsafe) static private(set) var databaseFileURL: URL?

    let dbQueue: DatabaseQueue

    /// Initialize with a file-based database at the default app location.
    /// On failure, falls back to an in-memory database so the app can launch
    /// and present recovery UI (e.g. exporting the corrupt database file).
    private init() {
        dbQueue = DatabaseManager.createDatabaseQueue()
    }

    /// Creates the database queue, falling back to in-memory on failure.
    /// Sets static properties for error state and file URL as side effects.
    private static func createDatabaseQueue() -> DatabaseQueue {
        let fileManager = FileManager.default
        do {
            let appSupport = try fileManager.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            let dbURL = appSupport.appendingPathComponent("migralog.db")
            databaseFileURL = dbURL
            var config = Configuration()
            config.foreignKeysEnabled = true
            #if DEBUG
            config.prepareDatabase { db in
                db.trace { print("SQL: \($0)") }
            }
            #endif
            let queue = try DatabaseQueue(path: dbURL.path, configuration: config)
            let mgr = DatabaseManager.buildMigrator()
            try mgr.migrate(queue)
            return queue
        } catch {
            initializationError = error
            // Fall back to an in-memory database so the app can launch
            // and present recovery UI to the user
            var fallbackConfig = Configuration()
            fallbackConfig.foreignKeysEnabled = true
            // swiftlint:disable:next force_try
            let queue = try! DatabaseQueue(configuration: fallbackConfig)
            let mgr = DatabaseManager.buildMigrator()
            try? mgr.migrate(queue)
            return queue
        }
    }

    /// Initialize with an in-memory database (for testing)
    init(inMemory: Bool) throws {
        var config = Configuration()
        config.foreignKeysEnabled = true
        if inMemory {
            dbQueue = try DatabaseQueue(configuration: config)
        } else {
            let tempDir = FileManager.default.temporaryDirectory
            let dbURL = tempDir.appendingPathComponent(UUID().uuidString + ".db")
            dbQueue = try DatabaseQueue(path: dbURL.path, configuration: config)
        }
        try migrator.migrate(dbQueue)
    }

    /// Initialize from an existing database file (for backup restore)
    init(path: String) throws {
        var config = Configuration()
        config.foreignKeysEnabled = true
        dbQueue = try DatabaseQueue(path: path, configuration: config)
    }

    private var migrator: DatabaseMigrator {
        DatabaseManager.buildMigrator()
    }

    private static func buildMigrator() -> DatabaseMigrator {
        var migrator = DatabaseMigrator()

        // v25: Full schema creation
        migrator.registerMigration("v25") { db in
            try DatabaseManager.createSchema(in: db)
        }

        return migrator
    }

    /// Create all tables, indexes, and constraints matching schema-v25.sql
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
                updated_at INTEGER NOT NULL CHECK(updated_at > 0)
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

        // Create all indexes
        try DatabaseManager.createIndexes(in: db)
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
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_category ON scheduled_notifications(category_identifier, scheduled_trigger_time) WHERE category_identifier IS NOT NULL")
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_content ON scheduled_notifications(notification_title, notification_body) WHERE notification_title IS NOT NULL")

        // Calendar overlays indexes
        try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_calendar_overlays_dates ON calendar_overlays(start_date, end_date)")
    }

    /// Reset the database (for testing / E2E)
    func resetDatabase() throws {
        try dbQueue.write { db in
            // Drop all tables in reverse dependency order
            try db.execute(sql: "DELETE FROM scheduled_notifications")
            try db.execute(sql: "DELETE FROM calendar_overlays")
            try db.execute(sql: "DELETE FROM daily_status_logs")
            try db.execute(sql: "DELETE FROM medication_reminders")
            try db.execute(sql: "DELETE FROM medication_doses")
            try db.execute(sql: "DELETE FROM medication_schedules")
            try db.execute(sql: "DELETE FROM episode_notes")
            try db.execute(sql: "DELETE FROM pain_location_logs")
            try db.execute(sql: "DELETE FROM symptom_logs")
            try db.execute(sql: "DELETE FROM intensity_readings")
            try db.execute(sql: "DELETE FROM episodes")
            try db.execute(sql: "DELETE FROM medications")
        }
    }

    /// Copy the database file to a destination path (for backup)
    func copyDatabase(to destinationPath: String) throws {
        try dbQueue.interrupt()
        try dbQueue.vacuum()
        let fileManager = FileManager.default
        let sourcePath = dbQueue.path
        if fileManager.fileExists(atPath: destinationPath) {
            try fileManager.removeItem(atPath: destinationPath)
        }
        try fileManager.copyItem(atPath: sourcePath, toPath: destinationPath)
    }
}

// MARK: - JSON Helpers

enum JSONHelper {
    static func encode<T: Encodable>(_ value: T) -> String {
        guard let data = try? JSONEncoder().encode(value),
              let string = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return string
    }

    static func decode<T: Decodable>(_ type: T.Type, from string: String) -> T? {
        guard let data = string.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    static func decodeArray<T: Decodable>(_ type: T.Type, from string: String?) -> [T] {
        guard let string = string,
              let data = string.data(using: .utf8),
              let result = try? JSONDecoder().decode([T].self, from: data) else {
            return []
        }
        return result
    }
}

// MARK: - Timestamp Helpers

enum TimestampHelper {
    static var now: Int64 {
        Int64(Date().timeIntervalSince1970 * 1000)
    }

    static func fromDate(_ date: Date) -> Int64 {
        Int64(date.timeIntervalSince1970 * 1000)
    }

    static func toDate(_ timestamp: Int64) -> Date {
        Date(timeIntervalSince1970: Double(timestamp) / 1000.0)
    }

    static func dateString(from date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.string(from: date)
    }

    static func dateFromString(_ string: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.date(from: string)
    }
}
