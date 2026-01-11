# MigraLog Development Makefile
# Supports running multiple Expo dev servers with random ports to avoid conflicts

# Port range for Metro bundler (19000-19999 is Expo's typical range)
PORT_MIN := 19000
PORT_MAX := 19999

# Generate a random port in the safe range
RANDOM_PORT := $(shell echo $$(( $(PORT_MIN) + RANDOM % ($(PORT_MAX) - $(PORT_MIN) + 1) )))

# Get local IP address (macOS)
LOCAL_IP := $(shell ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

# Log file with timestamp
LOG_FILE := .expo/server-$(shell date +%Y%m%d-%H%M%S).log

.PHONY: server server-ios server-android dev dev-ios dev-android clean test precommit

# ============================================
# Expo Go (for quick testing without a build)
# ============================================

# Start Expo dev server on a random port (Expo Go)
server:
	@echo "Starting Expo Go server on port $(RANDOM_PORT)..."
	@echo "Scan the QR code or press 'i' for iOS simulator, 'a' for Android emulator"
	npx expo start --port $(RANDOM_PORT)

# Start with iOS simulator (Expo Go)
server-ios:
	@echo "Starting Expo Go server on port $(RANDOM_PORT) with iOS simulator..."
	npx expo start --port $(RANDOM_PORT) --ios

# Start with Android emulator (Expo Go)
server-android:
	@echo "Starting Expo Go server on port $(RANDOM_PORT) with Android emulator..."
	npx expo start --port $(RANDOM_PORT) --android

# ============================================
# Development Builds (custom dev client)
# ============================================

# Start dev server for development builds on a random port
dev:
	@mkdir -p .expo
	@echo "Starting dev client server on $(LOCAL_IP):$(RANDOM_PORT)..."
	@echo "Logging to $(LOG_FILE)"
	script -q $(LOG_FILE) env REACT_NATIVE_PACKAGER_HOSTNAME=$(LOCAL_IP) npx expo start --dev-client --port $(RANDOM_PORT)

# Start dev server + launch iOS simulator (development build)
dev-ios:
	@mkdir -p .expo
	@echo "Starting dev client server on $(LOCAL_IP):$(RANDOM_PORT) with iOS simulator..."
	@echo "Logging to $(LOG_FILE)"
	script -q $(LOG_FILE) env REACT_NATIVE_PACKAGER_HOSTNAME=$(LOCAL_IP) npx expo start --dev-client --port $(RANDOM_PORT) --ios

# Start dev server + launch Android emulator (development build)
dev-android:
	@mkdir -p .expo
	@echo "Starting dev client server on $(LOCAL_IP):$(RANDOM_PORT) with Android emulator..."
	@echo "Logging to $(LOG_FILE)"
	script -q $(LOG_FILE) env REACT_NATIVE_PACKAGER_HOSTNAME=$(LOCAL_IP) npx expo start --dev-client --port $(RANDOM_PORT) --android

# ============================================
# Utilities
# ============================================

# Run precommit checks
precommit:
	npm run precommit

# Run tests
test:
	npm run test:ci

# Clean build artifacts
clean:
	rm -rf node_modules/.cache
	rm -rf .expo
	@echo "Cleaned build artifacts"

# Show current config
info:
	@echo "Local IP: $(LOCAL_IP)"
	@echo "Random Port: $(RANDOM_PORT)"
