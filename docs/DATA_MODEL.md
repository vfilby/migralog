# Migraine Tracker - Data Model Documentation

## Overview

This document describes the complete data model for the Migraine Tracker application. The app uses SQLite as the primary data store and includes validation schemas using Zod for type safety.

**Current Schema Version:** 10

---

## Core Concepts

### Data Flow
1. **Database Rows** (`types.ts`): Raw SQLite data with snake_case column names and primitive types
2. **Domain Models** (`models/types.ts`): Application-level types with camelCase properties and richer structure
3. **Validation Schemas** (`schemas/`): Zod schemas that ensure data integrity before writes

### Timestamps
- All timestamps are **Unix epoch milliseconds** (not seconds)
- Used for temporal ordering and range queries
- Date strings follow `YYYY-MM-DD` format for daily aggregations

### Serialization
- Complex types (arrays, objects) are stored as **JSON strings** in the database
- Parsed using `safeJSONParse()` with validators for type safety
- Supports backward compatibility with lenient validation

---

## Entity Models

### 1. Episode

**Purpose:** Records a migraine episode with location, characteristics, and intensity progression.

#### Domain Model (`Episode`)
```typescript
{
  id: string;                          // UUID
  startTime: number;                   // Unix timestamp (ms)
  endTime?: number;                    // Optional - null if ongoing
  locations: PainLocation[];           // Where pain occurred
  qualities: PainQuality[];            // How pain felt
  symptoms: Symptom[];                 // Associated symptoms
  triggers: Trigger[];                 // Identified triggers
  notes?: string;                      // User notes (max 5000 chars)
  peakIntensity?: number;              // 0-10 scale
  averageIntensity?: number;           // 0-10 scale, must be ≤ peakIntensity
  location?: EpisodeLocation;          // GPS coordinates when recorded
  createdAt: number;                   // Record creation timestamp
  updatedAt: number;                   // Last modification timestamp
}
```

#### Database Row (`EpisodeRow`)
Stored in `episodes` table with JSON serialization:
- `locations` → JSON array of PainLocation values
- `qualities` → JSON array of PainQuality values
- `symptoms` → JSON array of Symptom values
- `triggers` → JSON array of Trigger values

#### Constraints
- `startTime > 0` (must be valid positive timestamp)
- `endTime IS NULL OR endTime > startTime` (end after start)
- `peak_intensity` and `average_intensity` in range [0, 10]
- `average_intensity ≤ peak_intensity` (if both present)
- `notes ≤ 5000` characters
- Indexes on `start_time` and date ranges for efficient querying

#### Related Data
- **IntensityReading**: Many readings per episode
- **SymptomLog**: Many symptoms with timing per episode
- **PainLocationLog**: Multiple pain location changes per episode
- **MedicationDose**: Links rescue medications taken during episode

---

### 2. Intensity Reading

**Purpose:** Records a point-in-time pain intensity measurement during an episode.

#### Domain Model (`IntensityReading`)
```typescript
{
  id: string;              // UUID
  episodeId: string;       // FK → Episode.id
  timestamp: number;       // When reading was taken (Unix ms)
  intensity: number;       // 0-10 scale
  createdAt: number;       // Record creation timestamp
}
```

#### Database Row (`IntensityReadingRow`)
Stored in `intensity_readings` table

#### Constraints
- `episodeId` must reference valid Episode
- `timestamp > 0`
- `intensity` in range [0, 10]
- Foreign key constraint: CASCADE delete with episode
- Indexed on `episode_id` and `timestamp` for time-series queries

#### Use Cases
- Track pain progression throughout an episode
- Calculate averages and peaks
- Visualize pain over time in charts

---

### 3. Symptom Log

**Purpose:** Records individual symptoms with onset/resolution timing and severity.

#### Domain Model (`SymptomLog`)
```typescript
{
  id: string;                 // UUID
  episodeId: string;          // FK → Episode.id
  symptom: Symptom;           // Specific symptom type
  onsetTime: number;          // When symptom started (Unix ms)
  resolutionTime?: number;    // When symptom ended
  severity?: number;          // 0-10 scale
  createdAt: number;          // Record creation timestamp
}
```

#### Database Row (`SymptomLogRow`)
Stored in `symptom_logs` table

#### Constraints
- `onsetTime > 0`
- `resolutionTime IS NULL OR resolutionTime > onsetTime`
- `severity` optional, in range [0, 10] if present
- Foreign key constraint: CASCADE delete with episode
- Indexed on `episode_id`

#### Valid Symptoms
- `nausea`
- `vomiting`
- `visual_disturbances`
- `aura`
- `light_sensitivity`
- `sound_sensitivity`
- `smell_sensitivity`
- `dizziness`
- `confusion`

---

### 4. Pain Location Log

**Purpose:** Tracks changes in pain location areas over time during an episode.

#### Domain Model (`PainLocationLog`)
```typescript
{
  id: string;                   // UUID
  episodeId: string;            // FK → Episode.id
  timestamp: number;            // When location(s) were recorded (Unix ms)
  painLocations: PainLocation[]; // Array of pain locations
  createdAt: number;            // Record creation timestamp
}
```

#### Database Row (`PainLocationLogRow`)
Stored in `pain_location_logs` table
- `pain_locations` → JSON array of PainLocation values

#### Constraints
- `episodeId` must reference valid Episode
- `timestamp > 0`
- At least one location required
- Foreign key constraint: CASCADE delete with episode
- Indexed on `episode_id`

#### Valid Pain Locations
- `left_eye` / `right_eye`
- `left_temple` / `right_temple`
- `left_neck` / `right_neck`
- `left_head` / `right_head`
- `left_teeth` / `right_teeth`

---

### 5. Medication

**Purpose:** Defines a medication (preventative or rescue) with dosage and schedule information.

#### Domain Model (`Medication`)
```typescript
{
  id: string;                     // UUID
  name: string;                   // 1-200 characters
  type: 'preventative' | 'rescue'; // Medication purpose
  dosageAmount: number;           // Amount per dose (e.g., 500)
  dosageUnit: string;             // Unit name (e.g., 'mg', 'tablets')
  defaultDosage?: number;         // Default number of units
  scheduleFrequency?: 'daily' | 'monthly' | 'quarterly'; // For preventative
  photoUri?: string;              // Photo of medication
  schedule?: MedicationSchedule[]; // Related schedules
  startDate?: number;             // When medication started
  endDate?: number;               // When medication ended
  active: boolean;                // Currently taking?
  notes?: string;                 // User notes (max 5000 chars)
  createdAt: number;              // Record creation timestamp
  updatedAt: number;              // Last modification timestamp
}
```

#### Database Row (`MedicationRow`)
Stored in `medications` table

#### Constraints
- `name`: 1-200 characters, required
- `type`: Must be 'preventative' or 'rescue'
- `dosage_amount > 0`
- `dosage_unit`: 1-50 characters, required
- `active`: 0 or 1 (boolean)
- `endDate IS NULL OR endDate > startDate`
- **Preventative medications MUST have scheduleFrequency**
- Composite index on `(active, type)` for filtering active meds
- Notes ≤ 5000 characters

#### Type-Specific Rules

**Preventative Medications:**
- Must have a `scheduleFrequency` (daily, monthly, quarterly)
- Should have associated `MedicationSchedule` entries
- May have `startDate` and `endDate` to track usage periods
- Track long-term efficacy

**Rescue Medications:**
- Taken as-needed during/after episodes
- Optional schedule
- Can be linked to specific `Episode` via `MedicationDose.episodeId`
- Track effectiveness against episodes

---

### 6. Medication Schedule

**Purpose:** Defines when a medication should be taken (daily schedules).

#### Domain Model (`MedicationSchedule`)
```typescript
{
  id: string;              // UUID
  medicationId: string;    // FK → Medication.id
  time: string;            // HH:mm format (24-hour, local timezone)
  dosage: number;          // Number of doses at this time
  enabled: boolean;        // Is this schedule active?
  notificationId?: string; // Expo notification ID
  reminderEnabled?: boolean; // Can disable reminders for this schedule
}
```

#### Database Row (`MedicationScheduleRow`)
Stored in `medication_schedules` table

#### Constraints
- `time` format: Matches `[0-2][0-9]:[0-5][0-9]` regex
- `dosage > 0`
- `enabled`: 0 or 1 (boolean)
- Foreign key constraint: CASCADE delete with medication
- Local timezone interpretation (client-side)

#### Time Format
- 24-hour format: `09:30`, `14:00`, `23:59`
- Interpreted in user's local timezone
- Used for daily reminder scheduling

---

### 7. Medication Dose

**Purpose:** Records actual medication intake with effectiveness and side effect data.

#### Domain Model (`MedicationDose`)
```typescript
{
  id: string;                  // UUID
  medicationId: string;        // FK → Medication.id
  timestamp: number;           // When taken/skipped (Unix ms)
  amount: number;              // Number of dosage units
  status?: 'taken' | 'skipped'; // Defaults to 'taken'
  episodeId?: string;          // FK → Episode.id (rescue meds)
  effectivenessRating?: number; // 0-10 scale
  timeToRelief?: number;       // Minutes to relief
  sideEffects?: string[];      // Array of side effects
  notes?: string;              // User notes (max 5000 chars)
  createdAt: number;           // Record creation timestamp
}
```

#### Database Row (`MedicationDoseRow`)
Stored in `medication_doses` table
- `side_effects` → JSON array of strings (if present)

#### Constraints
- `timestamp > 0`
- `amount ≥ 0`
- **For taken doses: `amount > 0`** (can't take 0)
- **For skipped doses: `amount` can be any value**
- `status`: 'taken' or 'skipped' (default: 'taken')
- `effectivenessRating` optional, in range [0, 10] if present
- `timeToRelief`: 1-1440 minutes (1 minute to 24 hours)
- Foreign keys with SET NULL on episode delete (preserves dose history)
- Indexes on `(medication_id, timestamp DESC)` for recent doses

#### Use Cases
- Track medication adherence
- Correlate effectiveness with episodes
- Monitor side effects
- Calculate time-to-relief statistics

---

### 8. Medication Reminder

**Purpose:** Tracks scheduled medication reminders and completion status.

#### Domain Model (`MedicationReminder`)
```typescript
{
  id: string;              // UUID
  medicationId: string;    // FK → Medication.id
  scheduledTime: number;   // When reminder was scheduled (Unix ms)
  completed: boolean;      // Was medication taken?
  snoozedUntil?: number;   // Snoozed until time (if applicable)
  completedAt?: number;    // When medication was taken
}
```

#### Database Row (`MedicationReminderRow`)
Stored in `medication_reminders` table

#### Constraints
- `scheduledTime > 0`
- `completed`: 0 or 1 (boolean)
- **If `completed = 1`, then `completedAt` must be present**
- `snoozedUntil IS NULL OR snoozedUntil > scheduledTime`
- Foreign key constraint: CASCADE delete with medication
- Index on `(medication_id, scheduled_time)` where completed = 0 (pending reminders)

#### Reminder Lifecycle
1. **Scheduled** → Reminder created at scheduled time
2. **Snoozed** (optional) → User delays, `snoozedUntil` updated
3. **Completed** → User confirms, `completedAt` set
4. **Expired** → Not completed by deadline

---

### 9. Daily Status Log

**Purpose:** Records overall daily health status for patterns and trends.

#### Domain Model (`DailyStatusLog`)
```typescript
{
  id: string;                // UUID
  date: string;              // YYYY-MM-DD format
  status: 'green' | 'yellow' | 'red'; // Health status
  statusType?: 'prodrome' | 'postdrome' | 'anxiety' | 'other'; // Only for yellow
  notes?: string;            // User notes (max 5000 chars)
  prompted: boolean;         // From daily prompt?
  createdAt: number;         // Record creation timestamp
  updatedAt: number;         // Last modification timestamp
}
```

#### Database Row (`DailyStatusLogRow`)
Stored in `daily_status_logs` table

#### Constraints
- `date`: YYYY-MM-DD format, must be valid date, not in future
- `status`: 'green', 'yellow', or 'red'
- **`statusType` only allowed if `status = 'yellow'`**
- `prompted`: 0 or 1 (boolean)
- UNIQUE constraint on `date` (one entry per day)
- Indexes on `(date, status)` for daily views and filtering

#### Status Definitions

**Green (Good Day)**
- No migraine or warning signs
- Normal function
- No statusType needed

**Yellow (Caution Day)**
- Warning signs or recovery
- Requires `statusType`:
  - `prodrome`: Warning signs before migraine
  - `postdrome`: Recovery period after migraine
  - `anxiety`: Worried about potential migraine
  - `other`: Other yellow day reasons

**Red (Bad Day)**
- Active migraine episode
- Limited function
- No statusType needed

---

## Enumerations

### Pain Locations (10 types)
```
left_eye, right_eye,
left_temple, right_temple,
left_neck, right_neck,
left_head, right_head,
left_teeth, right_teeth
```

### Pain Qualities (6 types)
```
throbbing, sharp, dull, pressure, stabbing, burning
```

### Symptoms (9 types)
```
nausea, vomiting, visual_disturbances, aura,
light_sensitivity, sound_sensitivity, smell_sensitivity,
dizziness, confusion
```

### Triggers (10 types)
```
stress, lack_of_sleep, weather_change, bright_lights,
loud_sounds, alcohol, caffeine, food, hormonal, exercise
```

---

## Relationships and Cascading

### Primary Relationships

```
Episode (parent)
  ├── IntensityReading (CASCADE delete)
  ├── SymptomLog (CASCADE delete)
  ├── PainLocationLog (CASCADE delete)
  └── MedicationDose (SET NULL on episode delete)

Medication (parent)
  ├── MedicationSchedule (CASCADE delete)
  ├── MedicationDose (CASCADE delete)
  └── MedicationReminder (CASCADE delete)
```

### Episode ↔ MedicationDose
- **One-to-Many**: Episode can have many associated doses
- **Rescue medications** linked to episodes for effectiveness tracking
- Dose record preserved if episode deleted (episodeId becomes NULL)

---

## Data Validation

### Zod Schemas Location
- `schemas/episode.schema.ts`: Episode, intensity, symptoms, pain locations
- `schemas/medication.schema.ts`: Medications, schedules, doses, reminders
- `schemas/dailyStatus.schema.ts`: Daily status logs
- `schemas/common.schema.ts`: Shared validators (timestamps, notes)

### Common Validations

**Timestamps (TimestampSchema)**
- Must be positive integer
- Represents Unix milliseconds
- Enforces temporal ordering (e.g., endTime > startTime)

**Notes (NotesSchema)**
- Max 5000 characters
- Optional in most cases
- Trimmed before storage

**Numeric Scales**
- **Intensity/Severity**: 0-10 range
- **Latitude**: -90 to 90
- **Longitude**: -180 to 180
- **Effectiveness Rating**: 0-10 range
- **Dosage Amount**: Must be positive, finite

---

## Performance Considerations

### Key Indexes
1. **Episode Queries**
   - `idx_episodes_start_time`: Date range queries
   - `idx_episodes_date_range`: Composite for range filtering

2. **Medication Queries**
   - `idx_medications_active_type`: Active preventative/rescue filtering
   - `idx_medication_doses_med_time`: Recent doses per medication
   - `idx_reminders_incomplete`: Pending reminders

3. **Time-Series Queries**
   - `idx_intensity_readings_time`: Intensity progression per episode
   - `idx_medication_doses_timestamp`: Chronological dose access

4. **Daily View**
   - `idx_daily_status_date`: Single-day lookup
   - `idx_daily_status_date_status`: Status filtering by date

### Query Patterns

**Recent Episodes**
```sql
SELECT * FROM episodes 
WHERE start_time > ? 
ORDER BY start_time DESC
```

**Active Medications**
```sql
SELECT * FROM medications 
WHERE active = 1 AND type = ?
```

**Pending Reminders**
```sql
SELECT * FROM medication_reminders 
WHERE completed = 0 AND scheduled_time <= ?
```

**Daily Timeline**
```sql
SELECT * FROM daily_status_logs 
WHERE date = ?
```

---

## Data Export/Backup

### Backup Strategy
- Full SQLite database backup
- JSON serialization of complex types
- Preserves all historical data with timestamps
- See `docs/backup-strategy.md` for details

### Migration History
- Schema versioning via `SCHEMA_VERSION` constant
- Incremental migrations handled in `database/migrations.ts`
- Backward compatibility maintained for data parsing

---

## Type Safety & Parsing

### Database → Domain Conversion
```typescript
// Raw row from SQLite
const episodeRow: EpisodeRow = {
  locations: '["left_temple","right_eye"]', // JSON string
  qualities: '["throbbing","pressure"]',
  // ...
};

// Parse to domain model
const locations = safeJSONParse(
  episodeRow.locations, 
  [], 
  isPainLocationArray
);
```

### Validation on Write
```typescript
// Before saving, validate with Zod
const episode = {
  /* ... */
};
const validated = EpisodeSchema.parse(episode);
// Save to database
```

---

## Schema Evolution

**Current Version:** 10

### Backward Compatibility
- Lenient JSON validation for array types
- Supports old/deprecated pain location values
- Graceful fallbacks with default values
- Migration functions preserve existing data

### Future Considerations
- Add new optional fields with default values
- Use migrations for structural changes
- Update validation schemas alongside database changes
- Maintain at least one version back for data format compatibility

---

## Example Workflows

### Creating a Migraine Episode
1. Create Episode with startTime, locations, qualities
2. As it progresses, add IntensityReadings
3. Record SymptomLogs as symptoms appear
4. Track pain location changes with PainLocationLogs
5. Link MedicationDoses taken during episode
6. Update DailyStatusLog to red

### Tracking Preventative Medication
1. Create Medication (type: 'preventative')
2. Create MedicationSchedules (times to take)
3. System generates MedicationReminders
4. User logs MedicationDoses (taken/skipped)
5. Analyze effectiveness trends over months

### Daily Check-In
1. Prompt user for daily status
2. Create/update DailyStatusLog
3. If yellow, require statusType (prodrome/postdrome/anxiety/other)
4. Optional notes
5. Use for monthly trends and pattern detection

