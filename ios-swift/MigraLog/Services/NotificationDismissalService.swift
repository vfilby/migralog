import Foundation

struct DismissalResult: Sendable {
    let shouldDismiss: Bool
    let context: String
}

protocol NotificationDismissalServiceProtocol: Sendable {
    func shouldDismissNotification(
        notificationId: String,
        targetMedicationId: String,
        targetScheduleId: String
    ) throws -> DismissalResult
}

final class NotificationDismissalService: NotificationDismissalServiceProtocol {
    private let scheduledNotificationRepo: ScheduledNotificationRepositoryProtocol
    private let medicationRepo: MedicationRepositoryProtocol
    private let logger = AppLogger.shared

    init(
        scheduledNotificationRepo: ScheduledNotificationRepositoryProtocol,
        medicationRepo: MedicationRepositoryProtocol
    ) {
        self.scheduledNotificationRepo = scheduledNotificationRepo
        self.medicationRepo = medicationRepo
    }

    func shouldDismissNotification(
        notificationId: String,
        targetMedicationId: String,
        targetScheduleId: String
    ) throws -> DismissalResult {
        // 1. Look up mappings by notificationId
        let mappings: [ScheduledNotification]
        do {
            mappings = try scheduledNotificationRepo.getByNotificationId(notificationId)
        } catch {
            logger.error("Failed to look up mappings for notification \(notificationId)", error: error)
            return DismissalResult(shouldDismiss: false, context: "DB lookup failed")
        }

        guard !mappings.isEmpty else {
            return DismissalResult(shouldDismiss: false, context: "No DB mapping found")
        }

        // 2. Find exact match for target medication/schedule
        guard mappings.contains(where: { $0.medicationId == targetMedicationId && $0.scheduleId == targetScheduleId }) else {
            return DismissalResult(shouldDismiss: false, context: "No matching medication in notification")
        }

        // 3. If grouped (multiple mappings and first is marked grouped): check all meds in group
        if mappings.count > 1, mappings.first?.isGrouped == true {
            let today = DateFormatting.dateString(from: Date())
            do {
                for mapping in mappings {
                    guard let medicationId = mapping.medicationId else {
                        return DismissalResult(shouldDismiss: false, context: "Grouped mapping missing medicationId")
                    }
                    let logged = try medicationRepo.wasLoggedForScheduleToday(
                        medicationId: medicationId,
                        date: today
                    )
                    if !logged {
                        logger.debug("Grouped notification \(notificationId): medication \(medicationId) not yet logged")
                        return DismissalResult(
                            shouldDismiss: false,
                            context: "Not all medications in group are logged (pending: \(medicationId))"
                        )
                    }
                }
                logger.info("All medications in grouped notification \(notificationId) are logged, dismissing")
                return DismissalResult(shouldDismiss: true, context: "All grouped medications logged")
            } catch {
                logger.error("Error checking grouped medication status for notification \(notificationId)", error: error)
                return DismissalResult(shouldDismiss: false, context: "Error checking group status")
            }
        }

        // 4. Single notification: dismiss directly
        logger.debug("Single notification \(notificationId) matched, dismissing")
        return DismissalResult(shouldDismiss: true, context: "Single medication matched")
    }
}
