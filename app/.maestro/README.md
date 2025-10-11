# Maestro E2E Tests

This directory contains End-to-End (E2E) tests for the Migraine Tracker app using [Maestro](https://maestro.mobile.dev/).

## ✅ Status: Working

The E2E testing framework is functional. The `working-smoke-test.yaml` validates the app launches and key UI elements are accessible via testID selectors.

## Prerequisites

1. **Install Maestro CLI**:
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Install Java** (required by Maestro):
   ```bash
   brew install openjdk@17
   ```

3. **Start the Expo development server**:
   ```bash
   npm start
   ```

4. **Open the app in iOS simulator** (press `i` in Expo terminal)

## Test Files

### Working Tests
- **`working-smoke-test.yaml`** - ✅ **VERIFIED** - Validates app launch and dashboard UI elements

### Theoretical Tests (Not Yet Validated)
- **`start-end-episode.yaml`** - Start/end episode flow (needs validation)
- **`log-intensity-readings.yaml`** - Pain intensity logging (needs validation)
- **`add-log-medication.yaml`** - Medication management (needs validation)
- **`view-episode-details.yaml`** - Episode details viewing (needs validation)

See `LIMITATIONS.md` for details on unvalidated tests.

## Test Harness & Setup

### Shared Setup Flow

`setup-clean-database.yaml` - Resets the database to a clean state via the Settings UI. This can be:
1. Run once before a test suite using `initFlow` in `test-suite.yaml`
2. Included at the start of individual tests using `runFlow`

### Running Tests

#### Test Suite (Recommended)
```bash
# Run all tests with shared setup (runs setup once, then all tests)
npm run test:e2e:suite
```

#### Individual Tests
```bash
# Run a single test (includes its own setup)
npm run test:e2e:reset        # Full episode flow with reset
npm run test:e2e:start-end    # Start/end episode flow
npm run test:e2e:intensity    # Intensity logging
npm run test:e2e:medication   # Medication management
npm run test:e2e:details      # Episode details
```

#### Quick Start (Verified Test):
```bash
# Make sure app is running in simulator first!
npm start  # In one terminal
# Press 'i' to open iOS simulator

# In another terminal:
npm run test:e2e              # Smoke test
npm run test:e2e:suite        # Full test suite
```

## Test Organization

### Approach 1: Individual Tests with Setup
Each test includes `runFlow: setup-clean-database.yaml` at the start.

**Pros:**
- Tests are independent and can run in any order
- Easy to debug single tests
- No state pollution between tests

**Cons:**
- Slower (setup runs for each test)
- More UI navigation overhead

### Approach 2: Test Suite with Shared Setup (Recommended)
The `test-suite.yaml` uses `initFlow` to run setup once, then executes all tests.

**Pros:**
- Much faster (setup runs once)
- Good for CI/CD pipelines
- Ideal for full regression testing

**Cons:**
- Tests may depend on execution order
- State can leak between tests
- Harder to debug individual tests

### Best Practices

**For tests needing clean state:**
```yaml
- runFlow: setup-clean-database.yaml
```

**For tests building on existing state:**
Add to the test suite after appropriate prerequisite tests.

## How It Works (Expo Go)

Since the app runs in Expo Go (not as a standalone build), the tests:
1. Launch Expo Go app (`host.exp.Exponent`)
2. Tap on "Migraine Tracker" in the recently opened list
3. Wait for the app to load
4. Interact with UI elements using testIDs or text selectors

## TestIDs Added

The following testIDs have been added to make E2E testing reliable:

**DashboardScreen.tsx:**
- `dashboard-title` - Main "Pain Tracker" title
- `settings-button` - Settings navigation button
- `start-episode-button` - Button to start new episode
- `log-medication-button` - Quick action to log medication

## Troubleshooting

### "Unable to launch app" error
- Make sure the iOS simulator is running
- Ensure the app appears in Expo Go's "Recently opened" list
- Try opening the app manually in Expo Go first

### Test can't find testID
- Verify the app has reloaded with latest code changes
- Use `maestro hierarchy` to inspect actual UI:
  ```bash
  export JAVA_HOME='/opt/homebrew/opt/openjdk@17'
  maestro hierarchy
  ```

### Test timeout or hang
- Check if a modal or alert is blocking the UI
- Ensure the simulator is not locked
- Try killing and restarting the simulator

### Element not found
- Use `maestro hierarchy` to inspect the actual UI element IDs
- Text matching is case-sensitive
- Elements must be visible on screen (not scrolled off)

## Writing New Tests

1. **Inspect the UI** with Maestro hierarchy:
   ```bash
   export JAVA_HOME='/opt/homebrew/opt/openjdk@17'
   maestro hierarchy > ui-snapshot.json
   ```

2. **Find element selectors** - look for:
   - `resource-id` (testID props)
   - `text` or `accessibilityText`

3. **Create test file** following this pattern:
   ```yaml
   appId: host.exp.Exponent
   ---
   - launchApp
   - tapOn: "Migraine Tracker"
   - assertVisible: "Expected Text"
   - tapOn:
       id: "element-testid"
   ```

4. **Add testIDs to components** for reliable selection:
   ```tsx
   <TouchableOpacity testID="my-button">
   ```

5. **Run and validate** the test works consistently

## Maestro Documentation

- [Maestro Documentation](https://maestro.mobile.dev/)
- [Maestro API Reference](https://maestro.mobile.dev/api-reference)
- [Maestro Examples](https://github.com/mobile-dev-inc/maestro/tree/main/maestro-test)
