#!/bin/bash

# Debug Archive Unpacking Utility
# Unpacks debug archives and restores databases to iOS Simulators for investigation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔓 Debug Archive Unpacking Utility${NC}"
echo "This utility unpacks debug archives and restores databases to simulators for investigation."
echo ""

# Check if we have required tools
echo -e "${YELLOW}Checking required tools...${NC}"
if ! command -v unzip &> /dev/null; then
    echo -e "${RED}❌ unzip is required but not installed${NC}"
    exit 1
fi

if ! command -v xcrun &> /dev/null; then
    echo -e "${RED}❌ Xcode command line tools are required but not found${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is required but not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All required tools found${NC}"
echo ""

# Get archive file path
if [ $# -eq 0 ]; then
    echo -e "${YELLOW}Please provide the path to the debug archive ZIP file:${NC}"
    read -r ARCHIVE_PATH
else
    ARCHIVE_PATH="$1"
fi

# Validate archive file
if [ ! -f "$ARCHIVE_PATH" ]; then
    echo -e "${RED}❌ Archive file not found: $ARCHIVE_PATH${NC}"
    exit 1
fi

if [[ ! "$ARCHIVE_PATH" =~ \.zip$ ]]; then
    echo -e "${RED}❌ File must be a ZIP archive: $ARCHIVE_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Archive file found: $ARCHIVE_PATH${NC}"
echo ""

# Create temporary extraction directory
TEMP_DIR=$(mktemp -d -t debug_archive_XXXXXX)
echo -e "${YELLOW}Extracting archive to temporary directory...${NC}"
echo -e "${BLUE}$TEMP_DIR${NC}"

# Extract archive
unzip -q "$ARCHIVE_PATH" -d "$TEMP_DIR"

# Verify archive contents
REQUIRED_FILES=("metadata.json" "database.json" "logs.json" "notifications.json" "mappings.json")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$TEMP_DIR/$file" ]; then
        echo -e "${RED}❌ Invalid archive: missing $file${NC}"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
done

echo -e "${GREEN}✅ Archive extracted successfully${NC}"
echo ""

# Read archive metadata
echo -e "${YELLOW}Reading archive metadata...${NC}"
METADATA=$(node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('$TEMP_DIR/metadata.json', 'utf8')), null, 2))")
echo -e "${BLUE}Archive Information:${NC}"
echo "$METADATA" | head -10
echo ""

# Get list of booted simulators
echo -e "${YELLOW}Checking for booted simulators...${NC}"
BOOTED_SIMULATORS=$(xcrun simctl list devices | grep "(Booted)" | sed 's/^[[:space:]]*//')

if [ -z "$BOOTED_SIMULATORS" ]; then
    echo -e "${RED}❌ No booted simulators found!${NC}"
    echo "Please start a simulator and try again."
    rm -rf "$TEMP_DIR"
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
        rm -rf "$TEMP_DIR"
        exit 1
    fi
fi

SELECTED_NAME="${SIM_NAMES[$SELECTED_INDEX]}"
SELECTED_ID="${SIM_IDS[$SELECTED_INDEX]}"

echo ""
echo -e "${GREEN}✅ Selected: $SELECTED_NAME${NC}"
echo -e "${YELLOW}Device ID: $SELECTED_ID${NC}"
echo ""

# Find MigraineTracker app data directory
echo -e "${YELLOW}Finding MigraineTracker app directory...${NC}"
MIGRALOG_DB_PATH=$(find ~/Library/Developer/CoreSimulator/Devices/"$SELECTED_ID"/data/Containers/Data/Application -name "migralog.db" 2>/dev/null | head -1)
MIGRALOG_APP_DIR=$(dirname "$(dirname "$MIGRALOG_DB_PATH")")

if [ -z "$MIGRALOG_APP_DIR" ]; then
    echo -e "${RED}❌ Could not find MigraineTracker app directory in selected simulator${NC}"
    echo "Please ensure MigraineTracker is installed and has been run at least once."
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo -e "${GREEN}✅ Found MigraineTracker app directory:${NC}"
echo -e "${BLUE}$MIGRALOG_APP_DIR${NC}"
echo ""

# Check if database exists in archive
DB_SNAPSHOT=$(node -e "
const data = JSON.parse(require('fs').readFileSync('$TEMP_DIR/database.json', 'utf8'));
console.log(data.fullSnapshot ? 'exists' : 'empty');
")

if [ "$DB_SNAPSHOT" = "empty" ]; then
    echo -e "${YELLOW}⚠️  No database snapshot found in archive${NC}"
    echo "The archive was created without including the full database."
    echo ""
    echo -e "${YELLOW}Available actions:${NC}"
    echo "1) View logs and other debug info"
    echo "2) Exit"
    echo ""
    echo -e "${YELLOW}What would you like to do? (1-2):${NC}"
    read -r ACTION_CHOICE
    
    if [ "$ACTION_CHOICE" = "1" ]; then
        echo -e "${BLUE}Opening temporary directory in Finder...${NC}"
        open "$TEMP_DIR"
        echo -e "${GREEN}✅ Debug files are available for manual inspection${NC}"
        echo -e "${YELLOW}Note: Temporary directory will be cleaned up when you close this terminal${NC}"
        # Don't clean up yet, let user inspect
        exit 0
    else
        rm -rf "$TEMP_DIR"
        exit 0
    fi
fi

# Offer options for database restoration
echo -e "${YELLOW}Database restoration options:${NC}"
echo "1) Replace current database (⚠️  Will backup current database first)"
echo "2) View debug info without database restoration"
echo "3) Exit without changes"
echo ""
echo -e "${YELLOW}What would you like to do? (1-3):${NC}"
read -r RESTORE_CHOICE

case $RESTORE_CHOICE in
    1)
        echo -e "${YELLOW}🔄 Preparing to restore database...${NC}"
        
        # Create backup of current database
        CURRENT_TIME=$(date +"%Y%m%d_%H%M%S")
        BACKUP_NAME="backup_before_debug_restore_$CURRENT_TIME.db"
        BACKUP_PATH="$MIGRALOG_APP_DIR/backups/$BACKUP_NAME"
        
        echo -e "${YELLOW}Creating backup of current database...${NC}"
        mkdir -p "$MIGRALOG_APP_DIR/backups"
        cp "$MIGRALOG_DB_PATH" "$BACKUP_PATH" 2>/dev/null || {
            echo -e "${RED}❌ Failed to backup current database${NC}"
            rm -rf "$TEMP_DIR"
            exit 1
        }
        
        echo -e "${GREEN}✅ Current database backed up to: $BACKUP_NAME${NC}"
        
        # Extract and restore database from archive
        echo -e "${YELLOW}Restoring database from archive...${NC}"
        node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('$TEMP_DIR/database.json', 'utf8'));
        const dbData = Buffer.from(data.fullSnapshot, 'base64');
        fs.writeFileSync('$TEMP_DIR/restored_migralog.db', dbData);
        "
        
        # Copy restored database to app directory
        cp "$TEMP_DIR/restored_migralog.db" "$MIGRALOG_DB_PATH"
        
        echo -e "${GREEN}✅ Database restored successfully!${NC}"
        echo -e "${PURPLE}📱 Please restart the MigraineTracker app to see the restored data${NC}"
        ;;
    2)
        echo -e "${BLUE}Opening debug files for inspection...${NC}"
        open "$TEMP_DIR"
        echo -e "${GREEN}✅ Debug files are available for manual inspection${NC}"
        echo -e "${YELLOW}Note: Temporary directory will be cleaned up when you close this terminal${NC}"
        # Don't clean up yet, let user inspect
        exit 0
        ;;
    3)
        echo -e "${GREEN}Exiting without changes${NC}"
        rm -rf "$TEMP_DIR"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid selection${NC}"
        rm -rf "$TEMP_DIR"
        exit 1
        ;;
esac

# Summary and instructions
echo ""
echo -e "${GREEN}🎉 Debug Archive Restoration Complete!${NC}"
echo ""
echo -e "${YELLOW}What was restored:${NC}"
echo "• Database snapshot restored to simulator"
echo "• Previous database backed up for safety"
echo "• Debug files available for inspection"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. ${PURPLE}Restart MigraineTracker app${NC} to load restored data"
echo "2. ${PURPLE}Investigate the issue${NC} with the restored state"
echo "3. ${PURPLE}Check logs/notifications${NC} using the debug files"
echo ""
echo -e "${YELLOW}Debug files location:${NC}"
echo -e "${BLUE}$TEMP_DIR${NC}"
echo ""
echo -e "${YELLOW}Would you like to open the debug files folder? (y/n):${NC}"
read -r OPEN_DEBUG

if [[ "$OPEN_DEBUG" =~ ^[Yy]$ ]]; then
    open "$TEMP_DIR"
fi

echo ""
echo -e "${GREEN}✅ All done!${NC}"
echo -e "${YELLOW}Note: Temporary files will be cleaned up when this terminal session ends${NC}"

# Keep temp directory available for this session
trap "rm -rf $TEMP_DIR" EXIT