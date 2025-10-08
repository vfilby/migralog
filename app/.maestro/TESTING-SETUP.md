# E2E Testing Setup & Database Reset

## Overview

The app now has a comprehensive E2E testing setup with database reset functionality for creating reliable, repeatable tests from a known state.

## Security Features

✅ **Production Safe:**
- All test utilities are wrapped in `__DEV__` guards
- Test modules throw errors if imported in production builds
- Deep links only work in development builds
- Automatic backup before any reset operation

## Database Reset Methods

### Method 1: Deep Link (For Maestro)

**Clean reset:**
```yaml
- openLink: migrainetracker://test/reset
```

**Reset with test fixtures:**
```yaml
- openLink: migrainetracker://test/reset?fixtures=true
```

**Check database state:**
```yaml
- openLink: migrainetracker://test/state
```

### Method 2: Manual UI (TODO - Not Yet Implemented)

A hidden reset button in Settings is planned but not yet implemented. For now, use deep links.

### Method 3: Programmatic (For Unit Tests)

```typescript
// Import only in test files or __DEV__ code
import { resetDatabaseForTesting } from './src/utils/testHelpers';

// Clean reset
await resetDatabaseForTesting({ createBackup: true, loadFixtures: false });

// Reset with test data
await resetDatabaseForTesting({ createBackup: true, loadFixtures: true });
```

## Test Fixtures

When `loadFixtures: true`, the following test data is loaded:

**Test Episode:**
- ID: `test-episode-{timestamp}`
- Status: Ended (for consistent state)
- Duration: ~4 hours (24h ago → 20h ago)
- Peak Intensity: 7
- Location: San Francisco (37.7749, -122.4194)
- Notes: "Test episode for E2E testing"

**Intensity Readings:**
1. Initial reading: intensity 5 (at episode start)
2. Peak reading: intensity 7 (2 hours later)

**Test Medication:**
- ID: `test-medication-{timestamp}`
- Name: "Test Ibuprofen"
- Type: Rescue
- Dosage: 400mg
- Instructions: "Take with food"

## File Structure

```
src/utils/
├── testHelpers.ts       - Database reset & fixtures (__DEV__ only)
└── testDeepLinks.ts     - Deep link handler (__DEV__ only)

.maestro/
├── working-smoke-test.yaml          - ✅ Verified basic test
├── full-episode-flow.yaml           - New test with reset
├── start-end-episode.yaml           - Needs update
├── log-intensity-readings.yaml      - Needs update
├── add-log-medication.yaml          - Needs update
└── view-episode-details.yaml        - Needs update
```

## How It Works

1. **App Initialization** (App.tsx):
   ```typescript
   if (__DEV__) {
     const { initializeTestDeepLinks } = await import('./src/utils/testDeepLinks');
     initializeTestDeepLinks();
   }
   ```

2. **Deep Link Handler** (testDeepLinks.ts):
   - Listens for `migrainetracker://test/*` URLs
   - Routes to appropriate test helper function
   - Only active in `__DEV__` mode

3. **Test Helpers** (testHelpers.ts):
   - `resetDatabaseForTesting()` - Main reset function
   - `loadTestFixtures()` - Load predefined test data
   - `getDatabaseState()` - Inspect current state
   - All wrapped in `__DEV__` guards

4. **Backup Service**:
   - Automatic backup before reset
   - Stored in app documents directory
   - Can be restored via Settings → Backup & Restore

## Writing New Tests

### 1. Start with Database Reset

```yaml
appId: host.exp.Exponent
---
# Reset to clean state
- openLink: migrainetracker://test/reset
- wait: 2000  # Allow reset to complete

# Continue with test...
```

### 2. Or Reset with Fixtures

```yaml
# Reset and load test data
- openLink: migrainetracker://test/reset?fixtures=true
- wait: 2000

# Now you have a test episode and medication to work with
```

### 3. Add testIDs to UI Elements

```tsx
// In your React component
<TouchableOpacity testID="my-button" onPress={handlePress}>
  <Text>Click Me</Text>
</TouchableOpacity>
```

### 4. Use testIDs in Maestro

```yaml
- tapOn:
    id: "my-button"
```

## Debugging

### Check if Reset Worked

Look for console output:
```
[TestHelpers] Starting database reset...
[TestHelpers] Creating pre-reset backup...
[TestHelpers] Backup created: backup_1234567890_abc123
[TestHelpers] Clearing all tables...
[TestHelpers] All tables cleared
[TestHelpers] Database reset complete
```

### Check Database State

```yaml
- openLink: migrainetracker://test/state
```

Look for output:
```
[TestDeepLinks] Current database state: {
  episodes: 0,
  medications: 0,
  intensityReadings: 0,
  medicationDoses: 0
}
```

### Manual Backup Recovery

If something goes wrong:
1. Open Settings → Backup & Restore
2. Find the pre-reset backup (timestamp in filename)
3. Restore it

## Production Safety Checklist

- [ ] testHelpers.ts has `if (__DEV__ === false) throw Error`
- [ ] testDeepLinks.ts has `if (__DEV__ === false) throw Error`
- [ ] App.tsx only imports test modules in `if (__DEV__) { }`
- [ ] Deep link handler checks `__DEV__` before processing
- [ ] All test functions create backup before destructive operations

## Next Steps

1. **Add Settings UI Button** - Visual way to trigger reset (lower priority since deep link works)
2. **Validate Remaining Tests** - Update old test files with:
   - Database reset at start
   - Correct testIDs from actual UI
   - Proper wait times
3. **Add More Fixtures** - Different scenarios:
   - Active episode
   - Multiple medications
   - Medication schedules
4. **CI/CD Integration** - Run tests automatically on commits

## Known Limitations

- Deep links only work when app is running or in background
- 2-second wait after reset is arbitrary - may need adjustment
- No visual feedback when reset completes (console only)
- Settings button not yet implemented
