@preconcurrency import BackgroundTasks
import Foundation

/// Background refresh for iCloud sync (#462). Registers a `BGAppRefreshTask` that runs a
/// sync while the app is backgrounded, so changes propagate without the app being open.
/// Complements the existing foreground + after-write auto-sync triggers.
///
/// Only the pure scheduling decisions (`nextEarliestBeginDate`) are unit-testable; the
/// BGTaskScheduler registration/submission glue does nothing in the simulator or CI and
/// can only be exercised on a real device with the Background Modes capability
/// provisioned, so it is device-verify-only.
enum BackgroundSyncScheduler {
    /// Must match the single `BGTaskSchedulerPermittedIdentifiers` entry in Info.plist.
    static let taskIdentifier = "com.eff3.migralog.sync.refresh"

    /// How far out to ask the system to schedule the next refresh. This is a lower bound;
    /// the system picks the actual time based on usage patterns and energy budgets.
    static let refreshInterval: TimeInterval = 15 * 60

    /// Register the launch handler. Must run before the app finishes launching (from the
    /// app delegate's `didFinishLaunchingWithOptions`), or BGTaskScheduler raises.
    @MainActor
    static func register(syncService: SyncService) {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskIdentifier, using: nil) { task in
            // The handler is delivered on a system queue. Hop to the main actor to touch the
            // main-actor-isolated SyncService and to re-schedule, keeping the BGTask alive
            // until the sync finishes.
            let work = Task { @MainActor in
                schedule()
                await syncService.syncIfEnabled()
                task.setTaskCompleted(success: true)
            }
            task.expirationHandler = { work.cancel() }
        }
    }

    /// Ask the system to schedule the next background refresh. Safe to call when sync is
    /// off — the handler re-checks `isEnabled` via `syncIfEnabled()` before doing any work.
    /// Submission failures (simulator, missing entitlement, over budget) are swallowed; we
    /// never log health data (HIPAA).
    @MainActor
    static func schedule(now: Date = Date()) {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = nextEarliestBeginDate(from: now)
        try? BGTaskScheduler.shared.submit(request)
    }

    // MARK: - Pure helpers (unit-tested)

    /// The earliest time the next refresh should run: `refreshInterval` after `now`.
    static func nextEarliestBeginDate(from now: Date) -> Date {
        now.addingTimeInterval(refreshInterval)
    }
}
