import XCTest

/// Tests for the hidden developer mode: the Developer Tools section is not
/// visible by default and is toggled by tapping the version row in Settings
/// 7 times (the same secret-activation pattern the pre-rewrite app used).
final class DeveloperModeUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchCleanDashboard()
        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testSevenTapsTogglesDeveloperTools() throws {
        openSettings()

        // Hidden by default on a fresh install.
        let developerTools = app.buttons["developer-tools"]
        XCTAssertFalse(developerTools.exists,
                       "Developer Tools should be hidden until developer mode is enabled")

        // Enable: 7 taps on the version row.
        tapVersionRow(times: 7)
        dismissAlert(titled: "Developer Mode Enabled")
        UITestHelpers.waitForElement(developerTools)

        // Disable: 7 more taps.
        tapVersionRow(times: 7)
        dismissAlert(titled: "Developer Mode Disabled")
        UITestHelpers.waitForElementToDisappear(developerTools)
    }

    func testFewerThanSevenTapsDoesNothing() throws {
        openSettings()

        tapVersionRow(times: 6)

        XCTAssertFalse(app.alerts.firstMatch.exists,
                       "No alert should appear before the 7th tap")
        XCTAssertFalse(app.buttons["developer-tools"].exists,
                       "Developer Tools should stay hidden before the 7th tap")
    }

    func testDeveloperModePersistsAcrossRelaunch() throws {
        openSettings()
        tapVersionRow(times: 7)
        dismissAlert(titled: "Developer Mode Enabled")
        UITestHelpers.waitForElement(app.buttons["developer-tools"])

        // Relaunch WITHOUT --reset-database so UserDefaults survive.
        app.terminate()
        app = XCUIApplication()
        app.launchArguments = ["--uitesting", "--skip-onboarding"]
        app.launch()
        UITestHelpers.waitForDashboard(in: app)

        openSettings()
        scrollToVersionRow()
        UITestHelpers.waitForElement(app.buttons["developer-tools"])
    }

    // MARK: - Helpers

    private func openSettings() {
        let settingsButton = app.buttons["settings-button"]
        UITestHelpers.waitForHittable(settingsButton)
        settingsButton.tap()

        let settingsTitle = app.navigationBars.staticTexts["Settings"]
        UITestHelpers.waitForElement(settingsTitle)
    }

    @discardableResult
    private func scrollToVersionRow() -> XCUIElement {
        // The version row renders as a StaticText (combined accessibility element).
        // Query the type directly: the List virtualizes off-screen rows, so a
        // flexible find before scrolling would lock onto the wrong element type.
        let versionRow = app.staticTexts["version-row"]
        UITestHelpers.scrollToElement(versionRow, in: app.collectionViews.firstMatch)
        return versionRow
    }

    private func tapVersionRow(times: Int) {
        let versionRow = scrollToVersionRow()
        UITestHelpers.waitForHittable(versionRow)
        for _ in 0..<times {
            versionRow.tap()
        }
    }

    private func dismissAlert(titled title: String) {
        let alert = app.alerts[title]
        UITestHelpers.waitForElement(alert)
        alert.buttons["OK"].tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }
}
