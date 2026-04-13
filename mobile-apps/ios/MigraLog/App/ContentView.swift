import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @Environment(TimezoneChangeService.self) private var timezoneChangeService
    @State private var selectedTab: TabSection = .dashboard

    var body: some View {
        Group {
            if DatabaseManager.initializationError != nil {
                DatabaseErrorView()
            } else if appState.isLoading {
                ProgressView("Loading...")
            } else if !appState.isOnboardingComplete {
                WelcomeScreen()
            } else {
                AdaptiveNavigation(selectedTab: $selectedTab)
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
                selectedTab = .medications
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
    }
}
