# Live Activities Setup Guide

This document provides step-by-step instructions for completing the native iOS setup required for Live Activities.

## Prerequisites

- Xcode 14.1+ installed
- iOS 16.1+ deployment target
- Apple Developer account with App Groups capability
- Physical iPhone or iOS 16.1+ simulator for testing

## Overview

Live Activities consist of:
1. **React Native Layer** - Already implemented (LiveActivityService.ts, useLiveActivityIntegration.ts)
2. **Native Bridge** - Provided by react-native-live-activities library
3. **Widget Extension** - Needs to be created in Xcode (THIS DOCUMENT)

## Step 1: Update iOS Deployment Target

1. Open `/app/ios/MigraLog.xcworkspace` in Xcode
2. Select the "MigraLog" project in the navigator
3. Under "Deployment Info", set "Minimum Deployments" to **iOS 16.1**
4. Update Podfile:
   ```ruby
   platform :ios, '16.1'
   ```
5. Run `cd ios && pod install`

## Step 2: Enable Live Activities in Info.plist

1. Open `ios/MigraLog/Info.plist` in Xcode
2. Add the following key:
   ```xml
   <key>NSSupportsLiveActivities</key>
   <true/>
   ```

## Step 3: Configure App Groups

App Groups allow the Widget Extension to share data with the main app.

### Main App Configuration

1. In Xcode, select the "MigraLog" target
2. Go to "Signing & Capabilities"
3. Click "+ Capability"
4. Add "App Groups"
5. Click "+" under App Groups
6. Add identifier: `group.com.eff3.app.headache-tracker.liveactivities`
7. Enable the group

### Update Entitlements

The entitlement file should now include:
```xml
<key>com.apple.security.application-groups</key>
<array>
    <string>group.com.eff3.app.headache-tracker.liveactivities</string>
</array>
```

## Step 4: Create Widget Extension

### 4.1 Add Widget Extension Target

1. In Xcode, File → New → Target
2. Select "Widget Extension"
3. Name: "MigraLogLiveActivity"
4. Product Name: "MigraLogLiveActivity"
5. Language: Swift
6. Minimum Deployment: iOS 16.1
7. Click "Activate" when asked about the scheme

### 4.2 Configure Widget Extension

1. Select the "MigraLogLiveActivity" target
2. Under "Signing & Capabilities":
   - Add "App Groups" capability
   - Enable `group.com.eff3.app.headache-tracker.liveactivities`
3. Set bundle identifier: `com.eff3.app.headache-tracker.MigraLogLiveActivity`
4. Ensure deployment target is iOS 16.1

### 4.3 Configure Info.plist for Widget Extension

Open `MigraLogLiveActivity/Info.plist` and ensure:
```xml
<key>NSExtension</key>
<dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
</dict>
<key>NSSupportsLiveActivities</key>
<true/>
```

## Step 5: Implement Widget Extension Code

### 5.1 Create ActivityAttributes

Create `MigraLogLiveActivity/EpisodeActivityAttributes.swift`:

```swift
import ActivityKit
import Foundation

struct EpisodeActivityAttributes: ActivityAttributes {
    public typealias LiveActivityStatus = ContentState

    public struct ContentState: Codable, Hashable {
        var currentIntensity: Int
        var duration: TimeInterval
        var lastUpdated: Date
    }

    // Static attributes that don't change
    var episodeId: String
    var startTime: Date
}
```

### 5.2 Create Live Activity Widget

Replace content of `MigraLogLiveActivity/MigraLogLiveActivity.swift`:

```swift
import ActivityKit
import WidgetKit
import SwiftUI

@main
struct MigraLogLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EpisodeActivityAttributes.self) { context in
            // Lock Screen / Banner UI
            LockScreenLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here
                DynamicIslandExpandedRegion(.leading) {
                    IntensityIndicator(intensity: context.state.currentIntensity)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    DurationDisplay(startTime: context.attributes.startTime)
                }

                DynamicIslandExpandedRegion(.center) {
                    Text("Migraine Episode")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Button(intent: LogIntensityIntent()) {
                            Label("Log Reading", systemImage: "plus.circle.fill")
                        }
                        .buttonStyle(.borderedProminent)

                        Button(intent: OpenAppIntent()) {
                            Label("Open", systemImage: "arrow.up.right.circle")
                        }
                        .buttonStyle(.bordered)
                    }
                    .padding(.top, 8)
                }
            } compactLeading: {
                // Compact leading (left side of Dynamic Island)
                IntensityDot(intensity: context.state.currentIntensity)
            } compactTrailing: {
                // Compact trailing (right side of Dynamic Island)
                Text(formatDuration(context.state.duration))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            } minimal: {
                // Minimal (when multiple activities are running)
                IntensityDot(intensity: context.state.currentIntensity)
            }
        }
    }
}

// MARK: - Lock Screen View

struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<EpisodeActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "brain.head.profile")
                    .foregroundColor(.purple)

                Text("Migraine Episode")
                    .font(.headline)

                Spacer()

                Text(formatDuration(context.state.duration))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 16) {
                VStack(alignment: .leading) {
                    Text("Intensity")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack(spacing: 4) {
                        Text("\(context.state.currentIntensity)")
                            .font(.title2)
                            .fontWeight(.bold)

                        Text("/ 10")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                IntensityBar(intensity: context.state.currentIntensity)
            }
        }
        .padding()
    }
}

// MARK: - UI Components

struct IntensityDot: View {
    let intensity: Int

    var color: Color {
        switch intensity {
        case 0...3: return .green
        case 4...6: return .yellow
        case 7...8: return .orange
        case 9...10: return .red
        default: return .gray
        }
    }

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 8, height: 8)
    }
}

struct IntensityIndicator: View {
    let intensity: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Intensity")
                .font(.caption2)
                .foregroundColor(.secondary)

            HStack(spacing: 2) {
                Text("\(intensity)")
                    .font(.title3)
                    .fontWeight(.bold)

                Text("/ 10")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct IntensityBar: View {
    let intensity: Int

    var fillColor: Color {
        switch intensity {
        case 0...3: return .green
        case 4...6: return .yellow
        case 7...8: return .orange
        case 9...10: return .red
        default: return .gray
        }
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(height: 8)
                    .cornerRadius(4)

                Rectangle()
                    .fill(fillColor)
                    .frame(width: geometry.size.width * CGFloat(intensity) / 10.0, height: 8)
                    .cornerRadius(4)
            }
        }
        .frame(height: 8)
        .frame(maxWidth: 100)
    }
}

struct DurationDisplay: View {
    let startTime: Date

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text("Duration")
                .font(.caption2)
                .foregroundColor(.secondary)

            Text(startTime, style: .timer)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Helpers

func formatDuration(_ duration: TimeInterval) -> String {
    let hours = Int(duration) / 3600
    let minutes = Int(duration) / 60 % 60

    if hours > 0 {
        return "\(hours)h \(minutes)m"
    } else if minutes > 0 {
        return "\(minutes)m"
    } else {
        return "Just started"
    }
}
```

### 5.3 Create App Intents (Optional - for interactive actions)

Create `MigraLogLiveActivity/AppIntents.swift`:

```swift
import AppIntents
import Foundation

struct LogIntensityIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Intensity"
    static var description = IntentDescription("Open app to log pain intensity")

    func perform() async throws -> some IntentResult {
        // Open app with deep link
        let url = URL(string: "migraine-tracker://log-intensity")!
        await OpenURLIntent(url).perform()
        return .result()
    }
}

struct OpenAppIntent: AppIntent {
    static var title: LocalizedStringResource = "Open App"
    static var description = IntentDescription("Open MigraLog app")

    func perform() async throws -> some IntentResult {
        let url = URL(string: "migraine-tracker://")!
        await OpenURLIntent(url).perform()
        return .result()
    }
}
```

## Step 6: Update Podfile

Add the widget extension to your Podfile:

```ruby
target 'MigraLogLiveActivity' do
  # No pods needed for basic widget, but if you need shared code:
  # pod 'react-native-live-activities', :path => '../node_modules/react-native-live-activities'
end
```

## Step 7: Configure react-native-live-activities

### 7.1 Update app.config.js

Add Live Activities configuration:

```javascript
ios: {
  // ... existing config
  infoPlist: {
    // ... existing keys
    NSSupportsLiveActivities: true,
  },
  entitlements: {
    // ... existing entitlements
    "com.apple.security.application-groups": [
      "group.com.eff3.app.headache-tracker.liveactivities"
    ],
  },
},
```

### 7.2 Link the native module

```bash
cd ios
pod install
cd ..
```

## Step 8: Test

### 8.1 Build and Run

1. Select "MigraLog" scheme in Xcode
2. Choose iOS 16.1+ simulator or device
3. Build and run (Cmd+R)

### 8.2 Test Live Activity

1. Start a new migraine episode in the app
2. Lock your device or go to home screen
3. You should see the Live Activity on the Lock Screen
4. On iPhone 14 Pro+, check the Dynamic Island
5. Log an intensity reading - Live Activity should update
6. End the episode - Live Activity should dismiss

### 8.3 Debug Widget Extension

If the widget doesn't appear:
1. Product → Scheme → Edit Scheme
2. Select "MigraLogLiveActivity" scheme
3. Run the widget extension directly to debug
4. Check Xcode console for errors

## Common Issues

### Widget not appearing
- Verify iOS version is 16.1+
- Check that NSSupportsLiveActivities is true in both Info.plist files
- Ensure App Groups are configured correctly
- Check device settings: Settings → Live Activities (should be enabled)

### Build errors
- Clean build folder: Product → Clean Build Folder
- Delete derived data: ~/Library/Developer/Xcode/DerivedData
- Run `pod install` again
- Restart Xcode

### Activities not updating
- Verify App Group identifier matches in both targets
- Check that react-native-live-activities is properly linked
- Ensure you're calling updateActivity with correct activity ID
- Check logs for errors: `logger.log` output

## Testing Checklist

- [ ] Live Activity appears when episode starts
- [ ] Intensity updates reflect in real-time
- [ ] Duration timer updates every minute
- [ ] Lock Screen view displays correctly
- [ ] Dynamic Island (iPhone 14 Pro+) compact view works
- [ ] Dynamic Island expanded view works
- [ ] Activity dismisses when episode ends
- [ ] Activity persists across app restarts
- [ ] No PHI is displayed in Live Activity
- [ ] Deep links work from Live Activity actions

## HIPAA Compliance Verification

Ensure the Live Activity UI shows ONLY:
- Generic "Migraine Episode" text (no specific symptoms)
- Duration (time elapsed)
- Intensity level (0-10 number)
- Generic action buttons

Should NOT show:
- Specific symptoms, triggers, or medications
- Location information
- Patient-identifiable information
- Detailed medical data

## Resources

- [Apple Live Activities Documentation](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)
- [react-native-live-activities GitHub](https://github.com/achorein/react-native-live-activities)
- [WidgetKit Documentation](https://developer.apple.com/documentation/widgetkit)
- [Dynamic Island Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/live-activities)
