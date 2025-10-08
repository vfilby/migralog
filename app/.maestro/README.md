# Maestro E2E Tests

This directory contains end-to-end tests for the MigraineTracker app using [Maestro](https://maestro.mobile.dev/).

## Prerequisites

1. **Install Maestro CLI**:
   ```bash
   curl -fsSL https://get.maestro.mobile.dev | bash
   ```

2. **Install Java** (required by Maestro):
   ```bash
   brew install openjdk@17
   ```

3. **Set up environment** (add to your `~/.zshrc` or `~/.bash_profile`):
   ```bash
   export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
   export PATH="$PATH:$HOME/.maestro/bin"
   ```

## Test Files

- **`start-end-episode.yaml`** - Tests starting a new episode and ending it
- **`log-intensity-readings.yaml`** - Tests logging pain intensity readings during an episode
- **`add-log-medication.yaml`** - Tests adding a new medication and logging a dose
- **`view-episode-details.yaml`** - Tests viewing comprehensive episode details

## Running Tests

### Run all E2E tests:
```bash
npm run test:e2e
```

### Run individual test flows:
```bash
npm run test:e2e:start-end    # Start and end episode
npm run test:e2e:intensity     # Log intensity readings
npm run test:e2e:medication    # Add and log medication
npm run test:e2e:details       # View episode details
```

### Run tests manually with Maestro CLI:
```bash
maestro test .maestro/start-end-episode.yaml
```

## Prerequisites for Running Tests

1. **Start the Expo development server**:
   ```bash
   npm start
   ```

2. **Launch the app on iOS Simulator**:
   ```bash
   npm run ios
   ```

   OR

   **Launch on Android Emulator**:
   ```bash
   npm run android
   ```

3. **Wait for the app to fully load** before running Maestro tests.

## Test Flow Details

### Start/End Episode Flow
1. Opens app to Dashboard
2. Taps "Start New Episode"
3. Saves episode
4. Verifies "Ongoing" badge appears
5. Opens episode detail
6. Ends the episode
7. Verifies episode is marked as "Ended"

### Log Intensity Readings Flow
1. Creates or uses existing episode
2. Navigates to episode detail
3. Logs multiple intensity readings (pain levels 7 and 4)
4. Verifies readings appear in timeline

### Add/Log Medication Flow
1. Navigates to Medications tab
2. Adds new medication (Ibuprofen 400mg)
3. Logs a dose with notes
4. Verifies dose appears in medication history

### View Episode Details Flow
1. Navigates to Episodes tab
2. Opens an episode
3. Views timeline, stats, and metadata
4. Adds a note to the episode
5. Verifies all details display correctly

## Tips

- **Debugging**: Run Maestro Studio for interactive test development:
  ```bash
  maestro studio
  ```

- **Inspect elements**: Use Maestro Studio's hierarchy viewer to find element IDs and text

- **Adjust timing**: If tests fail due to timing issues, add `wait` commands:
  ```yaml
  - tapOn: "Save"
  - wait: 1000  # Wait 1 second
  - assertVisible: "Success"
  ```

## Continuous Integration

These tests can be integrated into CI/CD pipelines. Maestro Cloud provides test execution on real devices.

See [Maestro Cloud docs](https://cloud.mobile.dev/) for more information.
