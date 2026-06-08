import SwiftUI

struct DeveloperToolsScreen: View {
    @Environment(AppState.self) private var appState
    @State private var showResetConfirm = false

    var body: some View {
        List {
            Section("Database") {
                Button("Reset Database", role: .destructive) {
                    showResetConfirm = true
                }

                NavigationLink {
                    ErrorLogsScreen()
                } label: {
                    Label("Error Logs", systemImage: "exclamationmark.triangle")
                }

                NavigationLink {
                    LogViewerScreen()
                } label: {
                    Label("Log Viewer", systemImage: "doc.text.magnifyingglass")
                }

                NavigationLink {
                    ScheduledNotificationsScreen()
                } label: {
                    Label("Scheduled Notifications", systemImage: "bell.badge")
                }

                NavigationLink {
                    TestNotificationsScreen()
                } label: {
                    Label("Test Notifications", systemImage: "bell.and.waves.left.and.right")
                }
            }

            Section("iCloud Sync (#434)") {
                NavigationLink {
                    SyncTestScreen()
                } label: {
                    Label("Sync Test", systemImage: "arrow.triangle.2.circlepath.icloud")
                }
            }

            Section("Onboarding") {
                Button("Reset Onboarding") {
                    appState.resetOnboarding()
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Developer Tools")
        .alert("Reset Database", isPresented: $showResetConfirm) {
            Button("Reset", role: .destructive) {
                try? DatabaseManager.shared.resetDatabase()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will delete all data. This action cannot be undone.")
        }
    }
}

// MARK: - Stub screens for settings sub-pages

struct ErrorLogsScreen: View {
    var body: some View {
        List {
            let errors = ErrorLogger.shared.getRecentErrors()
            if errors.isEmpty {
                Text("No errors logged")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(errors, id: \.timestamp) { entry in
                    VStack(alignment: .leading) {
                        Text(entry.message)
                            .font(.subheadline)
                        Text(DateFormatting.displayDateTime(entry.timestamp))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Error Logs")
    }
}
