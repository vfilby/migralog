import Foundation
import GRDB

// MARK: - Errors

enum BackupError: Error, Equatable {
    case backupDirectoryCreationFailed
    case databaseCopyFailed(String)
    case metadataWriteFailed
    case backupNotFound
    case invalidBackup(String)
    case restoreFailed(String)
    case deleteFailed(String)
}

// MARK: - Protocol

protocol BackupServiceProtocol {
    func createBackup(
        dbManager: DatabaseManager,
        episodeCount: Int,
        medicationCount: Int
    ) throws -> BackupMetadata
    func listBackups() throws -> [BackupMetadata]
    func deleteBackup(id: String) throws
    func restoreFromBackup(path: String, dbManager: DatabaseManager) throws
    func validateBackup(path: String) -> Bool
}

// MARK: - Implementation

final class BackupService: BackupServiceProtocol {
    private let fileManager: FileManager
    private let logger = AppLogger.shared

    /// App version for backup metadata
    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    // MARK: - Backup Directory

    private func backupDirectoryURL() throws -> URL {
        let documentsURL = try fileManager.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let backupDir = documentsURL.appendingPathComponent("backups", isDirectory: true)

        if !fileManager.fileExists(atPath: backupDir.path) {
            do {
                try fileManager.createDirectory(at: backupDir, withIntermediateDirectories: true)
            } catch {
                logger.error("Failed to create backup directory", error: error)
                throw BackupError.backupDirectoryCreationFailed
            }
        }

        return backupDir
    }

    // MARK: - Create Backup

    func createBackup(
        dbManager: DatabaseManager,
        episodeCount: Int,
        medicationCount: Int
    ) throws -> BackupMetadata {
        let backupDir = try backupDirectoryURL()
        let backupId = UUID().uuidString
        let timestamp = TimestampHelper.now
        let fileName = "migralog_backup_\(backupId).db"
        let dbPath = backupDir.appendingPathComponent(fileName).path

        // Copy the database file
        do {
            try dbManager.copyDatabase(to: dbPath)
        } catch {
            logger.error("Failed to copy database for backup", error: error)
            throw BackupError.databaseCopyFailed(error.localizedDescription)
        }

        // Get file size
        let fileSize: Int64
        if let attrs = try? fileManager.attributesOfItem(atPath: dbPath),
           let size = attrs[.size] as? Int64 {
            fileSize = size
        } else {
            fileSize = 0
        }

        // Create metadata
        let metadata = BackupMetadata(
            id: backupId,
            timestamp: timestamp,
            version: appVersion,
            schemaVersion: DatabaseManager.schemaVersion,
            episodeCount: episodeCount,
            medicationCount: medicationCount,
            fileSize: fileSize,
            fileName: fileName,
            backupType: "manual"
        )

        // Write metadata sidecar
        let metaFileName = "migralog_backup_\(backupId).meta.json"
        let metaPath = backupDir.appendingPathComponent(metaFileName)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let metaData = try encoder.encode(metadata)

        do {
            try metaData.write(to: metaPath)
        } catch {
            // Clean up the db file if metadata fails
            try? fileManager.removeItem(atPath: dbPath)
            logger.error("Failed to write backup metadata", error: error)
            throw BackupError.metadataWriteFailed
        }

        logger.info("Created backup: \(backupId) (\(episodeCount) episodes, \(medicationCount) medications)")
        return metadata
    }

    // MARK: - List Backups

    func listBackups() throws -> [BackupMetadata] {
        let backupDir = try backupDirectoryURL()

        let contents = try fileManager.contentsOfDirectory(
            at: backupDir,
            includingPropertiesForKeys: nil
        )

        let metaFiles = contents.filter { $0.pathExtension == "json" && $0.lastPathComponent.hasSuffix(".meta.json") }

        let decoder = JSONDecoder()
        var backups: [BackupMetadata] = []

        for metaFile in metaFiles {
            if let data = try? Data(contentsOf: metaFile),
               let metadata = try? decoder.decode(BackupMetadata.self, from: data) {
                backups.append(metadata)
            } else {
                logger.warn("Failed to read backup metadata: \(metaFile.lastPathComponent)")
            }
        }

        // Sort by timestamp descending (newest first)
        return backups.sorted { $0.timestamp > $1.timestamp }
    }

    // MARK: - Delete Backup

    func deleteBackup(id: String) throws {
        let backupDir = try backupDirectoryURL()
        let dbFile = backupDir.appendingPathComponent("migralog_backup_\(id).db")
        let metaFile = backupDir.appendingPathComponent("migralog_backup_\(id).meta.json")

        var errors: [String] = []

        if fileManager.fileExists(atPath: dbFile.path) {
            do {
                try fileManager.removeItem(at: dbFile)
            } catch {
                errors.append("db: \(error.localizedDescription)")
            }
        }

        if fileManager.fileExists(atPath: metaFile.path) {
            do {
                try fileManager.removeItem(at: metaFile)
            } catch {
                errors.append("meta: \(error.localizedDescription)")
            }
        }

        if !errors.isEmpty {
            throw BackupError.deleteFailed(errors.joined(separator: "; "))
        }

        logger.info("Deleted backup: \(id)")
    }

    // MARK: - Restore

    func restoreFromBackup(path: String, dbManager: DatabaseManager) throws {
        guard fileManager.fileExists(atPath: path) else {
            throw BackupError.backupNotFound
        }

        guard validateBackup(path: path) else {
            throw BackupError.invalidBackup("Backup validation failed")
        }

        // Verify the backup database can be opened and has the expected tables
        do {
            let backupDb = try DatabaseManager(path: path)
            // Verify we can read from it by checking tables exist
            try backupDb.dbQueue.read { db in
                _ = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes")
                _ = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medications")
            }
        } catch {
            throw BackupError.invalidBackup("Cannot read backup database: \(error.localizedDescription)")
        }

        // Reset existing database and copy data
        do {
            try dbManager.resetDatabase()
            // Copy data from backup into current database
            let backupDb = try DatabaseManager(path: path)
            try restoreData(from: backupDb, to: dbManager)
        } catch let error as BackupError {
            throw error
        } catch {
            throw BackupError.restoreFailed(error.localizedDescription)
        }

        logger.info("Restored database from backup: \(path)")
    }

    // MARK: - Validate

    func validateBackup(path: String) -> Bool {
        guard fileManager.fileExists(atPath: path) else {
            return false
        }

        // Check file is not empty
        guard let attrs = try? fileManager.attributesOfItem(atPath: path),
              let size = attrs[.size] as? Int64,
              size > 0 else {
            return false
        }

        // Try to open as SQLite database
        do {
            let db = try DatabaseManager(path: path)
            try db.dbQueue.read { db in
                // Verify key tables exist
                let tables = try String.fetchAll(db, sql: """
                    SELECT name FROM sqlite_master WHERE type='table'
                    AND name IN ('episodes', 'medications', 'daily_status_logs')
                """)
                return tables.count == 3
            }
            return true
        } catch {
            logger.warn("Backup validation failed: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Private Helpers

    /// Ensures a timestamp column value satisfies CHECK(col > 0).
    /// Falls back to created_at, then current time.
    private func sanitizeTimestamp(_ row: Row, column: String, fallback: String = "created_at") -> DatabaseValue {
        if let value = row[column] as? Int64, value > 0 {
            return value.databaseValue
        }
        if let fallbackValue = row[fallback] as? Int64, fallbackValue > 0 {
            return fallbackValue.databaseValue
        }
        return Int64(Date().timeIntervalSince1970 * 1000).databaseValue
    }

    private func restoreData(from source: DatabaseManager, to destination: DatabaseManager) throws {
        try source.dbQueue.read { sourceDb in
            try destination.dbQueue.write { destDb in
                // Restore episodes
                let episodeRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM episodes")
                for row in episodeRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO episodes (id, start_time, end_time, locations, qualities,
                                symptoms, triggers, notes, latitude, longitude, location_accuracy,
                                location_timestamp, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["start_time"], row["end_time"],
                            row["locations"], row["qualities"], row["symptoms"],
                            row["triggers"], row["notes"], row["latitude"],
                            row["longitude"], row["location_accuracy"],
                            row["location_timestamp"], row["created_at"], sanitizeTimestamp(row, column: "updated_at")
                        ]
                    )
                }

                // Restore medications
                let medRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM medications")
                for row in medRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO medications (id, name, type, dosage_amount, dosage_unit,
                                default_quantity, schedule_frequency, photo_uri, active, notes,
                                category, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["name"], row["type"], row["dosage_amount"],
                            row["dosage_unit"], row["default_quantity"], row["schedule_frequency"],
                            row["photo_uri"], row["active"], row["notes"], row["category"],
                            row["created_at"], sanitizeTimestamp(row, column: "updated_at")
                        ]
                    )
                }

                // Restore intensity readings
                let readingRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM intensity_readings")
                for row in readingRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO intensity_readings (id, episode_id, timestamp, intensity,
                                created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["episode_id"], row["timestamp"],
                            row["intensity"], row["created_at"], sanitizeTimestamp(row, column: "updated_at")
                        ]
                    )
                }

                // Restore symptom logs
                let symptomRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM symptom_logs")
                for row in symptomRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO symptom_logs (id, episode_id, symptom, onset_time,
                                resolution_time, severity, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["episode_id"], row["symptom"],
                            row["onset_time"], row["resolution_time"],
                            row["severity"], row["created_at"]
                        ]
                    )
                }

                // Restore pain location logs
                let painRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM pain_location_logs")
                for row in painRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO pain_location_logs (id, episode_id, timestamp,
                                pain_locations, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["episode_id"], row["timestamp"],
                            row["pain_locations"], row["created_at"], sanitizeTimestamp(row, column: "updated_at")
                        ]
                    )
                }

                // Restore episode notes
                let noteRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM episode_notes")
                for row in noteRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO episode_notes (id, episode_id, timestamp, note, created_at)
                            VALUES (?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["episode_id"], row["timestamp"],
                            row["note"], row["created_at"]
                        ]
                    )
                }

                // Restore medication schedules
                let scheduleRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM medication_schedules")
                for row in scheduleRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO medication_schedules (id, medication_id, time, timezone,
                                dosage, enabled, notification_id, reminder_enabled)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["medication_id"], row["time"],
                            row["timezone"], row["dosage"], row["enabled"],
                            row["notification_id"], row["reminder_enabled"]
                        ]
                    )
                }

                // Restore medication doses
                let doseRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM medication_doses")
                for row in doseRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO medication_doses (id, medication_id, timestamp, quantity,
                                dosage_amount, dosage_unit, status, episode_id, effectiveness_rating,
                                time_to_relief, side_effects, notes, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["medication_id"], row["timestamp"],
                            row["quantity"], row["dosage_amount"], row["dosage_unit"],
                            row["status"], row["episode_id"], row["effectiveness_rating"],
                            row["time_to_relief"], row["side_effects"], row["notes"],
                            row["created_at"], sanitizeTimestamp(row, column: "updated_at")
                        ]
                    )
                }

                // Restore daily status logs
                let statusRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM daily_status_logs")
                for row in statusRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO daily_status_logs (id, date, status, status_type, notes,
                                prompted, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["date"], row["status"], row["status_type"],
                            row["notes"], row["prompted"], row["created_at"], sanitizeTimestamp(row, column: "updated_at")
                        ]
                    )
                }

                // Restore calendar overlays
                let overlayRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM calendar_overlays")
                for row in overlayRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO calendar_overlays (id, start_date, end_date, label, notes,
                                exclude_from_stats, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["start_date"], row["end_date"],
                            row["label"], row["notes"], row["exclude_from_stats"],
                            row["created_at"], sanitizeTimestamp(row, column: "updated_at")
                        ]
                    )
                }

                // Restore medication reminders
                let reminderRows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM medication_reminders")
                for row in reminderRows {
                    try destDb.execute(
                        sql: """
                            INSERT INTO medication_reminders (id, medication_id, scheduled_time,
                                completed, snoozed_until, completed_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            row["id"], row["medication_id"], row["scheduled_time"],
                            row["completed"], row["snoozed_until"], row["completed_at"]
                        ]
                    )
                }
            }
        }
    }
}
