import Foundation
import GRDB

/// One archived conflict: the losing side of a last-write-wins resolution, kept so
/// the user can review and restore it.
struct SyncConflict: Equatable, Sendable {
    enum LosingSide: String, Sendable {
        case local
        case remote
    }

    let id: Int64
    let tableName: String
    let recordId: String
    let losingSide: LosingSide
    /// The payload that lost (the one a user might want to restore).
    let payload: String
    /// The payload that won, for context.
    let winningPayload: String
    let resolvedAt: Int64
    let expiresAt: Int64
}

/// The conflict archive for iCloud sync (#434). When last-write-wins discards a
/// version of a record, the losing payload is preserved here rather than dropped —
/// data-loss prevention is a core tenet. Restoring is just writing the payload back to
/// the local table and re-queuing it (same codepath as a normal edit). Rows are purged
/// after the retention window so the archive can't grow without bound.
final class SyncConflictsStore: Sendable {
    /// How long a losing payload is retained before it can be purged.
    static let retentionDays = 90
    private static let retentionMillis = Int64(retentionDays) * 24 * 3_600 * 1_000

    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    /// Archive the losing side of a resolved conflict. `payloads` carries both sides
    /// (the loser, kept for restore, and the winner, for context). `expiresAt` is
    /// derived from `resolvedAt` plus the retention window.
    func archive(
        tableName: String,
        recordId: String,
        losingSide: SyncConflict.LosingSide,
        payloads: (losing: String, winning: String),
        resolvedAt: Int64
    ) throws {
        let expiresAt = resolvedAt + Self.retentionMillis
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO sync_conflicts
                        (table_name, record_id, losing_side, payload, winning_payload, resolved_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    tableName, recordId, losingSide.rawValue,
                    payloads.losing, payloads.winning, resolvedAt, expiresAt
                ]
            )
        }
    }

    /// Archived conflicts for one record, newest first.
    func conflicts(forRecord tableName: String, recordId: String) throws -> [SyncConflict] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT id, table_name, record_id, losing_side, payload, winning_payload, resolved_at, expires_at
                    FROM sync_conflicts
                    WHERE table_name = ? AND record_id = ?
                    ORDER BY resolved_at DESC
                    """,
                arguments: [tableName, recordId]
            )
            return rows.compactMap { Self.conflictFromRow($0) }
        }
    }

    func count() throws -> Int {
        try dbManager.dbQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM sync_conflicts") ?? 0
        }
    }

    /// Delete conflicts whose retention window has elapsed. Returns the number purged.
    @discardableResult
    func purgeExpired(now: Int64) throws -> Int {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM sync_conflicts WHERE expires_at < ?", arguments: [now])
            return db.changesCount
        }
    }

    // MARK: - Row Mapping

    private static func conflictFromRow(_ row: Row) -> SyncConflict? {
        guard let id = row["id"] as Int64?,
              let tableName = row["table_name"] as String?,
              let recordId = row["record_id"] as String?,
              let rawSide = row["losing_side"] as String?,
              let losingSide = SyncConflict.LosingSide(rawValue: rawSide),
              let payload = row["payload"] as String?,
              let winningPayload = row["winning_payload"] as String?,
              let resolvedAt = row["resolved_at"] as Int64?,
              let expiresAt = row["expires_at"] as Int64? else {
            return nil
        }
        return SyncConflict(
            id: id,
            tableName: tableName,
            recordId: recordId,
            losingSide: losingSide,
            payload: payload,
            winningPayload: winningPayload,
            resolvedAt: resolvedAt,
            expiresAt: expiresAt
        )
    }
}
