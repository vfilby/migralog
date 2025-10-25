#!/bin/bash

# Get list of all available simulators
ALL_SIMS=$(xcrun simctl list devices available | grep "iPhone" | sed 's/^ *//')

# Count available simulators
SIM_COUNT=$(echo "$ALL_SIMS" | wc -l | xargs)

if [ "$SIM_COUNT" -eq 0 ]; then
  echo "❌ No iPhone simulators found."
  echo ""
  echo "Please install iOS simulators via Xcode."
  exit 1
fi

# Show list of simulators
echo "Available iPhone simulators:"
echo ""

# Create array of simulator info
INDEX=1
declare -a SIM_NAMES
declare -a SIM_UDIDS

while IFS= read -r line; do
  if [ -n "$line" ]; then
    NAME=$(echo "$line" | sed -E 's/(.+) \([A-F0-9-]+\) \(.*/\1/')
    UDID=$(echo "$line" | sed -E 's/.+\(([A-F0-9-]+)\).*/\1/')
    STATUS=$(echo "$line" | grep -o "(Booted)" || echo "(Shutdown)")

    SIM_NAMES+=("$NAME")
    SIM_UDIDS+=("$UDID")

    if [[ "$STATUS" == "(Booted)" ]]; then
      echo "  [$INDEX] $NAME ✓ (Running)"
    else
      echo "  [$INDEX] $NAME"
    fi
    INDEX=$((INDEX + 1))
  fi
done <<< "$ALL_SIMS"

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

# Check if simulator is already booted
if xcrun simctl list devices | grep "$SELECTED_UDID" | grep -q "Booted"; then
  echo "✓ Simulator already running"
else
  echo "🚀 Booting simulator..."
  xcrun simctl boot "$SELECTED_UDID"
  open -a Simulator
  echo "✓ Simulator booted"
fi

echo ""
echo "Simulator UDID: $SELECTED_UDID"
echo ""
echo "To launch the app, run in a separate terminal:"
echo "  export EXPO_IOS_SIMULATOR_DEVICE_UDID=$SELECTED_UDID"
echo "  npm start"
