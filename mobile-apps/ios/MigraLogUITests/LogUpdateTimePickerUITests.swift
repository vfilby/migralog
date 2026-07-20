import XCTest

/// Verifies the Log Update screen's Time picker: an update can be backdated
/// and the backdated time appears on the episode timeline.
final class LogUpdateTimePickerUITests: XCTestCase {
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

    func testLogUpdateCanBeBackdated() throws {
        let now = Date()
        let episodeStart = now.addingTimeInterval(-2 * 60 * 60)
        let updateTime = now.addingTimeInterval(-30 * 60)

        // === Create an episode started 2 hours ago ===
        let startButton = app.buttons["start-episode-button"]
        let saveButton = app.buttons["save-episode-button"]
        UITestHelpers.tapToPresent(startButton, expecting: saveButton)

        let startPicker = app.datePickers.firstMatch
        XCTAssertTrue(startPicker.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                      "New episode screen should have a start time picker")
        setTime(of: startPicker, to: episodeStart)

        UITestHelpers.waitForHittable(saveButton)
        saveButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Open episode detail and the Log Update sheet ===
        let activeEpisodeCard = app.buttons["active-episode-card"]
        UITestHelpers.waitForHittable(activeEpisodeCard)
        activeEpisodeCard.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let logUpdateButton = app.buttons["log-update-button"]
        let detailScroll = app.scrollViews.firstMatch
        if !logUpdateButton.isHittable {
            UITestHelpers.scrollToElement(logUpdateButton, in: detailScroll)
        }
        UITestHelpers.waitForHittable(logUpdateButton)
        logUpdateButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Time picker is present on the Log Update screen ===
        let updatePicker = app.datePickers.firstMatch
        XCTAssertTrue(updatePicker.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                      "Log Update screen should have a Time picker")
        attach(name: "log-update-time-picker")

        // === Backdate the update by 30 minutes ===
        setTime(of: updatePicker, to: updateTime)
        XCTAssertTrue(
            timeButton(of: updatePicker, matching: updateTime)
                .waitForExistence(timeout: UITestHelpers.defaultTimeout),
            "Time picker should show the backdated time \(shortTime(updateTime))"
        )
        attach(name: "log-update-backdated-time")

        let saveUpdateButton = app.buttons["Save"]
        UITestHelpers.waitForHittable(saveUpdateButton)
        saveUpdateButton.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // === Timeline shows the intensity reading at the backdated time ===
        let backdatedEntry = app.staticTexts[shortTime(updateTime)].firstMatch
        if !backdatedEntry.exists {
            UITestHelpers.scrollToElement(backdatedEntry, in: detailScroll)
        }
        XCTAssertTrue(backdatedEntry.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                      "Timeline should show an entry at the backdated time \(shortTime(updateTime))")
        attach(name: "timeline-backdated-entry")
    }

    // MARK: - Compact DatePicker helpers

    /// The compact DatePicker's time segment button (label like "5:45 PM").
    private func timeButton(of picker: XCUIElement) -> XCUIElement {
        picker.buttons
            .matching(NSPredicate(format: "label MATCHES %@", ".*[0-9]{1,2}:[0-9]{2}.*"))
            .firstMatch
    }

    /// The time segment button only if it displays the given time.
    private func timeButton(of picker: XCUIElement, matching date: Date) -> XCUIElement {
        picker.buttons
            .matching(NSPredicate(format: "label CONTAINS %@", shortTime(date)))
            .firstMatch
    }

    /// Opens the compact picker's time popover and sets the wheels to `date`'s time.
    private func setTime(of picker: XCUIElement, to date: Date) {
        let button = timeButton(of: picker)
        XCTAssertTrue(button.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                      "Compact date picker should expose a time button")
        button.tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        let hourWheel = app.pickerWheels.element(boundBy: 0)
        XCTAssertTrue(hourWheel.waitForExistence(timeout: UITestHelpers.defaultTimeout),
                      "Tapping the time button should show picker wheels")
        // The pickers are bounded to `...Date()`, and UIKit snaps the wheels
        // back whenever an intermediate state is a future time. When backdating
        // across noon (e.g. now 12:17 PM -> target 11:47 AM), adjusting the
        // hour before the period would transiently select 11:17 PM and get
        // clamped. Setting AM/PM first keeps every intermediate state in the
        // past, so no adjustment is ever undone.
        if app.pickerWheels.count > 2 {
            app.pickerWheels.element(boundBy: 2)
                .adjust(toPickerWheelValue: component(of: date, format: "a"))
        }
        hourWheel.adjust(toPickerWheelValue: component(of: date, format: "h"))
        app.pickerWheels.element(boundBy: 1)
            .adjust(toPickerWheelValue: component(of: date, format: "mm"))
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)

        // Dismiss the popover by tapping outside it
        app.windows.firstMatch
            .coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.08))
            .tap()
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    private func component(of date: Date, format: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        return formatter.string(from: date)
    }

    private func shortTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func attach(name: String) {
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}
