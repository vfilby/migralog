#!/bin/bash

# Get list of booted simulators only
BOOTED_SIMS=$(xcrun simctl list devices | grep "iPhone" | grep "Booted" | sed 's/^ *//')

# Count booted simulators
SIM_COUNT=$(echo "$BOOTED_SIMS" | grep -c "Booted" || true)

if [ "$SIM_COUNT" -eq 0 ]; then
  echo "❌ No iPhone simulators are currently running."
  echo ""
  echo "Please start a simulator first using one of these methods:"
  echo "  1. Open Xcode → Window → Devices and Simulators → Select a device → Click 'Open'"
  echo "  2. Run: open -a Simulator"
  echo "  3. Run: xcrun simctl boot '<device-name>'"
  exit 1
fi

# Show list of running simulators
echo "Running iPhone simulators:"
echo ""

# Create array of simulator info
INDEX=1
declare -a SIM_NAMES
declare -a SIM_UDIDS

while IFS= read -r line; do
  if [ -n "$line" ]; then
    NAME=$(echo "$line" | sed -E 's/(.+) \([A-F0-9-]+\) \(Booted\).*/\1/')
    UDID=$(echo "$line" | sed -E 's/.+\(([A-F0-9-]+)\) \(Booted\).*/\1/')

    SIM_NAMES+=("$NAME")
    SIM_UDIDS+=("$UDID")

    echo "  [$INDEX] $NAME"
    INDEX=$((INDEX + 1))
  fi
done <<< "$BOOTED_SIMS"

echo ""
echo -n "Select simulator (1-$SIM_COUNT): "
read SELECTION

# Validate selection
if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -lt 1 ] || [ "$SELECTION" -gt "$SIM_COUNT" ]; then
  echo "❌ Invalid selection. Please enter a number between 1 and $SIM_COUNT"
  exit 1
fi

# Get selected simulator (arrays are 0-indexed)
SELECTED_INDEX=$((SELECTION - 1))
SELECTED_NAME="${SIM_NAMES[$SELECTED_INDEX]}"
SELECTED_UDID="${SIM_UDIDS[$SELECTED_INDEX]}"

echo ""
echo "✅ Selected: $SELECTED_NAME"
echo ""

# Check if app binary exists
BUNDLE_ID="com.eff3.app.headache-tracker"
APP_BINARY="ios/build/Build/Products/Debug-iphonesimulator/MigraLog.app"

if [ ! -d "$APP_BINARY" ]; then
  echo "⚠️  App binary not found at $APP_BINARY"
  echo ""
  echo -n "Would you like to build the app? (y/n): "
  read BUILD_CHOICE

  if [[ "$BUILD_CHOICE" =~ ^[Yy]$ ]]; then
    echo ""
    echo "📦 Building development app (this may take a few minutes)..."
    npm run test:e2e:build

    if [ $? -ne 0 ]; then
      echo "❌ Build failed"
      exit 1
    fi

    echo ""
    echo "✅ Build complete!"
  else
    echo ""
    echo "❌ App not built. Run 'npm run test:e2e:build' to build it."
    exit 1
  fi
fi

echo "📲 Installing app on simulator..."
xcrun simctl install "$SELECTED_UDID" "$APP_BINARY"

if [ $? -ne 0 ]; then
  echo "❌ Failed to install app"
  exit 1
fi

echo "🚀 Launching app..."
echo ""

# Launch the app using bundle ID - it will auto-connect to dev server on 8081
xcrun simctl launch "$SELECTED_UDID" "$BUNDLE_ID"

if [ $? -eq 0 ]; then
  echo "✓ App launched on $SELECTED_NAME"
  echo ""
  echo "The app should automatically connect to the Expo dev server on port 8081"
else
  echo "❌ Failed to launch app"
  exit 1
fi

echo ""
echo "If the app doesn't connect:"
echo "  • Make sure Expo is running (npm start)"
echo "  • The dev server should be on port 8081"
echo "  • Shake the device and select 'Configure Metro' if needed"
echo ""
echo "Simulator UDID: $SELECTED_UDID"
