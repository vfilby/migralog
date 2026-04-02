import XCTest

/// Basic smoke test to verify the app launches without crashing.
final class MigraLogUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testAppLaunches() throws {
        app.launch()
        XCTAssertTrue(app.exists, "App should launch without crashing")
    }

}
