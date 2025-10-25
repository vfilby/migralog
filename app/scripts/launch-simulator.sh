#!/bin/bash

# Get list of booted simulators
BOOTED_SIMS=$(xcrun simctl list devices | grep "Booted" | sed 's/^ *//')

# Count booted simulators
SIM_COUNT=$(echo "$BOOTED_SIMS" | grep -c "Booted" || true)

if [ "$SIM_COUNT" -eq 0 ]; then
  echo "❌ No simulators are currently running."
  echo ""
  echo "Please start a simulator first using one of these methods:"
  echo "  1. Open Xcode → Window → Devices and Simulators → Select a device → Click 'Open'"
  echo "  2. Run: open -a Simulator"
  echo "  3. Run: xcrun simctl boot '<device-name>'"
  exit 1
fi

if [ "$SIM_COUNT" -eq 1 ]; then
  # Only one simulator running, use it automatically
  SIM_NAME=$(echo "$BOOTED_SIMS" | sed -E 's/(.+) \([A-F0-9-]+\) \(Booted\).*/\1/')
  SIM_UDID=$(echo "$BOOTED_SIMS" | sed -E 's/.+\(([A-F0-9-]+)\) \(Booted\).*/\1/')

  echo "✅ Found 1 running simulator:"
  echo "   $SIM_NAME"
  echo ""
  echo "🚀 Launching app..."
  echo ""

  # Export UDID for Expo to use
  export EXPO_IOS_SIMULATOR_DEVICE_UDID="$SIM_UDID"

  # Run expo
  npm run generate-build-info && npx expo start --ios --dev-client
else
  # Multiple simulators running, ask user to select
  echo "Found $SIM_COUNT running simulators:"
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
  echo "🚀 Launching app..."
  echo ""

  # Export UDID for Expo to use
  export EXPO_IOS_SIMULATOR_DEVICE_UDID="$SELECTED_UDID"

  # Run expo
  npm run generate-build-info && npx expo start --ios --dev-client
fi
