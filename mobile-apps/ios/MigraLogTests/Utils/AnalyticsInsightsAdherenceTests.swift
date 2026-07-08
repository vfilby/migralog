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

    private func ms(daysAgo: Int, hour: Int = 12) -> Int64 {
        TimestampHelper.fromDate(date(daysAgo: daysAgo, hour: hour))
    }

    func testWeeklyAdherence_countsExpectedAndTaken() {
        let preventative = TestFixtures.makeMedication(id: "med-p", type: .preventative, category: .supplement, createdAt: ms(daysAgo: 30))
        let schedules = [TestFixtures.makeSchedule(medicationId: "med-p")]
        // Taken on 2 of 7 days; a third day has two logs that must cap at 1.
        let doses = [
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 1)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 2)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 3, hour: 8)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 3, hour: 20)),
        ]

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: doses,
            medications: [preventative],
            schedulesByMedication: ["med-p": schedules],
            excluded: [],
            from: date(daysAgo: 6),
            to: now,
            calendar: calendar
        )

        XCTAssertEqual(weeks.map(\.expected).reduce(0, +), 7)
        XCTAssertEqual(weeks.map(\.taken).reduce(0, +), 3)
    }

    func testWeeklyAdherence_skippedDosesAndInactiveMedsIgnored() {
        let active = TestFixtures.makeMedication(id: "med-a", type: .preventative, createdAt: ms(daysAgo: 30))
        let inactive = TestFixtures.makeMedication(id: "med-i", type: .preventative, active: false, createdAt: ms(daysAgo: 30))
        let schedules = [
            TestFixtures.makeSchedule(medicationId: "med-a"),
            TestFixtures.makeSchedule(medicationId: "med-i"),
        ]
        let doses = [
            TestFixtures.makeDose(medicationId: "med-a", timestamp: ms(daysAgo: 1), status: .skipped),
            TestFixtures.makeDose(medicationId: "med-i", timestamp: ms(daysAgo: 1)),
        ]

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: doses,
            medications: [active, inactive],
            schedulesByMedication: ["med-a": schedules.filter { $0.medicationId == "med-a" }, "med-i": schedules.filter { $0.medicationId == "med-i" }],
            excluded: [],
            from: date(daysAgo: 2),
            to: now,
            calendar: calendar
        )

        // Only the active med counts: 3 days expected, nothing taken.
        XCTAssertEqual(weeks.map(\.expected).reduce(0, +), 3)
        XCTAssertEqual(weeks.map(\.taken).reduce(0, +), 0)
    }

    func testWeeklyAdherence_medAddedMidRangeOnlyCountsFromItsStartDay() {
        // A long-standing med plus one added 2 days ago: the new med must not
        // add expected doses to days before it existed.
        let old = TestFixtures.makeMedication(id: "med-old", type: .preventative, createdAt: ms(daysAgo: 30))
        let new = TestFixtures.makeMedication(id: "med-new", type: .preventative, createdAt: ms(daysAgo: 2))
        let doses = (0...6).map { TestFixtures.makeDose(medicationId: "med-old", timestamp: ms(daysAgo: $0)) }
            + [TestFixtures.makeDose(medicationId: "med-new", timestamp: ms(daysAgo: 1))]

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: doses,
            medications: [old, new],
            schedulesByMedication: [
                "med-old": [TestFixtures.makeSchedule(medicationId: "med-old")],
                "med-new": [TestFixtures.makeSchedule(medicationId: "med-new")],
            ],
            excluded: [],
            from: date(daysAgo: 6),
            to: now,
            calendar: calendar
        )

        // med-old: 7 expected / 7 taken. med-new: 3 expected (days 2..0) / 1 taken.
        XCTAssertEqual(weeks.map(\.expected).reduce(0, +), 10)
        XCTAssertEqual(weeks.map(\.taken).reduce(0, +), 8)
    }

    func testWeeklyAdherence_noSchedulesMeansNoData() {
        let preventative = TestFixtures.makeMedication(id: "med-p", type: .preventative)

        let weeks = AnalyticsInsights.weeklyAdherence(
            doses: [],
            medications: [preventative],
            schedulesByMedication: [:],
            excluded: [],
            from: date(daysAgo: 6),
            to: now,
            calendar: calendar
        )

        XCTAssertTrue(weeks.isEmpty)
    }
}
