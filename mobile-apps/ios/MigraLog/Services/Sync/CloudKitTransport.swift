import Foundation

/// Recoverable conditions a transport can signal so the engine can react — retry,
/// reset, or skip — instead of failing the whole sync. Implementations map their
/// backend errors (e.g. `CKError`) onto these; the engine handles them generically.
enum SyncTransportError: Error, Equatable {
    /// No iCloud account is available — skip syncing.
    case accountUnavailable
    /// The custom zone is missing (e.g. the user deleted iCloud data) — recreate and retry.
    case zoneNotFound
    /// The saved server change token is no longer valid — discard it and re-pull fully.
    case changeTokenExpired
}

/// A page of remote changes pulled from a CloudKit zone.
struct SyncChangeBatch: Equatable, Sendable {
    /// Changed/created records since the supplied token, including tombstones
    /// (records with `deleted == true`). Deletes propagate as tombstones, not as
    /// CKRecord deletions, so they arrive here like any other change.
    let records: [SyncRecord]
    /// The updated server change token to persist for the next incremental pull.
    let newToken: Data?
    /// True when the server has more pages to deliver; the caller should fetch again.
    let moreComing: Bool
}

/// The seam between the sync engine and CloudKit. The engine talks only to this
/// protocol so its logic (queue draining, last-write-wins, conflict archiving) can be
/// unit-tested against an in-memory fake — the real CloudKit round-trip needs a device
/// / iCloud account and is verified separately (#434).
///
/// Implementations must be safe to call from a single sync task at a time; the engine
/// serialises sync runs.
protocol CloudKitTransport: Sendable {
    /// Whether an iCloud account is currently available to sync with. The engine skips
    /// syncing when this is false rather than failing on every CloudKit call.
    func accountAvailable() async throws -> Bool

    /// Create the custom record zone if it does not already exist. Idempotent.
    func ensureZone() async throws

    /// Save the given records (upserts and tombstones) to the zone, resolving any
    /// server-side conflict by last-write-wins (#461). A record is only overwritten when
    /// our version wins LWW against whatever the server currently holds; when the server
    /// holds a *newer* version, ours is dropped and the server's is returned so the engine
    /// can apply it locally and converge. Returns the server records that won (empty in the
    /// common no-conflict case). Throws if any record fails to save for a non-conflict
    /// reason (the engine keeps the queue and retries).
    @discardableResult
    func push(_ records: [SyncRecord]) async throws -> [SyncRecord]

    /// Fetch changes since `token` (nil for a first full sync). Returns the changed
    /// records, the new token to persist, and whether more pages remain.
    func fetchChanges(since token: Data?) async throws -> SyncChangeBatch
}
