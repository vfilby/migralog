import Foundation
import UserNotifications

protocol NotificationReconciliationServiceProtocol: Sendable {
    func reconcile() async
}

final class NotificationReconciliationService: NotificationReconciliationServiceProtocol {
    private let notificationService: NotificationServiceProtocol
    private let scheduledNotificationRepo: ScheduledNotificationRepositoryProtocol
    private let logger = AppLogger.shared

    init(
        notificationService: NotificationServiceProtocol,
        scheduledNotificationRepo: ScheduledNotificationRepositoryProtocol
    ) {
        self.notificationService = notificationService
        self.scheduledNotificationRepo = scheduledNotificationRepo
    }

    func reconcile() async {
        do {
            // 1. Get OS pending notifications
            let osNotifications = await notificationService.getPendingNotifications()
            let osNotificationIds = Set(osNotifications.map(\.identifier))

            // 2. Get DB mappings
            let dbMappings = try scheduledNotificationRepo.getAllPending()

            // 3. Find orphaned DB mappings (in DB but not in OS) and delete from DB
            let orphanedDbMappings = dbMappings.filter { !osNotificationIds.contains($0.notificationId) }
            for mapping in orphanedDbMappings {
                do {
                    try scheduledNotificationRepo.deleteById(mapping.id)
                    logger.debug("Removed orphaned DB mapping: \(mapping.id) (notificationId: \(mapping.notificationId))")
                } catch {
                    logger.error("Failed to delete orphaned DB mapping \(mapping.id)", error: error)
                }
            }

            if !orphanedDbMappings.isEmpty {
                logger.info("Reconciliation: removed \(orphanedDbMappings.count) orphaned DB mappings")
            }

            // 4. Find orphaned OS notifications (in OS but not in DB, medication only) and cancel from OS
            let dbNotificationIds = Set(dbMappings.map(\.notificationId))
            for osNotification in osNotifications {
                let userInfo = osNotification.content.userInfo
                let isMedication =
                    userInfo["medicationId"] != nil ||
                    userInfo["medicationIds"] != nil

                guard isMedication else { continue }

                if !dbNotificationIds.contains(osNotification.identifier) {
                    notificationService.cancelNotification(id: osNotification.identifier)
                    logger.debug("Cancelled orphaned OS notification: \(osNotification.identifier)")
                }
            }

            // 5. Clean up past-date mappings
            let today = DateFormatting.dateString(from: Date())
            let deletedCount = try scheduledNotificationRepo.deleteBeforeDate(today)
            if deletedCount > 0 {
                logger.info("Reconciliation: cleaned up \(deletedCount) past-date mappings")
            }

            logger.info("Notification reconciliation complete")
        } catch {
            logger.error("Notification reconciliation failed", error: error)
        }
    }
}
