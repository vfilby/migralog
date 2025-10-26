# Complete Database Schema with Relationships and Constraints

## Schema Version: 10

---

## Table Definitions

### 1. **episodes** (Parent Table)
Tracks migraine episodes with pain characteristics and intensity progression.

```sql
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  start_time INTEGER NOT NULL CHECK(start_time > 0),
  end_time INTEGER CHECK(end_time IS NULL OR end_time > start_time),
  locations TEXT NOT NULL,                    -- JSON array: PainLocation[]
  qualities TEXT NOT NULL,                    -- JSON array: PainQuality[]
  symptoms TEXT NOT NULL,                     -- JSON array: Symptom[]
  triggers TEXT NOT NULL,                     -- JSON array: Trigger[]
  notes TEXT CHECK(length(notes) <= 5000),
  peak_intensity REAL CHECK(peak_intensity IS NULL OR (peak_intensity >= 0 AND peak_intensity <= 10)),
  average_intensity REAL CHECK(average_intensity IS NULL OR (average_intensity >= 0 AND average_intensity <= 10 AND (peak_intensity IS NULL OR average_intensity <= peak_intensity))),
  latitude REAL,                              -- [Migration 2] GPS latitude
  longitude REAL,                             -- [Migration 2] GPS longitude
  location_accuracy REAL,                     -- [Migration 2] GPS accuracy in meters
  location_timestamp INTEGER,                 -- [Migration 2] When location was captured
  created_at INTEGER NOT NULL CHECK(created_at > 0),
  updated_at INTEGER NOT NULL CHECK(updated_at > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_episodes_start_time ON episodes(start_time);
CREATE INDEX IF NOT EXISTS idx_episodes_date_range ON episodes(start_time, end_time);
```

**Constraints:**
- `id`: Primary Key
- `start_time`: Required, positive timestamp
- `end_time`: Optional, must be after start_time
- `peak_intensity`: Optional, range [0, 10]
- `average_intensity`: Optional, range [0, 10], must be ≤ peak_intensity
- `notes`: Max 5000 characters
- **Cascade Dependencies:**
  - `intensity_readings` → CASCADE DELETE
  - `symptom_logs` → CASCADE DELETE
  - `pain_location_logs` → CASCADE DELETE
  - `medication_doses` → SET NULL (episodeId becomes NULL)

---

### 2. **intensity_readings** (Child of episodes)
Records point-in-time pain intensity measurements during an episode.

```sql
CREATE TABLE IF NOT EXISTS intensity_readings (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL CHECK(timestamp > 0),
  intensity REAL NOT NULL CHECK(intensity >= 0 AND intensity <= 10),
  created_at INTEGER NOT NULL CHECK(created_at > 0),
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_intensity_readings_episode ON intensity_readings(episode_id);
CREATE INDEX IF NOT EXISTS idx_intensity_readings_time ON intensity_readings(episode_id, timestamp);
```

**Constraints:**
- `id`: Primary Key
- `episode_id`: Foreign Key → episodes.id (CASCADE DELETE)
- `timestamp`: Required, positive
- `intensity`: Required, range [0, 10]

---

### 3. **symptom_logs** (Child of episodes)
Records individual symptoms with onset/resolution timing during an episode.

```sql
CREATE TABLE IF NOT EXISTS symptom_logs (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  symptom TEXT NOT NULL,
  onset_time INTEGER NOT NULL CHECK(onset_time > 0),
  resolution_time INTEGER CHECK(resolution_time IS NULL OR resolution_time > onset_time),
  severity REAL CHECK(severity IS NULL OR (severity >= 0 AND severity <= 10)),
  created_at INTEGER NOT NULL CHECK(created_at > 0),
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_symptom_logs_episode ON symptom_logs(episode_id);
```

**Constraints:**
- `id`: Primary Key
- `episode_id`: Foreign Key → episodes.id (CASCADE DELETE)
- `symptom`: Required, enum value
- `onset_time`: Required, positive
- `resolution_time`: Optional, must be after onset_time
- `severity`: Optional, range [0, 10]

**Valid Symptom Values:**
- nausea, vomiting, visual_disturbances, aura, light_sensitivity, sound_sensitivity, smell_sensitivity, dizziness, confusion

---

### 4. **pain_location_logs** (Child of episodes)
Tracks changes in pain location areas over time during an episode.

```sql
CREATE TABLE IF NOT EXISTS pain_location_logs (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL CHECK(timestamp > 0),
  pain_locations TEXT NOT NULL,              -- JSON array: PainLocation[]
  created_at INTEGER NOT NULL CHECK(created_at > 0),
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_pain_location_logs_episode ON pain_location_logs(episode_id);
```

**Constraints:**
- `id`: Primary Key
- `episode_id`: Foreign Key → episodes.id (CASCADE DELETE)
- `timestamp`: Required, positive
- `pain_locations`: Required, JSON array of location strings

**Valid Pain Location Values:**
- left_eye, right_eye, left_temple, right_temple, left_neck, right_neck, left_head, right_head, left_teeth, right_teeth

---

### 5. **medications** (Parent Table)
Defines medications (preventative or rescue) with dosage and schedule information.

```sql
CREATE TABLE IF NOT EXISTS medications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) > 0 AND length(name) <= 200),
  type TEXT NOT NULL CHECK(type IN ('preventative', 'rescue')),
  dosage_amount REAL NOT NULL CHECK(dosage_amount > 0),
  dosage_unit TEXT NOT NULL CHECK(length(dosage_unit) > 0 AND length(dosage_unit) <= 50),
  default_dosage REAL CHECK(default_dosage IS NULL OR default_dosage > 0),
  schedule_frequency TEXT CHECK(schedule_frequency IS NULL OR schedule_frequency IN ('daily', 'monthly', 'quarterly')),
  photo_uri TEXT CHECK(photo_uri IS NULL OR length(photo_uri) <= 500),
  start_date INTEGER CHECK(start_date IS NULL OR start_date > 0),
  end_date INTEGER CHECK(end_date IS NULL OR (start_date IS NULL OR end_date > start_date)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
  created_at INTEGER NOT NULL CHECK(created_at > 0),
  updated_at INTEGER NOT NULL CHECK(updated_at > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_medications_active_type ON medications(active, type) WHERE active = 1;
```

**Constraints:**
- `id`: Primary Key
- `name`: Required, 1-200 characters
- `type`: Required, enum: 'preventative' | 'rescue'
- `dosage_amount`: Required, positive number
- `dosage_unit`: Required, 1-50 characters (e.g., 'mg', 'tablets', 'ml')
- `default_dosage`: Optional, positive if present
- `schedule_frequency`: Optional, enum: 'daily' | 'monthly' | 'quarterly'
  - **MUST be present if type = 'preventative'**
- `start_date`/`end_date`: Optional, endDate > startDate if both present
- `active`: Required, boolean (0 or 1)
- **Cascade Dependencies:**
  - `medication_schedules` → CASCADE DELETE
  - `medication_doses` → CASCADE DELETE
  - `medication_reminders` → CASCADE DELETE

---

### 6. **medication_schedules** (Child of medications)
Defines when a medication should be taken (daily schedules).

```sql
CREATE TABLE IF NOT EXISTS medication_schedules (
  id TEXT PRIMARY KEY,
  medication_id TEXT NOT NULL,
  time TEXT NOT NULL CHECK(time GLOB '[0-2][0-9]:[0-5][0-9]'),
  dosage REAL NOT NULL DEFAULT 1 CHECK(dosage > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  notification_id TEXT,                      -- [Migration 4] Expo notification ID
  reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK(reminder_enabled IN (0, 1)),  -- [Migration 4]
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_medication_schedules_med ON medication_schedules(medication_id);
```

**Constraints:**
- `id`: Primary Key
- `medication_id`: Foreign Key → medications.id (CASCADE DELETE)
- `time`: Required, format HH:mm (24-hour, local timezone)
- `dosage`: Required, positive, default 1
- `enabled`: Required, boolean (0 or 1), default 1
- `notification_id`: Optional, Expo notification ID
- `reminder_enabled`: Optional, boolean (0 or 1), default 1

---

### 7. **medication_doses** (Child of medications, optional FK to episodes)
Records actual medication intake with effectiveness and side effect data.

```sql
CREATE TABLE IF NOT EXISTS medication_doses (
  id TEXT PRIMARY KEY,
  medication_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL CHECK(timestamp > 0),
  amount REAL NOT NULL CHECK(amount >= 0),
  dosage_amount REAL,                        -- [Migration 10] Snapshot of medication.dosage_amount at time of dose
  dosage_unit TEXT,                          -- [Migration 10] Snapshot of medication.dosage_unit at time of dose
  status TEXT NOT NULL DEFAULT 'taken' CHECK(status IN ('taken', 'skipped')),
  episode_id TEXT,
  effectiveness_rating REAL CHECK(effectiveness_rating IS NULL OR (effectiveness_rating >= 0 AND effectiveness_rating <= 10)),
  time_to_relief INTEGER CHECK(time_to_relief IS NULL OR (time_to_relief > 0 AND time_to_relief <= 1440)),
  side_effects TEXT,                         -- JSON array: string[]
  notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
  created_at INTEGER NOT NULL CHECK(created_at > 0),
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL,
  CHECK(status != 'taken' OR amount > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_medication_doses_medication ON medication_doses(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_doses_episode ON medication_doses(episode_id);
CREATE INDEX IF NOT EXISTS idx_medication_doses_timestamp ON medication_doses(timestamp);
CREATE INDEX IF NOT EXISTS idx_medication_doses_med_time ON medication_doses(medication_id, timestamp DESC);
```

**Constraints:**
- `id`: Primary Key
- `medication_id`: Foreign Key → medications.id (CASCADE DELETE)
- `timestamp`: Required, positive
- `amount`: Required, non-negative
  - **If status = 'taken': amount MUST be > 0**
  - **If status = 'skipped': amount can be any value**
- `dosage_amount`: Optional, snapshot from medication record at time of dose
- `dosage_unit`: Optional, snapshot from medication record at time of dose
- `status`: Required, default 'taken', enum: 'taken' | 'skipped'
- `episode_id`: Optional, Foreign Key → episodes.id (SET NULL on episode delete)
- `effectiveness_rating`: Optional, range [0, 10]
- `time_to_relief`: Optional, 1-1440 minutes
- `side_effects`: Optional, JSON array of strings

**⚠️ Migration 10 Issue:**
- Stores `dosage_amount` and `dosage_unit` separately
- Does NOT multiply by `amount` to get total consumed
- Must calculate: `total_amount = amount * dosage_amount`

---

### 8. **medication_reminders** (Child of medications)
Tracks scheduled medication reminders and completion status.

```sql
CREATE TABLE IF NOT EXISTS medication_reminders (
  id TEXT PRIMARY KEY,
  medication_id TEXT NOT NULL,
  scheduled_time INTEGER NOT NULL CHECK(scheduled_time > 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
  snoozed_until INTEGER CHECK(snoozed_until IS NULL OR snoozed_until > scheduled_time),
  completed_at INTEGER CHECK(completed_at IS NULL OR completed_at > 0),
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
  CHECK(completed = 0 OR completed_at IS NOT NULL)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_medication_reminders_scheduled ON medication_reminders(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_reminders_incomplete ON medication_reminders(medication_id, scheduled_time) WHERE completed = 0;
```

**Constraints:**
- `id`: Primary Key
- `medication_id`: Foreign Key → medications.id (CASCADE DELETE)
- `scheduled_time`: Required, positive
- `completed`: Required, boolean (0 or 1), default 0
  - **If completed = 1: completedAt MUST be present**
- `snoozed_until`: Optional, must be after scheduled_time
- `completed_at`: Optional, required if completed = 1

---

### 9. **daily_status_logs** (Independent Table)
Records overall daily health status for patterns and trends.

```sql
CREATE TABLE IF NOT EXISTS daily_status_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE CHECK(date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  status TEXT NOT NULL CHECK(status IN ('green', 'yellow', 'red')),
  status_type TEXT CHECK(status_type IS NULL OR status_type IN ('prodrome', 'postdrome', 'anxiety', 'other')),
  notes TEXT CHECK(notes IS NULL OR length(notes) <= 5000),
  prompted INTEGER NOT NULL DEFAULT 0 CHECK(prompted IN (0, 1)),
  created_at INTEGER NOT NULL CHECK(created_at > 0),
  updated_at INTEGER NOT NULL CHECK(updated_at > 0),
  CHECK(status = 'yellow' OR status_type IS NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_status_date ON daily_status_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_status_status ON daily_status_logs(status);
CREATE INDEX IF NOT EXISTS idx_daily_status_date_status ON daily_status_logs(date, status);
```

**Constraints:**
- `id`: Primary Key
- `date`: Required, UNIQUE, format YYYY-MM-DD, not in future
- `status`: Required, enum: 'green' | 'yellow' | 'red'
- `status_type`: Optional, enum: 'prodrome' | 'postdrome' | 'anxiety' | 'other'
  - **Only allowed if status = 'yellow'**
- `notes`: Optional, max 5000 characters
- `prompted`: Required, boolean (0 or 1), default 0
- No foreign keys

---

## Entity Relationship Diagram (Text Format)

```
┌─────────────────┐
│   episodes      │ (Parent)
├─────────────────┤
│ id (PK)         │
│ start_time      │
│ end_time        │
│ locations (JSON)│
│ qualities (JSON)│
│ symptoms (JSON) │
│ triggers (JSON) │
│ notes           │
│ peak_intensity  │
│ avg_intensity   │
│ latitude        │
│ longitude       │
│ location_acc    │
│ location_ts     │
│ created_at      │
│ updated_at      │
└─────────────────┘
        │
        ├──1:N──> intensity_readings (CASCADE)
        │         ├─ id
        │         ├─ episode_id (FK)
        │         ├─ timestamp
        │         ├─ intensity
        │         └─ created_at
        │
        ├──1:N──> symptom_logs (CASCADE)
        │         ├─ id
        │         ├─ episode_id (FK)
        │         ├─ symptom
        │         ├─ onset_time
        │         ├─ resolution_time
        │         ├─ severity
        │         └─ created_at
        │
        ├──1:N──> pain_location_logs (CASCADE)
        │         ├─ id
        │         ├─ episode_id (FK)
        │         ├─ timestamp
        │         ├─ pain_locations (JSON)
        │         └─ created_at
        │
        └──0:N──> medication_doses (SET NULL)
                  ├─ id
                  ├─ medication_id (FK)
                  ├─ episode_id (FK, optional)
                  ├─ timestamp
                  ├─ amount
                  ├─ dosage_amount
                  ├─ dosage_unit
                  ├─ status
                  ├─ effectiveness_rating
                  ├─ time_to_relief
                  ├─ side_effects (JSON)
                  ├─ notes
                  └─ created_at

┌─────────────────┐
│  medications    │ (Parent)
├─────────────────┤
│ id (PK)         │
│ name            │
│ type (enum)     │
│ dosage_amount   │
│ dosage_unit     │
│ default_dosage  │
│ schedule_freq   │
│ photo_uri       │
│ start_date      │
│ end_date        │
│ active          │
│ notes           │
│ created_at      │
│ updated_at      │
└─────────────────┘
        │
        ├──1:N──> medication_schedules (CASCADE)
        │         ├─ id
        │         ├─ medication_id (FK)
        │         ├─ time (HH:mm)
        │         ├─ dosage
        │         ├─ enabled
        │         ├─ notification_id
        │         └─ reminder_enabled
        │
        ├──1:N──> medication_doses (CASCADE)
        │         (See above)
        │
        └──1:N──> medication_reminders (CASCADE)
                  ├─ id
                  ├─ medication_id (FK)
                  ├─ scheduled_time
                  ├─ completed
                  ├─ snoozed_until
                  └─ completed_at

┌─────────────────────────┐
│  daily_status_logs      │ (Independent)
├─────────────────────────┤
│ id (PK)                 │
│ date (UNIQUE)           │
│ status (enum)           │
│ status_type (enum)      │
│ notes                   │
│ prompted (bool)         │
│ created_at              │
│ updated_at              │
└─────────────────────────┘
        (No relationships)
```

---

## Relationship Summary

### Direct Relationships

| Parent | Child | Type | Delete | Notes |
|--------|-------|------|--------|-------|
| episodes | intensity_readings | 1:N | CASCADE | Required FK |
| episodes | symptom_logs | 1:N | CASCADE | Required FK |
| episodes | pain_location_logs | 1:N | CASCADE | Required FK |
| episodes | medication_doses | 0:N | SET NULL | Optional FK |
| medications | medication_schedules | 1:N | CASCADE | Required FK |
| medications | medication_doses | 1:N | CASCADE | Required FK |
| medications | medication_reminders | 1:N | CASCADE | Required FK |

### Cascade Behavior

**Episode Deletion:**
- All `intensity_readings` deleted
- All `symptom_logs` deleted
- All `pain_location_logs` deleted
- All `medication_doses` have `episode_id` set to NULL

**Medication Deletion:**
- All `medication_schedules` deleted
- All `medication_doses` deleted
- All `medication_reminders` deleted

---

## JSON Serialized Fields

| Table | Column | Type | Example |
|-------|--------|------|---------|
| episodes | locations | PainLocation[] | `["left_temple","right_eye"]` |
| episodes | qualities | PainQuality[] | `["throbbing","pressure"]` |
| episodes | symptoms | Symptom[] | `["nausea","light_sensitivity"]` |
| episodes | triggers | Trigger[] | `["stress","lack_of_sleep"]` |
| pain_location_logs | pain_locations | PainLocation[] | `["left_temple","right_eye"]` |
| medication_doses | side_effects | string[] | `["nausea","dizziness"]` |

---

## Key Constraints and Business Rules

### Episode Rules
1. `start_time > 0` (required, positive)
2. `end_time > start_time` (if present)
3. `peak_intensity ∈ [0, 10]` (if present)
4. `average_intensity ∈ [0, 10]` AND `average_intensity ≤ peak_intensity` (if present)
5. All JSON arrays have domain-specific values

### Medication Rules
1. `name` required, 1-200 characters
2. `dosage_amount > 0`
3. If `type = 'preventative'`: `schedule_frequency` REQUIRED
4. If `type = 'rescue'`: `schedule_frequency` optional
5. If both `start_date` and `end_date` present: `end_date > start_date`

### Medication Dose Rules
1. If `status = 'taken'`: `amount > 0` (cannot take 0)
2. If `status = 'skipped'`: `amount` can be any value
3. `effectiveness_rating ∈ [0, 10]` (if present)
4. `time_to_relief ∈ [1, 1440]` minutes (if present)
5. **⚠️ No `total_amount` field** - must calculate as `amount × dosage_amount`

### Medication Reminder Rules
1. If `completed = 1`: `completed_at` MUST be present
2. If `snoozed_until` present: `snoozed_until > scheduled_time`

### Daily Status Rules
1. `date` format: YYYY-MM-DD, UNIQUE, not in future
2. `status ∈ ['green', 'yellow', 'red']`
3. `status_type` only allowed if `status = 'yellow'`
4. `status_type ∈ ['prodrome', 'postdrome', 'anxiety', 'other']` (if `status = 'yellow'`)

---

## Index Summary

### Performance Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| episodes | idx_episodes_start_time | Single | Date filtering |
| episodes | idx_episodes_date_range | Composite | Range queries |
| intensity_readings | idx_intensity_readings_episode | Single | Episode lookups |
| intensity_readings | idx_intensity_readings_time | Composite | Time-series queries |
| symptom_logs | idx_symptom_logs_episode | Single | Episode lookups |
| pain_location_logs | idx_pain_location_logs_episode | Single | Episode lookups |
| medications | idx_medications_active_type | Filtered | Active medication filtering |
| medication_doses | idx_medication_doses_medication | Single | Medication history |
| medication_doses | idx_medication_doses_episode | Single | Episode lookup |
| medication_doses | idx_medication_doses_timestamp | Single | Chronological access |
| medication_doses | idx_medication_doses_med_time | Composite | Recent doses per med |
| medication_reminders | idx_medication_reminders_scheduled | Single | Scheduled lookup |
| medication_reminders | idx_reminders_incomplete | Filtered | Pending reminders |
| daily_status_logs | idx_daily_status_date | Single | Day lookup |
| daily_status_logs | idx_daily_status_status | Single | Status filtering |
| daily_status_logs | idx_daily_status_date_status | Composite | Calendar views |

