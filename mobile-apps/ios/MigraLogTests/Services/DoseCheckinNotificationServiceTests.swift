import XCTest
import UserNotifications
@testable import MigraLog

// MARK: - Mock Dose Checkin Notification Service

final class MockDoseCheckinNotificationService: DoseCheckinNotificationServiceProtocol, @unchecked Sendable {
    var scheduledDoseIds: [String] = []
    var cancelledEpisodeIds: [String] = []

    func scheduleCheckin(for dose: MedicationDose) async {
        scheduledDoseIds.append(dose.id)
    }

    func cancelCheckins(forEpisodeId episodeId: String) async {
        cancelledEpisodeIds.append(episodeId)
    }
}

// MARK: - Tests

final class DoseCheckinNotificationServiceTests: XCTestCase {
    private var sut: DoseCheckinNotificationService!
    private var mockNotificationService: MockNotificationService!
    private var mockMedicationRepo: MockMedicationRepository!

    private let rescueMed = TestFixtures.makeMedication(id: "med-rescue", type: .rescue)
    private let preventativeMed = TestFixtures.makeMedication(id: "med-prev", type: .preventative)

    override func setUp() {
        super.setUp()
        mockNotificationService = MockNotificationService()
        mockMedicationRepo = MockMedicationRepository()
        mockMedicationRepo.medications = [rescueMed, preventativeMed]

        UserDefaults.standard.set(true, forKey: FeatureFlag.doseCheckin.storageKey)
        UserDefaults.standard.set(true, forKey: "notifications_enabled")

        sut = DoseCheckinNotificationService(
            notificationService: mockNotificationService,
            medicationRepo: mockMedicationRepo
        )
    }

    override func tearDown() {
        sut = nil
        mockNotificationService = nil
        mockMedicationRepo = nil
        UserDefaults.standard.removeObject(forKey: FeatureFlag.doseCheckin.storageKey)
        UserDefaults.standard.removeObject(forKey: "notifications_enabled")
        super.tearDown()
    }

    // MARK: - Scheduling

    func testScheduleCheckin_schedulesForTakenRescueDoseInEpisode() async throws {
        let dose = makeDose(id: "dose-1", medicationId: "med-rescue", episodeId: "ep-1")

        await sut.scheduleCheckin(for: dose)

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 1)
        let scheduled = try XCTUnwrap(mockNotificationService.scheduledNotifications.first)
        XCTAssertEqual(scheduled.id, "dose_checkin_dose-1")
        XCTAssertEqual(scheduled.categoryIdentifier, NotificationCategory.doseCheckin)
        XCTAssertEqual(scheduled.userInfo?["episodeId"] as? String, "ep-1")
        XCTAssertEqual(scheduled.userInfo?["doseId"] as? String, "dose-1")
        XCTAssertEqual(scheduled.userInfo?["type"] as? String, "dose_checkin")

        let trigger = try XCTUnwrap(scheduled.trigger as? UNTimeIntervalNotificationTrigger)
        XCTAssertEqual(trigger.timeInterval, DoseCheckinNotificationService.checkinDelay)
        XCTAssertFalse(trigger.repeats)
    }

    func testScheduleCheckin_skipsWhenFlagOff() async {
        UserDefaults.standard.removeObject(forKey: FeatureFlag.doseCheckin.storageKey)
        let dose = makeDose(id: "dose-1", medicationId: "med-rescue", episodeId: "ep-1")

        await sut.scheduleCheckin(for: dose)

        XCTAssertTrue(mockNotificationService.scheduledNotifications.isEmpty)
    }

    func testScheduleCheckin_skipsWhenNotificationsDisabled() async {
        UserDefaults.standard.set(false, forKey: "notifications_enabled")
        let dose = makeDose(id: "dose-1", medicationId: "med-rescue", episodeId: "ep-1")

        await sut.scheduleCheckin(for: dose)

        XCTAssertTrue(mockNotificationService.scheduledNotifications.isEmpty)
    }

    func testScheduleCheckin_skipsSkippedDose() async {
        let dose = makeDose(id: "dose-1", medicationId: "med-rescue", episodeId: "ep-1", status: .skipped)

        await sut.scheduleCheckin(for: dose)

        XCTAssertTrue(mockNotificationService.scheduledNotifications.isEmpty)
    }

    func testScheduleCheckin_skipsDoseOutsideEpisode() async {
        let dose = makeDose(id: "dose-1", medicationId: "med-rescue", episodeId: nil)

        await sut.scheduleCheckin(for: dose)

        XCTAssertTrue(mockNotificationService.scheduledNotifications.isEmpty)
    }

    func testScheduleCheckin_skipsPreventativeMedication() async {
        let dose = makeDose(id: "dose-1", medicationId: "med-prev", episodeId: "ep-1")

        await sut.scheduleCheckin(for: dose)

        XCTAssertTrue(mockNotificationService.scheduledNotifications.isEmpty)
    }

    func testScheduleCheckin_skipsWhenMedicationNotFound() async {
        let dose = makeDose(id: "dose-1", medicationId: "med-unknown", episodeId: "ep-1")

        await sut.scheduleCheckin(for: dose)

        XCTAssertTrue(mockNotificationService.scheduledNotifications.isEmpty)
    }

    // MARK: - Superseding

    func testScheduleCheckin_newDoseReplacesPendingCheckinForSameEpisode() async {
        mockNotificationService.pendingRequests = [
            makeCheckinRequest(doseId: "dose-old", episodeId: "ep-1")
        ]
        let dose = makeDose(id: "dose-new", medicationId: "med-rescue", episodeId: "ep-1")

        await sut.scheduleCheckin(for: dose)

        XCTAssertEqual(mockNotificationService.cancelledIds, ["dose_checkin_dose-old"])
        XCTAssertEqual(mockNotificationService.scheduledNotifications.map(\.id), ["dose_checkin_dose-new"])
    }

    func testScheduleCheckin_keepsPendingCheckinForOtherEpisode() async {
        mockNotificationService.pendingRequests = [
            makeCheckinRequest(doseId: "dose-old", episodeId: "ep-other")
        ]
        let dose = makeDose(id: "dose-new", medicationId: "med-rescue", episodeId: "ep-1")

        await sut.scheduleCheckin(for: dose)

        XCTAssertTrue(mockNotificationService.cancelledIds.isEmpty)
    }

    // MARK: - Cancellation

    func testCancelCheckins_cancelsOnlyMatchingEpisode() async {
        mockNotificationService.pendingRequests = [
            makeCheckinRequest(doseId: "dose-1", episodeId: "ep-1"),
            makeCheckinRequest(doseId: "dose-2", episodeId: "ep-2")
        ]

        await sut.cancelCheckins(forEpisodeId: "ep-1")

        XCTAssertEqual(mockNotificationService.cancelledIds, ["dose_checkin_dose-1"])
    }

    func testCancelCheckins_ignoresNonCheckinNotifications() async {
        let content = UNMutableNotificationContent()
        content.userInfo = ["episodeId": "ep-1"]
        mockNotificationService.pendingRequests = [
            UNNotificationRequest(identifier: "daily_checkin_2026-07-19", content: content, trigger: nil)
        ]

        await sut.cancelCheckins(forEpisodeId: "ep-1")

        XCTAssertTrue(mockNotificationService.cancelledIds.isEmpty)
    }

    // MARK: - Helpers

    private func makeDose(
        id: String,
        medicationId: String,
        episodeId: String?,
        status: DoseStatus = .taken
    ) -> MedicationDose {
        let now = TimestampHelper.now
        return MedicationDose(
            id: id,
            medicationId: medicationId,
            timestamp: now,
            quantity: 1,
            dosageAmount: 400,
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

    private func makeCheckinRequest(doseId: String, episodeId: String) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.userInfo = ["type": "dose_checkin", "doseId": doseId, "episodeId": episodeId]
        return UNNotificationRequest(
            identifier: DoseCheckinNotificationService.idPrefix + doseId,
            content: content,
            trigger: nil
        )
    }
}
