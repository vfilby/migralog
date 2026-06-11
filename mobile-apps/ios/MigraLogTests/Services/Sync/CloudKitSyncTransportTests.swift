import CloudKit
import XCTest
@testable import MigraLog

/// Tests the per-record save-result handling of the real transport. The CloudKit
/// round-trip itself can't run in CI, but `conflictedSaves` is where the silent-loss
/// hazard lives: with `atomically: false`, `modifyRecords` reports per-record failures
/// in its returned tuple instead of throwing, and every save of an already-existing
/// server record is rejected there as `.serverRecordChanged`.
final class CloudKitSyncTransportTests: XCTestCase {

    private func recordID(_ name: String) -> CKRecord.ID {
        CKRecord.ID(
            recordName: name,
            zoneID: CKRecordZone.ID(zoneName: SyncEngine.zoneName, ownerName: CKCurrentUserDefaultName)
        )
    }

    private func record(_ name: String) -> CKRecord {
        CKRecord(recordType: CloudKitSyncTransport.recordType, recordID: recordID(name))
    }

    func testSuccessfulSavesYieldNoConflicts() throws {
        let results: [CKRecord.ID: Result<CKRecord, Error>] = [
            recordID("episodes:a"): .success(record("episodes:a")),
            recordID("episodes:b"): .success(record("episodes:b")),
        ]

        XCTAssertTrue(try CloudKitSyncTransport.conflictedSaves(results).isEmpty)
    }

    func testServerRecordChangedBecomesConflictPairedWithServerRecord() throws {
        let server = record("episodes:a")
        server["updatedAt"] = Int64(123)
        let rejection = CKError(.serverRecordChanged, userInfo: [CKRecordChangedErrorServerRecordKey: server])
        let results: [CKRecord.ID: Result<CKRecord, Error>] = [
            recordID("episodes:a"): .failure(rejection),
            recordID("episodes:b"): .success(record("episodes:b")),
        ]

        let conflicts = try CloudKitSyncTransport.conflictedSaves(results)

        XCTAssertEqual(conflicts.count, 1)
        XCTAssertEqual(conflicts.first?.0, recordID("episodes:a"))
        XCTAssertEqual(conflicts.first?.1["updatedAt"] as? Int64, 123)
    }

    func testNonConflictPerRecordFailureThrows() {
        let results: [CKRecord.ID: Result<CKRecord, Error>] = [
            recordID("episodes:a"): .failure(CKError(.quotaExceeded)),
        ]

        XCTAssertThrowsError(try CloudKitSyncTransport.conflictedSaves(results))
    }

    func testServerRecordChangedWithoutServerRecordThrows() {
        let results: [CKRecord.ID: Result<CKRecord, Error>] = [
            recordID("episodes:a"): .failure(CKError(.serverRecordChanged)),
        ]

        XCTAssertThrowsError(try CloudKitSyncTransport.conflictedSaves(results))
    }

    func testPerRecordZoneNotFoundMapsToTransportError() {
        let results: [CKRecord.ID: Result<CKRecord, Error>] = [
            recordID("episodes:a"): .failure(CKError(.zoneNotFound)),
        ]

        XCTAssertThrowsError(try CloudKitSyncTransport.conflictedSaves(results)) { error in
            XCTAssertEqual(error as? SyncTransportError, .zoneNotFound)
        }
    }
}
