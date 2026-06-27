import XCTest

/// Verifies the pre-release-only "Beta Features" Settings category: it is
/// reachable from Settings and surfaces the feature-flags section plus the
/// sample-data loader.
final class BetaFeaturesUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchCleanDashboard()
        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testBetaFeaturesCategoryOpensAndShowsTools() throws {
        openSettings()

        // The Beta category appears in pre-release builds (DEBUG includes UI
        // tests). It sits near the bottom of Settings, so scroll it into view —
        // a virtualized List doesn't surface off-screen rows to the a11y tree.
        let betaLink = app.buttons["beta-features"]
        let list = app.collectionViews.firstMatch
        if list.exists {
            UITestHelpers.scrollToElement(betaLink, in: list)
        }
        UITestHelpers.waitForHittable(betaLink)
        betaLink.tap()

        // Landed on the Beta Features screen.
        let title = app.navigationBars.staticTexts["Beta Features"]
        UITestHelpers.waitForElement(title)

        // Feature Flags section header + empty-state copy (no flags registered yet).
        UITestHelpers.waitForElement(app.staticTexts["Feature Flags"])
        XCTAssertTrue(
            app.staticTexts["No experimental features are available right now."].exists,
            "Empty feature-flags state should be shown when no flags are registered"
        )

        // Sample data loader moved under Beta Features.
        UITestHelpers.waitForElement(app.buttons["load-sample-data"])

        // Capture a screenshot for visual review of the new category.
        let shot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = "beta-features-screen"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    // MARK: - Helpers

    private func openSettings() {
        let settingsButton = app.buttons["settings-button"]
        UITestHelpers.waitForHittable(settingsButton)
        settingsButton.tap()

        let settingsTitle = app.navigationBars.staticTexts["Settings"]
        UITestHelpers.waitForElement(settingsTitle)
    }
}
