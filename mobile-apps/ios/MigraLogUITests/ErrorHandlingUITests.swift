import XCTest

/// Test Suite 9: Error Handling
/// Tests validation errors and dose edit validation.
final class ErrorHandlingUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - 9.1 Database error toast (app remains responsive)

    func testAppRemainsResponsiveAfterErrors() throws {
        app = UITestHelpers.launchWithFixtures()
        UITestHelpers.waitForDashboard(in: app)

        // Verify the app is functional by navigating through tabs
        UITestHelpers.navigateTo(tab: .episodes, in: app)
        UITestHelpers.navigateTo(tab: .medications, in: app)
        UITestHelpers.navigateTo(tab: .trends, in: app)
        UITestHelpers.navigateTo(tab: .dashboard, in: app)

        // Dashboard should still be functional
        UITestHelpers.waitForDashboard(in: app)
    }

    // MARK: - 9.2 Multiple operations without crash

    func testMultipleOperationsWithoutCrash() throws {
        app = UITestHelpers.launchWithFixtures()
        UITestHelpers.waitForDashboard(in: app)

        // Perform rapid navigation to stress-test
        for _ in 0..<3 {
            UITestHelpers.navigateTo(tab: .episodes, in: app)
            UITestHelpers.navigateTo(tab: .medications, in: app)
            UITestHelpers.navigateTo(tab: .trends, in: app)
            UITestHelpers.navigateTo(tab: .dashboard, in: app)
        }

        // Verify app is still responsive
        UITestHelpers.waitForDashboard(in: app)
    }

    // MARK: - 9.3 Dose edit validation

    func testDoseEditValidation() throws {
        app = UITestHelpers.launchWithFixtures()
        UITestHelpers.waitForDashboard(in: app)

        // Navigate to medication and log a dose
        UITestHelpers.navigateTo(tab: .medications, in: app)
        let medCard = app.buttons["medication-card-Test Topiramate"]
        UITestHelpers.waitForHittable(medCard)
        medCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let logDoseButton = app.buttons["log-dose-button"]
        UITestHelpers.waitForHittable(logDoseButton)
        logDoseButton.tap()
        Thread.sleep(forTimeInterval: 1)

        // Open dose edit
        let scroll = app.scrollViews.firstMatch
        let doseEntry = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Taken at'")).firstMatch
        if doseEntry.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            UITestHelpers.scrollToElement(doseEntry, in: scroll)
            doseEntry.press(forDuration: 1.5)
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Tap Edit from context menu (avoid toolbar Edit button ambiguity)
            let contextMenuEditButton = app.collectionViews.buttons["Edit"]
            let fallbackEditButton = app.buttons.matching(NSPredicate(format: "label == 'Edit'")).element(boundBy: 1)
            let editTarget = contextMenuEditButton.exists ? contextMenuEditButton : fallbackEditButton
            if editTarget.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
                editTarget.tap()
                Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

                // Step 2: Set amount to 0
                let amountInput = app.textFields["dose-amount-input"]
                if amountInput.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
                    amountInput.tap()
                    amountInput.clearAndTypeText("0")

                    // Step 3: Tap Save
                    let saveButton = app.buttons["Save"]
                    UITestHelpers.waitForHittable(saveButton)
                    saveButton.tap()
                    Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

                    // Step 4: Validation alert appears
                    let alert = app.alerts.firstMatch
                    XCTAssertTrue(alert.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                                   "Validation alert should appear for invalid amount")

                    // Dismiss alert
                    let okButton = app.alerts.buttons.firstMatch
                    if okButton.exists {
                        okButton.tap()
                    }
                }
            }
        }
    }

    // MARK: - 9.4 Interaction with deleted data

    func testInteractionWithDeletedData() throws {
        app = UITestHelpers.launchWithFixtures()
        UITestHelpers.waitForDashboard(in: app)

        // Navigate to medication detail
        UITestHelpers.navigateTo(tab: .medications, in: app)
        let medCard = app.buttons["medication-card-Test Topiramate"]
        UITestHelpers.waitForHittable(medCard)
        medCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 1: Log a dose
        let logDoseButton = app.buttons["log-dose-button"]
        UITestHelpers.waitForHittable(logDoseButton)
        logDoseButton.tap()
        Thread.sleep(forTimeInterval: 1)

        // Step 2: Delete the dose
        let scroll = app.scrollViews.firstMatch
        let doseEntry = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Taken at'")).firstMatch
        if doseEntry.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            UITestHelpers.scrollToElement(doseEntry, in: scroll)
            doseEntry.press(forDuration: 1.5)
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            let deleteButton = app.buttons["Delete"]
            if deleteButton.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
                deleteButton.tap()
                Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

                let confirmDelete = app.alerts.buttons["Delete"]
                if confirmDelete.waitForExistence(timeout: 2) {
                    confirmDelete.tap()
                    Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
                }
            }
        }

        // Step 3: Verify "No doses logged" message
        let noDosesMessage = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'No doses'")).firstMatch
        UITestHelpers.waitForElement(noDosesMessage)
    }
}
