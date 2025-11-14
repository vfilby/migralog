# Known E2E Test Issues and Solutions

This document catalogs common E2E test failure patterns encountered in MigraineTracker and their solutions.

## Database Constraint Errors

### Issue: NOT NULL constraint failed: medication_schedules.timezone

**Symptoms:**
- Error toast: "[TestHelpers] Failed to reset database: Error: Call..."
- Console error: "Error code 19: NOT NULL constraint failed: medication_schedules.timezone"
- Tests timeout waiting for fixtures to load
- "Test Topiramate" medication not found

**Root Cause:**
Test fixture code in `src/utils/testHelpers.ts` was missing the `timezone` column when inserting medication schedules. The schema requires this field (added in v18), but the fixture INSERT statement wasn't updated.

**Solution:**
```typescript
// WRONG (missing timezone):
await db.runAsync(
  `INSERT INTO medication_schedules (id, medication_id, time, dosage, enabled)
   VALUES (?, ?, ?, ?, ?)`,
  [scheduleId, preventativeMedId, timeString, 1, 1]
);

// CORRECT (includes timezone):
await db.runAsync(
  `INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [scheduleId, preventativeMedId, timeString, 'America/Los_Angeles', 1, 1]
);
```

**How to Diagnose:**
1. Look for "Error code 19" in console output
2. Check error message for "NOT NULL constraint" or "foreign key"
3. Identify which column is missing from the error message
4. Update the INSERT statement in `loadTestFixtures()` function

**Fixed in:** Commit 7f28d7d

---

### Issue: FOREIGN KEY constraint failed

**Symptoms:**
- Database operations fail silently
- Tests timeout waiting for data
- Error: "Error code 19: FOREIGN KEY constraint failed"

**Root Cause:**
Attempting to insert data with a reference to a non-existent foreign key (e.g., medication_id that doesn't exist).

**Solution:**
1. Verify the parent record exists before inserting child records
2. Check the order of fixture data loading
3. Ensure IDs match between parent and child records

**How to Diagnose:**
```bash
grep -A 10 "FOREIGN KEY" /tmp/e2e-test-output.log
```

---

## Test Fixture Loading Issues

### Issue: "Test Topiramate" not found / Today's Medications card not visible

**Symptoms:**
- Tests timeout with: `Timed out while waiting for expectation: TOBEVISIBLE WITH MATCHER(id == "todays-medications-card")`
- Warning: `[E2E] ⚠️  Today's Medications card not visible - this may cause test failures`
- Dashboard shows empty state instead of test fixtures

**Root Cause:**
Database reset completed but fixtures weren't loaded, or stores weren't reloaded after fixtures were inserted.

**Solution:**
1. Check database reset deep link completed successfully
2. Verify `loadFixtures: true` parameter was passed
3. Ensure stores are reloaded after fixture data is inserted:

```typescript
// In testHelpers.ts after loading fixtures:
const { useMedicationStore } = await import('../store/medicationStore');
await useMedicationStore.getState().loadMedications();
```

**How to Diagnose:**
1. Check for successful reset: `grep "Database reset complete" /tmp/e2e-test-output.log`
2. Check if fixtures were loaded: `grep "Test fixtures loaded" /tmp/e2e-test-output.log`
3. Verify stores reloaded: `grep "Stores reloaded with fixture data" /tmp/e2e-test-output.log`

---

## Navigation and UI Issues

### Issue: Log box blocking app restart

**Symptoms:**
- Tests hang after database reset
- App doesn't navigate properly
- Red React Native error overlay visible in screenshots

**Root Cause:**
React Native LogBox error overlay prevents normal app interaction during tests.

**Solution:**
- Dismiss the log box before continuing tests
- Or disable LogBox in test builds (see CLAUDE.md note)

**How to Diagnose:**
- Look for red error overlays in failure screenshots
- Check if tests hang after errors

---

### Issue: Modal not dismissed before navigation

**Symptoms:**
- Tests fail with "element not found"
- Wrong screen is visible in screenshots
- Navigation doesn't work as expected

**Root Cause:**
A modal screen is still open when test tries to navigate

**Solution:**
```javascript
// In test helpers, dismiss modals before navigation:
const hasModal = state.routes.some(route => route.name !== 'MainTabs');
if (hasModal) {
  navigationRef.current.reset({
    index: 0,
    routes: [{ name: 'MainTabs', params: { screen: 'Dashboard' } }],
  });
  await waitForAnimation(300);
}
```

**How to Diagnose:**
- Check screenshots to see if a modal is blocking
- Look for navigation errors in console

---

## Performance and Timing Issues

### Issue: Store data not loaded before test checks

**Symptoms:**
- Tests fail with "element not found" immediately
- Data appears correct in database but not in UI
- Race condition between data load and test assertions

**Root Cause:**
Store's `loadMedications()` or similar async operation hasn't completed before test checks UI.

**Solution:**
Add sufficient wait time after database reset:
```javascript
await waitForAnimation(2000); // Give stores time to load
await waitFor(element(by.id('expected-element')))
  .toBeVisible()
  .withTimeout(15000); // Generous timeout for CI
```

**How to Diagnose:**
- Tests fail inconsistently (race condition)
- Adding wait time makes tests pass
- Store logs show data loading after test already checked

---

## Simulator Issues

### Issue: Simulator is frozen or unresponsive

**Symptoms:**
- Tests hang indefinitely
- No logs or activity
- Detox reports "app is busy"

**Solution:**
```bash
# Kill and restart simulator
killall Simulator
xcrun simctl shutdown all
xcrun simctl boot "iPhone 16 Pro Max"

# Rebuild and rerun
npm run test:ui:rebuild
```

**How to Diagnose:**
- Tests hang with no output
- Simulator shows gray screen or frozen UI

---

## Debugging Strategies by Error Pattern

### Pattern: "Timed out while waiting for expectation: TOBEVISIBLE"

**Check in this order:**
1. Screenshot - what screen is actually shown?
2. Database reset logs - did it complete?
3. Fixture loading logs - was data inserted?
4. Store reload logs - did stores refresh?
5. Console output - any errors during load?

### Pattern: "Error code 19"

**This is a SQLite constraint error. Check:**
1. Full error message for which constraint (NOT NULL, FOREIGN KEY, UNIQUE)
2. Which table and column failed
3. Recent schema changes (migrations)
4. Test fixture INSERT statements

### Pattern: Tests fail after first one passes

**Likely causes:**
1. Database not properly reset between tests
2. Stores keeping stale state
3. Navigation not returning to starting point
4. Simulator state not clean

**Solution:**
Ensure `beforeEach()` properly resets everything:
```javascript
beforeEach(async () => {
  await resetDatabase(true); // with fixtures
});
```

---

## Quick Reference: Error Message → Root Cause

| Error Message | Root Cause | Location to Check |
|--------------|------------|-------------------|
| "NOT NULL constraint failed" | Missing required column in INSERT | `src/utils/testHelpers.ts` fixtures |
| "FOREIGN KEY constraint failed" | Invalid reference ID | Check parent record exists first |
| "Timed out...TOBEVISIBLE" | UI element missing | Check fixtures loaded, stores refreshed |
| "[TestHelpers] Failed to reset database" | Database operation error | Check console for full error details |
| "Today's Medications card not visible" | Fixtures not loaded | Check `loadFixtures: true` parameter |
| "element not found" immediately | Wrong screen or modal open | Check navigation and dismiss modals |
| Tests hang indefinitely | Simulator frozen | Restart simulator |

---

## Prevention Checklist

Before adding new test fixtures:
- [ ] Check schema for all required (NOT NULL) columns
- [ ] Include timezone for medication_schedules
- [ ] Verify foreign key references exist
- [ ] Reload stores after inserting fixtures
- [ ] Test with a single test first
- [ ] Run full suite to check for side effects

Before pushing test code:
- [ ] All E2E tests passing locally
- [ ] No hardcoded delays longer than 2000ms
- [ ] Error toasts checked for visibility
- [ ] Screenshots reviewed manually
- [ ] Console output clean (no errors)
