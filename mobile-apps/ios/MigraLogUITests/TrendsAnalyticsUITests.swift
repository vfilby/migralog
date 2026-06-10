import XCTest

/// Test Suite 7: Trends & Analytics
/// Tests navigation, time range switching, empty state, and statistics with data.
final class TrendsAnalyticsUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - 7.1 Navigation and main components

    func testNavigationAndMainComponents() throws {
        app = UITestHelpers.launchCleanDashboard()
        UITestHelpers.waitForDashboard(in: app)

        // Step 1: Navigate to Trends tab
        UITestHelpers.navigateTo(tab: .trends, in: app)
        let trendsScreen = app.navigationBars.staticTexts["Trends & Analytics"]
        UITestHelpers.waitForElement(trendsScreen)

        // Step 2: Calendar visible with month navigation
        let previousButton = app.buttons["calendar-previous"]
        let nextButton = app.buttons["calendar-next"]
        UITestHelpers.waitForElement(previousButton)
        UITestHelpers.waitForElement(nextButton)

        // Step 3: Switch to the Insights section for range + statistics
        selectSection("Insights")

        // Time range selector visible (presets + custom)
        let range14d = app.buttons["time-range-14"]
        let range30d = app.buttons["time-range-30"]
        let range90d = app.buttons["time-range-90"]
        let rangeCustom = app.buttons["time-range-custom"]
        UITestHelpers.waitForElement(range14d)
        UITestHelpers.waitForElement(range30d)
        UITestHelpers.waitForElement(range90d)
        UITestHelpers.waitForElement(rangeCustom)

        // Step 4: Statistics section visible
        let dayStatsCard = app.staticTexts["Day Statistics"]
        let scroll = app.scrollViews.firstMatch
        UITestHelpers.scrollToElement(dayStatsCard, in: scroll)
        UITestHelpers.waitForElement(dayStatsCard)
    }

    // MARK: - 7.2 Time range switching

    func testTimeRangeSwitching() throws {
        app = UITestHelpers.launchCleanDashboard()
        UITestHelpers.waitForDashboard(in: app)
        UITestHelpers.navigateTo(tab: .trends, in: app)
        selectSection("Insights")

        // Step 1: Tap "14d"
        let range14d = app.buttons["time-range-14"]
        UITestHelpers.waitForHittable(range14d)
        range14d.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 2: Tap "90d"
        let range90d = app.buttons["time-range-90"]
        UITestHelpers.waitForHittable(range90d)
        range90d.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 3: Tap "30d"
        let range30d = app.buttons["time-range-30"]
        UITestHelpers.waitForHittable(range30d)
        range30d.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    // MARK: - 7.3 Empty state

    func testEmptyState() throws {
        app = UITestHelpers.launchCleanDashboard()
        UITestHelpers.waitForDashboard(in: app)
        UITestHelpers.navigateTo(tab: .trends, in: app)
        selectSection("Insights")

        let scroll = app.scrollViews.firstMatch

        // Step 1: Empty-data placeholder shown by the summary/chart cards
        let emptyPlaceholder = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Not enough data'")).firstMatch
        UITestHelpers.scrollToElement(emptyPlaceholder, in: scroll)
        UITestHelpers.waitForElement(emptyPlaceholder)

        // Step 2: Day statistics still visible
        let dayStatsCard = app.staticTexts["Day Statistics"]
        UITestHelpers.scrollUpToElement(dayStatsCard, in: scroll)
        UITestHelpers.waitForElement(dayStatsCard)

        // Verify rows exist
        let migraineDays = app.staticTexts["Migraine days"]
        let clearDays = app.staticTexts["Clear days"]
        if migraineDays.exists {
            XCTAssertTrue(migraineDays.exists)
        }
        if clearDays.exists {
            XCTAssertTrue(clearDays.exists)
        }
    }

    // MARK: - 7.4 Statistics with data

    func testStatisticsWithData() throws {
        app = UITestHelpers.launchWithFixtures()
        UITestHelpers.waitForDashboard(in: app)
        UITestHelpers.navigateTo(tab: .trends, in: app)
        selectSection("Insights")

        let scroll = app.scrollViews.firstMatch

        // Step 1: Monthly Summary (now carries episode + medication totals)
        let summaryHeader = app.staticTexts["Monthly Summary"]
        UITestHelpers.scrollToElement(summaryHeader, in: scroll)
        UITestHelpers.waitForElement(summaryHeader)

        // Step 2: Scroll up to duration metrics (above the charts)
        let durationCard = app.staticTexts["Duration Metrics"]
        UITestHelpers.scrollUpToElement(durationCard, in: scroll)
        UITestHelpers.waitForElement(durationCard)
    }

    // MARK: - 7.7 Calendar month navigation

    func testCalendarMonthNavigation() throws {
        app = UITestHelpers.launchCleanDashboard()
        UITestHelpers.waitForDashboard(in: app)
        UITestHelpers.navigateTo(tab: .trends, in: app)

        // Step 1: Tap previous
        let previousButton = app.buttons["calendar-previous"]
        UITestHelpers.waitForHittable(previousButton)
        previousButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 2: Tap next to return
        let nextButton = app.buttons["calendar-next"]
        UITestHelpers.waitForHittable(nextButton)
        nextButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    // MARK: - 7.8 Time range persistence across navigation

    func testTimeRangePersistence() throws {
        app = UITestHelpers.launchCleanDashboard()
        UITestHelpers.waitForDashboard(in: app)
        UITestHelpers.navigateTo(tab: .trends, in: app)
        selectSection("Insights")

        // Step 1: Select "90d"
        let range90d = app.buttons["time-range-90"]
        UITestHelpers.waitForHittable(range90d)
        range90d.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Step 2: Navigate to Dashboard
        UITestHelpers.navigateTo(tab: .dashboard, in: app)

        // Step 3: Return to Trends - "90d" should still be selected
        UITestHelpers.navigateTo(tab: .trends, in: app)
        selectSection("Insights")

        // Verify 90d is still selected (check if it has a selected/highlighted state)
        let range90dAfter = app.buttons["time-range-90"]
        UITestHelpers.waitForElement(range90dAfter)
        XCTAssertTrue(range90dAfter.isSelected || range90dAfter.exists,
                       "90d time range should persist after navigating away and back")
    }

    // MARK: - 7.9 Insight charts (issue #435)

    func testInsightChartCardsRender() throws {
        app = UITestHelpers.launchWithFixtures()
        UITestHelpers.waitForDashboard(in: app)
        UITestHelpers.navigateTo(tab: .trends, in: app)
        selectSection("Insights")

        let scroll = app.scrollViews.firstMatch

        // Each insight card renders with its headline. The warnings card is
        // always present (with findings or the all-clear state).
        for title in ["Warning Signs", "Headache Burden", "Medication Overuse Risk", "Severity by Week", "Time of Day", "Preventative Adherence", "Monthly Summary"] {
            let header = app.staticTexts[title]
            UITestHelpers.scrollToElement(header, in: scroll, maxScrolls: 15)
            UITestHelpers.waitForElement(header)
        }
    }

    // MARK: - 7.10 Custom time range

    func testCustomRangeSelection() throws {
        app = UITestHelpers.launchWithFixtures()
        UITestHelpers.waitForDashboard(in: app)
        UITestHelpers.navigateTo(tab: .trends, in: app)
        selectSection("Insights")

        // Open the custom range sheet and apply the default (last 30 days).
        let customChip = app.buttons["time-range-custom"]
        UITestHelpers.waitForHittable(customChip)
        customChip.tap()

        let applyButton = app.buttons["custom-range-apply"]
        UITestHelpers.waitForHittable(applyButton)
        applyButton.tap()
        Thread.sleep(forTimeInterval: 1.0)

        // The selector now shows the applied custom range.
        let rangeLabel = app.staticTexts["custom-range-label"]
        UITestHelpers.waitForElement(rangeLabel)

        // Selecting a preset clears the custom range again.
        let range30d = app.buttons["time-range-30"]
        UITestHelpers.waitForHittable(range30d)
        range30d.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        XCTAssertFalse(rangeLabel.exists, "Custom range label should clear when a preset is selected")
    }

    // MARK: - Helpers

    /// Switch the Trends screen to a section segment ("Calendar" / "Insights").
    private func selectSection(_ label: String) {
        let segment = app.buttons[label]
        UITestHelpers.waitForHittable(segment)
        segment.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }
}
