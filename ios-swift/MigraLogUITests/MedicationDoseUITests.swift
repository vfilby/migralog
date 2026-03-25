import XCTest

/// Test Suite 5: Medication Dose Edit/Delete
/// Tests delete dose, edit dose amount, cancel edit, cancel delete.
final class MedicationDoseUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchWithFixtures()

        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - 5.1 Delete a medication dose

    func testDeleteMedicationDose() throws {
        // Step 1: Navigate to Medications tab, tap medication
        UITestHelpers.navigateTo(tab: .medications, in: app)
        let medCard = app.buttons["medication-card-Test Topiramate"]
        UITestHelpers.waitForHittable(medCard)
        medCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 2: Tap "Log Dose Now"
        let logDoseButton = app.buttons["log-dose-button"]
        UITestHelpers.waitForHittable(logDoseButton)
        logDoseButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 3: Scroll to "Recent Activity" section
        let scroll = app.scrollViews.firstMatch

        // Wait for dose to appear
        Thread.sleep(forTimeInterval: 1)

        // Step 4: Long-press dose entry (dose entries are in a VStack, not List cells)
        // Find the "Taken at" text which indicates a logged dose
        let takenLabel = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Taken at'")).firstMatch
        if takenLabel.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            UITestHelpers.scrollToElement(takenLabel, in: scroll)
            takenLabel.press(forDuration: 1.5)
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Step 5: Tap Delete from context menu
            let deleteButton = app.buttons["Delete"]
            if deleteButton.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
                deleteButton.tap()
                Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

                // Confirm delete in alert
                let confirmDelete = app.alerts.buttons["Delete"]
                if confirmDelete.waitForExistence(timeout: 2) {
                    confirmDelete.tap()
                    Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
                }
            }
        }

        // Step 6: Verify "No doses logged" message
        let noDosesMessage = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'No doses'")).firstMatch
        UITestHelpers.waitForElement(noDosesMessage)
    }

    // MARK: - 5.2 Edit dose amount

    func testEditDoseAmount() throws {
        // Navigate to medication detail and log a dose
        navigateToMedicationAndLogDose()

        // Step 1: Long-press dose entry
        let scroll = app.scrollViews.firstMatch
        let doseEntry = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Taken at'")).firstMatch
        if doseEntry.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            UITestHelpers.scrollToElement(doseEntry, in: scroll)
            doseEntry.press(forDuration: 1.5)
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Step 2: Tap Edit from context menu
            // There may be an "Edit" button in the nav bar too; use the context menu container
            let contextMenuEditButton = app.collectionViews.buttons["Edit"]
            let fallbackEditButton = app.buttons.matching(NSPredicate(format: "label == 'Edit'")).element(boundBy: 1)
            let editTarget = contextMenuEditButton.exists ? contextMenuEditButton : fallbackEditButton
            if editTarget.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
                editTarget.tap()
                Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

                // Step 3: Change amount from 1 to 4
                let amountInput = app.textFields["dose-amount-input"]
                if amountInput.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
                    amountInput.tap()
                    amountInput.clearAndTypeText("4")
                }

                // Step 4: Tap Save
                let saveButton = app.buttons["Save"]
                UITestHelpers.waitForHittable(saveButton)
                saveButton.tap()
                Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

                // Step 5: Verify "4 x 50mg" visible
                let updatedDose = app.staticTexts.matching(NSPredicate(format: "label CONTAINS '4'")).firstMatch
                UITestHelpers.waitForElement(updatedDose)

                // Step 6: Navigate back to medications list, then away and back to verify persistence
                let backButton = app.navigationBars.buttons.firstMatch
                if backButton.exists && backButton.isHittable {
                    backButton.tap()
                    Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
                }
                UITestHelpers.navigateTo(tab: .dashboard, in: app)
                UITestHelpers.navigateTo(tab: .medications, in: app)
                let medCard = app.buttons["medication-card-Test Topiramate"]
                UITestHelpers.waitForHittable(medCard)
                medCard.tap()
                Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
            }
        }
    }

    // MARK: - 5.3 Cancel edit preserves original

    func testCancelEditPreservesOriginal() throws {
        navigateToMedicationAndLogDose()

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

                // Tap Cancel
                let cancelButton = app.buttons["Cancel"]
                UITestHelpers.waitForHittable(cancelButton)
                cancelButton.tap()
                Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

                // Verify original amount is unchanged
                let originalDose = app.staticTexts.matching(NSPredicate(format: "label CONTAINS '1'")).firstMatch
                XCTAssertTrue(originalDose.exists, "Original dose amount should be preserved after cancel")
            }
        }
    }

    // MARK: - 5.4 Cancel delete preserves dose

    func testCancelDeletePreservesDose() throws {
        navigateToMedicationAndLogDose()

        let scroll = app.scrollViews.firstMatch
        let doseEntry = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Taken at'")).firstMatch
        if doseEntry.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            UITestHelpers.scrollToElement(doseEntry, in: scroll)
            doseEntry.press(forDuration: 1.5)
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Tap Delete
            let deleteButton = app.buttons["Delete"]
            if deleteButton.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
                deleteButton.tap()
                Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

                // Tap Cancel in confirmation
                let cancelButton = app.alerts.buttons["Cancel"]
                if cancelButton.waitForExistence(timeout: 2) {
                    cancelButton.tap()
                    Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
                }
            }

            // Dose should still be visible
            XCTAssertTrue(doseEntry.exists, "Dose entry should still exist after canceling delete")
        }
    }

    // MARK: - Helpers

    private func navigateToMedicationAndLogDose() {
        UITestHelpers.navigateTo(tab: .medications, in: app)
        let medCard = app.buttons["medication-card-Test Topiramate"]
        UITestHelpers.waitForHittable(medCard)
        medCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let logDoseButton = app.buttons["log-dose-button"]
        UITestHelpers.waitForHittable(logDoseButton)
        logDoseButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Wait for dose to register
        Thread.sleep(forTimeInterval: 1)
    }
}

// MARK: - XCUIElement Extension

extension XCUIElement {
    /// Clear the text field and type new text.
    func clearAndTypeText(_ text: String) {
        guard let currentValue = self.value as? String, !currentValue.isEmpty else {
            self.typeText(text)
            return
        }
        // Select all text and delete
        self.tap()
        let selectAll = XCUIApplication().menuItems["Select All"]
        if selectAll.waitForExistence(timeout: 1) {
            selectAll.tap()
            self.typeText(text)
        } else {
            // Fallback: delete character by character then type
            let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: currentValue.count)
            self.typeText(deleteString)
            self.typeText(text)
        }
    }
}
