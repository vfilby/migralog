# Migraine Tracker

A React Native mobile app for tracking migraine episodes, symptoms, medications, and triggers.

## Features

- 📊 Track migraine episodes with intensity readings over time
- 📝 Add timestamped notes during episodes
- 💊 Log medications and track effectiveness
- 📍 GPS location tracking for episode onset
- 🌓 Dark mode support (light/dark/system)
- 💾 Local data backup and recovery
- 📈 Analytics and pattern tracking
- 🔄 Database migrations with automatic backups

## Tech Stack

- React Native 0.81.4
- Expo ~54
- TypeScript 5.9
- SQLite (expo-sqlite) for offline-first storage
- Zustand for state management
- React Navigation for routing
- date-fns for date utilities

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn
- Xcode (for iOS development)
- Android Studio (for Android development)
- Expo CLI

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

## Development Commands

### Running the App

```bash
# Start Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run in web browser (limited functionality)
npm run web
```

### Building & Deployment

```bash
# Build iOS app with EAS (interactive)
npm run build:ios

# Submit to TestFlight (interactive)
npm run submit:ios
```

Note: Build and submit commands are interactive and will prompt for required information.

### Type Checking

```bash
# Run TypeScript compiler in check mode
npx tsc --noEmit
```

### Utilities

```bash
# Process app icons (requires ImageMagick)
./scripts/process-icons.sh <path-to-source-icon.png>

# Generate build info
npm run generate-build-info
```

## Project Structure

```
app/
├── assets/              # App icons, images, splash screens
├── scripts/             # Build and utility scripts
├── src/
│   ├── components/      # Reusable UI components
│   ├── database/        # SQLite database layer
│   │   ├── db.ts        # Database initialization
│   │   ├── schema.ts    # Database schema
│   │   ├── migrations.ts # Schema migrations
│   │   └── *Repository.ts # Data repositories
│   ├── models/          # TypeScript types and interfaces
│   ├── navigation/      # React Navigation setup
│   ├── screens/         # Screen components
│   ├── services/        # Business logic services
│   │   ├── backupService.ts
│   │   └── locationService.ts
│   ├── store/           # Zustand state management
│   ├── theme/           # Theme and color definitions
│   └── utils/           # Utility functions
├── app.json             # Expo configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Database

The app uses SQLite for offline-first data storage with the following tables:

- `episodes` - Migraine episodes with start/end times, intensity, and location
- `episode_notes` - Timestamped notes during episodes
- `intensity_readings` - Pain intensity readings over time
- `medications` - Medication catalog
- `medication_doses` - Logged medication doses
- `medication_schedules` - Medication schedules and reminders

### Migrations

Database migrations run automatically on app start. Migrations create automatic backups before executing to protect user data.

## Key Patterns

### Platform-Specific Files

Use `.platform.ext` suffix for platform-specific implementations:
- `db.ts` (iOS/Android) vs `db.web.ts` (web)
- Metro bundler automatically selects the correct file

### Repository Pattern

All database access goes through repository classes in `src/database/`. This provides a clean abstraction layer and makes testing easier.

### State Management

Zustand stores wrap repository calls and manage client-side state. See `src/store/` for implementations.

## Icon Updates

To update the app icon:

1. Save your new icon (1024x1024 or larger)
2. Run the icon processing script:
   ```bash
   ./scripts/process-icons.sh ~/path/to/your-icon.png
   ```
3. Rebuild with `npx expo prebuild --clean`

The script generates all required icon sizes for iOS, Android, and web.

## Data Privacy

This app handles health data subject to HIPAA requirements:
- Never log sensitive information
- All data stored locally by default
- Encrypt data at rest when implementing cloud sync
- Follow security best practices for any backend integration

## Branch Strategy

- Create feature branches: `feature/description`
- Bugfix branches: `bugfix/description`
- Never commit directly to main
- iOS is the primary development platform

## Known Issues

- Web version has limited functionality (database is no-op on web)
- Test on physical iOS devices for accurate performance
- Tab bar styling assumes iPhone with home indicator

## License

Private project - All rights reserved

## Support

For issues or questions, contact the development team.
