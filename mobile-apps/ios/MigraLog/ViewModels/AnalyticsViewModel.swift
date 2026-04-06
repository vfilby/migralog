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
    var episodes: [Episode] = []
    var intensityReadings: [IntensityReading] = []
    var dayStats: [DayStatistic] = []
    var dailyStatuses: [DailyStatusLog] = []
    var calendarStatuses: [String: DayStatus] = [:]
    var showDailyStatusPrompt = false
    var selectedCalendarDate: Date?
    var rescueDoses: [MedicationDose] = []
    var isLoading = false
    var error: String?

    // MARK: - Cache

    private static let cacheTTL: TimeInterval = 30
    private var cacheKey: String { "analytics_\(selectedRange.rawValue)" }
    private let cache = CacheManager.shared

    // MARK: - Dependencies

    private let episodeRepository: EpisodeRepositoryProtocol
    private let dailyStatusRepository: DailyStatusRepositoryProtocol
    private let medicationRepository: MedicationRepositoryProtocol

    /// Maps medication ID to medication name for display purposes.
    private var medicationNames: [String: String] = [:]

    // MARK: - Init

    init(
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        dailyStatusRepository: DailyStatusRepositoryProtocol = DailyStatusRepository(dbManager: DatabaseManager.shared),
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared)
    ) {
        self.episodeRepository = episodeRepository
        self.dailyStatusRepository = dailyStatusRepository
        self.medicationRepository = medicationRepository
    }

    // MARK: - Computed

    private var dateRange: (start: Int64, end: Int64) {
        let now = Date()
        let start = Calendar.current.date(byAdding: .day, value: -selectedRange.rawValue, to: now)!
        return (
            start: TimestampHelper.fromDate(start),
            end: TimestampHelper.fromDate(now)
        )
    }

    private var dateStringRange: (start: String, end: String) {
        let now = Date()
        let start = Calendar.current.date(byAdding: .day, value: -selectedRange.rawValue, to: now)!
        return (
            start: TimestampHelper.dateString(from: start),
            end: TimestampHelper.dateString(from: now)
        )
    }

    // MARK: - Actions

    @MainActor
    func setDateRange(_ range: TimeRangeDays) async {
        selectedRange = range
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
                statuses: fetchedStatuses
            )

            // Cache the results
            let cached = CachedAnalytics(
                episodes: episodes,
                intensityReadings: intensityReadings,
                dayStats: dayStats,
                dailyStatuses: dailyStatuses,
                rescueDoses: rescueDoses,
                medicationNames: medicationNames
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

    /// Summary of medication usage counts by name, sorted by count descending.
    var medicationUsageSummary: [(name: String, count: Int)] {
        var counts: [String: Int] = [:]
        for dose in rescueDoses {
            let name = medicationNames[dose.medicationId] ?? dose.medicationId
            counts[name, default: 0] += 1
        }
        return counts.map { (name: $0.key, count: $0.value) }
            .sorted { $0.count > $1.count }
    }

    // MARK: - Calendar

    @MainActor
    func loadCalendarData(for month: Date) async {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: month)
        guard let year = components.year, let monthNum = components.month else { return }
        do {
            // Load manual daily statuses
            let statuses = try dailyStatusRepository.getMonthStats(year: year, month: monthNum)
            var statusMap: [String: DayStatus] = [:]
            for status in statuses {
                statusMap[status.date] = status.status
            }

            // Load episodes that may overlap this month and mark those days as red
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
                    statusMap[dateString] = .red
                    guard let nextDay = calendar.date(byAdding: .day, value: 1, to: day) else { break }
                    day = nextDay
                }
            }

            calendarStatuses = statusMap
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "AnalyticsViewModel", "action": "loadCalendarData"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Private

    private func computeDayStats(
        episodes: [Episode],
        readings: [IntensityReading],
        statuses: [DailyStatusLog]
    ) -> [DayStatistic] {
        let calendar = Calendar.current
        let now = Date()
        let startDate = calendar.date(byAdding: .day, value: -selectedRange.rawValue, to: now)!

        var stats: [DayStatistic] = []
        var currentDate = startDate

        while currentDate <= now {
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

            let status = statuses.first { $0.date == dateString }

            stats.append(DayStatistic(
                date: dateString,
                status: status?.status,
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
}
