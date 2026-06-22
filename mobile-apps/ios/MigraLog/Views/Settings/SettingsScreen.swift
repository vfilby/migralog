import SwiftUI

struct SettingsScreen: View {
    @Environment(AppState.self) private var appState
    @AppStorage("developerModeEnabled") private var developerModeEnabled = false

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

            // Tracking
            Section("Tracking") {
                NavigationLink {
                    TrackingOptionsScreen()
                } label: {
                    Label("Tracking Options", systemImage: "slider.horizontal.3")
                }
                .accessibilityIdentifier("tracking-options")
            }

            // Medication Safety
            Section("Medication Safety") {
                NavigationLink {
                    CategorySafetyRulesScreen()
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

                NavigationLink {
                    SyncSettingsScreen()
                } label: {
                    Label("iCloud Sync", systemImage: "arrow.triangle.2.circlepath.icloud")
                }
            }

            // Sample Data (test builds only) — lets evaluators explore the app
            // with realistic data without hand-entering it.
            if BuildEnvironment.isPreRelease {
                SampleDataSectionView()
            }

            // Developer Tools (unlocked by tapping the version row 7 times)
            if developerModeEnabled {
                Section("Developer") {
                    NavigationLink {
                        DeveloperToolsScreen()
                    } label: {
                        Label("Developer Tools", systemImage: "wrench.and.screwdriver")
                    }
                    .accessibilityIdentifier("developer-tools")
                }
            }

            // Version
            Section {
                VersionSectionView(developerModeEnabled: $developerModeEnabled)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
        .readableContentWidth()
    }
}

// MARK: - Theme Section

struct ThemeSectionView: View {
    @AppStorage("selectedTheme") private var selectedTheme: ThemePreference = .system

    var body: some View {
        Picker("Theme", selection: $selectedTheme) {
            ForEach(ThemePreference.allCases) { theme in
                Text(theme.displayName).tag(theme)
                    .accessibilityIdentifier("theme-\(theme.rawValue)")
            }
        }
        .pickerStyle(.segmented)
    }
}

// MARK: - Version Section

struct VersionSectionView: View {
    @Binding var developerModeEnabled: Bool
    @State private var versionTapCount = 0
    @State private var showDeveloperModeAlert = false

    private static let tapsToToggle = 7

    var body: some View {
        HStack {
            Text("Version")
            Spacer()
            if developerModeEnabled {
                Image(systemName: "wrench.and.screwdriver")
                    .font(.footnote)
                    .foregroundStyle(.tint)
                    .accessibilityIdentifier("developer-mode-indicator")
            }
            Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
                .foregroundStyle(.secondary)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: handleVersionTap)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("version-row")
        .alert(
            developerModeEnabled ? "Developer Mode Enabled" : "Developer Mode Disabled",
            isPresented: $showDeveloperModeAlert
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(developerModeEnabled
                ? "Developer tools are now visible in Settings."
                : "Developer tools have been hidden.")
        }
    }

    private func handleVersionTap() {
        versionTapCount += 1
        guard versionTapCount >= Self.tapsToToggle else { return }
        versionTapCount = 0
        developerModeEnabled.toggle()
        showDeveloperModeAlert = true
    }
}
