import Foundation
import GRDB

/// Coordinates iCloud sync (#434): owns the engine, the on/off config, and the
/// enable/disable flow. The single surface the app and settings UI talk to. Holds one
/// `SyncEngine` (an actor), so overlapping sync triggers serialise rather than racing.
@MainActor
@Observable
final class SyncService {
    private(set) var isEnabled: Bool
    private(set) var isSyncing = false
    private(set) var lastSyncedAt: Int64?
    private(set) var lastError: String?

    private let dbManager: DatabaseManager
    private let backupService: BackupServiceProtocol
    private let configStore: SyncConfigStore
    private let pendingStore: SyncPendingChangesStore
    private let engine: SyncEngine

    @ObservationIgnored private var autoSyncTask: Task<Void, Never>?
    @ObservationIgnored private var debounceTask: Task<Void, Never>?
    /// How long after the last local edit to wait before an automatic sync.
    @ObservationIgnored var afterWriteDebounce: Duration = .seconds(3)

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
    /// Never runs against the in-memory fallback DB: when database initialization fell
    /// back to memory (corruption, or a locked-device BFU window), syncing would push the
    /// empty fallback's state and could clobber real data on other devices, or operate on
    /// data that isn't actually persisted (#527). Bail out until the real DB is in use.
    func syncIfEnabled() async {
        guard isEnabled else { return }
        guard !DatabaseManager.isUsingInMemoryFallback else { return }
        try? await syncNow()
    }

    /// Re-enqueue every row in every synced table and run a sync, so devices reconverge
    /// after a missed window (e.g. changes dropped by an earlier defect). Safe to run
    /// any time: pushes resolve by last-write-wins, and rows already queued — including
    /// pending deletes — are left as-is. A no-op while sync is disabled (enabling later
    /// backfills anyway). Returns the number of rows enqueued.
    @discardableResult
    func forceFullResync() async throws -> Int {
        guard isEnabled else { return 0 }
        let enqueued = try pendingStore.backfillExistingRows(at: TimestampHelper.now)
        try await syncNow()
        return enqueued
    }

    // MARK: - Automatic triggers

    /// Start watching the pending queue so a local edit triggers an automatic sync.
    /// When the queue grows (a captured edit), debounce briefly then sync. Idempotent —
    /// call once on launch. Combine with a foreground trigger calling `syncIfEnabled()`.
    func startAutoSync() {
        guard autoSyncTask == nil else { return }
        let observation = ValueObservation.tracking { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM sync_pending_changes") ?? 0
        }
        let dbQueue = dbManager.dbQueue
        autoSyncTask = Task { [weak self] in
            var lastCount: Int?
            do {
                for try await count in observation.values(in: dbQueue) {
                    // React only to growth (new local edits), not to the queue draining on push.
                    if let lastCount, count > lastCount {
                        self?.scheduleDebouncedSync()
                    }
                    lastCount = count
                }
            } catch {
                // Observation ended (teardown) — nothing to do.
            }
        }
    }

    private func scheduleDebouncedSync() {
        debounceTask?.cancel()
        let delay = afterWriteDebounce
        debounceTask = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await self?.syncIfEnabled()
        }
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
