import Foundation
import Observation

@Observable
final class MedicationDetailViewModel {
    // MARK: - State

    var medication: Medication?
    var schedules: [MedicationSchedule] = []
    var recentDoses: [MedicationDose] = []
    var isLoading = false
    var error: String?

    // MARK: - Dependencies

    private let medicationRepository: MedicationRepositoryProtocol
    private let medicationNotificationService: MedicationNotificationServiceProtocol
    private var medicationId: String

    // MARK: - Init

    init(
        medicationId: String = "",
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        medicationNotificationService: MedicationNotificationServiceProtocol = MedicationNotificationScheduler(
            notificationService: NotificationService.shared,
            scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
            medicationRepo: MedicationRepository(dbManager: DatabaseManager.shared)
        )
    ) {
        self.medicationId = medicationId
        self.medicationRepository = medicationRepository
        self.medicationNotificationService = medicationNotificationService
    }

    // MARK: - Actions

    @MainActor
    func loadMedication() async {
        isLoading = true
        error = nil
        do {
            let details = try medicationRepository.getMedicationWithDetails(medicationId)
            medication = details?.medication
            schedules = details?.schedules ?? []
            recentDoses = details?.recentDoses ?? []
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel", "action": "loadMedication"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    /// Overload that accepts a medication ID.
    @MainActor
    func loadMedication(_ id: String) async {
        self.medicationId = id
        isLoading = true
        error = nil
        do {
            let details = try medicationRepository.getMedicationWithDetails(id)
            medication = details?.medication
            schedules = details?.schedules ?? []
            recentDoses = details?.recentDoses ?? []
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel", "action": "loadMedication"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    @MainActor
    func updateMedication(_ updated: Medication) async {
        do {
            _ = try medicationRepository.updateMedication(updated)
            medication = updated
            // Reschedule notifications when medication is updated
            await rescheduleNotifications(for: updated)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func logDoseNow() async {
        guard let med = medication else { return }
        let now = TimestampHelper.now
        let dose = MedicationDose(
            id: UUID().uuidString,
            medicationId: med.id,
            timestamp: now,
            quantity: med.defaultQuantity ?? 1.0,
            dosageAmount: med.dosageAmount,
            dosageUnit: med.dosageUnit,
            status: .taken,
            episodeId: nil,
            effectivenessRating: nil,
            timeToRelief: nil,
            sideEffects: [],
            notes: nil,
            createdAt: now,
            updatedAt: now
        )
        do {
            let saved = try await medicationRepository.createDose(dose)
            recentDoses.insert(saved, at: 0)

            // Cancel today's reminder and follow-up notifications for this medication
            let today = DateFormatting.dateString(from: Date())
            for schedule in schedules {
                await medicationNotificationService.cancelNotificationForDate(
                    medicationId: med.id,
                    scheduleId: schedule.id,
                    date: today,
                    notificationType: .reminder
                )
                await medicationNotificationService.cancelNotificationForDate(
                    medicationId: med.id,
                    scheduleId: schedule.id,
                    date: today,
                    notificationType: .followUp
                )
            }
            await medicationNotificationService.dismissMedicationNotification(
                medicationId: med.id,
                scheduleId: schedules.first?.id ?? ""
            )
            await medicationNotificationService.topUp()
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func archiveMedication() async {
        do {
            try await medicationRepository.archiveMedication(medicationId)
            medication?.active = false
            // Cancel reminders when medication is archived
            await medicationNotificationService.cancelMedicationReminders(for: medicationId)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func unarchiveMedication() async {
        do {
            try await medicationRepository.unarchiveMedication(medicationId)
            medication?.active = true
            // Reschedule reminders when medication is unarchived
            if let med = medication {
                await rescheduleNotifications(for: med)
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func deleteMedication() async -> Bool {
        do {
            // Cancel reminders before deleting the medication
            await medicationNotificationService.cancelMedicationReminders(for: medicationId)
            try await medicationRepository.deleteMedication(medicationId)
            return true
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
            return false
        }
    }

    @MainActor
    func deleteDose(_ id: String) async {
        do {
            try await medicationRepository.deleteDose(id)
            recentDoses.removeAll { $0.id == id }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func updateDose(_ dose: MedicationDose) async {
        do {
            try await medicationRepository.updateDose(dose)
            if let index = recentDoses.firstIndex(where: { $0.id == dose.id }) {
                recentDoses[index] = dose
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Schedule Management

    @MainActor
    func addSchedule(time: String, dosage: Double, reminderEnabled: Bool = true) async {
        let schedule = MedicationSchedule(
            id: UUID().uuidString,
            medicationId: medicationId,
            time: time,
            timezone: TimeZone.current.identifier,
            dosage: dosage,
            enabled: true,
            notificationId: nil,
            reminderEnabled: reminderEnabled
        )
        do {
            let saved = try await medicationRepository.createSchedule(schedule)
            schedules.append(saved)
            // Reschedule notifications after adding a new schedule
            if let med = medication {
                await rescheduleNotifications(for: med)
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func updateSchedule(_ schedule: MedicationSchedule) async {
        do {
            try await medicationRepository.updateSchedule(schedule)
            if let index = schedules.firstIndex(where: { $0.id == schedule.id }) {
                schedules[index] = schedule
            }
            // Reschedule notifications after updating a schedule
            if let med = medication {
                await rescheduleNotifications(for: med)
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func deleteSchedule(_ id: String) async {
        do {
            try await medicationRepository.deleteSchedule(id)
            schedules.removeAll { $0.id == id }
            // Reschedule notifications after deleting a schedule
            if let med = medication {
                await rescheduleNotifications(for: med)
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Notification Helpers

    @MainActor
    private func rescheduleNotifications(for medication: Medication) async {
        do {
            // Reschedule all medication notifications (handles grouping across all meds)
            try await medicationNotificationService.rescheduleAllMedicationNotifications()
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel", "action": "rescheduleNotifications"])
            AppLogger.shared.error("Failed to reschedule medication notifications", error: error)
        }
    }
}
