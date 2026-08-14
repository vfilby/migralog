import XCTest

/// End-to-end flow for the beta diary notes feature (FeatureFlags.diaryNotes):
/// the Add Note quick action is absent while the flag is off, appears after
/// enabling the flag in Settings → Beta Features, and a note added from the
/// home screen shows up in the calendar's day details alongside the day-level
/// Add Note action.
final class DiaryNotesUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchCleanDashboard()
        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testDiaryNotesFlow() throws {
        // === Phase 1: flag off — no Add Note quick action ===
        XCTAssertFalse(
            app.buttons["add-diary-note-button"].exists,
            "Add Note quick action must be hidden while the beta flag is off"
        )

        // === Phase 2: enable the beta flag ===
        UITestHelpers.openSettings(in: app)

        let betaLink = app.buttons["beta-features"]
        let list = app.collectionViews.firstMatch
        if list.exists {
            UITestHelpers.scrollToElement(betaLink, in: list)
        }
        UITestHelpers.waitForHittable(betaLink)
        betaLink.tap()
        UITestHelpers.waitForElement(app.navigationBars.staticTexts["Beta Features"])

        // Idempotent: only toggle when off, so a rerun against a warm container
        // still passes (PostdromeFlowUITests precedent).
        let flagToggle = app.switches["feature-flag-diaryNotes"]
        UITestHelpers.waitForElement(flagToggle)
        if flagToggle.value as? String == "0" {
            flagToggle.switches.firstMatch.tap()
        }
        XCTAssertEqual(flagToggle.value as? String, "1", "Flag should be on after toggling")

        // Back to the dashboard (pop Beta Features, then Settings).
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        UITestHelpers.waitForDashboard(in: app)

        // === Phase 3: add a note from the home screen ===
        let noteText = "Slept badly, feeling foggy"
        let addButton = app.buttons["add-diary-note-button"]
        UITestHelpers.waitForHittable(addButton)
        addButton.tap()

        let noteInput = app.textViews["diary-note-text-input"]
        UITestHelpers.waitForElement(noteInput)
        noteInput.tap()
        noteInput.typeText(noteText)

        let saveButton = app.buttons["save-diary-note-button"]
        UITestHelpers.waitForHittable(saveButton)
        saveButton.tap()
        UITestHelpers.waitForDashboard(in: app)

        // === Phase 4: the note shows in the calendar day details ===
        UITestHelpers.navigateTo(tab: .trends, in: app)

        let dayCell = app.buttons["calendar-day-\(UITestHelpers.todayDateString)"]
        UITestHelpers.waitForHittable(dayCell)
        dayCell.tap()
        UITestHelpers.waitForElement(app.navigationBars.staticTexts["Day Details"])

        XCTAssertTrue(
            app.buttons["day-add-diary-note-button"].waitForExistence(timeout: UITestHelpers.defaultTimeout),
            "Day details should offer Add Note while the flag is on"
        )
        XCTAssertTrue(
            app.staticTexts[noteText].waitForExistence(timeout: UITestHelpers.defaultTimeout),
            "The note added from the home screen should appear in the day's Notes section"
        )
    }
}
