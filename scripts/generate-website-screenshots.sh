#!/usr/bin/env bash
#
# Generate the marketing screenshots used by the website carousel.
#
# Builds the iOS app, runs MigraLogUITests/ScreenshotsUITests (which seeds
# ~90 days of realistic sample data via --load-screenshot-data) once in light
# and once in dark appearance, extracts the captured attachments from the
# .xcresult bundles, and writes the screens the website uses to
# website/website/screenshots/<name>-<appearance>.png, downscaled for the web.
#
# Usage:
#   scripts/generate-website-screenshots.sh [--appearance light|dark|both]
#
# Environment overrides:
#   SCREENSHOT_DEVICE  Simulator device name (default: iPhone 17 Pro Max)
#   DEVELOPER_DIR      Xcode developer dir (default: /Applications/Xcode.app/...)
#   WEB_WIDTH          Width in px of the downscaled web copies (default: 660)
#
# Requires: Xcode + iOS simulators, xcodegen, jq, sips (macOS built-in).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$REPO_ROOT/mobile-apps/ios"
OUT_DIR="$REPO_ROOT/website/website/screenshots"
BUILD_DIR="${SCREENSHOT_BUILD_DIR:-$(mktemp -d /tmp/migralog-screenshots.XXXXXX)}"

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
# Keep simctl reachable for the xctest runner (background shells can lose it).
export PATH="$DEVELOPER_DIR/usr/bin:$PATH"

DEVICE_NAME="${SCREENSHOT_DEVICE:-iPhone 17 Pro Max}"
WEB_WIDTH="${WEB_WIDTH:-660}"
APPEARANCES=(light dark)

while [[ $# -gt 0 ]]; do
    case "$1" in
        --appearance)
            case "${2:-}" in
                light) APPEARANCES=(light) ;;
                dark) APPEARANCES=(dark) ;;
                both) APPEARANCES=(light dark) ;;
                *) echo "error: --appearance must be light, dark, or both" >&2; exit 2 ;;
            esac
            shift 2 ;;
        -h|--help)
            sed -n '2,20p' "$0"; exit 0 ;;
        *) echo "error: unknown argument $1" >&2; exit 2 ;;
    esac
done

# Attachment name (in ScreenshotsUITests) -> website screenshot base name.
# Only these are copied to the website; the carousel references them by name.
ATTACHMENT_MAP='{
  "01-Dashboard": "dashboard",
  "02-Episode-Timeline": "episode-details",
  "05-Statistics": "trends"
}'

log() { printf '\n==> %s\n' "$*"; }

command -v xcodegen >/dev/null || { echo "error: xcodegen not installed (brew install xcodegen)" >&2; exit 1; }
command -v jq >/dev/null || { echo "error: jq not installed" >&2; exit 1; }

log "Generating Xcode project"
(cd "$IOS_DIR" && xcodegen generate)

log "Locating simulator: $DEVICE_NAME"
UDID=$(xcrun simctl list devices available -j \
    | jq -r --arg name "$DEVICE_NAME" '
        [.devices | to_entries[]
         | select(.key | contains("iOS"))
         | .value[] | select(.name == $name and .isAvailable)] | first | .udid // empty')
[[ -n "$UDID" ]] || { echo "error: no available simulator named '$DEVICE_NAME'" >&2; exit 1; }
echo "    $DEVICE_NAME ($UDID)"

log "Booting simulator"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b

# Clean status bar for marketing shots.
xcrun simctl status_bar "$UDID" override \
    --time "9:41" --batteryState charged --batteryLevel 100 \
    --cellularBars 4 --wifiBars 3 --dataNetwork wifi 2>/dev/null || true

cleanup() {
    xcrun simctl status_bar "$UDID" clear 2>/dev/null || true
    xcrun simctl ui "$UDID" appearance light 2>/dev/null || true
}
trap cleanup EXIT

mkdir -p "$OUT_DIR"

for appearance in "${APPEARANCES[@]}"; do
    log "Capturing $appearance appearance"
    xcrun simctl ui "$UDID" appearance "$appearance"

    RESULT_BUNDLE="$BUILD_DIR/screenshots-$appearance.xcresult"
    rm -rf "$RESULT_BUNDLE"

    (cd "$IOS_DIR" && xcodebuild test \
        -scheme MigraLog \
        -destination "id=$UDID" \
        -only-testing:MigraLogUITests/ScreenshotsUITests \
        -resultBundlePath "$RESULT_BUNDLE" \
        -quiet)

    EXPORT_DIR="$BUILD_DIR/attachments-$appearance"
    rm -rf "$EXPORT_DIR" && mkdir -p "$EXPORT_DIR"
    xcrun xcresulttool export attachments --path "$RESULT_BUNDLE" --output-path "$EXPORT_DIR"

    # manifest.json lists, per test, each attachment's configured name and
    # its exported file name.
    for key in $(jq -r 'keys[]' <<<"$ATTACHMENT_MAP"); do
        base=$(jq -r --arg k "$key" '.[$k]' <<<"$ATTACHMENT_MAP")
        exported=$(jq -r --arg name "$key" '
            [.[] | .attachments[]? | select(.configuredName == $name or (.suggestedHumanReadableName // "" | startswith($name)))]
            | first | .exportedFileName // empty' "$EXPORT_DIR/manifest.json")
        if [[ -z "$exported" || ! -f "$EXPORT_DIR/$exported" ]]; then
            echo "error: attachment '$key' not found in $EXPORT_DIR/manifest.json" >&2
            exit 1
        fi
        dest="$OUT_DIR/$base-$appearance.png"
        cp "$EXPORT_DIR/$exported" "$dest"
        sips --resampleWidth "$WEB_WIDTH" "$dest" >/dev/null
        echo "    $key -> ${dest#"$REPO_ROOT"/}"
    done
done

log "Done. Screenshots written to ${OUT_DIR#"$REPO_ROOT"/}"
