import XCTest

/// Regression test: saving a Log Update with only a note must not insert an
/// intensity reading. The update flow used to write the (pre-filled) slider
/// value on every save, so a note-only update showed a phantom "Intensity
/// Update" on the timeline with a value the user never entered.
final class LogUpdateNoteOnlyUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchCleanDashboard()
        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        if let app {
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.name = "final-state"
            screenshot.lifetime = .keepAlways
            add(screenshot)
        }
        app = nil
    }

    func testNoteOnlyUpdateDoesNotAddIntensityReading() throws {
        // === Start an episode with defaults (writes the initial intensity) ===
        let startButton = app.buttons["start-episode-button"]
        let saveButton = app.buttons["save-episode-button"]
        UITestHelpers.tapToPresent(startButton, expecting: saveButton)
        UITestHelpers.waitForHittable(saveButton)
        saveButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Open episode detail ===
        let activeEpisodeCard = app.buttons["active-episode-card"]
        UITestHelpers.waitForHittable(activeEpisodeCard)
        activeEpisodeCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Log an update containing only a note ===
        let logUpdateButton = app.buttons["log-update-button"]
        let detailScroll = app.scrollViews.firstMatch
        if !logUpdateButton.isHittable {
            UITestHelpers.scrollToElement(logUpdateButton, in: detailScroll)
        }
        UITestHelpers.waitForHittable(logUpdateButton)
        logUpdateButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // The Note section sits at the bottom of the Form; its row is
        // virtualized and doesn't exist until scrolled into view.
        let updateForm = app.collectionViews.firstMatch
        let noteField = app.textViews["update-note-field"]
        UITestHelpers.scrollToElement(noteField, in: updateForm)
        noteField.tap()
        noteField.typeText("Note-only update, slider untouched")

        let saveUpdateButton = app.buttons["Save"]
        UITestHelpers.waitForHittable(saveUpdateButton)
        saveUpdateButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Timeline shows the note but no second intensity entry ===
        // Bring the whole (short) timeline on screen; the fresh episode has only
        // a handful of entries, so scrolling to the end-episode control below the
        // timeline renders them all.
        let endNowButton = app.buttons["end-now-button"]
        if !endNowButton.isHittable {
            UITestHelpers.scrollToElement(endNowButton, in: detailScroll)
        }

        let noteEntry = app.staticTexts["Note-only update, slider untouched"]
        XCTAssertTrue(noteEntry.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                      "Timeline should show the note from the update")

        let intensityEntries = app.staticTexts.matching(
            NSPredicate(format: "label == %@", "Intensity Update")
        )
        XCTAssertEqual(intensityEntries.count, 1,
                       "A note-only update must not add an intensity reading; only the episode's initial reading should be on the timeline")

        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "timeline-note-only-update"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}
