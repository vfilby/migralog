import Foundation
import Observation

@Observable
final class DailyStatusViewModel {
    // MARK: - State

    var currentStatus: DailyStatusLog?
    var selectedStatus: DayStatus = .green
    var selectedType: YellowDayType?
    var notes: String = ""
    var isLoading = false
    var error: String?

    // MARK: - Dependencies

    private let dailyStatusRepository: DailyStatusRepositoryProtocol
    private let dailyCheckinService: DailyCheckinNotificationServiceProtocol

    // MARK: - Init

    init(
        dailyStatusRepository: DailyStatusRepositoryProtocol = DailyStatusRepository(dbManager: DatabaseManager.shared),
        dailyCheckinService: DailyCheckinNotificationServiceProtocol = DailyCheckinNotificationService(
            notificationService: NotificationService.shared,
            scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
            episodeRepo: EpisodeRepository(dbManager: DatabaseManager.shared),
            dailyStatusRepo: DailyStatusRepository(dbManager: DatabaseManager.shared)
        )
    ) {
        self.dailyStatusRepository = dailyStatusRepository
        self.dailyCheckinService = dailyCheckinService
    }

    // MARK: - Computed

    var hasExistingStatus: Bool { currentStatus != nil }

    // MARK: - Actions

    @MainActor
    func loadStatusForDate(_ date: Date) async {
        isLoading = true
        error = nil
        let dateString = TimestampHelper.dateString(from: date)
        do {
            let status = try await dailyStatusRepository.getStatusByDate(dateString)
            currentStatus = status
            if let status {
                selectedStatus = status.status
                selectedType = status.statusType
                notes = status.notes ?? ""
            } else {
                selectedStatus = .green
                selectedType = nil
                notes = ""
            }
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DailyStatusViewModel"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    @MainActor
    func logStatus(for date: Date) async {
        let dateString = TimestampHelper.dateString(from: date)
        let now = TimestampHelper.now
        let status = DailyStatusLog(
            id: UUID().uuidString,
            date: dateString,
            status: selectedStatus,
            statusType: selectedStatus == .yellow ? selectedType : nil,
            notes: notes.isEmpty ? nil : notes,
            prompted: false,
            createdAt: now,
            updatedAt: now
        )
        do {
            let saved = try await dailyStatusRepository.createStatus(status)
            currentStatus = saved
            // Cancel today's daily check-in notification and top up
            await dailyCheckinService.cancelForDate(dateString)
            await dailyCheckinService.topUp()
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DailyStatusViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func updateStatus() async {
        guard var existing = currentStatus else { return }
        existing.status = selectedStatus
        existing.statusType = selectedStatus == .yellow ? selectedType : nil
        existing.notes = notes.isEmpty ? nil : notes
        existing.updatedAt = TimestampHelper.now
        do {
            try await dailyStatusRepository.updateStatus(existing)
            currentStatus = existing
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DailyStatusViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func deleteStatus() async {
        guard let existing = currentStatus else { return }
        do {
            try await dailyStatusRepository.deleteStatus(existing.id)
            currentStatus = nil
            selectedStatus = .green
            selectedType = nil
            notes = ""
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "DailyStatusViewModel"])
            self.error = error.localizedDescription
        }
    }
}
