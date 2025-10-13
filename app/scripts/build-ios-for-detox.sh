#!/bin/bash
set -e

echo "Building iOS app for Detox testing..."

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
# Use Release configuration to ensure JS bundle is embedded (required for Detox)
xcodebuild \
  -workspace ios/MigraLog.xcworkspace \
  -scheme MigraLog \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath ios/build \
  -destination "generic/platform=iOS Simulator" \
  build

echo "✅ Build complete!"
