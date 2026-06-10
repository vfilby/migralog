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

    /// MOH-relevant acute medication classes, mapped from `MedicationCategory`.
    enum AcuteMedClass: String, CaseIterable, Identifiable {
        case triptanLike
        case simpleAnalgesic

        var id: String { rawValue }

        var displayName: String {
            switch self {
            case .triptanLike: return "Triptan / CGRP"
            case .simpleAnalgesic: return "OTC / NSAID"
            }
        }

        /// ICHD-3 overuse threshold in intake days per 28-day window.
        var overuseThresholdDays: Int {
            switch self {
            case .triptanLike: return 10
            case .simpleAnalgesic: return 15
            }
        }

        init?(category: MedicationCategory?) {
            switch category {
            case .triptan, .cgrp: self = .triptanLike
            case .otc, .nsaid: self = .simpleAnalgesic
            default: return nil
            }
        }
    }

    struct ClassIntakeSeries: Equatable, Identifiable {
        let medClass: AcuteMedClass
        let points: [DailyCount]
        var id: String { medClass.rawValue }
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
        for medClass in AcuteMedClass.allCases {
            let days = countInWindow(intakeDays[medClass] ?? [], ending: today, calendar: calendar)
            let threshold = medClass.overuseThresholdDays
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
}
