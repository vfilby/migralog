import SwiftUI
import UniformTypeIdentifiers

struct DataSettingsScreen: View {
    @State private var isExporting = false
    @State private var isBackingUp = false
    @State private var isRestoring = false
    @State private var showShareSheet = false
    @State private var showDocumentPicker = false
    @State private var showRestoreConfirm = false
    @State private var showRestoreSuccess = false
    @State private var exportURL: URL?
    @State private var pendingBackupShareURL: URL?
    @State private var showBackupShareWarning = false
    @State private var showBackupShareSheet = false
    @State private var backups: [BackupMetadata] = []
    @State private var showError = false
    @State private var errorMessage = ""

    var body: some View {
        List {
            Section {
                Button {
                    Task { await exportJSON() }
                } label: {
                    HStack {
                        Label("Export as JSON", systemImage: "doc.text")
                        Spacer()
                        if isExporting { ProgressView() }
                    }
                }
                .disabled(isExporting)
            } header: {
                Text("Export")
            } footer: {
                Text("Export your data as JSON for sharing with healthcare providers.")
            }

            Section("Backup") {
                Button {
                    Task { await createBackup() }
                } label: {
                    HStack {
                        Label("Create Backup", systemImage: "arrow.down.doc")
                        Spacer()
                        if isBackingUp { ProgressView() }
                    }
                }
                .disabled(isBackingUp)

                Button {
                    showRestoreConfirm = true
                } label: {
                    HStack {
                        Label("Restore from Backup", systemImage: "arrow.up.doc")
                        Spacer()
                        if isRestoring { ProgressView() }
                    }
                }
                .disabled(isRestoring)
            }

            if !backups.isEmpty {
                Section {
                    ForEach(backups, id: \.id) { backup in
                        backupRow(backup)
                    }
                } header: {
                    Text("Existing Backups")
                } footer: {
                    Text("Tap the share icon to send a backup to AirDrop, Files, or another app. Swipe a row to delete.")
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Backup & Export")
        .sheet(isPresented: $showShareSheet) {
            if let url = exportURL {
                ShareSheet(items: [url])
            }
        }
        .sheet(isPresented: $showDocumentPicker) {
            DatabaseDocumentPicker { url in
                Task { await restoreFromFile(url) }
            }
        }
        .alert("Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
        .alert("Restore from Backup", isPresented: $showRestoreConfirm) {
            Button("Choose File", role: .destructive) {
                showDocumentPicker = true
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will replace all current data with the backup. This action cannot be undone. Please create a backup first if needed.")
        }
        .alert("Share Unencrypted Backup?", isPresented: $showBackupShareWarning) {
            Button("Share", role: .destructive) {
                showBackupShareSheet = true
            }
            Button("Cancel", role: .cancel) {
                pendingBackupShareURL = nil
            }
        } message: {
            Text("Backups contain your complete health history — episodes, medications, and notes — unencrypted. Only share them with people and apps you trust.")
        }
        .sheet(isPresented: $showBackupShareSheet) {
            if let url = pendingBackupShareURL {
                ShareSheet(items: [url])
            }
        }
        .alert("Restore Complete", isPresented: $showRestoreSuccess) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Your data has been restored from the backup file.")
        }
        .task {
            await loadBackups()
        }
    }

    @ViewBuilder
    private func backupRow(_ backup: BackupMetadata) -> some View {
        let url = (try? BackupService().backupFileURL(for: backup.id))
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(backup.fileName ?? "Backup")
                    .font(.subheadline)
                Text(DateFormatting.displayDateTime(TimestampHelper.toDate(backup.timestamp)))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let url, FileManager.default.fileExists(atPath: url.path) {
                Button {
                    pendingBackupShareURL = url
                    showBackupShareWarning = true
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundStyle(.tint)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Share backup")
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                Task { await deleteBackup(id: backup.id) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private func deleteBackup(id: String) async {
        do {
            let service = BackupService()
            try service.deleteBackup(id: id)
            await loadBackups()
        } catch {
            ErrorLogger.shared.logError(error, context: ["screen": "DataSettingsScreen", "action": "deleteBackup"])
            errorMessage = "Delete failed: \(error.localizedDescription)"
            showError = true
        }
    }

    private func exportJSON() async {
        isExporting = true
        defer { isExporting = false }
        do {
            let service = ExportService()
            exportURL = try service.exportDataAsJSON(dbManager: DatabaseManager.shared)
            showShareSheet = true
        } catch {
            ErrorLogger.shared.logError(error, context: ["screen": "DataSettingsScreen", "action": "exportJSON"])
            errorMessage = "Export failed: \(error.localizedDescription)"
            showError = true
        }
    }

    private func createBackup() async {
        isBackingUp = true
        defer { isBackingUp = false }
        do {
            let service = BackupService()
            _ = try service.createBackup(
                dbManager: DatabaseManager.shared,
                episodeCount: 0,
                medicationCount: 0
            )
            await loadBackups()
        } catch {
            ErrorLogger.shared.logError(error, context: ["screen": "DataSettingsScreen", "action": "createBackup"])
            errorMessage = "Backup failed: \(error.localizedDescription)"
            showError = true
        }
    }

    private func restoreFromFile(_ url: URL) async {
        isRestoring = true
        defer { isRestoring = false }

        // Ensure we have access to the security-scoped resource
        let didStartAccess = url.startAccessingSecurityScopedResource()
        defer {
            if didStartAccess {
                url.stopAccessingSecurityScopedResource()
            }
        }

        do {
            // Copy the file to a temporary location so we can work with it
            // after the security-scoped resource access ends
            let tempDir = FileManager.default.temporaryDirectory
            let tempPath = tempDir.appendingPathComponent("restore_\(UUID().uuidString).db")
            try FileManager.default.copyItem(at: url, to: tempPath)

            let service = BackupService()
            try service.restoreFromBackup(path: tempPath.path, dbManager: DatabaseManager.shared)

            // Clean up temp file
            try? FileManager.default.removeItem(at: tempPath)

            await loadBackups()
            showRestoreSuccess = true
        } catch {
            ErrorLogger.shared.logError(error, context: ["screen": "DataSettingsScreen", "action": "restoreFromBackup"])
            errorMessage = "Restore failed: \(error.localizedDescription)"
            showError = true
        }
    }

    private func loadBackups() async {
        do {
            let service = BackupService()
            backups = try service.listBackups()
        } catch {
            ErrorLogger.shared.logError(error, context: ["screen": "DataSettingsScreen", "action": "loadBackups"])
            AppLogger.shared.error("Failed to load backups", error: error)
        }
    }
}

// MARK: - Document Picker

struct DatabaseDocumentPicker: UIViewControllerRepresentable {
    let onPick: (URL) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick)
    }

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        // Allow .db files and generic data types
        let supportedTypes: [UTType] = [
            UTType(filenameExtension: "db") ?? .data,
            .database,
            .data
        ]
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: supportedTypes, asCopy: true)
        picker.delegate = context.coordinator
        picker.allowsMultipleSelection = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: (URL) -> Void

        init(onPick: @escaping (URL) -> Void) {
            self.onPick = onPick
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first else { return }
            onPick(url)
        }
    }
}

// MARK: - Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
