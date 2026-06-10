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
        // Step 1: Settings → Tracking Options
        openTrackingOptions()

        // Step 2: Add a custom trigger
        let addTrigger = app.buttons["tracking-options-add-trigger"]
        scrollToInList(addTrigger)
        UITestHelpers.waitForHittable(addTrigger)
        addTrigger.tap()

        // Identifiers aren't exposed on alert text fields; scope to the alert.
        let alert = app.alerts.firstMatch
        UITestHelpers.waitForElement(alert)
        let nameField = alert.textFields.firstMatch
        UITestHelpers.waitForElement(nameField)
        nameField.tap()
        nameField.typeText("Red Wine")
        alert.buttons["Add"].tap()

        // The custom option appears in the list
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
        UITestHelpers.waitForHittable(startButton)
        startButton.tap()

        let saveButton = app.buttons["save-episode-button"]
        UITestHelpers.waitForElement(saveButton)

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

    // MARK: - Helpers

    private func openTrackingOptions() {
        let settingsButton = app.buttons["settings-button"]
        UITestHelpers.waitForHittable(settingsButton)
        settingsButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let trackingOptions = app.buttons["tracking-options"]
        scrollToInList(trackingOptions)
        UITestHelpers.waitForHittable(trackingOptions)
        trackingOptions.tap()

        let title = app.navigationBars.staticTexts["Tracking Options"]
        UITestHelpers.waitForElement(title)
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
        let control = toggle.switches.firstMatch.exists ? toggle.switches.firstMatch : toggle
        control.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap()

        let isOff = NSPredicate(format: "value == '0'")
        let result = XCTWaiter.wait(
            for: [XCTNSPredicateExpectation(predicate: isOff, object: control)],
            timeout: UITestHelpers.defaultTimeout
        )
        XCTAssertEqual(result, .completed, "Toggle \(toggle) did not turn off")
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
