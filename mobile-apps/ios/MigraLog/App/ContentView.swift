import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if DatabaseManager.initializationError != nil {
                DatabaseErrorView()
            } else if appState.isLoading {
                ProgressView("Loading...")
            } else if !appState.isOnboardingComplete {
                WelcomeScreen()
            } else {
                AdaptiveNavigation()
            }
        }
    }
}
