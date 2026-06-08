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

    private let database: CKDatabase
    private let zoneID: CKRecordZone.ID

    init(containerIdentifier: String = "iCloud.com.eff3.migralog") {
        let container = CKContainer(identifier: containerIdentifier)
        self.database = container.privateCloudDatabase
        self.zoneID = CKRecordZone.ID(zoneName: SyncEngine.zoneName, ownerName: CKCurrentUserDefaultName)
    }

    /// Create the custom zone if it doesn't exist. Saving an existing zone is a no-op,
    /// so this is idempotent.
    func ensureZone() async throws {
        let zone = CKRecordZone(zoneID: zoneID)
        _ = try await database.modifyRecordZones(saving: [zone], deleting: [])
    }

    /// Save records (upserts and tombstones) to the zone. Uses `.allKeys` so our
    /// already-resolved version overwrites the server's regardless of change tag, and
    /// `atomically: true` so a partial failure throws (the engine keeps the queue and
    /// retries) rather than silently dropping changes.
    func push(_ records: [SyncRecord]) async throws {
        guard !records.isEmpty else { return }
        let ckRecords = records.map { makeCKRecord(from: $0) }
        _ = try await database.modifyRecords(
            saving: ckRecords, deleting: [], savePolicy: .allKeys, atomically: true
        )
    }

    /// Fetch changes since `token` (nil for a first full sync), mapping each changed
    /// `CKRecord` back to a `SyncRecord`. Deletions of CKRecords are ignored — our model
    /// propagates deletes as tombstone records, not by removing CKRecords.
    func fetchChanges(since token: Data?) async throws -> SyncChangeBatch {
        let changeToken = try Self.decodeToken(token)
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
    }

    // MARK: - Record mapping

    private func makeCKRecord(from record: SyncRecord) -> CKRecord {
        let recordID = CKRecord.ID(recordName: record.recordName, zoneID: zoneID)
        let ckRecord = CKRecord(recordType: Self.recordType, recordID: recordID)
        ckRecord["tableName"] = record.tableName
        ckRecord["recordId"] = record.recordId
        ckRecord["payload"] = record.payload
        ckRecord["schemaVersion"] = Int64(record.schemaVersion)
        ckRecord["updatedAt"] = record.updatedAt
        ckRecord["deleted"] = Int64(record.deleted ? 1 : 0)
        return ckRecord
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
