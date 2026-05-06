import XCTest

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
        UITestHelpers.navigateTo(tab: .dashboard, in: app)
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "01-Dashboard")
    }

    /// 2. Episode timeline — the centerpiece. Opens a recent closed episode
    /// with intensity readings, doses, and notes laid out chronologically.
    func test02_EpisodeTimeline() throws {
        UITestHelpers.navigateTo(tab: .episodes, in: app)
        // Index 1 = most recent closed episode (index 0 is the active "ongoing" one,
        // which has thinner timeline content).
        let episodeCard = UITestHelpers.findElement("episode-card-1", in: app)
        UITestHelpers.waitForHittable(episodeCard).tap()
        Thread.sleep(forTimeInterval: 1.5)
        attachScreenshot(named: "02-Episode-Timeline")
    }

    /// 3. Medications — preventatives + rescue list with schedules.
    func test03_Medications() throws {
        UITestHelpers.navigateTo(tab: .medications, in: app)
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "03-Medications")
    }

    /// 4. Trends → Calendar — previous month with daily-status dots and overlay.
    /// The current month often only has a few days populated, so step back one
    /// to land on a fully-filled month.
    func test04_Calendar() throws {
        UITestHelpers.navigateTo(tab: .trends, in: app)
        let prev = app.buttons["calendar-previous"]
        UITestHelpers.waitForHittable(prev).tap()
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "04-Calendar")
    }

    /// 5. Trends → Statistics — Day Statistics + Duration Metrics cards.
    /// Scrolls past the calendar so the stats cards dominate the frame.
    func test05_Statistics() throws {
        UITestHelpers.navigateTo(tab: .trends, in: app)
        let scroll = app.scrollViews.firstMatch
        let durationMetrics = app.staticTexts["Duration Metrics"]
        UITestHelpers.scrollToElement(durationMetrics, in: scroll)
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "05-Statistics")
    }

    /// 6. Episodes list — episode history with intensity sparklines.
    func test06_EpisodeHistory() throws {
        UITestHelpers.navigateTo(tab: .episodes, in: app)
        Thread.sleep(forTimeInterval: 1.0)
        attachScreenshot(named: "06-Episode-History")
    }

    // MARK: - Helpers

    private func attachScreenshot(named name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
