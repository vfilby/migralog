# iOS Capabilities Management Guide

This guide explains how to add new iOS capabilities (like HealthKit, WeatherKit, Time-Sensitive Notifications) to the MigraLog app using EAS and the Apple Developer Portal.

## Why This Process Exists

When you manually configure capabilities in the Apple Developer Portal, Expo can overwrite those settings when it regenerates provisioning profiles. To prevent this, we manage capabilities in both places and let EAS sync them.

## Process for Adding New iOS Capabilities

### Step 1: Remove Existing Provisioning Profile

Remove the current provisioning profile so EAS will generate a fresh one with updated capabilities:

```bash
cd app
eas credentials
```

Interactive menu:
1. Select platform: **iOS**
2. Select: **Provisioning Profile** → **Remove Provisioning Profile**
3. Confirm the removal

Optional: You can also remove the Distribution Certificate for a completely fresh start, but this is usually not necessary.

### Step 2: Add Entitlements to app.json

Add the capability entitlements to `app/app.json` under `ios.entitlements`:

```json
{
  "expo": {
    "ios": {
      "entitlements": {
        "com.apple.developer.usernotifications.time-sensitive": true,
        "com.apple.developer.healthkit": true,
        "com.apple.developer.weatherkit": true,
        "com.apple.developer.icloud-container-identifiers": [
          "iCloud.com.eff3.app.headache-tracker"
        ]
      }
    }
  }
}
```

**Important Notes:**
- Use concrete values, not Xcode variables like `$(CFBundleIdentifier)` - EAS doesn't support these
- Use the actual bundle identifier: `com.eff3.app.headache-tracker`
- For Team Identifier Prefix, use the actual team ID (e.g., `ABC123XYZ.com.eff3.app.headache-tracker`)

Commit the changes:
```bash
git add app/app.json
git commit -m "feat: add [capability name] entitlement"
```

### Step 3: Configure App ID in Apple Developer Portal

1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select **Identifiers** → Find your app: `com.eff3.app.headache-tracker`
4. Enable the new capabilities:
   - Scroll down to find the capability (e.g., "HealthKit", "WeatherKit", "Time Sensitive Notifications")
   - Check the box to enable it
   - Configure any additional settings if required (e.g., iCloud containers)
5. Click **Save**

### Step 4: Regenerate Provisioning Profile with EAS

Trigger a new build, which will automatically generate a new provisioning profile with the updated capabilities:

```bash
cd app
eas build --platform ios --profile preview
```

Or use your preferred build profile:
```bash
eas build --platform ios --profile development
```

**What happens:**
1. EAS detects the provisioning profile is missing
2. Reads the App ID configuration from Apple Developer Portal
3. Reads the entitlements from `app.json`
4. Generates a new provisioning profile that includes all enabled capabilities
5. Stores credentials securely in EAS

### Step 5: Verify the Configuration

After the build completes, verify the provisioning profile includes your capabilities:

```bash
eas credentials
```

Select **iOS** → **Provisioning Profile** → **Download Provisioning Profile**, then inspect it to confirm capabilities are included.

## Common Capabilities and Their Entitlements

### Time-Sensitive Notifications
```json
"com.apple.developer.usernotifications.time-sensitive": true
```
- Allows notifications to break through Focus mode
- Required for critical medication reminders

### HealthKit
```json
"com.apple.developer.healthkit": true,
"com.apple.developer.healthkit.access": ["health-records"]
```
- Access to sleep data, vitals (heart rate, blood pressure)
- Requires NSHealthShareUsageDescription in infoPlist

### iCloud
```json
"com.apple.developer.icloud-container-identifiers": [
  "iCloud.com.eff3.app.headache-tracker"
],
"com.apple.developer.ubiquity-container-identifiers": [
  "iCloud.com.eff3.app.headache-tracker"
],
"com.apple.developer.ubiquity-kvstore-identifier": "[TeamID].com.eff3.app.headache-tracker"
```
- Cross-device data syncing
- CloudKit database access

### WeatherKit
```json
"com.apple.developer.weatherkit": true
```
- Access to Apple's weather data API
- Track barometric pressure (migraine trigger)
- Requires Apple Developer Program membership

## Troubleshooting

### Error: "Cannot copy a socket file"
If you get a socket file error during EAS upload, the Beads daemon is running:
```bash
bd daemon --stop
```

The `.easignore` file should prevent this, but stopping the daemon ensures it.

### Error: "Invalid value '$(CFBundleIdentifier)'"
Replace Xcode variables with concrete values in `app.json`:
- ❌ `$(CFBundleIdentifier)`
- ✅ `com.eff3.app.headache-tracker`

### Capability Not Working on Device
1. Verify the capability is enabled in Apple Developer Portal
2. Verify the entitlement is in `app.json`
3. Rebuild with EAS to regenerate the provisioning profile
4. Test on physical device (some features don't work in simulator)

## Reference

- [Expo Entitlements Documentation](https://docs.expo.dev/versions/latest/config/app/#entitlements)
- [Apple Entitlements Reference](https://developer.apple.com/documentation/bundleresources/entitlements)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
