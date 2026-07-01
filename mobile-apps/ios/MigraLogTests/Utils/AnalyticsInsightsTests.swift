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

    func testClassMedicationNames_activeOrDosedRescueMedsSortedByName() {
        let active = TestFixtures.makeMedication(id: "med-a", name: "Sumatriptan", type: .rescue, category: .triptan)
        // Inactive but used in the window — still counted, so still listed.
        let retired = TestFixtures.makeMedication(id: "med-r", name: "Rizatriptan", type: .rescue, active: false, category: .triptan)
        // Inactive and unused — not listed.
        let dormant = TestFixtures.makeMedication(id: "med-d", name: "Eletriptan", type: .rescue, active: false, category: .triptan)
        let preventative = TestFixtures.makeMedication(id: "med-p", name: "Topiramate", type: .preventative, category: .preventive)
        let doses = [TestFixtures.makeDose(medicationId: "med-r", timestamp: ms(daysAgo: 2))]

        let names = AnalyticsInsights.classMedicationNames(
            medications: [active, retired, dormant, preventative],
            doses: doses
        )

        XCTAssertEqual(names[.triptan], ["Rizatriptan", "Sumatriptan"])
        XCTAssertNil(names[.simpleAnalgesic])
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

    // MARK: - Symptom frequency

    func testSymptomFrequencies_ranksByEpisodeCountWithPercent() {
        let episodes = [
            TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), symptoms: [.nausea, .aura]),
            TestFixtures.makeEpisode(id: "ep-2", startTime: ms(daysAgo: 2), symptoms: [.nausea]),
            TestFixtures.makeEpisode(id: "ep-3", startTime: ms(daysAgo: 3), symptoms: [.nausea, .lightSensitivity]),
            TestFixtures.makeEpisode(id: "ep-4", startTime: ms(daysAgo: 4), symptoms: []),
        ]

        let freqs = AnalyticsInsights.symptomFrequencies(episodes: episodes, excluded: [], calendar: calendar)

        // Nausea in 3 of 4 episodes leads; aura and light sensitivity tie at 1
        // and break by raw value ("aura" < "light_sensitivity").
        XCTAssertEqual(freqs.map(\.symptom), [.nausea, .aura, .lightSensitivity])
        XCTAssertEqual(freqs[0].episodeCount, 3)
        XCTAssertEqual(freqs[0].percentOfEpisodes, 75, accuracy: 0.001)
        XCTAssertEqual(freqs[1].percentOfEpisodes, 25, accuracy: 0.001)
    }

    func testSymptomFrequencies_countsEachSymptomOncePerEpisode() {
        let episode = TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), symptoms: [.nausea, .nausea])

        let freqs = AnalyticsInsights.symptomFrequencies(episodes: [episode], excluded: [], calendar: calendar)

        XCTAssertEqual(freqs.count, 1)
        XCTAssertEqual(freqs[0].episodeCount, 1)
        XCTAssertEqual(freqs[0].percentOfEpisodes, 100, accuracy: 0.001)
    }

    func testSymptomFrequencies_skipsExcludedEpisodesFromCountAndDenominator() {
        let episodes = [
            TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), symptoms: [.nausea]),
            TestFixtures.makeEpisode(id: "ep-2", startTime: ms(daysAgo: 5), symptoms: [.nausea, .aura]),
        ]

        let freqs = AnalyticsInsights.symptomFrequencies(
            episodes: episodes, excluded: [dayString(daysAgo: 5)], calendar: calendar
        )

        // Only ep-1 counts: nausea 1/1 = 100%, aura gone with the excluded episode.
        XCTAssertEqual(freqs.map(\.symptom), [.nausea])
        XCTAssertEqual(freqs[0].percentOfEpisodes, 100, accuracy: 0.001)
    }

    func testSymptomFrequencies_emptyWhenNoEpisodes() {
        XCTAssertTrue(AnalyticsInsights.symptomFrequencies(episodes: [], excluded: [], calendar: calendar).isEmpty)
    }

    // MARK: - Pain location frequency

    func testPainLocationFrequencies_ranksByEpisodeCountWithPercent() {
        let episodes = [
            TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), locations: [.leftTemple, .leftEye]),
            TestFixtures.makeEpisode(id: "ep-2", startTime: ms(daysAgo: 2), locations: [.leftTemple]),
            TestFixtures.makeEpisode(id: "ep-3", startTime: ms(daysAgo: 3), locations: [.rightEye]),
        ]

        let freqs = AnalyticsInsights.painLocationFrequencies(episodes: episodes, excluded: [], calendar: calendar)

        XCTAssertEqual(freqs.first?.location, .leftTemple)
        XCTAssertEqual(freqs.first?.episodeCount, 2)
        XCTAssertEqual(freqs.first?.percentOfEpisodes ?? 0, 200.0 / 3.0, accuracy: 0.001)
        XCTAssertEqual(Set(freqs.map(\.location)), [.leftTemple, .leftEye, .rightEye])
    }

    // MARK: - Frequency union with mid-episode logs

    private func symptomLog(episodeId: String, _ symptom: Symptom) -> SymptomLog {
        SymptomLog(
            id: UUID().uuidString, episodeId: episodeId, symptom: symptom,
            onsetTime: ms(daysAgo: 1), resolutionTime: nil, severity: nil,
            createdAt: ms(daysAgo: 1), updatedAt: ms(daysAgo: 1)
        )
    }

    private func locationLog(episodeId: String, _ locations: [PainLocation]) -> PainLocationLog {
        PainLocationLog(
            id: UUID().uuidString, episodeId: episodeId, timestamp: ms(daysAgo: 1),
            painLocations: locations, createdAt: ms(daysAgo: 1), updatedAt: ms(daysAgo: 1)
        )
    }

    func testSymptomFrequencies_unionsMidEpisodeSymptomLogs() {
        // ep-1 starts with nausea; aura is added later via a Log Update.
        let episode = TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), symptoms: [.nausea])
        let logs = [symptomLog(episodeId: "ep-1", .aura)]

        let freqs = AnalyticsInsights.symptomFrequencies(
            episodes: [episode], symptomLogs: logs, excluded: [], calendar: calendar
        )

        XCTAssertEqual(Set(freqs.map(\.symptom)), [.nausea, .aura])
        XCTAssertTrue(freqs.allSatisfy { $0.episodeCount == 1 })
        XCTAssertTrue(freqs.allSatisfy { $0.percentOfEpisodes == 100 })
    }

    func testPainLocationFrequencies_addRemoveReAddCountsLocationOnce() {
        // ep-1 starts with leftTemple; rightEye is added, removed, then re-added
        // across three Log Update snapshots. Each snapshot is the full set.
        let episode = TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), locations: [.leftTemple])
        let logs = [
            locationLog(episodeId: "ep-1", [.leftTemple, .rightEye]),
            locationLog(episodeId: "ep-1", [.leftTemple]),
            locationLog(episodeId: "ep-1", [.leftTemple, .rightEye]),
        ]

        let freqs = AnalyticsInsights.painLocationFrequencies(
            episodes: [episode], locationLogs: logs, excluded: [], calendar: calendar
        )

        // rightEye counted once despite three snapshots; both at 1/1 = 100%.
        XCTAssertEqual(Set(freqs.map(\.location)), [.leftTemple, .rightEye])
        XCTAssertEqual(freqs.first { $0.location == .rightEye }?.episodeCount, 1)
        XCTAssertTrue(freqs.allSatisfy { $0.percentOfEpisodes == 100 })
    }

    func testPainLocationFrequencies_countsLocationOnlyEverAddedMidEpisode() {
        // ep-1's record has no locations; rightNeck appears only in a log.
        let episode = TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), locations: [])
        let logs = [locationLog(episodeId: "ep-1", [.rightNeck])]

        let freqs = AnalyticsInsights.painLocationFrequencies(
            episodes: [episode], locationLogs: logs, excluded: [], calendar: calendar
        )

        XCTAssertEqual(freqs.map(\.location), [.rightNeck])
        XCTAssertEqual(freqs.first?.episodeCount, 1)
    }

    func testFrequencies_ignoreLogsForEpisodesOutsideTheSet() {
        // A log whose episode isn't in the analyzed set must not be counted.
        let episode = TestFixtures.makeEpisode(id: "ep-1", startTime: ms(daysAgo: 1), locations: [.leftTemple])
        let logs = [locationLog(episodeId: "ep-other", [.rightEye])]

        let freqs = AnalyticsInsights.painLocationFrequencies(
            episodes: [episode], locationLogs: logs, excluded: [], calendar: calendar
        )

        XCTAssertEqual(freqs.map(\.location), [.leftTemple])
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
        // Use a FIXED mid-month reference instant rather than the wall clock so
        // the "current month is partial" assertion is deterministic. With the real
        // `now` this test was flaky: on a month's final day the exclusive range end
        // aligns with the month boundary (isPartial == false), and `now` re-samples
        // the clock on each access so separate reads could straddle a boundary.
        // May 15 sits mid-month and well clear of any DST transition.
        let refDay = calendar.startOfDay(
            for: calendar.date(from: DateComponents(year: 2025, month: 5, day: 15))!
        )
        func dateAt(daysAgo: Int, hour: Int = 12) -> Date {
            let day = calendar.date(byAdding: .day, value: -daysAgo, to: refDay)!
            return calendar.date(byAdding: .hour, value: hour, to: day)!
        }
        func msAt(daysAgo: Int, hour: Int = 12) -> Int64 {
            TimestampHelper.fromDate(dateAt(daysAgo: daysAgo, hour: hour))
        }
        let referenceNow = dateAt(daysAgo: 0)
        // Range: last 40 days — spans two calendar months (April and May 2025),
        // both partial: April's start precedes the range, May is still running.
        let from = calendar.date(byAdding: .day, value: -40, to: referenceNow)!
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        let episodes = [
            TestFixtures.makeEpisode(id: "ep-1", startTime: msAt(daysAgo: 1), endTime: msAt(daysAgo: 1, hour: 18)),
            TestFixtures.makeEpisode(id: "ep-2", startTime: msAt(daysAgo: 2, hour: 20), endTime: msAt(daysAgo: 1, hour: 2)),
        ]
        let doses = [
            TestFixtures.makeDose(medicationId: "med-t", timestamp: msAt(daysAgo: 1, hour: 9)),
            TestFixtures.makeDose(medicationId: "med-t", timestamp: msAt(daysAgo: 1, hour: 21)),
        ]

        let summaries = AnalyticsInsights.monthlySummaries(
            episodes: episodes,
            doses: doses,
            medications: [triptan],
            excluded: [],
            from: from,
            to: referenceNow,
            calendar: calendar
        )

        XCTAssertGreaterThanOrEqual(summaries.count, 2)
        // The final summary is the current month (May 2025). Because the reference
        // instant is mid-month, the range ends before the month boundary, so the
        // current month is unambiguously partial.
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

    // MARK: - medicationEffectiveness (time to relief)

    func testMedicationEffectiveness_summarizesReliefMedian() {
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        // Three doses with explicit relief 20, 30, 40 → median 30, n=3.
        let reliefs = [20, 30, 40]
        let doses = reliefs.enumerated().map { index, relief in
            TestFixtures.makeDose(id: "d\(index)", medicationId: "med-t", timestamp: ms(daysAgo: index + 1), timeToRelief: relief)
        }

        let result = AnalyticsInsights.medicationEffectiveness(
            doses: doses, medications: [triptan], readings: [], excluded: [], calendar: calendar
        )

        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.takenDoses, 3)
        XCTAssertEqual(result.first?.reliefDoses, 3)
        XCTAssertEqual(result.first?.reliefMedianMinutes ?? 0, 30, accuracy: 0.0001)
    }

    func testMedicationEffectiveness_gatesReliefBelowMinimumDoses() {
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        let doses = [
            TestFixtures.makeDose(id: "d0", medicationId: "med-t", timestamp: ms(daysAgo: 1), timeToRelief: 30),
            TestFixtures.makeDose(id: "d1", medicationId: "med-t", timestamp: ms(daysAgo: 2), timeToRelief: 45),
        ]

        let result = AnalyticsInsights.medicationEffectiveness(
            doses: doses, medications: [triptan], readings: [], excluded: [], calendar: calendar
        )

        // The medication still appears (2 taken doses) but its median is gated.
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.takenDoses, 2)
        XCTAssertEqual(result.first?.reliefDoses, 2)
        XCTAssertNil(result.first?.reliefMedianMinutes)
    }

    func testMedicationEffectiveness_derivesReliefFromIntensityDrop() {
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        var doses: [MedicationDose] = []
        var readings: [IntensityReading] = []
        // Three episodes, each: baseline reading, dose, then a drop 30 min later.
        for index in 0..<3 {
            let episodeId = "ep\(index)"
            let doseTime = ms(daysAgo: index + 1, hour: 12)
            readings.append(TestFixtures.makeReading(episodeId: episodeId, intensity: 8, timestamp: doseTime - 5 * 60_000))
            readings.append(TestFixtures.makeReading(episodeId: episodeId, intensity: 4, timestamp: doseTime + 30 * 60_000))
            doses.append(TestFixtures.makeDose(id: "d\(index)", medicationId: "med-t", timestamp: doseTime, episodeId: episodeId))
        }

        let result = AnalyticsInsights.medicationEffectiveness(
            doses: doses, medications: [triptan], readings: readings, excluded: [], calendar: calendar
        )

        XCTAssertEqual(result.first?.reliefDoses, 3)
        XCTAssertEqual(result.first?.reliefMedianMinutes ?? 0, 30, accuracy: 0.0001)
    }

    func testMedicationEffectiveness_explicitTimeToReliefWinsOverDerived() {
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        // Episode readings would derive a 30-minute drop, but the explicit
        // 45-minute relief takes precedence.
        let doseTime = ms(daysAgo: 1, hour: 12)
        let readings = [
            TestFixtures.makeReading(episodeId: "ep", intensity: 8, timestamp: doseTime - 5 * 60_000),
            TestFixtures.makeReading(episodeId: "ep", intensity: 4, timestamp: doseTime + 30 * 60_000),
        ]
        let doses = (0..<3).map { index in
            TestFixtures.makeDose(
                id: "d\(index)", medicationId: "med-t", timestamp: ms(daysAgo: index + 1),
                episodeId: "ep", timeToRelief: 45
            )
        }

        let result = AnalyticsInsights.medicationEffectiveness(
            doses: doses, medications: [triptan], readings: readings, excluded: [], calendar: calendar
        )

        XCTAssertEqual(result.first?.reliefMedianMinutes ?? 0, 45, accuracy: 0.0001)
    }

    func testMedicationEffectiveness_ignoresSkippedExcludedAndPreventative() {
        let triptan = TestFixtures.makeMedication(id: "med-t", type: .rescue, category: .triptan)
        let preventative = TestFixtures.makeMedication(id: "med-p", type: .preventative, category: .cgrp)
        let doses = [
            // Counted.
            TestFixtures.makeDose(id: "d0", medicationId: "med-t", timestamp: ms(daysAgo: 1), timeToRelief: 30),
            // Skipped — ignored.
            TestFixtures.makeDose(id: "d1", medicationId: "med-t", timestamp: ms(daysAgo: 2), status: .skipped, timeToRelief: 30),
            // Excluded day — ignored.
            TestFixtures.makeDose(id: "d2", medicationId: "med-t", timestamp: ms(daysAgo: 3), timeToRelief: 30),
            // Preventative medication — not a rescue, ignored.
            TestFixtures.makeDose(id: "d3", medicationId: "med-p", timestamp: ms(daysAgo: 1), timeToRelief: 30),
        ]

        let result = AnalyticsInsights.medicationEffectiveness(
            doses: doses,
            medications: [triptan, preventative],
            readings: [],
            excluded: [dayString(daysAgo: 3)],
            calendar: calendar
        )

        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.medicationId, "med-t")
        XCTAssertEqual(result.first?.takenDoses, 1)
        XCTAssertEqual(result.first?.reliefDoses, 1)
    }

    // MARK: - monthlyHeadacheDays

    func testMonthlyHeadacheDays_bucketsDaysByMonthAndClipsRange() {
        // Anchor to a fixed mid-month reference date rather than the real "now":
        // the "two days this month" premise fails on the first of a month, where
        // daysAgo:0 and daysAgo:1 straddle a month boundary and land in separate
        // buckets. A fixed anchor keeps this deterministic on every run date.
        let anchor = calendar.date(from: DateComponents(year: 2026, month: 3, day: 15, hour: 12))!
        func day(_ offset: Int) -> String {
            TimestampHelper.dateString(from: calendar.date(byAdding: .day, value: offset, to: anchor)!)
        }
        // Two days in the anchor month plus one day 40 days earlier (prior month).
        let days: Set<String> = [day(0), day(-1), day(-40)]
        let from = calendar.date(byAdding: .day, value: -60, to: anchor)!
        let result = AnalyticsInsights.monthlyHeadacheDays(headacheDays: days, from: from, to: anchor, calendar: calendar)

        XCTAssertEqual(result.map(\.headacheDayCount).reduce(0, +), 3)
        // The anchor month's bucket holds the two recent days.
        let currentMonthKey = String(day(0).prefix(7))
        let currentBucket = result.first { String(TimestampHelper.dateString(from: $0.monthStart).prefix(7)) == currentMonthKey }
        XCTAssertEqual(currentBucket?.headacheDayCount, 2)
    }

    func testMonthlyHeadacheDays_daysOutsideRangeAreExcluded() {
        // A day before the range start must not be counted even if its month is shown.
        let days: Set<String> = [dayString(daysAgo: 0), dayString(daysAgo: 90)]
        let result = AnalyticsInsights.monthlyHeadacheDays(
            headacheDays: days, from: date(daysAgo: 10), to: now, calendar: calendar
        )

        XCTAssertEqual(result.map(\.headacheDayCount).reduce(0, +), 1)
    }

    // MARK: - medicationUsage

    func testMedicationUsage_aggregatesDosesDaysAndAmount() {
        let med = TestFixtures.makeMedication(id: "med-r", type: .rescue, dosageAmount: 400, dosageUnit: "mg", category: .nsaid)
        // 3 doses across 2 days; one day has two doses.
        let doses = [
            TestFixtures.makeDose(medicationId: "med-r", timestamp: ms(daysAgo: 1, hour: 8), quantity: 1),
            TestFixtures.makeDose(medicationId: "med-r", timestamp: ms(daysAgo: 1, hour: 20), quantity: 2),
            TestFixtures.makeDose(medicationId: "med-r", timestamp: ms(daysAgo: 2), quantity: 1),
        ]

        let result = AnalyticsInsights.medicationUsage(
            doses: doses, medications: [med], excluded: [], from: date(daysAgo: 5), to: now, calendar: calendar
        )

        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.doseCount, 3)
        XCTAssertEqual(result.first?.dayCount, 2)
        // makeDose stamps dosageAmount 400; total = (1 + 2 + 1) × 400.
        XCTAssertEqual(result.first?.totalAmount, 1600)
        // Average is per-dose: 1600 / 3 doses.
        XCTAssertEqual(try XCTUnwrap(result.first).averageAmount, 1600.0 / 3.0, accuracy: 0.001)
        XCTAssertEqual(result.first?.dosageUnit, "mg")
    }

    func testMedicationUsage_skipsExcludedDaysSkippedDosesAndPreventatives() {
        let rescue = TestFixtures.makeMedication(id: "med-r", type: .rescue, category: .triptan)
        let preventative = TestFixtures.makeMedication(id: "med-p", type: .preventative, category: .supplement)
        let doses = [
            TestFixtures.makeDose(medicationId: "med-r", timestamp: ms(daysAgo: 1)),
            TestFixtures.makeDose(medicationId: "med-r", timestamp: ms(daysAgo: 2), status: .skipped),
            TestFixtures.makeDose(medicationId: "med-r", timestamp: ms(daysAgo: 3)), // excluded day
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 1)), // preventative
        ]

        let result = AnalyticsInsights.medicationUsage(
            doses: doses, medications: [rescue, preventative],
            excluded: [dayString(daysAgo: 3)], from: date(daysAgo: 5), to: now, calendar: calendar
        )

        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.medicationId, "med-r")
        XCTAssertEqual(result.first?.doseCount, 1)
    }

    func testMedicationUsage_sortsByDoseCountDescending() {
        let light = TestFixtures.makeMedication(id: "med-a", name: "Aspirin", type: .rescue, category: .otc)
        let heavy = TestFixtures.makeMedication(id: "med-z", name: "Zomig", type: .rescue, category: .triptan)
        let doses = [
            TestFixtures.makeDose(medicationId: "med-a", timestamp: ms(daysAgo: 1)),
            TestFixtures.makeDose(medicationId: "med-z", timestamp: ms(daysAgo: 1)),
            TestFixtures.makeDose(medicationId: "med-z", timestamp: ms(daysAgo: 2)),
        ]

        let result = AnalyticsInsights.medicationUsage(
            doses: doses, medications: [light, heavy], excluded: [], from: date(daysAgo: 5), to: now, calendar: calendar
        )

        XCTAssertEqual(result.map(\.medicationId), ["med-z", "med-a"])
    }

    // MARK: - preventativeCompliance

    func testPreventativeCompliance_aggregatesAcrossRange() {
        let med = TestFixtures.makeMedication(id: "med-p", type: .preventative, category: .supplement)
        let schedules = [TestFixtures.makeSchedule(medicationId: "med-p")]
        // Taken on 2 distinct days; a third day double-logs and must cap at 1.
        let doses = [
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 1)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 2)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 3, hour: 8)),
            TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 3, hour: 20)),
        ]

        let result = AnalyticsInsights.preventativeCompliance(
            doses: doses, medications: [med], schedulesByMedication: ["med-p": schedules],
            excluded: [], from: date(daysAgo: 6), to: now, calendar: calendar
        )

        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.expectedDoses, 7)
        XCTAssertEqual(result.first?.takenDoses, 3)
        XCTAssertEqual(result.first?.dosesPerDay, 1)
    }

    func testPreventativeCompliance_twiceDailyAndMissedMedStillListed() {
        let med = TestFixtures.makeMedication(id: "med-p", type: .preventative)
        let schedules = [
            TestFixtures.makeSchedule(id: "s1", medicationId: "med-p", time: "08:00"),
            TestFixtures.makeSchedule(id: "s2", medicationId: "med-p", time: "20:00"),
        ]

        let result = AnalyticsInsights.preventativeCompliance(
            doses: [], medications: [med], schedulesByMedication: ["med-p": schedules],
            excluded: [], from: date(daysAgo: 2), to: now, calendar: calendar
        )

        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.dosesPerDay, 2)
        XCTAssertEqual(result.first?.expectedDoses, 6) // 2/day × 3 days
        XCTAssertEqual(result.first?.takenDoses, 0)
        XCTAssertEqual(result.first?.percent, 0)
    }

    func testPreventativeCompliance_excludedDaysDropFromBothSides() {
        let med = TestFixtures.makeMedication(id: "med-p", type: .preventative)
        let schedules = [TestFixtures.makeSchedule(medicationId: "med-p")]
        let doses = [TestFixtures.makeDose(medicationId: "med-p", timestamp: ms(daysAgo: 1))]

        let result = AnalyticsInsights.preventativeCompliance(
            doses: doses, medications: [med], schedulesByMedication: ["med-p": schedules],
            excluded: [dayString(daysAgo: 1)], from: date(daysAgo: 2), to: now, calendar: calendar
        )

        // Day 1 excluded: expected over days 0 and 2 only, nothing taken counts.
        XCTAssertEqual(result.first?.expectedDoses, 2)
        XCTAssertEqual(result.first?.takenDoses, 0)
    }
}
