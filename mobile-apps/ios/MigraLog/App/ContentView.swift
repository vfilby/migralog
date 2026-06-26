import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @Environment(TimezoneChangeService.self) private var timezoneChangeService
    @Environment(SyncService.self) private var syncService
    @Environment(\.scenePhase) private var scenePhase

    /// Ensures the launch-time Live Activity reconcile runs exactly once per app
    /// launch, on the first foreground (see the `.active` handler below).
    @State private var didReconcileLiveActivities = false

    /// Drives the periodic (~weekly) automatic database backup. Self-throttles via a
    /// persisted timestamp, so calling `runIfDue()` on launch and every foreground is safe.
    @State private var autoBackupService = AutoBackupService()

    var body: some View {
        @Bindable var appState = appState
        Group {
            if DatabaseManager.initializationError != nil {
                DatabaseErrorView()
            } else if appState.isLoading {
                ProgressView("Loading...")
            } else if !appState.isOnboardingComplete {
                WelcomeScreen()
            } else {
                AdaptiveNavigation(selectedTab: $appState.selectedTab)
            }
        }
        .alert(
            "Timezone Changed",
            isPresented: Binding(
                get: { timezoneChangeService.pendingChange != nil },
                set: { if !$0 { timezoneChangeService.dismissChange() } }
            ),
            presenting: timezoneChangeService.pendingChange
        ) { change in
            Button("Review Schedules") {
                appState.selectedTab = .medications
                timezoneChangeService.dismissChange()
            }
            Button("OK", role: .cancel) {
                timezoneChangeService.dismissChange()
            }
        } message: { change in
            Text(
                "You've moved from \(change.previousDisplayName) to \(change.currentDisplayName). "
                + "Your medication reminders will fire at the same local clock time in the new zone — "
                + "a 9:00 PM reminder still fires at 9:00 PM. "
                + "Review your schedules if you'd like to adjust them."
            )
        }
        // Privacy shield for the app-switcher snapshot (#531). iOS snapshots the
        // app during the `.inactive` transition (before `.background`), so cover the
        // content whenever the scene is anything other than `.active`. The cover is
        // opaque and carries no PHI, so the thumbnail shows the logo, not health data.
        // No transition/animation keeps it from flickering on foreground return.
        .overlay {
            if scenePhase != .active {
                PrivacyCoverView()
                    .transition(.identity)
            }
        }
        .animation(nil, value: scenePhase)
        .task {
            syncService.startAutoSync()
            autoBackupService.runIfDue()
        }
        .onOpenURL { url in
            // Live Activity quick actions open migralog:// URLs; route them into
            // navigation state. AppState ignores anything it doesn't recognize.
            appState.handle(url: url)
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                Task { await syncService.syncIfEnabled() }
                autoBackupService.runIfDue()
                // Live Activity work must run on the `.active` scene phase, not a
                // launch-time `.task`: ActivityKit rejects `Activity.request()`
                // with an `ActivityAuthorization: visibility (Code 7)` error when
                // the app isn't yet foreground, which the launch `.task` couldn't
                // guarantee.
                //
                // Every foreground: make sure the active episode has a Live
                // Activity. This recovers a create-time start that didn't take
                // (e.g. ActivityKit not ready at first use). It only ever *adds*
                // a missing activity, so it's safe to repeat.
                LiveActivityManager.shared.ensureActivityForCurrentEpisode()
                // First foreground per launch only: also dismiss stale/mismatched
                // activities (orphan from a force-quit, stale warm close). Gated
                // so it doesn't tear down the warm post-episode close on every
                // return.
                if !didReconcileLiveActivities {
                    didReconcileLiveActivities = true
                    LiveActivityManager.shared.reconcileOnLaunch()
                }
            case .background:
                // Queue a background refresh so changes keep syncing while backgrounded (#462).
                BackgroundSyncScheduler.schedule()
            default:
                break
            }
        }
    }
}
