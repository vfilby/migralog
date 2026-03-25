import XCTest
import GRDB
@testable import MigraLog

final class ExportServiceTests: XCTestCase {
    private var dbManager: DatabaseManager!
    private var exportService: ExportService!

    override func setUp() async throws {
        dbManager = try DatabaseManager(inMemory: true)
        exportService = ExportService()
    }

    override func tearDown() async throws {
        dbManager = nil
        exportService = nil
    }

    // MARK: - Empty Database Export

    func testExportEmptyDatabase() throws {
        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertEqual(exportData.episodes.count, 0)
        XCTAssertEqual(exportData.medications.count, 0)
        XCTAssertEqual(exportData.medicationDoses.count, 0)
        XCTAssertEqual(exportData.medicationSchedules.count, 0)
        XCTAssertEqual(exportData.metadata.episodeCount, 0)
        XCTAssertEqual(exportData.metadata.medicationCount, 0)
        XCTAssertEqual(exportData.metadata.schemaVersion, DatabaseManager.schemaVersion)
    }

    // MARK: - Export with Episodes

    func testExportWithEpisodes() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO episodes (id, start_time, end_time, locations, qualities,
                        symptoms, triggers, notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: [
                    "ep1", now - 3600000, now, "[\"left_temple\"]", "[\"throbbing\"]",
                    "[\"nausea\"]", "[\"stress\"]", "Test note", now - 3600000, now
                ]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertEqual(exportData.episodes.count, 1)
        XCTAssertEqual(exportData.metadata.episodeCount, 1)

        let episode = exportData.episodes[0]
        XCTAssertEqual(episode.id, "ep1")
        XCTAssertEqual(episode.startTime, now - 3600000)
        XCTAssertEqual(episode.endTime, now)
        XCTAssertEqual(episode.locations, ["left_temple"])
        XCTAssertEqual(episode.qualities, ["throbbing"])
        XCTAssertEqual(episode.symptoms, ["nausea"])
        XCTAssertEqual(episode.triggers, ["stress"])
        XCTAssertEqual(episode.notes, "Test note")
    }

    // MARK: - Export with Episode Location

    func testExportWithEpisodeLocation() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO episodes (id, start_time, locations, qualities,
                        symptoms, triggers, latitude, longitude, location_accuracy,
                        location_timestamp, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: [
                    "ep-loc", now, "[]", "[]", "[]", "[]",
                    45.5, -122.6, 50.0, now, now, now
                ]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)
        let episode = exportData.episodes[0]

        XCTAssertNotNil(episode.location)
        XCTAssertEqual(episode.location?.latitude, 45.5)
        XCTAssertEqual(episode.location?.longitude, -122.6)
        XCTAssertEqual(episode.location?.accuracy, 50.0)
        XCTAssertEqual(episode.location?.timestamp, now)
    }

    // MARK: - Export with Medications

    func testExportWithMedications() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit,
                        active, category, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["med1", "Sumatriptan", "rescue", 50.0, "mg", 1, "triptan", now, now]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertEqual(exportData.medications.count, 1)
        XCTAssertEqual(exportData.metadata.medicationCount, 1)

        let med = exportData.medications[0]
        XCTAssertEqual(med.id, "med1")
        XCTAssertEqual(med.name, "Sumatriptan")
        XCTAssertEqual(med.type, "rescue")
        XCTAssertEqual(med.dosageAmount, 50.0)
        XCTAssertEqual(med.dosageUnit, "mg")
        XCTAssertTrue(med.active)
        XCTAssertEqual(med.category, "triptan")
    }

    // MARK: - Export with Doses

    func testExportWithMedicationDoses() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit,
                        active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["med1", "Ibuprofen", "rescue", 400.0, "mg", 1, now, now]
            )

            try db.execute(
                sql: """
                    INSERT INTO medication_doses (id, medication_id, timestamp, quantity,
                        dosage_amount, dosage_unit, status, side_effects, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: [
                    "dose1", "med1", now, 1.0, 400.0, "mg", "taken",
                    "[\"nausea\"]", now, now
                ]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertEqual(exportData.medicationDoses.count, 1)
        let dose = exportData.medicationDoses[0]
        XCTAssertEqual(dose.id, "dose1")
        XCTAssertEqual(dose.medicationId, "med1")
        XCTAssertEqual(dose.quantity, 1.0)
        XCTAssertEqual(dose.status, "taken")
        XCTAssertEqual(dose.sideEffects, ["nausea"])
    }

    // MARK: - Export with Schedules

    func testExportWithMedicationSchedules() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit,
                        active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["med1", "Topiramate", "preventative", 25.0, "mg", 1, now, now]
            )

            try db.execute(
                sql: """
                    INSERT INTO medication_schedules (id, medication_id, time, timezone,
                        dosage, enabled, reminder_enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["sched1", "med1", "08:00", "America/Los_Angeles", 1.0, 1, 1]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertEqual(exportData.medicationSchedules.count, 1)
        let schedule = exportData.medicationSchedules[0]
        XCTAssertEqual(schedule.id, "sched1")
        XCTAssertEqual(schedule.medicationId, "med1")
        XCTAssertEqual(schedule.time, "08:00")
        XCTAssertEqual(schedule.timezone, "America/Los_Angeles")
        XCTAssertTrue(schedule.enabled)
    }

    // MARK: - Export with Daily Status Logs

    func testExportWithDailyStatusLogs() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO daily_status_logs (id, date, status, status_type, prompted,
                        created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["ds1", "2026-03-20", "yellow", "prodrome", 1, now, now]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertEqual(exportData.dailyStatusLogs?.count, 1)
        let status = exportData.dailyStatusLogs![0]
        XCTAssertEqual(status.id, "ds1")
        XCTAssertEqual(status.date, "2026-03-20")
        XCTAssertEqual(status.status, "yellow")
        XCTAssertEqual(status.statusType, "prodrome")
        XCTAssertTrue(status.prompted)
    }

    // MARK: - Export with Calendar Overlays

    func testExportWithCalendarOverlays() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO calendar_overlays (id, start_date, end_date, label, notes,
                        exclude_from_stats, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: [
                    "ov1", "2026-03-01", "2026-03-15", "Vacation",
                    "Spring break", 1, now, now
                ]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertEqual(exportData.calendarOverlays?.count, 1)
        let overlay = exportData.calendarOverlays![0]
        XCTAssertEqual(overlay.id, "ov1")
        XCTAssertEqual(overlay.startDate, "2026-03-01")
        XCTAssertEqual(overlay.endDate, "2026-03-15")
        XCTAssertEqual(overlay.label, "Vacation")
        XCTAssertTrue(overlay.excludeFromStats)
    }

    // MARK: - Export with Episode Notes

    func testExportWithEpisodeNotes() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO episodes (id, start_time, locations, qualities,
                        symptoms, triggers, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["ep1", now, "[]", "[]", "[]", "[]", now, now]
            )

            try db.execute(
                sql: """
                    INSERT INTO episode_notes (id, episode_id, timestamp, note, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """,
                arguments: ["note1", "ep1", now, "Took medication early", now]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertEqual(exportData.episodeNotes?.count, 1)
        let note = exportData.episodeNotes![0]
        XCTAssertEqual(note.id, "note1")
        XCTAssertEqual(note.episodeId, "ep1")
        XCTAssertEqual(note.note, "Took medication early")
    }

    // MARK: - Export with Intensity Readings

    func testExportWithIntensityReadings() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO episodes (id, start_time, locations, qualities,
                        symptoms, triggers, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["ep1", now, "[]", "[]", "[]", "[]", now, now]
            )

            try db.execute(
                sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity,
                        created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
                arguments: ["ir1", "ep1", now, 7.5, now, now]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertEqual(exportData.intensityReadings?.count, 1)
        let reading = exportData.intensityReadings![0]
        XCTAssertEqual(reading.id, "ir1")
        XCTAssertEqual(reading.episodeId, "ep1")
        XCTAssertEqual(reading.intensity, 7.5)
    }

    // MARK: - Export JSON File

    func testExportAsJSONFile() throws {
        let url = try exportService.exportDataAsJSON(dbManager: dbManager)

        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        XCTAssertTrue(url.lastPathComponent.hasPrefix("migralog_export_"))
        XCTAssertTrue(url.lastPathComponent.hasSuffix(".json"))

        // Verify it's valid JSON
        let data = try Data(contentsOf: url)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertNotNil(json)
        XCTAssertNotNil(json?["metadata"])
        XCTAssertNotNil(json?["episodes"])
        XCTAssertNotNil(json?["medications"])
        XCTAssertNotNil(json?["medicationDoses"])
        XCTAssertNotNil(json?["medicationSchedules"])

        // Clean up
        try? FileManager.default.removeItem(at: url)
    }

    // MARK: - Metadata Correctness

    func testMetadataFields() throws {
        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertFalse(exportData.metadata.id.isEmpty)
        XCTAssertGreaterThan(exportData.metadata.timestamp, 0)
        XCTAssertFalse(exportData.metadata.version.isEmpty)
        XCTAssertEqual(exportData.metadata.schemaVersion, DatabaseManager.schemaVersion)
    }

    // MARK: - Full Data Export

    func testFullExportIncludesAllDataTypes() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            // Episode
            try db.execute(
                sql: """
                    INSERT INTO episodes (id, start_time, locations, qualities,
                        symptoms, triggers, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["ep1", now, "[]", "[]", "[]", "[]", now, now]
            )

            // Intensity reading
            try db.execute(
                sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity,
                        created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
                arguments: ["ir1", "ep1", now, 5.0, now, now]
            )

            // Episode note
            try db.execute(
                sql: """
                    INSERT INTO episode_notes (id, episode_id, timestamp, note, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """,
                arguments: ["note1", "ep1", now, "A note", now]
            )

            // Medication
            try db.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit,
                        active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["med1", "Tylenol", "rescue", 500.0, "mg", 1, now, now]
            )

            // Schedule
            try db.execute(
                sql: """
                    INSERT INTO medication_schedules (id, medication_id, time, timezone,
                        dosage, enabled, reminder_enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["sched1", "med1", "09:00", "UTC", 1.0, 1, 1]
            )

            // Dose
            try db.execute(
                sql: """
                    INSERT INTO medication_doses (id, medication_id, timestamp, quantity,
                        status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["dose1", "med1", now, 1.0, "taken", now, now]
            )

            // Daily status
            try db.execute(
                sql: """
                    INSERT INTO daily_status_logs (id, date, status, prompted,
                        created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
                arguments: ["ds1", "2026-03-20", "green", 0, now, now]
            )

            // Calendar overlay
            try db.execute(
                sql: """
                    INSERT INTO calendar_overlays (id, start_date, label,
                        exclude_from_stats, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
                arguments: ["ov1", "2026-03-01", "Travel", 0, now, now]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)

        XCTAssertEqual(exportData.episodes.count, 1)
        XCTAssertEqual(exportData.intensityReadings?.count, 1)
        XCTAssertEqual(exportData.episodeNotes?.count, 1)
        XCTAssertEqual(exportData.medications.count, 1)
        XCTAssertEqual(exportData.medicationSchedules.count, 1)
        XCTAssertEqual(exportData.medicationDoses.count, 1)
        XCTAssertEqual(exportData.dailyStatusLogs?.count, 1)
        XCTAssertEqual(exportData.calendarOverlays?.count, 1)
        XCTAssertEqual(exportData.metadata.episodeCount, 1)
        XCTAssertEqual(exportData.metadata.medicationCount, 1)
        XCTAssertEqual(exportData.metadata.overlayCount, 1)
    }

    // MARK: - JSON Encoding Roundtrip

    func testExportDataEncodesAndDecodesCorrectly() throws {
        let now = TimestampHelper.now

        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO episodes (id, start_time, locations, qualities,
                        symptoms, triggers, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["ep1", now, "[\"left_temple\"]", "[\"throbbing\"]", "[]", "[]", now, now]
            )
        }

        let exportData = try exportService.createExportData(dbManager: dbManager)

        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let jsonData = try encoder.encode(exportData)

        let decoder = JSONDecoder()
        let decoded = try decoder.decode(ExportData.self, from: jsonData)

        XCTAssertEqual(decoded.episodes.count, exportData.episodes.count)
        XCTAssertEqual(decoded.episodes[0].id, "ep1")
        XCTAssertEqual(decoded.episodes[0].locations, ["left_temple"])
    }
}
