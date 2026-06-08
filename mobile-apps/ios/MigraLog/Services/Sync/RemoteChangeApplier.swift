import Foundation
import GRDB

/// Applies a single remote change (one `SyncRecord` pulled from CloudKit) to the local
/// database (#434): decode the payload, resolve last-write-wins against the local row,
/// and upsert or delete accordingly. When the local row also had an unpushed edit (a
/// genuine conflict), the losing payload is archived to `sync_conflicts` before it is
/// overwritten — data-loss prevention is a core tenet.
///
/// Everything happens in one transaction so the archive and the row change commit
/// together. Apply is per-record; ordering a batch so parents land before children
/// (FK constraints) is the sync engine's job — this writes one row.
final class RemoteChangeApplier: Sendable {
    enum Outcome: Equatable, Sendable {
        case skippedUnknownTable
        case insertedNew
        case noopTombstone      // a tombstone for a row we don't have
        case appliedRemoteWin   // remote newer → local upserted or deleted
        case keptLocalWin       // local newer → remote ignored (engine re-pushes local)
    }

    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    @discardableResult
    func apply(_ record: SyncRecord, now: Int64) throws -> Outcome {
        guard let table = SyncableTable.named(record.tableName) else {
            return .skippedUnknownTable
        }

        return try dbManager.dbQueue.write { db in
            let localRow = try Row.fetchOne(
                db,
                sql: "SELECT * FROM \(table.tableName) WHERE \(table.primaryKeyColumn) = ?",
                arguments: [record.recordId]
            )

            // A record we've never seen: insert it (a tombstone for a missing row is a no-op).
            guard let localRow else {
                if record.deleted { return .noopTombstone }
                try Self.upsert(record, table: table, in: db)
                return .insertedNew
            }

            let localPayload = try SyncPayloadCodec.encodePayload(row: localRow, table: table)
            let winner = LWWResolver.resolve(
                localUpdatedAt: Self.lwwTimestamp(of: localRow), localPayload: localPayload,
                remoteUpdatedAt: record.updatedAt, remotePayload: record.payload
            )

            // It's only a real conflict (worth archiving) if the local row had an edit
            // that hasn't been pushed yet — otherwise the remote is just an update we
            // hadn't seen, not a competing version.
            let isConflict = try Self.hasPendingChange(table: table.tableName, recordId: record.recordId, in: db)

            switch winner {
            case .remote:
                if isConflict {
                    try Self.archiveConflict(
                        in: db, record: (table.tableName, record.recordId),
                        losingSide: "local", payloads: (losing: localPayload, winning: record.payload), now: now
                    )
                }
                if record.deleted {
                    try db.execute(
                        sql: "DELETE FROM \(table.tableName) WHERE \(table.primaryKeyColumn) = ?",
                        arguments: [record.recordId]
                    )
                } else {
                    try Self.upsert(record, table: table, in: db)
                }
                return .appliedRemoteWin

            case .local:
                if isConflict {
                    try Self.archiveConflict(
                        in: db, record: (table.tableName, record.recordId),
                        losingSide: "remote", payloads: (losing: record.payload, winning: localPayload), now: now
                    )
                }
                return .keptLocalWin
            }
        }
    }

    // MARK: - Generic row write

    /// Upsert a row from a decoded payload. Uses `ON CONFLICT(id) DO UPDATE` rather than
    /// `INSERT OR REPLACE` so the existing row is updated in place — REPLACE would delete
    /// it and cascade-delete any FK children, and would also wipe device-local columns
    /// that aren't in the payload (e.g. medication_schedules.notification_id, which the
    /// update set leaves untouched). Columns the local schema doesn't have are dropped
    /// (forward-compatible migrate-on-read).
    private static func upsert(_ record: SyncRecord, table: SyncableTable, in db: Database) throws {
        let decoded = try SyncPayloadCodec.decodePayload(record.payload)
        let existing = try columnNames(of: table.tableName, in: db)
        let columns = decoded.keys.filter { existing.contains($0) }.sorted()
        guard !columns.isEmpty else { return }

        let placeholders = Array(repeating: "?", count: columns.count).joined(separator: ", ")
        let assignments = columns
            .filter { $0 != table.primaryKeyColumn }
            .map { "\($0) = excluded.\($0)" }
            .joined(separator: ", ")
        let conflictClause = assignments.isEmpty
            ? "ON CONFLICT(\(table.primaryKeyColumn)) DO NOTHING"
            : "ON CONFLICT(\(table.primaryKeyColumn)) DO UPDATE SET \(assignments)"

        let arguments = StatementArguments(columns.map { decoded[$0]!.databaseValue })
        try db.execute(
            sql: """
                INSERT INTO \(table.tableName) (\(columns.joined(separator: ", ")))
                VALUES (\(placeholders))
                \(conflictClause)
                """,
            arguments: arguments
        )
    }

    // MARK: - Helpers

    private static func lwwTimestamp(of row: Row) -> Int64 {
        (row["updated_at"] as Int64?) ?? (row["created_at"] as Int64?) ?? 0
    }

    private static func hasPendingChange(table: String, recordId: String, in db: Database) throws -> Bool {
        let found = try Int.fetchOne(
            db,
            sql: "SELECT 1 FROM sync_pending_changes WHERE table_name = ? AND record_id = ? LIMIT 1",
            arguments: [table, recordId]
        )
        return found != nil
    }

    private static func columnNames(of table: String, in db: Database) throws -> Set<String> {
        let rows = try Row.fetchAll(db, sql: "PRAGMA table_info(\(table))")
        return Set(rows.map { $0["name"] as String })
    }

    private static func archiveConflict(
        in db: Database, record: (table: String, id: String),
        losingSide: String, payloads: (losing: String, winning: String), now: Int64
    ) throws {
        let expiresAt = now + Int64(SyncConflictsStore.retentionDays) * 24 * 3_600 * 1_000
        try db.execute(
            sql: """
                INSERT INTO sync_conflicts
                    (table_name, record_id, losing_side, payload, winning_payload, resolved_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
            arguments: [record.table, record.id, losingSide, payloads.losing, payloads.winning, now, expiresAt]
        )
    }
}

private extension SyncPayloadCodec.Value {
    var databaseValue: DatabaseValue {
        switch self {
        case .text(let value): return value.databaseValue
        case .int(let value): return value.databaseValue
        case .double(let value): return value.databaseValue
        case .null: return .null
        }
    }
}
