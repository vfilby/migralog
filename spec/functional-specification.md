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
- **Pain location selector**: Pain locations MUST be displayed in a two-column grid with "Left" and "Right" column headers. Each row represents a body region (Eye, Temple, Neck, Head, Teeth) with the left variant in the left column and right variant in the right column. This makes it intuitive to select the side of the head affected. This layout applies everywhere pain locations are selectable (new episode, edit episode, log update).

### 4.1 Dashboard
- Current status (in episode vs. pain-free)
- Days since last episode
- Quick-start episode button
- Quick-log medication button
- Weekly/monthly summary cards
- Daily status widget spans full width

### 4.2 Episode Detail View
- **Info section**: Shows pain locations, symptoms, triggers, notes, duration. Pain locations displayed as chips/tags.
- **Chronological timeline**: All events (intensity readings, symptom changes, pain location changes, notes) displayed in a single merged timeline sorted by timestamp
- **Intensity sparkline**: Line chart showing intensity over time, minimum 80pt height, colored dots at each reading point
- **Timeline entries**: Each entry shows a colored indicator, timestamp, event type icon, and description
- **Live updates**: Adding a new intensity reading or other event must immediately update both the sparkline and the timeline without requiring a reload
- **Edit episode**: Must allow editing pain locations (using left/right grid), symptoms, triggers, and notes
- **Log update**: Must allow logging new pain locations (using left/right grid), intensity, symptoms, and notes during an active episode

### 4.3 Episode Log View
- Calendar view with episode markers
- List view with episode details
- Filter/search capabilities

### 4.4 Medication Management
- Active medications list
- Medication history
- Refill reminders (optional)
- Usage statistics

### 4.5 Analytics Screen
- Charts and graphs
- Pattern insights
- Trigger analysis
- Medication effectiveness comparison

## 5. Data Model (Core Entities)

### 5.1 Episode
- ID, start_time, end_time
- Peak intensity, average intensity
- Locations[], symptoms[], triggers[]
- Medications taken during episode
- Notes

### 5.2 Intensity Reading
- Episode ID, timestamp, intensity (0-10)

### 5.3 Symptom Log
- Episode ID, symptom type, onset time, resolution time, severity

### 5.4 Medication
- Type (preventative/rescue)
- Name, dosage, frequency (if preventative)
- Effectiveness history

### 5.5 Medication Dose
- Medication ID, timestamp, effectiveness rating
- Episode ID (if rescue medication)
- Side effects

## 6. Key User Flows

### 6.1 Starting an Episode
1. User taps "Start Episode"
2. Log initial pain intensity and location
3. Select current symptoms
4. Optional: note potential triggers
5. App begins tracking duration

### 6.2 During Episode
1. Update pain intensity as it changes
2. Log rescue medications taken
3. Add new symptoms as they appear
4. Mark symptom resolution

### 6.3 Ending Episode
1. User taps "End Episode"
2. Log final pain intensity
3. Overall episode assessment
4. Medication effectiveness rating

### 6.4 Reviewing Patterns
1. Navigate to Analytics
2. Select date range
3. View frequency, duration, trigger analysis
4. Generate report for doctor

## 7. Technical Considerations

- **Data Privacy**: HIPAA compliance if storing health data
- **Offline Support**: Allow logging without internet connection
- **Sync**: Multi-device synchronization
- **Reminders**: Medication reminders, episode logging prompts
- **Backup**: Cloud backup of user data
- **Export**: Standard formats for medical records

## 8. Future Enhancements
- Weather API integration for trigger correlation
- Wearable device integration (sleep, stress tracking)
- Photo documentation (for visual symptoms)
- Shareable access for healthcare providers
- Machine learning for trigger prediction
- Integration with electronic health records
