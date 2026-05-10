import Foundation

/// Single entry point for persisting a medication dose. Centralises the
/// side effects that must accompany a `createDose`, in particular cancelling
/// any pending reminder or follow-up notifications for the medication so
/// the user is not pinged for a dose they've already acted on. Every dose
/// logging path (dashboard, detail screen, log-medication sheet, and
/// notification action handler) goes through here so the cancellation can't
/// be forgotten when a new path is added.
protocol MedicationDoseLoggerProtocol: Sendable {
    @discardableResult
    func record(_ dose: MedicationDose) async throws -> MedicationDose
}

final class MedicationDoseLogger: MedicationDoseLoggerProtocol {
    private let medicationRepo: MedicationRepositoryProtocol
    private let notificationService: MedicationNotificationServiceProtocol

    init(
        medicationRepo: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        notificationService: MedicationNotificationServiceProtocol = MedicationNotificationScheduler(
            notificationService: NotificationService.shared,
            scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
            medicationRepo: MedicationRepository(dbManager: DatabaseManager.shared)
        )
    ) {
        self.medicationRepo = medicationRepo
        self.notificationService = notificationService
    }

    @discardableResult
    func record(_ dose: MedicationDose) async throws -> MedicationDose {
        let saved = try medicationRepo.createDose(dose)
        await notificationService.cancelTodaysReminders(medicationId: saved.medicationId)
        return saved
    }
}
