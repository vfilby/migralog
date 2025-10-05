#!/bin/bash

# Icon processing script for Migraine Tracker
# Requires ImageMagick (install with: brew install imagemagick)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🎨 Icon Processing Script${NC}"
echo ""

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo -e "${RED}❌ ImageMagick is not installed${NC}"
    echo ""
    echo "Please install ImageMagick:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
ASSETS_DIR="$PROJECT_ROOT/assets"

# Check if source icon is provided as argument
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <source-icon-path>${NC}"
    echo ""
    echo "Example: $0 ~/Downloads/icon.png"
    echo ""
    echo "The source icon should be at least 1024x1024 pixels"
    exit 1
fi

SOURCE_ICON="$1"

# Check if source file exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo -e "${RED}❌ Source icon not found: $SOURCE_ICON${NC}"
    exit 1
fi

echo -e "${GREEN}📁 Source icon: $SOURCE_ICON${NC}"
echo -e "${GREEN}📁 Assets directory: $ASSETS_DIR${NC}"
echo ""

# Create assets directory if it doesn't exist
mkdir -p "$ASSETS_DIR"

# Process icons
echo "🔄 Processing app icon (1024x1024)..."
convert "$SOURCE_ICON" -resize 1024x1024 "$ASSETS_DIR/icon.png"

echo "🔄 Processing adaptive icon (1024x1024)..."
convert "$SOURCE_ICON" -resize 1024x1024 "$ASSETS_DIR/adaptive-icon.png"

echo "🔄 Processing splash icon (1024x1024)..."
convert "$SOURCE_ICON" -resize 1024x1024 "$ASSETS_DIR/splash-icon.png"

echo "🔄 Processing favicon (192x192)..."
convert "$SOURCE_ICON" -resize 192x192 "$ASSETS_DIR/favicon.png"

echo ""
echo -e "${GREEN}✅ All icons processed successfully!${NC}"
echo ""
echo "Generated files:"
echo "  - $ASSETS_DIR/icon.png (1024x1024)"
echo "  - $ASSETS_DIR/adaptive-icon.png (1024x1024)"
echo "  - $ASSETS_DIR/splash-icon.png (1024x1024)"
echo "  - $ASSETS_DIR/favicon.png (192x192)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Run: npx expo prebuild --clean"
echo "  2. Rebuild your app"
