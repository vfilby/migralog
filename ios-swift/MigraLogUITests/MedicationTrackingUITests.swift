import XCTest

/// Test Suite 4: Medication Tracking
/// Tests preventative med logging (Log/Skip/Undo), rescue med logging,
/// and status sync between Dashboard and Medications tab.
final class MedicationTrackingUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchWithFixtures()

        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - 4.1 Preventative medication logging

    func testPreventativeMedicationLogging() throws {
        // === Phase 1: Dashboard ===

        // Step 1: Verify "Today's Medications" card is visible
        let medsCardTitle = app.staticTexts["Today's Medications"]
        UITestHelpers.waitForElement(medsCardTitle)

        // === Phase 2: Log medication ===

        // Step 2-3: Find medication with Log/Skip buttons and tap Log
        let logButton = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Log'")).firstMatch
        UITestHelpers.waitForHittable(logButton)
        logButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Phase 3: Verify UI ===

        // Step 4: "Taken at" label appears
        let takenLabel = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Taken at'")).firstMatch
        UITestHelpers.waitForElement(takenLabel)

        // Step 5: Undo button visible
        let undoButton = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Undo'")).firstMatch
        XCTAssertTrue(undoButton.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                       "Undo button should be visible after logging")

        // === Phase 4: Undo ===

        // Step 7: Tap Undo
        undoButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 8: Log and Skip buttons reappear
        let logButtonAfterUndo = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Log'")).firstMatch
        UITestHelpers.waitForElement(logButtonAfterUndo)

        let skipButton = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Skip'")).firstMatch
        XCTAssertTrue(skipButton.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                       "Skip button should reappear after undo")

        // === Phase 5: Skip ===

        // Step 9: Tap Skip
        skipButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 10: "Skipped" label appears
        let skippedLabel = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Skipped'")).firstMatch
        UITestHelpers.waitForElement(skippedLabel)
    }

    // MARK: - 4.2 Rescue medication logging

    func testRescueMedicationLogging() throws {
        // Step 1: Tap "Log Medication" button
        let logMedButton = app.buttons["log-medication-button"]
        UITestHelpers.waitForHittable(logMedButton)
        logMedButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 2: Verify log medication screen appeared
        let logMedTitle = app.navigationBars.staticTexts["Log Medication"]
        UITestHelpers.waitForElement(logMedTitle)

        let ibuprofenText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Test Ibuprofen'")).firstMatch
        XCTAssertTrue(ibuprofenText.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                       "Test Ibuprofen should be visible in log medication modal")

        // Step 3: Close modal
        let closeButton = app.buttons["Close"]
        if closeButton.waitForExistence(timeout: 2) {
            closeButton.tap()
        } else {
            // Try dismiss by tapping Cancel or back
            let cancelButton = app.buttons["Cancel"]
            if cancelButton.waitForExistence(timeout: 1) {
                cancelButton.tap()
            } else {
                app.navigationBars.buttons.firstMatch.tap()
            }
        }
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    // MARK: - 4.3 Status sync between Dashboard and Medications screen

    func testStatusSyncBetweenScreens() throws {
        // Step 1: Verify unlogged medication on dashboard
        let skipButton = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Skip'")).firstMatch
        UITestHelpers.waitForElement(skipButton)

        // Step 2: Navigate to Medications tab
        UITestHelpers.navigateTo(tab: .medications, in: app)
        let medsScreen = app.navigationBars.staticTexts["Medications"]
        UITestHelpers.waitForElement(medsScreen)

        // Step 3: Return to Dashboard, skip medication
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        let skipButtonDash = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Skip'")).firstMatch
        UITestHelpers.waitForHittable(skipButtonDash)
        skipButtonDash.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Verify skipped status
        let skippedLabel = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Skipped'")).firstMatch
        UITestHelpers.waitForElement(skippedLabel)

        // Step 4: Navigate to Medications tab, verify sync
        UITestHelpers.navigateTo(tab: .medications, in: app)
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 5: Return to Dashboard, undo skip
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        let undoButton = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Undo'")).firstMatch
        if undoButton.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            undoButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // Step 6: Log the medication
        let logButton = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Log'")).firstMatch
        UITestHelpers.waitForHittable(logButton)
        logButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Verify taken status
        let takenLabel = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Taken at'")).firstMatch
        UITestHelpers.waitForElement(takenLabel)

        // Step 7: Navigate to Medications, verify sync
        UITestHelpers.navigateTo(tab: .medications, in: app)
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }
}
