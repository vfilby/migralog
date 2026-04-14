import Foundation
import GRDB

// MARK: - Implementation

final class MedicationRepository: MedicationRepositoryProtocol {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    // MARK: - Medication CRUD

    func createMedication(_ medication: Medication) throws -> Medication {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity,
                        schedule_frequency, photo_uri, active, notes, category, created_at, updated_at,
                        min_interval_hours)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    medication.id,
                    medication.name,
                    medication.type.rawValue,
                    medication.dosageAmount,
                    medication.dosageUnit,
                    medication.defaultQuantity,
                    medication.scheduleFrequency?.rawValue,
                    medication.photoUri,
                    medication.active ? 1 : 0,
                    medication.notes,
                    medication.category?.rawValue,
                    medication.createdAt,
                    medication.updatedAt,
                    medication.minIntervalHours
                ]
            )
        }
        return medication
    }

    func getMedicationById(_ id: String) throws -> Medication? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(db, sql: "SELECT * FROM medications WHERE id = ?", arguments: [id])
            return row.map { Self.medicationFromRow($0) }
        }
    }

    func getAllMedications() throws -> [Medication] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: "SELECT * FROM medications ORDER BY name ASC")
            return rows.map { Self.medicationFromRow($0) }
        }
    }

    func getActiveMedications() throws -> [Medication] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM medications WHERE active = 1 ORDER BY name ASC"
            )
            return rows.map { Self.medicationFromRow($0) }
        }
    }

    func getArchivedMedications() throws -> [Medication] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM medications WHERE active = 0 ORDER BY name ASC"
            )
            return rows.map { Self.medicationFromRow($0) }
        }
    }

    func updateMedication(_ medication: Medication) throws -> Medication {
        let now = TimestampHelper.now
        var updated = medication
        updated.updatedAt = now
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE medications SET
                        name = ?, type = ?, dosage_amount = ?, dosage_unit = ?,
                        default_quantity = ?, schedule_frequency = ?, photo_uri = ?,
                        active = ?, notes = ?, category = ?, updated_at = ?,
                        min_interval_hours = ?
                    WHERE id = ?
                    """,
                arguments: [
                    updated.name,
                    updated.type.rawValue,
                    updated.dosageAmount,
                    updated.dosageUnit,
                    updated.defaultQuantity,
                    updated.scheduleFrequency?.rawValue,
                    updated.photoUri,
                    updated.active ? 1 : 0,
                    updated.notes,
                    updated.category?.rawValue,
                    updated.updatedAt,
                    updated.minIntervalHours,
                    updated.id
                ]
            )
        }
        return updated
    }

    func archiveMedication(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "UPDATE medications SET active = 0, updated_at = ? WHERE id = ?",
                arguments: [TimestampHelper.now, id]
            )
        }
    }

    func unarchiveMedication(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "UPDATE medications SET active = 1, updated_at = ? WHERE id = ?",
                arguments: [TimestampHelper.now, id]
            )
        }
    }

    func deleteMedication(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM medications WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Dose CRUD

    func createDose(_ dose: MedicationDose) throws -> MedicationDose {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO medication_doses (id, medication_id, timestamp, quantity, dosage_amount,
                        dosage_unit, status, episode_id, effectiveness_rating, time_to_relief,
                        side_effects, notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    dose.id,
                    dose.medicationId,
                    dose.timestamp,
                    dose.quantity,
                    dose.dosageAmount,
                    dose.dosageUnit,
                    dose.status.rawValue,
                    dose.episodeId,
                    dose.effectivenessRating,
                    dose.timeToRelief,
                    JSONHelper.encode(dose.sideEffects),
                    dose.notes,
                    dose.createdAt,
                    dose.updatedAt
                ]
            )
        }
        return dose
    }

    func getLastDose(medicationId: String) throws -> MedicationDose? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: "SELECT * FROM medication_doses WHERE medication_id = ? AND status = 'taken' ORDER BY timestamp DESC LIMIT 1",
                arguments: [medicationId]
            )
            return row.map { Self.doseFromRow($0) }
        }
    }

    func getDosesByMedicationId(_ medicationId: String) throws -> [MedicationDose] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM medication_doses WHERE medication_id = ? ORDER BY timestamp DESC",
                arguments: [medicationId]
            )
            return rows.map { Self.doseFromRow($0) }
        }
    }

    func getDosesByEpisodeId(_ episodeId: String) throws -> [MedicationDose] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM medication_doses WHERE episode_id = ? ORDER BY timestamp DESC",
                arguments: [episodeId]
            )
            return rows.map { Self.doseFromRow($0) }
        }
    }

    func getDosesByDateRange(start: Int64, end: Int64) throws -> [MedicationDose] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM medication_doses
                    WHERE timestamp >= ? AND timestamp <= ?
                    ORDER BY timestamp DESC
                    """,
                arguments: [start, end]
            )
            return rows.map { Self.doseFromRow($0) }
        }
    }

    func getMedicationUsageCounts(start: Int64, end: Int64) throws -> [String: Int] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT medication_id, COUNT(*) as count
                    FROM medication_doses
                    WHERE timestamp >= ? AND timestamp <= ? AND status = 'taken'
                    GROUP BY medication_id
                    """,
                arguments: [start, end]
            )
            var result: [String: Int] = [:]
            for row in rows {
                let medId: String = row["medication_id"]
                let count: Int = row["count"]
                result[medId] = count
            }
            return result
        }
    }

    func getActiveMedicationsWithUsageCounts() throws -> [(medication: Medication, usageCount: Int)] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT m.*, COALESCE(d.usage_count, 0) AS usage_count
                    FROM medications m
                    LEFT JOIN (
                        SELECT medication_id, COUNT(*) AS usage_count
                        FROM medication_doses
                        WHERE status = 'taken'
                        GROUP BY medication_id
                    ) d ON m.id = d.medication_id
                    WHERE m.active = 1
                    ORDER BY m.name ASC
                    """
            )
            return rows.map { row in
                let medication = Self.medicationFromRow(row)
                let usageCount: Int = row["usage_count"]
                return (medication: medication, usageCount: usageCount)
            }
        }
    }

    func updateDose(_ dose: MedicationDose) throws -> MedicationDose {
        let now = TimestampHelper.now
        var updated = dose
        updated.updatedAt = now
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE medication_doses SET
                        timestamp = ?, quantity = ?, dosage_amount = ?, dosage_unit = ?,
                        status = ?, episode_id = ?, effectiveness_rating = ?, time_to_relief = ?,
                        side_effects = ?, notes = ?, updated_at = ?
                    WHERE id = ?
                    """,
                arguments: [
                    updated.timestamp,
                    updated.quantity,
                    updated.dosageAmount,
                    updated.dosageUnit,
                    updated.status.rawValue,
                    updated.episodeId,
                    updated.effectivenessRating,
                    updated.timeToRelief,
                    JSONHelper.encode(updated.sideEffects),
                    updated.notes,
                    updated.updatedAt,
                    updated.id
                ]
            )
        }
        return updated
    }

    func deleteDose(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM medication_doses WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Notification Helpers

    func wasLoggedForScheduleToday(medicationId: String, date: String) throws -> Bool {
        guard let dayStart = TimestampHelper.dateFromString(date) else { return false }
        guard let dayEnd = Calendar.current.date(byAdding: .day, value: 1, to: dayStart) else { return false }
        let startTs = TimestampHelper.fromDate(dayStart)
        let endTs = TimestampHelper.fromDate(dayEnd)
        return try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT COUNT(*) AS count FROM medication_doses
                    WHERE medication_id = ? AND timestamp >= ? AND timestamp < ?
                    AND status = 'taken'
                    """,
                arguments: [medicationId, startTs, endTs]
            )
            let count: Int = row?["count"] ?? 0
            return count > 0
        }
    }

    // MARK: - Schedule CRUD

    func createSchedule(_ schedule: MedicationSchedule) throws -> MedicationSchedule {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage,
                        enabled, notification_id, reminder_enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    schedule.id,
                    schedule.medicationId,
                    schedule.time,
                    schedule.timezone,
                    schedule.dosage,
                    schedule.enabled ? 1 : 0,
                    schedule.notificationId,
                    schedule.reminderEnabled ? 1 : 0
                ]
            )
        }
        return schedule
    }

    func getSchedulesByMedicationId(_ medicationId: String) throws -> [MedicationSchedule] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM medication_schedules WHERE medication_id = ? ORDER BY time ASC",
                arguments: [medicationId]
            )
            return rows.map { Self.scheduleFromRow($0) }
        }
    }

    func getSchedulesByMultipleMedicationIds(_ medicationIds: [String]) throws -> [String: [MedicationSchedule]] {
        guard !medicationIds.isEmpty else { return [:] }
        let placeholders = medicationIds.map { _ in "?" }.joined(separator: ", ")
        return try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM medication_schedules WHERE medication_id IN (\(placeholders)) ORDER BY time ASC",
                arguments: StatementArguments(medicationIds)
            )
            var result: [String: [MedicationSchedule]] = [:]
            for row in rows {
                let schedule = Self.scheduleFromRow(row)
                result[schedule.medicationId, default: []].append(schedule)
            }
            return result
        }
    }

    func updateSchedule(_ schedule: MedicationSchedule) throws -> MedicationSchedule {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE medication_schedules SET
                        time = ?, timezone = ?, dosage = ?, enabled = ?,
                        notification_id = ?, reminder_enabled = ?
                    WHERE id = ?
                    """,
                arguments: [
                    schedule.time,
                    schedule.timezone,
                    schedule.dosage,
                    schedule.enabled ? 1 : 0,
                    schedule.notificationId,
                    schedule.reminderEnabled ? 1 : 0,
                    schedule.id
                ]
            )
        }
        return schedule
    }

    func deleteSchedule(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM medication_schedules WHERE id = ?", arguments: [id])
        }
    }

    /// Total enabled medication schedules. Used by TimezoneChangeService to decide
    /// whether a timezone-change prompt is warranted.
    func countAllSchedules() throws -> Int {
        try dbManager.dbQueue.read { db in
            try Int.fetchOne(
                db,
                sql: "SELECT COUNT(*) FROM medication_schedules WHERE enabled = 1"
            ) ?? 0
        }
    }

    // MARK: - Row Mapping

    static func medicationFromRow(_ row: Row) -> Medication {
        Medication(
            id: row["id"],
            name: row["name"],
            type: MedicationType(rawValue: row["type"]) ?? .other,
            dosageAmount: row["dosage_amount"],
            dosageUnit: row["dosage_unit"],
            defaultQuantity: row["default_quantity"],
            scheduleFrequency: (row["schedule_frequency"] as String?).flatMap { ScheduleFrequency(rawValue: $0) },
            photoUri: row["photo_uri"],
            active: (row["active"] as Int) != 0,
            notes: row["notes"],
            category: (row["category"] as String?).flatMap { MedicationCategory(rawValue: $0) },
            minIntervalHours: row["min_interval_hours"],
            createdAt: row["created_at"],
            updatedAt: row["updated_at"]
        )
    }

    static func doseFromRow(_ row: Row) -> MedicationDose {
        MedicationDose(
            id: row["id"],
            medicationId: row["medication_id"],
            timestamp: row["timestamp"],
            quantity: row["quantity"],
            dosageAmount: row["dosage_amount"],
            dosageUnit: row["dosage_unit"],
            status: DoseStatus(rawValue: row["status"] ?? "taken") ?? .taken,
            episodeId: row["episode_id"],
            effectivenessRating: row["effectiveness_rating"],
            timeToRelief: row["time_to_relief"],
            sideEffects: JSONHelper.decodeArray(String.self, from: row["side_effects"] as String?),
            notes: row["notes"],
            createdAt: row["created_at"],
            updatedAt: row["updated_at"]
        )
    }

    static func scheduleFromRow(_ row: Row) -> MedicationSchedule {
        MedicationSchedule(
            id: row["id"],
            medicationId: row["medication_id"],
            time: row["time"],
            timezone: row["timezone"],
            dosage: row["dosage"],
            enabled: (row["enabled"] as Int) != 0,
            notificationId: row["notification_id"],
            reminderEnabled: (row["reminder_enabled"] as Int) != 0
        )
    }
}
