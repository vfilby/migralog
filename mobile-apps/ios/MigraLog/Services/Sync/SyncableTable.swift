import Foundation

/// The set of local SQLite tables replicated to iCloud, plus the per-table rules
/// for turning a row into a sync payload. This is the client-side source of truth
/// for *what* syncs — CloudKit itself is a dumb pipe (see spec/ios/icloud-sync.md).
///
/// Device-local tables are intentionally absent: `scheduled_notifications` and
/// `medication_reminders` are per-device OS notification bookkeeping, and the
/// `sync_*` tables are local sync state. Only durable health + configuration data
/// syncs.
enum SyncableTable: String, CaseIterable, Sendable {
    case episodes
    case intensityReadings = "intensity_readings"
    case symptomLogs = "symptom_logs"
    case painLocationLogs = "pain_location_logs"
    case episodeNotes = "episode_notes"
    case medications
    case medicationSchedules = "medication_schedules"
    case medicationDoses = "medication_doses"
    case dailyStatusLogs = "daily_status_logs"
    case calendarOverlays = "calendar_overlays"
    case categorySafetyRules = "category_safety_rules"
    case trackingOptions = "tracking_options"

    /// The SQLite table name.
    var tableName: String { rawValue }

    /// Primary-key column. Every synced table uses a TEXT UUID `id`.
    var primaryKeyColumn: String { "id" }

    /// Columns excluded from the synced payload because they are device-local and
    /// meaningless (or harmful) on another device — the receiving device regenerates
    /// them locally. Currently only `medication_schedules.notification_id`, which
    /// references a notification registered on the originating device.
    var deviceLocalColumns: Set<String> {
        switch self {
        case .medicationSchedules:
            return ["notification_id"]
        default:
            return []
        }
    }

    /// Relative apply order for pulled records: lower applies first. Parent tables
    /// (those referenced by a foreign key) must land before their children so inserts
    /// don't violate FK constraints. `episodes` and `medications` are the only parents.
    var applyPriority: Int {
        switch self {
        case .episodes, .medications:
            return 0
        default:
            return 1
        }
    }

    /// The synced columns for this table, in a fixed order. This MUST equal the live
    /// table's columns (`PRAGMA table_info`) minus `deviceLocalColumns`, matching exactly
    /// what `SyncPayloadCodec.encodePayload` emits.
    ///
    /// Why this is enumerated by hand: the DELETE capture triggers build the recoverable
    /// tombstone payload with a SQL `json_object('col', OLD.col, …)`, and a trigger cannot
    /// read `PRAGMA table_info` to discover columns — it needs literal column names baked in
    /// at CREATE TRIGGER time. So this list is the authoritative column inventory the
    /// triggers iterate over.
    ///
    /// DRIFT RISK (#463): if a future migration adds/removes a column on one of these
    /// tables, this list must be updated in lockstep or the captured tombstone payload will
    /// silently miss (or wrongly include) a column. `SyncableTableSyncedColumnsTests`
    /// asserts this list matches the live schema for every table to catch that drift.
    var syncedColumns: [String] {
        switch self {
        case .episodes:
            return ["id", "start_time", "end_time", "locations", "qualities", "symptoms",
                    "triggers", "notes", "latitude", "longitude", "location_accuracy",
                    "location_timestamp", "created_at", "updated_at"]
        case .intensityReadings:
            return ["id", "episode_id", "timestamp", "intensity", "created_at", "updated_at"]
        case .symptomLogs:
            return ["id", "episode_id", "symptom", "onset_time", "resolution_time",
                    "severity", "created_at", "updated_at"]
        case .painLocationLogs:
            return ["id", "episode_id", "timestamp", "pain_locations", "created_at", "updated_at"]
        case .episodeNotes:
            return ["id", "episode_id", "timestamp", "note", "created_at", "updated_at"]
        case .medications:
            return ["id", "name", "type", "dosage_amount", "dosage_unit", "default_quantity",
                    "schedule_frequency", "photo_uri", "active", "notes", "category",
                    "created_at", "updated_at", "min_interval_hours"]
        case .medicationSchedules:
            // notification_id is excluded (deviceLocalColumns).
            return ["id", "medication_id", "time", "timezone", "dosage", "enabled",
                    "reminder_enabled", "created_at", "updated_at"]
        case .medicationDoses:
            return ["id", "medication_id", "timestamp", "quantity", "dosage_amount",
                    "dosage_unit", "status", "episode_id", "effectiveness_rating",
                    "time_to_relief", "side_effects", "notes", "created_at", "updated_at"]
        case .dailyStatusLogs:
            return ["id", "date", "status", "status_type", "notes", "prompted",
                    "created_at", "updated_at"]
        case .calendarOverlays:
            return ["id", "start_date", "end_date", "label", "notes", "exclude_from_stats",
                    "created_at", "updated_at"]
        case .categorySafetyRules:
            return ["id", "category", "type", "period_hours", "max_count", "created_at", "updated_at"]
        case .trackingOptions:
            return ["id", "category", "value", "is_built_in", "is_hidden", "created_at", "updated_at"]
        }
    }

    /// Look up a syncable table by its SQLite name. Returns nil for tables that are
    /// not synced (device-local or sync-internal).
    static func named(_ tableName: String) -> SyncableTable? {
        SyncableTable(rawValue: tableName)
    }
}
