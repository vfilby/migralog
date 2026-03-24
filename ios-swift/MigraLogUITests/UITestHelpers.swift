import XCTest

/// Common helpers for MigraLog UI tests.
enum UITestHelpers {

    /// Default timeout for waiting on elements.
    static let defaultTimeout: TimeInterval = 5

    /// Short pause after navigation transitions.
    static let animationWait: TimeInterval = 0.5

    // MARK: - App Launch Configurations

    /// Launch the app with a clean (reset) database and onboarding not completed.
    static func launchFreshApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting", "--reset-database"]
        app.launch()
        return app
    }

    /// Launch the app with a clean database and onboarding already completed.
    static func launchCleanDashboard() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting", "--reset-database", "--skip-onboarding"]
        app.launch()
        return app
    }

    /// Launch the app with fixture data loaded and onboarding completed.
    static func launchWithFixtures() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting", "--load-fixtures"]
        app.launch()
        return app
    }

    // MARK: - Dashboard Detection

    /// Returns the dashboard title element. In SwiftUI, `.navigationTitle("MigraLog")`
    /// renders as a staticText inside the navigation bar, not as a standalone staticText
    /// with an accessibilityIdentifier.
    static func dashboardTitle(in app: XCUIApplication) -> XCUIElement {
        return app.navigationBars.staticTexts["MigraLog"]
    }

    /// Wait for the dashboard screen to be visible.
    @discardableResult
    static func waitForDashboard(in app: XCUIApplication, timeout: TimeInterval = defaultTimeout) -> XCUIElement {
        let title = dashboardTitle(in: app)
        waitForElement(title, timeout: timeout)
        return title
    }

    // MARK: - Element Waiting

    /// Wait for an element to exist within a timeout. Returns the element.
    @discardableResult
    static func waitForElement(
        _ element: XCUIElement,
        timeout: TimeInterval = defaultTimeout,
        file: StaticString = #file,
        line: UInt = #line
    ) -> XCUIElement {
        let exists = element.waitForExistence(timeout: timeout)
        XCTAssertTrue(exists, "Element \(element) did not appear within \(timeout)s", file: file, line: line)
        return element
    }

    /// Wait for an element to disappear within a timeout.
    static func waitForElementToDisappear(
        _ element: XCUIElement,
        timeout: TimeInterval = defaultTimeout,
        file: StaticString = #file,
        line: UInt = #line
    ) {
        let predicate = NSPredicate(format: "exists == false")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
        XCTAssertEqual(result, .completed, "Element \(element) did not disappear within \(timeout)s", file: file, line: line)
    }

    /// Wait for an element to become hittable (visible and interactable).
    @discardableResult
    static func waitForHittable(
        _ element: XCUIElement,
        timeout: TimeInterval = defaultTimeout,
        file: StaticString = #file,
        line: UInt = #line
    ) -> XCUIElement {
        let predicate = NSPredicate(format: "isHittable == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        let result = XCTWaiter.wait(for: [expectation], timeout: timeout)
        XCTAssertEqual(result, .completed, "Element \(element) did not become hittable within \(timeout)s", file: file, line: line)
        return element
    }

    // MARK: - Navigation

    /// The tab identifiers for the main tab bar.
    enum Tab: String {
        case dashboard = "Dashboard"
        case episodes = "Episodes"
        case medications = "Medications"
        case trends = "Trends"
    }

    /// Navigate to a specific tab in the tab bar.
    static func navigateTo(tab: Tab, in app: XCUIApplication) {
        let tabButton = app.tabBars.buttons[tab.rawValue]
        waitForHittable(tabButton)
        tabButton.tap()
        Thread.sleep(forTimeInterval: animationWait)
    }

    // MARK: - Flexible Element Finding

    /// Find an element by accessibility identifier across multiple element types.
    /// In SwiftUI, elements can render as different types (buttons, otherElements, etc.)
    /// depending on context (e.g., NavigationLink renders as a button).
    static func findElement(
        _ identifier: String,
        in app: XCUIApplication,
        timeout: TimeInterval = defaultTimeout
    ) -> XCUIElement {
        // Try otherElements first (most common for container views)
        let other = app.otherElements[identifier]
        if other.waitForExistence(timeout: 1) {
            return other
        }
        // Try buttons (NavigationLinks, Buttons)
        let button = app.buttons[identifier]
        if button.waitForExistence(timeout: 1) {
            return button
        }
        // Try cells
        let cell = app.cells[identifier]
        if cell.waitForExistence(timeout: 1) {
            return cell
        }
        // Try static texts
        let text = app.staticTexts[identifier]
        if text.waitForExistence(timeout: 1) {
            return text
        }
        // Fallback: return the otherElements query (will fail on assertion)
        return other
    }

    // MARK: - Scrolling

    /// Scroll down in a scroll view until the target element is visible.
    static func scrollToElement(
        _ element: XCUIElement,
        in scrollView: XCUIElement,
        maxScrolls: Int = 10,
        file: StaticString = #file,
        line: UInt = #line
    ) {
        var scrollCount = 0
        while !element.isHittable && scrollCount < maxScrolls {
            scrollView.swipeUp()
            scrollCount += 1
            Thread.sleep(forTimeInterval: 0.3)
        }
        XCTAssertTrue(element.exists, "Could not scroll to element \(element) after \(maxScrolls) swipes", file: file, line: line)
    }

    /// Scroll up to find an element.
    static func scrollUpToElement(
        _ element: XCUIElement,
        in scrollView: XCUIElement,
        maxScrolls: Int = 10,
        file: StaticString = #file,
        line: UInt = #line
    ) {
        var scrollCount = 0
        while !element.isHittable && scrollCount < maxScrolls {
            scrollView.swipeDown()
            scrollCount += 1
            Thread.sleep(forTimeInterval: 0.3)
        }
        XCTAssertTrue(element.exists, "Could not scroll up to element \(element) after \(maxScrolls) swipes", file: file, line: line)
    }

    // MARK: - Onboarding

    /// Complete the onboarding flow by tapping through all steps.
    /// Handles system permission dialogs by accepting them.
    static func completeOnboarding(in app: XCUIApplication) {
        // Step 1: Welcome screen -> Continue
        let continueButton = app.buttons["Continue"]
        waitForHittable(continueButton)
        continueButton.tap()
        Thread.sleep(forTimeInterval: animationWait)

        // Step 2: Medical Disclaimer -> Continue
        waitForHittable(continueButton)
        continueButton.tap()
        Thread.sleep(forTimeInterval: animationWait)

        // Step 3: Notification Permissions -> Continue
        waitForHittable(continueButton)
        continueButton.tap()
        Thread.sleep(forTimeInterval: animationWait)

        // Handle system notification permission dialog
        handleSystemAlert(in: app, buttonLabel: "Allow")

        // Handle possible Critical Alerts dialog
        handleSystemAlert(in: app, buttonLabel: "Allow")

        // Step 4: Location Services -> Finish Setup
        let finishButton = app.buttons["Finish Setup"]
        if finishButton.waitForExistence(timeout: 3) {
            finishButton.tap()
            Thread.sleep(forTimeInterval: animationWait)

            // Handle system location permission dialog
            handleSystemAlert(in: app, buttonLabel: "Allow While Using App")
        }
    }

    /// Attempt to handle a system alert by tapping the specified button.
    static func handleSystemAlert(in app: XCUIApplication, buttonLabel: String) {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let alertButton = springboard.buttons[buttonLabel]
        if alertButton.waitForExistence(timeout: 2) {
            alertButton.tap()
            Thread.sleep(forTimeInterval: animationWait)
        }
    }

    // MARK: - Date Helpers

    /// Returns today's date formatted as YYYY-MM-DD for calendar testIDs.
    static var todayDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.string(from: Date())
    }

    /// Returns yesterday's date formatted as YYYY-MM-DD.
    static var yesterdayDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        return formatter.string(from: yesterday)
    }

    /// Returns a date N days ago formatted as YYYY-MM-DD.
    static func dateStringDaysAgo(_ days: Int) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let date = Calendar.current.date(byAdding: .day, value: -days, to: Date())!
        return formatter.string(from: date)
    }
}
