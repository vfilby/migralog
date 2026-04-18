import Foundation
import Observation

@Observable
final class MedicationDetailViewModel {
    // MARK: - State

    var medication: Medication?
    var schedules: [MedicationSchedule] = []
    var recentDoses: [MedicationDose] = []
    /// MOH-risk status for this medication's category (if any limit configured).
    var categoryStatus: CategoryUsageStatus = .noLimit
    var isLoading = false
    var error: String?

    /// Current cooldown status, derived from the medication's min-interval and the
    /// most recent dose in `recentDoses`. Recomputed on demand so it stays fresh
    /// after loadMedication / logDose / deleteDose without additional plumbing.
    var cooldownStatus: MedicationCooldown.Status {
        guard let med = medication else {
            return MedicationCooldown.Status(
                isOnCooldown: false,
                hoursSinceLastDose: nil,
                hoursUntilNextDose: 0,
                minIntervalHours: nil
            )
        }
        return MedicationCooldown.evaluate(medication: med, lastDose: recentDoses.first)
    }

    // MARK: - Dependencies

    private let medicationRepository: MedicationRepositoryProtocol
    private let medicationNotificationService: MedicationNotificationServiceProtocol
    private let categoryLimitRepository: CategoryUsageLimitRepositoryProtocol
    private var medicationId: String

    // MARK: - Init

    init(
        medicationId: String = "",
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        medicationNotificationService: MedicationNotificationServiceProtocol = MedicationNotificationScheduler(
            notificationService: NotificationService.shared,
            scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
            medicationRepo: MedicationRepository(dbManager: DatabaseManager.shared)
        ),
        categoryLimitRepository: CategoryUsageLimitRepositoryProtocol = CategoryUsageLimitRepository(dbManager: DatabaseManager.shared)
    ) {
        self.medicationId = medicationId
        self.medicationRepository = medicationRepository
        self.medicationNotificationService = medicationNotificationService
        self.categoryLimitRepository = categoryLimitRepository
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
            categoryStatus = computeCategoryStatus(for: medication, now: Date())
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
            categoryStatus = computeCategoryStatus(for: medication, now: Date())
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel", "action": "loadMedication"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    /// Computes category MOH status for the given medication (if it has a category
    /// and a configured limit). Returns `.noLimit` otherwise.
    private func computeCategoryStatus(for medication: Medication?, now: Date) -> CategoryUsageStatus {
        guard let category = medication?.category else { return .noLimit }
        guard let configured = (try? categoryLimitRepository.getLimit(for: category)) ?? nil else {
            return .noLimit
        }
        let daysUsed = (try? categoryLimitRepository.countUsageDays(
            category: category,
            windowDays: configured.windowDays,
            now: now
        )) ?? 0
        return CategoryUsageStatus.evaluate(daysUsed: daysUsed, limit: configured)
    }

    @MainActor
    func updateMedication(_ updated: Medication) async {
        do {
            let previous = medication
            _ = try medicationRepository.updateMedication(updated)
            medication = updated

            // If defaultQuantity changed, sync all schedules' dosage to match. The
            // dashboard "Today's Medications" card reads schedule.dosage for the
            // "Log N × Xmg" button, so schedules must track the medication's
            // default dose or the card will show a stale quantity (#399).
            if previous?.defaultQuantity != updated.defaultQuantity,
               let newQuantity = updated.defaultQuantity {
                var updatedSchedules: [MedicationSchedule] = []
                for schedule in schedules where schedule.dosage != newQuantity {
                    var next = schedule
                    next.dosage = newQuantity
                    _ = try medicationRepository.updateSchedule(next)
                    updatedSchedules.append(next)
                }
                // Reflect in local state
                for updatedSchedule in updatedSchedules {
                    if let index = schedules.firstIndex(where: { $0.id == updatedSchedule.id }) {
                        schedules[index] = updatedSchedule
                    }
                }
            }

            // Reschedule notifications when medication is updated
            await rescheduleNotifications(for: updated)

            // Notify dashboard/list views so they refresh cached medication and
            // schedule data (home card label, cooldown, etc.).
            NotificationCenter.default.post(name: .medicationDataChanged, object: nil)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func logDoseNow() async {
        guard let med = medication else { return }
        await logDose(
            quantity: med.defaultQuantity ?? 1.0,
            at: Date(),
            notes: nil
        )
    }

    /// Log a dose with explicit quantity, timestamp, and optional notes.
    /// Used by the "Log with Details…" flow so users can backdate or adjust amount.
    @MainActor
    func logDose(quantity: Double, at date: Date, notes: String?) async {
        guard let med = medication else { return }
        let now = TimestampHelper.now
        let timestamp = TimestampHelper.fromDate(date)
        let dose = MedicationDose(
            id: UUID().uuidString,
            medicationId: med.id,
            timestamp: timestamp,
            quantity: quantity,
            dosageAmount: med.dosageAmount,
            dosageUnit: med.dosageUnit,
            status: .taken,
            episodeId: nil,
            effectivenessRating: nil,
            timeToRelief: nil,
            sideEffects: [],
            notes: notes,
            createdAt: now,
            updatedAt: now
        )
        do {
            let saved = try await medicationRepository.createDose(dose)
            recentDoses.insert(saved, at: 0)
            recentDoses.sort { $0.timestamp > $1.timestamp }
            categoryStatus = computeCategoryStatus(for: medication, now: Date())

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
