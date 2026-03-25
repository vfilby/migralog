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
    var todaysMedications: [MedicationScheduleItem] = []
    var yesterdayStatus: DailyStatusLog?
    var showNewEpisode = false
    var showLogMedication = false
    var isLoading = false
    var error: String?

    // MARK: - Dependencies

    private let episodeRepository: EpisodeRepositoryProtocol
    private let medicationRepository: MedicationRepositoryProtocol
    private let dailyStatusRepository: DailyStatusRepositoryProtocol
    private let dailyCheckinService: DailyCheckinNotificationServiceProtocol

    // MARK: - Init

    init(
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        dailyStatusRepository: DailyStatusRepositoryProtocol = DailyStatusRepository(dbManager: DatabaseManager.shared),
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
        self.dailyCheckinService = dailyCheckinService
    }

    // MARK: - Actions

    @MainActor
    func loadData() async {
        isLoading = true
        error = nil
        do {
            async let episodeTask = episodeRepository.getCurrentEpisode()
            async let medsTask = loadTodaysMedications()
            async let statusTask = loadYesterdayStatus()

            currentEpisode = try await episodeTask
            todaysMedications = try await medsTask
            yesterdayStatus = try await statusTask
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
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DashboardViewModel", "action": "undoYesterdayStatus"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Private

    private func loadTodaysMedications() async throws -> [MedicationScheduleItem] {
        let activeMeds = try await medicationRepository.getActiveMedications()
        let today = TimestampHelper.dateString()
        let todayDoses = try await medicationRepository.getDosesWithMedications(date: today)

        var items: [MedicationScheduleItem] = []
        for med in activeMeds {
            let schedules = try await medicationRepository.getSchedules(medicationId: med.id)
            for schedule in schedules where schedule.enabled {
                let matchingDose = todayDoses.first { doseWithMed in
                    doseWithMed.medication.id == med.id
                }
                items.append(MedicationScheduleItem(
                    medication: med,
                    schedule: schedule,
                    dose: matchingDose?.dose
                ))
            }
        }
        return items
    }

    private func loadYesterdayStatus() async throws -> DailyStatusLog? {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let dateString = TimestampHelper.dateString(from: yesterday)
        return try await dailyStatusRepository.getStatusByDate(dateString)
    }
}
