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

// SECURITY: Exclude dangerous test helpers from production builds
// These files contain database reset functions that should NEVER be in production
if (process.env.NODE_ENV === 'production' || process.env.EXPO_PUBLIC_ENV === 'production') {
  const exclusionPattern = /devTestHelpers\.(ts|tsx|js|jsx)$/;
  
  if (config.resolver) {
    // Add to existing blacklistRE if it exists
    const existingBlacklist = config.resolver.blacklistRE;
    if (existingBlacklist) {
      // Combine patterns
      config.resolver.blacklistRE = new RegExp(
        `(${existingBlacklist.source})|(${exclusionPattern.source})`
      );
    } else {
      config.resolver.blacklistRE = exclusionPattern;
    }
  } else {
    config.resolver = {
      blacklistRE: exclusionPattern,
    };
  }
  
  console.log('[Metro Config] Production build detected - excluding devTestHelpers from bundle');
}

module.exports = config;