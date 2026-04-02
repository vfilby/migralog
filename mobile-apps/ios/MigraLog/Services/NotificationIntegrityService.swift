import Foundation
import Sentry
import UserNotifications

enum NotificationDeviation: Sendable {
    case missingInOS(mappingId: String, notificationId: String)
    case missingInDB(osNotificationId: String)
    case orphanedMapping(mappingId: String, reason: String)
}

struct IntegrityVerificationResult: Sendable {
    let isConsistent: Bool
    let deviations: [NotificationDeviation]
    let dbMappingCount: Int
    let osNotificationCount: Int
}

protocol NotificationIntegrityServiceProtocol: Sendable {
    func verifyIntegrity() async -> IntegrityVerificationResult
    func quickHealthCheck() async -> Bool
}

final class NotificationIntegrityService: NotificationIntegrityServiceProtocol {
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

    func verifyIntegrity() async -> IntegrityVerificationResult {
        var deviations: [NotificationDeviation] = []

        // 1. Get OS pending notifications
        let osNotifications = await notificationService.getPendingNotifications()
        let osNotificationIds = Set(osNotifications.map(\.identifier))

        // 2. Get DB mappings
        let dbMappings: [ScheduledNotification]
        do {
            dbMappings = try scheduledNotificationRepo.getAllPending()
        } catch {
            logger.error("Integrity check failed: cannot read DB mappings", error: error)
            return IntegrityVerificationResult(
                isConsistent: false,
                deviations: [.orphanedMapping(mappingId: "unknown", reason: "DB read failed: \(error.localizedDescription)")],
                dbMappingCount: 0,
                osNotificationCount: osNotifications.count
            )
        }

        // 3. Find missingInOS: DB mappings where notificationId is not in OS pending set
        // Use unique notification IDs to avoid duplicate deviations for grouped notifications
        var checkedNotificationIds = Set<String>()
        for mapping in dbMappings {
            guard !checkedNotificationIds.contains(mapping.notificationId) else { continue }
            checkedNotificationIds.insert(mapping.notificationId)

            if !osNotificationIds.contains(mapping.notificationId) {
                deviations.append(.missingInOS(mappingId: mapping.id, notificationId: mapping.notificationId))
            }
        }

        // 4. Find missingInDB: OS notifications with medication userInfo that are not in DB
        let dbNotificationIds = Set(dbMappings.map(\.notificationId))
        for osNotification in osNotifications {
            let userInfo = osNotification.content.userInfo
            let isMedication =
                userInfo["medicationId"] != nil ||
                userInfo["medicationIds"] != nil

            guard isMedication else { continue }

            if !dbNotificationIds.contains(osNotification.identifier) {
                deviations.append(.missingInDB(osNotificationId: osNotification.identifier))
            }
        }

        // 5. Log deviations
        if deviations.isEmpty {
            logger.info("Integrity check passed: \(dbMappings.count) DB mappings, \(osNotifications.count) OS notifications")
        } else {
            logger.info("Integrity check found \(deviations.count) deviation(s)")
            for deviation in deviations {
                switch deviation {
                case .missingInOS(let mappingId, let notificationId):
                    logger.debug("Deviation: DB mapping \(mappingId) missing in OS (notificationId: \(notificationId))")
                case .missingInDB(let osNotificationId):
                    logger.debug("Deviation: OS notification \(osNotificationId) missing in DB")
                case .orphanedMapping(let mappingId, let reason):
                    logger.debug("Deviation: orphaned mapping \(mappingId) - \(reason)")
                }
            }
        }

        let result = IntegrityVerificationResult(
            isConsistent: deviations.isEmpty,
            deviations: deviations,
            dbMappingCount: dbMappings.count,
            osNotificationCount: osNotifications.count
        )

        if !result.isConsistent {
            SentrySDK.capture(message: "Notification integrity deviations detected") { scope in
                scope.setExtra(value: result.deviations.count, key: "deviationCount")
                scope.setExtra(value: result.dbMappingCount, key: "dbMappingCount")
                scope.setExtra(value: result.osNotificationCount, key: "osNotificationCount")
                scope.setLevel(.warning)
            }
        }

        return result
    }

    func quickHealthCheck() async -> Bool {
        let osNotifications = await notificationService.getPendingNotifications()

        // Count only medication-related OS notifications
        let osMedicationCount = osNotifications.filter { notification in
            let userInfo = notification.content.userInfo
            return userInfo["medicationId"] != nil || userInfo["medicationIds"] != nil
        }.count

        let dbMappings: [ScheduledNotification]
        do {
            dbMappings = try scheduledNotificationRepo.getAllPending()
        } catch {
            logger.error("Quick health check failed: cannot read DB", error: error)
            return false
        }

        // Get unique notification IDs from DB (grouped notifications share one OS notification)
        let uniqueDbNotificationIds = Set(dbMappings.map(\.notificationId))

        let isHealthy = uniqueDbNotificationIds.count == osMedicationCount
        if !isHealthy {
            logger.info("Quick health check: mismatch - \(uniqueDbNotificationIds.count) unique DB notification IDs vs \(osMedicationCount) OS medication notifications")
        }
        return isHealthy
    }
}
