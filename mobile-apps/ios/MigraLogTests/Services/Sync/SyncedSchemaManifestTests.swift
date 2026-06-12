import XCTest
@testable import MigraLog

final class SyncedSchemaManifestTests: XCTestCase {

    private func manifest(_ tables: [String: [String]]) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        // swiftlint:disable:next force_try
        return String(decoding: try! encoder.encode(tables), as: UTF8.self)
    }

    func testCurrentCoversEverySyncableTable() throws {
        let decoded = try JSONDecoder().decode(
            [String: [String]].self, from: Data(SyncedSchemaManifest.current.utf8)
        )
        for table in SyncableTable.allCases {
            XCTAssertEqual(
                decoded[table.tableName], table.syncedColumns.sorted(),
                "manifest must list \(table.tableName)'s synced columns"
            )
        }
        XCTAssertEqual(decoded.count, SyncableTable.allCases.count)
    }

    func testCurrentIsDeterministic() {
        XCTAssertEqual(SyncedSchemaManifest.current, SyncedSchemaManifest.current)
    }

    func testUnknownOldManifestAssumesColumnsAdded() {
        // First sync after this feature ships (nil) or corrupted state (garbage): the
        // device may carry a pre-existing backfill gap, so it must re-pull once.
        XCTAssertTrue(SyncedSchemaManifest.addsSyncedColumns(from: nil, to: SyncedSchemaManifest.current))
        XCTAssertTrue(SyncedSchemaManifest.addsSyncedColumns(from: "not json", to: SyncedSchemaManifest.current))
    }

    func testIdenticalManifestAddsNothing() {
        let current = SyncedSchemaManifest.current
        XCTAssertFalse(SyncedSchemaManifest.addsSyncedColumns(from: current, to: current))
    }

    func testAddedColumnIsDetected() {
        let old = manifest(["medications": ["id", "name"]])
        let new = manifest(["medications": ["id", "name", "strength"]])
        XCTAssertTrue(SyncedSchemaManifest.addsSyncedColumns(from: old, to: new))
    }

    func testAddedTableIsDetected() {
        // A whole new synced table: its records were skippedUnknownTable before the
        // upgrade, so they too need a re-pull.
        let old = manifest(["medications": ["id", "name"]])
        let new = manifest(["medications": ["id", "name"], "tracking_options": ["id", "value"]])
        XCTAssertTrue(SyncedSchemaManifest.addsSyncedColumns(from: old, to: new))
    }

    func testRemovedColumnDoesNotForceRepull() {
        // Removals never dropped data on read — nothing to backfill.
        let old = manifest(["medications": ["id", "name", "legacy"]])
        let new = manifest(["medications": ["id", "name"]])
        XCTAssertFalse(SyncedSchemaManifest.addsSyncedColumns(from: old, to: new))
    }

    func testRemovedTableDoesNotForceRepull() {
        let old = manifest(["medications": ["id"], "legacy_table": ["id"]])
        let new = manifest(["medications": ["id"]])
        XCTAssertFalse(SyncedSchemaManifest.addsSyncedColumns(from: old, to: new))
    }
}
