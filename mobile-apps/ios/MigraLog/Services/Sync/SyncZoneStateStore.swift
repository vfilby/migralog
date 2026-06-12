import Foundation
import GRDB

/// Persisted sync state for one CloudKit record zone.
struct SyncZoneState: Equatable, Sendable {
    let zoneName: String
    /// Archived `CKServerChangeToken` bytes. Opaque here — the CloudKit layer owns
    /// archiving/unarchiving; the store only persists the blob so it survives restarts.
    let serverChangeToken: Data?
    /// Last successful sync, Unix epoch milliseconds.
    let lastSyncAt: Int64?
    let lastError: String?
    let lastErrorAt: Int64?
    /// The `SyncedSchemaManifest` in effect when this zone last completed a pull (#469).
    /// When a migration adds synced columns, the stored manifest goes stale and the
    /// engine forces a one-time full re-pull to backfill them.
    let lastSyncedSchema: String?
}

/// Persists the incremental-pull cursor (the `CKServerChangeToken`) per zone, plus
/// last-sync / last-error bookkeeping (#434). The token is what makes pulls
/// incremental — on each pull CloudKit returns only changes since the stored token,
/// and we save the new one. It is kept opaque (raw bytes) so this store has no
/// CloudKit dependency and is fully unit-testable.
final class SyncZoneStateStore: Sendable {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    func state(zoneName: String) throws -> SyncZoneState? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT zone_name, server_change_token, last_sync_at, last_error, last_error_at,
                           last_synced_schema
                    FROM sync_zone_state WHERE zone_name = ?
                    """,
                arguments: [zoneName]
            )
            return row.map { Self.stateFromRow($0) }
        }
    }

    /// Persist the change token after a successful pull, stamping `last_sync_at` and
    /// clearing the error fields.
    func saveChangeToken(_ token: Data?, zoneName: String, syncedAt: Int64) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO sync_zone_state
                        (zone_name, server_change_token, last_sync_at, last_error, last_error_at)
                    VALUES (?, ?, ?, NULL, NULL)
                    ON CONFLICT(zone_name) DO UPDATE SET
                        server_change_token = excluded.server_change_token,
                        last_sync_at = excluded.last_sync_at,
                        last_error = NULL,
                        last_error_at = NULL
                    """,
                arguments: [zoneName, token, syncedAt]
            )
        }
    }

    /// Persist the synced-schema manifest after a completed pull (#469), without
    /// disturbing the change token or sync/error bookkeeping.
    func saveSyncedSchema(_ manifest: String, zoneName: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO sync_zone_state (zone_name, last_synced_schema)
                    VALUES (?, ?)
                    ON CONFLICT(zone_name) DO UPDATE SET
                        last_synced_schema = excluded.last_synced_schema
                    """,
                arguments: [zoneName, manifest]
            )
        }
    }

    /// Record a sync error against the zone without disturbing the change token or
    /// last-sync timestamp.
    func recordError(_ error: String, zoneName: String, at now: Int64) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO sync_zone_state
                        (zone_name, server_change_token, last_sync_at, last_error, last_error_at)
                    VALUES (?, NULL, NULL, ?, ?)
                    ON CONFLICT(zone_name) DO UPDATE SET
                        last_error = excluded.last_error,
                        last_error_at = excluded.last_error_at
                    """,
                arguments: [zoneName, error, now]
            )
        }
    }

    // MARK: - Row Mapping

    private static func stateFromRow(_ row: Row) -> SyncZoneState {
        SyncZoneState(
            zoneName: row["zone_name"],
            serverChangeToken: row["server_change_token"] as Data?,
            lastSyncAt: row["last_sync_at"] as Int64?,
            lastError: row["last_error"] as String?,
            lastErrorAt: row["last_error_at"] as Int64?,
            lastSyncedSchema: row["last_synced_schema"] as String?
        )
    }
}
