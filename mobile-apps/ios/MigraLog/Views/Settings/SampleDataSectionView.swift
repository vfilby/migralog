import SwiftUI

/// Settings affordance (pre-release builds only) that lets an evaluator populate
/// the app with a realistic ~90-day dataset without hand-entering anything.
///
/// Because this replaces the current database, it first writes a manual backup
/// (so any real data can be restored from **Backup & Export → Restore from
/// Backup**), then resets and loads the sample data. The backup step must succeed
/// before anything is deleted — if it fails, the load is aborted and nothing is
/// touched.
struct SampleDataSectionView: View {
    @State private var isLoading = false
    @State private var showConfirm = false
    @State private var resultMessage: String?
    @State private var resultIsError = false

    var body: some View {
        Section {
            Button {
                showConfirm = true
            } label: {
                HStack {
                    Label("Load Sample Data", systemImage: "wand.and.stars")
                    Spacer()
                    if isLoading { ProgressView() }
                }
            }
            .disabled(isLoading)
            .accessibilityIdentifier("load-sample-data")

            if let resultMessage {
                Text(resultMessage)
                    .font(.caption)
                    .foregroundStyle(resultIsError ? Color.red : .secondary)
            }
        } header: {
            Text("Sample Data")
        } footer: {
            Text("Replaces your data with a realistic 90-day demo (episodes, medications, "
                + "doses, and daily check-ins) so you can explore the app. Your current data is "
                + "backed up first — restore it any time from Backup & Export. "
                + "This option only appears in test builds.")
        }
        .alert("Load Sample Data?", isPresented: $showConfirm) {
            Button("Back Up & Load", role: .destructive) {
                Task { await loadSampleData() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This backs up your current data, then replaces everything with a sample "
                + "dataset. You can restore your data later from Backup & Export → Restore from Backup.")
        }
    }

    private func loadSampleData() async {
        isLoading = true
        resultMessage = nil
        defer { isLoading = false }

        // 1. Back up first. If this fails, abort before touching any data.
        do {
            _ = try BackupService().createBackup(
                dbManager: .shared,
                episodeCount: 0,
                medicationCount: 0
            )
        } catch {
            ErrorLogger.shared.logError(error, context: [
                "screen": "SampleDataSectionView", "action": "backupBeforeLoad"
            ])
            resultIsError = true
            resultMessage = "Backup failed — sample data not loaded. \(error.localizedDescription)"
            return
        }

        // 2. Reset and load the sample dataset.
        do {
            try DatabaseManager.shared.resetDatabase()
            try SampleDataLoader.load()
        } catch {
            ErrorLogger.shared.logError(error, context: [
                "screen": "SampleDataSectionView", "action": "loadSampleData"
            ])
            resultIsError = true
            resultMessage = "Failed to load sample data: \(error.localizedDescription)"
            return
        }

        // 3. Nudge any open screens to refresh from the new data.
        NotificationCenter.default.post(name: .episodeDataChanged, object: nil)
        NotificationCenter.default.post(name: .medicationDataChanged, object: nil)
        NotificationCenter.default.post(name: .dailyStatusDataChanged, object: nil)

        resultIsError = false
        resultMessage = "Sample data loaded. A backup of your previous data is saved in Backup & Export."
    }
}
