import SwiftUI

/// Top-level navigation container that adapts between iPad (sidebar) and iPhone (tab bar).
struct AdaptiveNavigation: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selectedSection: NavigationSection = .dashboard
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        if sizeClass == .regular {
            iPadNavigation
        } else {
            iPhoneNavigation
        }
    }

    // MARK: - iPad: Sidebar + Content

    private var iPadNavigation: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(selection: $selectedSection)
        } detail: {
            NavigationStack {
                switch selectedSection {
                case .dashboard:
                    DashboardScreen()
                case .episodes:
                    EpisodesScreen()
                case .medications:
                    MedicationsScreen()
                case .trends:
                    AnalyticsScreen()
                case .settings:
                    SettingsScreen()
                }
            }
        }
    }

    // MARK: - iPhone: Tab Bar (existing behavior)

    private var iPhoneNavigation: some View {
        TabView(selection: $selectedSection) {
            NavigationStack {
                DashboardScreen()
            }
            .tabItem {
                Label("Dashboard", systemImage: "house")
            }
            .tag(NavigationSection.dashboard)

            NavigationStack {
                EpisodesScreen()
            }
            .tabItem {
                Label("Episodes", systemImage: "bolt.heart")
            }
            .tag(NavigationSection.episodes)

            NavigationStack {
                MedicationsScreen()
            }
            .tabItem {
                Label("Medications", systemImage: "pills")
            }
            .tag(NavigationSection.medications)

            NavigationStack {
                AnalyticsScreen()
            }
            .tabItem {
                Label("Trends", systemImage: "chart.bar")
            }
            .tag(NavigationSection.trends)
        }
    }
}

// MARK: - Navigation Section Enum

enum NavigationSection: Hashable {
    case dashboard
    case episodes
    case medications
    case trends
    case settings
}

// MARK: - Sidebar View

struct SidebarView: View {
    @Binding var selection: NavigationSection

    var body: some View {
        List(selection: $selection) {
            Section {
                Label("Dashboard", systemImage: "house")
                    .tag(NavigationSection.dashboard)
                Label("Episodes", systemImage: "bolt.heart")
                    .tag(NavigationSection.episodes)
                Label("Medications", systemImage: "pills")
                    .tag(NavigationSection.medications)
                Label("Trends", systemImage: "chart.bar")
                    .tag(NavigationSection.trends)
            }

            Section {
                Label("Settings", systemImage: "gearshape")
                    .tag(NavigationSection.settings)
            }
        }
        .navigationTitle("MigraLog")
        .listStyle(.sidebar)
    }
}
