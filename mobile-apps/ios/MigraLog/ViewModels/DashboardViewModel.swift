import Foundation
import Observation

/// Medication schedule status for the dashboard, combining medication info with today's dose state.
struct MedicationScheduleItem: Identifiable, Equatable {
    let medication: Medication
    let schedule: MedicationSchedule
    var dose: MedicationDose?

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
    var yesterdayStatus: DailyStatusLog?
    var shouldShowYesterdayPrompt: Bool = false
    var showNewEpisode = false
    var showLogMedication = false
    var isLoading = false
    var error: String?

    // MARK: - Dependencies

    private let episodeRepository: EpisodeRepositoryProtocol
    private let medicationRepository: MedicationRepositoryProtocol
    private let dailyStatusRepository: DailyStatusRepositoryProtocol
    private let categoryLimitRepository: CategoryUsageLimitRepositoryProtocol
    private let dailyCheckinService: DailyCheckinNotificationServiceProtocol

    // MARK: - Init

    init(
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        dailyStatusRepository: DailyStatusRepositoryProtocol = DailyStatusRepository(dbManager: DatabaseManager.shared),
        categoryLimitRepository: CategoryUsageLimitRepositoryProtocol = CategoryUsageLimitRepository(dbManager: DatabaseManager.shared),
        dailyCheckinService: DailyCheckinNotificationServiceProtocol = DailyCheckinNotificationService(
            notificationService: NotificationService.shared,
            scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
            episodeRepo: EpisodeRepository(dbManager: DatabaseManager.shared),
            dailyStatusRepo: DailyStatusRepository(dbManager: DatabaseManager.shared)
        )
    ) {
        self.episodeRepository = episodeRepository
        self.medicationRepository = medicationRepository
        self.dailyStatusRepository = dailyStatusRepository
        self.categoryLimitRepository = categoryLimitRepository
        self.dailyCheckinService = dailyCheckinService
    }

    // MARK: - Actions

    @MainActor
    func loadData() async {
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
            quantity: scheduleItem.schedule.dosage,
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
            let savedDose = try await medicationRepository.createDose(dose)
            if let index = todaysMedications.firstIndex(where: { $0.id == scheduleItem.id }) {
                todaysMedications[index].dose = savedDose
            }
            lastDoseByMedication[scheduleItem.medication.id] = savedDose
            // Refresh category usage so warnings update immediately.
            let categories = Set(todaysMedications.compactMap { $0.medication.category })
            categoryUsage = computeCategoryUsage(for: categories, now: Date())
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
            let savedDose = try await medicationRepository.createDose(dose)
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
            for schedule in schedules where schedule.enabled {
                let matchingDose = todayDoses.first { doseWithMed in
                    doseWithMed.medication.id == med.id
                }
                items.append(MedicationScheduleItem(
                    medication: med,
                    schedule: schedule,
                    dose: matchingDose?.dose
                ))
                if let category = med.category {
                    usedCategories.insert(category)
                }
            }
        }
        let usage = computeCategoryUsage(for: usedCategories, now: Date())
        await MainActor.run {
            lastDoseByMedication = lastDoses
            categoryUsage = usage
        }
        return items
    }

    /// Computes the `CategoryUsageStatus` map for the given categories. Categories
    /// without a configured limit are omitted.
    private func computeCategoryUsage(
        for categories: Set<MedicationCategory>,
        now: Date
    ) -> [MedicationCategory: CategoryUsageStatus] {
        var result: [MedicationCategory: CategoryUsageStatus] = [:]
        for category in categories {
            guard let configured = (try? categoryLimitRepository.getLimit(for: category)) ?? nil else {
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
