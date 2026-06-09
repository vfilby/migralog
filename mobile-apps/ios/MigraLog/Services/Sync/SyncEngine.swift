import Foundation
import GRDB

/// Orchestrates one sync cycle for iCloud sync (#434): push the local change queue up,
/// then pull remote changes down and apply them. It reaches CloudKit only through
/// `CloudKitTransport`, so the whole flow is testable against an in-memory fake.
///
/// An `actor` so overlapping triggers (app foreground, after-write, background refresh)
/// can't run two syncs at once and double-drain the queue.
actor SyncEngine {
    /// The single custom zone all records live in.
    static let zoneName = "MigraLogZone"

    private let transport: CloudKitTransport
    private let dbManager: DatabaseManager
    private let pendingStore: SyncPendingChangesStore
    private let zoneStore: SyncZoneStateStore
    private let applier: RemoteChangeApplier

    init(
        transport: CloudKitTransport,
        dbManager: DatabaseManager,
        pendingStore: SyncPendingChangesStore,
        zoneStore: SyncZoneStateStore,
        applier: RemoteChangeApplier
    ) {
        self.transport = transport
        self.dbManager = dbManager
        self.pendingStore = pendingStore
        self.zoneStore = zoneStore
        self.applier = applier
    }

    /// Full cycle: ensure the zone exists, pull and apply remote changes, then push the
    /// outbound queue. Returns counts for observability and tests.
    @discardableResult
    func sync(now: Int64) async throws -> (pushed: Int, applied: Int) {
        try await transport.ensureZone()
        // Pull before push: apply remote changes (LWW) first, so a locally-queued edit
        // that lost to a newer remote version is dropped during pull rather than pushed
        // and clobbering the winner. Push-then-pull would force-overwrite the newer
        // remote record with our stale local one.
        let applied = try await pull(now: now)
        let pushed = try await push()
        return (pushed, applied)
    }

    // MARK: - Push

    /// Drain the pending-changes queue in batches, push each, and remove the
    /// successfully-sent entries. Returns the number of changes pushed.
    @discardableResult
    func push(batchSize: Int = 100) async throws -> Int {
        var total = 0
        while true {
            let pending = try pendingStore.fetchBatch(limit: batchSize)
            if pending.isEmpty { break }

            let records = try pending.compactMap { try buildRecord(for: $0) }
            if !records.isEmpty {
                try await transport.push(records)
            }
            try pendingStore.remove(ids: pending.map { $0.id })
            total += pending.count

            if pending.count < batchSize { break }
        }
        return total
    }

    /// Build the record to push for one queued change. An upsert reads the live row and
    /// encodes it; a row that has vanished since enqueue becomes a tombstone. A delete is
    /// a tombstone stamped with the enqueue time (≈ delete time) so last-write-wins on
    /// the other device compares against a real timestamp.
    private func buildRecord(for change: SyncPendingChange) throws -> SyncRecord? {
        guard let table = SyncableTable.named(change.tableName) else { return nil }
        let schemaVersion = DatabaseManager.schemaVersion

        func tombstone() -> SyncRecord {
            SyncRecord(
                tableName: table.tableName, recordId: change.recordId, payload: "{}",
                schemaVersion: schemaVersion, updatedAt: change.createdAt, deleted: true
            )
        }

        if change.changeType == .delete {
            return tombstone()
        }

        return try dbManager.dbQueue.read { db -> SyncRecord in
            guard let row = try Row.fetchOne(
                db,
                sql: "SELECT * FROM \(table.tableName) WHERE \(table.primaryKeyColumn) = ?",
                arguments: [change.recordId]
            ) else {
                return tombstone()
            }
            let payload = try SyncPayloadCodec.encodePayload(row: row, table: table)
            let updatedAt = (row["updated_at"] as Int64?) ?? (row["created_at"] as Int64?) ?? change.createdAt
            return SyncRecord(
                tableName: table.tableName, recordId: change.recordId, payload: payload,
                schemaVersion: schemaVersion, updatedAt: updatedAt, deleted: false
            )
        }
    }

    // MARK: - Pull

    /// Fetch remote changes since the saved token, apply them parents-first, and persist
    /// the new token. Returns the number of records applied.
    @discardableResult
    func pull(now: Int64) async throws -> Int {
        var applied = 0
        var token = try zoneStore.state(zoneName: Self.zoneName)?.serverChangeToken

        while true {
            let batch = try await transport.fetchChanges(since: token)
            let ordered = batch.records.sorted { Self.applyRank($0) < Self.applyRank($1) }
            for record in ordered {
                let outcome = try applier.apply(record, now: now)
                // A remote change that won last-write-wins supersedes any locally-queued
                // edit for the same row — drop it so push doesn't send the now-stale local
                // version back and clobber the winner.
                if outcome == .appliedRemoteWin {
                    try pendingStore.removePending(tableName: record.tableName, recordId: record.recordId)
                }
                applied += 1
            }
            token = batch.newToken
            try zoneStore.saveChangeToken(token, zoneName: Self.zoneName, syncedAt: now)
            if !batch.moreComing { break }
        }
        return applied
    }

    private static func applyRank(_ record: SyncRecord) -> Int {
        SyncableTable.named(record.tableName)?.applyPriority ?? Int.max
    }
}
