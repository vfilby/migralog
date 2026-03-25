import XCTest
@testable import MigraLog

final class MigraLogTests: XCTestCase {
    func testTimestampHelperNow() {
        let now = TimestampHelper.now
        XCTAssertGreaterThan(now, 0)
    }

    func testTimestampHelperFromDate() {
        let date = Date(timeIntervalSince1970: 1000)
        let ts = TimestampHelper.fromDate(date)
        XCTAssertEqual(ts, 1_000_000)
    }

    func testTimestampHelperToDate() {
        let date = TimestampHelper.toDate(1_000_000)
        XCTAssertEqual(date.timeIntervalSince1970, 1000, accuracy: 0.001)
    }

    func testDateStringRoundTrip() {
        let date = Date()
        let str = TimestampHelper.dateString(from: date)
        XCTAssertNotNil(TimestampHelper.dateFromString(str))
    }

    func testJSONHelperEncodeDecodeArray() {
        let locations: [PainLocation] = [.leftEye, .rightTemple]
        let json = JSONHelper.encode(locations)
        let decoded: [PainLocation] = JSONHelper.decodeArray(PainLocation.self, from: json)
        XCTAssertEqual(decoded, locations)
    }

    func testJSONHelperDecodeEmptyString() {
        let decoded: [String] = JSONHelper.decodeArray(String.self, from: nil)
        XCTAssertTrue(decoded.isEmpty)
    }
}
