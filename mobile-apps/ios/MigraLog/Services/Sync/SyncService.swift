import Foundation

/// Coordinates iCloud sync (#434): owns the engine, the on/off config, and the
/// enable/disable flow. The single surface the app and settings UI talk to. Holds one
/// `SyncEngine` (an actor), so overlapping sync triggers serialise rather than racing.
@MainActor
final class SyncService: ObservableObject {
    @Published private(set) var isEnabled: Bool
    @Published private(set) var isSyncing = false
    @Published private(set) var lastSyncedAt: Int64?
    @Published private(set) var lastError: String?

    private let dbManager: DatabaseManager
    private let backupService: BackupServiceProtocol
    private let configStore: SyncConfigStore
    private let pendingStore: SyncPendingChangesStore
    private let engine: SyncEngine

    init(
        dbManager: DatabaseManager = .shared,
        transport: CloudKitTransport = CloudKitSyncTransport(),
        backupService: BackupServiceProtocol = BackupService()
    ) {
        self.dbManager = dbManager
        self.backupService = backupService
        self.configStore = SyncConfigStore(dbManager: dbManager)
        self.pendingStore = SyncPendingChangesStore(dbManager: dbManager)
        self.engine = SyncEngine(
            transport: transport, dbManager: dbManager,
            pendingStore: pendingStore, zoneStore: SyncZoneStateStore(dbManager: dbManager),
            applier: RemoteChangeApplier(dbManager: dbManager)
        )

        let config = (try? configStore.config()) ?? SyncConfig(enabled: false, lastSyncedAt: nil, lastError: nil)
        self.isEnabled = config.enabled
        self.lastSyncedAt = config.lastSyncedAt
        self.lastError = config.lastError
    }

    /// Turn sync on: back up first, enqueue all existing rows, start capturing new edits,
    /// persist the flag, then run a first sync.
    func enable() async throws {
        try backUp()
        try pendingStore.backfillExistingRows(at: TimestampHelper.now)
        try setCaptureEnabled(true)
        try configStore.setEnabled(true)
        isEnabled = true
        try await syncNow()
    }

    /// Turn sync off: stop capturing new edits and clear the flag. Queued and already-
    /// synced data are left as-is.
    func disable() throws {
        try setCaptureEnabled(false)
        try configStore.setEnabled(false)
        isEnabled = false
    }

    /// Run a sync cycle now, recording success/failure. Throws on failure (after recording).
    func syncNow() async throws {
        isSyncing = true
        defer { isSyncing = false }
        let now = TimestampHelper.now
        do {
            _ = try await engine.sync(now: now)
            try configStore.recordSuccess(at: now)
            lastSyncedAt = now
            lastError = nil
        } catch {
            let message = error.localizedDescription
            try? configStore.recordFailure(message)
            lastError = message
            throw error
        }
    }

    /// Sync only if enabled — the entry point for automatic triggers (foreground, etc.).
    func syncIfEnabled() async {
        guard isEnabled else { return }
        try? await syncNow()
    }

    // MARK: - Helpers

    private func backUp() throws {
        let counts = try dbManager.dbQueue.read { db in
            (episodes: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes") ?? 0,
             medications: try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medications") ?? 0)
        }
        _ = try backupService.createBackup(
            dbManager: dbManager, episodeCount: counts.episodes, medicationCount: counts.medications
        )
    }

    private func setCaptureEnabled(_ enabled: Bool) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "UPDATE sync_capture_state SET enabled = ? WHERE id = 1", arguments: [enabled ? 1 : 0]
            )
        }
    }
}
