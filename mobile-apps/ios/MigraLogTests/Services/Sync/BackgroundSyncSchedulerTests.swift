import XCTest
@testable import MigraLog

/// Covers the pure, testable surface of `BackgroundSyncScheduler` (#462). The live
/// BGTaskScheduler registration/submission can only be verified on a real device, so it
/// is not exercised here — `schedule()` is only checked to be a safe no-op when the
/// scheduler is unavailable (as in the simulator).
final class BackgroundSyncSchedulerTests: XCTestCase {
    func testNextEarliestBeginDateIsRefreshIntervalAhead() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let next = BackgroundSyncScheduler.nextEarliestBeginDate(from: now)
        XCTAssertEqual(next.timeIntervalSince(now), BackgroundSyncScheduler.refreshInterval, accuracy: 0.001)
        XCTAssertEqual(next, now.addingTimeInterval(15 * 60))
    }

    func testRefreshIntervalIsFifteenMinutes() {
        XCTAssertEqual(BackgroundSyncScheduler.refreshInterval, 15 * 60)
    }

    func testTaskIdentifierMatchesPermittedIdentifierContract() {
        // Must equal the single BGTaskSchedulerPermittedIdentifiers entry in Info.plist.
        XCTAssertEqual(BackgroundSyncScheduler.taskIdentifier, "com.eff3.migralog.sync.refresh")
    }

    @MainActor
    func testScheduleIsSafeWhenSchedulerUnavailable() {
        // In the simulator BGTaskScheduler.submit throws; schedule() must swallow it and
        // not crash.
        BackgroundSyncScheduler.schedule()
    }
}
