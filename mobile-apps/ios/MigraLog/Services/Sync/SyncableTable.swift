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

    /// Look up a syncable table by its SQLite name. Returns nil for tables that are
    /// not synced (device-local or sync-internal).
    static func named(_ tableName: String) -> SyncableTable? {
        SyncableTable(rawValue: tableName)
    }
}
