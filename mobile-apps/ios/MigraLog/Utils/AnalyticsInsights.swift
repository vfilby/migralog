import Foundation

/// Pure aggregation engine for the in-app insight charts (issue #435).
///
/// All functions are deterministic: they take repository rows plus an explicit
/// `now`/`calendar` and return chart-ready series, so they are directly unit
/// testable. Clinical reference points follow ICHD-3: chronic migraine is
/// ≥15 headache days/month, and medication-overuse risk is tracked as
/// distinct *days with intake* per 28-day window (≥10 days for triptans/CGRP
/// acute meds, ≥15 for simple analgesics) — never as raw dose counts.
/// Everything surfaced from here is informational only, not medical advice.
enum AnalyticsInsights {
    /// Trailing window used for day-count trends. A fixed 28-day window keeps
    /// the series comparable day-to-day, unlike calendar months (28–31 days).
    static let rollingWindowDays = 28

    /// ICHD-3 chronic-migraine range: ≥15 headache days per month.
    static let chronicRangeThreshold = 15

    /// Pre-warning level when headache days approach the chronic range.
    static let elevatedRangeThreshold = 10

    // MARK: - Series types

    struct DailyCount: Equatable, Identifiable {
        let date: Date
        let count: Int
        var id: Date { date }
    }

    /// Acute medication classes, mapped from `MedicationCategory`.
    enum AcuteMedClass: String, CaseIterable, Identifiable {
        case triptan
        case simpleAnalgesic
        case cgrpAcute

        var id: String { rawValue }

        var displayName: String {
            switch self {
            case .triptan: return "Triptan"
            case .simpleAnalgesic: return "OTC / NSAID"
            case .cgrpAcute: return "CGRP"
            }
        }

        /// ICHD-3 overuse threshold in intake days per 28-day window.
        /// Nil for classes with no established overuse guideline (CGRP
        /// acute medications / gepants are not listed in ICHD-3 8.2).
        var overuseThresholdDays: Int? {
            switch self {
            case .triptan: return 10
            case .simpleAnalgesic: return 15
            case .cgrpAcute: return nil
            }
        }

        init?(category: MedicationCategory?) {
            switch category {
            case .triptan: self = .triptan
            case .otc, .nsaid: self = .simpleAnalgesic
            case .cgrp: self = .cgrpAcute
            default: return nil
            }
        }
    }

    struct ClassIntakeSeries: Equatable, Identifiable {
        let medClass: AcuteMedClass
        let points: [DailyCount]
        /// Names of the medications counted into this class, for display —
        /// the class membership is user-configurable per medication.
        let medicationNames: [String]
        var id: String { medClass.rawValue }
    }

    /// Medication names per acute class: rescue medications that are active
    /// or contributed a taken dose in the analyzed window, sorted by name.
    static func classMedicationNames(
        medications: [Medication],
        doses: [MedicationDose]
    ) -> [AcuteMedClass: [String]] {
        let dosedMedIds = Set(doses.filter { $0.status == .taken }.map(\.medicationId))
        var names: [AcuteMedClass: [String]] = [:]
        for med in medications where med.type == .rescue {
            guard let medClass = AcuteMedClass(category: med.category) else { continue }
            if med.active || dosedMedIds.contains(med.id) {
                names[medClass, default: []].append(med.name)
            }
        }
        return names.mapValues { $0.sorted() }
    }

    enum SeverityBin: String, CaseIterable, Identifiable {
        case mild
        case moderate
        case severe
        case verySevere

        var id: String { rawValue }

        var displayName: String {
            switch self {
            case .mild: return "Mild"
            case .moderate: return "Moderate"
            case .severe: return "Severe"
            case .verySevere: return "Very severe"
            }
        }

        /// Bins match the offline report generator: 0–3 mild, 3–5 moderate,
        /// 5–7 severe, 7–10 very severe (peak intensity, upper-exclusive).
        static func bin(forPeak peak: Double) -> SeverityBin {
            switch peak {
            case ..<3: return .mild
            case ..<5: return .moderate
            case ..<7: return .severe
            default: return .verySevere
            }
        }
    }

    struct SeverityWeekCount: Equatable, Identifiable {
        let weekStart: Date
        let bin: SeverityBin
        let count: Int
        var id: String { "\(weekStart.timeIntervalSince1970)-\(bin.rawValue)" }
    }

    struct TimeOfDayBin: Equatable, Identifiable {
        /// Bucket start hour: 0, 3, 6, ... 21.
        let hour: Int
        let count: Int
        var id: Int { hour }

        var label: String {
            switch hour {
            case 0: return "12a"
            case 12: return "12p"
            case ..<12: return "\(hour)a"
            default: return "\(hour - 12)p"
            }
        }
    }

    enum WarningSeverity: Equatable {
        case alert
        case caution
        case info
    }

    struct Warning: Equatable, Identifiable {
        let id: String
        let severity: WarningSeverity
        let title: String
        let detail: String
    }

    // MARK: - Day sets

    /// Date strings (yyyy-MM-dd) covered by overlays flagged `excludeFromStats`.
    /// Open-ended overlays run through `now`.
    static func excludedDates(
        overlays: [CalendarOverlay],
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> Set<String> {
        var excluded: Set<String> = []
        let todayString = TimestampHelper.dateString(from: now)
        for overlay in overlays where overlay.excludeFromStats {
            let endString = min(overlay.endDate ?? todayString, todayString)
            guard var day = TimestampHelper.dateFromString(overlay.startDate),
                  overlay.startDate <= endString else { continue }
            var dayString = overlay.startDate
            while dayString <= endString {
                excluded.insert(dayString)
                guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
                day = next
                dayString = TimestampHelper.dateString(from: day)
            }
        }
        return excluded
    }

    /// Days with any episode overlap or a red daily status, minus excluded days.
    /// This is the headache-day definition used for MHD-style trend counts.
    static func headacheDays(
        episodes: [Episode],
        statuses: [DailyStatusLog],
        excluded: Set<String>,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> Set<String> {
        var days: Set<String> = []
        for status in statuses where status.status == .red {
            days.insert(status.date)
        }
        for episode in episodes {
            let start = TimestampHelper.toDate(episode.startTime)
            let end = episode.endTime.map { TimestampHelper.toDate($0) } ?? now
            var day = calendar.startOfDay(for: start)
            while day < end {
                days.insert(TimestampHelper.dateString(from: day))
                guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
                day = next
            }
        }
        return days.subtracting(excluded)
    }

    /// Distinct days with at least one taken dose, per acute medication class,
    /// minus excluded days. Multiple doses on one day count as a single intake
    /// day — the unit the ICHD-3 overuse thresholds are defined in.
    static func intakeDays(
        doses: [MedicationDose],
        medications: [Medication],
        excluded: Set<String>,
        calendar: Calendar = .current
    ) -> [AcuteMedClass: Set<String>] {
        var classByMedId: [String: AcuteMedClass] = [:]
        for med in medications where med.type == .rescue {
            if let medClass = AcuteMedClass(category: med.category) {
                classByMedId[med.id] = medClass
            }
        }

        var result: [AcuteMedClass: Set<String>] = [:]
        for dose in doses where dose.status == .taken {
            guard let medClass = classByMedId[dose.medicationId] else { continue }
            let dayString = TimestampHelper.dateString(from: TimestampHelper.toDate(dose.timestamp))
            guard !excluded.contains(dayString) else { continue }
            result[medClass, default: []].insert(dayString)
        }
        return result
    }

    // MARK: - Rolling series

    /// Trailing `window`-day count of flagged days, evaluated for each day in
    /// `from...to` (inclusive, by calendar day).
    static func rollingCounts(
        of dayFlags: Set<String>,
        from: Date,
        to: Date,
        window: Int = rollingWindowDays,
        calendar: Calendar = .current
    ) -> [DailyCount] {
        var points: [DailyCount] = []
        var day = calendar.startOfDay(for: from)
        let lastDay = calendar.startOfDay(for: to)
        while day <= lastDay {
            points.append(DailyCount(date: day, count: countInWindow(dayFlags, ending: day, window: window, calendar: calendar)))
            guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
            day = next
        }
        return points
    }

    /// Number of flagged days in the `window` days ending on `ending` (inclusive).
    static func countInWindow(
        _ dayFlags: Set<String>,
        ending: Date,
        window: Int = rollingWindowDays,
        calendar: Calendar = .current
    ) -> Int {
        var count = 0
        var day = calendar.startOfDay(for: ending)
        for _ in 0..<window {
            if dayFlags.contains(TimestampHelper.dateString(from: day)) {
                count += 1
            }
            guard let previous = calendar.date(byAdding: .day, value: -1, to: day) else { break }
            day = previous
        }
        return count
    }

    // MARK: - Distributions

    /// Episodes per week, stacked by peak-intensity severity bin. Episodes
    /// without intensity readings or starting on an excluded day are skipped.
    static func severityWeekCounts(
        episodes: [Episode],
        readings: [IntensityReading],
        excluded: Set<String>,
        calendar: Calendar = .current
    ) -> [SeverityWeekCount] {
        var peakByEpisode: [String: Double] = [:]
        for reading in readings {
            peakByEpisode[reading.episodeId] = max(peakByEpisode[reading.episodeId] ?? 0, reading.intensity)
        }

        var counts: [Date: [SeverityBin: Int]] = [:]
        for episode in episodes {
            guard let peak = peakByEpisode[episode.id] else { continue }
            let start = TimestampHelper.toDate(episode.startTime)
            guard !excluded.contains(TimestampHelper.dateString(from: start)) else { continue }
            guard let weekStart = calendar.dateInterval(of: .weekOfYear, for: start)?.start else { continue }
            counts[weekStart, default: [:]][SeverityBin.bin(forPeak: peak), default: 0] += 1
        }

        return counts.keys.sorted().flatMap { weekStart in
            SeverityBin.allCases.compactMap { bin in
                guard let count = counts[weekStart]?[bin], count > 0 else { return nil }
                return SeverityWeekCount(weekStart: weekStart, bin: bin, count: count)
            }
        }
    }

    /// Episode start times bucketed into 3-hour bins. All 8 bins are always
    /// returned (zero-filled) so the histogram has a stable x-axis.
    static func timeOfDayBins(
        episodes: [Episode],
        excluded: Set<String>,
        calendar: Calendar = .current
    ) -> [TimeOfDayBin] {
        var counts = [Int: Int]()
        for episode in episodes {
            let start = TimestampHelper.toDate(episode.startTime)
            guard !excluded.contains(TimestampHelper.dateString(from: start)) else { continue }
            let bucket = (calendar.component(.hour, from: start) / 3) * 3
            counts[bucket, default: 0] += 1
        }
        return stride(from: 0, to: 24, by: 3).map { TimeOfDayBin(hour: $0, count: counts[$0] ?? 0) }
    }

    // MARK: - Symptom & pain-location frequency

    struct SymptomFrequency: Equatable, Identifiable {
        let symptom: Symptom
        /// Episodes (in range) that recorded this symptom.
        let episodeCount: Int
        /// `episodeCount` as a percentage of the episodes counted (0–100).
        let percentOfEpisodes: Double
        var id: String { symptom.rawValue }
    }

    struct PainLocationFrequency: Equatable, Identifiable {
        let location: PainLocation
        /// Episodes (in range) that recorded this location.
        let episodeCount: Int
        /// `episodeCount` as a percentage of the episodes counted (0–100).
        let percentOfEpisodes: Double
        var id: String { location.rawValue }
    }

    /// Symptoms ranked by how many episodes recorded them, most frequent
    /// first. A symptom counts for an episode if it was present at any point:
    /// the episode's own `symptoms` set unioned with every `SymptomLog` added
    /// mid-episode. Episodes starting on an excluded day are skipped, and the
    /// percentage denominator is the episodes that remain.
    static func symptomFrequencies(
        episodes: [Episode],
        symptomLogs: [SymptomLog] = [],
        excluded: Set<String>,
        calendar: Calendar = .current
    ) -> [SymptomFrequency] {
        var byEpisode: [String: [Symptom]] = [:]
        for log in symptomLogs { byEpisode[log.episodeId, default: []].append(log.symptom) }
        return frequencies(in: episodes, excluded: excluded, episodeValues: \.symptoms, loggedValues: byEpisode)
            .map { SymptomFrequency(symptom: $0.value, episodeCount: $0.count, percentOfEpisodes: $0.percent) }
    }

    /// Pain locations ranked by how many episodes recorded them, most frequent
    /// first. A location counts for an episode if it was present at any point:
    /// the episode's own `locations` set unioned with every `PainLocationLog`
    /// snapshot recorded mid-episode. Because each location is counted once per
    /// episode, a location that was added, removed, and re-added still counts
    /// exactly once. Same exclusion/percentage rules as `symptomFrequencies`.
    static func painLocationFrequencies(
        episodes: [Episode],
        locationLogs: [PainLocationLog] = [],
        excluded: Set<String>,
        calendar: Calendar = .current
    ) -> [PainLocationFrequency] {
        var byEpisode: [String: [PainLocation]] = [:]
        for log in locationLogs { byEpisode[log.episodeId, default: []].append(contentsOf: log.painLocations) }
        return frequencies(in: episodes, excluded: excluded, episodeValues: \.locations, loggedValues: byEpisode)
            .map { PainLocationFrequency(location: $0.value, episodeCount: $0.count, percentOfEpisodes: $0.percent) }
    }

    /// Distinct-episode counts for a per-episode value set (symptoms,
    /// locations, …). For each episode the values from the episode record are
    /// unioned with any values logged mid-episode (`loggedValues`, keyed by
    /// episode id) and counted once, so neither a duplicate nor an
    /// add/remove/re-add can inflate the count. Sorted by count descending,
    /// then raw value ascending for a stable order.
    private static func frequencies<Value>(
        in episodes: [Episode],
        excluded: Set<String>,
        episodeValues: (Episode) -> [Value],
        loggedValues: [String: [Value]]
    ) -> [(value: Value, count: Int, percent: Double)]
    where Value: Hashable & RawRepresentable, Value.RawValue == String {
        var counts: [Value: Int] = [:]
        var total = 0
        for episode in episodes {
            let startDay = TimestampHelper.dateString(from: TimestampHelper.toDate(episode.startTime))
            guard !excluded.contains(startDay) else { continue }
            total += 1
            var present = Set(episodeValues(episode))
            if let logged = loggedValues[episode.id] { present.formUnion(logged) }
            for value in present { counts[value, default: 0] += 1 }
        }
        guard total > 0 else { return [] }
        return counts
            .map { (value: $0.key, count: $0.value, percent: Double($0.value) / Double(total) * 100) }
            .sorted { $0.count != $1.count ? $0.count > $1.count : $0.value.rawValue < $1.value.rawValue }
    }

    // MARK: - Monthly summary

    struct DoseStat: Equatable {
        var doses: Int = 0
        var days: Int = 0
    }

    /// Per-calendar-month provider summary. `isPartial` is set when the month
    /// is not fully covered by the requested range (including the current,
    /// still-running month).
    struct MonthSummary: Equatable, Identifiable {
        let monthStart: Date
        let isPartial: Bool
        let episodeCount: Int
        let episodeDays: Int
        let totalDoses: Int
        let totalIntakeDays: Int
        let classStats: [AcuteMedClass: DoseStat]
        let medStats: [String: DoseStat] // keyed by medication id
        var id: Date { monthStart }
    }

    /// One summary per calendar month intersecting `from...to`. Dose totals
    /// cover taken rescue doses; intake days are distinct days with ≥1 dose.
    /// Days inside excluded overlays are dropped from every count.
    static func monthlySummaries(
        episodes: [Episode],
        doses: [MedicationDose],
        medications: [Medication],
        excluded: Set<String>,
        from: Date,
        to: Date,
        calendar: Calendar = .current
    ) -> [MonthSummary] {
        guard from <= to,
              let firstMonth = calendar.dateInterval(of: .month, for: from)?.start else { return [] }

        var classByMedId: [String: AcuteMedClass] = [:]
        var rescueIds: Set<String> = []
        for med in medications where med.type == .rescue {
            rescueIds.insert(med.id)
            if let medClass = AcuteMedClass(category: med.category) {
                classByMedId[med.id] = medClass
            }
        }

        // Distinct days overlapped by any episode (minus excluded), clipped
        // to the requested range so partial months only count covered days.
        let fromString = TimestampHelper.dateString(from: from)
        let toString = TimestampHelper.dateString(from: to)
        let episodeDaySet = headacheDays(episodes: episodes, statuses: [], excluded: excluded, now: to, calendar: calendar)
            .filter { $0 >= fromString && $0 <= toString }

        let rangeStartDay = calendar.startOfDay(for: from)
        let rangeEndExclusive = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: to)) ?? to

        var summaries: [MonthSummary] = []
        var monthStart = firstMonth
        while monthStart < rangeEndExclusive {
            guard let monthEnd = calendar.date(byAdding: .month, value: 1, to: monthStart) else { break }
            let monthKey = monthPrefix(of: monthStart, calendar: calendar)
            // A month is partial when the range doesn't fully cover it. Compare
            // the trailing edge against `to` (not the day-rounded
            // `rangeEndExclusive`): on the last calendar day of a month the
            // rounded bound equals `monthEnd`, which would otherwise mark the
            // still-running current month as complete.
            let isPartial = monthStart < rangeStartDay || monthEnd > to

            let monthStartMs = TimestampHelper.fromDate(max(monthStart, rangeStartDay))
            let monthEndMs = TimestampHelper.fromDate(min(monthEnd, rangeEndExclusive))

            var episodeCount = 0
            for episode in episodes where episode.startTime >= monthStartMs && episode.startTime < monthEndMs {
                let startDay = TimestampHelper.dateString(from: TimestampHelper.toDate(episode.startTime))
                if !excluded.contains(startDay) { episodeCount += 1 }
            }

            let episodeDays = episodeDaySet.filter { $0.hasPrefix(monthKey) }.count

            var classStats: [AcuteMedClass: DoseStat] = [:]
            var medStats: [String: DoseStat] = [:]
            var classDays: [AcuteMedClass: Set<String>] = [:]
            var medDays: [String: Set<String>] = [:]
            var allDays: Set<String> = []
            var totalDoses = 0
            for dose in doses where dose.status == .taken && rescueIds.contains(dose.medicationId) {
                guard dose.timestamp >= monthStartMs, dose.timestamp < monthEndMs else { continue }
                let dayString = TimestampHelper.dateString(from: TimestampHelper.toDate(dose.timestamp))
                guard !excluded.contains(dayString) else { continue }
                totalDoses += 1
                allDays.insert(dayString)
                medStats[dose.medicationId, default: DoseStat()].doses += 1
                medDays[dose.medicationId, default: []].insert(dayString)
                if let medClass = classByMedId[dose.medicationId] {
                    classStats[medClass, default: DoseStat()].doses += 1
                    classDays[medClass, default: []].insert(dayString)
                }
            }
            for (medClass, days) in classDays { classStats[medClass]?.days = days.count }
            for (medId, days) in medDays { medStats[medId]?.days = days.count }

            summaries.append(MonthSummary(
                monthStart: monthStart,
                isPartial: isPartial,
                episodeCount: episodeCount,
                episodeDays: episodeDays,
                totalDoses: totalDoses,
                totalIntakeDays: allDays.count,
                classStats: classStats,
                medStats: medStats
            ))
            monthStart = monthEnd
        }
        return summaries
    }

    /// "yyyy-MM" prefix used to bucket day strings into a month.
    private static func monthPrefix(of monthStart: Date, calendar: Calendar) -> String {
        String(TimestampHelper.dateString(from: monthStart).prefix(7))
    }

    /// Range total across monthly summaries. Months are disjoint, so day
    /// counts sum without double-counting. `monthStart` carries the first
    /// month's date and `isPartial` is true when any month is partial.
    static func totalSummary(of summaries: [MonthSummary]) -> MonthSummary? {
        guard let first = summaries.first else { return nil }
        var classStats: [AcuteMedClass: DoseStat] = [:]
        var medStats: [String: DoseStat] = [:]
        for summary in summaries {
            for (medClass, stat) in summary.classStats {
                classStats[medClass, default: DoseStat()].doses += stat.doses
                classStats[medClass, default: DoseStat()].days += stat.days
            }
            for (medId, stat) in summary.medStats {
                medStats[medId, default: DoseStat()].doses += stat.doses
                medStats[medId, default: DoseStat()].days += stat.days
            }
        }
        return MonthSummary(
            monthStart: first.monthStart,
            isPartial: summaries.contains(where: \.isPartial),
            episodeCount: summaries.map(\.episodeCount).reduce(0, +),
            episodeDays: summaries.map(\.episodeDays).reduce(0, +),
            totalDoses: summaries.map(\.totalDoses).reduce(0, +),
            totalIntakeDays: summaries.map(\.totalIntakeDays).reduce(0, +),
            classStats: classStats,
            medStats: medStats
        )
    }

    // MARK: - Preventative adherence

    struct WeeklyAdherence: Equatable, Identifiable {
        let weekStart: Date
        let expected: Int
        let taken: Int
        var id: Date { weekStart }

        var percent: Double {
            expected > 0 ? Double(taken) / Double(expected) * 100 : 0
        }
    }

    /// Scheduled preventative doses logged as taken, grouped by week.
    ///
    /// Expected doses per day = enabled schedules of active preventative
    /// medications (today's schedule configuration — schedule history is not
    /// recorded). A medication only contributes expected doses from the day
    /// it was added, so a med added mid-range doesn't retroactively drag
    /// down earlier weeks. Taken doses are capped at the expected count per
    /// medication per day so extra logs can't inflate adherence.
    /// Excluded-overlay days are dropped from both sides.
    static func weeklyAdherence(
        doses: [MedicationDose],
        medications: [Medication],
        schedulesByMedication: [String: [MedicationSchedule]],
        excluded: Set<String>,
        from: Date,
        to: Date,
        calendar: Calendar = .current
    ) -> [WeeklyAdherence] {
        var expectedPerDay: [String: Int] = [:]
        var medStartDay: [String: Date] = [:]
        for med in medications where med.type == .preventative && med.active {
            let enabled = (schedulesByMedication[med.id] ?? []).filter(\.enabled).count
            if enabled > 0 {
                expectedPerDay[med.id] = enabled
                medStartDay[med.id] = calendar.startOfDay(for: TimestampHelper.toDate(med.createdAt))
            }
        }
        guard !expectedPerDay.isEmpty else { return [] }

        // Taken doses bucketed by medication and day.
        var takenByMedDay: [String: Int] = [:]
        for dose in doses where dose.status == .taken && expectedPerDay[dose.medicationId] != nil {
            let dayString = TimestampHelper.dateString(from: TimestampHelper.toDate(dose.timestamp))
            takenByMedDay["\(dose.medicationId)|\(dayString)", default: 0] += 1
        }

        var weekly: [Date: (expected: Int, taken: Int)] = [:]
        var day = calendar.startOfDay(for: from)
        let lastDay = calendar.startOfDay(for: to)
        while day <= lastDay {
            let dayString = TimestampHelper.dateString(from: day)
            if !excluded.contains(dayString),
               let weekStart = calendar.dateInterval(of: .weekOfYear, for: day)?.start {
                for (medId, expected) in expectedPerDay {
                    guard let startDay = medStartDay[medId], day >= startDay else { continue }
                    let taken = min(takenByMedDay["\(medId)|\(dayString)"] ?? 0, expected)
                    weekly[weekStart, default: (0, 0)].expected += expected
                    weekly[weekStart, default: (0, 0)].taken += taken
                }
            }
            guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
            day = next
        }

        return weekly.keys.sorted().compactMap { weekStart in
            guard let counts = weekly[weekStart], counts.expected > 0 else { return nil }
            return WeeklyAdherence(weekStart: weekStart, expected: counts.expected, taken: counts.taken)
        }
    }

    // MARK: - Warning signs

    /// Rule-based callouts computed over the trailing 28-day window vs. the
    /// 28 days before it. Phrased as conversation prompts, not diagnoses.
    static func warnings(
        headacheDays: Set<String>,
        intakeDays: [AcuteMedClass: Set<String>],
        episodes: [Episode],
        readings: [IntensityReading],
        excluded: Set<String>,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> [Warning] {
        var warnings: [Warning] = []
        let today = calendar.startOfDay(for: now)
        guard let prevWindowEnd = calendar.date(byAdding: .day, value: -rollingWindowDays, to: today) else { return [] }

        // 1. Headache-day burden vs. the chronic-migraine range.
        let currentHeadacheDays = countInWindow(headacheDays, ending: today, calendar: calendar)
        if currentHeadacheDays >= chronicRangeThreshold {
            warnings.append(Warning(
                id: "chronic-range",
                severity: .alert,
                title: "Headache days in the chronic range",
                detail: "\(currentHeadacheDays) headache days in the last 28 — at or above the ≥15-day chronic-migraine range. Worth discussing with your clinician."
            ))
        } else if currentHeadacheDays >= elevatedRangeThreshold {
            warnings.append(Warning(
                id: "elevated-range",
                severity: .caution,
                title: "Headache days are elevated",
                detail: "\(currentHeadacheDays) headache days in the last 28 — approaching the ≥15-day chronic-migraine range."
            ))
        }

        // 2. Medication-overuse risk, per acute class (counted in intake days).
        // Classes without an established guideline (CGRP acute) are skipped.
        for medClass in AcuteMedClass.allCases {
            guard let threshold = medClass.overuseThresholdDays else { continue }
            let days = countInWindow(intakeDays[medClass] ?? [], ending: today, calendar: calendar)
            if days >= threshold {
                warnings.append(Warning(
                    id: "moh-\(medClass.rawValue)",
                    severity: .alert,
                    title: "\(medClass.displayName) use above overuse guideline",
                    detail: "\(days) days with \(medClass.displayName) doses in the last 28 (guideline: under \(threshold)). "
                        + "Frequent acute medication use can itself worsen headaches — discuss with your clinician."
                ))
            } else if days >= threshold - 2, days > 0 {
                warnings.append(Warning(
                    id: "moh-near-\(medClass.rawValue)",
                    severity: .caution,
                    title: "\(medClass.displayName) use nearing overuse guideline",
                    detail: "\(days) days with \(medClass.displayName) doses in the last 28 (guideline: under \(threshold))."
                ))
            }
        }

        // 3. Rescue use rising vs. the previous 28-day window.
        let allIntake = intakeDays.values.reduce(into: Set<String>()) { $0.formUnion($1) }
        let currentIntake = countInWindow(allIntake, ending: today, calendar: calendar)
        let previousIntake = countInWindow(allIntake, ending: prevWindowEnd, calendar: calendar)
        if currentIntake - previousIntake >= 3, currentIntake >= Int(Double(previousIntake) * 1.5) {
            warnings.append(Warning(
                id: "rescue-rising",
                severity: .caution,
                title: "Rescue medication use is rising",
                detail: "\(currentIntake) rescue-medication days in the last 28, up from \(previousIntake) in the 28 days before."
            ))
        }

        // 4. Peak intensity trending up (needs ≥3 rated episodes per window).
        let (currentMean, currentCount) = meanPeakIntensity(
            episodes: episodes, readings: readings, excluded: excluded,
            daysAgo: 0..<rollingWindowDays, now: now, calendar: calendar
        )
        let (previousMean, previousCount) = meanPeakIntensity(
            episodes: episodes, readings: readings, excluded: excluded,
            daysAgo: rollingWindowDays..<(2 * rollingWindowDays), now: now, calendar: calendar
        )
        if currentCount >= 3, previousCount >= 3, let cur = currentMean, let prev = previousMean, cur - prev >= 1.0 {
            warnings.append(Warning(
                id: "intensity-rising",
                severity: .info,
                title: "Episodes are getting more intense",
                detail: String(format: "Average peak intensity is %.1f over the last 28 days, up from %.1f in the previous 28.", cur, prev)
            ))
        }

        return warnings
    }

    /// Mean peak intensity of rated episodes whose start day falls `daysAgo`
    /// days before `now` (half-open range, by calendar day).
    private static func meanPeakIntensity(
        episodes: [Episode],
        readings: [IntensityReading],
        excluded: Set<String>,
        daysAgo: Range<Int>,
        now: Date,
        calendar: Calendar
    ) -> (mean: Double?, count: Int) {
        var peakByEpisode: [String: Double] = [:]
        for reading in readings {
            peakByEpisode[reading.episodeId] = max(peakByEpisode[reading.episodeId] ?? 0, reading.intensity)
        }

        let today = calendar.startOfDay(for: now)
        var peaks: [Double] = []
        for episode in episodes {
            let startDay = calendar.startOfDay(for: TimestampHelper.toDate(episode.startTime))
            guard let ago = calendar.dateComponents([.day], from: startDay, to: today).day,
                  daysAgo.contains(ago) else { continue }
            guard !excluded.contains(TimestampHelper.dateString(from: startDay)) else { continue }
            guard let peak = peakByEpisode[episode.id] else { continue }
            peaks.append(peak)
        }
        guard !peaks.isEmpty else { return (nil, 0) }
        return (peaks.reduce(0, +) / Double(peaks.count), peaks.count)
    }

    // MARK: - Medication response (time to relief)

    /// Minimum number of doses with a measurable relief time before a
    /// medication's time-to-relief is summarized — keeps a comparison from
    /// resting on one or two data points.
    static let minimumReliefDoses = 3

    /// Cap on time-to-relief, mirroring the `time_to_relief` column's 24-hour
    /// ceiling. A relief signal that takes longer is treated as "no relief".
    static let reliefCapMinutes = 1440

    /// Per-rescue-medication response, for comparing how quickly each rescue
    /// medication brought relief over the range. `reliefMedianMinutes` is
    /// non-nil only once the medication clears the minimum-sample gate, so
    /// sparse data never produces a misleading comparison.
    struct MedicationEffectiveness: Identifiable, Equatable {
        let medicationId: String
        let medicationName: String
        let category: MedicationCategory?
        /// Taken doses of this medication counted in the range.
        let takenDoses: Int
        /// Doses that contributed a measurable relief time.
        let reliefDoses: Int
        /// Median minutes to relief, nil below the sample gate.
        let reliefMedianMinutes: Double?
        var id: String { medicationId }
    }

    /// Per-rescue-medication time-to-relief comparison.
    ///
    /// For each rescue medication, summarizes the time to relief over its taken
    /// doses in range (excluded-overlay days dropped). Time to relief is the
    /// dose's explicit `timeToRelief` when recorded, otherwise derived as the
    /// minutes from the dose to the first intensity reading in the same episode
    /// that falls below the dose-time baseline (the last reading at or before
    /// the dose). Derived relief is capped at `reliefCapMinutes`; a longer gap
    /// counts as no measured relief. This mirrors the neurologist report's
    /// time-to-pain-drop.
    ///
    /// The median is reported only once a medication has at least
    /// `minimumDoses` relief times. Medications with at least one taken dose are
    /// returned (sorted by name) so the view can still prompt for more data;
    /// medications with no taken doses in range are omitted.
    static func medicationEffectiveness(
        doses: [MedicationDose],
        medications: [Medication],
        readings: [IntensityReading],
        excluded: Set<String>,
        minimumDoses: Int = minimumReliefDoses,
        calendar: Calendar = .current
    ) -> [MedicationEffectiveness] {
        let rescueById = Dictionary(
            medications.filter { $0.type == .rescue }.map { ($0.id, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        guard !rescueById.isEmpty else { return [] }

        // Intensity readings per episode, ascending by time, for relief.
        var readingsByEpisode: [String: [IntensityReading]] = [:]
        for reading in readings {
            readingsByEpisode[reading.episodeId, default: []].append(reading)
        }
        for key in readingsByEpisode.keys {
            readingsByEpisode[key]?.sort { $0.timestamp < $1.timestamp }
        }

        var takenCount: [String: Int] = [:]
        var reliefs: [String: [Double]] = [:]

        for dose in doses where dose.status == .taken {
            guard rescueById[dose.medicationId] != nil else { continue }
            let day = TimestampHelper.dateString(from: TimestampHelper.toDate(dose.timestamp))
            guard !excluded.contains(day) else { continue }
            takenCount[dose.medicationId, default: 0] += 1

            if let relief = reliefMinutes(for: dose, readingsByEpisode: readingsByEpisode) {
                reliefs[dose.medicationId, default: []].append(Double(relief))
            }
        }

        return takenCount.keys.compactMap { medId -> MedicationEffectiveness? in
            guard let med = rescueById[medId], let taken = takenCount[medId], taken > 0 else { return nil }
            let reliefValues = reliefs[medId] ?? []
            let medianMinutes = reliefValues.count >= minimumDoses ? median(of: reliefValues.sorted()) : nil
            return MedicationEffectiveness(
                medicationId: medId,
                medicationName: med.name,
                category: med.category,
                takenDoses: taken,
                reliefDoses: reliefValues.count,
                reliefMedianMinutes: medianMinutes
            )
        }
        .sorted {
            $0.medicationName != $1.medicationName
                ? $0.medicationName < $1.medicationName
                : $0.medicationId < $1.medicationId
        }
    }

    /// Minutes from a dose to its first relief signal, or nil when none is
    /// measurable. An explicit `timeToRelief` wins; otherwise the first
    /// in-episode reading after the dose that falls below the dose-time
    /// baseline, capped at `reliefCapMinutes`.
    private static func reliefMinutes(
        for dose: MedicationDose,
        readingsByEpisode: [String: [IntensityReading]]
    ) -> Int? {
        if let explicit = dose.timeToRelief, explicit > 0 {
            return min(explicit, reliefCapMinutes)
        }
        guard let episodeId = dose.episodeId,
              let readings = readingsByEpisode[episodeId],
              let baseline = readings.last(where: { $0.timestamp <= dose.timestamp })?.intensity else {
            return nil
        }
        for reading in readings where reading.timestamp > dose.timestamp && reading.intensity < baseline {
            let minutes = Int((reading.timestamp - dose.timestamp) / 60_000)
            return minutes <= reliefCapMinutes ? max(minutes, 0) : nil
        }
        return nil
    }

    /// Median of an ascending, non-empty array.
    private static func median(of sorted: [Double]) -> Double {
        let count = sorted.count
        if count % 2 == 1 { return sorted[count / 2] }
        return (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    }
}
