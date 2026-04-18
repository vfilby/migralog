import XCTest
@testable import MigraLog

final class MedicationRepositoryTests: XCTestCase {
    var dbManager: DatabaseManager!
    var repo: MedicationRepository!
    var episodeRepo: EpisodeRepository!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        repo = MedicationRepository(dbManager: dbManager)
        episodeRepo = EpisodeRepository(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        dbManager = nil
        repo = nil
        episodeRepo = nil
    }

    // MARK: - Helpers

    private func makeMedication(
        id: String = UUID().uuidString,
        name: String = "Ibuprofen",
        type: MedicationType = .rescue,
        dosageAmount: Double = 200.0,
        dosageUnit: String = "mg",
        active: Bool = true,
        category: MedicationCategory? = .nsaid,
        notes: String? = nil
    ) -> Medication {
        let now = TimestampHelper.now
        return Medication(
            id: id,
            name: name,
            type: type,
            dosageAmount: dosageAmount,
            dosageUnit: dosageUnit,
            defaultQuantity: 1.0,
            scheduleFrequency: nil,
            photoUri: nil,
            active: active,
            notes: notes,
            category: category,
            createdAt: now,
            updatedAt: now
        )
    }

    private func makeDose(
        id: String = UUID().uuidString,
        medicationId: String,
        timestamp: Int64 = 1_700_000_000_000,
        quantity: Double = 1.0,
        status: DoseStatus = .taken,
        episodeId: String? = nil
    ) -> MedicationDose {
        let now = TimestampHelper.now
        return MedicationDose(
            id: id,
            medicationId: medicationId,
            timestamp: timestamp,
            quantity: quantity,
            dosageAmount: 200.0,
            dosageUnit: "mg",
            status: status,
            episodeId: episodeId,
            effectivenessRating: nil,
            timeToRelief: nil,
            sideEffects: [],
            notes: nil,
            createdAt: now,
            updatedAt: now
        )
    }

    private func makeSchedule(
        id: String = UUID().uuidString,
        medicationId: String,
        time: String = "08:00",
        timezone: String = "America/New_York"
    ) -> MedicationSchedule {
        MedicationSchedule(
            id: id,
            medicationId: medicationId,
            time: time,
            timezone: timezone,
            dosage: 1.0,
            enabled: true,
            notificationId: nil,
            reminderEnabled: true
        )
    }

    // MARK: - Medication CRUD Tests

    func testCreateMedication() throws {
        let med = makeMedication()
        let created = try repo.createMedication(med)

        XCTAssertEqual(created.id, med.id)
        XCTAssertEqual(created.name, "Ibuprofen")
    }

    func testCreateMedicationWithAllOptionalFields() throws {
        let med = Medication(
            id: UUID().uuidString,
            name: "Sumatriptan",
            type: .rescue,
            dosageAmount: 50.0,
            dosageUnit: "mg",
            defaultQuantity: 1.0,
            scheduleFrequency: .daily,
            photoUri: "photo://triptan.jpg",
            active: true,
            notes: "Take at onset",
            category: .triptan,
            createdAt: TimestampHelper.now,
            updatedAt: TimestampHelper.now
        )
        try repo.createMedication(med)

        let fetched = try repo.getMedicationById(med.id)
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.scheduleFrequency, .daily)
        XCTAssertEqual(fetched?.photoUri, "photo://triptan.jpg")
        XCTAssertEqual(fetched?.notes, "Take at onset")
        XCTAssertEqual(fetched?.category, .triptan)
    }

    func testGetMedicationByIdExists() throws {
        let med = makeMedication()
        try repo.createMedication(med)

        let fetched = try repo.getMedicationById(med.id)
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.name, "Ibuprofen")
    }

    func testGetMedicationByIdNotFound() throws {
        let fetched = try repo.getMedicationById("nonexistent")
        XCTAssertNil(fetched)
    }

    func testGetAllMedications() throws {
        try repo.createMedication(makeMedication(name: "Med A", active: true))
        try repo.createMedication(makeMedication(name: "Med B", active: false))

        let all = try repo.getAllMedications()
        XCTAssertEqual(all.count, 2)
    }

    func testGetActiveMedications() throws {
        try repo.createMedication(makeMedication(name: "Active Med", active: true))
        try repo.createMedication(makeMedication(name: "Archived Med", active: false))

        let active = try repo.getActiveMedications()
        XCTAssertEqual(active.count, 1)
        XCTAssertEqual(active.first?.name, "Active Med")
    }

    func testGetArchivedMedications() throws {
        try repo.createMedication(makeMedication(name: "Active Med", active: true))
        try repo.createMedication(makeMedication(name: "Archived Med", active: false))

        let archived = try repo.getArchivedMedications()
        XCTAssertEqual(archived.count, 1)
        XCTAssertEqual(archived.first?.name, "Archived Med")
    }

    func testUpdateMedicationFields() throws {
        let med = makeMedication(name: "Original")
        try repo.createMedication(med)

        var toUpdate = med
        toUpdate.name = "Updated Name"
        toUpdate.dosageAmount = 400.0
        let updated = try repo.updateMedication(toUpdate)

        XCTAssertEqual(updated.name, "Updated Name")
        XCTAssertGreaterThanOrEqual(updated.updatedAt, med.updatedAt)

        let fetched = try repo.getMedicationById(med.id)
        XCTAssertEqual(fetched?.name, "Updated Name")
        XCTAssertEqual(fetched?.dosageAmount, 400.0)
    }

    func testArchiveMedication() throws {
        let med = makeMedication(active: true)
        try repo.createMedication(med)

        try repo.archiveMedication(med.id)

        let fetched = try repo.getMedicationById(med.id)
        XCTAssertEqual(fetched?.active, false)
    }

    func testUnarchiveMedication() throws {
        let med = makeMedication(active: false)
        try repo.createMedication(med)

        try repo.unarchiveMedication(med.id)

        let fetched = try repo.getMedicationById(med.id)
        XCTAssertEqual(fetched?.active, true)
    }

    func testDeleteMedication() throws {
        let med = makeMedication()
        try repo.createMedication(med)

        try repo.deleteMedication(med.id)

        let fetched = try repo.getMedicationById(med.id)
        XCTAssertNil(fetched)
    }

    // MARK: - Dose CRUD Tests

    func testCreateDose() throws {
        let med = makeMedication()
        try repo.createMedication(med)
        let dose = makeDose(medicationId: med.id)

        let created = try repo.createDose(dose)
        XCTAssertEqual(created.id, dose.id)
        XCTAssertEqual(created.quantity, 1.0)
    }

    func testCreateDoseWithEpisodeLink() throws {
        let med = makeMedication()
        try repo.createMedication(med)

        let episode = Episode(
            id: UUID().uuidString,
            startTime: 1_700_000_000_000,
            endTime: nil,
            locations: [],
            qualities: [],
            symptoms: [],
            triggers: [],
            notes: nil,
            latitude: nil,
            longitude: nil,
            locationAccuracy: nil,
            locationTimestamp: nil,
            createdAt: TimestampHelper.now,
            updatedAt: TimestampHelper.now
        )
        try episodeRepo.createEpisode(episode)

        let dose = makeDose(medicationId: med.id, episodeId: episode.id)
        try repo.createDose(dose)

        let fetched = try repo.getDosesByEpisodeId(episode.id)
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched.first?.episodeId, episode.id)
    }

    func testGetDosesByMedicationIdSortedDesc() throws {
        let med = makeMedication()
        try repo.createMedication(med)

        let d1 = makeDose(medicationId: med.id, timestamp: 1_700_000_000_000)
        let d2 = makeDose(medicationId: med.id, timestamp: 1_700_001_000_000)
        try repo.createDose(d1)
        try repo.createDose(d2)

        let doses = try repo.getDosesByMedicationId(med.id)
        XCTAssertEqual(doses.count, 2)
        XCTAssertEqual(doses[0].id, d2.id) // newest first
        XCTAssertEqual(doses[1].id, d1.id)
    }

    func testGetDosesByDateRange() throws {
        let med = makeMedication()
        try repo.createMedication(med)

        try repo.createDose(makeDose(medicationId: med.id, timestamp: 1_700_000_000_000))
        try repo.createDose(makeDose(medicationId: med.id, timestamp: 1_700_001_000_000))
        try repo.createDose(makeDose(medicationId: med.id, timestamp: 1_700_010_000_000))

        let doses = try repo.getDosesByDateRange(start: 1_699_999_000_000, end: 1_700_002_000_000)
        XCTAssertEqual(doses.count, 2)
    }

    func testGetMedicationUsageCounts() throws {
        let med1 = makeMedication(name: "Med A")
        let med2 = makeMedication(name: "Med B")
        try repo.createMedication(med1)
        try repo.createMedication(med2)

        try repo.createDose(makeDose(medicationId: med1.id, timestamp: 1_700_000_100_000))
        try repo.createDose(makeDose(medicationId: med1.id, timestamp: 1_700_000_200_000))
        try repo.createDose(makeDose(medicationId: med2.id, timestamp: 1_700_000_300_000))
        // Skipped dose should not count
        try repo.createDose(makeDose(medicationId: med2.id, timestamp: 1_700_000_400_000, quantity: 1.0, status: .skipped))

        let counts = try repo.getMedicationUsageCounts(start: 1_700_000_000_000, end: 1_700_001_000_000)
        XCTAssertEqual(counts[med1.id], 2)
        XCTAssertEqual(counts[med2.id], 1)
    }

    func testUpdateDose() throws {
        let med = makeMedication()
        try repo.createMedication(med)
        let dose = makeDose(medicationId: med.id, quantity: 1.0)
        try repo.createDose(dose)

        var toUpdate = dose
        toUpdate.quantity = 2.0
        let updated = try repo.updateDose(toUpdate)
        XCTAssertEqual(updated.quantity, 2.0)

        let fetched = try repo.getDosesByMedicationId(med.id)
        XCTAssertEqual(fetched.first?.quantity, 2.0)
    }

    func testDeleteDose() throws {
        let med = makeMedication()
        try repo.createMedication(med)
        let dose = makeDose(medicationId: med.id)
        try repo.createDose(dose)

        try repo.deleteDose(dose.id)

        let doses = try repo.getDosesByMedicationId(med.id)
        XCTAssertTrue(doses.isEmpty)
    }

    // MARK: - Schedule CRUD Tests

    func testCreateSchedule() throws {
        let med = makeMedication()
        try repo.createMedication(med)
        let schedule = makeSchedule(medicationId: med.id, time: "08:00")

        let created = try repo.createSchedule(schedule)
        XCTAssertEqual(created.time, "08:00")
    }

    func testGetSchedulesByMedicationId() throws {
        let med = makeMedication()
        try repo.createMedication(med)
        try repo.createSchedule(makeSchedule(medicationId: med.id, time: "08:00"))
        try repo.createSchedule(makeSchedule(medicationId: med.id, time: "20:00"))

        let schedules = try repo.getSchedulesByMedicationId(med.id)
        XCTAssertEqual(schedules.count, 2)
        XCTAssertEqual(schedules[0].time, "08:00")
        XCTAssertEqual(schedules[1].time, "20:00")
    }

    func testGetSchedulesByMultipleMedicationIds() throws {
        let med1 = makeMedication(name: "Med A")
        let med2 = makeMedication(name: "Med B")
        try repo.createMedication(med1)
        try repo.createMedication(med2)

        try repo.createSchedule(makeSchedule(medicationId: med1.id, time: "08:00"))
        try repo.createSchedule(makeSchedule(medicationId: med1.id, time: "20:00"))
        try repo.createSchedule(makeSchedule(medicationId: med2.id, time: "09:00"))

        let grouped = try repo.getSchedulesByMultipleMedicationIds([med1.id, med2.id])
        XCTAssertEqual(grouped[med1.id]?.count, 2)
        XCTAssertEqual(grouped[med2.id]?.count, 1)
    }

    func testUpdateSchedule() throws {
        let med = makeMedication()
        try repo.createMedication(med)
        let schedule = makeSchedule(medicationId: med.id, time: "08:00")
        try repo.createSchedule(schedule)

        var toUpdate = schedule
        toUpdate.time = "09:30"
        try repo.updateSchedule(toUpdate)

        let fetched = try repo.getSchedulesByMedicationId(med.id)
        XCTAssertEqual(fetched.first?.time, "09:30")
    }

    func testDeleteSchedule() throws {
        let med = makeMedication()
        try repo.createMedication(med)
        let schedule = makeSchedule(medicationId: med.id)
        try repo.createSchedule(schedule)

        try repo.deleteSchedule(schedule.id)

        let schedules = try repo.getSchedulesByMedicationId(med.id)
        XCTAssertTrue(schedules.isEmpty)
    }

    // MARK: - Cascade Delete Tests

    func testDeleteMedicationCascadesDosesAndSchedules() throws {
        let med = makeMedication()
        try repo.createMedication(med)
        try repo.createDose(makeDose(medicationId: med.id))
        try repo.createSchedule(makeSchedule(medicationId: med.id))

        try repo.deleteMedication(med.id)

        let doses = try repo.getDosesByMedicationId(med.id)
        let schedules = try repo.getSchedulesByMedicationId(med.id)
        XCTAssertTrue(doses.isEmpty)
        XCTAssertTrue(schedules.isEmpty)
    }

    // MARK: - Side Effects JSON Tests

    func testDoseSideEffectsJsonRoundtrip() throws {
        let med = makeMedication()
        try repo.createMedication(med)

        let now = TimestampHelper.now
        let dose = MedicationDose(
            id: UUID().uuidString,
            medicationId: med.id,
            timestamp: 1_700_000_000_000,
            quantity: 1.0,
            dosageAmount: 200.0,
            dosageUnit: "mg",
            status: .taken,
            episodeId: nil,
            effectivenessRating: 7.5,
            timeToRelief: 30,
            sideEffects: ["drowsiness", "dry mouth"],
            notes: "Worked well",
            createdAt: now,
            updatedAt: now
        )
        try repo.createDose(dose)

        let fetched = try repo.getDosesByMedicationId(med.id)
        XCTAssertEqual(fetched.first?.sideEffects, ["drowsiness", "dry mouth"])
        XCTAssertEqual(fetched.first?.effectivenessRating, 7.5)
        XCTAssertEqual(fetched.first?.timeToRelief, 30)
    }

    // MARK: - getLastTakenDoseInCategory

    func test_getLastTakenDoseInCategory_returns_latest_dose_with_med_name() throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, active,
                                          category, created_at, updated_at)
                VALUES ('m1','Advil','rescue',200,'mg',1,'nsaid',1,1),
                       ('m2','Naproxen','rescue',500,'mg',1,'nsaid',1,1),
                       ('m3','Tylenol','rescue',500,'mg',1,'otc',1,1)
                """)
            try db.execute(sql: """
                INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
                VALUES ('d1','m2',1000,1,'taken',1,1),
                       ('d2','m1',2000,1,'taken',1,1),
                       ('d3','m3',3000,1,'taken',1,1)
                """)
        }

        let result = try repo.getLastTakenDoseInCategory(.nsaid, now: Date(timeIntervalSince1970: 1_000_000))
        XCTAssertEqual(result?.medicationName, "Advil")
        XCTAssertEqual(result?.dose.medicationId, "m1")
    }

    func test_getLastTakenDoseInCategory_ignores_skipped_doses() throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, active,
                                          category, created_at, updated_at)
                VALUES ('m1','Advil','rescue',200,'mg',1,'nsaid',1,1)
                """)
            try db.execute(sql: """
                INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
                VALUES ('d1','m1',1000,0,'skipped',1,1)
                """)
        }

        let result = try repo.getLastTakenDoseInCategory(.nsaid, now: Date(timeIntervalSince1970: 1_000_000))
        XCTAssertNil(result)
    }

    func test_getLastTakenDoseInCategory_returns_nil_when_no_doses() throws {
        let result = try repo.getLastTakenDoseInCategory(.nsaid, now: Date())
        XCTAssertNil(result)
    }
}
