import XCTest

/// Test Suite 6: Medication Archiving
/// Tests archive, verify hidden, find in archive, restore, verify restored.
final class MedicationArchivingUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchWithFixtures()

        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - 6.1 Archive and restore workflow

    func testArchiveAndRestoreWorkflow() throws {
        // === Phase 1-2: Navigate ===

        // Step 1: Go to Medications tab
        UITestHelpers.navigateTo(tab: .medications, in: app)
        let topCard = app.buttons["medication-card-Test Topiramate"]
        UITestHelpers.waitForElement(topCard)

        // Step 2: Tap medication
        topCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Phase 3-4: Archive ===

        // Step 3: Scroll to "Archive Medication" button
        let scroll = app.scrollViews.firstMatch
        let archiveButton = app.buttons["archive-medication-button"]
        UITestHelpers.scrollToElement(archiveButton, in: scroll)
        UITestHelpers.waitForHittable(archiveButton)
        archiveButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 4: Confirm archive
        let confirmArchive = app.alerts.buttons["Archive"]
        if confirmArchive.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            confirmArchive.tap()
            // Wait for alert to dismiss fully
            Thread.sleep(forTimeInterval: 1)
        }

        // === Phase 5: Verify hidden ===

        // Step 5: After archiving, the app auto-dismisses back to the medications list.
        // Wait for the Medications list title to appear
        let medsTitle = app.navigationBars.staticTexts["Medications"]
        UITestHelpers.waitForElement(medsTitle, timeout: 10)

        // Navigate away and back to force a data refresh
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        Thread.sleep(forTimeInterval: 0.5)
        UITestHelpers.navigateTo(tab: .medications, in: app)
        Thread.sleep(forTimeInterval: 1)

        // "Test Topiramate" should not be in the active medications list
        let hiddenCard = app.buttons["medication-card-Test Topiramate"]
        XCTAssertFalse(hiddenCard.exists, "Archived medication should not appear in active list")

        // === Phase 6-7: Find in archive ===

        // Step 6: Tap "Archived" link
        let archivedLink = app.buttons["archived-medications-link"]
        UITestHelpers.waitForHittable(archivedLink)
        archivedLink.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 7: Medication visible with Restore button
        let archivedMed = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Test Topiramate'")).firstMatch
        UITestHelpers.waitForElement(archivedMed)

        // === Phase 8: Restore ===

        // Step 8: Tap Restore
        let restoreButton = app.buttons["restore-medication-Test Topiramate"]
        UITestHelpers.waitForHittable(restoreButton)
        restoreButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Confirm if needed
        let confirmRestore = app.alerts.buttons["Restore"]
        if confirmRestore.waitForExistence(timeout: 2) {
            confirmRestore.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // === Phase 9: Verify restored ===

        // Step 9: Go back to active list
        let archivedBackButton = app.navigationBars.buttons.firstMatch
        if archivedBackButton.exists && archivedBackButton.isHittable {
            archivedBackButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // "Test Topiramate" visible again
        let restoredCard = app.buttons["medication-card-Test Topiramate"]
        UITestHelpers.waitForElement(restoredCard)

        // === Phase 10: Dose history preserved ===

        // Step 10: Go to Dashboard
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        let medsCard = app.staticTexts["Today's Medications"]
        UITestHelpers.waitForElement(medsCard)

        // Step 11: Log a dose
        let logButton = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Log'")).firstMatch
        if logButton.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            logButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            let takenLabel = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Taken at'")).firstMatch
            UITestHelpers.waitForElement(takenLabel)
        }
    }

    // MARK: - 6.2 Archive medication with active reminders

    func testArchiveMedicationWithReminders() throws {
        // Step 1: Archive medication
        UITestHelpers.navigateTo(tab: .medications, in: app)
        let topCard = app.buttons["medication-card-Test Topiramate"]
        UITestHelpers.waitForHittable(topCard)
        topCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let scroll = app.scrollViews.firstMatch
        let archiveButton = app.buttons["archive-medication-button"]
        UITestHelpers.scrollToElement(archiveButton, in: scroll)
        archiveButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let confirmArchive = app.alerts.buttons["Archive"]
        if confirmArchive.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            confirmArchive.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // After archiving, app auto-dismisses to the medications list.
        let medsTitle = app.navigationBars.staticTexts["Medications"]
        UITestHelpers.waitForElement(medsTitle, timeout: 10)

        // Step 2: Go to Dashboard — navigate via tab to force fresh load
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        Thread.sleep(forTimeInterval: 1)
        let topText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Test Topiramate'")).firstMatch
        XCTAssertFalse(topText.exists, "Archived medication should not appear in Today's Medications")

        // Step 3: Restore the medication
        UITestHelpers.navigateTo(tab: .medications, in: app)
        let archivedLink = app.buttons["archived-medications-link"]
        UITestHelpers.waitForHittable(archivedLink)
        archivedLink.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let restoreButton = app.buttons["restore-medication-Test Topiramate"]
        UITestHelpers.waitForHittable(restoreButton)
        restoreButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let confirmRestore = app.alerts.buttons["Restore"]
        if confirmRestore.waitForExistence(timeout: 2) {
            confirmRestore.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // Step 4: Go to Dashboard, medication reappears
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        let restoredText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Test Topiramate'")).firstMatch
        UITestHelpers.waitForElement(restoredText)
    }
}
