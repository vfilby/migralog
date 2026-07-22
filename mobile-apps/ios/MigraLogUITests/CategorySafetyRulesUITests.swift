import XCTest

/// Category safety rules: the rule editor's medication inclusion checklist.
/// A medication unchecked in the checklist is excluded from its category's
/// safety warnings — its doses don't count and the warning is not shown on it.
final class CategorySafetyRulesUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchWithFixtures()
        UITestHelpers.waitForDashboard(in: app)
        addTeardownBlock { [self] in
            attachScreenshot(named: "teardown-state")
        }
    }

    override func tearDownWithError() throws {
        app = nil
    }

    /// End-to-end: log a dose, add an OTC usage-limit rule (1 day / 30) and see
    /// the warning on the Log Medication card, then exclude the medication via
    /// the rule editor checklist and see the warning disappear.
    func testExcludingMedicationSilencesCategoryWarning() throws {
        // Step 1: Log a dose of Test Ibuprofen (category: otc) so the OTC
        // usage count is 1 day.
        UITestHelpers.navigateTo(tab: .medications, in: app)
        let medCard = app.buttons["medication-card-Test Ibuprofen"]
        UITestHelpers.waitForHittable(medCard)
        medCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        let logDoseButton = app.buttons["log-dose-button"]
        UITestHelpers.waitForHittable(logDoseButton)
        logDoseButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        // Rescue medications confirm the dose via a "Log Dose" sheet.
        let confirmLog = app.buttons["Log"]
        if confirmLog.waitForExistence(timeout: 3) {
            confirmLog.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }
        // Logging a dose reschedules notifications, which can raise the system
        // notification-permission alert on a fresh simulator.
        UITestHelpers.handleSystemAlert(in: app, buttonLabel: "Allow")

        // Step 2: Create an OTC usage-limit rule (max 1 day in 30) with the
        // medication checklist left at its default (all included).
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        openSafetyLimits()
        let addButton = app.buttons["category-rules-empty-add"].exists
            ? app.buttons["category-rules-empty-add"]
            : app.buttons["category-rules-add"]
        UITestHelpers.waitForHittable(addButton)
        addButton.tap()

        pickMenuOption(picker: "rule-editor-category-picker", option: "OTC")
        pickMenuOption(picker: "rule-editor-type-picker", option: "Usage limit")

        let maxDays = app.textFields["rule-editor-max-days"]
        UITestHelpers.waitForHittable(maxDays)
        maxDays.tap()
        maxDays.typeText("1")
        let windowDays = app.textFields["rule-editor-window-days"]
        windowDays.tap()
        windowDays.typeText("30")

        // The checklist lists the category's medication, included by default.
        let checklistRow = revealChecklistRow()
        XCTAssertTrue(checklistRow.isSelected, "medications default to included (checked)")
        attachScreenshot(named: "rule-editor-checklist-included")

        app.buttons["rule-editor-save"].tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 3: The Log Medication sheet shows the OTC warning on the card.
        openLogMedicationSheet()
        let warning = app.staticTexts["category-warning-fixture-med-ibuprofen"]
        XCTAssertTrue(warning.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                      "OTC usage warning should show when the medication is included")
        XCTAssertTrue(warning.label.contains("OTC used 1 of 1 days"),
                      "unexpected warning text: \(warning.label)")
        attachScreenshot(named: "warning-shown-when-included")
        app.buttons["Cancel"].firstMatch.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 4: Exclude the medication via the rule editor checklist.
        openSafetyLimits()
        let ruleRow = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH 'rule-row-'")
        ).firstMatch
        UITestHelpers.waitForHittable(ruleRow)
        ruleRow.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        let editChecklistRow = revealChecklistRow()
        editChecklistRow.tap()
        XCTAssertFalse(editChecklistRow.isSelected, "tapping the row should uncheck it")
        attachScreenshot(named: "rule-editor-checklist-excluded")
        app.buttons["rule-editor-save"].tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 5: The warning is gone from the Log Medication card.
        openLogMedicationSheet()
        let card = app.staticTexts["Test Ibuprofen"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: UITestHelpers.defaultTimeout))
        XCTAssertFalse(app.staticTexts["category-warning-fixture-med-ibuprofen"].exists,
                       "excluded medication must not show its category's usage warning")
        attachScreenshot(named: "warning-gone-when-excluded")

        // Step 6: Reopen the editor — the exclusion persisted.
        app.buttons["Cancel"].firstMatch.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        openSafetyLimits()
        UITestHelpers.waitForHittable(ruleRow)
        ruleRow.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        let reopenedChecklistRow = revealChecklistRow()
        XCTAssertFalse(reopenedChecklistRow.isSelected, "exclusion should persist across edits")
    }

    // MARK: - Helpers

    /// The rule editor opens at the medium detent and its Form is lazy, so the
    /// medications checklist may not exist in the hierarchy yet. Dismiss the
    /// software keyboard if it's up (the number pad covers the lower half of
    /// the medium-detent sheet — #599), swipe up to expand the sheet, then
    /// scroll until the row is hittable.
    private func revealChecklistRow() -> XCUIElement {
        dismissKeyboardIfPresent()
        let row = app.buttons["rule-editor-medication-fixture-med-ibuprofen"]
        if !row.isHittable {
            app.swipeUp()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }
        if !row.isHittable {
            UITestHelpers.scrollToElement(row, in: app.collectionViews.firstMatch)
        }
        UITestHelpers.waitForHittable(row)
        return row
    }

    /// With the simulator's hardware keyboard disconnected, typing into the
    /// numeric fields leaves the software number pad covering the lower half
    /// of the medium-detent sheet. The number pad has no return key, so tap
    /// the keyboard toolbar's Done button. No-op when the hardware keyboard
    /// is connected (CI) and no software keyboard appears.
    private func dismissKeyboardIfPresent() {
        guard app.keyboards.firstMatch.exists else { return }
        let done = app.buttons["rule-editor-keyboard-done"]
        UITestHelpers.waitForHittable(done)
        done.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    /// Dashboard → settings gear → Medication Safety Limits.
    private func openSafetyLimits() {
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        // Pop any pushed screens left from a previous visit.
        let settingsButton = app.buttons["settings-button"]
        UITestHelpers.waitForHittable(settingsButton)
        settingsButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        let limitsRow = app.buttons["medication-safety-limits"]
        let listView = app.tables.firstMatch.exists ? app.tables.firstMatch : app.collectionViews.firstMatch
        if !limitsRow.isHittable && listView.exists {
            UITestHelpers.scrollToElement(limitsRow, in: listView)
        }
        UITestHelpers.waitForHittable(limitsRow)
        limitsRow.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    /// Dashboard → "Log Medication" button → sheet.
    private func openLogMedicationSheet() {
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        let logButton = app.buttons["log-medication-button"]
        let scroll = app.scrollViews.firstMatch
        if !logButton.isHittable && scroll.exists {
            UITestHelpers.scrollToElement(logButton, in: scroll)
        }
        UITestHelpers.waitForHittable(logButton)
        logButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    /// SwiftUI Form pickers render as menu buttons: tap the picker, then the option.
    private func pickMenuOption(picker identifier: String, option: String) {
        let pickerButton = app.buttons[identifier]
        UITestHelpers.waitForHittable(pickerButton)
        pickerButton.tap()
        let optionButton = app.buttons[option]
        UITestHelpers.waitForHittable(optionButton)
        optionButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    private func attachScreenshot(named name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
