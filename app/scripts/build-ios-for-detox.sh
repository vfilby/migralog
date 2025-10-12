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
xcodebuild \
  -workspace ios/MigraineTracker.xcworkspace \
  -scheme MigraineTracker \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath ios/build \
  -destination "platform=iOS Simulator,name=iPhone 16 Pro Max" \
  build

echo "✅ Build complete!"
