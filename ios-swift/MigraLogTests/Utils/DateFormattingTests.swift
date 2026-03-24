import XCTest
@testable import MigraLog

final class DateFormattingTests: XCTestCase {

    // MARK: - Date String (YYYY-MM-DD)

    func testDateStringFromDate() {
        let date = Date(timeIntervalSince1970: 1705312800) // 2024-01-15 in UTC
        let result = DateFormatting.dateString(from: date)
        // Should be a valid YYYY-MM-DD format
        let parts = result.split(separator: "-")
        XCTAssertEqual(parts.count, 3)
        XCTAssertEqual(parts[0].count, 4) // year
        XCTAssertEqual(parts[1].count, 2) // month
        XCTAssertEqual(parts[2].count, 2) // day
    }

    func testDateFromValidString() {
        let result = DateFormatting.date(from: "2024-01-15")
        XCTAssertNotNil(result)
    }

    func testDateFromInvalidString() {
        let result = DateFormatting.date(from: "not-a-date")
        XCTAssertNil(result)
    }

    func testDateFromEmptyString() {
        let result = DateFormatting.date(from: "")
        XCTAssertNil(result)
    }

    func testDateStringRoundTrip() {
        let original = "2024-06-15"
        guard let date = DateFormatting.date(from: original) else {
            XCTFail("Could not parse date")
            return
        }
        let roundTripped = DateFormatting.dateString(from: date)
        XCTAssertEqual(roundTripped, original)
    }

    // MARK: - Display Formatting

    func testDisplayDateReturnsNonEmpty() {
        let date = Date()
        let result = DateFormatting.displayDate(date)
        XCTAssertFalse(result.isEmpty)
    }

    func testDisplayTimeReturnsNonEmpty() {
        let date = Date()
        let result = DateFormatting.displayTime(date)
        XCTAssertFalse(result.isEmpty)
    }

    func testDisplayDateTimeReturnsNonEmpty() {
        let date = Date()
        let result = DateFormatting.displayDateTime(date)
        XCTAssertFalse(result.isEmpty)
    }

    // MARK: - Duration Formatting

    func testFormatDurationMinutesOnly() {
        let result = DateFormatting.formatDuration(milliseconds: 45 * 60_000)
        XCTAssertEqual(result, "45m")
    }

    func testFormatDurationHoursOnly() {
        let result = DateFormatting.formatDuration(milliseconds: 2 * 60 * 60_000)
        XCTAssertEqual(result, "2h")
    }

    func testFormatDurationHoursAndMinutes() {
        let result = DateFormatting.formatDuration(milliseconds: 90 * 60_000)
        XCTAssertEqual(result, "1h 30m")
    }

    func testFormatDurationZero() {
        let result = DateFormatting.formatDuration(milliseconds: 0)
        XCTAssertEqual(result, "0m")
    }

    func testFormatDurationFromStartToEnd() {
        let start: Int64 = 1_700_000_000_000
        let end: Int64 = start + 90 * 60_000
        let result = DateFormatting.formatDuration(from: start, to: end)
        XCTAssertEqual(result, "1h 30m")
    }

    func testFormatDurationOngoing() {
        let start: Int64 = TimestampHelper.now - 60 * 60_000 // 1 hour ago
        let result = DateFormatting.formatDuration(from: start, to: nil)
        XCTAssertTrue(result.hasSuffix("and ongoing"))
    }

    // MARK: - Relative Date

    func testRelativeDateToday() {
        let result = DateFormatting.relativeDate(Date())
        XCTAssertEqual(result, "Today")
    }

    func testRelativeDateYesterday() {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let result = DateFormatting.relativeDate(yesterday)
        XCTAssertEqual(result, "Yesterday")
    }

    func testRelativeDateOlderDate() {
        let oldDate = Calendar.current.date(byAdding: .day, value: -10, to: Date())!
        let result = DateFormatting.relativeDate(oldDate)
        // Should return the display date (not "Today" or "Yesterday")
        XCTAssertNotEqual(result, "Today")
        XCTAssertNotEqual(result, "Yesterday")
        XCTAssertFalse(result.isEmpty)
    }

    // MARK: - Display Time from HH:mm String

    func testDisplayTimeFromValidTimeString() {
        let result = DateFormatting.displayTime(from: "08:00")
        XCTAssertFalse(result.isEmpty)
        // Should contain a time representation (varies by locale)
    }

    func testDisplayTimeFromInvalidTimeString() {
        let result = DateFormatting.displayTime(from: "invalid")
        XCTAssertEqual(result, "invalid") // Returns the input unchanged
    }

    func testDisplayTimeFromAfternoon() {
        let result = DateFormatting.displayTime(from: "14:30")
        XCTAssertFalse(result.isEmpty)
    }
}
