// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Only enable Sentry Metro plugin if DSN is configured
// This prevents Metro errors when running without Sentry
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

// DEBUG: Log environment variables
console.log('=== METRO CONFIG DEBUG ===');
console.log('EXPO_PUBLIC_SENTRY_DSN:', SENTRY_DSN ? 'SET' : 'NOT SET');
console.log('SENTRY_AUTH_TOKEN:', process.env.SENTRY_AUTH_TOKEN ? 'SET' : 'NOT SET');
console.log('SENTRY_ORG:', process.env.SENTRY_ORG || 'NOT SET');
console.log('SENTRY_PROJECT:', process.env.SENTRY_PROJECT || 'NOT SET');
console.log('EAS_BUILD:', process.env.EAS_BUILD || 'NOT SET');
console.log('Will enable Sentry Metro plugin:', !!SENTRY_DSN);
console.log('=========================');

module.exports = SENTRY_DSN ? withSentryConfig(config) : config;
