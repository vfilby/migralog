#!/bin/bash

# iOS Simulator Files.app Utility
# Prompts user to select a simulator and opens the Files.app local storage directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📱 iOS Simulator Files.app Utility${NC}"
echo "This utility helps you access files saved to the iOS Files app in simulators."
echo ""

# Get list of booted simulators
echo -e "${YELLOW}Checking for booted simulators...${NC}"
BOOTED_SIMULATORS=$(xcrun simctl list devices | grep "(Booted)" | sed 's/^[[:space:]]*//')

if [ -z "$BOOTED_SIMULATORS" ]; then
    echo -e "${RED}❌ No booted simulators found!${NC}"
    echo "Please start a simulator and try again."
    exit 1
fi

echo -e "${GREEN}Found booted simulators:${NC}"
echo ""

# Create arrays to store simulator info
declare -a SIM_NAMES
declare -a SIM_IDS

# Parse simulators and store in arrays
INDEX=1
while IFS= read -r line; do
    # Extract name and ID from format: "iPhone 15 Pro Max (DEVICE-ID) (Booted)"
    SIM_NAME=$(echo "$line" | sed 's/ ([^)]*) (Booted)//')
    SIM_ID=$(echo "$line" | sed -n 's/.*(\([^)]*\)) (Booted).*/\1/p')
    
    echo -e "${BLUE}$INDEX)${NC} $SIM_NAME"
    echo -e "   ${YELLOW}ID:${NC} $SIM_ID"
    echo ""
    
    SIM_NAMES[$INDEX]="$SIM_NAME"
    SIM_IDS[$INDEX]="$SIM_ID"
    
    ((INDEX++))
done <<< "$BOOTED_SIMULATORS"

TOTAL_SIMS=$((INDEX - 1))

# Prompt user to select simulator
if [ $TOTAL_SIMS -eq 1 ]; then
    echo -e "${GREEN}Only one simulator found. Using: ${SIM_NAMES[1]}${NC}"
    SELECTED_INDEX=1
else
    echo -e "${YELLOW}Please select a simulator (1-$TOTAL_SIMS):${NC}"
    read -r SELECTED_INDEX
    
    # Validate selection
    if [[ ! "$SELECTED_INDEX" =~ ^[0-9]+$ ]] || [ "$SELECTED_INDEX" -lt 1 ] || [ "$SELECTED_INDEX" -gt $TOTAL_SIMS ]; then
        echo -e "${RED}❌ Invalid selection. Please enter a number between 1 and $TOTAL_SIMS.${NC}"
        exit 1
    fi
fi

SELECTED_NAME="${SIM_NAMES[$SELECTED_INDEX]}"
SELECTED_ID="${SIM_IDS[$SELECTED_INDEX]}"

echo ""
echo -e "${GREEN}✅ Selected: $SELECTED_NAME${NC}"
echo -e "${YELLOW}Device ID: $SELECTED_ID${NC}"
echo ""

# Get Files.app info from the selected simulator
echo -e "${YELLOW}Getting Files.app information...${NC}"
FILES_APP_INFO=$(xcrun simctl listapps "$SELECTED_ID" | grep -A 20 '"com.apple.DocumentsApp"')

if [ -z "$FILES_APP_INFO" ]; then
    echo -e "${RED}❌ Could not find Files.app on the selected simulator.${NC}"
    exit 1
fi

# Extract the FileProvider.LocalStorage path
LOCAL_STORAGE_PATH=$(echo "$FILES_APP_INFO" | grep '"group.com.apple.FileProvider.LocalStorage"' | sed 's/.*"file:\/\/\([^"]*\)".*/\1/')

if [ -z "$LOCAL_STORAGE_PATH" ]; then
    echo -e "${RED}❌ Could not find FileProvider.LocalStorage path.${NC}"
    exit 1
fi

# Convert URL encoding if present
LOCAL_STORAGE_PATH=$(echo "$LOCAL_STORAGE_PATH" | sed 's/%20/ /g')

echo -e "${GREEN}✅ Files.app Local Storage found:${NC}"
echo -e "${BLUE}$LOCAL_STORAGE_PATH${NC}"
echo ""

# Check if path exists
if [ ! -d "$LOCAL_STORAGE_PATH" ]; then
    echo -e "${RED}❌ Directory does not exist: $LOCAL_STORAGE_PATH${NC}"
    exit 1
fi

# List contents
echo -e "${YELLOW}Contents of Files.app Local Storage:${NC}"
ls -la "$LOCAL_STORAGE_PATH" 2>/dev/null || echo "Directory is empty or inaccessible"
echo ""

# Offer to open in Finder
echo -e "${YELLOW}Would you like to open this directory in Finder? (y/n):${NC}"
read -r OPEN_FINDER

if [[ "$OPEN_FINDER" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}🗂️  Opening in Finder...${NC}"
    open "$LOCAL_STORAGE_PATH"
else
    echo -e "${BLUE}📋 Path copied to clipboard (if pbcopy is available):${NC}"
    echo "$LOCAL_STORAGE_PATH" | pbcopy 2>/dev/null || true
    echo "$LOCAL_STORAGE_PATH"
fi

echo ""
echo -e "${GREEN}✅ Done!${NC}"