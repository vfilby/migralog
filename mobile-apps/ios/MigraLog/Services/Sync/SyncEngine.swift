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
        guard try await transport.accountAvailable() else {
            throw SyncTransportError.accountUnavailable
        }
        try await transport.ensureZone()
        // Pull before push: apply remote changes (LWW) first, so a locally-queued edit
        // that lost to a newer remote version is dropped during pull rather than pushed
        // and clobbering the winner. Push-then-pull would force-overwrite the newer
        // remote record with our stale local one.
        let applied = try await pull(now: now)
        let pushed = try await push(now: now)
        return (pushed, applied)
    }

    // MARK: - Push

    /// Drain the pending-changes queue in batches, push each, and remove the drained
    /// entries. The transport resolves any server-side conflict by last-write-wins (#461);
    /// when the server holds a newer version it is returned here and applied locally so the
    /// database converges (and the losing local edit is archived as a conflict). Returns the
    /// number of queued changes drained.
    @discardableResult
    func push(batchSize: Int = 100, now: Int64 = TimestampHelper.now) async throws -> Int {
        var total = 0
        while true {
            let pending = try pendingStore.fetchBatch(limit: batchSize)
            if pending.isEmpty { break }

            let records = try pending.compactMap { try buildRecord(for: $0) }
            var serverWon: [SyncRecord] = []
            if !records.isEmpty {
                do {
                    serverWon = try await transport.push(records)
                } catch SyncTransportError.zoneNotFound {
                    // Zone vanished (e.g. user deleted iCloud data) — recreate and retry once.
                    try await transport.ensureZone()
                    serverWon = try await transport.push(records)
                }
            }
            // Apply records the server held a newer version of, before clearing the queue,
            // so the applier still sees the (losing) pending edit and archives it.
            for record in serverWon {
                try applier.apply(record, now: now)
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

        // For a delete, the AFTER DELETE trigger captured the deleted row's synced
        // columns into `change.payload` (#463), so the tombstone carries recoverable
        // data instead of an empty `{}`. A vanished-upsert fallback has no captured
        // payload (nil), so it stays `{}`.
        func tombstone() -> SyncRecord {
            SyncRecord(
                tableName: table.tableName, recordId: change.recordId, payload: change.payload ?? "{}",
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
        let zoneState = try zoneStore.state(zoneName: Self.zoneName)
        var token = zoneState?.serverChangeToken
        var didResetToken = false

        // A child record (e.g. intensity_readings) whose FK parent (episodes) hasn't been
        // applied yet when we reach it. The per-batch parents-first sort below orders one
        // batch correctly, but CloudKit paginates the zone, so on a full-history pull a
        // child can arrive in an earlier page than its parent — its FK insert then fails
        // (SQLite error 19) and, left to propagate, aborts the whole sync. Collect those
        // failures and retry them once every batch has landed (#523).
        var deferredChildren: [SyncRecord] = []

        // #469: if a migration added synced columns since the last pull, already-synced
        // rows are locally missing those columns (migrate-on-read dropped them) and the
        // incremental cursor will never redeliver them — the source rows haven't
        // changed. Drop the cursor once to re-pull the whole zone; the applier's tie
        // merge backfills the missing columns without touching anything the local rows
        // legitimately own.
        let schemaManifest = SyncedSchemaManifest.current
        if token != nil,
           SyncedSchemaManifest.addsSyncedColumns(from: zoneState?.lastSyncedSchema, to: schemaManifest) {
            token = nil
            try zoneStore.saveChangeToken(nil, zoneName: Self.zoneName, syncedAt: now)
        }

        while true {
            let batch: SyncChangeBatch
            do {
                batch = try await transport.fetchChanges(since: token)
            } catch SyncTransportError.changeTokenExpired where !didResetToken {
                // The saved token is stale (e.g. the zone was reset server-side). Discard
                // it and re-pull from the beginning. Guarded so we reset at most once.
                didResetToken = true
                token = nil
                try zoneStore.saveChangeToken(nil, zoneName: Self.zoneName, syncedAt: now)
                continue
            }
            let ordered = batch.records.sorted { Self.applyRank($0) < Self.applyRank($1) }
            for record in ordered {
                do {
                    if try applyAndReconcile(record, now: now) { applied += 1 }
                } catch let error as DatabaseError where error.extendedResultCode == .SQLITE_CONSTRAINT_FOREIGNKEY {
                    // Parent not here yet (later page) — retry after the pull completes.
                    deferredChildren.append(record)
                }
            }
            token = batch.newToken
            try zoneStore.saveChangeToken(token, zoneName: Self.zoneName, syncedAt: now)
            if !batch.moreComing { break }
        }
        applied += try drainDeferred(deferredChildren, now: now)
        // Stamp the manifest only after the pull completed — if a re-pull fails midway
        // the stored manifest stays stale and the next sync resets the cursor again.
        if zoneState?.lastSyncedSchema != schemaManifest {
            try zoneStore.saveSyncedSchema(schemaManifest, zoneName: Self.zoneName)
        }
        return applied
    }

    /// Apply one remote record and reconcile the local outbound queue. Returns whether the
    /// record counts toward the applied total (every successful apply does). A remote change
    /// that won last-write-wins supersedes any locally-queued edit for the same row — drop it
    /// so push doesn't send the now-stale local version back and clobber the winner.
    @discardableResult
    private func applyAndReconcile(_ record: SyncRecord, now: Int64) throws -> Bool {
        let outcome = try applier.apply(record, now: now)
        if outcome == .appliedRemoteWin {
            try pendingStore.removePending(tableName: record.tableName, recordId: record.recordId)
        }
        return true
    }

    /// Retry records that failed their FK check during the batched pull, now that the rest
    /// of the zone has landed and their parents exist. Loops until a full pass applies
    /// nothing new: anything still failing is a genuine orphan (its parent was deleted
    /// upstream, so a cascade would drop it anyway) and is discarded rather than aborting
    /// the sync. Returns the number applied.
    private func drainDeferred(_ deferred: [SyncRecord], now: Int64) throws -> Int {
        var pending = deferred
        var applied = 0
        while !pending.isEmpty {
            var stillDeferred: [SyncRecord] = []
            for record in pending {
                do {
                    if try applyAndReconcile(record, now: now) { applied += 1 }
                } catch let error as DatabaseError where error.extendedResultCode == .SQLITE_CONSTRAINT_FOREIGNKEY {
                    stillDeferred.append(record)
                }
            }
            // No progress this pass → the remainder are unresolvable orphans.
            if stillDeferred.count == pending.count { break }
            pending = stillDeferred
        }
        return applied
    }

    private static func applyRank(_ record: SyncRecord) -> Int {
        SyncableTable.named(record.tableName)?.applyPriority ?? Int.max
    }
}
