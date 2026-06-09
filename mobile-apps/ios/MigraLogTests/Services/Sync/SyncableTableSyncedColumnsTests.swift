import XCTest
import GRDB
@testable import MigraLog

/// Guards the hand-maintained `SyncableTable.syncedColumns` lists against schema drift
/// (#463). The DELETE capture triggers bake these column names into a SQL `json_object`,
/// so if a migration adds/removes a column on a synced table without updating
/// `syncedColumns`, the recoverable tombstone would silently miss (or wrongly include) a
/// column. This asserts, for every synced table, that `syncedColumns` equals the live
/// table's columns minus `deviceLocalColumns`.
final class SyncableTableSyncedColumnsTests: XCTestCase {
    var dbManager: DatabaseManager!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
    }

    override func tearDownWithError() throws {
        dbManager = nil
    }

    func testSyncedColumnsMatchLiveSchemaForEveryTable() throws {
        try dbManager.dbQueue.read { db in
            for table in SyncableTable.allCases {
                let liveColumns = try Row
                    .fetchAll(db, sql: "PRAGMA table_info(\(table.tableName))")
                    .compactMap { $0["name"] as String? }
                let expected = Set(liveColumns).subtracting(table.deviceLocalColumns)
                let declared = Set(table.syncedColumns)

                XCTAssertFalse(liveColumns.isEmpty, "\(table.tableName) has no columns — wrong table name?")
                XCTAssertEqual(
                    declared, expected,
                    """
                    syncedColumns drift for \(table.tableName):
                      missing from syncedColumns: \(expected.subtracting(declared).sorted())
                      extra in syncedColumns:      \(declared.subtracting(expected).sorted())
                    """
                )
            }
        }
    }
}
