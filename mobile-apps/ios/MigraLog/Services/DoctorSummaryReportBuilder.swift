import Foundation

/// Assembled, render-ready data for the one-page doctor-visit summary.
///
/// All values are computed by `DoctorSummaryReportBuilder` from the existing
/// repositories and the pure `AnalyticsInsights` aggregators, so the view layer
/// only formats and lays out — it never touches the database. Everything is
/// informational only, not medical advice.
struct DoctorSummaryReport: Equatable {
    /// When the report was generated (its "as of" date).
    let generatedAt: Date
    /// Inclusive start of the 30-day headline window.
    let recentStart: Date
    /// Inclusive end of every window (== `generatedAt`'s day).
    let recentEnd: Date
    /// Length of the headline window in days (30).
    let recentDays: Int

    // Last-30-days headline.
    let headacheDayCount: Int
    let episodeCount: Int
    let rescueDayCount: Int

    // Long-term trend (per calendar month).
    let monthlyHeadacheDays: [AnalyticsInsights.MonthlyHeadacheDays]

    // Last-30-days medication usage and preventative compliance.
    let medicationUsage: [AnalyticsInsights.MedicationUsage]
    let preventativeCompliance: [AnalyticsInsights.PreventativeCompliance]

    /// ICHD-3 chronic-migraine threshold, surfaced so the view can flag it.
    var chronicThreshold: Int { AnalyticsInsights.chronicRangeThreshold }
    /// True when the recent headache-day count is at/above the chronic range.
    var isInChronicRange: Bool { headacheDayCount >= chronicThreshold }
}

/// Builds a `DoctorSummaryReport` from the repositories. Mirrors the data flow
/// in `AnalyticsViewModel.computeInsights` but anchored to a fixed 30-day
/// headline window plus a longer trend window, and reusing the same pure
/// `AnalyticsInsights` functions so the report and the in-app charts agree.
struct DoctorSummaryReportBuilder {
    /// Headline window length, per the doctor-visit spec.
    static let recentWindowDays = 30
    /// Months of history shown in the long-term trend bars.
    static let trendMonths = 6

    private let episodeRepository: EpisodeRepositoryProtocol
    private let dailyStatusRepository: DailyStatusRepositoryProtocol
    private let medicationRepository: MedicationRepositoryProtocol
    private let overlayRepository: CalendarOverlayRepositoryProtocol

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

    func buildReport(now: Date = Date(), calendar: Calendar = .current) throws -> DoctorSummaryReport {
        let end = now
        // Headline window: the last `recentWindowDays` whole days, inclusive of today.
        let recentStartDay = calendar.startOfDay(
            for: calendar.date(byAdding: .day, value: -(Self.recentWindowDays - 1), to: end) ?? end
        )
        // Trend window: start of the month `trendMonths - 1` months back, so the
        // current month plus the prior `trendMonths - 1` months are all shown.
        let trendAnchor = calendar.date(byAdding: .month, value: -(Self.trendMonths - 1), to: end) ?? end
        let trendStart = calendar.dateInterval(of: .month, for: trendAnchor)?.start
            ?? calendar.startOfDay(for: trendAnchor)

        // Fetch over the wider of the two windows (the trend window).
        let fetchStartMs = TimestampHelper.fromDate(trendStart)
        let endMs = TimestampHelper.fromDate(end)
        let fetchStartString = TimestampHelper.dateString(from: trendStart)
        let endString = TimestampHelper.dateString(from: end)

        let episodes = try episodeRepository.getEpisodesByDateRange(start: fetchStartMs, end: endMs)
        let statuses = try dailyStatusRepository.getStatusesByDateRange(start: fetchStartString, end: endString)
        let doses = try medicationRepository.getDosesByDateRange(start: fetchStartMs, end: endMs)
        let medications = try medicationRepository.getAllMedications()
        let overlays = try overlayRepository.getOverlaysByDateRange(start: fetchStartString, end: endString)

        let excluded = AnalyticsInsights.excludedDates(overlays: overlays, now: end, calendar: calendar)

        // Headache-day set over the full fetch window (used for both the recent
        // count and the per-month trend bars).
        let headacheDays = AnalyticsInsights.headacheDays(
            episodes: episodes, statuses: statuses, excluded: excluded, now: end, calendar: calendar
        )

        // Recent-window headache days: count members of the set within the window.
        let recentStartString = TimestampHelper.dateString(from: recentStartDay)
        let headacheDayCount = headacheDays.filter { $0 >= recentStartString && $0 <= endString }.count

        // Recent-window episodes: started within the window, excluded days dropped.
        let recentStartMs = TimestampHelper.fromDate(recentStartDay)
        let episodeCount = episodes.filter { episode in
            episode.startTime >= recentStartMs && episode.startTime <= endMs
                && !excluded.contains(TimestampHelper.dateString(from: TimestampHelper.toDate(episode.startTime)))
        }.count

        // Recent-window rescue intake days, across all acute classes.
        let recentDoses = doses.filter { $0.timestamp >= recentStartMs }
        let intake = AnalyticsInsights.intakeDays(
            doses: recentDoses, medications: medications, excluded: excluded, calendar: calendar
        )
        let rescueDayCount = intake.values.reduce(into: Set<String>()) { $0.formUnion($1) }.count

        let monthlyHeadacheDays = AnalyticsInsights.monthlyHeadacheDays(
            headacheDays: headacheDays, from: trendStart, to: end, calendar: calendar
        )

        let medicationUsage = AnalyticsInsights.medicationUsage(
            doses: recentDoses, medications: medications, excluded: excluded,
            from: recentStartDay, to: end, calendar: calendar
        )

        let preventativeIds = medications.filter { $0.type == .preventative && $0.active }.map(\.id)
        let schedulesByMedication = preventativeIds.isEmpty
            ? [:]
            : try medicationRepository.getSchedulesByMultipleMedicationIds(preventativeIds)
        let preventativeCompliance = AnalyticsInsights.preventativeCompliance(
            doses: recentDoses, medications: medications, schedulesByMedication: schedulesByMedication,
            excluded: excluded, from: recentStartDay, to: end, calendar: calendar
        )

        return DoctorSummaryReport(
            generatedAt: end,
            recentStart: recentStartDay,
            recentEnd: end,
            recentDays: Self.recentWindowDays,
            headacheDayCount: headacheDayCount,
            episodeCount: episodeCount,
            rescueDayCount: rescueDayCount,
            monthlyHeadacheDays: monthlyHeadacheDays,
            medicationUsage: medicationUsage,
            preventativeCompliance: preventativeCompliance
        )
    }
}
