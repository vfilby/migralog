# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MigraLog is a React Native mobile app built with Expo for tracking pain episodes, symptoms, and medication usage. The app uses SQLite for offline-first data storage and follows iOS-first design patterns.

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

**E2E Testing with Detox:**
- **IMPORTANT: E2E tests require a development build, NOT Expo Go**
- Run `npm run test:e2e:build` to create a development build in the simulator
- Tests are located in `e2e/` directory
- Run tests with `npm run test:e2e` or specific test files
- Test files: `episodeLifecycle.test.js`, `medicationTracking.test.js`, `dailyStatusTracking.test.js`

**Unit/Integration Testing:**
- Jest configured for unit and integration tests
- Place unit tests in `__tests__` directories alongside source files
- Test coverage target: 80%+ for repositories, stores, and utilities
- Run with `npm test`, `npm run test:watch`, or `npm run test:coverage`
- When adding tests, ensure they cover unit, integration, and accessibility requirements per .clinerules

**Testing Documentation:**
- See [docs/testing-guide.md](docs/testing-guide.md) for complete testing guide

## Project Structure

```
MigraLog/
├── app/                 # React Native application
│   ├── assets/          # App icons, images, splash screens
│   ├── e2e/             # End-to-end tests (Detox)
│   ├── scripts/         # Build and utility scripts
│   └── src/             # Application source code
├── docs/                # Documentation
│   ├── archive/         # Historical documentation
│   ├── features/        # Feature documentation and plans
│   ├── wiki/            # GitHub Wiki pages
│   └── *.md             # Guides (testing, functional spec, etc.)
```

```
app/
├── e2e/                 # End-to-end tests
├── scripts/             # Build and utility scripts
├── src/
│   ├── components/      # Reusable UI components
│   ├── database/        # SQLite database layer
│   ├── models/          # TypeScript types
│   ├── navigation/      # React Navigation setup
│   ├── screens/         # Screen components
│   ├── services/        # Business logic services
│   ├── store/           # Zustand state management
│   ├── theme/           # Theme and color system
│   └── utils/           # Utility functions
└── (config files)
```

## Architecture

### Database Layer (src/database/)
- **db.ts** / **db.web.ts**: Platform-specific database initialization using expo-sqlite. Web version provides no-op implementation.
- **schema.ts**: Defines SQL schema with tables: episodes, intensity_readings, symptom_logs, medications, medication_schedules, medication_doses, medication_reminders
- **Repository Pattern**: All database access goes through repository classes:
  - `episodeRepository.ts`: CRUD for episodes, intensity readings, symptom logs
  - `medicationRepository.ts`: CRUD for medications, doses, schedules, reminders
- **ID Generation**: Uses `generateId()` from db.ts which returns ULID (Universally Unique Lexicographically Sortable Identifier)
  - 26-character Base32 encoded string
  - Timestamp-ordered (first 48 bits) for natural sorting
  - Cryptographically secure random component (80 bits)
  - No configuration required, works offline
  - Implementation uses `ulidx` library with `react-native-get-random-values` polyfill

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

### Theme Support
**ALL UI components MUST support both light and dark mode.** Use the `useTheme()` hook to access theme colors. Never hardcode colors like `#fff`, `#000`, or specific hex values directly in component styles. Always use theme properties: `theme.background`, `theme.text`, `theme.card`, `theme.border`, etc.

## Branch Strategy
**IMPORTANT: Always create a new branch for any new feature or bug fix. Never work directly on main/master.**

- Create feature branches: `feature/description`
- Bugfix branches: `bugfix/description`
- Never commit directly to main/master
- All new features and bug fixes MUST be developed on branches
- Merge to main only after feature is complete and tested
- iOS is primary platform (test iOS first)

## Known Platform Issues
- Web version has limited functionality (database is no-op on web)
- Test on physical iOS devices for accurate performance
- Tab bar styling assumes iPhone with home indicator
- Use the react native mcp server for guidance
- always run tests using npm without preambles or env configuration.  The test scripts should do all necessary things to run a test
- Do not "work around" bugs when testing the application...  we wouldn't expect a user to work around bugs, the the tests shouldn't either.
- Don't reinvent the wheel.  Use exitisting libraries and components unless there is a good reason and I specifically instruct you to do otherwise.
- Don't delcare success unless we have tested and accomplish our current goal.
- All tests must pass before committing
- Never delete, skip, or comment out a test that is failing with the excuse that "it's working anyways, so don't worry".  Always fix the test, don't skip it.