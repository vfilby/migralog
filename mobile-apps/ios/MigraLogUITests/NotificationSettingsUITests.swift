import XCTest

/// Test Suite 8: Notification Settings
/// Tests global settings and per-medication overrides.
final class NotificationSettingsUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchWithFixtures()

        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - 8.1 Global notification settings

    func testGlobalNotificationSettings() throws {
        // Step 1: Tap settings gear on dashboard, verify we're on Settings screen
        UITestHelpers.openSettings(in: app)

        // Step 2: Tap "Notifications" (NavigationLink in a List, renders as button)
        let notificationSettings = app.buttons["notification-settings"]
        // In a List, items are scrollable via the table/list itself
        let listView = app.tables.firstMatch.exists ? app.tables.firstMatch : app.collectionViews.firstMatch
        if !notificationSettings.isHittable && listView.exists {
            UITestHelpers.scrollToElement(notificationSettings, in: listView)
        }
        UITestHelpers.waitForHittable(notificationSettings)
        notificationSettings.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 3: Verify notification settings screen opened
        let notifTitle = app.navigationBars.staticTexts["Notification Settings"]
        XCTAssertTrue(notifTitle.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                       "Notification settings screen should be visible")

        // Step 4: Dismiss the permission dialog this screen spawns. Its `.task`
        // auto-requests notification permission (syncDailyCheckinNotification →
        // requestPermission), and on a simulator where permission is still
        // not-determined the system dialog can pop after this test's assertions
        // have already passed. Left up, it outlives the app relaunch and blocks
        // the following tests' taps (2026-07-31 nightly: sank both
        // testPerMedicationNotificationOverrides and
        // testCachedPermissionsNoDialogs). Second call covers the possible
        // Critical Alerts dialog, as in completeOnboarding.
        UITestHelpers.handleSystemAlert(in: app, buttonLabel: "Allow", timeout: 5)
        UITestHelpers.handleSystemAlert(in: app, buttonLabel: "Allow")
    }

    // MARK: - 8.2 Per-medication notification overrides

    func testPerMedicationNotificationOverrides() throws {
        // Step 1: Go to Medications tab, tap "Test Topiramate"
        UITestHelpers.navigateTo(tab: .medications, in: app)
        let medCard = app.buttons["medication-card-Test Topiramate"]
        UITestHelpers.waitForHittable(medCard)
        medCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 2: Scroll to "Notification Overrides" section
        let scroll = app.scrollViews.firstMatch
        let overridesSection = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Notification'")).firstMatch

        UITestHelpers.scrollToElement(overridesSection, in: scroll)

        // Step 3: Verify section is visible / can be expanded
        XCTAssertTrue(overridesSection.exists,
                       "Notification overrides section should be visible on medication detail")
    }
}
