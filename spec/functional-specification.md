# Pain Episode Tracking App - Functional Specification

## 1. Overview
A mobile/web application for tracking pain episodes, symptoms, and medication usage to help users identify patterns and optimize treatment strategies. Support both Android and iOS, but iOS is the primary use case and takes precendence.

## 2. Core Features

### 2.1 Pain Episode Tracking
- **Episode Logging**
  - Start time (manual entry or real-time "start episode" button)
  - End time (manual entry or "end episode" button)
  - Pain intensity (0-10 scale, recorded at multiple points during episode, looking for well known pain scales used by headache doctors)
  - Pain location(s) (selectable body regions)
  - Pain quality (throbbing, sharp, dull, pressure, etc.)
  - Associated symptoms (nausea, visual disturbances, light/sound sensitivity, etc.)
  - Triggers (optional: stress, weather, food, sleep, etc.)
  - Notes (free text)

- **During-Episode Updates**
  - Ability to log pain intensity changes over time
  - Track when symptoms appear/resolve
  - Record medication taken during episode

### 2.2 Medication Tracking

**Preventative Medications**
- Daily/scheduled medication logging
- Custom medications with picture, schedule and default dosage (for example Advil is a 200mg tablet and the default dosage could be 3 tablets)
- Schedule medication reminders (critical alerts and followups if they are not logged)
- Medication name, dosage, frequency
- Adherence tracking (taken/missed)
- Start/stop dates
- Effectiveness notes

**Rescue Medications**
- Quick-log interface during episodes
- Medication name, dosage, time taken
- Effectiveness rating (did it help? how much?)
- Time to relief
- Side effects

### 2.3 Symptom Evolution Tracking
- Timeline view showing symptom progression within episodes
- Intensity graphs over episode duration
- Symptom onset/offset times relative to episode start
- Medication timing overlay on symptom timeline

## 3. Data Analysis & Insights

### 3.1 Pattern Recognition
- Episode frequency (daily/weekly/monthly views)
- Average episode duration
- Most common triggers
- Time-of-day patterns
- Seasonal/weather correlations
- Medication effectiveness patterns

### 3.2 Reporting
- Summary reports for medical appointments
- Exportable data (PDF, CSV)
- Customizable date ranges
- Visual graphs and charts

### 3.3 Trends Over Time
- Pain intensity trends
- Episode frequency changes
- Medication effectiveness over time
- Symptom pattern evolution

## 4. User Interface Components

### 4.0 Layout Guidelines
- **Full-width elements**: Cards, buttons, and sections should use the full available width. Avoid narrow centered boxes with excessive whitespace on the sides.
- **Consistent padding**: Use a single level of horizontal padding (16pt) from screen edge to content. Cards that sit inside a padded scroll view should NOT add their own horizontal padding — only internal content padding.
- **Side-by-side elements**: When two elements are side by side (e.g., "Clear" / "Not Clear" buttons), they should together span the full available width.
- **Minimum touch targets**: All interactive elements must be at least 44×44pt.
- **Pain location selector**: Pain locations MUST be displayed in a two-column grid with "Left" and "Right" column headers. Each row represents a body region (Eye, Temple, Neck, Head, Teeth) with the left variant in the left column and right variant in the right column. Button labels show only the region name (e.g. "Eye", "Temple") since the column header provides the left/right context. Selected state: solid blue background with white text. Unselected: dark gray background with subtle border.
- **Selectable chips**: Symptoms, pain qualities, and triggers use chip-style toggle buttons. Selected: blue filled background with white text. Unselected: dark gray background with subtle border, primary text. Capsule shape.
- **Pain intensity slider**: Shows the numeric value (large, colored by pain scale) and label (bold) on the top row, slider with colored tint, "0 - No Pain" / "10 - Debilitating" range labels below, and the description text at the bottom.

### 4.1 Dashboard

Elements appear in this order:
1. **Today's Medications**: Compact horizontal rows — medication name on left, action buttons (Log/Skip or status) on right. Dividers between items.
2. **Log Your Day** (daily status widget): Prompt for yesterday's status ("Clear" / "Not Clear"). Spans full width. Only visible when yesterday is unlogged.
3. **Action buttons**: "Start Episode" and "Log Medication" displayed **side-by-side** at half width with icons. Text uses `lineLimit(1)` with `minimumScaleFactor(0.8)` to prevent wrapping. "Log Medication" opens the rescue medication quick-log screen.
4. **Recent Episodes** section title
5. **Active episode card** (if ongoing): Start time, elapsed duration, "Ongoing" badge. Taps to detail.
6. **Recent closed episodes**: Up to 3 most recent closed episodes using the same `EpisodeCardView` as the Episodes list (with sparklines).

### 4.2 Episode Detail View
- **Summary card** (combined status + info): Started/ended timestamps in aligned columns, duration, symptoms as chips, triggers as chips, notes. Pain locations are NOT shown here — they appear in the timeline instead.
- **Chronological timeline**: All events displayed in a single merged timeline sorted by timestamp.
  - **Layout**: Each entry has three columns: timestamp (right-aligned, 75pt), dot (colored circle 12pt, centered in 32pt column), content. The timestamp, dot, and title text are vertically centered on the same line. Detail content (bars, chips, subtitles) appears below.
  - **Vertical line**: 1pt wide, secondary color at 20% opacity, connects between dots. No line above the first event. No line below "Episode Ended".
  - **Title style**: All timeline entry titles use `.subheadline.weight(.medium)` with primary color — no colored titles.
  - Event types:
    - **Initial pain locations**: First entry showing episode's initial locations as neutral chips
    - **Intensity readings**: "Intensity Update" title, capsule-shaped bar (22pt tall), "N - Label" in intensity color
    - **Symptom changes**: Onset and resolution events
    - **Pain location changes**: Shows delta computed from previous pain location state. Initial locations come from the episode's `locations` field; subsequent entries are from `pain_location_logs`. Chip styles: added (`+ Name`, text `#2E7D32`, bg `#E8F5E9`, border `#66BB6A`), removed (`− Name`, text `#C62828`, bg `#FFEBEE`, border `#FFCDD2`), unchanged (plain name, gray bg)
    - **Notes**: Title + note text preview
    - **Medication doses**: Only rescue/other medications (NOT preventative). "Medication Taken" or "Medication Skipped" title, medication name + dosage as subtitle
    - **Episode Ended**: Final timeline entry, no line below
- **Intensity sparkline**: Covers full episode duration (start to end/now). Uses sample-and-hold interpolation at 5-minute intervals with reverse EMA smoothing (alpha=0.30). Line stroke uses vertical gradient matching pain scale colors. Background has subtle pain scale gradient at 15% opacity. Reading dots are white-bordered, colored by intensity.

### 4.3 Episode Log View
- Scrollable list of episode cards with visual separation (cards with rounded corners and background)
- Each card: text info (relative date, location, duration) on left, sparkline (fixed 160×50pt) on right
- Active episodes show "Ongoing" badge
- Filter/search capabilities

### 4.4 Medication Management
- Active medications list
- Rescue medications sorted by usage frequency (most used first)
- Medication type badges with color coding (see Section 5.2)
- Medication history
- Refill reminders (optional)
- Usage statistics

### 4.5 Log Medication Screen
- **From Dashboard**: Shows only **rescue** medications, sorted by usage frequency (most used first)
- Each medication shown as a card with name, dosage, quick-log button ("Log N × dose"), and "Details" button
- **Quick log**: Logs the default dose immediately and dismisses
- **Details**: Opens a sheet to customize quantity, time, and notes before saving

### 4.6 Analytics / Trends Screen

**Monthly Calendar**:
- Day cells show: status dot (12pt), day number, overlay line indicator (4pt bar at bottom)
- **Day status priority**: Episode overlap (red) > manually logged status > unknown (gray dot)
- A day is implicitly red if ANY episode's time range overlaps any part of that day (`startTime < dayEnd AND (endTime ?? ∞) > dayStart`)
- Future dates are dimmed and non-interactive
- Unknown past dates show a neutral gray dot (not invisible)
- Grid spacing: 6pt row spacing, 44pt minimum cell height
- **Calendar overlays**: Days within an overlay date range show a gray line indicator at the bottom of the cell. Active overlays are listed below the calendar with label, date range, and excluded-from-stats badge.

**Day Statistics Card**:
- Shows counts for: Migraine days (red), Not-clear days (yellow), Clear days (green), Unknown (gray)
- Migraine day count MUST include implicit red days from episode overlap, not just manually logged red days

**Other sections**: Episode statistics, duration metrics, rescue medication usage

## 5. Shared Data Definitions

These definitions are the source of truth. Both platform implementations MUST match exactly.

### 5.1 Pain Scale

Reference: https://www.painscale.com/tools/migraine-pain-scale/

**Implementation**: `mobile-apps/ios/MigraLog/Utils/PainScale.swift`

```json
[
  { "value": 0,  "label": "No Pain",       "description": "Pain-free",                                 "color": "#2E7D32" },
  { "value": 1,  "label": "Minimal",       "description": "Very mild, barely noticeable",              "color": "#558B2F" },
  { "value": 2,  "label": "Mild",          "description": "Minor annoyance, can be ignored",           "color": "#689F38" },
  { "value": 3,  "label": "Mild",          "description": "Noticeable but can function normally",      "color": "#F9A825" },
  { "value": 4,  "label": "Uncomfortable", "description": "Distracting but manageable",                "color": "#FF8F00" },
  { "value": 5,  "label": "Moderate",      "description": "Interferes with concentration",             "color": "#EF6C00" },
  { "value": 6,  "label": "Distressing",   "description": "Difficult to ignore, limits activities",    "color": "#E65100" },
  { "value": 7,  "label": "Severe",        "description": "Dominant focus, impedes daily function",    "color": "#D84315" },
  { "value": 8,  "label": "Intense",       "description": "Overwhelming, unable to function",          "color": "#C62828" },
  { "value": 9,  "label": "Excruciating",  "description": "Unbearable, incapacitating",               "color": "#EC407A" },
  { "value": 10, "label": "Debilitating",  "description": "Worst imaginable, requires emergency care", "color": "#AB47BC" }
]
```

### 5.2 Medication Type Colors

Medication type badges use these colors. Text color is the main color; background is the same color at 20% opacity.

```json
{
  "preventative": { "label": "Preventative", "color_light": "#248A3D", "color_dark": "#32D65F" },
  "rescue":       { "label": "Rescue",       "color_light": "#0062CC", "color_dark": "#0066CC" },
  "other":        { "label": "Other",        "color_light": "#6C6C70", "color_dark": "#AEAEB2" }
}
```

**Implementation**: `mobile-apps/ios/MigraLog/Utils/MedicationTypeColors.swift`

## 6. Data Model (Core Entities)

### 6.1 Episode
- ID, start_time, end_time
- Peak intensity, average intensity
- Locations[], symptoms[], triggers[]
- Medications taken during episode
- Notes

### 6.2 Intensity Reading
- Episode ID, timestamp, intensity (0-10)

### 6.3 Symptom Log
- Episode ID, symptom type, onset time, resolution time, severity

### 6.4 Medication
- Type (preventative/rescue/other)
- Name, dosage, frequency (if preventative)
- Effectiveness history

### 6.5 Medication Dose
- Medication ID, timestamp, effectiveness rating
- Episode ID (if rescue medication)
- Side effects

## 7. Key User Flows

### 7.1 Starting an Episode
1. User taps "Start Episode"
2. Log initial pain intensity and location
3. Select current symptoms
4. Optional: note potential triggers
5. App begins tracking duration

### 7.2 During Episode
1. Update pain intensity as it changes
2. Log rescue medications taken
3. Add new symptoms as they appear
4. Mark symptom resolution

### 7.3 Ending Episode
1. User taps "End Episode"
2. Log final pain intensity
3. Overall episode assessment
4. Medication effectiveness rating

### 7.4 Reviewing Patterns
1. Navigate to Analytics
2. Select date range
3. View frequency, duration, trigger analysis
4. Generate report for doctor

## 8. Technical Considerations

- **Data Privacy**: HIPAA compliance if storing health data
- **Offline Support**: Allow logging without internet connection
- **Sync**: Multi-device synchronization
- **Reminders**: Medication reminders, episode logging prompts
- **Backup**: Cloud backup of user data. Restore must handle backups from older app versions gracefully — dynamic column detection, skip rows with constraint violations (log skipped rows), and fix zero-valued timestamps by falling back to created_at.
- **Export**: Standard formats for medical records

## 9. Future Enhancements
- Weather API integration for trigger correlation
- Wearable device integration (sleep, stress tracking)
- Photo documentation (for visual symptoms)
- Shareable access for healthcare providers
- Machine learning for trigger prediction
- Integration with electronic health records
