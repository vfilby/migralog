#!/bin/bash
set -e

# Parse configuration argument (defaults to Testing)
CONFIGURATION="Testing"
if [[ "$1" == "--configuration" ]] && [[ -n "$2" ]]; then
  CONFIGURATION="$2"
fi

echo "Building iOS app for Detox testing (Configuration: $CONFIGURATION)..."

# Step 1: Run prebuild to create native ios directory
echo "Running expo prebuild..."
npx expo prebuild --platform ios --clean

# Step 2: Install CocoaPods dependencies
echo "Installing CocoaPods dependencies..."
cd ios
pod install
cd ..

# Step 3: Build with xcodebuild (without launching)
echo "Building with xcodebuild..."
# Debug: Development with all debugging features
# Testing: Production-optimized but with test hooks enabled
# Release: True production, zero test code
xcodebuild \
  -workspace ios/MigraLog.xcworkspace \
  -scheme MigraLog \
  -configuration "$CONFIGURATION" \
  -sdk iphonesimulator \
  -derivedDataPath ios/build \
  -destination "generic/platform=iOS Simulator" \
  build

echo "✅ Build complete! ($CONFIGURATION)"
