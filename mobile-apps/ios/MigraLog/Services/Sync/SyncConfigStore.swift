import Foundation
import GRDB

/// The device-local on/off switch and last-sync status for iCloud sync (#434).
struct SyncConfig: Equatable, Sendable {
    let enabled: Bool
    let lastSyncedAt: Int64?
    let lastError: String?
}

/// Reads and writes the single `sync_config` row.
final class SyncConfigStore: Sendable {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    func config() throws -> SyncConfig {
        try dbManager.dbQueue.read { db in
            guard let row = try Row.fetchOne(
                db, sql: "SELECT enabled, last_synced_at, last_error FROM sync_config WHERE id = 1"
            ) else {
                return SyncConfig(enabled: false, lastSyncedAt: nil, lastError: nil)
            }
            return SyncConfig(
                enabled: (row["enabled"] as Int64? ?? 0) == 1,
                lastSyncedAt: row["last_synced_at"] as Int64?,
                lastError: row["last_error"] as String?
            )
        }
    }

    func setEnabled(_ enabled: Bool) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "UPDATE sync_config SET enabled = ? WHERE id = 1", arguments: [enabled ? 1 : 0])
        }
    }

    /// Record a successful sync: stamp the time and clear any prior error.
    func recordSuccess(at now: Int64) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "UPDATE sync_config SET last_synced_at = ?, last_error = NULL WHERE id = 1",
                arguments: [now]
            )
        }
    }

    /// Record a sync failure message (leaves last_synced_at untouched).
    func recordFailure(_ message: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "UPDATE sync_config SET last_error = ? WHERE id = 1", arguments: [message])
        }
    }
}
