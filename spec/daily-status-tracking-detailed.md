# Feature Plan: Red/Yellow/Green Days Tracking

## Overview
Track daily well-being status for migraine sufferers, capturing the full spectrum of their experience:
- **Green Days**: Clear, no symptoms or concerns
- **Yellow Days**: Not a full episode, but experiencing prodrome, postdrome, or migraine anxiety
- **Red Days**: Active migraine episode (auto-detected when logging episodes)

## 1. Data Model Design

### New Database Schema

```sql
-- Daily status logs table
CREATE TABLE IF NOT EXISTS daily_status_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD format for easy queries
  status TEXT NOT NULL,        -- 'green', 'yellow', 'red'
  status_type TEXT,            -- For yellow: 'prodrome', 'postdrome', 'anxiety', 'other'
  notes TEXT,                  -- Optional user notes
  prompted INTEGER DEFAULT 0,  -- 0 = manual, 1 = from daily prompt
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_status_date ON daily_status_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_status_status ON daily_status_logs(status);
```

### TypeScript Types

```typescript
export type DayStatus = 'green' | 'yellow' | 'red';

export type YellowDayType =
  | 'prodrome'      // Warning signs before episode
  | 'postdrome'     // Recovery period after episode
  | 'anxiety'       // Worried about potential episode
  | 'other';        // Other non-clear states

export interface DailyStatusLog {
  id: string;
  date: string;           // YYYY-MM-DD
  status: DayStatus;
  statusType?: YellowDayType;  // Only for yellow days
  notes?: string;
  prompted: boolean;      // Was this from daily prompt?
  createdAt: number;
  updatedAt: number;
}
```

## 2. Logic Rules

### Auto-Detection of Red Days
- **When an episode is started**: Automatically mark that day as RED
- **When ending an episode that spans multiple days**: Mark all dates in range as RED
- **User cannot override RED days** if an episode exists for that date

### Daily Prompt Trigger Logic
```
IF today >= 8:00 AM AND today <= 10:00 AM:
  IF no daily_status_log for yesterday:
    IF no episode logged for yesterday:
      SHOW daily prompt
```

### Skip Prompt Scenarios
- User already logged status for yesterday (manual or prompted)
- An episode was active on yesterday (auto-RED)
- User dismissed/snoozed the prompt today already

## 3. Notification System

### New Notification Category
```typescript
const DAILY_CHECK_IN_CATEGORY = 'DAILY_CHECK_IN';
```

### Daily Notification Schedule
- **Time**: 8:30 AM daily (configurable in Settings)
- **Type**: Local notification with action buttons
- **Actions**:
  - "✓ Clear Day" → Logs GREEN, dismisses notification
  - "⚠ Not Clear" → Opens app to detailed prompt
  - "Remind Later" → Snoozes for 2 hours

### Notification Content
```
Title: "How was yesterday?"
Body: "Quick check-in: Was yesterday a clear day?"
```

### Settings Integration
Add to SettingsScreen:
```typescript
- Enable Daily Check-ins (toggle)
- Check-in Time (time picker, default 8:30 AM)
- Check-in Notifications (toggle)
```

## 4. UI/UX Design

### A. Daily Prompt Modal (DailyStatusPromptScreen)

**Modal Design** (iOS-style):
```
┌─────────────────────────────┐
│  X                          │
│                             │
│  How was yesterday?         │
│  [Date: Jan 15, 2025]       │
│                             │
│  ┌─────────────────────┐   │
│  │  🟢 Clear Day       │   │  [Large tap target]
│  │  No symptoms        │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │  🟡 Not Clear       │   │  [Large tap target]
│  │  Prodrome/Postdrome │   │
│  └─────────────────────┘   │
│                             │
│  Skip for now               │  [Link at bottom]
└─────────────────────────────┘
```

**If "Not Clear" selected** → Expand to show:
```
  Why wasn't it clear?

  ○ Prodrome (warning signs)
  ○ Postdrome (recovery)
  ○ Migraine anxiety
  ○ Other

  [Optional notes input]

  [Save] [Cancel]
```

### B. Dashboard Integration

Add **Monthly Calendar View** to DashboardScreen (below stats):

```
┌──────────────────────────────┐
│  January 2025                │
│  ─────────────────────────   │
│  S  M  T  W  T  F  S        │
│        1  2  3  4  5         │
│  🟢 🟢 🔴 🟡 🟢 🟢 🟢     │
│  6  7  8  9  10 11 12        │
│  🟢 🔴 🔴 🟢 🟡 🟢 🟢     │
│  ...                         │
└──────────────────────────────┘

Legend: 🟢 Clear  🟡 Not Clear  🔴 Episode
```

**Interaction**: Tap any day → Show day details modal with:
- Status
- Episode info (if red day)
- Notes
- Option to edit (if not auto-red)

### C. Analytics Screen Enhancement

Add new **Trends** section:

```
┌──────────────────────────────┐
│  Day Status Trends           │
│                              │
│  Last 30 Days:               │
│  🟢 Clear:      18 (60%)     │
│  🟡 Not Clear:   7 (23%)     │
│  🔴 Episodes:    5 (17%)     │
│                              │
│  [View Detailed Pattern →]   │
└──────────────────────────────┘
```

Add **Pattern Detection**:
- "Yellow days often precede red days"
- "Average 2.3 days recovery (yellow) after episodes"
- "68% of episodes have prodrome symptoms"

## 5. Implementation Plan

### Phase 1: Foundation (Database & Repository) ✅ IN PROGRESS
**Estimated: 2-3 hours**

1. **Database Migration**
   - Add `daily_status_logs` table to schema
   - Create migration in `migrations.ts`
   - Update `SCHEMA_VERSION` to 2

2. **Repository Layer**
   - Create `src/database/dailyStatusRepository.ts`
   - Implement CRUD operations:
     - `getByDate(date: string): Promise<DailyStatusLog | null>`
     - `getDateRange(startDate: string, endDate: string): Promise<DailyStatusLog[]>`
     - `create(log: Omit<DailyStatusLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<DailyStatusLog>`
     - `update(id: string, updates: Partial<DailyStatusLog>): Promise<void>`
     - `delete(id: string): Promise<void>`
     - `getMonthStats(year: number, month: number): Promise<{green: number, yellow: number, red: number}>`

3. **Unit Tests**
   - Create `src/database/__tests__/dailyStatusRepository.test.ts`
   - Test all CRUD operations
   - Test date range queries
   - Test stats aggregation

### Phase 2: State Management
**Estimated: 1-2 hours**

1. **Zustand Store**
   - Create `src/store/dailyStatusStore.ts`
   - Actions:
     - `loadDailyStatuses(startDate, endDate)`
     - `logDayStatus(date, status, statusType?, notes?)`
     - `updateDayStatus(id, updates)`
     - `getMonthData(year, month)`
     - `checkShouldPrompt(): boolean`

2. **Auto-Red Day Integration**
   - Modify `episodeStore.ts` → `startEpisode()`:
     ```typescript
     // After creating episode
     await dailyStatusRepository.create({
       date: format(new Date(episode.startTime), 'yyyy-MM-dd'),
       status: 'red',
       notes: 'Auto-logged from episode',
       prompted: false
     });
     ```
   - Modify `endEpisode()`:
     ```typescript
     // Mark all days in episode range as red
     const dates = getDatesInRange(startTime, endTime);
     for (const date of dates) {
       await dailyStatusRepository.upsert({ date, status: 'red', ... });
     }
     ```

3. **Unit Tests**
   - Create `src/store/__tests__/dailyStatusStore.test.ts`

### Phase 3: Notification System
**Estimated: 2-3 hours**

1. **Notification Service Enhancement**
   - Add to `notificationService.ts`:
     - `scheduleDailyCheckIn(time: string): Promise<string>`
     - `cancelDailyCheckIn(): Promise<void>`
     - `handleCheckInAction(action: 'clear' | 'not_clear'): Promise<void>`
   - Register `DAILY_CHECK_IN_CATEGORY` with action buttons

2. **Settings Integration**
   - Add AsyncStorage keys:
     - `dailyCheckInEnabled` (boolean, default true)
     - `dailyCheckInTime` (string, default "08:30")
     - `dailyCheckInNotifications` (boolean, default true)
   - Add UI to SettingsScreen:
     ```typescript
     <Section title="Daily Check-ins">
       <Toggle
         label="Enable Daily Check-ins"
         value={dailyCheckInEnabled}
         onChange={handleToggleDailyCheckIn}
       />
       <TimePicker
         label="Check-in Time"
         value={dailyCheckInTime}
         onChange={handleTimeChange}
       />
       <Toggle
         label="Notification Reminders"
         value={dailyCheckInNotifications}
         onChange={handleToggleNotifications}
       />
     </Section>
     ```

3. **App.tsx Integration**
   - On app start, check if should prompt
   - Schedule next daily check-in notification

### Phase 4: UI Components
**Estimated: 4-5 hours**

1. **DailyStatusPromptScreen**
   - Modal screen with status selection
   - Yellow day type picker (conditional)
   - Notes input (optional)
   - Save/Skip actions
   - Add to navigation types and AppNavigator

2. **MonthlyCalendarView Component**
   - Create `src/components/MonthlyCalendarView.tsx`
   - Display month grid with color-coded days
   - Handle tap interactions → navigate to day detail
   - Legend display
   - Month navigation (prev/next)

3. **DayDetailModal Component**
   - Show status, type, notes
   - Show linked episode (if red day)
   - Edit button (if not auto-red)
   - Delete option

4. **Dashboard Integration**
   - Add MonthlyCalendarView below current stats
   - Add quick stats summary:
     ```
     This Month: 18 🟢  7 🟡  5 🔴
     ```

### Phase 5: Analytics Enhancement
**Estimated: 3-4 hours**

1. **Stats Calculations**
   - Create `src/utils/dayStatusAnalytics.ts`:
     - `calculateMonthStats(logs: DailyStatusLog[])`
     - `detectPatterns(logs: DailyStatusLog[], episodes: Episode[])`
     - `calculateRecoveryTime(logs: DailyStatusLog[])`
     - `findProdromeCorrelation(logs: DailyStatusLog[])`

2. **Analytics Screen Updates**
   - Add "Day Status Trends" section
   - Show percentage breakdown
   - Display pattern insights
   - Add toggle between chart types

3. **Visualizations**
   - Use Swift Charts (built-in to SwiftUI)
   - Line chart: Days per status over time
   - Bar chart: Monthly status distribution

### Phase 6: Testing
**Estimated: 3-4 hours**

**IMPORTANT: All features must have both unit tests (XCTest) and UI tests (XCUITest).**

1. **Unit Tests** — business logic and data layer
   - Repository tests (Phase 1)
   - View-model / store-equivalent tests (Phase 2)
   - Analytics utility tests
   - Notification service tests — daily check-in scheduling
   - Test coverage target: 80%+ for new code

2. **UI Tests (XCUITest)** — user interactions and workflows
   - Episode lifecycle: auto-red day creation when starting episode; red day persists after ending
   - Daily check-in: green day selection, yellow day with type selection, manual entry via dashboard, calendar tap-through, day-detail modal
   - Multi-day episodes: end episode → verify all spanned days marked red

3. **Integration Tests** — cross-feature interactions
   - Notification handling
   - Settings changes propagation
   - Auto-red day creation from episodes
   - Calendar navigation and data sync

### Phase 7: Polish & Documentation
**Estimated: 1-2 hours**

1. **Theme Support**
   - Ensure all new components support light/dark mode
   - Use theme colors for status indicators

2. **Accessibility**
   - Add testID props
   - Ensure proper labels for screen readers
   - Color + symbol for color-blind accessibility

3. **Documentation**
   - Update CLAUDE.md with new patterns
   - Add comments to complex logic
   - Update README if needed

## 6. Edge Cases & Considerations

### Data Integrity
- **Episode spanning midnight**: Mark all dates in range as red
- **Retroactive episode logging**: Update past daily status logs to red
- **User tries to mark red day as green**: Show alert "This day had an active episode and cannot be changed"
- **Deleting an episode**: Should we keep the red day or revert to unknown?
  - Recommendation: Keep red, show "(Episode deleted)" note

### UX Considerations
- **First-time user**: Don't prompt until they've used app for 2+ days
- **Notification timing**: Respect Do Not Disturb settings
- **Prompt persistence**: If user skips, don't ask again that day
- **Batch entry**: Allow manual entry for past days (up to 7 days back)

### Performance
- **Calendar rendering**: Only render visible month, lazy load others
- **Query optimization**: Use date indexes, cache month data
- **Notification scheduling**: Cancel old, schedule new efficiently

### Privacy
- **Notification preview**: Don't show sensitive info in locked-screen preview
- **Export data**: Include daily status logs in any export feature

## 7. Future Enhancements (Post-MVP)

1. **Smart Predictions**
   - ML model to predict red/yellow days based on patterns
   - "High risk day today" notifications

2. **Correlations**
   - Weather correlation with day status
   - Medication effectiveness vs recovery time
   - Sleep tracking integration

3. **Customizable Statuses**
   - Let users define custom statuses beyond RGB
   - Custom icons/colors

4. **Weekly/Monthly Reports**
   - Email/PDF summary
   - Share with healthcare providers

5. **Streak Tracking**
   - "15 clear days in a row!"
   - Gamification elements

## 8. Estimated Total Timeline

| Phase | Time | Dependencies |
|-------|------|-------------|
| Phase 1: Database & Repository | 2-3 hours | None |
| Phase 2: State Management | 1-2 hours | Phase 1 |
| Phase 3: Notifications | 2-3 hours | Phase 2 |
| Phase 4: UI Components | 4-5 hours | Phase 2 |
| Phase 5: Analytics | 3-4 hours | Phase 1, 2 |
| Phase 6: Testing | 3-4 hours | All previous |
| Phase 7: Polish | 1-2 hours | All previous |

**Total: 16-23 hours** (2-3 full work days)

## 9. Success Metrics

- ✅ Users can log daily status (green/yellow) manually
- ✅ Red days auto-created from episodes
- ✅ Daily notification prompt at configured time
- ✅ Calendar view shows month at a glance
- ✅ Analytics show meaningful patterns
- ✅ All E2E tests pass
- ✅ 80%+ test coverage for new code
- ✅ Light/dark theme support
- ✅ No performance degradation

## 10. Current Progress

### ✅ Phase 1 Complete: Database & Repository Foundation
- ✅ Created feature branch: `feature/daily-status-tracking`
- ✅ Added TypeScript types to `src/models/types.ts`
  - `DayStatus` type
  - `YellowDayType` type
  - `DailyStatusLog` interface
- ✅ Updated schema to v5 with `daily_status_logs` table
- ✅ Created migration v5
- ✅ Implemented `dailyStatusRepository` with full CRUD + upsert
- ✅ Comprehensive unit tests (22 tests, all passing)

### ✅ Phase 2 Complete: State Management
- ✅ Created `dailyStatusStore` with Zustand
  - Actions: loadDailyStatuses, loadMonthStats, logDayStatus, updateDayStatus, deleteDayStatus, getDayStatus, checkShouldPrompt
- ✅ Integrated auto-red day logging in `episodeStore`
  - `startEpisode`: auto-creates red day for episode start
  - `endEpisode`: marks all days in episode range as red
- ✅ Unit tests for dailyStatusStore (21 tests, all passing)
- ✅ All episodeStore tests still pass

### ✅ Phase 4 Complete: UI Components (Skipped Phase 3 - Notifications)
- ✅ Created `DailyStatusPromptScreen`
  - Modal screen for daily check-ins
  - Green/yellow day selection with emoji indicators
  - Expandable yellow day type selection (prodrome, postdrome, anxiety, other)
  - Optional notes input
  - Validation and save/skip actions
- ✅ Created `MonthlyCalendarView` component
  - Calendar grid showing daily status with color-coded emoji (🟢🟡🔴)
  - Month navigation (previous/next)
  - Tap any day to navigate to DailyStatusPrompt
  - Legend showing status meanings
  - Loading state with spinner
- ✅ Integrated calendar into `DashboardScreen`
  - Added below recent episodes section
- ✅ Added `DailyStatusPrompt` route to navigation
  - Added to RootStackParamList with optional date parameter
  - Registered in AppNavigator with modal presentation
- ✅ Fixed errorLogger category in dailyStatusStore (changed 'app' to 'database')

### ✅ Phase 6 Complete: E2E Testing (historical — original RN/Detox implementation)
- ✅ Created `dailyStatusTracking.test.js`
  - Test manual green day logging
  - Test manual yellow day logging with type and notes
  - Test auto-red day creation when episode starts
  - Test red days persist after episode ends
  - Test calendar month navigation
  - Test skip functionality
- ✅ Enhanced `episodeLifecycle.test.js`
  - Added Phase 1.5: Verify auto-red day created after starting episode
  - Added Phase 6.5: Verify red days persist after ending episode
  - Calendar verification integrated into existing episode workflow

### 🔄 Optional Future Enhancements
1. **Phase 3: Notification System** (optional - requires more complex integration)
   - Enhance notificationService for daily check-ins
   - Add Settings UI for daily check-in preferences
   - Integrate with App.tsx for daily prompts
2. **Phase 5: Analytics Enhancement**
   - Create dayStatusAnalytics utility
   - Add trends section to Analytics screen
   - Pattern detection and insights
3. **Phase 7: Polish & Documentation**
   - Ensure accessibility labels complete
   - Performance testing
   - Documentation updates
