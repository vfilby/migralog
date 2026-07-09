import XCTest
@testable import MigraLog

final class AnalyticsInsightsAdherenceTests: XCTestCase {
    private let calendar = Calendar.current

    /// Fixed reference "now": local noon so day arithmetic is DST-safe.
    private var now: Date {
        calendar.date(byAdding: .hour, value: 12, to: calendar.startOfDay(for: Date()))!
    }

    private func date(daysAgo: Int, hour: Int = 12) -> Date {
        let day = calendar.date(byAdding: .day, value: -daysAgo, to: calendar.startOfDay(for: now))!
        return calendar.date(byAdding: .hour, value: hour, to: day)!
    }

    private func dayString(daysAgo: Int) -> String {
        TimestampHelper.dateString(from: date(daysAgo: daysAgo))
    }

    private func ms(daysAgo: Int, hour: Int = 12) -> Int64 {
        TimestampHelper.fromDate(date(daysAgo: daysAgo, hour: hour))
    }

    func testWeeklyAdherence_countsExpectedAndTaken() {
        let periods = [
            TestFixtures.makeExpectationPeriod(medicationId: "med-p", startDate: dayString(daysAgo: 30))
        ]
        // Taken on 2 of 7 days; a third day has two logs that must cap at 1.
        let doses = [
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 1)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 2)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 3, hour: 8)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 3, hour: 20)),
        ]

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: doses,
            periods: periods,
            excluded: [],
            from: date(daysAgo: 6),
            to: now,
            calendar: calendar
        )

        XCTAssertEqual(weeks.map(\.expected).reduce(0, +), 7)
        XCTAssertEqual(weeks.map(\.taken).reduce(0, +), 3)
    }

    func testWeeklyAdherence_skippedDosesIgnored() {
        let periods = [
            TestFixtures.makeExpectationPeriod(medicationId: "med-a", startDate: dayString(daysAgo: 30))
        ]
        let doses = [
            TestFixtures.makeDose(medicationId: "med-a", timestamp: ms(daysAgo: 1), status: .skipped),
            // A dose for a med with no expectation periods contributes nothing.
            TestFixtures.makeDose(medicationId: "med-unknown", timestamp: ms(daysAgo: 1)),
        ]

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: doses,
            periods: periods,
            excluded: [],
            from: date(daysAgo: 2),
            to: now,
            calendar: calendar
        )

        // 3 days expected, nothing taken.
        XCTAssertEqual(weeks.map(\.expected).reduce(0, +), 3)
        XCTAssertEqual(weeks.map(\.taken).reduce(0, +), 0)
    }

    func testWeeklyAdherence_medAddedMidRangeOnlyCountsFromItsStartDay() {
        // A long-standing med plus one whose period starts 2 days ago: the new
        // med must not add expected doses to days before it existed.
        let periods = [
            TestFixtures.makeExpectationPeriod(medicationId: "med-old", startDate: dayString(daysAgo: 30)),
            TestFixtures.makeExpectationPeriod(medicationId: "med-new", startDate: dayString(daysAgo: 2)),
        ]
        let doses = (0...6).map { TestFixtures.makeDose(medicationId: "med-old", timestamp: ms(daysAgo: $0)) }
            + [TestFixtures.makeDose(medicationId: "med-new", timestamp: ms(daysAgo: 1))]

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: doses,
            periods: periods,
            excluded: [],
            from: date(daysAgo: 6),
            to: now,
            calendar: calendar
        )

        // med-old: 7 expected / 7 taken. med-new: 3 expected (days 2..0) / 1 taken.
        XCTAssertEqual(weeks.map(\.expected).reduce(0, +), 10)
        XCTAssertEqual(weeks.map(\.taken).reduce(0, +), 8)
    }

    func testWeeklyAdherence_closedPeriodKeepsHistoryAndEndsExpectation() {
        // Descheduled 3 days ago: the earlier days keep their expected + taken
        // history, and no expectation accrues after the period's end.
        let periods = [
            TestFixtures.makeExpectationPeriod(
                medicationId: "med-p",
                startDate: dayString(daysAgo: 30),
                endDate: dayString(daysAgo: 3)
            )
        ]
        let doses = [
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 4)),
            // After the period closed: contributes nothing.
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 1)),
        ]

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: doses,
            periods: periods,
            excluded: [],
            from: date(daysAgo: 6),
            to: now,
            calendar: calendar
        )

        // Days 6..3 expected (4 days), 1 taken (day 4). Days 2..0 not graded.
        XCTAssertEqual(weeks.map(\.expected).reduce(0, +), 4)
        XCTAssertEqual(weeks.map(\.taken).reduce(0, +), 1)
    }

    func testWeeklyAdherence_gapBetweenPeriodsIsNotGraded() {
        // Archived days 4..2, re-enabled 1 day ago: the gap carries no
        // expectation, so it can't drag adherence down.
        let periods = [
            TestFixtures.makeExpectationPeriod(
                medicationId: "med-p",
                startDate: dayString(daysAgo: 30),
                endDate: dayString(daysAgo: 5)
            ),
            TestFixtures.makeExpectationPeriod(medicationId: "med-p", startDate: dayString(daysAgo: 1)),
        ]
        let doses = [
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 6)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 5)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 1)),
        ]

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: doses,
            periods: periods,
            excluded: [],
            from: date(daysAgo: 6),
            to: now,
            calendar: calendar
        )

        // Days 6, 5 expected+taken; days 4..2 skipped; days 1, 0 expected with 1 taken.
        XCTAssertEqual(weeks.map(\.expected).reduce(0, +), 4)
        XCTAssertEqual(weeks.map(\.taken).reduce(0, +), 3)
    }

    func testWeeklyAdherence_overlappingPeriodsTakeMaxNotSum() {
        // A sync merge can leave overlapping periods; the day must be graded
        // against the max expectation, never the sum.
        let periods = [
            TestFixtures.makeExpectationPeriod(medicationId: "med-p", startDate: dayString(daysAgo: 6)),
            TestFixtures.makeExpectationPeriod(
                medicationId: "med-p",
                startDate: dayString(daysAgo: 6),
                expectedDailyDoses: 2
            ),
        ]
        let doses = [TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 1))]

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: doses,
            periods: periods,
            excluded: [],
            from: date(daysAgo: 6),
            to: now,
            calendar: calendar
        )

        // 7 days × max(1, 2) = 14 expected, not 21.
        XCTAssertEqual(weeks.map(\.expected).reduce(0, +), 14)
        XCTAssertEqual(weeks.map(\.taken).reduce(0, +), 1)
    }

    func testWeeklyAdherence_excludedDaysDropFromBothSides() {
        let periods = [
            TestFixtures.makeExpectationPeriod(medicationId: "med-p", startDate: dayString(daysAgo: 30))
        ]
        let doses = [TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 1))]

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: doses,
            periods: periods,
            excluded: [dayString(daysAgo: 1)],
            from: date(daysAgo: 2),
            to: now,
            calendar: calendar
        )

        // Day 1 excluded: 2 days expected, and its taken dose doesn't count.
        XCTAssertEqual(weeks.map(\.expected).reduce(0, +), 2)
        XCTAssertEqual(weeks.map(\.taken).reduce(0, +), 0)
    }

    func testWeeklyAdherence_noPeriodsMeansNoData() {
        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: [TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 1))],
            periods: [],
            excluded: [],
            from: date(daysAgo: 6),
            to: now,
            calendar: calendar
        )

        XCTAssertTrue(weeks.isEmpty)
    }
}
