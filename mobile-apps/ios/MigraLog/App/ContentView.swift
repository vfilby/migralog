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
                MainTabView()
            }
        }
    }
}

struct MainTabView: View {
    @State private var selectedTab: Tab = .dashboard

    enum Tab: Hashable {
        case dashboard
        case episodes
        case medications
        case trends
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                DashboardScreen()
            }
            .tabItem {
                Label("Dashboard", systemImage: "house")
            }
            .tag(Tab.dashboard)

            NavigationStack {
                EpisodesScreen()
            }
            .tabItem {
                Label("Episodes", systemImage: "bolt.heart")
            }
            .tag(Tab.episodes)

            NavigationStack {
                MedicationsScreen()
            }
            .tabItem {
                Label("Medications", systemImage: "pills")
            }
            .tag(Tab.medications)

            NavigationStack {
                AnalyticsScreen()
            }
            .tabItem {
                Label("Trends", systemImage: "chart.bar")
            }
            .tag(Tab.trends)
        }
    }
}
