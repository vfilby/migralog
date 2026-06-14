import Foundation
import Observation

/// Day-level statistics for analytics display.
struct DayStatistic: Equatable {
    let date: String // YYYY-MM-DD
    let status: DayStatus?
    let episodeCount: Int
    let averageIntensity: Double?
}

@Observable
final class AnalyticsViewModel {
    // MARK: - State

    var selectedRange: TimeRangeDays = .thirtyDays
    /// Custom whole-day range. When set it takes precedence over
    /// `selectedRange`, and all stats and insights anchor to its end date.
    var customRange: ClosedRange<Date>?
    var episodes: [Episode] = []
    var intensityReadings: [IntensityReading] = []
    var dayStats: [DayStatistic] = []
    var dailyStatuses: [DailyStatusLog] = []
    var calendarStatuses: [String: DayStatus] = [:]
    var calendarOverlayDates: Set<String> = []
    var calendarOverlays: [CalendarOverlay] = []
    var showDailyStatusPrompt = false
    var selectedCalendarDate: Date?
    var rescueDoses: [MedicationDose] = []
    var isLoading = false
    var error: String?

    // MARK: - Insights State

    var headacheDayTrend: [AnalyticsInsights.DailyCount] = []
    var intakeSeries: [AnalyticsInsights.ClassIntakeSeries] = []
    var severityWeekCounts: [AnalyticsInsights.SeverityWeekCount] = []
    var timeOfDayBins: [AnalyticsInsights.TimeOfDayBin] = []
    var symptomFrequencies: [AnalyticsInsights.SymptomFrequency] = []
    var painLocationFrequencies: [AnalyticsInsights.PainLocationFrequency] = []
    var insightWarnings: [AnalyticsInsights.Warning] = []
    var monthlySummaries: [AnalyticsInsights.MonthSummary] = []
    var weeklyAdherence: [AnalyticsInsights.WeeklyAdherence] = []
    /// Medications referenced by `monthlySummaries`, for display names/order.
    var summaryMedications: [Medication] = []

    // MARK: - Cache

    private static let cacheTTL: TimeInterval = 300
    private var cacheKey: String {
        if let custom = customRange {
            let start = TimestampHelper.dateString(from: custom.lowerBound)
            let end = TimestampHelper.dateString(from: custom.upperBound)
            return "analytics_custom_\(start)_\(end)"
        }
        return "analytics_\(selectedRange.rawValue)"
    }
    private let cache = CacheManager.shared

    // MARK: - Dependencies

    private let episodeRepository: EpisodeRepositoryProtocol
    private let dailyStatusRepository: DailyStatusRepositoryProtocol
    private let medicationRepository: MedicationRepositoryProtocol
    private let overlayRepository: CalendarOverlayRepositoryProtocol

    /// Maps medication ID to medication name for display purposes.
    private var medicationNames: [String: String] = [:]

    // MARK: - Init

    init(
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        dailyStatusRepository: DailyStatusRepositoryProtocol = DailyStatusRepository(dbManager: DatabaseManager.shared),
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        overlayRepository: CalendarOverlayRepositoryProtocol = OverlayRepository(dbManager: DatabaseManager.shared)
    ) {
        self.episodeRepository = episodeRepository
        self.dailyStatusRepository = dailyStatusRepository
        self.medicationRepository = medicationRepository
        self.overlayRepository = overlayRepository
    }

    // MARK: - Computed

    /// Effective range endpoints. Presets end now; custom ranges span whole
    /// days from the start of `start` through the end of `end`, clamped to
    /// now so future-dated ends behave like "today".
    private var effectiveRange: (start: Date, end: Date) {
        let calendar = Calendar.current
        let now = Date()
        if let custom = customRange {
            let start = calendar.startOfDay(for: custom.lowerBound)
            let endOfDay = calendar.date(
                byAdding: DateComponents(day: 1, second: -1),
                to: calendar.startOfDay(for: custom.upperBound)
            ) ?? custom.upperBound
            return (start, min(endOfDay, now))
        }
        let start = calendar.date(byAdding: .day, value: -selectedRange.rawValue, to: now)!
        return (start, now)
    }

    private var dateRange: (start: Int64, end: Int64) {
        let range = effectiveRange
        return (
            start: TimestampHelper.fromDate(range.start),
            end: TimestampHelper.fromDate(range.end)
        )
    }

    private var dateStringRange: (start: String, end: String) {
        let range = effectiveRange
        return (
            start: TimestampHelper.dateString(from: range.start),
            end: TimestampHelper.dateString(from: range.end)
        )
    }

    // MARK: - Actions

    @MainActor
    func setDateRange(_ range: TimeRangeDays) async {
        customRange = nil
        selectedRange = range
        await fetchData()
    }

    @MainActor
    func setCustomRange(start: Date, end: Date) async {
        customRange = min(start, end)...max(start, end)
        await fetchData()
    }

    @MainActor
    func fetchData() async {
        // Check cache
        if let cached: CachedAnalytics = cache.get(cacheKey) {
            episodes = cached.episodes
            intensityReadings = cached.intensityReadings
            dayStats = cached.dayStats
            dailyStatuses = cached.dailyStatuses
            rescueDoses = cached.rescueDoses
            medicationNames = cached.medicationNames
            headacheDayTrend = cached.headacheDayTrend
            intakeSeries = cached.intakeSeries
            severityWeekCounts = cached.severityWeekCounts
            timeOfDayBins = cached.timeOfDayBins
            symptomFrequencies = cached.symptomFrequencies
            painLocationFrequencies = cached.painLocationFrequencies
            insightWarnings = cached.insightWarnings
            monthlySummaries = cached.monthlySummaries
            weeklyAdherence = cached.weeklyAdherence
            summaryMedications = cached.summaryMedications
            return
        }

        isLoading = true
        error = nil

        let range = dateRange
        let stringRange = dateStringRange

        do {
            async let episodesTask = episodeRepository.getEpisodesByDateRange(start: range.start, end: range.end)
            async let statusesTask = dailyStatusRepository.getStatusesByDateRange(start: stringRange.start, end: stringRange.end)

            let fetchedEpisodes = try await episodesTask
            let fetchedStatuses = try await statusesTask

            episodes = fetchedEpisodes

            // Load all intensity readings for the fetched episodes
            let episodeIds = fetchedEpisodes.map(\.id)
            var allReadings: [IntensityReading] = []
            if !episodeIds.isEmpty {
                let readingsMap = try await episodeRepository.getIntensityReadings(episodeIds: episodeIds)
                allReadings = readingsMap.values.flatMap { $0 }
            }
            intensityReadings = allReadings
            dailyStatuses = fetchedStatuses

            // Load medication doses and filter to rescue medications
            let allDoses = try medicationRepository.getDosesByDateRange(start: range.start, end: range.end)
            let allMedications = try medicationRepository.getAllMedications()
            let rescueMedicationIds = Set(allMedications.filter { $0.type == .rescue }.map(\.id))

            // Build name lookup for rescue medications
            var nameMap: [String: String] = [:]
            for med in allMedications where rescueMedicationIds.contains(med.id) {
                nameMap[med.id] = med.name
            }
            medicationNames = nameMap

            rescueDoses = allDoses.filter { rescueMedicationIds.contains($0.medicationId) }

            // Compute day stats
            dayStats = computeDayStats(
                episodes: fetchedEpisodes,
                readings: allReadings,
                statuses: fetchedStatuses,
                rangeStart: TimestampHelper.toDate(range.start),
                rangeEnd: TimestampHelper.toDate(range.end)
            )

            // Compute insight chart series over an extended lookback window
            try await computeInsights(
                rangeStart: TimestampHelper.toDate(range.start),
                rangeEnd: TimestampHelper.toDate(range.end)
            )

            // Cache the results
            let cached = CachedAnalytics(
                episodes: episodes,
                intensityReadings: intensityReadings,
                dayStats: dayStats,
                dailyStatuses: dailyStatuses,
                rescueDoses: rescueDoses,
                medicationNames: medicationNames,
                headacheDayTrend: headacheDayTrend,
                intakeSeries: intakeSeries,
                severityWeekCounts: severityWeekCounts,
                timeOfDayBins: timeOfDayBins,
                symptomFrequencies: symptomFrequencies,
                painLocationFrequencies: painLocationFrequencies,
                insightWarnings: insightWarnings,
                monthlySummaries: monthlySummaries,
                weeklyAdherence: weeklyAdherence,
                summaryMedications: summaryMedications
            )
            cache.set(cacheKey, value: cached, ttl: Self.cacheTTL)

            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "AnalyticsViewModel", "action": "fetchData"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    @MainActor
    func refreshData() async {
        cache.invalidateByPattern("analytics_")
        await fetchData()
    }

    // MARK: - Computed Properties

    var migraineDays: Int {
        dayStats.filter { $0.status == .red }.count
    }

    var notClearDays: Int {
        dayStats.filter { $0.status == .yellow }.count
    }

    var clearDays: Int {
        dayStats.filter { $0.status == .green }.count
    }

    var unknownDays: Int {
        dayStats.filter { $0.status == nil }.count
    }

    // MARK: - Calendar

    @MainActor
    func saveOverlay(_ overlay: CalendarOverlay) async {
        do {
            if (try? overlayRepository.getOverlaysByDateRange(start: overlay.startDate, end: overlay.endDate ?? overlay.startDate)).flatMap({ $0.first { $0.id == overlay.id } }) != nil {
                _ = try overlayRepository.updateOverlay(overlay)
            } else {
                _ = try overlayRepository.createOverlay(overlay)
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "AnalyticsViewModel", "action": "saveOverlay"])
        }
    }

    @MainActor
    func deleteOverlay(_ id: String) async {
        do {
            try overlayRepository.deleteOverlay(id)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "AnalyticsViewModel", "action": "deleteOverlay"])
        }
    }

    @MainActor
    func loadCalendarData(for month: Date) async {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: month)
        guard let year = components.year, let monthNum = components.month else { return }
        do {
            // 1. Get manually logged statuses
            let statuses = try dailyStatusRepository.getMonthStats(year: year, month: monthNum)
            var statusMap: [String: DayStatus] = [:]
            for status in statuses {
                statusMap[status.date] = status.status
            }

            // 2. Overlay implicit red days from episodes
            // Any day where an episode overlaps any part of it is automatically red
            guard let monthStart = calendar.date(from: DateComponents(year: year, month: monthNum, day: 1)),
                  let monthEnd = calendar.date(byAdding: .month, value: 1, to: monthStart) else {
                calendarStatuses = statusMap
                return
            }
            let monthStartMs = TimestampHelper.fromDate(monthStart)
            let monthEndMs = TimestampHelper.fromDate(monthEnd)

            // Fetch episodes that could overlap: started before month end AND ended after month start (or still active)
            let monthEpisodes = try episodeRepository.getEpisodesByDateRange(start: monthStartMs, end: monthEndMs)

            // For each episode, mark every overlapping day as red
            for episode in monthEpisodes {
                let epStart = TimestampHelper.toDate(episode.startTime)
                let epEnd = episode.endTime.map { TimestampHelper.toDate($0) } ?? Date()

                // Clamp to month boundaries
                let rangeStart = max(calendar.startOfDay(for: epStart), monthStart)
                let rangeEnd = min(epEnd, monthEnd)

                var day = calendar.startOfDay(for: rangeStart)
                while day < rangeEnd {
                    let dateString = TimestampHelper.dateString(from: day)
                    // Priority: episode overlap (red) > manual status > unknown
                    statusMap[dateString] = .red
                    guard let nextDay = calendar.date(byAdding: .day, value: 1, to: day) else { break }
                    day = nextDay
                }
            }

            calendarStatuses = statusMap

            // 3. Load calendar overlays for this month
            let startStr = String(format: "%04d-%02d-01", year, monthNum)
            let endStr: String
            if monthNum == 12 {
                endStr = String(format: "%04d-01-01", year + 1)
            } else {
                endStr = String(format: "%04d-%02d-01", year, monthNum + 1)
            }
            let overlays = try overlayRepository.getOverlaysByDateRange(start: startStr, end: endStr)
            calendarOverlays = overlays

            // Build set of dates that have overlays
            var overlayDates: Set<String> = []
            for overlay in overlays {
                // Walk each day in the overlay range
                var date = overlay.startDate
                let overlayEnd = overlay.endDate ?? TimestampHelper.dateString()
                while date <= overlayEnd && date < endStr {
                    if date >= startStr {
                        overlayDates.insert(date)
                    }
                    // Advance by one day
                    if let d = TimestampHelper.dateFromString(date),
                       let next = calendar.date(byAdding: .day, value: 1, to: d) {
                        date = TimestampHelper.dateString(from: next)
                    } else {
                        break
                    }
                }
            }
            calendarOverlayDates = overlayDates
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "AnalyticsViewModel", "action": "loadCalendarData"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Private

    /// Computes the insight chart series (issue #435). Uses an extended
    /// lookback window so rolling 28-day counts have full history at the
    /// start of the selected range and warnings can compare against the
    /// previous 28-day window. Everything is anchored at `rangeEnd`, so a
    /// historical custom range reads as it would have on its last day.
    @MainActor
    private func computeInsights(rangeStart: Date, rangeEnd: Date) async throws {
        let calendar = Calendar.current
        let rangeDayCount = (calendar.dateComponents([.day], from: rangeStart, to: rangeEnd).day ?? 0) + 1
        let lookbackDays = max(
            rangeDayCount + AnalyticsInsights.rollingWindowDays - 1,
            2 * AnalyticsInsights.rollingWindowDays
        )
        let extendedStart = calendar.date(byAdding: .day, value: -lookbackDays, to: rangeEnd) ?? rangeEnd
        let extendedStartMs = TimestampHelper.fromDate(extendedStart)
        let rangeEndMs = TimestampHelper.fromDate(rangeEnd)
        let extendedStartString = TimestampHelper.dateString(from: extendedStart)
        let rangeEndString = TimestampHelper.dateString(from: rangeEnd)

        async let episodesTask = episodeRepository.getEpisodesByDateRange(start: extendedStartMs, end: rangeEndMs)
        async let statusesTask = dailyStatusRepository.getStatusesByDateRange(start: extendedStartString, end: rangeEndString)
        let extendedEpisodes = try await episodesTask
        let extendedStatuses = try await statusesTask

        var extendedReadings: [IntensityReading] = []
        let episodeIds = extendedEpisodes.map(\.id)
        if !episodeIds.isEmpty {
            let readingsMap = try await episodeRepository.getIntensityReadings(episodeIds: episodeIds)
            extendedReadings = readingsMap.values.flatMap { $0 }
        }

        let allDoses = try medicationRepository.getDosesByDateRange(start: extendedStartMs, end: rangeEndMs)
        let allMedications = try medicationRepository.getAllMedications()
        let overlays = try overlayRepository.getOverlaysByDateRange(start: extendedStartString, end: rangeEndString)

        let excluded = AnalyticsInsights.excludedDates(overlays: overlays, now: rangeEnd, calendar: calendar)
        let headacheDays = AnalyticsInsights.headacheDays(
            episodes: extendedEpisodes,
            statuses: extendedStatuses,
            excluded: excluded,
            now: rangeEnd,
            calendar: calendar
        )
        let intake = AnalyticsInsights.intakeDays(
            doses: allDoses,
            medications: allMedications,
            excluded: excluded,
            calendar: calendar
        )

        headacheDayTrend = AnalyticsInsights.rollingCounts(of: headacheDays, from: rangeStart, to: rangeEnd, calendar: calendar)
        let classMedNames = AnalyticsInsights.classMedicationNames(medications: allMedications, doses: allDoses)
        intakeSeries = AnalyticsInsights.AcuteMedClass.allCases.map { medClass in
            AnalyticsInsights.ClassIntakeSeries(
                medClass: medClass,
                points: AnalyticsInsights.rollingCounts(of: intake[medClass] ?? [], from: rangeStart, to: rangeEnd, calendar: calendar),
                medicationNames: classMedNames[medClass] ?? []
            )
        }

        let rangeStartMs = TimestampHelper.fromDate(rangeStart)
        let rangeEpisodes = extendedEpisodes.filter { $0.startTime >= rangeStartMs }
        severityWeekCounts = AnalyticsInsights.severityWeekCounts(
            episodes: rangeEpisodes,
            readings: extendedReadings,
            excluded: excluded,
            calendar: calendar
        )
        timeOfDayBins = AnalyticsInsights.timeOfDayBins(episodes: rangeEpisodes, excluded: excluded, calendar: calendar)
        try computeFrequencies(rangeEpisodes: rangeEpisodes, excluded: excluded, calendar: calendar)
        insightWarnings = AnalyticsInsights.warnings(
            headacheDays: headacheDays,
            intakeDays: intake,
            episodes: extendedEpisodes,
            readings: extendedReadings,
            excluded: excluded,
            now: rangeEnd,
            calendar: calendar
        )

        // Monthly provider summary + preventative adherence over the
        // selected range (not the extended lookback window).
        let rangeDoses = allDoses.filter { $0.timestamp >= rangeStartMs }
        monthlySummaries = AnalyticsInsights.monthlySummaries(
            episodes: rangeEpisodes,
            doses: rangeDoses,
            medications: allMedications,
            excluded: excluded,
            from: rangeStart,
            to: rangeEnd,
            calendar: calendar
        )
        let summaryMedIds = Set(monthlySummaries.flatMap { $0.medStats.keys })
        summaryMedications = allMedications
            .filter { summaryMedIds.contains($0.id) }
            .sorted { $0.name < $1.name }

        let preventativeIds = allMedications.filter { $0.type == .preventative && $0.active }.map(\.id)
        let schedulesByMedication = preventativeIds.isEmpty
            ? [:]
            : try medicationRepository.getSchedulesByMultipleMedicationIds(preventativeIds)
        weeklyAdherence = AnalyticsInsights.weeklyAdherence(
            doses: rangeDoses,
            medications: allMedications,
            schedulesByMedication: schedulesByMedication,
            excluded: excluded,
            from: rangeStart,
            to: rangeEnd,
            calendar: calendar
        )
    }

    /// Computes symptom and pain-location frequency over the in-range episodes.
    /// A value counts once per episode if it was present at any point, so
    /// mid-episode log snapshots are unioned in — a location toggled on/off/on
    /// still counts once, and one only ever added via a Log Update isn't missed.
    @MainActor
    private func computeFrequencies(rangeEpisodes: [Episode], excluded: Set<String>, calendar: Calendar) throws {
        let rangeEpisodeIds = rangeEpisodes.map(\.id)
        let symptomLogs = try episodeRepository.getSymptomLogsByMultipleEpisodeIds(rangeEpisodeIds).values.flatMap { $0 }
        let locationLogs = try episodeRepository.getLocationLogsByMultipleEpisodeIds(rangeEpisodeIds).values.flatMap { $0 }
        symptomFrequencies = AnalyticsInsights.symptomFrequencies(
            episodes: rangeEpisodes, symptomLogs: symptomLogs, excluded: excluded, calendar: calendar
        )
        painLocationFrequencies = AnalyticsInsights.painLocationFrequencies(
            episodes: rangeEpisodes, locationLogs: locationLogs, excluded: excluded, calendar: calendar
        )
    }

    private func computeDayStats(
        episodes: [Episode],
        readings: [IntensityReading],
        statuses: [DailyStatusLog],
        rangeStart: Date,
        rangeEnd: Date
    ) -> [DayStatistic] {
        let calendar = Calendar.current

        var stats: [DayStatistic] = []
        var currentDate = rangeStart

        while currentDate <= rangeEnd {
            let dateString = TimestampHelper.dateString(from: currentDate)

            let dayStart = calendar.startOfDay(for: currentDate)
            let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart)!

            let dayStartMs = TimestampHelper.fromDate(dayStart)
            let dayEndMs = TimestampHelper.fromDate(dayEnd)

            let dayEpisodes = episodes.filter { ep in
                ep.startTime < dayEndMs && (ep.endTime ?? Int64.max) > dayStartMs
            }

            let dayReadings = readings.filter { r in
                r.timestamp >= dayStartMs && r.timestamp < dayEndMs
            }

            let avgIntensity: Double? = dayReadings.isEmpty ? nil :
                dayReadings.map(\.intensity).reduce(0, +) / Double(dayReadings.count)

            let manualStatus = statuses.first { $0.date == dateString }

            // Priority: episode overlap (red) > manual status > unknown
            let effectiveStatus: DayStatus? = !dayEpisodes.isEmpty ? .red : manualStatus?.status

            stats.append(DayStatistic(
                date: dateString,
                status: effectiveStatus,
                episodeCount: dayEpisodes.count,
                averageIntensity: avgIntensity
            ))

            currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate)!
        }

        return stats
    }
}

// MARK: - Cache Model

private struct CachedAnalytics {
    let episodes: [Episode]
    let intensityReadings: [IntensityReading]
    let dayStats: [DayStatistic]
    let dailyStatuses: [DailyStatusLog]
    let rescueDoses: [MedicationDose]
    let medicationNames: [String: String]
    let headacheDayTrend: [AnalyticsInsights.DailyCount]
    let intakeSeries: [AnalyticsInsights.ClassIntakeSeries]
    let severityWeekCounts: [AnalyticsInsights.SeverityWeekCount]
    let timeOfDayBins: [AnalyticsInsights.TimeOfDayBin]
    let symptomFrequencies: [AnalyticsInsights.SymptomFrequency]
    let painLocationFrequencies: [AnalyticsInsights.PainLocationFrequency]
    let insightWarnings: [AnalyticsInsights.Warning]
    let monthlySummaries: [AnalyticsInsights.MonthSummary]
    let weeklyAdherence: [AnalyticsInsights.WeeklyAdherence]
    let summaryMedications: [Medication]
}
