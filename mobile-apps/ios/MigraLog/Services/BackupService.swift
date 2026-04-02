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
            try backupDb.dbQueue.read { db in
                // Log tables found for debugging
                let tables = try String.fetchAll(db, sql: """
                    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
                """)
                self.logger.info("Backup contains tables: \(tables.joined(separator: ", "))")

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
            let hasRequiredTables = try db.dbQueue.read { db -> Bool in
                // Verify key tables exist
                let tables = try String.fetchAll(db, sql: """
                    SELECT name FROM sqlite_master WHERE type='table'
                    AND name IN ('episodes', 'medications', 'daily_status_logs')
                """)
                return tables.count == 3
            }
            return hasRequiredTables
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

    /// Get column names for a table in the given database
    private func columnNames(for table: String, in db: Database) throws -> Set<String> {
        let rows = try Row.fetchAll(db, sql: "PRAGMA table_info(\(table))")
        return Set(rows.map { $0["name"] as String })
    }

    /// Check if a table exists in the given database
    private func tableExists(_ table: String, in db: Database) throws -> Bool {
        let count = try Int.fetchOne(db, sql: """
            SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?
        """, arguments: [table])
        return (count ?? 0) > 0
    }

    private func restoreData(from source: DatabaseManager, to destination: DatabaseManager) throws {
        try source.dbQueue.read { sourceDb in
            try destination.dbQueue.write { destDb in
                // Restore episodes
                try self.restoreTable("episodes", from: sourceDb, to: destDb,
                    columns: ["id", "start_time", "end_time", "locations", "qualities",
                              "symptoms", "triggers", "notes", "latitude", "longitude",
                              "location_accuracy", "location_timestamp", "created_at", "updated_at"])

                // Restore medications
                try self.restoreTable("medications", from: sourceDb, to: destDb,
                    columns: ["id", "name", "type", "dosage_amount", "dosage_unit",
                              "default_quantity", "schedule_frequency", "photo_uri", "active",
                              "notes", "category", "created_at", "updated_at"])

                // Restore intensity readings
                try self.restoreTable("intensity_readings", from: sourceDb, to: destDb,
                    columns: ["id", "episode_id", "timestamp", "intensity", "created_at", "updated_at"])

                // Restore symptom logs
                try self.restoreTable("symptom_logs", from: sourceDb, to: destDb,
                    columns: ["id", "episode_id", "symptom", "onset_time",
                              "resolution_time", "severity", "created_at"])

                // Restore pain location logs
                // RN migrated databases (v19) have different columns: onset_time, resolution_time,
                // location, severity, notes. Fresh/Swift schema uses: timestamp, pain_locations.
                let sourcePainCols = try self.columnNames(for: "pain_location_logs", in: sourceDb)
                if sourcePainCols.contains("pain_locations") {
                    // Source matches Swift schema
                    try self.restoreTable("pain_location_logs", from: sourceDb, to: destDb,
                        columns: ["id", "episode_id", "timestamp", "pain_locations", "created_at", "updated_at"])
                } else if sourcePainCols.contains("location") {
                    // Source is RN migrated schema - convert to Swift schema
                    let rows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM pain_location_logs")
                    let hasUpdatedAt = sourcePainCols.contains("updated_at")
                    for row in rows {
                        // Map onset_time -> timestamp, wrap location in JSON array -> pain_locations
                        let location: String? = row["location"]
                        let painLocations = location.map { "[\"\($0)\"]" } ?? "[]"
                        let timestamp: DatabaseValue = row["onset_time"]
                        let createdAt: DatabaseValue = row["created_at"]
                        let updatedAt: DatabaseValue = hasUpdatedAt ? row["updated_at"] : createdAt
                        try destDb.execute(
                            sql: """
                                INSERT INTO pain_location_logs (id, episode_id, timestamp,
                                    pain_locations, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?)
                            """,
                            arguments: [row["id"], row["episode_id"], timestamp,
                                        painLocations, createdAt, updatedAt]
                        )
                    }
                }
                // else: table missing or empty columns - skip

                // Restore episode notes
                try self.restoreTable("episode_notes", from: sourceDb, to: destDb,
                    columns: ["id", "episode_id", "timestamp", "note", "created_at"])

                // Restore medication schedules
                try self.restoreTable("medication_schedules", from: sourceDb, to: destDb,
                    columns: ["id", "medication_id", "time", "timezone", "dosage",
                              "enabled", "notification_id", "reminder_enabled"])

                // Restore medication doses
                try self.restoreTable("medication_doses", from: sourceDb, to: destDb,
                    columns: ["id", "medication_id", "timestamp", "quantity", "dosage_amount",
                              "dosage_unit", "status", "episode_id", "effectiveness_rating",
                              "time_to_relief", "side_effects", "notes", "created_at", "updated_at"])

                // Restore daily status logs
                // RN migrated databases (v19) have severity but no updated_at.
                // Fresh/Swift schema has updated_at but no severity.
                let sourceStatusCols = try self.columnNames(for: "daily_status_logs", in: sourceDb)
                if sourceStatusCols.contains("updated_at") {
                    // Source matches Swift schema
                    try self.restoreTable("daily_status_logs", from: sourceDb, to: destDb,
                        columns: ["id", "date", "status", "status_type", "notes",
                                  "prompted", "created_at", "updated_at"])
                } else {
                    // Source is RN migrated schema - use created_at as updated_at
                    let rows = try Row.fetchAll(sourceDb, sql: "SELECT * FROM daily_status_logs")
                    for row in rows {
                        let createdAt: DatabaseValue = row["created_at"]
                        try destDb.execute(
                            sql: """
                                INSERT INTO daily_status_logs (id, date, status, status_type, notes,
                                    prompted, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            arguments: [
                                row["id"], row["date"], row["status"], row["status_type"],
                                row["notes"], row["prompted"], createdAt, createdAt
                            ]
                        )
                    }
                }

                // Restore calendar overlays (may not exist in older backups)
                if try self.tableExists("calendar_overlays", in: sourceDb) {
                    try self.restoreTable("calendar_overlays", from: sourceDb, to: destDb,
                        columns: ["id", "start_date", "end_date", "label", "notes",
                                  "exclude_from_stats", "created_at", "updated_at"])
                }

                // Restore medication reminders
                try self.restoreTable("medication_reminders", from: sourceDb, to: destDb,
                    columns: ["id", "medication_id", "scheduled_time", "completed",
                              "snoozed_until", "completed_at"])
            }
        }
    }

    /// Restore a table by copying only the columns that exist in both source and destination.
    /// Fixes timestamp columns with invalid zero values by falling back to created_at.
    private func restoreTable(
        _ table: String,
        from sourceDb: Database,
        to destDb: Database,
        columns destColumns: [String]
    ) throws {
        guard try tableExists(table, in: sourceDb) else {
            logger.info("Skipping restore of \(table): table not found in backup")
            return
        }

        let sourceCols = try columnNames(for: table, in: sourceDb)

        // Only copy columns that exist in both source and destination
        let commonColumns = destColumns.filter { sourceCols.contains($0) }
        guard !commonColumns.isEmpty else {
            logger.warn("No common columns for \(table), skipping")
            return
        }

        let columnList = commonColumns.joined(separator: ", ")
        let placeholders = commonColumns.map { _ in "?" }.joined(separator: ", ")
        let hasCreatedAt = commonColumns.contains("created_at")

        var skipped = 0
        let rows = try Row.fetchAll(sourceDb, sql: "SELECT \(columnList) FROM \(table)")
        for row in rows {
            let args: [DatabaseValue] = commonColumns.map { col in
                let value: DatabaseValue = row[col]
                // Fix zero/null timestamp columns (updated_at, created_at) that violate CHECK(col > 0).
                // RN backups may have DEFAULT 0 for updated_at in some tables.
                if col == "updated_at" || col == "created_at" {
                    if value.isNull || value == 0.databaseValue {
                        if hasCreatedAt && col == "updated_at" {
                            let fallback: DatabaseValue = row["created_at"]
                            if !fallback.isNull && fallback != 0.databaseValue {
                                return fallback
                            }
                        }
                        // Last resort: use current timestamp
                        return Int64(Date().timeIntervalSince1970 * 1000).databaseValue
                    }
                }
                return value
            }
            do {
                try destDb.execute(
                    sql: "INSERT INTO \(table) (\(columnList)) VALUES (\(placeholders))",
                    arguments: StatementArguments(args)
                )
            } catch {
                // Skip rows that violate CHECK constraints (e.g. bad data from RN app)
                // rather than failing the entire restore
                skipped += 1
                let rowId: DatabaseValue = row["id"]
                self.logger.warn("Skipped \(table) row \(rowId): \(error.localizedDescription)")
            }
        }

        let skippedMsg = skipped > 0 ? ", skipped: \(skipped)" : ""
        logger.info("Restored \(rows.count - skipped) rows in \(table) (columns: \(commonColumns.count)/\(destColumns.count)\(skippedMsg))")
    }
}
