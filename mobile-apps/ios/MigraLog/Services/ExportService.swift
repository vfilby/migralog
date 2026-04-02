import Foundation
import GRDB

// MARK: - Errors

enum ExportError: Error {
    case databaseReadFailed(String)
    case encodingFailed(String)
    case fileWriteFailed(String)
}

// MARK: - Protocol

protocol ExportServiceProtocol {
    func exportDataAsJSON(dbManager: DatabaseManager) throws -> URL
    func createExportData(dbManager: DatabaseManager) throws -> ExportData
}

// MARK: - Implementation

final class ExportService: ExportServiceProtocol {
    private let logger = AppLogger.shared
    private let fileManager: FileManager

    /// App version for export metadata
    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    // MARK: - Export as JSON File

    func exportDataAsJSON(dbManager: DatabaseManager) throws -> URL {
        let exportData = try createExportData(dbManager: dbManager)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        let jsonData: Data
        do {
            jsonData = try encoder.encode(exportData)
        } catch {
            throw ExportError.encodingFailed(error.localizedDescription)
        }

        let tempDir = fileManager.temporaryDirectory
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd_HHmmss"
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        let dateString = dateFormatter.string(from: Date())
        let fileName = "migralog_export_\(dateString).json"
        let fileURL = tempDir.appendingPathComponent(fileName)

        do {
            try jsonData.write(to: fileURL)
        } catch {
            throw ExportError.fileWriteFailed(error.localizedDescription)
        }

        logger.info("Exported data to: \(fileURL.lastPathComponent)")
        return fileURL
    }

    // MARK: - Create Export Data

    func createExportData(dbManager: DatabaseManager) throws -> ExportData {
        do {
            return try dbManager.dbQueue.read { db in
                // Fetch episodes
                let episodes = try fetchExportEpisodes(from: db)

                // Fetch episode notes
                let episodeNotes = try fetchExportEpisodeNotes(from: db)

                // Fetch intensity readings
                let intensityReadings = try fetchExportIntensityReadings(from: db)

                // Fetch medications
                let medications = try fetchExportMedications(from: db)

                // Fetch medication doses
                let medicationDoses = try fetchExportMedicationDoses(from: db)

                // Fetch medication schedules
                let medicationSchedules = try fetchExportMedicationSchedules(from: db)

                // Fetch daily status logs (last 2 years)
                let dailyStatusLogs = try fetchExportDailyStatusLogs(from: db)

                // Fetch calendar overlays
                let calendarOverlays = try fetchExportCalendarOverlays(from: db)

                let metadata = ExportMetadata(
                    id: UUID().uuidString,
                    timestamp: TimestampHelper.now,
                    version: self.appVersion,
                    schemaVersion: DatabaseManager.schemaVersion,
                    episodeCount: episodes.count,
                    medicationCount: medications.count,
                    overlayCount: calendarOverlays.count
                )

                return ExportData(
                    metadata: metadata,
                    episodes: episodes,
                    episodeNotes: episodeNotes,
                    intensityReadings: intensityReadings,
                    dailyStatusLogs: dailyStatusLogs,
                    calendarOverlays: calendarOverlays,
                    medications: medications,
                    medicationDoses: medicationDoses,
                    medicationSchedules: medicationSchedules
                )
            }
        } catch let error as ExportError {
            throw error
        } catch {
            throw ExportError.databaseReadFailed(error.localizedDescription)
        }
    }

    // MARK: - Fetch Helpers

    private func fetchExportEpisodes(from db: Database) throws -> [ExportEpisode] {
        let rows = try Row.fetchAll(db, sql: "SELECT * FROM episodes ORDER BY start_time DESC")

        return rows.map { row in
            let locations: [String] = JSONHelper.decodeArray(
                String.self,
                from: row["locations"] as? String
            )
            let qualities: [String] = JSONHelper.decodeArray(
                String.self,
                from: row["qualities"] as? String
            )
            let symptoms: [String] = JSONHelper.decodeArray(
                String.self,
                from: row["symptoms"] as? String
            )
            let triggers: [String] = JSONHelper.decodeArray(
                String.self,
                from: row["triggers"] as? String
            )

            var episodeLocation: ExportEpisodeLocation?
            if let lat = row["latitude"] as? Double,
               let lon = row["longitude"] as? Double,
               let ts = row["location_timestamp"] as? Int64 {
                episodeLocation = ExportEpisodeLocation(
                    latitude: lat,
                    longitude: lon,
                    accuracy: row["location_accuracy"] as? Double,
                    timestamp: ts
                )
            }

            return ExportEpisode(
                id: row["id"],
                startTime: row["start_time"],
                endTime: row["end_time"],
                locations: locations,
                qualities: qualities,
                symptoms: symptoms,
                triggers: triggers,
                notes: row["notes"],
                location: episodeLocation,
                createdAt: row["created_at"],
                updatedAt: row["updated_at"]
            )
        }
    }

    private func fetchExportEpisodeNotes(from db: Database) throws -> [ExportEpisodeNote] {
        let rows = try Row.fetchAll(db, sql: "SELECT * FROM episode_notes ORDER BY timestamp")
        return rows.map { row in
            ExportEpisodeNote(
                id: row["id"],
                episodeId: row["episode_id"],
                timestamp: row["timestamp"],
                note: row["note"],
                createdAt: row["created_at"]
            )
        }
    }

    private func fetchExportIntensityReadings(from db: Database) throws -> [ExportIntensityReading] {
        let rows = try Row.fetchAll(db, sql: "SELECT * FROM intensity_readings ORDER BY timestamp")
        return rows.map { row in
            ExportIntensityReading(
                id: row["id"],
                episodeId: row["episode_id"],
                timestamp: row["timestamp"],
                intensity: row["intensity"],
                createdAt: row["created_at"],
                updatedAt: row["updated_at"]
            )
        }
    }

    private func fetchExportMedications(from db: Database) throws -> [ExportMedication] {
        let rows = try Row.fetchAll(db, sql: "SELECT * FROM medications ORDER BY name")
        return rows.map { row in
            ExportMedication(
                id: row["id"],
                name: row["name"],
                type: row["type"],
                dosageAmount: row["dosage_amount"],
                dosageUnit: row["dosage_unit"],
                defaultQuantity: row["default_quantity"],
                scheduleFrequency: row["schedule_frequency"],
                photoUri: row["photo_uri"],
                active: (row["active"] as? Int64 ?? 0) != 0,
                notes: row["notes"],
                category: row["category"],
                createdAt: row["created_at"],
                updatedAt: row["updated_at"]
            )
        }
    }

    private func fetchExportMedicationDoses(from db: Database) throws -> [ExportMedicationDose] {
        let rows = try Row.fetchAll(db, sql: "SELECT * FROM medication_doses ORDER BY timestamp DESC")
        return rows.map { row in
            let sideEffects: [String]? = {
                if let str = row["side_effects"] as? String, !str.isEmpty {
                    return JSONHelper.decodeArray(String.self, from: str)
                }
                return nil
            }()

            return ExportMedicationDose(
                id: row["id"],
                medicationId: row["medication_id"],
                timestamp: row["timestamp"],
                quantity: row["quantity"],
                dosageAmount: row["dosage_amount"],
                dosageUnit: row["dosage_unit"],
                status: row["status"],
                episodeId: row["episode_id"],
                effectivenessRating: row["effectiveness_rating"],
                timeToRelief: row["time_to_relief"],
                sideEffects: sideEffects,
                notes: row["notes"],
                createdAt: row["created_at"],
                updatedAt: row["updated_at"]
            )
        }
    }

    private func fetchExportMedicationSchedules(from db: Database) throws -> [ExportMedicationSchedule] {
        let rows = try Row.fetchAll(db, sql: "SELECT * FROM medication_schedules")
        return rows.map { row in
            ExportMedicationSchedule(
                id: row["id"],
                medicationId: row["medication_id"],
                time: row["time"],
                timezone: row["timezone"],
                dosage: row["dosage"],
                enabled: (row["enabled"] as? Int64 ?? 0) != 0,
                notificationId: row["notification_id"],
                reminderEnabled: (row["reminder_enabled"] as? Int64 ?? 0) != 0
            )
        }
    }

    private func fetchExportDailyStatusLogs(from db: Database) throws -> [ExportDailyStatusLog] {
        // Fetch last 2 years of daily status logs
        let twoYearsAgo = Calendar.current.date(byAdding: .year, value: -2, to: Date()) ?? Date()
        let cutoffDate = TimestampHelper.dateString(from: twoYearsAgo)

        let rows = try Row.fetchAll(
            db,
            sql: "SELECT * FROM daily_status_logs WHERE date >= ? ORDER BY date",
            arguments: [cutoffDate]
        )
        return rows.map { row in
            ExportDailyStatusLog(
                id: row["id"],
                date: row["date"],
                status: row["status"],
                statusType: row["status_type"],
                notes: row["notes"],
                prompted: (row["prompted"] as? Int64 ?? 0) != 0,
                createdAt: row["created_at"],
                updatedAt: row["updated_at"]
            )
        }
    }

    private func fetchExportCalendarOverlays(from db: Database) throws -> [ExportCalendarOverlay] {
        let rows = try Row.fetchAll(db, sql: "SELECT * FROM calendar_overlays ORDER BY start_date")
        return rows.map { row in
            ExportCalendarOverlay(
                id: row["id"],
                startDate: row["start_date"],
                endDate: row["end_date"],
                label: row["label"],
                notes: row["notes"],
                excludeFromStats: (row["exclude_from_stats"] as? Int64 ?? 0) != 0,
                createdAt: row["created_at"],
                updatedAt: row["updated_at"]
            )
        }
    }
}
