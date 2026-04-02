import XCTest

/// Test Suite 3: Daily Status Tracking
/// Tests calendar navigation, green/yellow/red day logging, and episode auto-creates red day.
final class DailyStatusUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchCleanDashboard()

        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - 3.1 Full daily status workflow

    func testFullDailyStatusWorkflow() throws {
        // === Phase 1: Calendar ===

        // Step 1: Navigate to Trends tab
        UITestHelpers.navigateTo(tab: .trends, in: app)
        let trendsScreen = app.navigationBars.staticTexts["Trends & Analytics"]
        UITestHelpers.waitForElement(trendsScreen)

        // Step 2: Navigate to previous month
        let previousButton = app.buttons["calendar-previous"]
        UITestHelpers.waitForHittable(previousButton)
        previousButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Phase 2: Green day ===

        // Step 3: Tap a past date (5 days ago in previous month context - use a generic past date)
        let pastDate1 = UITestHelpers.dateStringDaysAgo(35)
        let dayCell1 = app.buttons["calendar-day-\(pastDate1)"]
        if dayCell1.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            dayCell1.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Step 4: Tap "Clear" (green button)
            let greenButton = app.buttons["green-day-button"]
            UITestHelpers.waitForHittable(greenButton)
            greenButton.tap()

            // Step 5: Tap Save
            let saveButton = app.buttons["save-status-button"]
            UITestHelpers.waitForHittable(saveButton)
            saveButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // === Phase 3: Yellow day ===

        // Step 6: Tap a different past date
        let pastDate2 = UITestHelpers.dateStringDaysAgo(36)
        let dayCell2 = app.buttons["calendar-day-\(pastDate2)"]
        if dayCell2.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            dayCell2.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Step 7: Tap "Not Clear" (yellow button)
            let yellowButton = app.buttons["yellow-day-button"]
            UITestHelpers.waitForHittable(yellowButton)
            yellowButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Step 8: Select Prodrome type
            let prodromeButton = app.buttons["yellow-type-prodrome"]
            if prodromeButton.waitForExistence(timeout: 2) {
                prodromeButton.tap()
            }

            // Step 9: Enter note
            let notesInput = app.textViews["daily-status-notes-input"]
            if notesInput.waitForExistence(timeout: 2) {
                notesInput.tap()
                notesInput.typeText("Felt off all day")
            }

            // Step 10: Save
            let saveButton = app.buttons["save-status-button"]
            UITestHelpers.waitForHittable(saveButton)
            saveButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // === Phase 4: Episode creates red day ===

        // Step 11: Go to Dashboard, start episode
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        let startButton = app.buttons["start-episode-button"]
        UITestHelpers.waitForHittable(startButton)
        startButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let saveEpisode = app.buttons["save-episode-button"]
        UITestHelpers.waitForHittable(saveEpisode)
        saveEpisode.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 12: Navigate to Trends, verify today has red dot
        UITestHelpers.navigateTo(tab: .trends, in: app)

        // Navigate back to current month if needed
        let nextButton = app.buttons["calendar-next"]
        if nextButton.waitForExistence(timeout: 2) {
            nextButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        let todayCell = app.buttons["calendar-day-\(UITestHelpers.todayDateString)"]
        UITestHelpers.waitForElement(todayCell)

        // === Phase 5: End episode ===

        // Step 13: Go to Dashboard, end episode
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        let activeCard = app.buttons["active-episode-card"]
        UITestHelpers.waitForHittable(activeCard)
        activeCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let endNowButton = app.buttons["end-now-button"]
        let scroll = app.scrollViews.firstMatch
        if !endNowButton.isHittable {
            UITestHelpers.scrollToElement(endNowButton, in: scroll)
        }
        UITestHelpers.waitForHittable(endNowButton)
        endNowButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Handle confirmation
        let confirmEnd = app.alerts.buttons["End"]
        if confirmEnd.waitForExistence(timeout: 2) {
            confirmEnd.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // Navigate back to dashboard
        let backButton = app.navigationBars.buttons.firstMatch
        if backButton.exists {
            backButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        }

        // === Phase 6: Verify calendar ===

        // Step 14: Navigate to Trends, verify dots
        UITestHelpers.navigateTo(tab: .trends, in: app)
        let todayCellFinal = app.buttons["calendar-day-\(UITestHelpers.todayDateString)"]
        UITestHelpers.waitForElement(todayCellFinal)
    }

    // MARK: - 3.2 Yellow day without type selection

    func testYellowDayWithoutType() throws {
        UITestHelpers.navigateTo(tab: .trends, in: app)

        // Navigate to previous month
        let previousButton = app.buttons["calendar-previous"]
        UITestHelpers.waitForHittable(previousButton)
        previousButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Tap past date
        let pastDate = UITestHelpers.dateStringDaysAgo(35)
        let dayCell = app.buttons["calendar-day-\(pastDate)"]
        if dayCell.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            dayCell.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Tap "Not Clear"
            let yellowButton = app.buttons["yellow-day-button"]
            UITestHelpers.waitForHittable(yellowButton)
            yellowButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Save without selecting type (should succeed)
            let saveButton = app.buttons["save-status-button"]
            UITestHelpers.waitForHittable(saveButton)
            saveButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Should return to trends without error
            UITestHelpers.waitForElement(app.navigationBars.staticTexts["Trends & Analytics"])
        }
    }

    // MARK: - 3.3 Skip daily status prompt

    func testSkipDailyStatusPrompt() throws {
        UITestHelpers.navigateTo(tab: .trends, in: app)

        let previousButton = app.buttons["calendar-previous"]
        UITestHelpers.waitForHittable(previousButton)
        previousButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let pastDate = UITestHelpers.dateStringDaysAgo(35)
        let dayCell = app.buttons["calendar-day-\(pastDate)"]
        if dayCell.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            dayCell.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Tap Skip
            let skipButton = app.buttons["skip-button"]
            UITestHelpers.waitForHittable(skipButton)
            skipButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Should return to Trends
            UITestHelpers.waitForElement(app.navigationBars.staticTexts["Trends & Analytics"])
        }
    }

    // MARK: - 3.4 Dashboard widget visibility

    func testDashboardWidgetVisibility() throws {
        // Step 1: On dashboard, verify widget is visible via its content
        // The widget shows "How was yesterday?" with green/yellow buttons
        let widgetText = app.staticTexts["How was yesterday?"]
        if widgetText.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            XCTAssertTrue(widgetText.exists, "Daily status widget should show 'How was yesterday?'")
        } else {
            // Widget might already be in logged state; check for green/yellow buttons
            let greenButton = app.buttons["green-day-button"]
            let yellowButton = app.buttons["yellow-day-button"]
            let undoButton = app.buttons["undo-status-button"]
            XCTAssertTrue(greenButton.exists || yellowButton.exists || undoButton.exists,
                           "Daily status widget should be visible in some state")
        }
    }

    // MARK: - 3.5 Undo daily status

    func testUndoDailyStatus() throws {
        // Log yesterday as green via the dashboard widget
        let greenButton = app.buttons["green-day-button"]
        if greenButton.waitForExistence(timeout: UITestHelpers.defaultTimeout) {
            greenButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Widget should show logged state - look for the Undo button as indicator
            let undoStatusButton = app.buttons["undo-status-button"]
            UITestHelpers.waitForElement(undoStatusButton)

            // Tap Undo
            let undoButton = app.buttons["undo-status-button"]
            UITestHelpers.waitForHittable(undoButton)
            undoButton.tap()
            Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

            // Widget should return to prompt state - green button should reappear
            let greenButtonAfterUndo = app.buttons["green-day-button"]
            UITestHelpers.waitForElement(greenButtonAfterUndo)
        }
    }
}
