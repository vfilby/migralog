# GitHub Actions Workflows

CI/CD for the MigraLog iOS Swift app (`mobile-apps/ios`).

## Workflows

- `ci-swift.yml` — Build & unit tests on every push/PR to `main`. UI tests run on push to `main` and on PRs labeled `run-ui-tests`.
- `deploy-swift-testflight.yml` — Manual `workflow_dispatch` build & upload to TestFlight. Bumps build number; runs against `main`.
- `dependabot.yml` — Dependency update automation.
- `opencode.yml` — Internal tooling.

## Environment

- macOS runner with Xcode 26 and iOS 26.0 simulator (`iPhone 17 Pro`).
- Signing: Apple App Store Connect API key + signing cert / provisioning profile injected from secrets.

## Local equivalent of CI

```bash
xcodebuild -project mobile-apps/ios/MigraLog.xcodeproj test \
  -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests   # unit
  # or -only-testing:MigraLogUITests for UI
```
