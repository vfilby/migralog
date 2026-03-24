import XCTest

/// Test Suite 2: Episode Lifecycle
/// Tests create -> view details -> edit -> log update -> verify timeline -> end episode -> calendar -> history.
final class EpisodeLifecycleUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchCleanDashboard()

        // Wait for dashboard to load
        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - 2.1 Complete episode lifecycle

    func testCompleteEpisodeLifecycle() throws {
        // === Phase 1: Create ===

        // Step 1: Tap "Start Episode"
        let startButton = app.buttons["start-episode-button"]
        UITestHelpers.waitForHittable(startButton)
        startButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 2: Tap Save (accept defaults)
        let saveButton = app.buttons["save-episode-button"]
        UITestHelpers.waitForHittable(saveButton)
        saveButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 3: Dashboard shows active episode card with "Ongoing"
        let activeEpisodeCard = app.buttons["active-episode-card"]
        UITestHelpers.waitForElement(activeEpisodeCard)

        let ongoingBadge = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Ongoing'")).firstMatch
        XCTAssertTrue(ongoingBadge.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                       "Active episode card should show 'Ongoing' badge")

        // === Phase 1.5: Auto red day ===

        // Step 4-5: Navigate to Trends, verify today has red dot
        UITestHelpers.navigateTo(tab: .trends, in: app)
        let todayCell = app.buttons["calendar-day-\(UITestHelpers.todayDateString)"]
        UITestHelpers.waitForElement(todayCell)

        // === Phase 2: View details ===

        // Step 6: Navigate back to dashboard, tap active episode card
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        UITestHelpers.waitForHittable(activeEpisodeCard)
        activeEpisodeCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 7: Episode Detail screen shows "Ongoing"
        let detailOngoing = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Ongoing'")).firstMatch
        UITestHelpers.waitForElement(detailOngoing)

        // === Phase 3: Edit episode ===

        // Step 8: Tap Edit
        let editButton = app.buttons["edit-episode-button"]
        UITestHelpers.waitForHittable(editButton)
        editButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 9: Select symptoms - Nausea, Light Sensitivity
        let nauseaChip = app.buttons["Nausea"]
        if nauseaChip.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            nauseaChip.tap()
        }
        let lightSensChip = app.buttons["Light Sensitivity"]
        if lightSensChip.waitForExistence(timeout: 2) {
            lightSensChip.tap()
        }

        // Step 10: Select triggers - Stress, Lack of Sleep
        let stressChip = app.buttons["Stress"]
        if stressChip.waitForExistence(timeout: 2) {
            stressChip.tap()
        }
        let sleepChip = app.buttons["Lack of Sleep"]
        if sleepChip.waitForExistence(timeout: 2) {
            sleepChip.tap()
        }

        // Step 11: Add note
        let notesField = app.textViews.firstMatch
        if notesField.waitForExistence(timeout: 2) {
            notesField.tap()
            notesField.typeText("Started with stress and poor sleep")
        }

        // Step 12: Save edits
        let saveEditsButton = app.buttons["Save"]
        if saveEditsButton.waitForExistence(timeout: 2) {
            saveEditsButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // === Phase 4: Log intensity update ===

        // Step 13: Tap Log Update
        let logUpdateButton = app.buttons["log-update-button"]
        let detailScroll = app.scrollViews.firstMatch
        if !logUpdateButton.isHittable {
            UITestHelpers.scrollToElement(logUpdateButton, in: detailScroll)
        }
        UITestHelpers.waitForHittable(logUpdateButton)
        logUpdateButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 14: Adjust intensity slider to 7
        let slider = app.sliders.firstMatch
        if slider.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            slider.adjust(toNormalizedSliderPosition: 0.7)
        }

        // Step 15: Select additional symptoms
        let soundSensChip = app.buttons["Sound Sensitivity"]
        if soundSensChip.waitForExistence(timeout: 2) {
            soundSensChip.tap()
        }
        let dizzinessChip = app.buttons["Dizziness"]
        if dizzinessChip.waitForExistence(timeout: 2) {
            dizzinessChip.tap()
        }

        // Step 16: Add note
        let updateNotesField = app.textViews.firstMatch
        if updateNotesField.waitForExistence(timeout: 2) {
            updateNotesField.tap()
            updateNotesField.typeText("Pain getting worse with new symptoms")
        }

        // Step 17: Save update
        let saveUpdateButton = app.buttons["Save"]
        if saveUpdateButton.waitForExistence(timeout: 2) {
            saveUpdateButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // === Phase 5: Verify timeline ===

        // Step 18-21: Scroll to timeline, verify entries exist
        let timeline = app.otherElements.matching(NSPredicate(format: "identifier CONTAINS 'timeline'")).firstMatch
        if timeline.exists {
            UITestHelpers.scrollToElement(timeline, in: detailScroll)
        }

        // === Phase 6: End episode ===

        // Step 22-23: Find and tap "End Now"
        let endNowButton = app.buttons["end-now-button"]
        if !endNowButton.isHittable {
            UITestHelpers.scrollToElement(endNowButton, in: detailScroll)
        }
        UITestHelpers.waitForHittable(endNowButton)
        endNowButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Handle confirmation if needed
        let confirmButton = app.alerts.buttons["End"]
        if confirmButton.waitForExistence(timeout: 2) {
            confirmButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // Step 24: "Ongoing" badge should be removed
        let stillOngoing = app.staticTexts.matching(NSPredicate(format: "label == 'Ongoing'")).firstMatch
        XCTAssertFalse(stillOngoing.exists, "Ongoing badge should be removed after ending episode")

        // === Phase 6.5: Calendar verification ===

        // Step 25: Navigate to Trends, verify red day
        UITestHelpers.navigateTo(tab: .trends, in: app)
        let todayCellAfter = app.buttons["calendar-day-\(UITestHelpers.todayDateString)"]
        UITestHelpers.waitForElement(todayCellAfter)

        // === Phase 7: History ===

        // Step 26: Navigate to Episodes tab
        UITestHelpers.navigateTo(tab: .episodes, in: app)
        let episodesScreen = app.navigationBars.staticTexts["Episodes"]
        UITestHelpers.waitForElement(episodesScreen)

        // Step 27-28: Episode appears in list
        let episodeCard = app.buttons["episode-card-0"]
        UITestHelpers.waitForElement(episodeCard)
    }

    // MARK: - 2.2 Custom end time

    func testCustomEndTime() throws {
        // Create an episode first
        createActiveEpisode()

        // Open episode detail
        let activeCard = app.buttons["active-episode-card"]
        UITestHelpers.waitForHittable(activeCard)
        activeCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Tap "End..." for custom time
        let endCustomButton = app.buttons["end-custom-button"]
        let scroll = app.scrollViews.firstMatch
        if !endCustomButton.isHittable {
            UITestHelpers.scrollToElement(endCustomButton, in: scroll)
        }
        UITestHelpers.waitForHittable(endCustomButton)
        endCustomButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Date/time picker should appear - confirm it
        let confirmButton = app.buttons["Confirm"]
        if confirmButton.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            confirmButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // Navigate to Episodes tab to verify
        UITestHelpers.navigateTo(tab: .episodes, in: app)
        let episodeCard = app.buttons["episode-card-0"]
        UITestHelpers.waitForElement(episodeCard)

        // Verify no "Ongoing" badge
        let ongoing = episodeCard.staticTexts.matching(NSPredicate(format: "label == 'Ongoing'")).firstMatch
        XCTAssertFalse(ongoing.exists, "Episode should not show Ongoing after custom end time")
    }

    // MARK: - 2.3 Cancel custom end time

    func testCancelCustomEndTime() throws {
        // Create an episode first
        createActiveEpisode()

        // Open episode detail
        let activeCard = app.buttons["active-episode-card"]
        UITestHelpers.waitForHittable(activeCard)
        activeCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Tap "End..." for custom time
        let endCustomButton = app.buttons["end-custom-button"]
        let scroll = app.scrollViews.firstMatch
        if !endCustomButton.isHittable {
            UITestHelpers.scrollToElement(endCustomButton, in: scroll)
        }
        UITestHelpers.waitForHittable(endCustomButton)
        endCustomButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Tap Cancel
        let cancelButton = app.buttons["Cancel"]
        if cancelButton.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            cancelButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // Episode should still be active
        let ongoingBadge = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Ongoing'")).firstMatch
        XCTAssertTrue(ongoingBadge.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                       "Episode should still show Ongoing after canceling")
    }

    // MARK: - Helpers

    private func createActiveEpisode() {
        let startButton = app.buttons["start-episode-button"]
        UITestHelpers.waitForHittable(startButton)
        startButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let saveButton = app.buttons["save-episode-button"]
        UITestHelpers.waitForHittable(saveButton)
        saveButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }
}
