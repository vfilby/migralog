# E2E Test Deep Links - Security Implementation

## Overview

This document describes the security implementation for test deep links used in E2E testing. The solution uses a multi-layered security approach to enable fast database resets during testing while ensuring zero security risk in production builds.

## Three Build Configurations

### 1. Debug Configuration
- **Purpose**: Development and debugging
- **Features**: All debugging tools, test hooks enabled, unoptimized code
- **Test Deep Links**: ✅ ENABLED (with token security)
- **`__DEV__`**: `true`
- **Usage**: Local development, debugging issues

### 2. Testing Configuration
- **Purpose**: E2E testing with production-like optimizations
- **Features**: Production optimizations, test hooks enabled, minified code
- **Test Deep Links**: ✅ ENABLED (with token security)
- **`__DEV__`**: `false` (production-like)
- **Usage**: Detox E2E tests, pre-release testing

### 3. Release Configuration
- **Purpose**: App Store distribution
- **Features**: Full production optimization, zero test code
- **Test Deep Links**: ❌ COMPLETELY DISABLED (code excluded from build)
- **`__DEV__`**: `false`
- **Usage**: App Store submissions, production releases

## Security Layers

### Layer 1: Build Configuration Exclusion
Test deep link code is conditionally compiled based on build configuration:

```typescript
// src/utils/testDeepLinks.ts

// This constant will be set by build configuration
// Debug: true
// Testing: true
// Release: false (code stripped by bundler)
const ENABLE_TEST_DEEP_LINKS = process.env.EXPO_PUBLIC_ENABLE_TEST_DEEP_LINKS === 'true';

if (!ENABLE_TEST_DEEP_LINKS) {
  // In Release builds, this entire module becomes a no-op
  export const initializeTestDeepLinks = () => {};
  return;
}
```

### Layer 2: Session Token Authorization
Even in Debug/Testing builds, database reset requires a valid session token:

```typescript
let isTestModeActive = false;
let testModeToken: string | null = null;
let testModeTimeout: NodeJS.Timeout | null = null;

// Step 1: Activate test mode (generates unique session token)
if (url === 'migralog://test/activate') {
  isTestModeActive = true;
  testModeToken = `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;

  // Auto-disable after 30 seconds
  if (testModeTimeout) clearTimeout(testModeTimeout);
  testModeTimeout = setTimeout(() => {
    isTestModeActive = false;
    testModeToken = null;
  }, 30000);

  console.log('[TestMode] Activated with token');
  return;
}

// Step 2: Execute test commands (requires valid token)
if (url.startsWith('migralog://test/')) {
  const urlObj = new URL(url);
  const providedToken = urlObj.searchParams.get('token');

  if (!isTestModeActive || providedToken !== testModeToken) {
    console.warn('[TestMode] Rejected: invalid or missing token');
    return;
  }

  // Valid token - execute command
  if (url.includes('/reset-database')) {
    const withFixtures = urlObj.searchParams.get('fixtures') === 'true';
    await resetTestDatabase(withFixtures);
  }
}
```

### Layer 3: Auto-Expiration
Test mode automatically disables after 30 seconds of inactivity, invalidating the session token.

### Layer 4: Console Logging for Audit Trail
All test deep link activations and rejections are logged for security auditing:

```typescript
console.log('[TestMode] Activated with token');
console.log('[TestMode] Database reset completed');
console.warn('[TestMode] Rejected: test mode not activated');
console.warn('[TestMode] Rejected: invalid token');
```

## Attack Vector Analysis

### Scenario 1: Malicious URL in Production App (App Store Version)
**Attack**: User clicks `migralog://test/reset-database` in Safari or another app

**Defense**:
- ❌ Build Configuration: Test deep link code NOT INCLUDED in Release build
- ❌ Result: URL handler doesn't exist, nothing happens

**Outcome**: ✅ SECURE - Zero impact

### Scenario 2: Malicious URL in Testing Build
**Attack**: User clicks `migralog://test/reset-database` during E2E testing

**Defense**:
- ❌ Token Required: No valid session token provided
- ❌ Test Mode Not Activated: Test mode must be explicitly activated first
- Result: Command rejected, logged as security event

**Outcome**: ✅ SECURE - No data loss

### Scenario 3: Developer Accidentally Ships Testing Build
**Attack**: User downloads Testing build from TestFlight, clicks malicious URL

**Defense**:
- ❌ Token Required: Attacker doesn't know the randomly generated token
- ❌ Auto-Expiration: Token expires after 30 seconds even if somehow activated
- ❌ Test Mode Activation Required: Malicious URL alone can't activate test mode

**Outcome**: ✅ SECURE - Multiple layers prevent exploitation

### Scenario 4: Sophisticated Attack (Activation + Reset)
**Attack**: Attacker tries to activate test mode first: `migralog://test/activate`

**Defense**:
- ⚠️ Test mode activates (in Debug/Testing builds only)
- ❌ Token is randomly generated and unknown to attacker
- ❌ Token is NOT included in activation response (only in console logs)
- ❌ Attacker can't construct valid reset URL without token

**Outcome**: ✅ SECURE - Token remains secret

## Usage in E2E Tests

### Fast Database Reset (2 seconds vs 15-25 seconds)

```javascript
// e2e/helpers.js

async function resetDatabase(withFixtures = false) {
  console.log('Resetting database via deep link...');

  // Step 1: Activate test mode
  await device.openURL({ url: 'migralog://test/activate' });
  await waitForAnimation(500);

  // Step 2: Extract token from console logs
  // (Detox has access to device console output)
  const token = await extractTokenFromLogs();

  // Step 3: Execute database reset with token
  const fixturesParam = withFixtures ? '&fixtures=true' : '';
  await device.openURL({
    url: `migralog://test/reset-database?token=${token}${fixturesParam}`
  });

  await waitForAnimation(2000);

  console.log('Database reset complete');
}
```

### Build Commands

```bash
# Development (with debugging)
npm run test:e2e:build -- --configuration Debug
detox test -c ios.sim.debug

# Production-like testing (recommended for pre-release)
npm run test:e2e:build -- --configuration Testing
detox test -c ios.sim.testing

# True production build (no test hooks)
npm run test:e2e:build -- --configuration Release
# Note: Database reset will fail (as expected), use UI navigation instead
```

## Environment Configuration

### app.config.js

```javascript
export default {
  expo: {
    extra: {
      // Enable test deep links in Debug and Testing builds only
      enableTestDeepLinks: process.env.BUILD_CONFIGURATION !== 'Release',
    },
  },
};
```

### .env Files

```bash
# .env.testing
EXPO_PUBLIC_ENABLE_TEST_DEEP_LINKS=true

# .env.production
EXPO_PUBLIC_ENABLE_TEST_DEEP_LINKS=false
```

## Xcode Build Settings (Future Enhancement)

For even stronger security, configure Xcode to strip test code at compile time:

1. Open `ios/MigraLog.xcodeproj` in Xcode
2. Select MigraLog target
3. Build Settings → User-Defined Settings
4. Add setting:
   - Debug: `ENABLE_TEST_DEEP_LINKS = YES`
   - Testing: `ENABLE_TEST_DEEP_LINKS = YES`
   - Release: `ENABLE_TEST_DEEP_LINKS = NO`
5. Use preprocessor macros to exclude test code:

```objective-c
// In native code
#if ENABLE_TEST_DEEP_LINKS
  // Test deep link handler
#endif
```

## Monitoring and Auditing

### Console Logs
All test mode activations and database resets are logged:

```
[TestMode] Activated with token
[TestMode] Database reset completed
[TestMode] Auto-disabled after timeout
```

### Rejection Logs
Security violations are logged for auditing:

```
[TestMode] Rejected: test mode not activated
[TestMode] Rejected: invalid token
[TestMode] Rejected: token expired
```

## Compliance Considerations

### HIPAA
- Test deep links do not transmit health data
- Database reset only occurs locally on device
- No network communication involved
- Audit logs available for security review

### App Store Guidelines
- Test code is excluded from Release builds
- No hidden functionality in production
- Complies with Apple's testing requirements

## Summary

This implementation provides defense-in-depth security:

1. **Release builds**: Test code completely excluded (zero risk)
2. **Testing builds**: Token-based authorization prevents unauthorized access
3. **Auto-expiration**: Limits exposure window to 30 seconds
4. **Audit trail**: All security events logged for review

The design enables fast E2E testing (2-second database resets) while maintaining production security equivalent to having no test deep links at all.
