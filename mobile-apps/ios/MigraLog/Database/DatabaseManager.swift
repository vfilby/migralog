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
    static let schemaVersion = 38

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
            BackupService().backUpForPendingMigrations(
                queue: queue, migrator: mgr, targetSchemaVersion: schemaVersion
            )
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
            BackupService().backUpForPendingMigrations(
                queue: queue, migrator: mgr, targetSchemaVersion: DatabaseManager.schemaVersion
            )
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

        // v37: add `excluded_from_safety_warnings` to medications — user-controlled
        // opt-out of a medication's doses counting toward its category's safety
        // warnings (e.g. a daily preventative CGRP shouldn't trip the CGRP usage
        // limit). Nullable so sync payloads from older app versions still apply
        // (see spec/ios/icloud-sync.md). The synced-column change means the
        // DELETE-capture triggers must be rebuilt with the new column baked in
        // (v34 precedent).
        migrator.registerMigration("v37") { db in
            let columns = try Row.fetchAll(db, sql: "PRAGMA table_info(medications)")
            let hasColumn = columns.contains { (row: Row) in
                (row["name"] as String?) == "excluded_from_safety_warnings"
            }
            if !hasColumn {
                try db.execute(sql: "ALTER TABLE medications ADD COLUMN excluded_from_safety_warnings INTEGER CHECK(excluded_from_safety_warnings IS NULL OR excluded_from_safety_warnings IN (0, 1))")
            }
            // createSyncCaptureTriggers uses CREATE TRIGGER IF NOT EXISTS, so the
            // stale medications triggers must be dropped first or upgrades keep
            // the old column list (v34 precedent).
            for suffix in ["insert", "update", "delete"] {
                try db.execute(sql: "DROP TRIGGER IF EXISTS sync_capture_medications_\(suffix)")
            }
            try DatabaseManager.createSyncCaptureTriggers(in: db, includePayload: true)
        }

        // v38: medication_expectation_periods — effective-dated adherence
        // expectations, so preventative-adherence stats grade each day against the
        // medication configuration that was true on that day (descheduling keeps
        // history; archive + re-enable doesn't grade the archived gap). Synced.
        // Created after the trigger migrations so createSyncCaptureTriggers re-runs
        // to add this table's capture triggers (v35 precedent). Backfills an open
        // period per active scheduled preventative from its creation day.
        migrator.registerMigration("v38") { db in
            try DatabaseManager.createMedicationExpectationPeriodsTable(in: db)
            try DatabaseManager.backfillExpectationPeriods(in: db)
            try DatabaseManager.createSyncCaptureTriggers(in: db, includePayload: true)
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
