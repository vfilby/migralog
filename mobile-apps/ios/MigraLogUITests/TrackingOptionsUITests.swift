import XCTest

/// Tracking Options customization: adding a custom trigger and hiding a
/// built-in via Settings → Tracking Options, then verifying the New Episode
/// picker reflects both changes.
final class TrackingOptionsUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchCleanDashboard()

        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testCustomTriggerAppearsInNewEpisodePicker() throws {
        // Step 1: Settings → Tracking → Triggers
        openTrackingCategory(rowID: "tracking-triggers", title: "Triggers")

        // Step 2: Add a trigger from the suggested catalog via autocomplete
        let addTrigger = app.buttons["tracking-options-add-trigger"]
        scrollToInList(addTrigger)
        UITestHelpers.waitForHittable(addTrigger)
        addTrigger.tap()

        let nameField = app.textFields["tracking-option-name-field"]
        UITestHelpers.waitForElement(nameField)
        nameField.tap()
        nameField.typeText("wine")

        // Typing filters the catalog; tap the "Red Wine" suggestion chip.
        let suggestion = app.buttons["tracking-option-suggestion-Red Wine"]
        UITestHelpers.waitForHittable(suggestion)
        suggestion.tap()

        // The option appears in the list, stored as display-ready text
        let customRow = toggleElement("tracking-option-trigger-Red Wine")
        scrollToInList(customRow)
        UITestHelpers.waitForElement(customRow)

        // Step 3: Hide the built-in "Exercise" trigger
        let exerciseToggle = toggleElement("tracking-option-trigger-exercise")
        scrollToInList(exerciseToggle)
        UITestHelpers.waitForHittable(exerciseToggle)
        turnOff(exerciseToggle)

        // Step 4: Back out to the dashboard
        app.navigationBars.buttons.firstMatch.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        app.navigationBars.buttons.firstMatch.tap()
        UITestHelpers.waitForDashboard(in: app)

        // Step 5: Start a new episode and check the trigger chips
        let startButton = app.buttons["start-episode-button"]
        let saveButton = app.buttons["save-episode-button"]
        UITestHelpers.tapToPresent(startButton, expecting: saveButton)

        let formList = app.collectionViews.firstMatch.exists
            ? app.collectionViews.firstMatch
            : app.tables.firstMatch
        let customChip = app.buttons["Red Wine"]
        if !customChip.exists || !customChip.isHittable {
            UITestHelpers.scrollToElement(customChip, in: formList)
        }
        UITestHelpers.waitForElement(customChip)
        XCTAssertFalse(
            app.buttons["Exercise"].exists,
            "Hidden built-in trigger should not be offered in the picker"
        )

        // Step 6: Select the custom trigger and save the episode
        customChip.tap()
        UITestHelpers.waitForHittable(saveButton)
        saveButton.tap()
        UITestHelpers.waitForDashboard(in: app)
    }

    func testManageOptions_duplicateRejected_deleteCustom_reshowBuiltIn() throws {
        openTrackingCategory(rowID: "tracking-symptoms", title: "Symptoms")

        // Step 1: Adding a symptom that duplicates a built-in display name is rejected
        let addSymptom = app.buttons["tracking-options-add-symptom"]
        scrollToInList(addSymptom)
        UITestHelpers.waitForHittable(addSymptom)
        addSymptom.tap()

        var nameField = app.textFields["tracking-option-name-field"]
        UITestHelpers.waitForElement(nameField)
        nameField.tap()
        nameField.typeText("Nausea")
        app.buttons["tracking-option-add-confirm"].tap()

        let errorAlert = app.alerts["Couldn't Add Option"]
        UITestHelpers.waitForElement(errorAlert)
        errorAlert.buttons["OK"].tap()
        app.buttons["Cancel"].tap()

        // Step 2: Add a typed symptom that matches a catalog entry — it
        // adopts the entry's casing — then delete it via swipe
        scrollToInList(addSymptom)
        UITestHelpers.waitForHittable(addSymptom)
        addSymptom.tap()

        nameField = app.textFields["tracking-option-name-field"]
        UITestHelpers.waitForElement(nameField)
        nameField.tap()
        nameField.typeText("brain fog")
        app.buttons["tracking-option-add-confirm"].tap()

        let customRow = toggleElement("tracking-option-symptom-Brain Fog")
        scrollToInList(customRow)
        UITestHelpers.waitForElement(customRow)

        customRow.swipeLeft()
        let deleteButton = app.buttons["tracking-option-delete-Brain Fog"]
        UITestHelpers.waitForHittable(deleteButton)
        deleteButton.tap()
        UITestHelpers.waitForElementToDisappear(customRow)

        // Step 3: Pain Qualities is now its own screen — back out to Settings
        // and open it, then hide a built-in pain quality and re-show it.
        app.navigationBars.buttons.firstMatch.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        let painQualities = app.buttons["tracking-pain-qualities"]
        scrollToInList(painQualities)
        UITestHelpers.waitForHittable(painQualities)
        painQualities.tap()
        UITestHelpers.waitForElement(app.navigationBars.staticTexts["Pain Qualities"])

        let dullToggle = toggleElement("tracking-option-pain_quality-dull")
        UITestHelpers.waitForHittable(dullToggle)
        turnOff(dullToggle)
        setToggle(dullToggle, on: true)
    }

    // MARK: - Helpers

    private func openSettings() {
        let settingsButton = app.buttons["settings-button"]
        UITestHelpers.waitForHittable(settingsButton)
        settingsButton.tap()

        // Wait for the Settings list to settle before scrolling/querying — the
        // collection view isn't queryable mid-transition.
        let settingsTitle = app.navigationBars.staticTexts["Settings"]
        UITestHelpers.waitForElement(settingsTitle)
    }

    /// Open a single tracking category screen (Symptoms / Triggers / Pain
    /// Qualities) from Settings. Each pick list is its own top-level row under
    /// the Tracking category.
    private func openTrackingCategory(rowID: String, title: String) {
        openSettings()

        let row = app.buttons[rowID]
        scrollToInList(row)
        UITestHelpers.waitForHittable(row)
        row.tap()

        let titleElement = app.navigationBars.staticTexts[title]
        UITestHelpers.waitForElement(titleElement)
    }

    /// SwiftUI Toggles in a List usually surface as `.switch` elements, but the
    /// identifier can land on the enclosing cell depending on OS version —
    /// fall back to an any-type query.
    private func toggleElement(_ identifier: String) -> XCUIElement {
        let toggle = app.switches[identifier]
        if toggle.exists { return toggle }
        return app.descendants(matching: .any)[identifier]
    }

    /// A SwiftUI list Toggle's element frame spans the whole row, so a center
    /// tap lands on the label and doesn't flip the switch — tap the switch
    /// control (or the row's right edge, where the control sits) and verify
    /// the value actually changed.
    private func turnOff(_ toggle: XCUIElement) {
        setToggle(toggle, on: false)
    }

    private func setToggle(_ toggle: XCUIElement, on: Bool) {
        let control = toggle.switches.firstMatch.exists ? toggle.switches.firstMatch : toggle
        control.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap()

        let predicate = NSPredicate(format: "value == %@", on ? "1" : "0")
        let result = XCTWaiter.wait(
            for: [XCTNSPredicateExpectation(predicate: predicate, object: control)],
            timeout: UITestHelpers.defaultTimeout
        )
        XCTAssertEqual(result, .completed, "Toggle \(toggle) did not switch \(on ? "on" : "off")")
    }

    private func scrollToInList(_ element: XCUIElement) {
        let listView = app.collectionViews.firstMatch.exists
            ? app.collectionViews.firstMatch
            : app.tables.firstMatch
        if !element.isHittable && listView.exists {
            UITestHelpers.scrollToElement(element, in: listView)
        }
    }
}
