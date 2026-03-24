import XCTest
import UserNotifications
@testable import MigraLog

final class NotificationIntegrityServiceTests: XCTestCase {
    private var sut: NotificationIntegrityService!
    private var mockNotificationService: MockNotificationService!
    private var mockScheduledNotificationRepo: MockScheduledNotificationRepository!

    override func setUp() {
        super.setUp()
        mockNotificationService = MockNotificationService()
        mockScheduledNotificationRepo = MockScheduledNotificationRepository()
        sut = NotificationIntegrityService(
            notificationService: mockNotificationService,
            scheduledNotificationRepo: mockScheduledNotificationRepo
        )
    }

    override func tearDown() {
        sut = nil
        mockNotificationService = nil
        mockScheduledNotificationRepo = nil
        super.tearDown()
    }

    // MARK: - Consistent State

    func testVerifyIntegrity_allConsistent_returnsConsistent() async {
        let today = DateFormatting.dateString(from: Date())
        let mapping = makeMapping(notificationId: "os-1", date: today)
        mockScheduledNotificationRepo.notifications = [mapping]

        let request = makeMedicationPendingRequest(id: "os-1")
        mockNotificationService.pendingRequests = [request]

        let result = await sut.verifyIntegrity()

        XCTAssertTrue(result.isConsistent)
        XCTAssertTrue(result.deviations.isEmpty)
        XCTAssertEqual(result.dbMappingCount, 1)
        XCTAssertEqual(result.osNotificationCount, 1)
    }

    func testVerifyIntegrity_emptyState_isConsistent() async {
        mockScheduledNotificationRepo.notifications = []
        mockNotificationService.pendingRequests = []

        let result = await sut.verifyIntegrity()

        XCTAssertTrue(result.isConsistent)
        XCTAssertTrue(result.deviations.isEmpty)
        XCTAssertEqual(result.dbMappingCount, 0)
        XCTAssertEqual(result.osNotificationCount, 0)
    }

    // MARK: - Missing in OS

    func testVerifyIntegrity_missingInOS_reportsDeviation() async {
        let today = DateFormatting.dateString(from: Date())
        let mapping = makeMapping(notificationId: "os-missing", date: today)
        mockScheduledNotificationRepo.notifications = [mapping]
        // OS has no matching notification
        mockNotificationService.pendingRequests = []

        let result = await sut.verifyIntegrity()

        XCTAssertFalse(result.isConsistent)
        XCTAssertEqual(result.deviations.count, 1)

        if case .missingInOS(_, let notificationId) = result.deviations.first {
            XCTAssertEqual(notificationId, "os-missing")
        } else {
            XCTFail("Expected missingInOS deviation")
        }
    }

    func testVerifyIntegrity_groupedMappingsMissingInOS_reportsOneDeviation() async {
        // Two DB mappings share the same notificationId (grouped) but OS is missing
        let today = DateFormatting.dateString(from: Date())
        let mapping1 = makeMapping(id: "map-1", notificationId: "os-grouped", medicationId: "med-1", date: today, isGrouped: true)
        let mapping2 = makeMapping(id: "map-2", notificationId: "os-grouped", medicationId: "med-2", date: today, isGrouped: true)
        mockScheduledNotificationRepo.notifications = [mapping1, mapping2]
        mockNotificationService.pendingRequests = []

        let result = await sut.verifyIntegrity()

        XCTAssertFalse(result.isConsistent)
        // Should only report one deviation since both share the same notificationId
        let missingInOsDeviations = result.deviations.filter {
            if case .missingInOS = $0 { return true }
            return false
        }
        XCTAssertEqual(missingInOsDeviations.count, 1)
    }

    // MARK: - Missing in DB

    func testVerifyIntegrity_missingInDB_reportsDeviation() async {
        mockScheduledNotificationRepo.notifications = []

        let request = makeMedicationPendingRequest(id: "os-orphan")
        mockNotificationService.pendingRequests = [request]

        let result = await sut.verifyIntegrity()

        XCTAssertFalse(result.isConsistent)
        XCTAssertEqual(result.deviations.count, 1)

        if case .missingInDB(let osNotificationId) = result.deviations.first {
            XCTAssertEqual(osNotificationId, "os-orphan")
        } else {
            XCTFail("Expected missingInDB deviation")
        }
    }

    func testVerifyIntegrity_nonMedicationOsNotification_notReportedAsMissing() async {
        mockScheduledNotificationRepo.notifications = []

        // Non-medication OS notification (no medicationId or medicationIds)
        let content = UNMutableNotificationContent()
        content.userInfo = ["type": "dailyCheckin"]
        let request = UNNotificationRequest(identifier: "checkin-1", content: content, trigger: nil)
        mockNotificationService.pendingRequests = [request]

        let result = await sut.verifyIntegrity()

        XCTAssertTrue(result.isConsistent)
        XCTAssertTrue(result.deviations.isEmpty)
    }

    // MARK: - DB Read Error

    func testVerifyIntegrity_dbReadError_returnsInconsistent() async {
        mockScheduledNotificationRepo.errorToThrow = TestError.mockError("DB read failed")
        mockNotificationService.pendingRequests = []

        let result = await sut.verifyIntegrity()

        XCTAssertFalse(result.isConsistent)
        XCTAssertEqual(result.dbMappingCount, 0)
    }

    // MARK: - Quick Health Check

    func testQuickHealthCheck_consistent_returnsTrue() async {
        let today = DateFormatting.dateString(from: Date())
        let mapping = makeMapping(notificationId: "os-1", date: today)
        mockScheduledNotificationRepo.notifications = [mapping]

        let request = makeMedicationPendingRequest(id: "os-1")
        mockNotificationService.pendingRequests = [request]

        let result = await sut.quickHealthCheck()
        XCTAssertTrue(result)
    }

    func testQuickHealthCheck_mismatch_returnsFalse() async {
        // DB has 1 mapping, OS has 0 medication notifications
        let today = DateFormatting.dateString(from: Date())
        let mapping = makeMapping(notificationId: "os-1", date: today)
        mockScheduledNotificationRepo.notifications = [mapping]
        mockNotificationService.pendingRequests = []

        let result = await sut.quickHealthCheck()
        XCTAssertFalse(result)
    }

    func testQuickHealthCheck_emptyState_returnsTrue() async {
        mockScheduledNotificationRepo.notifications = []
        mockNotificationService.pendingRequests = []

        let result = await sut.quickHealthCheck()
        XCTAssertTrue(result)
    }

    func testQuickHealthCheck_groupedNotificationsCountCorrectly() async {
        // 2 DB mappings share 1 OS notification (grouped) → should match
        let today = DateFormatting.dateString(from: Date())
        let mapping1 = makeMapping(id: "map-1", notificationId: "os-grouped", medicationId: "med-1", date: today, isGrouped: true)
        let mapping2 = makeMapping(id: "map-2", notificationId: "os-grouped", medicationId: "med-2", date: today, isGrouped: true)
        mockScheduledNotificationRepo.notifications = [mapping1, mapping2]

        let request = makeMedicationPendingRequest(id: "os-grouped", grouped: true)
        mockNotificationService.pendingRequests = [request]

        let result = await sut.quickHealthCheck()
        XCTAssertTrue(result)
    }

    func testQuickHealthCheck_dbError_returnsFalse() async {
        mockScheduledNotificationRepo.errorToThrow = TestError.mockError("DB error")
        mockNotificationService.pendingRequests = []

        let result = await sut.quickHealthCheck()
        XCTAssertFalse(result)
    }

    // MARK: - Helpers

    private func makeMapping(
        id: String = "map-1",
        notificationId: String,
        medicationId: String = "med-1",
        date: String,
        isGrouped: Bool = false
    ) -> ScheduledNotification {
        ScheduledNotification(
            id: id,
            medicationId: medicationId,
            scheduleId: "sched-1",
            date: date,
            notificationId: notificationId,
            notificationType: .reminder,
            isGrouped: isGrouped,
            groupKey: isGrouped ? "08:00_reminder" : nil,
            sourceType: .medication,
            medicationName: "Test Med",
            scheduledTriggerTime: "08:00",
            notificationTitle: "Medication Reminder",
            notificationBody: "Time to take Test Med",
            categoryIdentifier: isGrouped ? NotificationCategory.multipleMedication : NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )
    }

    private func makeMedicationPendingRequest(id: String, grouped: Bool = false) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        if grouped {
            content.userInfo = ["medicationIds": ["med-1", "med-2"], "scheduleIds": ["s1", "s2"]]
            content.categoryIdentifier = NotificationCategory.multipleMedication
        } else {
            content.userInfo = ["medicationId": "med-1", "scheduleId": "sched-1"]
            content.categoryIdentifier = NotificationCategory.medication
        }
        return UNNotificationRequest(identifier: id, content: content, trigger: nil)
    }
}
