import Foundation

/// A single local row encoded for transport through CloudKit. Mirrors the
/// `SyncRecord` CloudKit record type (see spec/ios/schemas/sync/schema.ckdb).
///
/// The payload is opaque to CloudKit — interpretation is entirely client-side — so
/// the local SQLite schema can evolve without ever changing the CloudKit schema.
struct SyncRecord: Equatable, Sendable {
    /// Source SQLite table name (e.g. "episodes").
    let tableName: String
    /// The row's local UUID primary key.
    let recordId: String
    /// JSON-encoded row data (see `SyncPayloadCodec`).
    let payload: String
    /// SQLite schema version that produced the payload, for migrate-on-read.
    let schemaVersion: Int
    /// Last-write time in Unix epoch milliseconds; drives last-write-wins.
    let updatedAt: Int64
    /// Soft-delete flag. A tombstone still carries the last known payload.
    let deleted: Bool

    /// CKRecord.recordName — globally unique across tables, and parseable back to
    /// its source table. Format: `"{tableName}:{recordId}"`.
    var recordName: String { "\(tableName):\(recordId)" }

    /// Parse a `recordName` back into its parts. recordIds are UUIDs (no colons),
    /// so the table name is everything before the first colon. Returns nil if the
    /// name is not in `"{tableName}:{recordId}"` form.
    static func parseRecordName(_ recordName: String) -> (tableName: String, recordId: String)? {
        guard let colon = recordName.firstIndex(of: ":") else { return nil }
        let tableName = String(recordName[..<colon])
        let recordId = String(recordName[recordName.index(after: colon)...])
        guard !tableName.isEmpty, !recordId.isEmpty else { return nil }
        return (tableName, recordId)
    }
}
