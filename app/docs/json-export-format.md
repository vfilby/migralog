# MigraLog JSON Export Format Documentation

## Overview

The MigraLog JSON export feature provides a standardized, human-readable format for sharing comprehensive migraine and health data with healthcare providers and third-party systems. This export format is designed for **data portability and healthcare integration**, not for backup/restore purposes.

### Key Distinctions

- **Purpose**: Data sharing and portability (NOT backup/restore)
- **Format**: Human-readable JSON with structured schemas
- **Scope**: Complete health data including 2 years of daily status logs
- **Usage**: Healthcare provider consultations, data analysis, third-party imports

**Note**: This is different from backup files (.db). JSON exports cannot be imported back into MigraLog - they are specifically designed for external data sharing and analysis.

## Export Structure

The JSON export follows a structured `BackupData` schema with the following top-level sections:

```typescript
interface BackupData {
  metadata: BackupMetadata;
  schemaSQL?: string;           // Optional - omitted in exports
  episodes: Episode[];
  episodeNotes?: EpisodeNote[];
  intensityReadings?: IntensityReading[];
  dailyStatusLogs?: DailyStatusLog[];
  medications: Medication[];
  medicationDoses: MedicationDose[];
  medicationSchedules: MedicationSchedule[];
}
```

### File Naming Convention

Export files are named: `migralog_export_YYYY-MM-DD.json`

Example: `migralog_export_2024-11-30.json`

## Data Types and Field Descriptions

### Metadata

Contains export information and summary statistics:

```typescript
interface BackupMetadata {
  id: string;                    // Unique export identifier
  timestamp: number;             // Unix timestamp of export
  version: string;              // MigraLog app version
  schemaVersion: number;        // Database schema version
  episodeCount: number;         // Total episodes in export
  medicationCount: number;      // Total medications in export
}
```

**Example**:
```json
{
  "metadata": {
    "id": "export_1701340800000_abc123def",
    "timestamp": 1701340800000,
    "version": "2.1.0",
    "schemaVersion": 19,
    "episodeCount": 45,
    "medicationCount": 8
  }
}
```

### Episodes

Core migraine/headache episode data with symptoms, triggers, and pain characteristics:

```typescript
interface Episode {
  id: string;                   // Unique episode identifier
  startTime: number;           // Unix timestamp - episode start
  endTime?: number;            // Unix timestamp - episode end (optional if ongoing)
  locations: PainLocation[];   // Array of affected body areas
  qualities: PainQuality[];    // Array of pain characteristics
  symptoms: Symptom[];         // Array of associated symptoms
  triggers: Trigger[];         // Array of identified triggers
  notes?: string;              // Optional episode notes
  location?: EpisodeLocation;  // Optional GPS location data
  createdAt: number;           // Unix timestamp - record creation
  updatedAt: number;           // Unix timestamp - last update
}
```

#### Pain Locations
```typescript
type PainLocation = 
  | 'left_eye' | 'right_eye'
  | 'left_temple' | 'right_temple'
  | 'left_neck' | 'right_neck'
  | 'left_head' | 'right_head'
  | 'left_teeth' | 'right_teeth';
```

#### Pain Qualities
```typescript
type PainQuality = 
  | 'throbbing' | 'sharp' | 'dull' 
  | 'pressure' | 'stabbing' | 'burning';
```

#### Symptoms
```typescript
type Symptom = 
  | 'nausea' | 'vomiting' | 'visual_disturbances' | 'aura'
  | 'light_sensitivity' | 'sound_sensitivity' | 'smell_sensitivity'
  | 'dizziness' | 'confusion';
```

#### Triggers
```typescript
type Trigger = 
  | 'stress' | 'lack_of_sleep' | 'weather_change'
  | 'bright_lights' | 'loud_sounds' | 'alcohol'
  | 'caffeine' | 'food' | 'hormonal' | 'exercise';
```

#### GPS Location (Optional)
```typescript
interface EpisodeLocation {
  latitude: number;            // GPS latitude
  longitude: number;           // GPS longitude
  accuracy?: number;           // Location accuracy in meters
  timestamp: number;           // When location was captured
}
```

**Example Episode**:
```json
{
  "id": "ep_1701340800000_abc",
  "startTime": 1701340800000,
  "endTime": 1701344400000,
  "locations": ["left_temple", "left_eye"],
  "qualities": ["throbbing", "sharp"],
  "symptoms": ["nausea", "light_sensitivity"],
  "triggers": ["stress", "weather_change"],
  "notes": "Started during afternoon meeting, worsened with screen time",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 65,
    "timestamp": 1701340800000
  },
  "createdAt": 1701340800000,
  "updatedAt": 1701344400000
}
```

### Episode Notes

Additional timestamped notes added during episodes:

```typescript
interface EpisodeNote {
  id: string;                   // Unique note identifier
  episodeId: string;           // Reference to parent episode
  timestamp: number;           // Unix timestamp when note was added
  note: string;                // Note content (max 5000 characters)
  createdAt: number;           // Unix timestamp - record creation
}
```

### Intensity Readings

Pain intensity measurements throughout episodes (0-10 scale):

```typescript
interface IntensityReading {
  id: string;                   // Unique reading identifier
  episodeId: string;           // Reference to parent episode
  timestamp: number;           // Unix timestamp of measurement
  intensity: number;           // Pain level (0-10 scale)
  createdAt: number;           // Unix timestamp - record creation
  updatedAt: number;           // Unix timestamp - last update
}
```

**Example**:
```json
{
  "id": "intensity_1701340800000_xyz",
  "episodeId": "ep_1701340800000_abc",
  "timestamp": 1701340800000,
  "intensity": 7.5,
  "createdAt": 1701340800000,
  "updatedAt": 1701340800000
}
```

### Daily Status Logs

Daily health status tracking (includes 2 years of data):

```typescript
interface DailyStatusLog {
  id: string;                   // Unique log identifier
  date: string;                // Date in YYYY-MM-DD format
  status: 'green' | 'yellow' | 'red';  // Overall day status
  statusType?: YellowDayType;   // Specific type for yellow days
  notes?: string;               // Optional daily notes
  prompted: boolean;            // Whether from daily prompt notification
  createdAt: number;           // Unix timestamp - record creation
  updatedAt: number;           // Unix timestamp - last update
}

type YellowDayType = 'prodrome' | 'postdrome' | 'anxiety' | 'other';
```

#### Status Meanings
- **Green**: Good day, no significant symptoms
- **Yellow**: Warning signs or mild symptoms (with specific type)
- **Red**: Active episode or severe symptoms

**Example**:
```json
{
  "id": "daily_20241130_xyz",
  "date": "2024-11-30",
  "status": "yellow",
  "statusType": "prodrome",
  "notes": "Feeling tension in neck, might be prodrome symptoms",
  "prompted": true,
  "createdAt": 1701340800000,
  "updatedAt": 1701340800000
}
```

### Medications

Medication records with dosage and schedule information:

```typescript
interface Medication {
  id: string;                   // Unique medication identifier
  name: string;                // Medication name
  type: MedicationType;        // Medication purpose
  dosageAmount: number;        // Amount per dose
  dosageUnit: string;          // Unit (mg, ml, tablets, etc.)
  defaultQuantity?: number;    // Default number of units per dose
  scheduleFrequency?: ScheduleFrequency;  // For preventative medications
  photoUri?: string;           // Optional medication photo
  active: boolean;             // Whether medication is currently active
  notes?: string;              // Optional medication notes
  category?: MedicationCategory;  // Medication classification
  createdAt: number;           // Unix timestamp - record creation
  updatedAt: number;           // Unix timestamp - last update
}

type MedicationType = 'preventative' | 'rescue' | 'other';
type ScheduleFrequency = 'daily' | 'monthly' | 'quarterly';
type MedicationCategory = 'otc' | 'nsaid' | 'triptan' | 'cgrp' | 'preventive' | 'supplement' | 'other';
```

**Example**:
```json
{
  "id": "med_sumatriptan_abc",
  "name": "Sumatriptan",
  "type": "rescue",
  "dosageAmount": 50,
  "dosageUnit": "mg",
  "defaultQuantity": 1,
  "active": true,
  "category": "triptan",
  "notes": "Take at first sign of migraine",
  "createdAt": 1701340800000,
  "updatedAt": 1701340800000
}
```

### Medication Doses

Records of actual medication consumption:

```typescript
interface MedicationDose {
  id: string;                   // Unique dose identifier
  medicationId: string;        // Reference to medication
  scheduleId?: string;         // Reference to schedule (for preventative)
  timestamp: number;           // Unix timestamp when dose was taken/logged
  quantity: number;            // Number of dosage units taken
  dosageAmount?: number;       // Dosage per unit (snapshot for historical accuracy)
  dosageUnit?: string;         // Unit of dosage (snapshot)
  status?: 'taken' | 'skipped'; // Dose status (defaults to 'taken')
  episodeId?: string;          // Reference to episode (for rescue medications)
  effectivenessRating?: number; // 0-10 scale
  timeToRelief?: number;       // Minutes to pain relief
  sideEffects?: string[];      // Array of side effects
  notes?: string;              // Optional dose notes
  createdAt: number;           // Unix timestamp - record creation
  updatedAt: number;           // Unix timestamp - last update
}
```

**Example**:
```json
{
  "id": "dose_1701340800000_xyz",
  "medicationId": "med_sumatriptan_abc",
  "episodeId": "ep_1701340800000_abc",
  "timestamp": 1701340800000,
  "quantity": 1,
  "dosageAmount": 50,
  "dosageUnit": "mg",
  "status": "taken",
  "effectivenessRating": 8,
  "timeToRelief": 45,
  "notes": "Took with water, felt relief after 45 minutes",
  "createdAt": 1701340800000,
  "updatedAt": 1701340800000
}
```

### Medication Schedules

Scheduled dosing for preventative medications:

```typescript
interface MedicationSchedule {
  id: string;                   // Unique schedule identifier
  medicationId: string;        // Reference to medication
  time: string;                // Time in HH:mm format (24-hour)
  timezone: string;            // IANA timezone (e.g., 'America/New_York')
  dosage: number;              // Number of doses for this schedule
  enabled: boolean;            // Whether schedule is active
  notificationId?: string;     // Expo notification identifier
  reminderEnabled?: boolean;   // Whether reminders are enabled
}
```

**Example**:
```json
{
  "id": "schedule_morning_abc",
  "medicationId": "med_preventative_xyz",
  "time": "08:00",
  "timezone": "America/New_York",
  "dosage": 1,
  "enabled": true,
  "reminderEnabled": true
}
```

## Usage Examples

### Complete JSON Export Structure

```json
{
  "metadata": {
    "id": "export_1701340800000_abc123def",
    "timestamp": 1701340800000,
    "version": "2.1.0",
    "schemaVersion": 19,
    "episodeCount": 2,
    "medicationCount": 2
  },
  "episodes": [
    {
      "id": "ep_1701340800000_abc",
      "startTime": 1701340800000,
      "endTime": 1701344400000,
      "locations": ["left_temple"],
      "qualities": ["throbbing"],
      "symptoms": ["nausea"],
      "triggers": ["stress"],
      "createdAt": 1701340800000,
      "updatedAt": 1701344400000
    }
  ],
  "episodeNotes": [
    {
      "id": "note_1701340800000_xyz",
      "episodeId": "ep_1701340800000_abc",
      "timestamp": 1701341400000,
      "note": "Pain worsening despite rest",
      "createdAt": 1701341400000
    }
  ],
  "intensityReadings": [
    {
      "id": "intensity_1701340800000_xyz",
      "episodeId": "ep_1701340800000_abc",
      "timestamp": 1701340800000,
      "intensity": 6,
      "createdAt": 1701340800000,
      "updatedAt": 1701340800000
    }
  ],
  "dailyStatusLogs": [
    {
      "id": "daily_20241130_xyz",
      "date": "2024-11-30",
      "status": "red",
      "prompted": true,
      "createdAt": 1701340800000,
      "updatedAt": 1701340800000
    }
  ],
  "medications": [
    {
      "id": "med_sumatriptan_abc",
      "name": "Sumatriptan",
      "type": "rescue",
      "dosageAmount": 50,
      "dosageUnit": "mg",
      "active": true,
      "category": "triptan",
      "createdAt": 1701340800000,
      "updatedAt": 1701340800000
    }
  ],
  "medicationDoses": [
    {
      "id": "dose_1701340800000_xyz",
      "medicationId": "med_sumatriptan_abc",
      "episodeId": "ep_1701340800000_abc",
      "timestamp": 1701340800000,
      "quantity": 1,
      "status": "taken",
      "effectivenessRating": 8,
      "timeToRelief": 45,
      "createdAt": 1701340800000,
      "updatedAt": 1701340800000
    }
  ],
  "medicationSchedules": []
}
```

## Healthcare Integration

### For Healthcare Providers

The JSON export provides comprehensive data for clinical consultation:

1. **Episode Patterns**: Analyze frequency, duration, and severity trends
2. **Trigger Analysis**: Identify common triggers and patterns
3. **Medication Effectiveness**: Review rescue medication success rates
4. **Symptom Tracking**: Monitor symptom evolution and associated factors
5. **Daily Status**: Understand overall health patterns beyond episodes

### Key Data Points for Analysis

- **Episode frequency**: Count episodes per time period
- **Severity trends**: Track intensity readings over time
- **Medication effectiveness**: Analyze `effectivenessRating` and `timeToRelief`
- **Trigger patterns**: Identify recurring triggers
- **Prodrome detection**: Analyze yellow days with `statusType: 'prodrome'`

### Sample Clinical Questions Answered

1. **"How often does the patient have migraines?"**
   - Count episodes in date ranges
   - Calculate frequency per week/month

2. **"What triggers are most common?"**
   - Aggregate trigger arrays across episodes
   - Calculate trigger frequency percentages

3. **"How effective are rescue medications?"**
   - Average `effectivenessRating` by medication
   - Analyze `timeToRelief` distributions

4. **"Are there prodrome patterns?"**
   - Find yellow days with `statusType: 'prodrome'`
   - Correlate with subsequent red days or episodes

## Third-Party Integration

### Import Guidelines

#### Data Validation

All third-party systems should validate:
- **Required fields**: Ensure all non-optional fields are present
- **Data types**: Verify numbers, strings, and arrays match specifications
- **Enum values**: Validate against allowed enum values (pain locations, symptoms, etc.)
- **Date formats**: Handle Unix timestamps correctly
- **Relationships**: Verify foreign key relationships (episodeId, medicationId)

#### Recommended Processing

1. **Parse metadata first**: Check schema version compatibility
2. **Validate data integrity**: Ensure all references are valid
3. **Handle missing optionals**: Gracefully handle optional fields
4. **Convert timestamps**: Convert Unix timestamps to local time formats
5. **Aggregate for analysis**: Calculate frequencies, averages, trends

#### Sample Integration Code (Pseudo)

```javascript
function processMigraLogExport(jsonData) {
  // Validate metadata
  const { metadata, episodes, medications, dailyStatusLogs } = jsonData;
  
  if (metadata.schemaVersion < 19) {
    console.warn('Older schema version detected');
  }
  
  // Process episodes for analysis
  const episodeAnalysis = {
    totalEpisodes: episodes.length,
    averageDuration: calculateAverageDuration(episodes),
    commonTriggers: getMostCommonTriggers(episodes),
    severityTrends: analyzeSeverityTrends(jsonData.intensityReadings)
  };
  
  // Process daily status for pattern analysis
  const healthPatterns = analyzeHealthPatterns(dailyStatusLogs);
  
  return { episodeAnalysis, healthPatterns };
}
```

## Data Privacy

### Healthcare Information

This export contains sensitive health information protected under healthcare privacy laws (HIPAA, GDPR, etc.):

- **Medical conditions**: Migraine episodes and symptoms
- **Medications**: Prescription and OTC medication usage
- **Location data**: Optional GPS coordinates of episode locations
- **Personal health patterns**: Daily status and health trends

### Privacy Considerations

1. **Secure transmission**: Use encrypted channels for sharing
2. **Access control**: Limit access to authorized healthcare providers
3. **Data retention**: Follow healthcare data retention policies
4. **Patient consent**: Ensure proper consent before sharing
5. **Anonymization**: Consider removing or hashing identifying information

### Recommended Privacy Measures

- Remove `location` data if GPS privacy is a concern
- Hash or remove `id` fields if anonymization is required
- Encrypt files during transmission and storage
- Log access and sharing activities

## Versioning

### Current Version
- **Schema Version**: 19
- **Export Format Version**: 1.0
- **Last Updated**: November 2024

### Version Compatibility

#### Schema Evolution
The `metadata.schemaVersion` field indicates the database schema version when the export was created. Third-party systems should check this version to ensure compatibility.

#### Backward Compatibility
Optional fields in the export format ensure backward compatibility:
- `episodeNotes?`: Added in schema v15
- `intensityReadings?`: Added in schema v12
- `dailyStatusLogs?`: Added in schema v18
- `location?` in episodes: Added in schema v16

#### Future Changes
Future updates may include:
- Additional optional data types
- Enhanced metadata fields
- New enum values for symptoms, triggers, etc.
- Extended medication categories

### Migration Guidance
When processing exports from different schema versions:
1. Check `metadata.schemaVersion` first
2. Handle missing optional arrays gracefully
3. Use default values for missing enum options
4. Log warnings for unrecognized data fields

## Support

For questions about the JSON export format or integration assistance:
- Review the source code in `src/services/backup/BackupExporter.ts`
- Check type definitions in `src/models/types.ts`
- Reference database schema in `src/database/schema.ts`

This documentation reflects the current implementation as of MigraLog v2.1.0 and schema version 19.