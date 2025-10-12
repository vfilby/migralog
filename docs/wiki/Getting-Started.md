# Getting Started

This guide will help you set up the MigraineTracker development environment.

## Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn
- Xcode (for iOS development)
- Android Studio (for Android development)
- Expo CLI

## Installation

1. Clone the repository:
```bash
git clone https://github.com/vfilby/MigraineTracker.git
cd MigraineTracker/app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## Running the App

### iOS (Primary Platform)

```bash
npm run ios
```

This will open the app in the iOS Simulator.

### Android

```bash
npm run android
```

This will open the app in the Android Emulator.

### Web (Limited Functionality)

```bash
npm run web
```

Note: Web version has limited functionality as the database is no-op on web.

## Development Workflow

1. **Create a feature branch**:
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes** in the codebase

3. **Run tests**:
```bash
npm test
npm run test:e2e:build  # Build for E2E tests
npm run test:e2e        # Run E2E tests
```

4. **Type check**:
```bash
npx tsc --noEmit
```

5. **Commit and push** your changes

6. **Create a pull request** to main branch

## Common Issues

### Metro Bundler Issues

If you encounter bundler issues, try:
```bash
npm start -- --clear
```

### iOS Build Issues

Clear derived data and rebuild:
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npx expo run:ios
```

### Database Migration Issues

If database migrations fail, you may need to uninstall and reinstall the app to clear the old database.

## Next Steps

- Read the [Architecture](Architecture) guide to understand the codebase structure
- Check out [Testing Guide](Testing-Guide) to learn about our testing practices
- Browse [Features](Features) to see what's implemented
