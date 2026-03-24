#!/bin/bash

# Trigger Onboarding Flow Script
# Resets onboarding state and navigates to welcome screen for development/testing

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Triggering onboarding flow...${NC}"

# Get list of booted simulators only
echo -e "${BLUE}Finding booted simulators...${NC}"
BOOTED_SIMS=$(xcrun simctl list devices | grep "iPhone" | grep "Booted" | sed 's/^ *//')

# Count booted simulators
SIM_COUNT=$(echo "$BOOTED_SIMS" | grep -c "Booted" || true)

if [ "$SIM_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ No iPhone simulators are currently running.${NC}"
    echo ""
    echo "Please start a simulator first using one of these methods:"
    echo "  1. Open Xcode → Window → Devices and Simulators → Select a device → Click 'Open'"
    echo "  2. Run: open -a Simulator"
    echo "  3. Run: xcrun simctl boot '<device-name>'"
    echo "  4. Run: npm run ios"
    exit 1
fi

# If only one simulator, use it automatically
if [ "$SIM_COUNT" -eq 1 ]; then
    SIMULATOR_UDID=$(echo "$BOOTED_SIMS" | sed -E 's/.+\(([A-F0-9-]+)\) \(Booted\).*/\1/')
    SIMULATOR_NAME=$(echo "$BOOTED_SIMS" | sed -E 's/(.+) \([A-F0-9-]+\) \(Booted\).*/\1/')
    echo -e "${GREEN}Using simulator: $SIMULATOR_NAME${NC}"
else
    # Show list of running simulators
    echo ""
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
        echo -e "${RED}❌ Invalid selection. Please enter a number between 1 and $SIM_COUNT${NC}"
        exit 1
    fi

    # Get selected simulator (arrays are 0-indexed)
    SELECTED_INDEX=$((SELECTION - 1))
    SIMULATOR_NAME="${SIM_NAMES[$SELECTED_INDEX]}"
    SIMULATOR_UDID="${SIM_UDIDS[$SELECTED_INDEX]}"

    echo ""
    echo -e "${GREEN}✅ Selected: $SIMULATOR_NAME${NC}"
fi

echo ""
echo -e "${YELLOW}📱 Triggering onboarding flow on $SIMULATOR_NAME...${NC}"

# Open the deep link URL to trigger onboarding
DEEP_LINK_URL="migraine-tracker://test/trigger-onboarding?token=detox"

echo -e "${BLUE}Opening deep link: $DEEP_LINK_URL${NC}"

# Use xcrun simctl to open the URL on the selected simulator
xcrun simctl openurl "$SIMULATOR_UDID" "$DEEP_LINK_URL"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Onboarding flow triggered successfully!${NC}"
    echo ""
    echo -e "${BLUE}What happened:${NC}"
    echo "  • Onboarding state has been reset"
    echo "  • App should now show the Welcome screen"
    echo "  • You can test the full onboarding flow"
    echo ""
    echo -e "${YELLOW}💡 Tip:${NC} If the app doesn't respond immediately, try shaking the simulator and checking the dev menu."
else
    echo -e "${RED}❌ Failed to trigger onboarding flow${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Make sure the app is installed and running on the simulator"
    echo "  2. Ensure deep link handling is working (dev builds only)"
    echo "  3. Check that you're running a debug build with test features enabled"
    exit 1
fi