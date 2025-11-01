// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { unstableBeforeAssetSerializationDebugIdPlugin } = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */

// Pass Sentry plugin as option to getDefaultConfig (required for proper serialization)
const config = getDefaultConfig(__dirname, {
  unstable_beforeAssetSerializationPlugins: [
    unstableBeforeAssetSerializationDebugIdPlugin,
  ],
});

module.exports = config;