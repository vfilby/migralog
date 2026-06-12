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

    /// How an exact-timestamp tie between two *differing* payloads should be handled
    /// when the difference may be schema richness rather than a competing edit (#469).
    enum TieMerge: Equatable, Sendable {
        /// Remote offers nothing the local row lacks — keep local untouched.
        case keepLocal
        /// The payloads agree on every column both sides hold a value for; remote
        /// additionally has non-null values for these locally missing/NULL columns.
        /// It's the same logical version — one side just knows more columns.
        case fillColumns([String])
        /// Some column carries different values on the two sides — a genuine
        /// same-timestamp conflict; fall back to the payload-byte tiebreak.
        case conflictingValues
    }

    /// Classify an exact-timestamp tie for a non-destructive column merge (#469): a row
    /// re-pulled after a schema upgrade carries the same `updated_at` as the local copy
    /// but may hold columns that migrate-on-read dropped before the upgrade. Remote
    /// NULLs never overwrite local values and local-only columns are always kept, so a
    /// `.fillColumns` merge can only add data. Convergent: both devices end at the
    /// column-union of the two payloads.
    static func tieMerge(
        localPayload: [String: SyncPayloadCodec.Value],
        remotePayload: [String: SyncPayloadCodec.Value]
    ) -> TieMerge {
        var fill: [String] = []
        for (column, remoteValue) in remotePayload where remoteValue != .null {
            let localValue = localPayload[column] ?? .null
            if localValue == .null {
                fill.append(column)
            } else if localValue != remoteValue {
                return .conflictingValues
            }
        }
        return fill.isEmpty ? .keepLocal : .fillColumns(fill.sorted())
    }
}
