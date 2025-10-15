# MigraLog - Developer Documentation

This document contains technical information for developers working on MigraLog.

## Table of Contents
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Architecture](#architecture)
- [Testing](#testing)
- [Development Guidelines](#development-guidelines)
- [Database Schema](#database-schema)
- [Deployment](#deployment)

## Project Structure

```
MigraLog/
├── app/                     # React Native + Expo application
│   ├── assets/              # App icons, images, splash screens
│   ├── e2e/                 # End-to-end tests (Detox)
│   ├── scripts/             # Build and utility scripts
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── database/        # SQLite database layer
│       │   ├── db.ts        # Database initialization (iOS/Android)
│       │   ├── db.web.ts    # No-op database (web)
│       │   ├── schema.ts    # SQL schema definitions
│       │   ├── episodeRepository.ts
│       │   └── medicationRepository.ts
│       ├── models/          # TypeScript type definitions
│       ├── navigation/      # React Navigation setup
│       ├── screens/         # Screen components
│       ├── services/        # Business logic services
│       ├── store/           # Zustand state management
│       ├── theme/           # Theme and color system
│       └── utils/           # Utility functions
├── docs/                    # Documentation
│   ├── archive/             # Historical documentation
│   ├── features/            # Feature documentation and plans
│   ├── wiki/                # GitHub Wiki pages
│   └── *.md                 # Guides (testing, functional spec, etc.)
├── .clinerules              # Development guidelines for Claude Code
└── CLAUDE.md                # Instructions for Claude Code
```

## Tech Stack

### Core
- **React Native 0.81.4** - Mobile framework
- **Expo ~54** - Development platform
- **TypeScript 5.9** - Type safety
- **SQLite** (expo-sqlite) - Local database for offline-first functionality

### State & Navigation
- **Zustand** - State management
- **React Navigation 7.x** - Navigation framework

### UI & Styling
- iOS-first design with support for light/dark themes
- Custom theme system (see `src/theme/`)
- Platform-specific styling where needed

### Testing
- **Jest** - Unit and integration tests
- **Detox** - End-to-end testing
- **@testing-library/react-native** - Component testing utilities

### Utilities
- **date-fns** - Date manipulation
- **expo-notifications** - Local notifications

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn**
- **Expo CLI** (installed automatically with npx)
- **iOS Development**:
  - macOS with Xcode 14+
  - iOS Simulator
- **Android Development**:
  - Android Studio
  - Android SDK (API 31+)
  - Android Emulator or physical device

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/vfilby/migralog.git
   cd migralog
   ```

2. Navigate to the app directory:
   ```bash
   cd app
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

```bash
# Start the development server
npm start

# Run on iOS simulator (macOS only)
npm run ios

# Run on Android emulator
npm run android

# Run in web browser (limited functionality - database is no-op)
npm run web
```

### Running Tests

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type checking
npx tsc --noEmit

# E2E tests (requires development build)
npm run test:e2e:build    # Build the development app
npm run test:e2e          # Run all E2E tests
npm run test:e2e:suite lifecycle  # Run specific test suite
```

See [docs/testing-guide.md](docs/testing-guide.md) for comprehensive testing documentation.

## Development Workflow

### Branch Strategy

**IMPORTANT**: Always create a new branch for any new feature or bug fix. Never work directly on main.

```bash
# Feature branches
git checkout -b feature/description

# Bug fix branches
git checkout -b bugfix/description

# Documentation branches
git checkout -b docs/description
```

### Development Process

1. **Create a branch** from `main`
2. **Develop your feature** with tests
3. **Run tests** to ensure everything passes:
   ```bash
   npm test                  # Unit tests
   npm run test:e2e          # E2E tests
   npx tsc --noEmit          # Type check
   ```
4. **Commit your changes** with descriptive messages
5. **Create a pull request** targeting `main`
6. **Get review** and merge

### Commit Message Format

```
type: Brief description (50 chars or less)

More detailed explanatory text, if necessary. Wrap it to about 72
characters. The blank line separating the summary from the body is
critical.

Further paragraphs come after blank lines.

- Bullet points are okay

Fixes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Architecture

### Database Layer

MigraLog uses an offline-first architecture with SQLite as the local database.

**Platform-Specific Implementation:**
- `db.ts` / `db.web.ts` - Platform-specific database initialization
- Web version provides no-op implementation
- Metro bundler automatically selects the correct file

**Repository Pattern:**
All database access goes through repository classes:
- `episodeRepository.ts` - Episodes, intensity readings, symptom logs
- `medicationRepository.ts` - Medications, doses, schedules, reminders

**ID Generation:**
Uses timestamp-based IDs: `${Date.now()}-${Math.random()}`
(Note: Consider migrating to ULIDs or UUIDs - see Issue #18)

**Transactions:**
- Use `db.runAsync()` for writes
- Use `db.getAllAsync()` for reads
- Foreign keys cascade deletes with `ON DELETE CASCADE`

### State Management

Zustand stores wrap repository calls and manage client state:

```typescript
// Example: episodeStore.ts
export const useEpisodeStore = create<EpisodeStore>((set, get) => ({
  episodes: [],
  currentEpisode: null,
  loading: false,

  loadEpisodes: async () => {
    set({ loading: true });
    const episodes = await episodeRepository.getAll();
    set({ episodes, loading: false });
  },

  // ... more actions
}));
```

### Navigation

Two-tier navigation structure:

1. **Bottom Tab Navigator** (MainTabs) - 4 tabs:
   - Dashboard
   - Episodes
   - Medications
   - Analytics (Trends)

2. **Stack Navigator** (RootStack) - Modal screens:
   - NewEpisode
   - EpisodeDetail
   - AddMedication
   - LogMedication
   - etc.

All screens use `headerShown: false` with custom headers for consistent iOS styling.

### Theme System

**All UI components MUST support light and dark mode.**

```typescript
import { useTheme } from '../theme';

const MyComponent = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return <View style={styles.container}>...</View>;
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: theme.background,
    // Never use hardcoded colors like '#fff' or '#000'
  },
});
```

Available theme colors: `background`, `text`, `card`, `border`, `primary`, `danger`, etc.
See `src/theme/colors.ts` for complete list.

### Platform-Specific Code

Use `.platform.ext` suffix for platform-specific implementations:
```
db.ts         # iOS/Android implementation
db.web.ts     # Web implementation
```

## Testing

### Testing Philosophy

- **Test-Driven Development** encouraged
- **80%+ coverage** target for repositories, stores, and utilities
- **E2E tests** for critical user flows
- **Accessibility tests** for all interactive components

### Test Structure

```
app/
├── src/
│   └── utils/
│       ├── validation.ts
│       └── __tests__/
│           └── validation.test.ts
└── e2e/
    ├── episodeLifecycle.test.js
    ├── medicationTracking.test.js
    └── helpers.js
```

### Writing Tests

**Unit Tests:**
```typescript
describe('validateEpisodeEndTime', () => {
  it('should validate when end time is after start time', () => {
    const result = validateEpisodeEndTime(100, 200);
    expect(result.isValid).toBe(true);
  });
});
```

**E2E Tests:**
```javascript
it('should complete episode lifecycle', async () => {
  // Reset database
  await resetDatabase();

  // Start episode
  await element(by.id('start-episode-button')).tap();
  await element(by.id('save-episode-button')).tap();

  // Verify
  await expect(element(by.id('active-episode-card'))).toBeVisible();
});
```

### E2E Test Commands

```bash
# Build development app for testing
npm run test:e2e:build

# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e e2e/episodeLifecycle.test.js

# Run with specific test suite name
npm run test:e2e:suite lifecycle

# Start Metro bundler for E2E tests
npm run test:e2e:start
```

## Development Guidelines

### Code Style

- **TypeScript strict mode** enabled
- **ESLint** for code quality
- **Prettier** for formatting (if configured)
- Follow patterns established in the codebase

### Key Principles

1. **iOS is primary platform** - Test iOS first, Android second
2. **Offline-first** - All data persists to SQLite immediately
3. **HIPAA considerations** - Never log sensitive health data
4. **Type safety** - Use TypeScript interfaces for all data models
5. **Theme support** - All UI must support light/dark mode
6. **Testing required** - All new features need tests
7. **Branch strategy** - Always work on feature branches

### Common Patterns

**Creating a new screen:**
```typescript
import { useTheme } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom header */}
      {/* Content */}
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  // Styles using theme
});
```

**Adding a new repository method:**
```typescript
async function getEpisodeById(id: string): Promise<Episode | null> {
  const db = getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM episodes WHERE id = ?',
    [id]
  );
  return rows.length > 0 ? rows[0] as Episode : null;
}
```

### Gotchas & Known Issues

- **Web version has limited functionality** - Database is no-op
- **Tab bar styling assumes iPhone with home indicator** (88px height)
- **E2E tests require development build**, not Expo Go
- **Metro bundler caching** - Use `npm start --clear` if seeing stale code

## Database Schema

### Main Tables

**episodes**
- `id` TEXT PRIMARY KEY
- `startTime` INTEGER (Unix timestamp)
- `endTime` INTEGER (nullable)
- `notes` TEXT
- `symptoms` TEXT (JSON array)
- `triggers` TEXT (JSON array)

**intensity_readings**
- `id` TEXT PRIMARY KEY
- `episodeId` TEXT (foreign key → episodes.id)
- `timestamp` INTEGER
- `intensity` INTEGER (0-10)
- `notes` TEXT

**symptom_logs**
- `id` TEXT PRIMARY KEY
- `episodeId` TEXT (foreign key → episodes.id)
- `timestamp` INTEGER
- `symptoms` TEXT (JSON array)
- `notes` TEXT

**medications**
- `id` TEXT PRIMARY KEY
- `name` TEXT
- `type` TEXT ('preventative' | 'rescue')
- `dosage` TEXT
- `dosageUnit` TEXT
- `notes` TEXT

**medication_doses**
- `id` TEXT PRIMARY KEY
- `medicationId` TEXT (foreign key → medications.id)
- `timestamp` INTEGER
- `amount` REAL
- `notes` TEXT

**medication_schedules**
- `id` TEXT PRIMARY KEY
- `medicationId` TEXT (foreign key → medications.id)
- `frequency` TEXT
- `times` TEXT (JSON array)
- `daysOfWeek` TEXT (JSON array, nullable)
- `startDate` INTEGER
- `endDate` INTEGER (nullable)

**daily_status**
- `id` TEXT PRIMARY KEY
- `date` TEXT (YYYY-MM-DD)
- `status` TEXT ('green' | 'yellow' | 'red')
- `type` TEXT (nullable - 'prodrome' | 'postdrome')
- `notes` TEXT

### Migrations

Database migrations are handled automatically on app start. Migration files are located in `src/database/migrations/`.

To add a new migration:
1. Create a new file: `src/database/migrations/YYYY-MM-DD_description.ts`
2. Export migration object with `id`, `up`, and `down` functions
3. Import and add to migration array in `src/database/db.ts`

## Deployment

### Building for Production

**iOS:**
```bash
# Using Expo Application Services (EAS)
eas build --platform ios --profile production

# Local build
npm run ios --configuration Release
```

**Android:**
```bash
# Using EAS
eas build --platform android --profile production

# Local build
npm run android --variant=release
```

### Pre-Release Checklist

- [ ] All tests passing (unit, E2E, type check)
- [ ] Version bumped in `package.json`
- [ ] Changelog updated
- [ ] Database migrations tested
- [ ] Light and dark themes tested
- [ ] iOS and Android tested
- [ ] Backup/restore functionality tested
- [ ] Performance profiling completed

### Environment Configuration

Environment-specific configuration is handled through:
- `app.config.js` - Expo configuration
- `.env` files (if using) - Never commit `.env` files
- Build profiles in `eas.json`

## Contributing

See the main [README.md](README.md) for contribution guidelines, or open an issue for questions.

## Additional Resources

- [Testing Guide](docs/testing-guide.md) - Comprehensive testing documentation
- [Functional Specification](docs/functional-specification.md) - Product requirements
- [CLAUDE.md](CLAUDE.md) - Instructions for Claude Code AI assistant
- [.clinerules](.clinerules) - Development rules for AI assistants

## License

MIT License - See [LICENSE](LICENSE) for details
