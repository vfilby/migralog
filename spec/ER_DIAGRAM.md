# Entity Relationship Diagram (Mermaid)

This file contains an ER diagram in Mermaid format. You can visualize it by:

1. **GitHub:** Paste the content into a `.md` file and view on GitHub (auto-renders)
2. **Mermaid Live Editor:** https://mermaid.live - copy the diagram section below
3. **VS Code:** Install "Markdown Preview Mermaid Support" extension
4. **Online Tools:** Use any Mermaid-compatible markdown viewer

---

## Complete ER Diagram

```mermaid
erDiagram
    EPISODES ||--o{ INTENSITY_READINGS : has
    EPISODES ||--o{ SYMPTOM_LOGS : has
    EPISODES ||--o{ PAIN_LOCATION_LOGS : has
    EPISODES ||--o{ MEDICATION_DOSES : "rescues-with"
    MEDICATIONS ||--o{ MEDICATION_SCHEDULES : defines
    MEDICATIONS ||--o{ MEDICATION_DOSES : tracks
    MEDICATIONS ||--o{ MEDICATION_REMINDERS : generates

    EPISODES {
        string id PK
        int start_time "NOT NULL, > 0"
        int end_time "NULL or > start_time"
        string locations "JSON array"
        string qualities "JSON array"
        string symptoms "JSON array"
        string triggers "JSON array"
        string notes "NULL or <= 5000 chars"
        float peak_intensity "[0-10] or NULL"
        float average_intensity "[0-10] or NULL, <= peak"
        float latitude "GPS, NULL"
        float longitude "GPS, NULL"
        float location_accuracy "meters, NULL"
        int location_timestamp "NULL"
        int created_at "NOT NULL, > 0"
        int updated_at "NOT NULL, > 0"
    }

    INTENSITY_READINGS {
        string id PK
        string episode_id FK "NOT NULL"
        int timestamp "NOT NULL, > 0"
        float intensity "NOT NULL, [0-10]"
        int created_at "NOT NULL"
    }

    SYMPTOM_LOGS {
        string id PK
        string episode_id FK "NOT NULL"
        string symptom "NOT NULL, enum"
        int onset_time "NOT NULL, > 0"
        int resolution_time "NULL or > onset"
        float severity "[0-10] or NULL"
        int created_at "NOT NULL"
    }

    PAIN_LOCATION_LOGS {
        string id PK
        string episode_id FK "NOT NULL"
        int timestamp "NOT NULL, > 0"
        string pain_locations "JSON array, NOT NULL"
        int created_at "NOT NULL"
    }

    MEDICATIONS {
        string id PK
        string name "NOT NULL, 1-200 chars"
        string type "NOT NULL: preventative|rescue"
        float dosage_amount "NOT NULL, > 0"
        string dosage_unit "NOT NULL, 1-50 chars"
        float default_dosage "> 0 or NULL"
        string schedule_frequency "daily|monthly|quarterly or NULL"
        string photo_uri "<= 500 chars or NULL"
        int start_date "> 0 or NULL"
        int end_date "> start_date or NULL"
        int active "NOT NULL, 0|1, DEFAULT 1"
        string notes "<= 5000 chars or NULL"
        int created_at "NOT NULL"
        int updated_at "NOT NULL"
    }

    MEDICATION_SCHEDULES {
        string id PK
        string medication_id FK "NOT NULL"
        string time "NOT NULL, HH:mm format"
        float dosage "NOT NULL, > 0, DEFAULT 1"
        int enabled "NOT NULL, 0|1, DEFAULT 1"
        string notification_id "Expo ID or NULL"
        int reminder_enabled "DEFAULT 1"
    }

    MEDICATION_DOSES {
        string id PK
        string medication_id FK "NOT NULL"
        int timestamp "NOT NULL, > 0"
        float amount "NOT NULL, >= 0"
        float dosage_amount "Snapshot from medication, NULL"
        string dosage_unit "Snapshot from medication, NULL"
        string status "taken|skipped, DEFAULT taken"
        string episode_id FK "FK nullable"
        float effectiveness_rating "[0-10] or NULL"
        int time_to_relief "[1-1440] min or NULL"
        string side_effects "JSON array or NULL"
        string notes "<= 5000 chars or NULL"
        int created_at "NOT NULL"
    }

    MEDICATION_REMINDERS {
        string id PK
        string medication_id FK "NOT NULL"
        int scheduled_time "NOT NULL, > 0"
        int completed "NOT NULL, 0|1, DEFAULT 0"
        int snoozed_until "> scheduled_time or NULL"
        int completed_at "> 0 or NULL"
    }

    DAILY_STATUS_LOGS {
        string id PK
        string date "UNIQUE, YYYY-MM-DD format"
        string status "green|yellow|red"
        string status_type "prodrome|postdrome|anxiety|other or NULL"
        string notes "<= 5000 chars or NULL"
        int prompted "0|1, DEFAULT 0"
        int created_at "NOT NULL"
        int updated_at "NOT NULL"
    }
```

---

## Relationship Details

### CASCADE DELETE Relationships

When a parent record is deleted:

```
EPISODES (deleted)
├─ INTENSITY_READINGS → DELETED
├─ SYMPTOM_LOGS → DELETED
├─ PAIN_LOCATION_LOGS → DELETED
└─ MEDICATION_DOSES → episodeId SET TO NULL (preserved)

MEDICATIONS (deleted)
├─ MEDICATION_SCHEDULES → DELETED
├─ MEDICATION_DOSES → DELETED
└─ MEDICATION_REMINDERS → DELETED
```

### SET NULL Relationship

```
EPISODES (deleted)
└─ MEDICATION_DOSES.episode_id → SET NULL
   (dose history preserved, episode link removed)
```

---

## Critical Constraints and Validations

### Episode Entity

```
Temporal:
  start_time > 0 (positive timestamp required)
  end_time NULL OR end_time > start_time
  
Intensity:
  peak_intensity NULL OR (0 <= peak_intensity <= 10)
  average_intensity NULL OR (0 <= average_intensity <= 10)
  average_intensity <= peak_intensity (if both present)
  
Content:
  notes <= 5000 characters
  
Location (GPS):
  All location fields nullable
  location_timestamp should accompany coordinates
```

### Medication Entity

```
Type Constraints:
  type IN ('preventative', 'rescue')
  IF type = 'preventative' THEN schedule_frequency NOT NULL
  
Dosage:
  dosage_amount > 0 (required, positive)
  dosage_unit required (1-50 chars)
  default_dosage NULL OR default_dosage > 0
  
Schedule:
  schedule_frequency IN ('daily', 'monthly', 'quarterly') OR NULL
  
Dates:
  start_date NULL OR start_date > 0
  end_date NULL OR end_date > start_date
  
Status:
  active IN (0, 1), DEFAULT 1
```

### Medication Dose Entity

```
Required:
  medication_id (FK to medications)
  timestamp > 0
  amount >= 0
  status DEFAULT 'taken'

Amount Validation:
  IF status = 'taken' THEN amount > 0 (cannot take 0)
  IF status = 'skipped' THEN amount >= 0 (any value allowed)

Optional References:
  episode_id NULL OR FK to episodes (SET NULL on delete)

Quality Metrics:
  effectiveness_rating NULL OR (0 <= rating <= 10)
  time_to_relief NULL OR (1 <= minutes <= 1440)

Dosage Snapshot:
  dosage_amount = NULL (snapshot of medications.dosage_amount at time of dose)
  dosage_unit = NULL (snapshot of medications.dosage_unit at time of dose)
  ⚠️ NO total_amount field - must multiply: amount * dosage_amount
```

### Medication Reminder Entity

```
Scheduling:
  scheduled_time > 0 (required)
  
Status Rules:
  completed IN (0, 1), DEFAULT 0
  IF completed = 1 THEN completed_at IS NOT NULL
  
Snooze:
  snoozed_until NULL OR snoozed_until > scheduled_time
```

### Daily Status Log Entity

```
Date Rules:
  date UNIQUE
  date format: YYYY-MM-DD (valid date, not in future)
  
Status Rules:
  status IN ('green', 'yellow', 'red')
  
Type Rules:
  status_type NULL OR status_type IN ('prodrome', 'postdrome', 'anxiety', 'other')
  IF status = 'yellow' THEN status_type can be set
  IF status != 'yellow' THEN status_type MUST BE NULL
```

---

## Enum Values Reference

### Pain Locations (10 types)
```
left_eye, right_eye
left_temple, right_temple
left_neck, right_neck
left_head, right_head
left_teeth, right_teeth
```

### Pain Qualities (6 types)
```
throbbing, sharp, dull, pressure, stabbing, burning
```

### Symptoms (9 types)
```
nausea, vomiting, visual_disturbances, aura
light_sensitivity, sound_sensitivity, smell_sensitivity
dizziness, confusion
```

### Triggers (10 types)
```
stress, lack_of_sleep, weather_change, bright_lights
loud_sounds, alcohol, caffeine, food
hormonal, exercise
```

### Medication Types
```
preventative, rescue
```

### Schedule Frequencies
```
daily, monthly, quarterly
```

### Day Status
```
green, yellow, red
```

### Yellow Day Types
```
prodrome, postdrome, anxiety, other
```

### Dose Status
```
taken, skipped
```

---

## Index Map

```
EPISODES
  ├─ PRIMARY KEY: id
  ├─ idx_episodes_start_time: start_time
  └─ idx_episodes_date_range: (start_time, end_time)

INTENSITY_READINGS
  ├─ PRIMARY KEY: id
  ├─ idx_intensity_readings_episode: episode_id
  └─ idx_intensity_readings_time: (episode_id, timestamp)

SYMPTOM_LOGS
  ├─ PRIMARY KEY: id
  └─ idx_symptom_logs_episode: episode_id

PAIN_LOCATION_LOGS
  ├─ PRIMARY KEY: id
  └─ idx_pain_location_logs_episode: episode_id

MEDICATIONS
  ├─ PRIMARY KEY: id
  └─ idx_medications_active_type: (active, type) WHERE active = 1

MEDICATION_SCHEDULES
  ├─ PRIMARY KEY: id
  └─ FK index: medication_id

MEDICATION_DOSES
  ├─ PRIMARY KEY: id
  ├─ idx_medication_doses_medication: medication_id
  ├─ idx_medication_doses_episode: episode_id
  ├─ idx_medication_doses_timestamp: timestamp
  └─ idx_medication_doses_med_time: (medication_id, timestamp DESC)

MEDICATION_REMINDERS
  ├─ PRIMARY KEY: id
  ├─ idx_medication_reminders_scheduled: scheduled_time
  └─ idx_reminders_incomplete: (medication_id, scheduled_time) WHERE completed = 0

DAILY_STATUS_LOGS
  ├─ PRIMARY KEY: id
  ├─ UNIQUE: date
  ├─ idx_daily_status_date: date
  ├─ idx_daily_status_status: status
  └─ idx_daily_status_date_status: (date, status)
```

