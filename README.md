# MigraineTracker

A mobile app for tracking pain episodes, symptoms, and medication usage to help identify patterns and optimize treatment strategies.

## Project Structure

```
MigraineTracker/
├── app/                    # React Native + Expo application
│   ├── src/
│   │   ├── database/      # SQLite database and repositories
│   │   ├── models/        # TypeScript type definitions
│   │   ├── navigation/    # React Navigation setup
│   │   ├── screens/       # UI screens
│   │   └── store/         # Zustand state management
├── docs/                   # Documentation
│   └── functional-specification.md
└── .clinerules            # Development guidelines

```

## Tech Stack

- **React Native** with **Expo** - Cross-platform mobile framework
- **TypeScript** - Type safety
- **SQLite** (expo-sqlite) - Local database for offline support
- **Zustand** - State management
- **React Navigation** - Navigation framework
- **date-fns** - Date utilities

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (installed automatically with npx)
- iOS Simulator (for iOS development) or Android Studio (for Android)

### Installation

1. Clone the repository
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

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run in web browser (limited functionality)
npm run web
```

## Current Features (v1)

### ✅ Implemented
- Episode tracking (start/end episodes)
- Pain intensity logging (0-10 scale)
- Symptom tracking
- Medication management (preventative and rescue)
- Basic analytics and trends
- Offline-first SQLite database
- iOS-style UI design

### 🚧 In Progress
- Episode detail view with intensity timeline
- Medication dose logging
- Advanced pattern recognition
- Trigger analysis
- Report generation

### 📋 Planned
- Medication reminders with critical alerts
- Photo documentation for medications
- Weather API integration
- Wearable device integration
- Export reports (PDF, CSV)
- Healthcare provider sharing

## Development Guidelines

See `.clinerules` for coding standards and best practices.

Key principles:
- All new features developed in feature branches
- Automated testing required
- HIPAA compliance considerations for health data
- iOS is primary platform (Android secondary)

## Database Schema

The app uses SQLite with the following main tables:
- `episodes` - Pain episode records
- `intensity_readings` - Pain intensity over time
- `symptom_logs` - Symptom tracking during episodes
- `medications` - Medication definitions
- `medication_doses` - Medication usage logs
- `medication_schedules` - Preventative medication schedules

## Contributing

1. Create a feature branch: `git checkout -b feature/description`
2. Make your changes
3. Test thoroughly
4. Commit with descriptive message
5. Create a pull request

## License

Private project
