import Foundation
import GRDB

// MARK: - Implementation

final class ScheduledNotificationRepository: ScheduledNotificationRepositoryProtocol {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    func createNotification(_ notification: ScheduledNotification) throws -> ScheduledNotification {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO scheduled_notifications (id, medication_id, schedule_id, date, notification_id,
                        notification_type, is_grouped, group_key, source_type, medication_name,
                        scheduled_trigger_time, notification_title, notification_body,
                        category_identifier, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    notification.id,
                    notification.medicationId,
                    notification.scheduleId,
                    notification.date,
                    notification.notificationId,
                    notification.notificationType.rawValue,
                    notification.isGrouped ? 1 : 0,
                    notification.groupKey,
                    notification.sourceType.rawValue,
                    notification.medicationName,
                    notification.scheduledTriggerTime,
                    notification.notificationTitle,
                    notification.notificationBody,
                    notification.categoryIdentifier,
                    notification.createdAt
                ]
            )
        }
        return notification
    }

    func getByEntity(entityType: NotificationSourceType, entityId: String) throws -> [ScheduledNotification] {
        try dbManager.dbQueue.read { db in
            let sql: String
            switch entityType {
            case .medication:
                sql = """
                    SELECT * FROM scheduled_notifications
                    WHERE source_type = ? AND medication_id = ?
                    ORDER BY date ASC
                    """
            case .dailyCheckin:
                sql = """
                    SELECT * FROM scheduled_notifications
                    WHERE source_type = ?
                    ORDER BY date ASC
                    """
            }

            let arguments: StatementArguments
            switch entityType {
            case .medication:
                arguments = [entityType.rawValue, entityId]
            case .dailyCheckin:
                arguments = [entityType.rawValue]
            }

            let rows = try Row.fetchAll(db, sql: sql, arguments: arguments)
            return rows.map { Self.notificationFromRow($0) }
        }
    }

    func getAllPending() throws -> [ScheduledNotification] {
        let todayStr = TimestampHelper.dateString()
        return try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM scheduled_notifications
                    WHERE date >= ?
                    ORDER BY date ASC
                    """,
                arguments: [todayStr]
            )
            return rows.map { Self.notificationFromRow($0) }
        }
    }

    func deleteByNotificationId(_ notificationId: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM scheduled_notifications WHERE notification_id = ?",
                arguments: [notificationId]
            )
        }
    }

    func deleteByEntity(entityType: NotificationSourceType, entityId: String) throws {
        try dbManager.dbQueue.write { db in
            switch entityType {
            case .medication:
                try db.execute(
                    sql: "DELETE FROM scheduled_notifications WHERE source_type = ? AND medication_id = ?",
                    arguments: [entityType.rawValue, entityId]
                )
            case .dailyCheckin:
                try db.execute(
                    sql: "DELETE FROM scheduled_notifications WHERE source_type = ?",
                    arguments: [entityType.rawValue]
                )
            }
        }
    }

    func getByGroupKey(_ groupKey: String, date: String) throws -> [ScheduledNotification] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM scheduled_notifications
                    WHERE group_key = ? AND date = ?
                    ORDER BY medication_name ASC
                    """,
                arguments: [groupKey, date]
            )
            return rows.map { Self.notificationFromRow($0) }
        }
    }

    func getByNotificationId(_ notificationId: String) throws -> [ScheduledNotification] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM scheduled_notifications
                    WHERE notification_id = ?
                    ORDER BY medication_name ASC
                    """,
                arguments: [notificationId]
            )
            return rows.map { Self.notificationFromRow($0) }
        }
    }

    func getMapping(medicationId: String, scheduleId: String, date: String, notificationType: NotificationType) throws -> ScheduledNotification? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT * FROM scheduled_notifications
                    WHERE medication_id = ? AND schedule_id = ? AND date = ? AND notification_type = ?
                    LIMIT 1
                    """,
                arguments: [medicationId, scheduleId, date, notificationType.rawValue]
            )
            return row.map { Self.notificationFromRow($0) }
        }
    }

    func getMappingsBySchedule(medicationId: String, scheduleId: String) throws -> [ScheduledNotification] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM scheduled_notifications
                    WHERE medication_id = ? AND schedule_id = ?
                    ORDER BY date ASC
                    """,
                arguments: [medicationId, scheduleId]
            )
            return rows.map { Self.notificationFromRow($0) }
        }
    }

    func countBySchedule(medicationId: String, scheduleId: String) throws -> Int {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT COUNT(*) AS count FROM scheduled_notifications
                    WHERE medication_id = ? AND schedule_id = ?
                    """,
                arguments: [medicationId, scheduleId]
            )
            return row?["count"] ?? 0
        }
    }

    func getLastScheduledDate(medicationId: String, scheduleId: String) throws -> String? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT date FROM scheduled_notifications
                    WHERE medication_id = ? AND schedule_id = ?
                    ORDER BY date DESC LIMIT 1
                    """,
                arguments: [medicationId, scheduleId]
            )
            return row?["date"]
        }
    }

    func deleteById(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM scheduled_notifications WHERE id = ?",
                arguments: [id]
            )
        }
    }

    @discardableResult
    func deleteBeforeDate(_ date: String) throws -> Int {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM scheduled_notifications WHERE date < ?",
                arguments: [date]
            )
            return db.changesCount
        }
    }

    @discardableResult
    func deleteAllMedication() throws -> Int {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM scheduled_notifications WHERE source_type = 'medication'"
            )
            return db.changesCount
        }
    }

    // MARK: - Row Mapping

    static func notificationFromRow(_ row: Row) -> ScheduledNotification {
        ScheduledNotification(
            id: row["id"],
            medicationId: row["medication_id"],
            scheduleId: row["schedule_id"],
            date: row["date"],
            notificationId: row["notification_id"],
            notificationType: NotificationType(rawValue: row["notification_type"] ?? "reminder") ?? .reminder,
            isGrouped: (row["is_grouped"] as Int?) != nil && (row["is_grouped"] as Int) != 0,
            groupKey: row["group_key"],
            sourceType: NotificationSourceType(rawValue: row["source_type"] ?? "medication") ?? .medication,
            medicationName: row["medication_name"],
            scheduledTriggerTime: row["scheduled_trigger_time"],
            notificationTitle: row["notification_title"],
            notificationBody: row["notification_body"],
            categoryIdentifier: row["category_identifier"],
            createdAt: row["created_at"]
        )
    }
}
