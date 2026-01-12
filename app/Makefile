# MigraLog Development Makefile
# Supports running multiple Expo dev servers with unique ports per shell session

# Port range for Metro bundler (19000-19999 is Expo's typical range)
PORT_MIN := 19000
PORT_MAX := 19999

# Generate a deterministic port based on TTY device
# Same terminal = same port, different terminals = different ports
TTY_HASH := $(shell tty | cksum | cut -d' ' -f1)
SESSION_PORT := $(shell echo $$(( $(PORT_MIN) + ($(TTY_HASH) % ($(PORT_MAX) - $(PORT_MIN))) )))

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
	@echo "Starting Expo Go server on port $(SESSION_PORT)..."
	@echo "Scan the QR code or press 'i' for iOS simulator, 'a' for Android emulator"
	npx expo start --port $(SESSION_PORT)

# Start with iOS simulator (Expo Go)
server-ios:
	@echo "Starting Expo Go server on port $(SESSION_PORT) with iOS simulator..."
	npx expo start --port $(SESSION_PORT) --ios

# Start with Android emulator (Expo Go)
server-android:
	@echo "Starting Expo Go server on port $(SESSION_PORT) with Android emulator..."
	npx expo start --port $(SESSION_PORT) --android

# ============================================
# Development Builds (custom dev client)
# ============================================

# Start dev server for development builds on a random port
dev:
	@mkdir -p .expo
	@echo "Starting dev client server on $(LOCAL_IP):$(SESSION_PORT)..."
	@echo "Logging to $(LOG_FILE)"
	script -q $(LOG_FILE) env REACT_NATIVE_PACKAGER_HOSTNAME=$(LOCAL_IP) npx expo start --dev-client --port $(SESSION_PORT)

# Start dev server + launch iOS simulator (development build)
dev-ios:
	@mkdir -p .expo
	@echo "Starting dev client server on $(LOCAL_IP):$(SESSION_PORT) with iOS simulator..."
	@echo "Logging to $(LOG_FILE)"
	script -q $(LOG_FILE) env REACT_NATIVE_PACKAGER_HOSTNAME=$(LOCAL_IP) npx expo start --dev-client --port $(SESSION_PORT) --ios

# Start dev server + launch Android emulator (development build)
dev-android:
	@mkdir -p .expo
	@echo "Starting dev client server on $(LOCAL_IP):$(SESSION_PORT) with Android emulator..."
	@echo "Logging to $(LOG_FILE)"
	script -q $(LOG_FILE) env REACT_NATIVE_PACKAGER_HOSTNAME=$(LOCAL_IP) npx expo start --dev-client --port $(SESSION_PORT) --android

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
	@echo "Session Port: $(SESSION_PORT) (based on TTY: $$(tty))"
