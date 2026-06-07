import XCTest
import GRDB
@testable import MigraLog

final class SyncPayloadCodecTests: XCTestCase {

    func testEncodeDecodeRoundTripPreservesValues() throws {
        let row = Row([
            "id": "e1",
            "notes": "bad headache",
            "start_time": Int64(1_700_000_000_000),
            "severity": 7.5,
            "end_time": nil,
        ])
        let payload = try SyncPayloadCodec.encodePayload(row: row, table: .episodes)
        let decoded = try SyncPayloadCodec.decodePayload(payload)

        XCTAssertEqual(decoded["id"], .text("e1"))
        XCTAssertEqual(decoded["notes"], .text("bad headache"))
        XCTAssertEqual(decoded["start_time"], .int(1_700_000_000_000))
        XCTAssertEqual(decoded["severity"], .double(7.5))
        XCTAssertEqual(decoded["end_time"], .null)
        XCTAssertEqual(decoded.count, 5)
    }

    func testEncodeStripsDeviceLocalColumns() throws {
        let row = Row([
            "id": "sch1",
            "medication_id": "med1",
            "time": "08:00",
            "notification_id": "device-local-xyz",
        ])
        let payload = try SyncPayloadCodec.encodePayload(row: row, table: .medicationSchedules)
        let decoded = try SyncPayloadCodec.decodePayload(payload)

        XCTAssertNil(decoded["notification_id"], "device-local notification_id must not sync")
        XCTAssertFalse(payload.contains("notification_id"))
        XCTAssertEqual(decoded["id"], .text("sch1"))
        XCTAssertEqual(decoded["time"], .text("08:00"))
    }

    func testEncodeProducesSortedKeys() throws {
        let row = Row(["zebra": "z", "apple": "a", "mango": "m"])
        let payload = try SyncPayloadCodec.encodePayload(row: row, table: .episodes)
        XCTAssertEqual(payload, #"{"apple":"a","mango":"m","zebra":"z"}"#)
    }

    func testEncodeThrowsOnBlobColumn() throws {
        let row = Row(["id": "x", "blobby": Data([0xDE, 0xAD])])
        XCTAssertThrowsError(try SyncPayloadCodec.encodePayload(row: row, table: .episodes)) { error in
            XCTAssertEqual(error as? SyncPayloadCodec.CodecError, .unsupportedBlob(column: "blobby"))
        }
    }

    func testDecodeThrowsOnMalformedPayload() {
        XCTAssertThrowsError(try SyncPayloadCodec.decodePayload("not json")) { error in
            XCTAssertEqual(error as? SyncPayloadCodec.CodecError, .malformedPayload)
        }
    }

    /// Exercises DatabaseValue handling against a row read from a real GRDB table.
    func testRoundTripFromActualDatabaseRow() throws {
        let queue = try DatabaseQueue()
        try queue.write { db in
            try db.execute(sql: """
                CREATE TABLE episodes (
                    id TEXT PRIMARY KEY, start_time INTEGER NOT NULL,
                    notes TEXT, latitude REAL, end_time INTEGER
                )
                """)
            try db.execute(
                sql: "INSERT INTO episodes (id, start_time, notes, latitude, end_time) VALUES (?, ?, ?, ?, ?)",
                arguments: ["e9", 1234, "note", 45.5, nil]
            )
        }
        let payload = try queue.read { db -> String in
            let row = try Row.fetchOne(db, sql: "SELECT * FROM episodes WHERE id = 'e9'")!
            return try SyncPayloadCodec.encodePayload(row: row, table: .episodes)
        }
        let decoded = try SyncPayloadCodec.decodePayload(payload)

        XCTAssertEqual(decoded["id"], .text("e9"))
        XCTAssertEqual(decoded["start_time"], .int(1234))
        XCTAssertEqual(decoded["notes"], .text("note"))
        XCTAssertEqual(decoded["latitude"], .double(45.5))
        XCTAssertEqual(decoded["end_time"], .null)
    }
}
