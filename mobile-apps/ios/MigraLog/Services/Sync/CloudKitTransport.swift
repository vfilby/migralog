import Foundation

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
    /// Create the custom record zone if it does not already exist. Idempotent.
    func ensureZone() async throws

    /// Save the given records (upserts and tombstones) to the zone. Throws if any
    /// record fails to save.
    func push(_ records: [SyncRecord]) async throws

    /// Fetch changes since `token` (nil for a first full sync). Returns the changed
    /// records, the new token to persist, and whether more pages remain.
    func fetchChanges(since token: Data?) async throws -> SyncChangeBatch
}
