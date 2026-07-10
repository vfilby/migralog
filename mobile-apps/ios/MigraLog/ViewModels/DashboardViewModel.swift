import Foundation
import Observation

/// Medication schedule status for the dashboard, combining medication info with today's dose state.
struct MedicationScheduleItem: Identifiable, Equatable {
    let medication: Medication
    let schedule: MedicationSchedule
    var dose: MedicationDose?
    /// Whether to surface this row's scheduled time. Set when the medication has
    /// more than one scheduled dose that day, so the rows can be told apart.
    var showScheduleTime: Bool = false

    var id: String { schedule.id }
    var isTaken: Bool { dose?.status == .taken }
    var isSkipped: Bool { dose?.status == .skipped }
    var isPending: Bool { dose == nil }
}

@Observable
final class DashboardViewModel {
    // MARK: - State

    var currentEpisode: Episode?
    var recentEpisodes: [Episode] = []
    var recentReadings: [String: [IntensityReading]] = [:]
    var todaysMedications: [MedicationScheduleItem] = []
    /// Most recent taken dose per medication id (across all time). Used for cooldown warnings.
    var lastDoseByMedication: [String: MedicationDose] = [:]
    /// Per-category MOH risk status for categories that have a configured limit.
    /// Only categories present in today's medications are populated.
    var categoryUsage: [MedicationCategory: CategoryUsageStatus] = [:]
    /// Category cooldown status per medication id.
    var categoryCooldowns: [String: CategoryCooldown.Status] = [:]
    var yesterdayStatus: DailyStatusLog?
    var shouldShowYesterdayPrompt: Bool = false
    var showNewEpisode = false
    var showLogUpdate = false
    var showLogMedication = false
    var isLoading = false
    var error: String?

    // MARK: - Dependencies

    private let episodeRepository: EpisodeRepositoryProtocol
    private let medicationRepository: MedicationRepositoryProtocol
    private let dailyStatusRepository: DailyStatusRepositoryProtocol
    private let categoryLimitRepository: CategorySafetyRuleRepositoryProtocol
    private let dailyCheckinService: DailyCheckinNotificationServiceProtocol
    private let doseLogger: MedicationDoseLoggerProtocol
    private let liveActivityManager: LiveActivityManaging

    // MARK: - Init

    init(
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        dailyStatusRepository: DailyStatusRepositoryProtocol = DailyStatusRepository(dbManager: DatabaseManager.shared),
        categoryLimitRepository: CategorySafetyRuleRepositoryProtocol = CategorySafetyRuleRepository(dbManager: DatabaseManager.shared),
        dailyCheckinService: DailyCheckinNotificationServiceProtocol = DailyCheckinNotificationService(
            notificationService: NotificationService.shared,
            scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
            episodeRepo: EpisodeRepository(dbManager: DatabaseManager.shared),
            dailyStatusRepo: DailyStatusRepository(dbManager: DatabaseManager.shared)
        ),
        doseLogger: MedicationDoseLoggerProtocol = MedicationDoseLogger(),
        liveActivityManager: LiveActivityManaging = LiveActivityManager.shared
    ) {
        self.episodeRepository = episodeRepository
        self.medicationRepository = medicationRepository
        self.dailyStatusRepository = dailyStatusRepository
        self.categoryLimitRepository = categoryLimitRepository
        self.dailyCheckinService = dailyCheckinService
        self.doseLogger = doseLogger
        self.liveActivityManager = liveActivityManager
    }

    // MARK: - Actions

    /// Coalesces overlapping reloads. The dashboard fires `loadData()` from several
    /// triggers that can overlap (first appearance, sheet dismissal, the
    /// `.medicationDataChanged` notification). Running them concurrently thrashes the
    /// `@Observable` state and keeps the view re-rendering, so the app never reaches the
    /// idle state XCUITest waits on before a tab button becomes hittable. We serialise
    /// into at most one in-flight pass plus a single trailing refresh, so the latest data
    /// is still fetched after a write without the concurrent churn.
    @ObservationIgnored private var loadTask: Task<Void, Never>?
    @ObservationIgnored private var reloadRequested = false

    @MainActor
    func loadData() async {
        if loadTask != nil {
            // A load is already running; request one trailing refresh instead of
            // starting a concurrent pass.
            reloadRequested = true
            return
        }
        repeat {
            reloadRequested = false
            let task = Task { @MainActor in await self.performLoad() }
            loadTask = task
            await task.value
            loadTask = nil
        } while reloadRequested
    }

    @MainActor
    private func performLoad() async {
        isLoading = true
        error = nil
        do {
            async let episodeTask = episodeRepository.getCurrentEpisode()
            async let recentTask = loadRecentEpisodes()
            async let medsTask = loadTodaysMedications()
            async let statusTask = loadYesterdayStatus()
            async let yesterdayHasEpisodeTask = yesterdayHasEpisode()

            currentEpisode = try await episodeTask
            recentEpisodes = try await recentTask
            todaysMedications = try await medsTask
            yesterdayStatus = try await statusTask
            let hasEpisodeYesterday = try await yesterdayHasEpisodeTask
            shouldShowYesterdayPrompt = yesterdayStatus == nil && !hasEpisodeYesterday

            // Load active episode readings for dashboard sparkline
            if let active = currentEpisode,
               let details = try episodeRepository.getEpisodeWithDetails(active.id) {
                recentReadings[active.id] = details.intensityReadings
            }
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DashboardViewModel", "action": "loadData"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    @MainActor
    func logDose(scheduleItem: MedicationScheduleItem) async {
        let now = TimestampHelper.now
        let dose = MedicationDose(
            id: UUID().uuidString,
            medicationId: scheduleItem.medication.id,
            timestamp: now,
            quantity: scheduleItem.medication.defaultQuantity ?? 1,
            dosageAmount: scheduleItem.medication.dosageAmount,
            dosageUnit: scheduleItem.medication.dosageUnit,
            status: .taken,
            episodeId: currentEpisode?.id,
            effectivenessRating: nil,
            timeToRelief: nil,
            sideEffects: [],
            notes: nil,
            createdAt: now,
            updatedAt: now
        )
        do {
            let savedDose = try await doseLogger.record(dose)
            if let index = todaysMedications.firstIndex(where: { $0.id == scheduleItem.id }) {
                todaysMedications[index].dose = savedDose
            }
            lastDoseByMedication[scheduleItem.medication.id] = savedDose
            // Refresh category usage so warnings update immediately.
            let categories = Set(todaysMedications.compactMap { $0.medication.category })
            categoryUsage = computeCategoryUsage(for: categories, now: Date())
            categoryCooldowns = computeCategoryCooldowns(
                for: todaysMedications.map(\.medication),
                now: Date()
            )
            // Refresh the Live Activity's last-rescue-med readout, if running.
            if let episode = currentEpisode, scheduleItem.medication.isRescue {
                liveActivityManager.refresh(episodeId: episode.id)
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DashboardViewModel", "action": "logDose"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func skipDose(scheduleItem: MedicationScheduleItem) async {
        let now = TimestampHelper.now
        let dose = MedicationDose(
            id: UUID().uuidString,
            medicationId: scheduleItem.medication.id,
            timestamp: now,
            quantity: 0,
            dosageAmount: nil,
            dosageUnit: nil,
            status: .skipped,
            episodeId: nil,
            effectivenessRating: nil,
            timeToRelief: nil,
            sideEffects: [],
            notes: nil,
            createdAt: now,
            updatedAt: now
        )
        do {
            let savedDose = try await doseLogger.record(dose)
            if let index = todaysMedications.firstIndex(where: { $0.id == scheduleItem.id }) {
                todaysMedications[index].dose = savedDose
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DashboardViewModel", "action": "skipDose"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func undoDose(scheduleItem: MedicationScheduleItem) async {
        guard let dose = scheduleItem.dose else { return }
        do {
            try await medicationRepository.deleteDose(dose.id)
            if let index = todaysMedications.firstIndex(where: { $0.id == scheduleItem.id }) {
                todaysMedications[index].dose = nil
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DashboardViewModel", "action": "undoDose"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func logYesterdayStatus(_ status: DayStatus, type: YellowDayType? = nil, notes: String? = nil) async {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let dateString = TimestampHelper.dateString(from: yesterday)
        let now = TimestampHelper.now
        let statusLog = DailyStatusLog(
            id: UUID().uuidString,
            date: dateString,
            status: status,
            statusType: type,
            notes: notes,
            prompted: true,
            createdAt: now,
            updatedAt: now
        )
        do {
            let saved = try await dailyStatusRepository.createStatus(statusLog)
            yesterdayStatus = saved
            shouldShowYesterdayPrompt = false
            // Cancel daily check-in for this date and top up
            await dailyCheckinService.cancelForDate(dateString)
            await dailyCheckinService.topUp()
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DashboardViewModel", "action": "logYesterdayStatus"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func undoYesterdayStatus() async {
        guard let status = yesterdayStatus else { return }
        do {
            try await dailyStatusRepository.deleteStatus(status.id)
            yesterdayStatus = nil
            // Re-evaluate prompt visibility: if yesterday has an episode, keep hidden.
            let hasEpisodeYesterday = (try? await yesterdayHasEpisode()) ?? false
            shouldShowYesterdayPrompt = !hasEpisodeYesterday
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DashboardViewModel", "action": "undoYesterdayStatus"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Private

    private func loadRecentEpisodes() async throws -> [Episode] {
        let all = try episodeRepository.getAllEpisodes()
        let recent = Array(all.filter { !$0.isActive }.prefix(3))
        // Load intensity readings for sparklines
        var readings: [String: [IntensityReading]] = [:]
        for ep in recent {
            if let details = try episodeRepository.getEpisodeWithDetails(ep.id) {
                readings[ep.id] = details.intensityReadings
            }
        }
        await MainActor.run { recentReadings = readings }
        return recent
    }

    /// Associates each of a medication's logged doses for the day with the
    /// scheduled occurrence it belongs to, keyed by schedule id.
    ///
    /// Doses record the actual time taken and carry no schedule reference, so a
    /// med scheduled more than once a day can't be matched by id alone (that
    /// would attach the first dose to every row). Instead we match on time of
    /// day: each dose is bound to the schedule whose "HH:mm" is nearest to when
    /// it was logged, and every schedule and dose is used at most once. Closest
    /// pairs bind first; midnight wrap is treated as circular. Ties break
    /// deterministically by id so results are stable across reloads.
    static func matchDosesToSchedules(
        schedules: [MedicationSchedule],
        doses: [MedicationDose]
    ) -> [String: MedicationDose] {
        guard !schedules.isEmpty, !doses.isEmpty else { return [:] }

        func scheduleMinute(_ schedule: MedicationSchedule) -> Int {
            guard let components = schedule.timeComponents else { return 0 }
            return components.hour * 60 + components.minute
        }
        func doseMinute(_ dose: MedicationDose) -> Int {
            let components = Calendar.current.dateComponents([.hour, .minute], from: dose.date)
            return (components.hour ?? 0) * 60 + (components.minute ?? 0)
        }
        // Circular distance between two minute-of-day values (handles the case
        // where, e.g., a 23:00 schedule is nearest a dose logged just after midnight).
        func distance(_ lhs: Int, _ rhs: Int) -> Int {
            let diff = abs(lhs - rhs)
            return min(diff, (24 * 60) - diff)
        }

        var pairs: [(scheduleId: String, doseIndex: Int, distance: Int)] = []
        for schedule in schedules {
            let scheduleMin = scheduleMinute(schedule)
            for (index, dose) in doses.enumerated() {
                pairs.append((schedule.id, index, distance(scheduleMin, doseMinute(dose))))
            }
        }
        pairs.sort { lhs, rhs in
            if lhs.distance != rhs.distance { return lhs.distance < rhs.distance }
            if lhs.scheduleId != rhs.scheduleId { return lhs.scheduleId < rhs.scheduleId }
            return lhs.doseIndex < rhs.doseIndex
        }

        var result: [String: MedicationDose] = [:]
        var usedDoseIndices: Set<Int> = []
        for pair in pairs {
            guard result[pair.scheduleId] == nil, !usedDoseIndices.contains(pair.doseIndex) else { continue }
            result[pair.scheduleId] = doses[pair.doseIndex]
            usedDoseIndices.insert(pair.doseIndex)
        }
        return result
    }

    private func loadTodaysMedications() async throws -> [MedicationScheduleItem] {
        let activeMeds = try await medicationRepository.getActiveMedications()
        let today = TimestampHelper.dateString()
        let todayDoses = try await medicationRepository.getDosesWithMedications(date: today)

        var items: [MedicationScheduleItem] = []
        var lastDoses: [String: MedicationDose] = [:]
        var usedCategories: Set<MedicationCategory> = []
        for med in activeMeds {
            let schedules = try await medicationRepository.getSchedules(medicationId: med.id)
            if let last = try? medicationRepository.getLastDose(medicationId: med.id) {
                lastDoses[med.id] = last
            }
            let enabledSchedules = schedules.filter { $0.enabled }
            // Attach each of the day's logged doses to the specific scheduled
            // occurrence it belongs to, rather than the medication as a whole,
            // so a med scheduled multiple times a day tracks each dose
            // independently (logging one no longer marks every row taken).
            let medDoses = todayDoses.filter { $0.medication.id == med.id }.map(\.dose)
            let doseBySchedule = Self.matchDosesToSchedules(schedules: enabledSchedules, doses: medDoses)
            for schedule in enabledSchedules {
                items.append(MedicationScheduleItem(
                    medication: med,
                    schedule: schedule,
                    dose: doseBySchedule[schedule.id]
                ))
                if let category = med.category {
                    usedCategories.insert(category)
                }
            }
        }
        // Surface the scheduled time on a row only when its medication has more
        // than one scheduled dose that day, so the otherwise-identical rows can
        // be told apart.
        let scheduleCounts = Dictionary(grouping: items, by: { $0.medication.id })
            .mapValues(\.count)
        for index in items.indices {
            items[index].showScheduleTime = (scheduleCounts[items[index].medication.id] ?? 0) > 1
        }

        // Order the whole list by scheduled time. Times are stored as zero-padded
        // "HH:mm", so a lexical compare is already chronological; fall back to the
        // medication name so same-time doses keep a stable, alphabetical order.
        items.sort { lhs, rhs in
            if lhs.schedule.time != rhs.schedule.time {
                return lhs.schedule.time < rhs.schedule.time
            }
            return lhs.medication.name.localizedCaseInsensitiveCompare(rhs.medication.name) == .orderedAscending
        }

        let usage = computeCategoryUsage(for: usedCategories, now: Date())
        let cooldowns = computeCategoryCooldowns(
            for: activeMeds.filter { med in items.contains(where: { $0.medication.id == med.id }) },
            now: Date()
        )
        await MainActor.run {
            lastDoseByMedication = lastDoses
            categoryUsage = usage
            categoryCooldowns = cooldowns
        }
        return items
    }

    /// Category usage status to show on a specific medication's row. Excluded
    /// medications never show their category's warning.
    func categoryUsageStatus(for medication: Medication) -> CategoryUsageStatus {
        guard !medication.excludedFromSafetyWarnings, let category = medication.category else {
            return .noLimit
        }
        return categoryUsage[category] ?? .noLimit
    }

    /// Computes the `CategoryUsageStatus` map for the given categories. Categories
    /// without a configured limit are omitted.
    private func computeCategoryUsage(
        for categories: Set<MedicationCategory>,
        now: Date
    ) -> [MedicationCategory: CategoryUsageStatus] {
        var result: [MedicationCategory: CategoryUsageStatus] = [:]
        for category in categories {
            guard let configured = (try? categoryLimitRepository.getRule(category: category, type: .periodLimit)) ?? nil else {
                continue
            }
            let daysUsed = (try? categoryLimitRepository.countUsageDays(
                category: category,
                windowDays: configured.windowDays,
                now: now
            )) ?? 0
            result[category] = CategoryUsageStatus.evaluate(daysUsed: daysUsed, limit: configured)
        }
        return result
    }

    /// Computes `CategoryCooldown.Status` per medication id, for medications
    /// whose category has a configured cooldown rule.
    private func computeCategoryCooldowns(
        for medications: [Medication],
        now: Date
    ) -> [String: CategoryCooldown.Status] {
        var result: [String: CategoryCooldown.Status] = [:]
        for med in medications {
            guard let category = med.category, !med.excludedFromSafetyWarnings else { continue }
            let rule = try? categoryLimitRepository.getRule(category: category, type: .cooldown)
            let last = try? medicationRepository.getLastTakenDoseInCategory(category, now: now)
            result[med.id] = CategoryCooldown.evaluate(
                category: category,
                lastDoseInCategory: last ?? nil,
                cooldownRule: rule ?? nil,
                now: now
            )
        }
        return result
    }

    private func loadYesterdayStatus() async throws -> DailyStatusLog? {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let dateString = TimestampHelper.dateString(from: yesterday)
        return try await dailyStatusRepository.getStatusByDate(dateString)
    }

    /// Returns true if any episode overlaps yesterday (midnight-to-midnight).
    private func yesterdayHasEpisode() async throws -> Bool {
        let calendar = Calendar.current
        let yesterday = calendar.date(byAdding: .day, value: -1, to: Date())!
        let dayStart = calendar.startOfDay(for: yesterday)
        let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart)!
        let dayStartMs = TimestampHelper.fromDate(dayStart)
        let dayEndMs = TimestampHelper.fromDate(dayEnd)

        // Pull a wider range by start-time to catch episodes that began before yesterday
        // but are still active or ended yesterday. Use all episodes and filter locally,
        // since getEpisodesByDateRange filters on startTime only.
        let all = try episodeRepository.getAllEpisodes()
        return all.contains { ep in
            ep.startTime < dayEndMs && (ep.endTime ?? Int64.max) > dayStartMs
        }
    }
}
