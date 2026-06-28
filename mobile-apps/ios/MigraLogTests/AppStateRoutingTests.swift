import XCTest
@testable import MigraLog

@MainActor
final class AppStateRoutingTests: XCTestCase {
    func testShowTrends_defaultsToNoSection() {
        let appState = AppState()
        appState.showTrends()
        XCTAssertEqual(appState.selectedTab, .trends)
        XCTAssertNil(appState.pendingAnalyticsSection)
    }

    func testShowTrends_deepLinksToInsights() {
        // The "See your trends" tip should land on Insights, not the default
        // Calendar view of the Trends tab.
        let appState = AppState()
        appState.showTrends(section: .insights)
        XCTAssertEqual(appState.selectedTab, .trends)
        XCTAssertEqual(appState.pendingAnalyticsSection, .insights)
    }

    func testShowTrends_canTargetCalendar() {
        let appState = AppState()
        appState.showTrends(section: .calendar)
        XCTAssertEqual(appState.selectedTab, .trends)
        XCTAssertEqual(appState.pendingAnalyticsSection, .calendar)
    }
}
