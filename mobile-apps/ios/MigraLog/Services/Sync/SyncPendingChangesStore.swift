import Foundation
import GRDB

/// One queued outbound change awaiting push to CloudKit.
struct SyncPendingChange: Equatable, Sendable {
    enum ChangeType: String, Sendable {
        case upsert
        case delete
    }

    let id: Int64
    let tableName: String
    let recordId: String
    let changeType: ChangeType
    /// When the change was queued, Unix epoch milliseconds.
    let createdAt: Int64
    let retryCount: Int
    let lastError: String?
}

/// The durable outbound queue for iCloud sync (#434). Local writes enqueue a change
/// here; the sync engine drains the queue, pushes to CloudKit, and removes the
/// successfully-sent rows. Surviving app restarts is the whole point — an in-memory
/// queue would lose changes made while offline.
///
/// `UNIQUE(table_name, record_id)` collapses repeated edits to the same row into a
/// single pending entry: the latest change wins and its retry state is reset.
final class SyncPendingChangesStore: Sendable {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    /// Queue a change for a row. If one is already pending for the same row it is
    /// superseded (newest change type + timestamp, retry state cleared).
    func enqueue(tableName: String, recordId: String, changeType: SyncPendingChange.ChangeType, at now: Int64) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO sync_pending_changes
                        (table_name, record_id, change_type, created_at, retry_count, last_error)
                    VALUES (?, ?, ?, ?, 0, NULL)
                    ON CONFLICT(table_name, record_id) DO UPDATE SET
                        change_type = excluded.change_type,
                        created_at = excluded.created_at,
                        retry_count = 0,
                        last_error = NULL
                    """,
                arguments: [tableName, recordId, changeType.rawValue, now]
            )
        }
    }

    /// Enqueue an `upsert` for every existing row in the synced tables, so the first
    /// sync after enabling pushes the device's current data (the capture triggers only
    /// fire on *new* edits, so existing rows would otherwise never sync). Rows already
    /// queued are left as-is (`ON CONFLICT DO NOTHING`) — a pending delete is not
    /// downgraded to an upsert — so this is safe to call repeatedly. The queued
    /// `created_at` is only a fallback; the engine stamps each pushed record with the
    /// row's real `updated_at` at push time, so backfilled data keeps its true LWW
    /// timestamp. Returns the number of rows enqueued.
    @discardableResult
    func backfillExistingRows(at now: Int64) throws -> Int {
        try dbManager.dbQueue.write { db in
            var enqueued = 0
            for table in SyncableTable.allCases {
                try db.execute(
                    sql: """
                        INSERT INTO sync_pending_changes
                            (table_name, record_id, change_type, created_at, retry_count, last_error)
                        SELECT '\(table.tableName)', \(table.primaryKeyColumn), 'upsert', ?, 0, NULL
                        FROM \(table.tableName)
                        WHERE true
                        ON CONFLICT(table_name, record_id) DO NOTHING
                        """,
                    arguments: [now]
                )
                enqueued += db.changesCount
            }
            return enqueued
        }
    }

    /// Oldest-first batch of pending changes, up to `limit`.
    func fetchBatch(limit: Int) throws -> [SyncPendingChange] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT id, table_name, record_id, change_type, created_at, retry_count, last_error
                    FROM sync_pending_changes
                    ORDER BY created_at ASC, id ASC
                    LIMIT ?
                    """,
                arguments: [limit]
            )
            return rows.compactMap { Self.changeFromRow($0) }
        }
    }

    func pendingCount() throws -> Int {
        try dbManager.dbQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM sync_pending_changes") ?? 0
        }
    }

    /// Remove any pending change for a specific row. Used when an incoming remote change
    /// supersedes a locally-queued edit, so the now-stale local version isn't pushed.
    func removePending(tableName: String, recordId: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM sync_pending_changes WHERE table_name = ? AND record_id = ?",
                arguments: [tableName, recordId]
            )
        }
    }

    /// Remove changes that were successfully pushed.
    func remove(ids: [Int64]) throws {
        guard !ids.isEmpty else { return }
        let placeholders = Array(repeating: "?", count: ids.count).joined(separator: ",")
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM sync_pending_changes WHERE id IN (\(placeholders))",
                arguments: StatementArguments(ids)
            )
        }
    }

    /// Record a failed push attempt: bump the retry count and store the error.
    func recordFailure(id: Int64, error: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "UPDATE sync_pending_changes SET retry_count = retry_count + 1, last_error = ? WHERE id = ?",
                arguments: [error, id]
            )
        }
    }

    // MARK: - Row Mapping

    private static func changeFromRow(_ row: Row) -> SyncPendingChange? {
        guard let id = row["id"] as Int64?,
              let tableName = row["table_name"] as String?,
              let recordId = row["record_id"] as String?,
              let rawType = row["change_type"] as String?,
              let changeType = SyncPendingChange.ChangeType(rawValue: rawType),
              let createdAt = row["created_at"] as Int64? else {
            return nil
        }
        return SyncPendingChange(
            id: id,
            tableName: tableName,
            recordId: recordId,
            changeType: changeType,
            createdAt: createdAt,
            retryCount: row["retry_count"] as Int? ?? 0,
            lastError: row["last_error"] as String?
        )
    }
}
