import SwiftUI

struct DeveloperToolsScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(SyncService.self) private var syncService
    @State private var showResetConfirm = false
    @State private var showResyncConfirm = false
    @State private var resyncResult: String?

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

            Section {
                Button {
                    showResyncConfirm = true
                } label: {
                    if syncService.isSyncing {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Re-syncing…")
                        }
                    } else {
                        Label("Force Re-sync All Data", systemImage: "arrow.triangle.2.circlepath.icloud")
                    }
                }
                .disabled(!syncService.isEnabled || syncService.isSyncing)
                if let resyncResult {
                    Text(resyncResult)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("Sync")
            } footer: {
                Text(syncService.isEnabled
                    ? "Re-uploads every local record to iCloud. Devices reconverge by "
                        + "last-write-wins; run it on each device that has unsynced edits."
                    : "Enable iCloud Sync in Settings first.")
            }

            Section("Onboarding") {
                Button("Reset Onboarding") {
                    appState.resetOnboarding()
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Developer Tools")
        .readableContentWidth()
        .alert("Force Re-sync All Data", isPresented: $showResyncConfirm) {
            Button("Re-sync") {
                Task { await forceResync() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Queues every local record for upload and syncs now. "
                + "Existing data is merged by last-write-wins; nothing is deleted.")
        }
        .alert("Reset Database", isPresented: $showResetConfirm) {
            Button("Reset", role: .destructive) {
                try? DatabaseManager.shared.resetDatabase()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will delete all data. This action cannot be undone.")
        }
    }

    private func forceResync() async {
        do {
            let enqueued = try await syncService.forceFullResync()
            resyncResult = "Re-queued \(enqueued) records and synced."
        } catch {
            resyncResult = "Re-sync failed: \(error.localizedDescription)"
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
        .readableContentWidth()
    }
}
