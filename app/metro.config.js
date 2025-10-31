// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Only enable Sentry Metro plugin if ALL required Sentry env vars are configured
// This prevents Metro errors during preview/development builds where upload is disabled
// The Metro plugin requires SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT to function
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const HAS_ALL_SENTRY_VARS = SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT;

module.exports = HAS_ALL_SENTRY_VARS ? withSentryConfig(config) : config;
