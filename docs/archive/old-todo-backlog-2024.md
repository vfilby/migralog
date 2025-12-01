# Documentation Audit - Architecture & Technical Specifications

## Phase 1: Current Codebase Analysis ✅
- [x] Review actual database schema and models
- [x] Analyze Zustand store implementations
- [x] Map service layer architecture  
- [x] Document navigation structure

## Phase 2: Documentation Review ✅
- [x] docs/wiki/Architecture.md - System architecture overview
- [x] docs/DATA_MODEL.md - Data model documentation
- [x] docs/ER_DIAGRAM.md - Entity relationship diagram
- [x] docs/state-management.md - State management patterns
- [x] docs/functional-specification.md - Functional requirements

## Phase 3: Gap Analysis & Recommendations
- [x] Compare docs vs actual implementation
- [x] Identify missing architectural components
- [x] Flag outdated diagrams and models
- [x] Provide specific update recommendations

---

# MigraineTracker Feature Backlog


## Feature X: Tracking red/yellow/green days

The idea here is that someone who sufferes from migraines has headache days....  but not all the non-headache days are clear.  Some are pre- or post-drome, some you are worried
about a headache, etc.  I would like to prompt the user once per day (ideally in the morning) to see how yesterday went.  If the user is logging an episode then we can skip this step, but if there is not log the day before we should give them the option to say clear or not clear.  


## Feature Y: symptoms and triggers should be customizable (but with sensible defaults)

## Feature 1: Episode Intensity Graph with Medication Overlay
**Status:** Not Started

**Prompt:**
```
I need to create an interactive graph visualization for episode intensity data with medication timing overlays.

Requirements:
1. Display intensity readings over time as a line graph with smooth interpolation between data points
2. Overlay medication doses as markers/icons on the timeline showing when medications were taken
3. Support zooming and panning for episodes that span multiple hours/days
4. Use different colors or markers for preventative vs rescue medications
5. Show the medication name and dosage on tap/hover
6. Handle missing data points gracefully with appropriate interpolation
7. Support both light and dark themes
8. Add this as a new section in the EpisodeDetailScreen

Technical considerations:
- Use react-native-svg and react-native-chart-kit or victory-native for charting
- Load intensity readings and medication doses from the database for the episode
- Ensure performance is good even with many data points (100+ readings)
- Make the graph responsive to different screen sizes
```

---

## Feature 2: Comprehensive Test Coverage
**Status:** Not Started

**Prompt:**
```
I need to implement comprehensive test coverage for the MigraineTracker app including both UI and unit tests.

Requirements:
1. Set up Jest and React Native Testing Library for unit/integration tests
2. Set up Detox or Maestro for E2E UI testing
3. Achieve minimum 80% code coverage for:
   - Database repositories (episodeRepository, medicationRepository)
   - Zustand stores (episodeStore, medicationStore)
   - Utility functions (painScale, date formatting)
4. Create UI tests for critical user flows:
   - Starting and ending an episode
   - Logging intensity readings
   - Adding and logging medications
   - Viewing episode details
5. Set up CI/CD integration (GitHub Actions) to run tests on PR
6. Add test scripts to package.json
7. Create testing documentation in /docs/testing.md

Technical considerations:
- Mock expo-sqlite for unit tests
- Use test fixtures for consistent test data
- Follow testing best practices per .clinerules
- Test accessibility features
- Include snapshot tests for UI components
```

---

## Feature 3: Monthly Stats View (30-Day Calendar)
**Status:** Not Started

**Prompt:**
```
I need to create a new Monthly Stats screen showing a 30-day calendar view with migraine statistics.

Requirements:
1. Create a new screen accessible from the Analytics tab
2. Display a calendar grid showing the past 30 days
3. Show a heatmap overlay on calendar days indicating peak intensity (0-10 scale)
   - Use color gradients from green (no migraine) to red (severe 10/10)
4. Show summary statistics:
   - Total headache days in the period
   - Average peak intensity
   - Total medication doses taken (broken down by type: preventative vs rescue)
   - Longest streak without a migraine
5. Allow tapping a day to see episode details or navigate to episode detail screen
6. Support scrolling to view previous 30-day periods
7. Export functionality to share stats as an image or PDF

Technical considerations:
- Create a new MonthlyStatsScreen component
- Add database queries to efficiently fetch episode and medication data for date ranges
- Use react-native-calendars or custom calendar component
- Calculate statistics using date-fns for date manipulation
- Consider caching computed stats for performance
- Add navigation route to RootStackParamList
```

---

## Feature 4: Trend Analysis View (3-6 Month Moving Averages)
**Status:** Not Started

**Prompt:**
```
I need to create a Trend Analysis screen showing long-term patterns over 3-6 months using moving averages.

Requirements:
1. Create a new TrendAnalysisScreen accessible from Analytics tab
2. Display multiple trend line graphs:
   - Headache days per week (7-day moving average)
   - Average peak intensity per week
   - Medication usage per week (total doses)
   - Separate lines for preventative vs rescue medication usage
3. Allow toggling between 3-month and 6-month views
4. Show statistical insights:
   - Trend direction (improving/worsening/stable)
   - Correlation between medication usage and headache frequency
   - Month-over-month comparisons
5. Add ability to annotate the timeline with life events/changes (medication changes, etc.)
6. Export trend data as CSV or image

Technical considerations:
- Implement efficient database queries with date range filters and aggregations
- Calculate moving averages using a sliding window approach
- Use react-native-svg and charting library for line graphs
- Add data caching to avoid recalculating on every render
- Consider memory usage with large datasets (6 months of data)
- Create helper functions for statistical calculations
- Add to navigation stack under Analytics
```

---

## Feature 5: Improved Episode Timeline (Multi-Day Display)
**Status:** Not Started

**Prompt:**
```
I need to enhance the episode timeline view to better display episodes spanning multiple days with day separators.

Requirements:
1. Update EpisodeDetailScreen or create a new dedicated timeline view
2. For episodes spanning multiple days:
   - Show intensity readings grouped by day
   - Add visual day separators (date headers with icons)
   - Display date and day of week for each section
3. Show medication doses inline with the timeline at the time they were taken
4. Use icons/markers to differentiate:
   - Intensity readings (pain intensity icon)
   - Medications (pill icon, differentiate preventative/rescue with color)
   - Symptoms (appropriate icons)
   - Day boundaries (calendar icon or divider)
5. Add summary stats per day:
   - Peak intensity for that day
   - Total medications taken
   - Hours of relief
6. Ensure timeline scrolls smoothly and handles long episodes (72+ hours)
7. Support dark/light themes

Technical considerations:
- Load and group intensity readings by day using date-fns
- Create a custom timeline component with section headers
- Use FlatList or SectionList for performance with many items
- Calculate day boundaries from episode start/end times
- Add proper spacing and visual hierarchy for readability
- Consider adding timestamps to each entry
- Update the Episode type if needed to support timeline data structure
```

---

## General Development Guidelines

When implementing any of these features:
- Follow the existing code patterns and architecture
- Use TypeScript for type safety
- Implement proper error handling and loading states
- Support both iOS and Android (test on both)
- Follow iOS-first design patterns per CLAUDE.md
- Update CLAUDE.md if adding significant architectural changes
- Create feature branches following the pattern: `feature/description`
- Write comprehensive commit messages
- Test thoroughly before merging to main
