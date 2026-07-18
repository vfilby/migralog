import XCTest

/// End-to-end flow for the beta post-drome tracking feature
/// (FeatureFlags.postdromeTracking): enable the flag in Settings → Beta
/// Features, start an episode, transition it into post-drome, verify the pain
/// slider is gone from Log Update, and log an update. Screenshots are attached
/// at each stage for visual review.
///
/// Launches with the rich sample dataset (not the minimal fixtures) so the
/// screens look realistic, and deliberately leaves the episode in post-drome —
/// the seeded state persists in the app container, so relaunching the app after
/// this test shows the feature live for manual exploration.
final class PostdromeFlowUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--uitesting", "--load-screenshot-data"]
        app.launch()
        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        // Diagnose stalls: capture wherever the app ended up.
        if let app {
            attachScreenshot(named: "teardown-final-state")
        }
        app = nil
    }

    func testPostdromeFlow() throws {
        // === Phase 1: enable the beta flag ===
        let settingsButton = app.buttons["settings-button"]
        UITestHelpers.waitForHittable(settingsButton)
        settingsButton.tap()
        UITestHelpers.waitForElement(app.navigationBars.staticTexts["Settings"])

        let betaLink = app.buttons["beta-features"]
        let list = app.collectionViews.firstMatch
        if list.exists {
            UITestHelpers.scrollToElement(betaLink, in: list)
        }
        UITestHelpers.waitForHittable(betaLink)
        betaLink.tap()
        UITestHelpers.waitForElement(app.navigationBars.staticTexts["Beta Features"])

        // Idempotent: only toggle when off, so a rerun against a warm container
        // still passes. Default-off is asserted by BetaFeaturesUITests.
        let flagToggle = app.switches["feature-flag-postdromeTracking"]
        UITestHelpers.waitForElement(flagToggle)
        if flagToggle.value as? String == "0" {
            flagToggle.switches.firstMatch.tap()
        }
        XCTAssertEqual(flagToggle.value as? String, "1", "Flag should be on after toggling")
        attachScreenshot(named: "1-beta-flag-enabled")

        // Back to the dashboard (pop Beta Features, then Settings).
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        UITestHelpers.waitForDashboard(in: app)

        // === Phase 2: open the ongoing episode ===
        // The screenshot dataset seeds an episode that is still ongoing, so
        // open it directly rather than starting a new one.
        let activeEpisodeCard = app.buttons["active-episode-card"]
        UITestHelpers.waitForHittable(activeEpisodeCard)
        activeEpisodeCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Phase 3: enter post-drome ===
        // A scroll swipe can register as a tap on the transition button, so
        // tolerate the transition having already happened: anchor scrolling on
        // the always-present Log Update button, then tap only if still needed.
        let detailScroll = app.scrollViews["episode-detail-scroll"]
        let enterPostdrome = app.buttons["enter-postdrome-button"]
        let resumeAttack = app.buttons["resume-attack-button"]
        if !resumeAttack.exists {
            let anchor = app.buttons["log-update-button"]
            if !anchor.isHittable {
                UITestHelpers.scrollToElement(anchor, in: detailScroll)
            }
            if enterPostdrome.waitForExistence(timeout: 2), enterPostdrome.isHittable {
                attachScreenshot(named: "2-active-episode-with-enter-postdrome")
                enterPostdrome.tap()
            }
        }

        let postdromeBadge = app.staticTexts
            .matching(NSPredicate(format: "label CONTAINS 'Post-drome'")).firstMatch
        XCTAssertTrue(
            postdromeBadge.waitForExistence(timeout: UITestHelpers.defaultTimeout),
            "Detail screen should show the Post-drome badge after transitioning"
        )
        UITestHelpers.waitForElement(resumeAttack)
        XCTAssertFalse(
            app.buttons["enter-postdrome-button"].exists,
            "Enter Post-drome should be replaced by Resume Attack"
        )
        attachScreenshot(named: "3-postdrome-detail")

        // === Phase 4: log an update — no pain slider in post-drome ===
        let logUpdateButton = app.buttons["log-update-button"]
        if !logUpdateButton.isHittable {
            UITestHelpers.scrollToElement(logUpdateButton, in: detailScroll)
        }
        UITestHelpers.waitForHittable(logUpdateButton)
        logUpdateButton.tap()
        UITestHelpers.waitForElement(app.navigationBars.staticTexts["Log Update"])

        XCTAssertFalse(
            app.staticTexts["Pain Intensity"].exists,
            "Pain intensity section must be hidden during post-drome"
        )
        XCTAssertEqual(app.sliders.count, 0, "No pain slider during post-drome")

        // Log a lingering symptom and a note.
        let fatigueChip = app.buttons["Fatigue"]
        if fatigueChip.waitForExistence(timeout: 2) {
            fatigueChip.tap()
        }
        let noteField = app.textViews.firstMatch
        if noteField.waitForExistence(timeout: 2) {
            noteField.tap()
            noteField.typeText("Post-drome fog, tired but pain has subsided")
        }
        attachScreenshot(named: "4-log-update-no-pain-slider")

        app.buttons["Save"].tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Phase 5: timeline reflects the update; still in post-drome ===
        UITestHelpers.waitForElement(resumeAttack)
        let timelineEntry = app.staticTexts["Entered Post-drome"]
        if !timelineEntry.exists {
            UITestHelpers.scrollToElement(timelineEntry, in: detailScroll)
        }
        XCTAssertTrue(
            timelineEntry.waitForExistence(timeout: UITestHelpers.defaultTimeout),
            "Timeline should show the Entered Post-drome event"
        )
        attachScreenshot(named: "5-postdrome-with-timeline")
        // Intentionally leave the episode in post-drome so a manual relaunch
        // of the app lands on this state for exploration.
    }

    private func attachScreenshot(named name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
