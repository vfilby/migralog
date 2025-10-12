# Architecture

MigraineTracker follows a layered architecture with clear separation of concerns.

## Project Structure

```
app/
├── assets/              # App icons, images, splash screens
├── docs/                # Documentation
│   ├── archive/         # Historical documentation
│   ├── features/        # Feature documentation and plans
│   ├── testing/         # Testing guide
│   └── wiki/            # GitHub Wiki pages
├── e2e/                 # End-to-end tests (Detox)
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
└── ... (config files)
```

## Database Layer

Located in `src/database/`, this layer handles all data persistence.

### Key Files

- **db.ts / db.web.ts**: Platform-specific database initialization
- **schema.ts**: SQL schema definitions
- **migrations.ts**: Database migration system
- **\*Repository.ts**: Data access repositories

### Repository Pattern

All database operations go through repository classes:

- `episodeRepository.ts` - Episodes, intensity readings, symptom logs
- `medicationRepository.ts` - Medications, doses, schedules, reminders
- `dailyStatusRepository.ts` - Daily status logs (red/yellow/green days)

### Database Schema

Main tables:
- `episodes` - Migraine episodes with start/end times
- `intensity_readings` - Pain intensity over time
- `symptom_logs` - Symptoms during episodes
- `medications` - Medication catalog
- `medication_doses` - Logged medication doses
- `medication_schedules` - Medication schedules
- `medication_reminders` - Notification reminders
- `daily_status_logs` - Daily well-being status

## State Management

Zustand stores in `src/store/` wrap repository calls and manage client state.

### Store Pattern

```typescript
export const useEpisodeStore = create<EpisodeStore>((set, get) => ({
  // State
  currentEpisode: null,
  episodes: [],

  // Actions
  startEpisode: async (data) => {
    const episode = await episodeRepository.create(data);
    set({ currentEpisode: episode });
    // ... more logic
  },
}));
```

### Available Stores

- `episodeStore.ts` - Episode management
- `medicationStore.ts` - Medication tracking
- `dailyStatusStore.ts` - Daily status tracking

## Navigation

Two-tier navigation structure using React Navigation:

1. **Bottom Tab Navigator** (MainTabs)
   - Dashboard
   - Episodes
   - Medications
   - Analytics

2. **Stack Navigator** (RootStackParamList)
   - Modal screens: NewEpisode, EpisodeDetail, AddMedication, LogMedication, etc.

All navigation is type-safe through `src/navigation/types.ts`.

## Theme System

Located in `src/theme/`, the theme system provides light/dark mode support.

### Usage

```typescript
const theme = useTheme();

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.background,
    borderColor: theme.border,
  },
});
```

### Theme Modes

- `light` - Light theme
- `dark` - Dark theme
- `system` - Follow device setting

## Services

Business logic services in `src/services/`:

- `backupService.ts` - Data backup/restore
- `locationService.ts` - GPS location tracking
- `notificationService.ts` - Local notifications
- `errorLogger.ts` - Error logging

## Key Patterns

### Platform-Specific Files

Use `.platform.ext` suffix:
- `db.ts` (iOS/Android)
- `db.web.ts` (web)

Metro bundler automatically selects the correct file.

### Offline-First

All data persists to SQLite immediately. No server sync (yet).

### Type Safety

TypeScript is used throughout with strict type checking enabled.

### Data Flow

```
Screen/Component → Store → Repository → Database
                ↓
             UI Update
```

## Testing Strategy

- **Unit Tests**: Jest for repositories, stores, utilities
- **Integration Tests**: Cross-feature interactions
- **E2E Tests**: Detox for full user workflows

See [Testing Guide](Testing-Guide) for details.
