const pkg = require('./package.json');

module.exports = {
  expo: {
    name: "MigraLog",
    slug: "migraine-tracker",
    version: pkg.version,
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "migraine-tracker",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.eff3.app.headache-tracker",
      buildNumber: "1",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSHealthShareUsageDescription: "MigraLog needs access to your health data to correlate potential triggers with migraine episodes.",
        NSHealthUpdateUsageDescription: "MigraLog may write related health metrics to HealthKit for a comprehensive view of your health data."
      },
      entitlements: {
        "com.apple.developer.usernotifications.time-sensitive": true,
        "com.apple.developer.healthkit": true,
        "com.apple.developer.healthkit.access": [
          "health-records"
        ],
        "com.apple.developer.icloud-container-identifiers": [
          "iCloud.com.eff3.app.headache-tracker"
        ],
        "com.apple.developer.ubiquity-container-identifiers": [
          "iCloud.com.eff3.app.headache-tracker"
        ],
        "com.apple.developer.ubiquity-kvstore-identifier": "$(TeamIdentifierPrefix)com.eff3.app.headache-tracker",
        "com.apple.developer.weatherkit": true
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.eff3.app.headachetracker",
      versionCode: 1
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    plugins: [
      "expo-sqlite",
      [
        "expo-notifications",
        {
          mode: "production"
        }
      ],
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          organization: process.env.SENTRY_ORG || "your-sentry-org",
          project: process.env.SENTRY_PROJECT || "your-sentry-project"
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "88f6f366-51eb-49d6-8908-ed0f317363dd"
      },
      enableTestDeepLinks: true
    }
  }
};
