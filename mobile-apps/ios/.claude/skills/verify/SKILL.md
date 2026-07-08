---
name: verify
description: Verify iOS app changes end-to-end by driving the simulator UI via XCUITest and capturing screenshot evidence. Use after changing MigraLog product code.
---

# Verifying MigraLog iOS changes at runtime

The runtime surface is the iOS simulator UI. The repo's handle for driving it
is **XCUITest** (`MigraLogUITests`), which already has launch-arg fixtures and
navigation helpers — write (or extend) a UI test for the flow, run it, and
export its screenshots as evidence.

## Build / run

```bash
cd mobile-apps/ios
xcodegen generate   # no committed .xcodeproj; required in fresh worktrees
env DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
    PATH="/Applications/Xcode.app/Contents/Developer/usr/bin:$PATH" \
    xcodebuild test -scheme MigraLog \
    -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
    -only-testing:MigraLogUITests/<YourTestClass> \
    -resultBundlePath /tmp/verify.xcresult
```

- `DEVELOPER_DIR` is required (machine default is CommandLineTools) and the
  PATH prefix keeps `simctl` findable for the test runner.
- Simulator OS is 26.5 even though CLAUDE.md says 26.0.

## Driving the app

- `UITestHelpers.launchWithFixtures()` launches with `--uitesting
  --load-fixtures` (onboarding skipped; seeds Test Topiramate, Test Magnesium,
  Test Ibuprofen [category otc] + one closed episode). Fixture data lives in
  `MigraLog/App/MigraLogApp.swift` (`loadFixtureData`).
- Navigation: `UITestHelpers.navigateTo(tab:in:)`; Settings is the
  `settings-button` gear on the Dashboard, not a tab.
- SwiftUI Form pickers render as menu buttons: tap the picker's identifier,
  then tap the option's label text.
- Sheets with `.presentationDetents([.medium, .large])` open at medium and
  Forms are lazy — off-screen rows don't exist in the hierarchy yet. Swipe up
  (`app.swipeUp()`) to expand the detent, then
  `UITestHelpers.scrollToElement(_:in: app.collectionViews.firstMatch)`.
- Rescue-med "Log Dose" opens a confirmation sheet — tap its `Log` button;
  preventative meds log immediately.
- System permission alerts: `UITestHelpers.handleSystemAlert(in:buttonLabel:)`.

## Evidence

Attach screenshots in the test (`XCTAttachment(screenshot: app.screenshot())`,
`lifetime = .keepAlways`, set `.name`), then export:

```bash
xcrun xcresulttool export attachments --path /tmp/verify.xcresult \
    --output-path /tmp/verify-att   # manifest.json maps names → files
```

Every failed run also auto-records an .mp4 of the whole session (no local
ffmpeg to grab frames — prefer named screenshot attachments). A teardown block
that attaches a final screenshot makes stall failures diagnosable.
