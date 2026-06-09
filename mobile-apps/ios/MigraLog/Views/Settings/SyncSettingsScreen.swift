import SwiftUI

/// User-facing iCloud Sync settings (#434): turn sync on/off, see last-sync status,
/// and trigger a manual sync. Backed by `SyncService`.
struct SyncSettingsScreen: View {
    @Environment(SyncService.self) private var syncService
    @State private var isToggling = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section {
                Toggle("iCloud Sync", isOn: Binding(
                    get: { syncService.isEnabled },
                    set: { on in Task { await setEnabled(on) } }
                ))
                .disabled(isToggling || syncService.isSyncing)
            } footer: {
                Text("Keep your migraine history in sync across your devices through your "
                    + "private iCloud account. Turning this on backs up your data first, then uploads it.")
            }

            if syncService.isEnabled {
                Section("Status") {
                    LabeledContent("Last synced", value: lastSyncedText)
                    if let error = syncService.lastError {
                        LabeledContent("Last error") {
                            Text(error).foregroundStyle(.red)
                        }
                    }
                    Button {
                        Task { await syncNow() }
                    } label: {
                        if syncService.isSyncing {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Syncing…")
                            }
                        } else {
                            Text("Sync Now")
                        }
                    }
                    .disabled(syncService.isSyncing || isToggling)
                }
            }
        }
        .navigationTitle("iCloud Sync")
        .alert("Sync Error", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var lastSyncedText: String {
        guard let last = syncService.lastSyncedAt else { return "Never" }
        return DateFormatting.displayDateTime(TimestampHelper.toDate(last))
    }

    private func setEnabled(_ on: Bool) async {
        isToggling = true
        defer { isToggling = false }
        do {
            if on {
                try await syncService.enable()
            } else {
                try syncService.disable()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func syncNow() async {
        do {
            try await syncService.syncNow()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
