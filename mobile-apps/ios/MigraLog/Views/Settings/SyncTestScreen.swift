#if DEBUG
import CloudKit
import GRDB
import SwiftUI

/// DEBUG-only manual harness for exercising the real CloudKit transport (#434) on a
/// device, before sync is wired into the app. Lets you enable change-capture, make a
/// test edit, and run a full sync cycle by hand, then watch the result. Runs against
/// CloudKit's Development environment (local Xcode builds) — isolated from the
/// Production data a TestFlight build uses. Never compiled into release builds.
struct SyncTestScreen: View {
    @State private var captureEnabled = false
    @State private var accountStatus = "—"
    @State private var pendingCount = 0
    @State private var isSyncing = false
    @State private var log: [String] = []

    private let db = DatabaseManager.shared
    private let containerID = "iCloud.com.eff3.migralog"

    var body: some View {
        List {
            Section("CloudKit") {
                LabeledContent("Account", value: accountStatus)
                LabeledContent("Pending changes", value: "\(pendingCount)")
                Button("Refresh") { Task { await refresh() } }
            }

            Section("Capture") {
                Toggle("Capture local edits", isOn: $captureEnabled)
                    .onChange(of: captureEnabled) { _, on in setCapture(on) }
                Text("Off by default. Turn on so edits get queued into sync_pending_changes.")
                    .font(.caption).foregroundStyle(.secondary)
            }

            Section("Actions") {
                Button("Insert test medication") { insertTestMedication() }
                Button(isSyncing ? "Syncing…" : "Sync now") { Task { await syncNow() } }
                    .disabled(isSyncing)
                Text("On device A: enable capture, insert a test med, Sync now. "
                    + "On device B: Sync now, then check Medications.")
                    .font(.caption).foregroundStyle(.secondary)
            }

            Section("Log") {
                if log.isEmpty {
                    Text("No activity yet").foregroundStyle(.secondary)
                } else {
                    ForEach(Array(log.enumerated()), id: \.offset) { _, line in
                        Text(line).font(.caption.monospaced())
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Sync Test")
        .task { await refresh() }
    }

    // MARK: - Status

    private func refresh() async {
        do {
            let status = try await CKContainer(identifier: containerID).accountStatus()
            accountStatus = Self.describe(status)
        } catch {
            accountStatus = "error: \(error.localizedDescription)"
        }
        pendingCount = (try? await db.dbQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM sync_pending_changes") ?? 0
        }) ?? -1
        captureEnabled = ((try? await db.dbQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT enabled FROM sync_capture_state WHERE id = 1")
        }) ?? 0) == 1
    }

    // MARK: - Actions

    private func setCapture(_ on: Bool) {
        do {
            try db.dbQueue.write { db in
                try db.execute(sql: "UPDATE sync_capture_state SET enabled = ? WHERE id = 1", arguments: [on ? 1 : 0])
            }
            append("capture \(on ? "enabled" : "disabled")")
        } catch {
            append("capture toggle failed: \(error.localizedDescription)")
        }
    }

    private func insertTestMedication() {
        let id = UUID().uuidString
        let shortName = "SyncTest-\(id.prefix(8))"
        let now = Self.nowMillis()
        do {
            try db.dbQueue.write { db in
                try db.execute(
                    sql: """
                        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
                        VALUES (?, ?, 'rescue', 1, 'mg', ?, ?)
                        """,
                    arguments: [id, shortName, now, now]
                )
            }
            append("inserted \(shortName)")
        } catch {
            append("insert failed: \(error.localizedDescription)")
        }
        Task { await refresh() }
    }

    private func syncNow() async {
        isSyncing = true
        defer { isSyncing = false }
        let engine = SyncEngine(
            transport: CloudKitSyncTransport(containerIdentifier: containerID),
            dbManager: db,
            pendingStore: SyncPendingChangesStore(dbManager: db),
            zoneStore: SyncZoneStateStore(dbManager: db),
            applier: RemoteChangeApplier(dbManager: db)
        )
        do {
            let result = try await engine.sync(now: Self.nowMillis())
            append("sync ok — pushed \(result.pushed), applied \(result.applied)")
        } catch {
            append("sync failed: \(error.localizedDescription)")
        }
        await refresh()
    }

    // MARK: - Helpers

    private func append(_ line: String) {
        log.insert(line, at: 0)
        if log.count > 50 { log.removeLast() }
    }

    private static func nowMillis() -> Int64 {
        Int64(Date().timeIntervalSince1970 * 1000)
    }

    private static func describe(_ status: CKAccountStatus) -> String {
        switch status {
        case .available: return "available"
        case .noAccount: return "no iCloud account"
        case .restricted: return "restricted"
        case .couldNotDetermine: return "could not determine"
        case .temporarilyUnavailable: return "temporarily unavailable"
        @unknown default: return "unknown"
        }
    }
}
#endif
