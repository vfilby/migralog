# Maestro E2E Test Limitations

## Current Status: ⚠️ **Tests Are Theoretical**

The Maestro E2E tests in this directory have **NOT been validated** and are provided as a **starting framework** only.

## Known Issues

### 1. **Expo Go vs Development Build**

The app currently runs via **Expo Go** (`host.exp.Exponent`), but the tests were written for a standalone app with bundle ID `com.eff3.app.headache-tracker`.

**Options:**
- **Option A**: Use Expo Go bundle ID and navigate through Expo Go UI first
- **Option B**: Create a development build: `npx expo prebuild && npm run ios`
- **Option C**: Use EAS Build to create a production build

### 2. **UI Element Selectors Not Validated**

The test files contain **assumed** element selectors (e.g., "Start New Episode", "Dashboard") that have NOT been verified against the actual app UI.

To validate selectors, you need to:
1. Run the app on a simulator
2. Use `maestro studio` to inspect the actual UI hierarchy
3. Update test selectors to match actual accessible labels/text

### 3. **Test Flows Not Executed**

None of the test flows have been run end-to-end. They may fail due to:
- Incorrect navigation paths
- Missing wait times for animations
- Wrong element selectors
- Unexpected app states
- Permission prompts (location, notifications)

## How to Make Tests Work

### Step 1: Inspect Actual UI

```bash
# Start the app
npm start
# In another terminal, press 'i' to open iOS simulator

# Launch Maestro Studio
maestro studio
```

Use Maestro Studio's hierarchy viewer to find the actual element IDs and accessible labels.

### Step 2: Update Test Selectors

Replace theoretical selectors in `.yaml` files with actual ones from the app.

Example:
```yaml
# Current (theoretical):
- tapOn: "Start New Episode"

# Update based on actual UI:
- tapOn:
    id: "button-start-episode"  # or whatever the actual ID is
```

### Step 3: Test Incrementally

Start with one simple assertion:
```yaml
appId: host.exp.Exponent
---
- launchApp
- tapOn: "Migraine Tracker"  # Tap app in Expo Go
- assertVisible: "Dashboard"  # Verify app loaded
```

### Step 4: Build the App (Recommended)

For real E2E tests, build a standalone app:

```bash
# Create iOS development build
npx expo prebuild --platform ios
npm run ios

# Update all test files to use standalone bundle ID
appId: com.eff3.app.headache-tracker
```

## Test Coverage Reality

**What we have:**
- ✅ Maestro installed and configured
- ✅ Test file structure created
- ✅ NPM scripts for running tests
- ✅ 4 test flow outlines

**What we DON'T have:**
- ❌ Validated element selectors
- ❌ Working test execution
- ❌ Verified test coverage of user flows
- ❌ Integration with CI/CD

## Recommended Next Steps

1. **Short term**: Document as "E2E framework in place, tests need validation"
2. **Medium term**: Validate one simple test flow (e.g., app launches)
3. **Long term**: Create development build and validate all flows

## Why This Happened

These tests were created without running them against the actual app - a clear oversight. E2E tests require:
1. The app running in a testable state
2. UI inspection to find real element selectors
3. Iterative testing and refinement

Apologies for the incomplete implementation.
