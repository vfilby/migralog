# Sentry Observability Setup

This document describes how Sentry is integrated into MigraLog for error tracking, crash reporting, and performance monitoring with HIPAA-compliant data privacy.

## Overview

Sentry provides:
- **Error Tracking**: Capture and track JavaScript errors and exceptions
- **Crash Reporting**: Capture native crashes on iOS/Android
- **Performance Monitoring**: Track app performance and identify bottlenecks
- **Session Tracking**: Monitor user sessions and app stability

## Privacy & HIPAA Compliance

**CRITICAL**: MigraLog handles Protected Health Information (PHI) and must comply with HIPAA regulations.

Our approach:
- **Client-side data scrubbing**: All sensitive health data is removed BEFORE sending to Sentry
- **No PHI/PII in error reports**: Medication names, symptoms, pain details, locations, and user notes are redacted
- **Source maps only**: Sentry receives only stack traces and technical debugging info

### What Gets Scrubbed

The `src/utils/sentryPrivacy.ts` module scrubs:
- Medication names, doses, and units
- Episode details (intensity, pain location, symptoms, triggers)
- User notes and free-text descriptions
- Location data (GPS coordinates, addresses)
- Personal information (email, phone, names)
- Query parameters and request data

## Configuration

### 1. Create a Sentry Project

1. Sign up at https://sentry.io (free tier: 5,000 events/month)
2. Create a new project for "React Native"
3. Note your:
   - **DSN** (Data Source Name)
   - **Organization slug**
   - **Project slug**

### 2. Set Environment Variables

**Important:** The DSN is safe to check in to version control - it's a public identifier that's already exposed in your frontend JavaScript bundle. However, the `SENTRY_AUTH_TOKEN` should NEVER be checked in.

The DSN is already configured in `app.config.js`. For source map uploads during builds, you'll need to set the auth token:

```bash
# Required for build-time source map uploads (DO NOT CHECK IN!)
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=your-auth-token

# Optional: Enable Sentry in development (default: false)
# EXPO_PUBLIC_SENTRY_ENABLED=true
```

### 3. Generate Auth Token

Create an auth token for source map uploads:

1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. Create a new token with scopes:
   - `project:releases`
   - `org:read`
3. Add token to `.env` as `SENTRY_AUTH_TOKEN`

## Architecture

### Components

1. **Metro Config** (`metro.config.js`)
   - Integrates Sentry Metro plugin for source map generation
   - Automatically adds Debug IDs to bundles

2. **App Config** (`app.config.js`)
   - Sentry Expo plugin configuration
   - Handles source map uploads during native builds

3. **Initialization** (`App.tsx`)
   - Sentry initialized at app startup (before React renders)
   - Error boundary wraps entire app via `Sentry.wrap(App)`
   - Privacy scrubbing configured via `beforeSend` hooks

4. **Privacy Helper** (`src/utils/sentryPrivacy.ts`)
   - Scrubs sensitive data from all events
   - Handles errors, transactions, and breadcrumbs
   - Redacts URLs, query parameters, and form data

### Event Flow

```
Error occurs → Sentry captures → beforeSend scrubs PHI → Sends to Sentry
```

## Development vs Production

### Development Mode
- Sentry is **disabled** by default to avoid quota usage
- Enable with: `EXPO_PUBLIC_SENTRY_ENABLED=true` in `.env`
- 100% trace sampling (all transactions captured)
- Debug logging enabled

### Production Mode
- Sentry is **enabled** automatically
- 10% trace sampling (reduces quota usage)
- No debug logging
- Source maps uploaded automatically during EAS builds

## Testing

### Manual Testing

Test error tracking:

```typescript
// In development, enable Sentry first
// Then trigger a test error:
import * as Sentry from '@sentry/react-native';

// Test error capture
Sentry.captureException(new Error('Test error'));

// Test message capture
Sentry.captureMessage('Test message', 'info');

// Test data scrubbing
Sentry.captureException(new Error('Medication: Ibuprofen'));
// Should appear in Sentry with medication name redacted
```

### Verify Data Scrubbing

1. Enable Sentry in development:
   ```bash
   echo "EXPO_PUBLIC_SENTRY_ENABLED=true" >> .env
   ```

2. Trigger an error with sensitive data
3. Check Sentry dashboard - sensitive fields should show `[Redacted]`

## Source Maps

Source maps allow Sentry to show readable stack traces instead of minified code.

### How It Works

1. Metro bundler generates source maps during builds
2. Sentry Metro plugin adds Debug IDs
3. Sentry Expo plugin uploads maps during `eas build`
4. Stack traces in Sentry show original source code locations

### Troubleshooting

If stack traces aren't symbolicated:

1. Verify `SENTRY_AUTH_TOKEN` is set
2. Check EAS build logs for upload errors
3. Ensure `app.config.js` has correct org/project slugs
4. Try manually uploading: `npx sentry-cli sourcemaps upload`

## Best Practices

### Do's
✅ Test data scrubbing before production deployment
✅ Monitor Sentry quota usage (5,000 events/month on free tier)
✅ Use appropriate severity levels (`error`, `warning`, `info`)
✅ Add context with `Sentry.setContext()` for debugging

### Don'ts
❌ Never log sensitive health data directly to Sentry
❌ Don't set user IDs or personal info in `Sentry.setUser()`
❌ Don't disable data scrubbing (`beforeSend` hooks are required)
❌ Don't commit `.env` files with secrets to git

## Monitoring

### Key Metrics

Monitor these in Sentry dashboard:

- **Error Rate**: Should be <1% of sessions
- **Crash Rate**: Should be <0.1% of sessions
- **Session Duration**: Average user session length
- **Performance**: Transaction durations and slow operations

### Alerts

Configure alerts for:
- New error types (first-seen errors)
- Spike in error rate (>10x baseline)
- High crash rate (>1% of sessions)
- Slow performance (P95 >2 seconds)

## Resources

- [Sentry React Native Docs](https://docs.sentry.io/platforms/react-native/)
- [Expo + Sentry Integration](https://docs.sentry.io/platforms/react-native/manual-setup/expo/)
- [HIPAA Compliance Guide](https://sentry.io/security/)
- [Source Maps Troubleshooting](https://docs.sentry.io/platforms/react-native/sourcemaps/)

## Support

For issues:
1. Check Sentry dashboard for error details
2. Review `src/utils/sentryPrivacy.ts` for scrubbing logic
3. Enable debug mode: Set `debug: true` in `App.tsx` Sentry init
4. Check EAS build logs for source map upload issues
