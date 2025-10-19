#!/bin/bash

# Load Test Database Script
# Usage: npm run test:load-db /path/to/database.db
# or: ./scripts/load-test-db.sh /path/to/database.db

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if database file path is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Database file path required${NC}"
    echo "Usage: npm run test:load-db /path/to/database.db"
    exit 1
fi

DB_FILE="$1"

# Check if file exists
if [ ! -f "$DB_FILE" ]; then
    echo -e "${RED}Error: Database file not found: $DB_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}Loading test database into simulator...${NC}"
echo -e "Source: ${GREEN}$DB_FILE${NC}"

# Get the app's bundle identifier
BUNDLE_ID="com.eff3.app.headache-tracker"

# Get booted simulator UUID
echo -e "${BLUE}Finding booted simulator...${NC}"
SIMULATOR_UUID=$(xcrun simctl list devices booted | grep "iPhone" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')

if [ -z "$SIMULATOR_UUID" ]; then
    echo -e "${RED}Error: No booted simulator found${NC}"
    echo "Please start the iOS simulator first with: npm run ios"
    exit 1
fi

echo -e "${GREEN}Found simulator: $SIMULATOR_UUID${NC}"

# Find the app's data directory
echo -e "${BLUE}Finding app data directory...${NC}"
APP_DATA_DIR=$(xcrun simctl get_app_container "$SIMULATOR_UUID" "$BUNDLE_ID" data 2>/dev/null)

if [ -z "$APP_DATA_DIR" ]; then
    echo -e "${RED}Error: App not installed on simulator${NC}"
    echo "Please build and run the app first with: npm run ios"
    exit 1
fi

echo -e "${GREEN}App data directory: $APP_DATA_DIR${NC}"

# SQLite database location
DB_DIR="$APP_DATA_DIR/Documents/SQLite"
TARGET_DB="$DB_DIR/migralog.db"

# Create SQLite directory if it doesn't exist
mkdir -p "$DB_DIR"

# Backup existing database if it exists
if [ -f "$TARGET_DB" ]; then
    BACKUP_FILE="$DB_DIR/migralog.backup.$(date +%s).db"
    echo -e "${BLUE}Backing up existing database to: $BACKUP_FILE${NC}"
    cp "$TARGET_DB" "$BACKUP_FILE"
fi

# Copy the test database
echo -e "${BLUE}Copying database file...${NC}"
cp "$DB_FILE" "$TARGET_DB"

# Set proper permissions
chmod 644 "$TARGET_DB"

echo -e "${GREEN}✅ Database loaded successfully!${NC}"
echo -e "${BLUE}Restarting app to apply changes...${NC}"

# Kill the app to force reload
xcrun simctl terminate "$SIMULATOR_UUID" "$BUNDLE_ID" 2>/dev/null || true

# Wait a moment
sleep 1

# Relaunch the app
xcrun simctl launch "$SIMULATOR_UUID" "$BUNDLE_ID"

echo -e "${GREEN}✅ App restarted with test database${NC}"
echo ""
echo -e "${BLUE}Database location:${NC} $TARGET_DB"
echo -e "${BLUE}Backup location:${NC} $BACKUP_FILE"
echo ""
echo -e "${GREEN}The app is now running with your test database!${NC}"
