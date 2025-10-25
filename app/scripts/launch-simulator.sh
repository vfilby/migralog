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
echo "🚀 Opening app on simulator..."
echo ""

# Use the custom app scheme for development builds
# This assumes Expo is running on the default port 8081
xcrun simctl openurl "$SELECTED_UDID" "migraine-tracker://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"

echo "✓ App opened on $SELECTED_NAME"
echo ""
echo "If the app doesn't open:"
echo "  • Make sure Expo is running (npm start)"
echo "  • Make sure you have a development build installed"
echo "  • The dev server should be on port 8081"
echo ""
echo "Simulator UDID: $SELECTED_UDID"
