import Foundation

/// A canonical fingerprint of the synced-column schema (#469): which columns of which
/// tables replicate to CloudKit. Persisted per zone (`sync_zone_state.last_synced_schema`)
/// after each successful pull, so the engine can detect that a schema migration has
/// ADDED synced columns since the device last pulled.
///
/// Why that matters: `RemoteChangeApplier` drops payload columns the local schema
/// doesn't know (migrate-on-read). A record pulled before the upgrade is therefore
/// missing those columns locally, and the incremental cursor never redelivers it —
/// the source row hasn't changed. A manifest mismatch is what triggers the one-time
/// full re-pull that backfills the gap.
///
/// Comparing manifests — rather than `DatabaseManager.schemaVersion` — means only
/// migrations that actually change the synced column set cost a re-pull, and there is
/// no per-version bookkeeping to keep in lockstep: the manifest derives from
/// `SyncableTable.syncedColumns`, which `SyncableTableSyncedColumnsTests` already
/// pins to the live schema.
enum SyncedSchemaManifest {
    /// The current manifest: `{tableName: [syncedColumn, …]}` as canonical JSON
    /// (sorted keys, sorted columns) so equal schemas always compare equal as strings.
    static var current: String {
        let tables = Dictionary(
            uniqueKeysWithValues: SyncableTable.allCases.map { ($0.tableName, $0.syncedColumns.sorted()) }
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = (try? encoder.encode(tables)) ?? Data("{}".utf8)
        return String(decoding: data, as: UTF8.self)
    }

    /// Whether `new` contains synced columns (or whole tables) absent from `old` — the
    /// condition that opens the migrate-on-read backfill gap. A nil or unreadable `old`
    /// (first sync after this feature shipped, or corrupted state) counts as "unknown,
    /// assume added" so an existing gap heals instead of persisting silently. Pure
    /// column/table removals return false: nothing was dropped on read, so no re-pull
    /// is needed.
    static func addsSyncedColumns(from old: String?, to new: String) -> Bool {
        guard let old, let oldTables = decode(old), let newTables = decode(new) else {
            return true
        }
        return newTables.contains { tableName, columns in
            let known = Set(oldTables[tableName] ?? [])
            return columns.contains { !known.contains($0) }
        }
    }

    private static func decode(_ manifest: String) -> [String: [String]]? {
        guard let data = manifest.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode([String: [String]].self, from: data)
    }
}
