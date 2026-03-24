import XCTest
@testable import MigraLog

final class ScheduledNotificationRepositoryTests: XCTestCase {
    var dbManager: DatabaseManager!
    var repo: ScheduledNotificationRepository!
    var medRepo: MedicationRepository!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        repo = ScheduledNotificationRepository(dbManager: dbManager)
        medRepo = MedicationRepository(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        dbManager = nil
        repo = nil
        medRepo = nil
    }

    // MARK: - Helpers

    private func makeMedication(id: String = UUID().uuidString) -> Medication {
        let now = TimestampHelper.now
        return Medication(
            id: id,
            name: "Test Med",
            type: .rescue,
            dosageAmount: 200.0,
            dosageUnit: "mg",
            defaultQuantity: 1.0,
            scheduleFrequency: nil,
            photoUri: nil,
            active: true,
            notes: nil,
            category: nil,
            createdAt: now,
            updatedAt: now
        )
    }

    private func makeNotification(
        id: String = UUID().uuidString,
        medicationId: String? = nil,
        scheduleId: String? = nil,
        date: String = "2024-01-15",
        notificationId: String = UUID().uuidString,
        notificationType: NotificationType = .reminder,
        sourceType: NotificationSourceType = .medication,
        medicationName: String? = nil
    ) -> ScheduledNotification {
        ScheduledNotification(
            id: id,
            medicationId: medicationId,
            scheduleId: scheduleId,
            date: date,
            notificationId: notificationId,
            notificationType: notificationType,
            isGrouped: false,
            groupKey: nil,
            sourceType: sourceType,
            medicationName: medicationName,
            scheduledTriggerTime: "08:00",
            notificationTitle: "Reminder",
            notificationBody: "Time to take your medication",
            categoryIdentifier: "medication_reminder",
            createdAt: TimestampHelper.now
        )
    }

    // MARK: - CRUD Tests

    func testCreateNotification() throws {
        let med = makeMedication()
        try medRepo.createMedication(med)

        let notification = makeNotification(medicationId: med.id, medicationName: "Test Med")
        let created = try repo.createNotification(notification)

        XCTAssertEqual(created.id, notification.id)
        XCTAssertEqual(created.notificationType, .reminder)
    }

    func testCreateDailyCheckinNotification() throws {
        let notification = makeNotification(
            date: "2024-01-15",
            notificationType: .dailyCheckin,
            sourceType: .dailyCheckin
        )
        let created = try repo.createNotification(notification)

        XCTAssertEqual(created.sourceType, .dailyCheckin)
        XCTAssertEqual(created.notificationType, .dailyCheckin)
    }

    func testGetByEntityMedication() throws {
        let med = makeMedication()
        try medRepo.createMedication(med)

        let n1 = makeNotification(medicationId: med.id, date: "2024-01-15")
        let n2 = makeNotification(medicationId: med.id, date: "2024-01-16")
        try repo.createNotification(n1)
        try repo.createNotification(n2)

        let results = try repo.getByEntity(entityType: .medication, entityId: med.id)
        XCTAssertEqual(results.count, 2)
        // Sorted by date ASC
        XCTAssertEqual(results[0].date, "2024-01-15")
        XCTAssertEqual(results[1].date, "2024-01-16")
    }

    func testGetByEntityDailyCheckin() throws {
        let n1 = makeNotification(
            date: "2024-01-15",
            notificationType: .dailyCheckin,
            sourceType: .dailyCheckin
        )
        let n2 = makeNotification(
            date: "2024-01-16",
            notificationType: .dailyCheckin,
            sourceType: .dailyCheckin
        )
        try repo.createNotification(n1)
        try repo.createNotification(n2)

        let results = try repo.getByEntity(entityType: .dailyCheckin, entityId: "")
        XCTAssertEqual(results.count, 2)
    }

    func testGetAllPending() throws {
        // Use a future date to ensure it shows as pending
        let futureDate = "2099-12-31"
        let pastDate = "2020-01-01"

        let med = makeMedication()
        try medRepo.createMedication(med)

        let futureNotification = makeNotification(medicationId: med.id, date: futureDate)
        let pastNotification = makeNotification(medicationId: med.id, date: pastDate)
        try repo.createNotification(futureNotification)
        try repo.createNotification(pastNotification)

        let pending = try repo.getAllPending()
        // Future should be pending, past should not
        XCTAssertTrue(pending.contains(where: { $0.id == futureNotification.id }))
        XCTAssertFalse(pending.contains(where: { $0.id == pastNotification.id }))
    }

    func testDeleteByNotificationId() throws {
        let med = makeMedication()
        try medRepo.createMedication(med)

        let notifId = "unique-notification-id"
        let notification = makeNotification(medicationId: med.id, notificationId: notifId)
        try repo.createNotification(notification)

        try repo.deleteByNotificationId(notifId)

        let results = try repo.getByEntity(entityType: .medication, entityId: med.id)
        XCTAssertTrue(results.isEmpty)
    }

    func testDeleteByEntityMedication() throws {
        let med = makeMedication()
        try medRepo.createMedication(med)

        try repo.createNotification(makeNotification(medicationId: med.id, date: "2024-01-15"))
        try repo.createNotification(makeNotification(medicationId: med.id, date: "2024-01-16"))

        try repo.deleteByEntity(entityType: .medication, entityId: med.id)

        let results = try repo.getByEntity(entityType: .medication, entityId: med.id)
        XCTAssertTrue(results.isEmpty)
    }

    func testDeleteByEntityDailyCheckin() throws {
        try repo.createNotification(makeNotification(
            date: "2024-01-15",
            notificationType: .dailyCheckin,
            sourceType: .dailyCheckin
        ))
        try repo.createNotification(makeNotification(
            date: "2024-01-16",
            notificationType: .dailyCheckin,
            sourceType: .dailyCheckin
        ))

        try repo.deleteByEntity(entityType: .dailyCheckin, entityId: "")

        let results = try repo.getByEntity(entityType: .dailyCheckin, entityId: "")
        XCTAssertTrue(results.isEmpty)
    }

    // MARK: - Metadata Fields Tests

    func testNotificationMetadataFieldsPersisted() throws {
        let med = makeMedication()
        try medRepo.createMedication(med)

        let notification = ScheduledNotification(
            id: UUID().uuidString,
            medicationId: med.id,
            scheduleId: nil,
            date: "2024-01-15",
            notificationId: "notif-123",
            notificationType: .reminder,
            isGrouped: true,
            groupKey: "group-abc",
            sourceType: .medication,
            medicationName: "Test Med",
            scheduledTriggerTime: "08:30",
            notificationTitle: "Take your meds",
            notificationBody: "It's time for Test Med",
            categoryIdentifier: "med_reminder",
            createdAt: TimestampHelper.now
        )
        try repo.createNotification(notification)

        let results = try repo.getByEntity(entityType: .medication, entityId: med.id)
        let fetched = results.first

        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.isGrouped, true)
        XCTAssertEqual(fetched?.groupKey, "group-abc")
        XCTAssertEqual(fetched?.medicationName, "Test Med")
        XCTAssertEqual(fetched?.scheduledTriggerTime, "08:30")
        XCTAssertEqual(fetched?.notificationTitle, "Take your meds")
        XCTAssertEqual(fetched?.notificationBody, "It's time for Test Med")
        XCTAssertEqual(fetched?.categoryIdentifier, "med_reminder")
    }

    // MARK: - Cascade Tests

    func testDeleteMedicationCascadesNotifications() throws {
        let med = makeMedication()
        try medRepo.createMedication(med)
        try repo.createNotification(makeNotification(medicationId: med.id, date: "2024-01-15"))
        try repo.createNotification(makeNotification(medicationId: med.id, date: "2024-01-16"))

        try medRepo.deleteMedication(med.id)

        let results = try repo.getByEntity(entityType: .medication, entityId: med.id)
        XCTAssertTrue(results.isEmpty)
    }
}
