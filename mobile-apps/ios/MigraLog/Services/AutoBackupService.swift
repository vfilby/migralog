import Foundation

/// Creates a periodic (~weekly) safety backup of the database and prunes old auto-created
/// backups to the retention limit. Driven from the app lifecycle (launch / foreground),
/// mirroring the auto-sync trigger — iOS background refresh is too unreliable to depend on
/// for a data-safety guarantee.
///
/// Cadence is enforced by a persisted "last run" timestamp, so the many foreground events a
/// user generates collapse to at most one backup per `interval`. All work is best-effort:
/// failures are logged and swallowed so a backup problem never disrupts the app.
@MainActor
final class AutoBackupService {
    /// Minimum time between automatic backups (~weekly).
    static let interval: TimeInterval = 7 * 24 * 60 * 60

    /// How many auto-created backups (automatic + migration) to retain.
    static let retentionLimit = 10

    /// UserDefaults key for the last automatic-backup time (epoch seconds).
    static let lastRunKey = "autoBackup.lastRunAt"

    private let dbManager: DatabaseManager
    private let backupService: BackupServiceProtocol
    private let defaults: UserDefaults
    private let logger = AppLogger.shared

    init(
        dbManager: DatabaseManager = .shared,
        backupService: BackupServiceProtocol = BackupService(),
        defaults: UserDefaults = .standard
    ) {
        self.dbManager = dbManager
        self.backupService = backupService
        self.defaults = defaults
    }

    /// Create an automatic backup if at least `interval` has elapsed since the last one.
    /// Idempotent within the window — repeated calls (launch + every foreground) are no-ops
    /// until the interval passes. Safe to call from the app lifecycle.
    func runIfDue(now: Date = Date()) {
        // Never back up the throwaway in-memory fallback: it would capture an empty DB
        // and, worse, stamp a recent "last run" so the real DB isn't backed up later.
        guard DatabaseManager.initializationError == nil,
              !DatabaseManager.isUsingInMemoryFallback else { return }

        if let last = defaults.object(forKey: Self.lastRunKey) as? Double,
           now.timeIntervalSince1970 - last < Self.interval {
            return
        }

        do {
            let counts = try dbManager.dbQueue.read { db in
                (episodes: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes") ?? 0,
                 medications: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medications") ?? 0)
            }
            _ = try backupService.createBackup(
                dbManager: dbManager,
                episodeCount: counts.episodes,
                medicationCount: counts.medications,
                backupType: BackupType.automatic
            )
            try? backupService.pruneAutomaticBackups(keeping: Self.retentionLimit)
            // Only stamp "last run" after a successful backup, so a failed attempt retries
            // on the next lifecycle event rather than waiting out the full interval.
            defaults.set(now.timeIntervalSince1970, forKey: Self.lastRunKey)
            logger.info("Created weekly automatic backup (\(counts.episodes) episodes, \(counts.medications) medications)")
        } catch {
            logger.error("Weekly automatic backup failed", error: error)
        }
    }
}
