# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MigraineTracker is a React Native mobile app built with Expo for tracking pain episodes, symptoms, and medication usage. The app uses SQLite for offline-first data storage and follows iOS-first design patterns.

**Tech Stack:**
- React Native 0.81.4 + Expo ~54
- TypeScript 5.9
- SQLite (expo-sqlite) for local database
- Zustand for state management
- React Navigation for routing
- date-fns for date utilities

**Working Directory:** All commands should be run from the `/app` directory.

## Common Commands

### Development
```bash
cd app
npm install              # Install dependencies
npm start                # Start Expo dev server
npm run ios              # Run on iOS simulator (primary platform)
npm run android          # Run on Android emulator
npm run web              # Run in web browser (limited functionality)
```

### Type Checking
```bash
cd app
npx tsc --noEmit         # Run TypeScript compiler in check mode
```

### Testing
No test framework is currently configured. When adding tests, ensure they cover unit, integration, and accessibility requirements per .clinerules.

## Architecture

### Database Layer (src/database/)
- **db.ts** / **db.web.ts**: Platform-specific database initialization using expo-sqlite. Web version provides no-op implementation.
- **schema.ts**: Defines SQL schema with tables: episodes, intensity_readings, symptom_logs, medications, medication_schedules, medication_doses, medication_reminders
- **Repository Pattern**: All database access goes through repository classes:
  - `episodeRepository.ts`: CRUD for episodes, intensity readings, symptom logs
  - `medicationRepository.ts`: CRUD for medications, doses, schedules, reminders
- **ID Generation**: Uses `generateId()` from db.ts: `${Date.now()}-${Math.random()}`

### State Management (src/store/)
- **Zustand stores** for client state, wrapping repository calls
- `episodeStore.ts`: Manages current episode, episode list, intensity readings
- `medicationStore.ts`: Manages medication list, doses, schedules
- Pattern: Actions fetch from repository → update local state → trigger re-renders

### Navigation (src/navigation/)
- **Two-tier structure**:
  1. Bottom tab navigator (MainTabs) with 4 tabs: Dashboard, Episodes, Medications, Analytics
  2. Stack navigator (RootStackParamList) for modal screens: NewEpisode, EpisodeDetail, AddMedication, LogMedication
- Modal screens use `presentation: 'modal'` option
- All screens have `headerShown: false` (custom headers in screens)
- Type-safe navigation via `types.ts` with `RootStackParamList` and `MainTabsParamList`

### Models (src/models/)
- `types.ts`: TypeScript interfaces for all domain models (Episode, Medication, IntensityReading, etc.)
- JSON arrays stored as TEXT in SQLite, parsed in repositories

### Screens (src/screens/)
UI components for each route. iOS-style design with:
- SafeAreaView for notch handling
- iOS color palette (#007AFF, #8E8E93, #E5E5EA)
- Tab bar height: 88px with 34px bottom padding for home indicator

### Theme System (src/theme/)
- **All UI must support light and dark mode** via user-selectable theme in Settings
- Three theme modes: `light`, `dark`, `system` (follows device setting)
- Theme preference persists to AsyncStorage
- Use `useTheme()` hook to access current theme colors
- Pattern: Define `createStyles(theme: ThemeColors)` function before component, call with theme inside component
- Available theme colors: `background`, `backgroundSecondary`, `card`, `text`, `textSecondary`, `textTertiary`, `border`, `borderLight`, `primary`, `primaryText`, `danger`, `dangerText`, `ongoing`, `ongoingText`, `shadow`, `tabBarBackground`, `tabBarBorder`, `tabBarInactive`, `tabBarActive`

## Key Patterns

### Platform-Specific Files
Use `.platform.ext` suffix for platform-specific implementations:
- `db.ts` (iOS/Android) vs `db.web.ts` (web)
- Metro bundler automatically selects correct file

### Database Transactions
Repositories use `db.runAsync()` for writes, `db.getAllAsync()` for reads. Foreign keys cascade deletes (ON DELETE CASCADE).

### Offline-First
All data persists to SQLite immediately. No server sync yet. Consider HIPAA compliance when adding cloud features.

### Data Privacy
Health data subject to HIPAA requirements. Never log sensitive information. Encrypt data at rest when implementing cloud sync.

## Branch Strategy
- Create feature branches: `feature/description`
- Bugfix branches: `bugfix/description`
- Never commit to main/master
- iOS is primary platform (test iOS first)

## Known Platform Issues
- Web version has limited functionality (database is no-op on web)
- Test on physical iOS devices for accurate performance
- Tab bar styling assumes iPhone with home indicator
