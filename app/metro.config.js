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
console.log('EXPO_PUBLIC_SENTRY_DSN:', JSON.stringify(process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN));
console.log('SENTRY_AUTH_TOKEN:', JSON.stringify(process.env.SENTRY_AUTH_TOKEN));
console.log('SENTRY_ORG:', JSON.stringify(process.env.SENTRY_ORG));
console.log('SENTRY_PROJECT:', JSON.stringify(process.env.SENTRY_PROJECT));
console.log('EAS_BUILD:', JSON.stringify(process.env.EAS_BUILD));
console.log('Will enable Sentry Metro plugin:', !!SENTRY_DSN);
console.log('=========================');

module.exports = SENTRY_DSN ? withSentryConfig(config) : config;
