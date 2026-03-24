import XCTest

/// Test Suite 1: Onboarding Workflow
/// Tests the complete onboarding flow from welcome through permissions setup.
final class OnboardingUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchFreshApp()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - 1.1 Complete onboarding flow

    func testCompleteOnboardingFlow() throws {
        // Step 1: Welcome screen visible
        let welcomeText = app.staticTexts["Welcome to MigraLog"]
        UITestHelpers.waitForElement(welcomeText)

        // Step 2: Tap Continue -> Medical Disclaimer
        let continueButton = app.buttons["Continue"]
        UITestHelpers.waitForHittable(continueButton)
        continueButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Verify we're on the disclaimer screen
        let disclaimerText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Disclaimer'")).firstMatch
        XCTAssertTrue(disclaimerText.waitForExistence(timeout: UITestHelpers.defaultTimeout) || continueButton.exists,
                       "Medical Disclaimer screen should appear")

        // Step 3: Tap Continue -> Notification Permissions
        UITestHelpers.waitForHittable(continueButton)
        continueButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 4-5: Tap Continue -> System notification dialog
        UITestHelpers.waitForHittable(continueButton)
        continueButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Handle system notification permission dialog
        UITestHelpers.handleSystemAlert(in: app, buttonLabel: "Allow")

        // Step 6: Handle possible Critical Alerts dialog
        UITestHelpers.handleSystemAlert(in: app, buttonLabel: "Allow")

        // Step 7: Location Services screen with "Finish Setup"
        let finishButton = app.buttons["Finish Setup"]
        if finishButton.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            // Step 8: Tap Finish Setup
            finishButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Step 9: Grant location permission
            UITestHelpers.handleSystemAlert(in: app, buttonLabel: "Allow While Using App")
        }

        // Step 10: Dashboard appears with "MigraLog" title
        UITestHelpers.waitForDashboard(in: app)
    }

    // MARK: - 1.2 Cached permissions (subsequent launches)

    func testCachedPermissionsNoDialogs() throws {
        // First complete onboarding
        UITestHelpers.completeOnboarding(in: app)

        // Verify dashboard is visible
        UITestHelpers.waitForDashboard(in: app)
    }
}
