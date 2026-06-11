import XCTest
import UIKit

/// iPad layout audit (issue #436): tours every screen in portrait AND landscape,
/// attaching a screenshot at each stop. Not a functional test — it exists to
/// produce review artifacts for layout work. Run on an iPad destination:
///
///     xcodebuild test -scheme MigraLog \
///       -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' \
///       -only-testing:MigraLogUITests/IPadLayoutAuditUITests
///
/// Extract attachments with `xcrun xcresulttool export attachments`.
final class IPadLayoutAuditUITests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app = XCUIApplication()
        app.launchArguments = ["--uitesting", "--load-screenshot-data"]
        app.launch()
        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        XCUIDevice.shared.orientation = .portrait
        app = nil
    }

    // MARK: - Dashboard + sheets

    func test01_Dashboard() throws {
        navigate(to: "Dashboard")
        snapBoth("dashboard")
    }

    func test02_NewEpisodeSheet() throws {
        navigate(to: "Dashboard")
        let start = UITestHelpers.findElement("start-episode-button", in: app)
        UITestHelpers.waitForHittable(start).tap()
        Thread.sleep(forTimeInterval: 1.0)
        snapBoth("sheet-new-episode")
        dismissSheet()
    }

    func test03_LogMedicationSheet() throws {
        navigate(to: "Dashboard")
        let log = UITestHelpers.findElement("log-medication-button", in: app)
        UITestHelpers.waitForHittable(log).tap()
        Thread.sleep(forTimeInterval: 1.0)
        snapBoth("sheet-log-medication")
        dismissSheet()
    }

    // MARK: - Episodes

    func test04_EpisodesActiveDetail() throws {
        navigate(to: "Episodes")
        let cells = app.cells
        _ = cells.firstMatch.waitForExistence(timeout: 5)
        cells.firstMatch.tap()
        Thread.sleep(forTimeInterval: 1.0)
        snapBoth("episodes-active-detail")
    }

    func test05_EpisodesClosedDetail() throws {
        navigate(to: "Episodes")
        let cells = app.cells
        _ = cells.firstMatch.waitForExistence(timeout: 5)
        cells.element(boundBy: 1).tap()
        Thread.sleep(forTimeInterval: 1.5)
        snapBoth("episodes-closed-detail")

        // Scroll the detail pane to capture the timeline body too.
        let scroll = app.scrollViews.firstMatch
        if scroll.exists {
            scroll.swipeUp()
            Thread.sleep(forTimeInterval: 0.8)
            snapBoth("episodes-closed-detail-scrolled")
        }
    }

    // MARK: - Medications

    func test06_MedicationsDetail() throws {
        navigate(to: "Medications")
        let erenumab = app.staticTexts["Erenumab"]
        UITestHelpers.waitForHittable(erenumab).tap()
        Thread.sleep(forTimeInterval: 1.0)
        snapBoth("medications-preventative-detail")

        // A rescue/PRN med has different sections (cooldown, daily limits).
        let rescue = app.staticTexts["Ibuprofen"]
        if rescue.exists {
            rescue.tap()
            Thread.sleep(forTimeInterval: 1.0)
            snapBoth("medications-rescue-detail")
        }
    }

    func test07_AddMedicationSheet() throws {
        navigate(to: "Medications")
        let add = app.buttons["add-medication-button"].firstMatch
        if add.waitForExistence(timeout: 3) {
            add.tap()
        } else {
            // Toolbar "+" without identifier
            let plus = app.navigationBars.buttons["Add"].firstMatch
            if plus.waitForExistence(timeout: 2) {
                plus.tap()
            } else {
                throw XCTSkip("No add-medication entry point found")
            }
        }
        Thread.sleep(forTimeInterval: 1.0)
        snapBoth("sheet-add-medication")
        dismissSheet()
    }

    // MARK: - Trends

    func test08_TrendsCalendar() throws {
        navigate(to: "Trends")
        Thread.sleep(forTimeInterval: 1.5)
        snapBoth("trends-calendar")
    }

    func test09_TrendsInsights() throws {
        navigate(to: "Trends")
        let insights = app.buttons["Insights"]
        if insights.waitForExistence(timeout: 3) {
            insights.tap()
            Thread.sleep(forTimeInterval: 1.0)
        }
        snapBoth("trends-insights-top")

        let scroll = app.scrollViews.firstMatch
        if scroll.exists {
            scroll.swipeUp()
            scroll.swipeUp()
            Thread.sleep(forTimeInterval: 0.8)
            snapBoth("trends-insights-mid")
        }
    }

    // MARK: - Settings

    func test10_Settings() throws {
        navigate(to: "Dashboard")
        let settings = UITestHelpers.findElement("settings-button", in: app)
        UITestHelpers.waitForHittable(settings).tap()
        Thread.sleep(forTimeInterval: 1.0)
        snapBoth("settings-root")

        let notif = UITestHelpers.findElement("notification-settings", in: app)
        if notif.exists {
            notif.tap()
            Thread.sleep(forTimeInterval: 1.0)
            snapBoth("settings-notifications")
            app.navigationBars.buttons.firstMatch.tap()
            Thread.sleep(forTimeInterval: 0.5)
        }

        let safety = UITestHelpers.findElement("medication-safety-limits", in: app)
        if safety.exists {
            safety.tap()
            Thread.sleep(forTimeInterval: 1.0)
            snapBoth("settings-medication-safety")
        }
    }

    // MARK: - Dashboard cross-tab navigation (iPad)

    /// Tapping an episode on the Dashboard should switch to the Episodes tab
    /// with the episode preselected — list column visible, not a pushed
    /// detail without the list.
    func test11_DashboardEpisodeOpensEpisodesTab() throws {
        try XCTSkipUnless(isIPad, "Cross-tab selection only applies to iPad")
        navigate(to: "Dashboard")
        let card = UITestHelpers.findElement("active-episode-card", in: app)
        UITestHelpers.waitForHittable(card).tap()
        Thread.sleep(forTimeInterval: 1.0)

        XCTAssertTrue(
            app.staticTexts["Episode Details"].waitForExistence(timeout: 5),
            "Episode detail should be shown"
        )
        XCTAssertTrue(
            app.cells.firstMatch.exists,
            "Episodes list column should be visible alongside the detail"
        )
        snapBoth("dashboard-to-episode")
    }

    /// Same pattern for medications: tapping a medication name on the
    /// Dashboard switches to the Medications tab with it preselected.
    func test12_DashboardMedicationOpensMedicationsTab() throws {
        try XCTSkipUnless(isIPad, "Cross-tab selection only applies to iPad")
        navigate(to: "Dashboard")
        // The plain-styled name button may surface as a non-button element
        // type, so match any descendant by identifier (as findElement does).
        let link = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'medication-name-link-'")
        ).firstMatch
        if !link.waitForExistence(timeout: 5) {
            let dump = XCTAttachment(string: app.debugDescription)
            dump.name = "accessibility-tree"
            dump.lifetime = .keepAlways
            add(dump)
        }
        UITestHelpers.waitForHittable(link).tap()
        Thread.sleep(forTimeInterval: 1.0)

        XCTAssertTrue(
            app.staticTexts["Log Dose"].waitForExistence(timeout: 5),
            "Medication detail should be shown"
        )
        XCTAssertTrue(
            app.staticTexts["Preventative"].exists || app.staticTexts["Rescue"].exists,
            "Medications list column should be visible alongside the detail"
        )
        snapBoth("dashboard-to-medication")
    }

    // MARK: - Helpers

    private var isIPad: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }

    /// Navigate to a top-level section (iPad top pill bar or iPhone tab bar).
    private func navigate(to label: String) {
        let tabBarButton = app.tabBars.buttons[label]
        if tabBarButton.waitForExistence(timeout: 1) {
            UITestHelpers.waitForHittable(tabBarButton).tap()
        } else {
            let button = app.buttons[label].firstMatch
            UITestHelpers.waitForHittable(button).tap()
        }
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    /// Capture the current screen in portrait and landscape.
    private func snapBoth(_ name: String) {
        XCUIDevice.shared.orientation = .portrait
        Thread.sleep(forTimeInterval: 1.2)
        attachScreenshot(named: "\(name)--portrait")
        XCUIDevice.shared.orientation = .landscapeLeft
        Thread.sleep(forTimeInterval: 1.2)
        attachScreenshot(named: "\(name)--landscape")
        XCUIDevice.shared.orientation = .portrait
        Thread.sleep(forTimeInterval: 0.8)
    }

    private func dismissSheet() {
        let cancel = app.navigationBars.buttons["Cancel"].firstMatch
        if cancel.waitForExistence(timeout: 2) {
            cancel.tap()
        }
        Thread.sleep(forTimeInterval: 0.5)
    }

    private func attachScreenshot(named name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
