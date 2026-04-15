import XCTest
@testable import MigraLog

final class CategoryUsageStatusTests: XCTestCase {
    private func limit(max: Int = 15, window: Int = 30, category: MedicationCategory = .nsaid) -> CategoryUsageLimit {
        CategoryUsageLimit(category: category, maxDays: max, windowDays: window)
    }

    // MARK: - evaluate: no limit configured

    func testEvaluate_noLimit_returnsNoLimit() {
        let status = CategoryUsageStatus.evaluate(daysUsed: 10, limit: nil)
        XCTAssertEqual(status, .noLimit)
        XCTAssertFalse(status.isWarning)
        XCTAssertFalse(status.isStrong)
    }

    // MARK: - evaluate: boundary cases

    func testEvaluate_zeroUsed_returnsOk() {
        let status = CategoryUsageStatus.evaluate(daysUsed: 0, limit: limit())
        XCTAssertEqual(status, .ok(daysUsed: 0, maxDays: 15, windowDays: 30))
        XCTAssertFalse(status.isWarning)
    }

    func testEvaluate_threeUnderMax_stillOk() {
        // max-3 = 12 -> ok
        let status = CategoryUsageStatus.evaluate(daysUsed: 12, limit: limit())
        XCTAssertEqual(status, .ok(daysUsed: 12, maxDays: 15, windowDays: 30))
        XCTAssertFalse(status.isWarning)
    }

    func testEvaluate_twoUnderMax_isApproachingSoftStart() {
        // max-2 = 13 -> approaching (soft warning begins)
        let status = CategoryUsageStatus.evaluate(daysUsed: 13, limit: limit())
        XCTAssertEqual(status, .approaching(daysUsed: 13, maxDays: 15, windowDays: 30))
        XCTAssertTrue(status.isWarning)
        XCTAssertFalse(status.isStrong)
    }

    func testEvaluate_oneUnderMax_isApproaching() {
        // max-1 = 14 -> approaching
        let status = CategoryUsageStatus.evaluate(daysUsed: 14, limit: limit())
        XCTAssertEqual(status, .approaching(daysUsed: 14, maxDays: 15, windowDays: 30))
        XCTAssertTrue(status.isWarning)
        XCTAssertFalse(status.isStrong)
    }

    func testEvaluate_atMax_isStrong() {
        // max = 15 -> atOrOver (strong)
        let status = CategoryUsageStatus.evaluate(daysUsed: 15, limit: limit())
        XCTAssertEqual(status, .atOrOver(daysUsed: 15, maxDays: 15, windowDays: 30))
        XCTAssertTrue(status.isWarning)
        XCTAssertTrue(status.isStrong)
    }

    func testEvaluate_overMax_isStrong() {
        // max+5 = 20 -> atOrOver (strong)
        let status = CategoryUsageStatus.evaluate(daysUsed: 20, limit: limit())
        XCTAssertEqual(status, .atOrOver(daysUsed: 20, maxDays: 15, windowDays: 30))
        XCTAssertTrue(status.isWarning)
        XCTAssertTrue(status.isStrong)
    }

    // MARK: - summary formatting

    func testSummary_noLimit_returnsNil() {
        XCTAssertNil(CategoryUsageStatus.noLimit.summary(category: .nsaid))
    }

    func testSummary_ok_returnsNil() {
        let status = CategoryUsageStatus.evaluate(daysUsed: 5, limit: limit())
        XCTAssertNil(status.summary(category: .nsaid))
    }

    func testSummary_approaching_returnsFormattedString() {
        let status = CategoryUsageStatus.evaluate(daysUsed: 13, limit: limit())
        let summary = status.summary(category: .nsaid)
        XCTAssertEqual(summary, "NSAID used 13 of 15 days in last 30")
    }

    func testSummary_atOrOver_returnsFormattedString() {
        let status = CategoryUsageStatus.evaluate(daysUsed: 17, limit: limit())
        let summary = status.summary(category: .triptan)
        XCTAssertEqual(summary, "Triptan used 17 of 15 days in last 30")
    }
}
