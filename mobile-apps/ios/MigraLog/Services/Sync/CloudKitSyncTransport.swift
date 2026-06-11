import CloudKit
import Foundation

/// The real `CloudKitTransport` over the user's private CloudKit database (#434).
/// A dumb pipe: it maps `SyncRecord` ↔ `CKRecord`, force-overwrites on push (the
/// client has already resolved last-write-wins), and pages changes via the zone's
/// server change token. All record interpretation stays client-side.
///
/// ⚠️ UNVERIFIED: this compiles and CI builds it, but the actual CloudKit round-trip
/// cannot be exercised in CI or the simulator — it needs a device signed into iCloud
/// with the schema deployed. Device-verify before enabling sync. See the PR for the
/// data-loss-sensitive items to confirm (push/pull ordering, superseded pending
/// changes, partial-failure handling).
final class CloudKitSyncTransport: CloudKitTransport, @unchecked Sendable {
    static let recordType = "SyncRecord"

    private let container: CKContainer
    private let database: CKDatabase
    private let zoneID: CKRecordZone.ID

    init(containerIdentifier: String = "iCloud.com.eff3.migralog") {
        self.container = CKContainer(identifier: containerIdentifier)
        self.database = container.privateCloudDatabase
        self.zoneID = CKRecordZone.ID(zoneName: SyncEngine.zoneName, ownerName: CKCurrentUserDefaultName)
    }

    func accountAvailable() async throws -> Bool {
        try await container.accountStatus() == .available
    }

    /// Create the custom zone if it doesn't exist. Saving an existing zone is a no-op,
    /// so this is idempotent.
    func ensureZone() async throws {
        let zone = CKRecordZone(zoneID: zoneID)
        do {
            _ = try await database.modifyRecordZones(saving: [zone], deleting: [])
        } catch {
            throw Self.mapError(error)
        }
    }

    /// Maximum optimistic-concurrency passes before falling back to a force-save, so a
    /// pathologically hot record can't loop forever.
    private static let maxPushAttempts = 5

    /// Save records (upserts and tombstones), resolving server-side conflicts by
    /// last-write-wins (#461). Each record is saved with `.ifServerRecordUnchanged`
    /// (`atomically: false`), so the server rejects a save when it already holds a version
    /// different from the one we based ours on. For each rejected record we compare our
    /// version against the server's by `updatedAt` (LWW): if ours is newer we re-save into
    /// the *server* record — which carries the current change tag — and retry; if the
    /// server's is newer we drop ours and return it so the engine applies it locally and
    /// converges. This closes the residual pull→push race where another device wrote a
    /// newer version into the zone during our sync window. Returns the server records that
    /// won (empty in the common no-conflict case).
    ///
    /// ⚠️ Device-verify-only: the CloudKit conflict path cannot run in CI or the
    /// simulator. The contract (LWW at push, return the server winners) is exercised
    /// against the in-memory fake in tests.
    @discardableResult
    func push(_ records: [SyncRecord]) async throws -> [SyncRecord] {
        guard !records.isEmpty else { return [] }
        var desired: [CKRecord.ID: SyncRecord] = [:]
        var toSave: [CKRecord] = records.map { record in
            let ck = makeCKRecord(from: record)
            desired[ck.recordID] = record
            return ck
        }
        var serverWon: [SyncRecord] = []

        for _ in 0..<Self.maxPushAttempts {
            let conflicts = try await saveResolvingConflicts(toSave)
            if conflicts.isEmpty { return serverWon }

            var retry: [CKRecord] = []
            for (recordID, serverRecord) in conflicts {
                guard let want = desired[recordID] else { continue }
                let server = Self.makeSyncRecord(from: serverRecord)
                let winner = server.map {
                    LWWResolver.resolve(
                        localUpdatedAt: want.updatedAt, localPayload: want.payload,
                        remoteUpdatedAt: $0.updatedAt, remotePayload: $0.payload
                    )
                } ?? .local
                if winner == .remote, let server {
                    serverWon.append(server)        // server is newer — keep it, converge locally.
                    desired[recordID] = nil
                } else {
                    // We win: write our fields into the server record so the save carries
                    // the current change tag and passes the .ifServerRecordUnchanged check.
                    writeFields(of: want, into: serverRecord)
                    retry.append(serverRecord)
                }
            }
            toSave = retry
            if toSave.isEmpty { return serverWon }
        }

        // Last resort after repeated conflicts on the same hot record: force-save what
        // remains so our edit isn't silently lost. Bounded by maxPushAttempts above.
        if !toSave.isEmpty {
            let results: [CKRecord.ID: Result<CKRecord, Error>]
            do {
                (results, _) = try await database.modifyRecords(
                    saving: toSave, deleting: [], savePolicy: .allKeys, atomically: false
                )
            } catch {
                throw Self.mapError(error)
            }
            // Even a force-save can fail per-record (quota, size, …) — surface the first
            // failure so the engine keeps the queue and retries, rather than dropping it.
            for case .failure(let itemError) in results.values {
                throw Self.mapError(itemError)
            }
        }
        return serverWon
    }

    /// One optimistic-concurrency save pass. Returns the records the server rejected
    /// because it holds a changed version, paired with that server record. Throws (mapped)
    /// for any other failure so the engine keeps the queue and retries.
    ///
    /// With `atomically: false`, `modifyRecords` does NOT throw for per-record failures —
    /// only whole-operation ones. Per-record `.serverRecordChanged` rejections arrive in
    /// the returned `saveResults` tuple, so reading that tuple is load-bearing: every save
    /// of an already-existing server record is rejected there (our CKRecords carry no
    /// change tag) and discarding it loses the update.
    private func saveResolvingConflicts(_ ckRecords: [CKRecord]) async throws -> [(CKRecord.ID, CKRecord)] {
        let saveResults: [CKRecord.ID: Result<CKRecord, Error>]
        do {
            (saveResults, _) = try await database.modifyRecords(
                saving: ckRecords, deleting: [], savePolicy: .ifServerRecordUnchanged, atomically: false
            )
        } catch {
            throw Self.mapError(error)
        }
        return try Self.conflictedSaves(saveResults)
    }

    /// Partition per-record save results: successes are dropped, `.serverRecordChanged`
    /// rejections become conflicts paired with the server's current record, and anything
    /// else (zone gone, quota, a conflict missing its server record, …) throws so the
    /// engine keeps the pending queue and retries later — never drop silently. Internal
    /// for unit testing; the CloudKit round-trip itself can't run in CI.
    static func conflictedSaves(
        _ saveResults: [CKRecord.ID: Result<CKRecord, Error>]
    ) throws -> [(CKRecord.ID, CKRecord)] {
        var conflicts: [(CKRecord.ID, CKRecord)] = []
        for (id, result) in saveResults {
            guard case .failure(let itemError) = result else { continue }
            guard let itemCK = itemError as? CKError, itemCK.code == .serverRecordChanged,
                  let server = itemCK.serverRecord else {
                throw Self.mapError(itemError)
            }
            conflicts.append((id, server))
        }
        return conflicts
    }

    /// Fetch changes since `token` (nil for a first full sync), mapping each changed
    /// `CKRecord` back to a `SyncRecord`. Deletions of CKRecords are ignored — our model
    /// propagates deletes as tombstone records, not by removing CKRecords.
    func fetchChanges(since token: Data?) async throws -> SyncChangeBatch {
        let changeToken = try Self.decodeToken(token)
        do {
            let change = try await database.recordZoneChanges(inZoneWith: zoneID, since: changeToken)
            let records: [SyncRecord] = change.modificationResultsByID.values.compactMap { result in
                guard case .success(let modification) = result else { return nil }
                return Self.makeSyncRecord(from: modification.record)
            }
            return SyncChangeBatch(
                records: records,
                newToken: try Self.encodeToken(change.changeToken),
                moreComing: change.moreComing
            )
        } catch {
            throw Self.mapError(error)
        }
    }

    // MARK: - Error mapping

    /// Map CloudKit errors onto the engine-facing recoverable errors. Anything not
    /// specifically recoverable propagates unchanged so the engine surfaces it.
    private static func mapError(_ error: Error) -> Error {
        guard let ckError = error as? CKError else { return error }
        switch ckError.code {
        case .zoneNotFound, .userDeletedZone:
            return SyncTransportError.zoneNotFound
        case .changeTokenExpired:
            return SyncTransportError.changeTokenExpired
        case .notAuthenticated:
            return SyncTransportError.accountUnavailable
        case .partialFailure:
            let partials = ckError.partialErrorsByItemID?.values.compactMap { $0 as? CKError } ?? []
            if partials.contains(where: { $0.code == .zoneNotFound || $0.code == .userDeletedZone }) {
                return SyncTransportError.zoneNotFound
            }
            return error
        default:
            return error
        }
    }

    // MARK: - Record mapping

    private func makeCKRecord(from record: SyncRecord) -> CKRecord {
        let recordID = CKRecord.ID(recordName: record.recordName, zoneID: zoneID)
        let ckRecord = CKRecord(recordType: Self.recordType, recordID: recordID)
        writeFields(of: record, into: ckRecord)
        return ckRecord
    }

    /// Copy a `SyncRecord`'s fields onto a `CKRecord`. Used both to build a fresh record
    /// and to re-stamp a fetched server record (preserving its change tag) on conflict.
    private func writeFields(of record: SyncRecord, into ckRecord: CKRecord) {
        ckRecord["tableName"] = record.tableName
        ckRecord["recordId"] = record.recordId
        ckRecord["payload"] = record.payload
        ckRecord["schemaVersion"] = Int64(record.schemaVersion)
        ckRecord["updatedAt"] = record.updatedAt
        ckRecord["deleted"] = Int64(record.deleted ? 1 : 0)
    }

    private static func makeSyncRecord(from ckRecord: CKRecord) -> SyncRecord? {
        guard let tableName = ckRecord["tableName"] as? String,
              let recordId = ckRecord["recordId"] as? String,
              let payload = ckRecord["payload"] as? String,
              let schemaVersion = ckRecord["schemaVersion"] as? Int64,
              let updatedAt = ckRecord["updatedAt"] as? Int64 else {
            return nil
        }
        let deleted = (ckRecord["deleted"] as? Int64 ?? 0) == 1
        return SyncRecord(
            tableName: tableName, recordId: recordId, payload: payload,
            schemaVersion: Int(schemaVersion), updatedAt: updatedAt, deleted: deleted
        )
    }

    // MARK: - Change token (NSSecureCoding ↔ Data)

    private static func encodeToken(_ token: CKServerChangeToken?) throws -> Data? {
        guard let token else { return nil }
        return try NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true)
    }

    private static func decodeToken(_ data: Data?) throws -> CKServerChangeToken? {
        guard let data else { return nil }
        return try NSKeyedUnarchiver.unarchivedObject(ofClass: CKServerChangeToken.self, from: data)
    }
}
