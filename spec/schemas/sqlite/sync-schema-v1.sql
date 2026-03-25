-- MigraLog Local Sync State Schema v1
-- Local-only tables for tracking iCloud sync state. These are NOT synced.
--
-- Design:
--   - CloudKit schema is opaque (Option B): one CKRecord type "SyncRecord"
--     with a JSON payload field. All schema interpretation is client-side.
--   - CloudKit is a dumb sync pipe — no server-side queries.
--   - Zone-based sync with CKServerChangeToken for incremental pulls.
--   - Pending changes queue for reliable offline-first push.
--   - Last-write-wins conflict resolution using local updated_at timestamps.
--
-- Conventions (inherited from schema-v25.sql):
--   - All IDs are TEXT (UUIDs)
--   - Timestamps are Unix epoch milliseconds (INTEGER, > 0)
--   - Booleans are INTEGER (0 or 1)

-- Sync configuration (user preferences, singleton row)
CREATE TABLE IF NOT EXISTS sync_config (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
  wifi_only INTEGER NOT NULL DEFAULT 0 CHECK(wifi_only IN (0, 1)),
  created_at INTEGER NOT NULL CHECK(created_at > 0),
  updated_at INTEGER NOT NULL CHECK(updated_at > 0)
);

-- Zone-level sync cursor (one row per CKRecordZone, currently just 'MigraLogZone')
CREATE TABLE IF NOT EXISTS sync_zone_state (
  zone_name TEXT PRIMARY KEY,
  server_change_token BLOB,                       -- CKServerChangeToken (opaque, NSKeyedArchiver'd)
  last_sync_at INTEGER CHECK(last_sync_at IS NULL OR last_sync_at > 0),
  last_error TEXT,
  last_error_at INTEGER CHECK(last_error_at IS NULL OR last_error_at > 0)
);

-- Pending changes queue (outbound changes waiting to be pushed to CloudKit)
CREATE TABLE IF NOT EXISTS sync_pending_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,                         -- local UUID
  change_type TEXT NOT NULL CHECK(change_type IN ('upsert', 'delete')),
  created_at INTEGER NOT NULL CHECK(created_at > 0),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  UNIQUE(table_name, record_id)                    -- latest change per record wins
);

-- Conflict archive (preserves the losing side of last-write-wins resolution)
-- Recovery: restoring a conflict record is just writing the payload back to the
-- local table and queuing it for sync — same codepath as any normal edit.
-- Purge: rows older than 90 days can be deleted safely.
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,                         -- local UUID of the conflicting record
  losing_side TEXT NOT NULL CHECK(losing_side IN ('local', 'remote')),
  payload TEXT NOT NULL,                           -- full JSON snapshot of the record that lost
  winning_payload TEXT NOT NULL,                   -- full JSON snapshot of the record that won
  resolved_at INTEGER NOT NULL CHECK(resolved_at > 0),
  expires_at INTEGER NOT NULL CHECK(expires_at > resolved_at)  -- resolved_at + 90 days
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_pending_created ON sync_pending_changes(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_expires ON sync_conflicts(expires_at);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_record ON sync_conflicts(table_name, record_id);
