import Foundation
import GRDB
#if canImport(UIKit)
import UIKit
#endif

/// Classifies why database initialization failed so callers can react
/// differently to a recoverable, transient locked-device condition versus
/// genuine file corruption.
enum DatabaseInitializationError: Error {
    /// The database file could not be opened because the device is in the
    /// boot→first-unlock (BFU) window and the file's data-protection class
    /// keeps it encrypted at rest until the first unlock. This is transient:
    /// the file is intact and becomes readable once the device is unlocked.
    /// We must NOT treat this as corruption — doing so would let writes (e.g. a
    /// lock-screen dose log) silently land in an empty in-memory DB and be lost.
    case protectedDataUnavailable(underlying: Error)

    /// The database file appears genuinely unreadable (e.g. on-disk
    /// corruption). The in-memory fallback is used so recovery UI can run.
    case corruption(underlying: Error)
}

/// Central database manager. Owns the DatabaseQueue and handles schema creation/migration.
final class DatabaseManager: Sendable {
    /// The current schema version
    static let schemaVersion = 36

    /// Shared singleton for the app's main database
    static let shared = DatabaseManager()

    /// If database initialization failed, this holds the error.
    /// Check this at app launch to show a recovery UI instead of the normal app.
    /// Written once during singleton init, read-only thereafter.
    nonisolated(unsafe) static private(set) var initializationError: Error?

    /// True when the live `dbQueue` is the empty in-memory fallback rather than
    /// the on-disk database. Any path that persists data (dose logging, sync)
    /// MUST check this and refuse to write/sync rather than silently committing
    /// to a throwaway DB. Written once during singleton init, read-only thereafter.
    nonisolated(unsafe) static private(set) var isUsingInMemoryFallback = false

    /// True when initialization failed specifically because protected data was
    /// unavailable (BFU window). Distinguishes the transient locked-device case
    /// from genuine corruption so callers can defer/retry instead of dropping data.
    nonisolated(unsafe) static private(set) var protectedDataUnavailable = false

    /// The file URL of the database, available even when initialization failed
    /// so the user can export the file for recovery.
    /// Written once during singleton init, read-only thereafter.
    nonisolated(unsafe) static private(set) var databaseFileURL: URL?

    #if DEBUG
    /// Test-only: override the in-memory-fallback flag so the sync/dose gating can be
    /// exercised without forcing a real locked-device open failure. Always reset in the
    /// test's teardown. Not compiled into Release.
    static func setInMemoryFallbackForTesting(_ value: Bool) {
        isUsingInMemoryFallback = value
    }
    #endif

    /// The live database queue. Internally mutable only so the transient
    /// locked-device (BFU) fallback can be swapped for the real on-disk queue
    /// once the device unlocks (see `reopenOnDiskDatabaseIfNeeded()`); after a
    /// genuine-corruption fallback it is never swapped. The swap happens on the
    /// main actor at foreground, before any normal write path runs.
    nonisolated(unsafe) private(set) var dbQueue: DatabaseQueue

    /// Initialize with a file-based database at the default app location.
    /// On failure, falls back to an in-memory database so the app can launch
    /// and present recovery UI (e.g. exporting the corrupt database file).
    private init() {
        dbQueue = DatabaseManager.createDatabaseQueue()
    }

    /// Whether the device's protected data (Data Protection–encrypted files) is
    /// currently available. False during the BFU window before the first unlock.
    /// Defaults to `true` on platforms without UIKit so tests/tools aren't gated.
    static var isProtectedDataAvailable: Bool {
        #if canImport(UIKit)
        return UIApplication.shared.isProtectedDataAvailable
        #else
        return true
        #endif
    }

    /// Classify a database-open failure. Returns a `DatabaseInitializationError`
    /// describing whether this is a transient locked-device (BFU) condition or
    /// genuine corruption. Pure and side-effect free so it can be unit tested:
    /// `protectedDataAvailable` is injected rather than read from UIKit.
    ///
    /// Transient when the SQLite primary result code is `SQLITE_IOERR` (10),
    /// `SQLITE_CANTOPEN` (14), or `SQLITE_AUTH` (23) AND protected data is
    /// unavailable — the file is encrypted at rest until first unlock.
    static func classifyOpenFailure(
        _ error: Error,
        protectedDataAvailable: Bool
    ) -> DatabaseInitializationError {
        let transientCodes: [ResultCode] = [.SQLITE_IOERR, .SQLITE_CANTOPEN, .SQLITE_AUTH]
        if let dbError = error as? DatabaseError,
           transientCodes.contains(dbError.resultCode),
           !protectedDataAvailable {
            return .protectedDataUnavailable(underlying: error)
        }
        return .corruption(underlying: error)
    }

    /// Creates the database queue.
    ///
    /// On a genuine open failure (corruption) it falls back to an empty in-memory
    /// database so the app can launch and present recovery UI. On a transient
    /// locked-device (BFU) failure it records the error and still returns an
    /// in-memory queue (the app process must come up), but flags
    /// `protectedDataUnavailable` / `isUsingInMemoryFallback` so write paths and
    /// sync refuse to commit to the throwaway DB — the real on-disk DB is reopened
    /// in `reopenOnDiskDatabaseIfNeeded()` once the device is unlocked.
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
            // No SQL tracing, even in DEBUG: statements embed health data
            // (episodes, medications, notes) and must stay out of console
            // output and captured build/test logs.
            let queue = try DatabaseQueue(path: dbURL.path, configuration: config)
            let mgr = DatabaseManager.buildMigrator()
            backUpBeforePendingMigrations(queue: queue, migrator: mgr)
            try mgr.migrate(queue)
            return queue
        } catch {
            let classified = classifyOpenFailure(
                error,
                protectedDataAvailable: isProtectedDataAvailable
            )
            initializationError = classified
            isUsingInMemoryFallback = true
            if case .protectedDataUnavailable = classified {
                // Transient: the on-disk DB is intact but encrypted until first
                // unlock. Do NOT treat this as corruption. The in-memory queue
                // exists only so the process launches; writers/sync must check
                // `isUsingInMemoryFallback` and defer. Reopened once unlocked.
                protectedDataUnavailable = true
            }
            // Fall back to an in-memory database so the app can launch.
            var fallbackConfig = Configuration()
            fallbackConfig.foreignKeysEnabled = true
            // swiftlint:disable:next force_try
            let queue = try! DatabaseQueue(configuration: fallbackConfig)
            let mgr = DatabaseManager.buildMigrator()
            try? mgr.migrate(queue)
            return queue
        }
    }

    /// Take a `migration` backup of the on-disk database when there are pending schema
    /// migrations, so a failed or incorrect migration can be rolled back. Best-effort:
    /// any failure is logged and swallowed so it never blocks app launch / migration.
    ///
    /// Skips two cases that need no protection:
    /// - Fresh installs (no migrations applied yet) — there is no existing data to lose.
    /// - Already up-to-date databases (no pending migrations) — nothing is about to change.
    ///
    /// After backing up, prunes old auto-created backups to the retention limit.
    private static func backUpBeforePendingMigrations(queue: DatabaseQueue, migrator: DatabaseMigrator) {
        do {
            let (applied, isComplete) = try queue.read { db in
                (try migrator.appliedMigrations(db), try migrator.hasCompletedMigrations(db))
            }
            // Fresh install (nothing applied) or already current → no backup needed.
            guard !applied.isEmpty, !isComplete else { return }

            // Derive the pre-migration version for the metadata, e.g. "v34" → 34.
            let fromVersion = applied
                .compactMap { Int($0.drop { !$0.isNumber }) }
                .max() ?? 0

            // Counts are best-effort: the episodes/medications tables exist from the v25
            // baseline, but a pre-baseline import might lack them — default to 0 if so.
            let counts = (try? queue.read { db in
                (episodes: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes") ?? 0,
                 medications: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medications") ?? 0)
            }) ?? (episodes: 0, medications: 0)

            let service = BackupService()
            _ = try service.createPreMigrationBackup(
                sourceDBPath: queue.path,
                schemaVersion: fromVersion,
                episodeCount: counts.episodes,
                medicationCount: counts.medications
            )
            try? service.pruneAutomaticBackups()
            AppLogger.shared.info("Created pre-migration backup (schema v\(fromVersion) → v\(schemaVersion))")
        } catch {
            // Never block migration on a backup failure. No PHI in the error description.
            AppLogger.shared.error("Pre-migration backup failed (continuing with migration)", error: error)
        }
    }

    /// After the device has unlocked for the first time (protected data is now
    /// available), attempt to reopen the real on-disk database if we are running
    /// on the transient BFU in-memory fallback. On success the in-memory queue is
    /// swapped out, the error/fallback flags are cleared, and the explicit Class C
    /// file-protection attribute is (re-)applied. A no-op once already on disk, or
    /// when the fallback was due to genuine corruption (recovery UI owns that).
    ///
    /// Safe to call repeatedly. Must be called once protected data is available
    /// (e.g. from `applicationProtectedDataDidBecomeAvailable` or at foreground).
    func reopenOnDiskDatabaseIfNeeded() {
        guard DatabaseManager.protectedDataUnavailable,
              DatabaseManager.isProtectedDataAvailable,
              let dbURL = DatabaseManager.databaseFileURL else {
            // Still on disk, genuine corruption, or protected data not yet
            // available — apply protection where it's safe and return.
            DatabaseManager.applyFileProtectionIfPossible()
            return
        }
        do {
            var config = Configuration()
            config.foreignKeysEnabled = true
            let queue = try DatabaseQueue(path: dbURL.path, configuration: config)
            let mgr = DatabaseManager.buildMigrator()
            DatabaseManager.backUpBeforePendingMigrations(queue: queue, migrator: mgr)
            try mgr.migrate(queue)
            dbQueue = queue
            DatabaseManager.initializationError = nil
            DatabaseManager.isUsingInMemoryFallback = false
            DatabaseManager.protectedDataUnavailable = false
            DatabaseManager.applyFileProtectionIfPossible()
        } catch {
            // Reopen still failing after unlock: leave the fallback flags set so
            // writers/sync keep deferring rather than committing to the throwaway
            // in-memory DB. Will be retried on the next protected-data/foreground
            // signal. No PHI in the error description.
            AppLogger.shared.error("Failed to reopen on-disk database after unlock", error: error)
        }
    }

    /// Make the Class C data-protection class explicit on the existing database
    /// file by setting `.completeUntilFirstUserAuthentication`. This is a fast key
    /// re-wrap, not a migration. Only runs when protected data is available (so the
    /// file is readable) and the file exists. Safe to call repeatedly.
    static func applyFileProtectionIfPossible() {
        guard isProtectedDataAvailable, let dbURL = databaseFileURL else { return }
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: dbURL.path) else { return }
        do {
            try fileManager.setAttributes(
                [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                ofItemAtPath: dbURL.path
            )
        } catch {
            // Non-fatal: the entitlement-driven default already covers most
            // installs. No PHI in the error description.
            AppLogger.shared.error("Failed to set database file protection", error: error)
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

        // v26: Add medication cooldown (minimum interval between doses).
        // Fresh installs already create the column in v25's CREATE TABLE, so only
        // add it when missing to support both upgrade and fresh-install paths.
        migrator.registerMigration("v26") { db in
            let columns = try Row.fetchAll(db, sql: "PRAGMA table_info(medications)")
            let hasColumn = columns.contains { (row: Row) in
                (row["name"] as String?) == "min_interval_hours"
            }
            if !hasColumn {
                try db.execute(sql: "ALTER TABLE medications ADD COLUMN min_interval_hours REAL")
            }
        }

        // v27: Add category_usage_limits table for per-category MOH risk warnings.
        // Fresh installs already create the table in v25's CREATE TABLE block;
        // this migration is a no-op when it exists (CREATE TABLE IF NOT EXISTS).
        migrator.registerMigration("v27") { db in
            try db.execute(sql: """
                CREATE TABLE IF NOT EXISTS category_usage_limits (
                    category TEXT PRIMARY KEY,
                    max_days INTEGER NOT NULL,
                    window_days INTEGER NOT NULL
                )
                """)
        }

        // v28: Rename category_usage_limits → category_safety_rules with a
        // rule-type discriminator. Existing MOH day-count rows become
        // type='period_limit' rows; cooldown rows will be added later.
        migrator.registerMigration("v28") { db in
            try DatabaseManager.migrateToCategorySafetyRules(in: db)
        }

        // v29: Add the last-write-wins `updated_at` timestamps required by iCloud
        // sync (#434) to synced tables that lacked them. See addSyncTimestampColumns.
        migrator.registerMigration("v29") { db in
            try DatabaseManager.addSyncTimestampColumns(in: db)
        }

        // v30: Local sync-state tables for iCloud sync (#434) — the outbound change
        // queue and the per-zone server-change-token cursor. Device-local, never
        // synced. See createSyncStateTables.
        migrator.registerMigration("v30") { db in
            try DatabaseManager.createSyncStateTables(in: db)
        }

        // v31: Add the conflict archive (sync_conflicts) for last-write-wins (#434).
        // createSyncStateTables is idempotent, so this just adds the new table for
        // installs that already ran v30 without it.
        migrator.registerMigration("v31") { db in
            try DatabaseManager.createSyncStateTables(in: db)
        }

        // v32: Change-capture triggers that enqueue local edits to sync_pending_changes,
        // plus the sync_capture_state control flags (enabled / suppressed). See #434.
        // includePayload: false — at v32 the `payload` column does not yet exist (it is
        // added in v34), so the triggers must NOT reference it. Preserves historical
        // behavior for fresh installs, which run v32 before v34.
        migrator.registerMigration("v32") { db in
            try DatabaseManager.createSyncCaptureTriggers(in: db, includePayload: false)
        }

        // v33: sync_config — the on/off switch + last-sync status for iCloud sync (#434).
        migrator.registerMigration("v33") { db in
            try DatabaseManager.createSyncConfig(in: db)
        }

        // v34: Capture delete payloads for recoverable tombstones (#463). Add the nullable
        // `payload` column to sync_pending_changes, then DROP and re-create every
        // sync_capture_* trigger so the DELETE triggers record the deleted row's synced
        // columns as JSON. Existing installs already ran v32 with the old (payload-free)
        // triggers, so they must be replaced here. Now that the column exists,
        // includePayload: true.
        migrator.registerMigration("v34") { db in
            try DatabaseManager.addSyncPayloadColumn(in: db)
        }

        // v35: tracking_options — user customization of the pain-quality / symptom /
        // trigger pick lists (custom additions + hidden built-ins). Synced. Created
        // here (after the trigger migrations), so createSyncCaptureTriggers re-runs to
        // add this table's capture triggers; on fresh installs v32/v34 skip it because
        // the table doesn't exist yet when they run.
        migrator.registerMigration("v35") { db in
            try DatabaseManager.createTrackingOptionsTable(in: db)
            try DatabaseManager.createSyncCaptureTriggers(in: db, includePayload: true)
        }

        // v36 (#469): add `last_synced_schema` to sync_zone_state — the synced-column
        // manifest stamped after each completed pull, so the sync engine can detect
        // that a migration added synced columns and force a one-time full re-pull to
        // backfill rows synced before the upgrade.
        migrator.registerMigration("v36") { db in
            try DatabaseManager.addLastSyncedSchemaColumn(in: db)
        }

        return migrator
    }

    /// Create `category_safety_rules` and migrate any existing
    /// `category_usage_limits` rows into it as period_limit entries.
    static func migrateToCategorySafetyRules(in db: Database) throws {
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS category_safety_rules (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('cooldown','period_limit')),
                period_hours REAL NOT NULL CHECK(period_hours > 0),
                max_count INTEGER CHECK(max_count IS NULL OR max_count > 0),
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                updated_at INTEGER CHECK(updated_at IS NULL OR updated_at > 0),
                UNIQUE(category, type)
            )
            """)
        try db.execute(sql: """
            CREATE INDEX IF NOT EXISTS idx_category_safety_rules_category
            ON category_safety_rules(category)
            """)

        let legacyExists = try Bool.fetchOne(
            db,
            sql: "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = 'category_usage_limits'"
        ) ?? false
        guard legacyExists else { return }

        let rows = try Row.fetchAll(
            db,
            sql: "SELECT category, max_days, window_days FROM category_usage_limits"
        )
        let nowMillis = TimestampHelper.now
        for row in rows {
            let category: String = row["category"]
            let maxDays: Int = row["max_days"]
            let windowDays: Int = row["window_days"]
            let periodHours = Double(windowDays) * 24.0
            try db.execute(
                sql: """
                    INSERT OR IGNORE INTO category_safety_rules
                        (id, category, type, period_hours, max_count, created_at)
                    VALUES (?, ?, 'period_limit', ?, ?, ?)
                    """,
                arguments: [UUID().uuidString, category, periodHours, maxDays, nowMillis]
            )
        }
        try db.execute(sql: "DROP TABLE category_usage_limits")
    }

    /// Add the last-write-wins `updated_at` timestamp required by iCloud sync (#434)
    /// to the synced tables that lacked it. `medication_schedules` had no timestamp at
    /// all, so it gains both `created_at` and `updated_at`. Idempotent (guarded by
    /// table_info checks) so it is safe on both fresh-install and upgrade paths.
    ///
    /// The columns are nullable and are NOT yet maintained by any write path — they
    /// sit inert until SyncService owns keeping them current. Existing rows are
    /// backfilled so historical data carries a usable LWW timestamp.
    static func addSyncTimestampColumns(in db: Database) throws {
        // SECURITY: the `table` values below are interpolated into SQL strings
        // (SQLite cannot bind table/column identifiers as parameters). Every value
        // here is a hardcoded constant from the literal list below — constants only,
        // never user/sync input. Do not feed dynamic/untrusted names into `hasColumn`
        // or the ALTER TABLE statements without an allowlist check first.
        func hasColumn(_ table: String, _ column: String) throws -> Bool {
            let columns = try Row.fetchAll(db, sql: "PRAGMA table_info(\(table))")
            return columns.contains { (row: Row) in (row["name"] as String?) == column }
        }

        // Append-only / created_at-bearing tables: updated_at backfills from created_at.
        // Hardcoded constants only — see SECURITY note above.
        for table in ["symptom_logs", "episode_notes", "category_safety_rules"] {
            if try !hasColumn(table, "updated_at") {
                try db.execute(sql: "ALTER TABLE \(table) ADD COLUMN updated_at INTEGER CHECK(updated_at IS NULL OR updated_at > 0)")
                try db.execute(sql: "UPDATE \(table) SET updated_at = created_at WHERE updated_at IS NULL")
            }
        }

        // medication_schedules has no timestamps at all; add both and stamp existing rows.
        let now = TimestampHelper.now
        if try !hasColumn("medication_schedules", "created_at") {
            try db.execute(sql: "ALTER TABLE medication_schedules ADD COLUMN created_at INTEGER CHECK(created_at IS NULL OR created_at > 0)")
            try db.execute(
                sql: "UPDATE medication_schedules SET created_at = ? WHERE created_at IS NULL",
                arguments: [now]
            )
        }
        if try !hasColumn("medication_schedules", "updated_at") {
            try db.execute(sql: "ALTER TABLE medication_schedules ADD COLUMN updated_at INTEGER CHECK(updated_at IS NULL OR updated_at > 0)")
            try db.execute(
                sql: "UPDATE medication_schedules SET updated_at = COALESCE(created_at, ?) WHERE updated_at IS NULL",
                arguments: [now]
            )
        }
    }

    /// Create the v25 baseline schema. Later registered migrations evolve it to the
    /// current version; see spec/schemas/sqlite/schema-v36.sql for the current end-state.
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
                min_interval_hours REAL CHECK(min_interval_hours IS NULL OR min_interval_hours > 0)
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
            try db.execute(sql: "DELETE FROM category_safety_rules")
            try db.execute(sql: "DELETE FROM tracking_options")
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
