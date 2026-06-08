import Foundation

/// Which side of a sync conflict survives.
enum SyncWinner: Equatable, Sendable {
    case local
    case remote
}

/// Last-write-wins conflict resolution for iCloud sync (#434).
///
/// When the same record was modified on two devices between syncs, the version with
/// the higher local `updated_at` wins. CloudKit's own `modificationDate` reflects
/// upload time, not edit time, so we never use it — we carry our own `updatedAt`.
///
/// `deleted` gets no special treatment: a tombstone is just a version with its own
/// `updatedAt`, so a later edit resurrects a deleted row and a later delete wins over
/// an older edit. The losing payload is archived by the caller, never discarded.
enum LWWResolver {
    /// Decide which version of a record survives.
    ///
    /// Higher `updatedAt` wins. On an exact timestamp tie we break deterministically on
    /// the payload bytes (lexicographic) so every device converges on the *same* winner
    /// without consulting any server-assigned metadata. Identical payloads are not a
    /// real conflict, so local is kept.
    static func resolve(
        localUpdatedAt: Int64, localPayload: String,
        remoteUpdatedAt: Int64, remotePayload: String
    ) -> SyncWinner {
        if remoteUpdatedAt != localUpdatedAt {
            return remoteUpdatedAt > localUpdatedAt ? .remote : .local
        }
        if remotePayload != localPayload {
            return remotePayload > localPayload ? .remote : .local
        }
        return .local
    }
}
