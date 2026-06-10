import XCTest
@testable import MigraLog

final class AnalyticsInsightsTests: XCTestCase {
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

    private func makeOverlay(start: String, end: String?, exclude: Bool) -> CalendarOverlay {
        CalendarOverlay(
            id: UUID().uuidString,
            startDate: start,
            endDate: end,
            label: "Test",
            notes: nil,
            excludeFromStats: exclude,
            createdAt: TimestampHelper.now,
            updatedAt: TimestampHelper.now
        )
    }

    // MARK: - excludedDates

    func testExcludedDates_coversOverlayRange() {
        let overlay = makeOverlay(start: dayString(daysAgo: 5), end: dayString(daysAgo: 3), exclude: true)

        let excluded = AnalyticsInsights.excludedDates(overlays: [overlay], now: now, calendar: calendar)

        XCTAssertEqual(excluded, [dayString(daysAgo: 5), dayString(daysAgo: 4), dayString(daysAgo: 3)])
    }

    func testExcludedDates_ignoresNonExcludingOverlays() {
        let overlay = makeOverlay(start: dayString(daysAgo: 5), end: dayString(daysAgo: 3), exclude: false)

        let excluded = AnalyticsInsights.excludedDates(overlays: [overlay], now: now, calendar: calendar)

        XCTAssertTrue(excluded.isEmpty)
    }

    func testExcludedDates_openEndedOverlayRunsThroughToday() {
        let overlay = makeOverlay(start: dayString(daysAgo: 2), end: nil, exclude: true)

        let excluded = AnalyticsInsights.excludedDates(overlays: [overlay], now: now, calendar: calendar)

        XCTAssertEqual(excluded, [dayString(daysAgo: 2), dayString(daysAgo: 1), dayString(daysAgo: 0)])
    }

    // MARK: - headacheDays

    func testHeadacheDays_episodeSpanningDaysMarksEachDay() {
        let episode = TestFixtures.makeEpisode(startTime: ms(daysAgo: 4, hour: 20), endTime: ms(daysAgo: 2, hour: 6))

        let days = AnalyticsInsights.headacheDays(episodes: [episode], statuses: [], excluded: [], now: now, calendar: calendar)

        XCTAssertEqual(days, [dayString(daysAgo: 4), dayString(daysAgo: 3), dayString(daysAgo: 2)])
    }

    func testHeadacheDays_redStatusCountsYellowAndGreenDoNot() {
        let statuses = [
            TestFixtures.makeDailyStatus(date: dayString(daysAgo: 1), status: .red),
            TestFixtures.makeDailyStatus(date: dayString(daysAgo: 2), status: .yellow),
            TestFixtures.makeDailyStatus(date: dayString(daysAgo: 3), status: .green),
        ]

        let days = AnalyticsInsights.headacheDays(episodes: [], statuses: statuses, excluded: [], now: now, calendar: calendar)

        XCTAssertEqual(days, [dayString(daysAgo: 1)])
    }

    func testHeadacheDays_excludedDatesAreRemoved() {
        let episode = TestFixtures.makeEpisode(startTime: ms(daysAgo: 3), endTime: ms(daysAgo: 3, hour: 18))
        let statuses = [TestFixtures.makeDailyStatus(date: dayString(daysAgo: 1), status: .red)]

        let days = AnalyticsInsights.headacheDays(
            episodes: [episode],
            statuses: statuses,
            excluded: [dayString(daysAgo: 3)],
            now: now,
            calendar: calendar
        )

        XCTAssertEqual(days, [dayString(daysAgo: 1)])
    }

    // MARK: - rollingCounts

    func testCountInWindow_respectsWindowBoundary() {
        let flags: Set<String> = [dayString(daysAgo: 0), dayString(daysAgo: 27), dayString(daysAgo: 28)]

        // 28-day window ending today covers daysAgo 0...27 — not 28.
        let count = AnalyticsInsights.countInWindow(flags, ending: now, calendar: calendar)

        XCTAssertEqual(count, 2)
    }

    func testRollingCounts_producesOnePointPerDay() {
        let flags: Set<String> = [dayString(daysAgo: 1)]

        let points = AnalyticsInsights.rollingCounts(of: flags, from: date(daysAgo: 6), to: now, calendar: calendar)

        XCTAssertEqual(points.count, 7)
        XCTAssertEqual(points.last?.count, 1)
        // Day 6 ago: window covers daysAgo 6...33, flag on day 1 not included.
        XCTAssertEqual(points.first?.count, 0)
    }

    // MARK: - intakeDays

    func testIntakeDays_countsDistinctDaysNotDoses() {
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        let doses = [
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 1, hour: 8)),
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 1, hour: 14)),
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 1, hour: 20)),
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 2)),
        ]

        let intake = AnalyticsInsights.intakeDays(doses: doses, medications: [triptan], excluded: [], calendar: calendar)

        XCTAssertEqual(intake[.triptan], [dayString(daysAgo: 1), dayString(daysAgo: 2)])
    }

    func testIntakeDays_classifiesByCategoryAndIgnoresOthers() {
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        let nsaid = TestFixtures.makeMedication(id: "med-n", type: .rescue, category: .nsaid)
        let otc = TestFixtures.makeMedication(id: "med-o", type: .rescue, category: .otc)
        let preventative = TestFixtures.makeMedication(id: "med-p", type: .preventative, category: .cgrp)
        let uncategorized = TestFixtures.makeMedication(id: "med-u", type: .rescue, category: nil)
        let doses = [
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 1)),
            TestFixtures.makeDose(medicationId: "med-n", timestamp: ms(daysAgo: 2)),
            TestFixtures.makeDose(medicationId: "med-o", timestamp: ms(daysAgo: 3)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 4)),
            TestFixtures.makeDose(medicationId: "med-u", timestamp: ms(daysAgo: 5)),
        ]

        let intake = AnalyticsInsights.intakeDays(
            doses: doses,
            medications: [triptan, nsaid, otc, preventative, uncategorized],
            excluded: [],
            calendar: calendar
        )

        XCTAssertEqual(intake[.triptan], [dayString(daysAgo: 1)])
        XCTAssertEqual(intake[.simpleAnalgesic], [dayString(daysAgo: 2), dayString(daysAgo: 3)])
    }

    func testIntakeDays_rescueCgrpIsItsOwnClass() {
        let gepant = TestFixtures.makeMedication(id: "med-g", type: .rescue, category: .cgrp)
        let doses = [TestFixtures.makeDose(medicationId: "med-g", timestamp: ms(daysAgo: 1))]

        let intake = AnalyticsInsights.intakeDays(doses: doses, medications: [gepant], excluded: [], calendar: calendar)

        XCTAssertEqual(intake[.cgrpAcute], [dayString(daysAgo: 1)])
        XCTAssertNil(intake[.triptan])
    }

    func testIntakeDays_skippedDosesAndExcludedDaysIgnored() {
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        let doses = [
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 1), status: .skipped),
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 2)),
        ]

        let intake = AnalyticsInsights.intakeDays(
            doses: doses,
            medications: [triptan],
            excluded: [dayString(daysAgo: 2)],
            calendar: calendar
        )

        XCTAssertNil(intake[.triptan])
    }

    // MARK: - Severity bins

    func testSeverityBin_boundaries() {
        XCTAssertEqual(AnalyticsInsights.SeverityBin.bin(forPeak: 0), .mild)
        XCTAssertEqual(AnalyticsInsights.SeverityBin.bin(forPeak: 2.9), .mild)
        XCTAssertEqual(AnalyticsInsights.SeverityBin.bin(forPeak: 3.0), .moderate)
        XCTAssertEqual(AnalyticsInsights.SeverityBin.bin(forPeak: 4.9), .moderate)
        XCTAssertEqual(AnalyticsInsights.SeverityBin.bin(forPeak: 5.0), .severe)
        XCTAssertEqual(AnalyticsInsights.SeverityBin.bin(forPeak: 6.9), .severe)
        XCTAssertEqual(AnalyticsInsights.SeverityBin.bin(forPeak: 7.0), .verySevere)
        XCTAssertEqual(AnalyticsInsights.SeverityBin.bin(forPeak: 10.0), .verySevere)
    }

    func testSeverityWeekCounts_groupsByWeekUsingPeakIntensity() {
        let ep1 = TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), endTime: ms(daysAgo: 1, hour: 16))
        let ep2 = TestFixtures.makeEpisode(id: "ep-2", startTime: ms(daysAgo: 1, hour: 18), endTime: ms(daysAgo: 1, hour: 20))
        let unrated = TestFixtures.makeEpisode(id: "ep-3", startTime: ms(daysAgo: 2))
        let readings = [
            TestFixtures.makeReading(episodeId: "ep-1", intensity: 4.0),
            TestFixtures.makeReading(episodeId: "ep-1", intensity: 8.0), // peak → very severe
            TestFixtures.makeReading(episodeId: "ep-2", intensity: 2.0), // mild
        ]

        let counts = AnalyticsInsights.severityWeekCounts(
            episodes: [ep1, ep2, unrated],
            readings: readings,
            excluded: [],
            calendar: calendar
        )

        let weekStart = calendar.dateInterval(of: .weekOfYear, for: date(daysAgo: 1))!.start
        XCTAssertEqual(counts.count, 2) // unrated episode skipped
        XCTAssertTrue(counts.allSatisfy { $0.weekStart == weekStart })
        XCTAssertEqual(counts.first { $0.bin == .verySevere }?.count, 1)
        XCTAssertEqual(counts.first { $0.bin == .mild }?.count, 1)
    }

    // MARK: - Time of day

    func testTimeOfDayBins_bucketsStartHoursAndZeroFills() {
        let episodes = [
            TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1, hour: 2)),
            TestFixtures.makeEpisode(id: "ep-2", startTime: ms(daysAgo: 2, hour: 13)),
            TestFixtures.makeEpisode(id: "ep-3", startTime: ms(daysAgo: 3, hour: 14)),
        ]

        let bins = AnalyticsInsights.timeOfDayBins(episodes: episodes, excluded: [], calendar: calendar)

        XCTAssertEqual(bins.count, 8)
        XCTAssertEqual(bins.first { $0.hour == 0 }?.count, 1)
        XCTAssertEqual(bins.first { $0.hour == 12 }?.count, 2)
        XCTAssertEqual(bins.map(\.count).reduce(0, +), 3)
    }

    // MARK: - Warnings

    private func headacheDaySet(count: Int) -> Set<String> {
        Set((0..<count).map { dayString(daysAgo: $0) })
    }

    func testWarnings_chronicRangeAlert() {
        let warnings = AnalyticsInsights.warnings(
            headacheDays: headacheDaySet(count: 16),
            intakeDays: [:],
            episodes: [],
            readings: [],
            excluded: [],
            now: now,
            calendar: calendar
        )

        XCTAssertTrue(warnings.contains { $0.id == "chronic-range" && $0.severity == .alert })
        XCTAssertFalse(warnings.contains { $0.id == "elevated-range" })
    }

    func testWarnings_elevatedRangeCaution() {
        let warnings = AnalyticsInsights.warnings(
            headacheDays: headacheDaySet(count: 11),
            intakeDays: [:],
            episodes: [],
            readings: [],
            excluded: [],
            now: now,
            calendar: calendar
        )

        XCTAssertTrue(warnings.contains { $0.id == "elevated-range" && $0.severity == .caution })
        XCTAssertFalse(warnings.contains { $0.id == "chronic-range" })
    }

    func testWarnings_medicationOveruseThresholds() {
        let triptanDays = Set((0..<10).map { dayString(daysAgo: $0) })
        let nsaidDays = Set((0..<13).map { dayString(daysAgo: $0) })

        let warnings = AnalyticsInsights.warnings(
            headacheDays: [],
            intakeDays: [.triptan: triptanDays, .simpleAnalgesic: nsaidDays],
            episodes: [],
            readings: [],
            excluded: [],
            now: now,
            calendar: calendar
        )

        // Triptans at 10 days = at the ≥10 guideline → alert.
        XCTAssertTrue(warnings.contains { $0.id == "moh-triptan" && $0.severity == .alert })
        // Simple analgesics at 13 days = within 2 of the 15-day guideline → caution.
        XCTAssertTrue(warnings.contains { $0.id == "moh-near-simpleAnalgesic" && $0.severity == .caution })
        XCTAssertFalse(warnings.contains { $0.id == "moh-simpleAnalgesic" })
    }

    func testWarnings_risingRescueUse() {
        // 2 intake days in the previous 28-day window, 6 in the current one.
        let previous = Set([dayString(daysAgo: 30), dayString(daysAgo: 35)])
        let current = Set((1...6).map { dayString(daysAgo: $0) })

        let warnings = AnalyticsInsights.warnings(
            headacheDays: [],
            intakeDays: [.triptan: current.union(previous)],
            episodes: [],
            readings: [],
            excluded: [],
            now: now,
            calendar: calendar
        )

        XCTAssertTrue(warnings.contains { $0.id == "rescue-rising" })
    }

    func testWarnings_intensityRisingNeedsThreeRatedEpisodesPerWindow() {
        var episodes: [Episode] = []
        var readings: [IntensityReading] = []
        // Previous window: 3 episodes peaking at 4.
        for (idx, daysAgo) in [30, 35, 40].enumerated() {
            let id = "prev-\(idx)"
            episodes.append(TestFixtures.makeEpisode(id: id, startTime: ms(daysAgo: daysAgo)))
            readings.append(TestFixtures.makeReading(episodeId: id, intensity: 4.0))
        }
        // Current window: 3 episodes peaking at 6.
        for (idx, daysAgo) in [2, 8, 14].enumerated() {
            let id = "cur-\(idx)"
            episodes.append(TestFixtures.makeEpisode(id: id, startTime: ms(daysAgo: daysAgo)))
            readings.append(TestFixtures.makeReading(episodeId: id, intensity: 6.0))
        }

        let warnings = AnalyticsInsights.warnings(
            headacheDays: [],
            intakeDays: [:],
            episodes: episodes,
            readings: readings,
            excluded: [],
            now: now,
            calendar: calendar
        )

        XCTAssertTrue(warnings.contains { $0.id == "intensity-rising" && $0.severity == .info })
    }

    func testWarnings_cgrpHasNoOveruseWarning() {
        // Heavy but steady gepant use: 10 days in each 28-day window.
        let current = Set((1...10).map { dayString(daysAgo: $0) })
        let previous = Set((29...38).map { dayString(daysAgo: $0) })

        let warnings = AnalyticsInsights.warnings(
            headacheDays: [],
            intakeDays: [.cgrpAcute: current.union(previous)],
            episodes: [],
            readings: [],
            excluded: [],
            now: now,
            calendar: calendar
        )

        XCTAssertFalse(warnings.contains { $0.id.hasPrefix("moh") })
    }

    // MARK: - Monthly summary

    func testMonthlySummaries_countsAndPartialFlags() {
        // Range: last 40 days — spans two calendar months, both partial
        // unless the range happens to align exactly with month boundaries.
        let from = date(daysAgo: 40)
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        let episodes = [
            TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), endTime: ms(daysAgo: 1, hour: 18)),
            TestFixtures.makeEpisode(id: "ep-2", startTime: ms(daysAgo: 2, hour: 20), endTime: ms(daysAgo: 1, hour: 2)),
        ]
        let doses = [
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 1, hour: 9)),
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 1, hour: 21)),
        ]

        let summaries = AnalyticsInsights.monthlySummaries(
            episodes: episodes,
            doses: doses,
            medications: [triptan],
            excluded: [],
            from: from,
            to: now,
            calendar: calendar
        )

        XCTAssertGreaterThanOrEqual(summaries.count, 2)
        // The current month is always partial (it is still running).
        XCTAssertEqual(summaries.last?.isPartial, true)
        XCTAssertEqual(summaries.map(\.episodeCount).reduce(0, +), 2)
        // ep-1 covers one day, ep-2 covers two days (one shared with ep-1) → 2 distinct days.
        XCTAssertEqual(summaries.map(\.episodeDays).reduce(0, +), 2)
        // Two doses on the same day → 2 doses, 1 intake day.
        XCTAssertEqual(summaries.map(\.totalDoses).reduce(0, +), 2)
        XCTAssertEqual(summaries.map(\.totalIntakeDays).reduce(0, +), 1)
        let triptanStats = summaries.compactMap { $0.classStats[.triptan] }
        XCTAssertEqual(triptanStats.map(\.doses).reduce(0, +), 2)
        XCTAssertEqual(triptanStats.map(\.days).reduce(0, +), 1)
        let medStats = summaries.compactMap { $0.medStats["med-t"] }
        XCTAssertEqual(medStats.map(\.doses).reduce(0, +), 2)
    }

    func testMonthlySummaries_excludedDaysDropFromAllCounts() {
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        let episodes = [TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), endTime: ms(daysAgo: 1, hour: 18))]
        let doses = [TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 1, hour: 9))]

        let summaries = AnalyticsInsights.monthlySummaries(
            episodes: episodes,
            doses: doses,
            medications: [triptan],
            excluded: [dayString(daysAgo: 1)],
            from: date(daysAgo: 10),
            to: now,
            calendar: calendar
        )

        XCTAssertEqual(summaries.map(\.episodeCount).reduce(0, +), 0)
        XCTAssertEqual(summaries.map(\.episodeDays).reduce(0, +), 0)
        XCTAssertEqual(summaries.map(\.totalDoses).reduce(0, +), 0)
    }

    func testTotalSummary_sumsAcrossMonths() {
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        let episodes = [
            TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 35), endTime: ms(daysAgo: 35, hour: 18)),
            TestFixtures.makeEpisode(id: "ep-2", startTime: ms(daysAgo: 1), endTime: ms(daysAgo: 1, hour: 18)),
        ]
        let doses = [
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 35)),
            TestFixtures.makeDose(medicationId: "med-t", timestamp: ms(daysAgo: 1)),
        ]
        let summaries = AnalyticsInsights.monthlySummaries(
            episodes: episodes,
            doses: doses,
            medications: [triptan],
            excluded: [],
            from: date(daysAgo: 40),
            to: now,
            calendar: calendar
        )

        let total = AnalyticsInsights.totalSummary(of: summaries)

        XCTAssertEqual(total?.episodeCount, 2)
        XCTAssertEqual(total?.episodeDays, 2)
        XCTAssertEqual(total?.totalDoses, 2)
        XCTAssertEqual(total?.totalIntakeDays, 2)
        XCTAssertEqual(total?.classStats[.triptan]?.days, 2)
        XCTAssertEqual(total?.medStats["med-t"]?.doses, 2)
        XCTAssertEqual(total?.isPartial, true)
        XCTAssertNil(AnalyticsInsights.totalSummary(of: []))
    }

    // MARK: - Weekly adherence

    func testWeeklyAdherence_countsExpectedAndTaken() {
        let preventative = TestFixtures.makeMedication(id: "med-p", type: .preventative, category: .supplement)
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
        let active = TestFixtures.makeMedication(id: "med-a", type: .preventative)
        let inactive = TestFixtures.makeMedication(id: "med-i", type: .preventative, active: false)
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

    func testWarnings_quietDataProducesNoWarnings() {
        let warnings = AnalyticsInsights.warnings(
            headacheDays: headacheDaySet(count: 3),
            intakeDays: [.triptan: [dayString(daysAgo: 4)]],
            episodes: [],
            readings: [],
            excluded: [],
            now: now,
            calendar: calendar
        )

        XCTAssertTrue(warnings.isEmpty)
    }
}
