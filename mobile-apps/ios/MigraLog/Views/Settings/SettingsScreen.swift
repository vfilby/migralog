import SwiftUI

struct SettingsScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        List {
            // Theme Section
            Section("Appearance") {
                ThemeSectionView()
            }

            // Notifications
            Section("Notifications") {
                NavigationLink {
                    NotificationSettingsScreen()
                } label: {
                    Label("Notifications", systemImage: "bell")
                }
                .accessibilityIdentifier("notification-settings")
            }

            // Medication Safety
            Section("Medication Safety") {
                NavigationLink {
                    CategoryLimitsScreen()
                } label: {
                    Label("Medication Safety Limits", systemImage: "exclamationmark.shield")
                }
                .accessibilityIdentifier("medication-safety-limits")
            }

            // Location
            Section("Location") {
                NavigationLink {
                    LocationSettingsScreen()
                } label: {
                    Label("Location Services", systemImage: "location")
                }
            }

            // Data
            Section("Data") {
                NavigationLink {
                    DataSettingsScreen()
                } label: {
                    Label("Backup & Export", systemImage: "externaldrive")
                }
            }

            // Developer Tools
            Section("Developer") {
                NavigationLink {
                    DeveloperToolsScreen()
                } label: {
                    Label("Developer Tools", systemImage: "wrench.and.screwdriver")
                }
            }

            // Version
            Section {
                VersionSectionView()
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
    }
}

// MARK: - Theme Section

struct ThemeSectionView: View {
    @AppStorage("selectedTheme") private var selectedTheme: String = "system"

    var body: some View {
        Picker("Theme", selection: $selectedTheme) {
            Text("Light").tag("light")
                .accessibilityIdentifier("theme-light")
            Text("Dark").tag("dark")
                .accessibilityIdentifier("theme-dark")
            Text("System").tag("system")
                .accessibilityIdentifier("theme-system")
        }
        .pickerStyle(.segmented)
    }
}

// MARK: - Version Section

struct VersionSectionView: View {
    var body: some View {
        HStack {
            Text("Version")
            Spacer()
            Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
                .foregroundStyle(.secondary)
        }
    }
}
