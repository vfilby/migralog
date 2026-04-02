import XCTest
import UserNotifications
@testable import MigraLog

// MARK: - Local Mocks

private final class MockDailyCheckinService: DailyCheckinNotificationServiceProtocol, @unchecked Sendable {
    var scheduleNotificationsCalled = false
    var cancelAllCalled = false
    var errorToThrow: Error?

    func scheduleNotifications() async throws {
        if let error = errorToThrow { throw error }
        scheduleNotificationsCalled = true
    }

    func cancelAll() async {
        cancelAllCalled = true
    }

    func cancelForDate(_ date: String) async {}
    func topUp() async {}
    func isScheduled() async -> Bool { false }
}

private final class MockNotifService: NotificationServiceProtocol, @unchecked Sendable {
    var permissionGranted = true
    var requestPermissionCalled = false

    func requestPermission() async -> Bool {
        requestPermissionCalled = true
        return permissionGranted
    }

    func scheduleNotification(
        id: String, title: String, body: String,
        trigger: UNNotificationTrigger,
        categoryIdentifier: String?, userInfo: [String: Any]?
    ) async throws {}

    func cancelNotification(id: String) {}
    func cancelAllNotifications() {}
    func getPendingNotifications() async -> [UNNotificationRequest] { [] }
    func getDeliveredNotifications() async -> [UNNotification] { [] }
    func removeDeliveredNotification(id: String) {}
}

private final class MockMedNotifService: MedicationNotificationServiceProtocol, @unchecked Sendable {
    var rescheduleAllCalled = false
    var errorToThrow: Error?

    func rescheduleAllMedicationNotifications() async throws {
        if let error = errorToThrow { throw error }
        rescheduleAllCalled = true
    }

    func cancelMedicationReminders(for medicationId: String) async {}
    func cancelNotificationForDate(medicationId: String, scheduleId: String, date: String, notificationType: NotificationType) async {}
    func dismissMedicationNotification(medicationId: String, scheduleId: String) async {}
    func handleTakenResponse(medicationId: String, scheduleId: String) async {}
    func handleSkippedResponse(medicationId: String, scheduleId: String) async {}
    func topUp(threshold: Int) async {}
    func rebalance() async {}
}

// MARK: - Tests

@MainActor
final class NotificationSettingsViewModelTests: XCTestCase {
    private var defaults: UserDefaults!
    private var mockCheckinService: MockDailyCheckinService!
    private var mockNotifService: MockNotifService!
    private var mockMedNotifService: MockMedNotifService!
    private var sut: NotificationSettingsViewModel!

    private let suiteName = "NotificationSettingsViewModelTests"

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        mockCheckinService = MockDailyCheckinService()
        mockNotifService = MockNotifService()
        mockMedNotifService = MockMedNotifService()
        sut = NotificationSettingsViewModel(
            defaults: defaults,
            dailyCheckinService: mockCheckinService,
            notificationService: mockNotifService,
            medicationNotificationService: mockMedNotifService
        )
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        sut = nil
        mockCheckinService = nil
        mockNotifService = nil
        mockMedNotifService = nil
        super.tearDown()
    }

    // MARK: - Default Values

    func testDefaultValues_whenNoUserDefaults() {
        // Don't call loadSettings — check raw defaults on a fresh VM
        let vm = NotificationSettingsViewModel(
            defaults: defaults,
            dailyCheckinService: mockCheckinService,
            notificationService: mockNotifService
        )

        XCTAssertTrue(vm.notificationsEnabled)
        XCTAssertFalse(vm.timeSensitiveEnabled)
        XCTAssertEqual(vm.followUpDelay, 30)
        XCTAssertFalse(vm.criticalAlertsEnabled)
        XCTAssertTrue(vm.dailyCheckinEnabled)
        XCTAssertTrue(vm.medicationOverrides.isEmpty)
        XCTAssertNil(vm.error)
    }

    // MARK: - loadSettings

    func testLoadSettings_readsAllKeysFromDefaults() {
        defaults.set(false, forKey: "notifications_enabled")
        defaults.set(true, forKey: "notification_time_sensitive_enabled")
        defaults.set(60, forKey: "notification_follow_up_delay")
        defaults.set(true, forKey: "notification_critical_alerts_enabled")
        defaults.set(false, forKey: "daily_checkin_enabled")

        let refDate = Date(timeIntervalSinceReferenceDate: 100_000)
        defaults.set(refDate.timeIntervalSinceReferenceDate, forKey: "daily_checkin_time")

        sut.loadSettings()

        XCTAssertFalse(sut.notificationsEnabled)
        XCTAssertTrue(sut.timeSensitiveEnabled)
        XCTAssertEqual(sut.followUpDelay, 60)
        XCTAssertTrue(sut.criticalAlertsEnabled)
        XCTAssertFalse(sut.dailyCheckinEnabled)
        XCTAssertEqual(sut.dailyCheckinTime.timeIntervalSinceReferenceDate, 100_000, accuracy: 0.001)
    }

    func testLoadSettings_defaultsWhenEmpty() {
        sut.loadSettings()

        XCTAssertTrue(sut.notificationsEnabled)
        XCTAssertFalse(sut.timeSensitiveEnabled)
        XCTAssertEqual(sut.followUpDelay, 30)
        XCTAssertFalse(sut.criticalAlertsEnabled)
        XCTAssertTrue(sut.dailyCheckinEnabled)
    }

    func testLoadSettings_loadsMedicationOverrides() {
        let overrides = [
            MedicationNotificationOverride(medicationId: "med-1", enabled: true, timeSensitive: true, followUpDelay: 15),
            MedicationNotificationOverride(medicationId: "med-2", enabled: false, timeSensitive: false, followUpDelay: 45),
        ]
        let data = try! JSONEncoder().encode(overrides)
        defaults.set(data, forKey: "notification_medication_overrides")

        sut.loadSettings()

        XCTAssertEqual(sut.medicationOverrides.count, 2)
        XCTAssertEqual(sut.medicationOverrides[0].medicationId, "med-1")
        XCTAssertTrue(sut.medicationOverrides[0].enabled)
        XCTAssertEqual(sut.medicationOverrides[1].medicationId, "med-2")
        XCTAssertFalse(sut.medicationOverrides[1].enabled)
    }

    func testLoadSettings_invalidOverrideData_keepsEmpty() {
        defaults.set(Data("not json".utf8), forKey: "notification_medication_overrides")

        sut.loadSettings()

        XCTAssertTrue(sut.medicationOverrides.isEmpty)
    }

    // MARK: - saveSettings

    func testSaveSettings_persistsAllValues() {
        sut.notificationsEnabled = false
        sut.timeSensitiveEnabled = true
        sut.followUpDelay = 45
        sut.criticalAlertsEnabled = true
        sut.dailyCheckinEnabled = false
        let refDate = Date(timeIntervalSinceReferenceDate: 200_000)
        sut.dailyCheckinTime = refDate

        sut.saveSettings()

        XCTAssertEqual(defaults.bool(forKey: "notifications_enabled"), false)
        XCTAssertEqual(defaults.bool(forKey: "notification_time_sensitive_enabled"), true)
        XCTAssertEqual(defaults.integer(forKey: "notification_follow_up_delay"), 45)
        XCTAssertEqual(defaults.bool(forKey: "notification_critical_alerts_enabled"), true)
        XCTAssertEqual(defaults.bool(forKey: "daily_checkin_enabled"), false)
        XCTAssertEqual(defaults.double(forKey: "daily_checkin_time"), 200_000, accuracy: 0.001)
    }

    func testSaveSettings_persistsMedicationOverrides() {
        sut.medicationOverrides = [
            MedicationNotificationOverride(medicationId: "med-1", enabled: true, timeSensitive: false, followUpDelay: 30)
        ]

        sut.saveSettings()

        let data = defaults.data(forKey: "notification_medication_overrides")
        XCTAssertNotNil(data)
        let decoded = try! JSONDecoder().decode([MedicationNotificationOverride].self, from: data!)
        XCTAssertEqual(decoded.count, 1)
        XCTAssertEqual(decoded[0].medicationId, "med-1")
    }

    // MARK: - syncDailyCheckinNotification

    func testSyncDailyCheckin_enabled_requestsPermissionAndSchedules() async {
        sut.dailyCheckinEnabled = true
        sut.notificationsEnabled = true

        await sut.syncDailyCheckinNotification()

        XCTAssertTrue(mockNotifService.requestPermissionCalled)
        XCTAssertTrue(mockCheckinService.scheduleNotificationsCalled)
        XCTAssertNil(sut.error)
    }

    func testSyncDailyCheckin_disabled_cancelsAll() async {
        sut.dailyCheckinEnabled = false
        sut.notificationsEnabled = true

        await sut.syncDailyCheckinNotification()

        XCTAssertTrue(mockCheckinService.cancelAllCalled)
        XCTAssertFalse(mockCheckinService.scheduleNotificationsCalled)
    }

    func testSyncDailyCheckin_notificationsDisabled_cancelsAll() async {
        sut.dailyCheckinEnabled = true
        sut.notificationsEnabled = false

        await sut.syncDailyCheckinNotification()

        XCTAssertTrue(mockCheckinService.cancelAllCalled)
        XCTAssertFalse(mockCheckinService.scheduleNotificationsCalled)
    }

    func testSyncDailyCheckin_scheduleError_setsErrorMessage() async {
        sut.dailyCheckinEnabled = true
        sut.notificationsEnabled = true
        mockCheckinService.errorToThrow = TestError.mockError("Schedule failed")

        await sut.syncDailyCheckinNotification()

        XCTAssertNotNil(sut.error)
        XCTAssertEqual(sut.error, "Schedule failed")
    }

    // MARK: - syncMedicationNotifications

    func testSyncMedicationNotifications_callsRescheduleAll() async {
        await sut.syncMedicationNotifications()

        XCTAssertTrue(mockMedNotifService.rescheduleAllCalled)
    }

    func testSyncMedicationNotifications_noService_noOp() async {
        let vm = NotificationSettingsViewModel(
            defaults: defaults,
            dailyCheckinService: mockCheckinService,
            notificationService: mockNotifService,
            medicationNotificationService: nil
        )

        // Should not crash
        await vm.syncMedicationNotifications()
    }

    // MARK: - updateGlobalSettings

    func testUpdateGlobalSettings_timeSensitive() {
        sut.updateGlobalSettings(timeSensitive: true)

        XCTAssertTrue(sut.timeSensitiveEnabled)
        XCTAssertTrue(defaults.bool(forKey: "notification_time_sensitive_enabled"))
    }

    func testUpdateGlobalSettings_followUpDelay() {
        sut.updateGlobalSettings(followUpDelay: 60)

        XCTAssertEqual(sut.followUpDelay, 60)
        XCTAssertEqual(defaults.integer(forKey: "notification_follow_up_delay"), 60)
    }

    func testUpdateGlobalSettings_criticalAlerts() {
        sut.updateGlobalSettings(criticalAlerts: true)

        XCTAssertTrue(sut.criticalAlertsEnabled)
        XCTAssertTrue(defaults.bool(forKey: "notification_critical_alerts_enabled"))
    }

    func testUpdateGlobalSettings_multipleValues() {
        sut.updateGlobalSettings(timeSensitive: true, followUpDelay: 90, criticalAlerts: true)

        XCTAssertTrue(sut.timeSensitiveEnabled)
        XCTAssertEqual(sut.followUpDelay, 90)
        XCTAssertTrue(sut.criticalAlertsEnabled)
    }

    func testUpdateGlobalSettings_nilValuesUnchanged() {
        sut.timeSensitiveEnabled = true
        sut.followUpDelay = 42
        sut.criticalAlertsEnabled = true

        sut.updateGlobalSettings()

        XCTAssertTrue(sut.timeSensitiveEnabled)
        XCTAssertEqual(sut.followUpDelay, 42)
        XCTAssertTrue(sut.criticalAlertsEnabled)
    }

    // MARK: - updateMedicationSettings

    func testUpdateMedicationSettings_addsNewOverride() {
        let override = MedicationNotificationOverride(
            medicationId: "med-1", enabled: true, timeSensitive: true, followUpDelay: 15
        )

        sut.updateMedicationSettings(override)

        XCTAssertEqual(sut.medicationOverrides.count, 1)
        XCTAssertEqual(sut.medicationOverrides[0].medicationId, "med-1")
        XCTAssertTrue(sut.medicationOverrides[0].timeSensitive)

        // Verify persisted
        let data = defaults.data(forKey: "notification_medication_overrides")
        XCTAssertNotNil(data)
    }

    func testUpdateMedicationSettings_updatesExistingOverride() {
        let original = MedicationNotificationOverride(
            medicationId: "med-1", enabled: true, timeSensitive: false, followUpDelay: 30
        )
        sut.updateMedicationSettings(original)

        let updated = MedicationNotificationOverride(
            medicationId: "med-1", enabled: false, timeSensitive: true, followUpDelay: 60
        )
        sut.updateMedicationSettings(updated)

        XCTAssertEqual(sut.medicationOverrides.count, 1)
        XCTAssertFalse(sut.medicationOverrides[0].enabled)
        XCTAssertTrue(sut.medicationOverrides[0].timeSensitive)
        XCTAssertEqual(sut.medicationOverrides[0].followUpDelay, 60)
    }

    func testUpdateMedicationSettings_multipleOverrides() {
        sut.updateMedicationSettings(MedicationNotificationOverride(
            medicationId: "med-1", enabled: true, timeSensitive: false, followUpDelay: 30
        ))
        sut.updateMedicationSettings(MedicationNotificationOverride(
            medicationId: "med-2", enabled: false, timeSensitive: true, followUpDelay: 15
        ))

        XCTAssertEqual(sut.medicationOverrides.count, 2)
    }

    // MARK: - removeMedicationSettings

    func testRemoveMedicationSettings_removesById() {
        sut.updateMedicationSettings(MedicationNotificationOverride(
            medicationId: "med-1", enabled: true, timeSensitive: false, followUpDelay: 30
        ))
        sut.updateMedicationSettings(MedicationNotificationOverride(
            medicationId: "med-2", enabled: true, timeSensitive: false, followUpDelay: 30
        ))

        sut.removeMedicationSettings(medicationId: "med-1")

        XCTAssertEqual(sut.medicationOverrides.count, 1)
        XCTAssertEqual(sut.medicationOverrides[0].medicationId, "med-2")
    }

    func testRemoveMedicationSettings_nonexistentId_noOp() {
        sut.updateMedicationSettings(MedicationNotificationOverride(
            medicationId: "med-1", enabled: true, timeSensitive: false, followUpDelay: 30
        ))

        sut.removeMedicationSettings(medicationId: "med-999")

        XCTAssertEqual(sut.medicationOverrides.count, 1)
    }

    func testRemoveMedicationSettings_persistsChange() {
        sut.updateMedicationSettings(MedicationNotificationOverride(
            medicationId: "med-1", enabled: true, timeSensitive: false, followUpDelay: 30
        ))

        sut.removeMedicationSettings(medicationId: "med-1")

        let data = defaults.data(forKey: "notification_medication_overrides")
        XCTAssertNotNil(data)
        let decoded = try! JSONDecoder().decode([MedicationNotificationOverride].self, from: data!)
        XCTAssertTrue(decoded.isEmpty)
    }

    // MARK: - MedicationNotificationOverride Identifiable

    func testMedicationOverride_idEqualsMedicationId() {
        let override = MedicationNotificationOverride(
            medicationId: "med-42", enabled: true, timeSensitive: false, followUpDelay: 30
        )
        XCTAssertEqual(override.id, "med-42")
    }

    func testMedicationOverride_equatable() {
        let a = MedicationNotificationOverride(medicationId: "m1", enabled: true, timeSensitive: false, followUpDelay: 30)
        let b = MedicationNotificationOverride(medicationId: "m1", enabled: true, timeSensitive: false, followUpDelay: 30)
        let c = MedicationNotificationOverride(medicationId: "m1", enabled: false, timeSensitive: false, followUpDelay: 30)

        XCTAssertEqual(a, b)
        XCTAssertNotEqual(a, c)
    }

    // MARK: - Round-trip

    func testSaveAndLoad_roundTrip() {
        sut.notificationsEnabled = false
        sut.timeSensitiveEnabled = true
        sut.followUpDelay = 99
        sut.criticalAlertsEnabled = true
        sut.dailyCheckinEnabled = false
        sut.medicationOverrides = [
            MedicationNotificationOverride(medicationId: "med-1", enabled: true, timeSensitive: true, followUpDelay: 10)
        ]
        let time = Date(timeIntervalSinceReferenceDate: 50_000)
        sut.dailyCheckinTime = time

        sut.saveSettings()

        // Create a new VM and load
        let vm2 = NotificationSettingsViewModel(
            defaults: defaults,
            dailyCheckinService: mockCheckinService,
            notificationService: mockNotifService
        )
        vm2.loadSettings()

        XCTAssertFalse(vm2.notificationsEnabled)
        XCTAssertTrue(vm2.timeSensitiveEnabled)
        XCTAssertEqual(vm2.followUpDelay, 99)
        XCTAssertTrue(vm2.criticalAlertsEnabled)
        XCTAssertFalse(vm2.dailyCheckinEnabled)
        XCTAssertEqual(vm2.dailyCheckinTime.timeIntervalSinceReferenceDate, 50_000, accuracy: 0.001)
        XCTAssertEqual(vm2.medicationOverrides.count, 1)
        XCTAssertEqual(vm2.medicationOverrides[0].medicationId, "med-1")
    }
}
