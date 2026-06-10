import XCTest
import UIKit

/// Generates App Store screenshots from a synthetic-but-realistic dataset.
///
/// Run on the device size you want to ship — e.g. iPhone 17 Pro Max for the 6.9"
/// screenshots App Store Connect requires:
///
///     xcodebuild test \
///       -scheme MigraLog \
///       -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max,OS=26.0' \
///       -only-testing:MigraLogUITests/ScreenshotsUITests
///
/// Screenshots are attached to the .xcresult bundle with `.keepAlways` lifetime.
/// Extract them with:
///
///     xcrun xcresulttool get --legacy --path <path>.xcresult --format json
///
/// or by opening the result bundle in Xcode (Report Navigator → Test → Attachments).
final class ScreenshotsUITests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--uitesting", "--load-screenshot-data"]
        app.launch()
        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Screenshots

    /// 1. Dashboard — daily driver: today's medications, daily status, recent episodes.
    func test01_Dashboard() throws {
        navigate(to: "Dashboard")
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "01-Dashboard")
    }

    /// 2. Episode timeline — the centerpiece. Opens a recent closed episode
    /// with intensity readings, doses, and notes laid out chronologically.
    /// On iPad this also shows the list-detail split view in one frame.
    func test02_EpisodeTimeline() throws {
        navigate(to: "Episodes")
        if isIPad {
            // iPad uses a List-with-selection split view; tap the second row
            // (first row is the active episode; second is a closed one with
            // a fuller timeline).
            let cells = app.cells
            _ = cells.firstMatch.waitForExistence(timeout: 5)
            cells.element(boundBy: 1).tap()
        } else {
            let episodeCard = UITestHelpers.findElement("episode-card-1", in: app)
            UITestHelpers.waitForHittable(episodeCard).tap()
        }
        Thread.sleep(forTimeInterval: 1.5)
        attachScreenshot(named: "02-Episode-Timeline")
    }

    /// 3. Medications — preventatives + rescue list with schedules.
    /// On iPad the split view shows the list + the selected medication's detail.
    func test03_Medications() throws {
        navigate(to: "Medications")
        if isIPad {
            let erenumab = app.staticTexts["Erenumab"]
            UITestHelpers.waitForHittable(erenumab).tap()
            Thread.sleep(forTimeInterval: 1.0)
        }
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "03-Medications")
    }

    /// 4. Trends → Calendar — previous month with daily-status dots and overlay.
    /// The current month often only has a few days populated, so step back one
    /// to land on a fully-filled month.
    func test04_Calendar() throws {
        navigate(to: "Trends")
        let prev = app.buttons["calendar-previous"]
        UITestHelpers.waitForHittable(prev).tap()
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "04-Calendar")
    }

    /// 5. Trends → Statistics — Day Statistics + Duration Metrics cards.
    /// On iPhone scrolls past the calendar; on iPad the stats live in the
    /// sidebar of the split view and are visible without scrolling. Uses
    /// the 90d range so the iPad screenshot's numbers differ from
    /// `test04_Calendar` (default 30d).
    func test05_Statistics() throws {
        navigate(to: "Trends")
        if isIPad {
            // Switch to 90d so stats reflect a different aggregate than test04.
            let range90d = app.buttons["time-range-90"]
            if range90d.waitForExistence(timeout: 5) {
                range90d.tap()
            }
            Thread.sleep(forTimeInterval: 1.5)
        } else {
            // iPhone: stats live in the Insights section.
            let insightsSegment = app.buttons["Insights"]
            UITestHelpers.waitForHittable(insightsSegment).tap()
            let scroll = app.scrollViews.firstMatch
            let durationMetrics = app.staticTexts["Duration Metrics"]
            UITestHelpers.scrollToElement(durationMetrics, in: scroll)
            Thread.sleep(forTimeInterval: 1.0)
        }
        attachScreenshot(named: "05-Statistics")
    }

    /// 6. Episodes list — episode history with intensity sparklines.
    /// On iPad pre-selects the active "Today / Ongoing" episode so the detail
    /// pane shows live in-progress tracking rather than the empty placeholder.
    func test06_EpisodeHistory() throws {
        navigate(to: "Episodes")
        if isIPad {
            let cells = app.cells
            _ = cells.firstMatch.waitForExistence(timeout: 5)
            cells.firstMatch.tap()
            Thread.sleep(forTimeInterval: 1.0)
        }
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "06-Episode-History")
    }

    /// 7. Trends → Insight charts — warning callouts, the rolling 28-day
    /// headache-burden trend vs. the chronic range, and medication-overuse
    /// risk in intake days (issue #435). On iPad these fill the wide
    /// visualization pane below the calendar.
    func test07_TrendsInsights() throws {
        navigate(to: "Trends")
        let insightsSegment = app.buttons["Insights"]
        UITestHelpers.waitForHittable(insightsSegment).tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
        let scroll = app.scrollViews.firstMatch

        let headacheBurden = app.staticTexts["Headache Burden"]
        UITestHelpers.scrollToElement(headacheBurden, in: scroll, maxScrolls: 15)
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "07-Trends-Insights")

        let monthlySummary = app.staticTexts["Monthly Summary"]
        UITestHelpers.scrollToElement(monthlySummary, in: scroll, maxScrolls: 15)
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "08-Trends-Insights-Distributions")
    }

    // MARK: - Helpers

    /// True when running on iPad, where TabView renders as a top pill bar
    /// (not a bottom tab bar) and Episodes/Medications/Trends use NavigationSplitView.
    private var isIPad: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }

    /// Navigate to a top-level section. Handles both the iPhone bottom tab bar
    /// and the iPad top horizontal pill bar (iOS 26+ TabView on iPad).
    private func navigate(to label: String) {
        let tabBarButton = app.tabBars.buttons[label]
        if tabBarButton.waitForExistence(timeout: 1) {
            UITestHelpers.waitForHittable(tabBarButton).tap()
        } else {
            // iPad: TabView renders tabs as plain buttons in a horizontal bar.
            let button = app.buttons[label].firstMatch
            UITestHelpers.waitForHittable(button).tap()
        }
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    private func attachScreenshot(named name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
