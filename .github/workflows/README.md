# GitHub Actions Workflows

CI/CD for the MigraLog iOS Swift app (`mobile-apps/ios`).

## Workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `swift-ci.yml` — `[iOS] CI` | PR → `main` | **PR gate.** SwiftLint + build + the **Smoke** test plan (full unit suite + a tiny UI render subset). Path-filtered at the job level so it can be a *required* check (see below). |
| `swift-nightly.yml` — `[iOS] Nightly UI suite` | Daily 09:17 UTC + manual | Runs the **Full** test plan (entire suite minus screenshot capture). On failure opens/appends a `nightly-failure` tracking issue. Does **not** gate PRs. |
| `release-pipeline.yml` — `[iOS] Release Pipeline` | Push → `main` (iOS paths) + manual | Unit tests, then archive + upload to the **Beta** (internal) TestFlight group. Build number patch-bumps from the latest `deploy/*` (or legacy `alpha-v*`) git tag; tags `deploy/<version>` on success. |
| `promote-preflight.yml` — `[iOS] Promote Beta → Pre-flight` | Weekly (Tue 12:00 UTC) + manual | Promotes the latest eligible Beta build to the **Pre-flight** external group behind a Sentry crash-free soak gate (72 h, ≥ 99 % crash-free, 0 unresolved issues). Respects `block-promotion/build-*` tags. |
| `promote-manual.yml` — `[iOS] Promote Build → Group (manual)` | Manual | Attach a specific build number to any TestFlight group, bypassing the soak gate. |
| `promote-production.yml` — `[iOS] Promote Beta → Production` | Manual | Submit a build to App Store review (phased release by default). Uses the `production` environment. |
| `swift-deps-update.yml` — `[iOS] Swift package updates` | Weekly (Mon 09:00 UTC) + manual | Checks the exact pins in `mobile-apps/ios/project.yml` against the latest GitHub releases (via `.github/scripts/swift-deps-check.mjs`) and opens/updates a bump PR on the `automated/swift-deps-update` branch. The PR is opened with the default `GITHUB_TOKEN`, which can't trigger CI — close & reopen it (or push to the branch) to run the gate. |
| `dependabot.yml` | — | GitHub Actions version bumps only. Dependabot can't read XcodeGen manifests, so Swift packages are covered by `swift-deps-update.yml` instead. |
| `opencode.yml` | — | Internal tooling. |

Shared App Store Connect API client lives in `.github/scripts/asc-client.mjs`; the
`promote-*.mjs` scripts build on it.

## Project generation (XcodeGen)

`MigraLog.xcodeproj` is **generated** from `mobile-apps/ios/project.yml` and is
**git-ignored**. After cloning or pulling, regenerate it:

```bash
cd mobile-apps/ios
brew install xcodegen          # once; CI pins >= 2.45.3
xcodegen generate
```

Schemes and the **Smoke** / **Full** test plans (`TestPlans/*.xctestplan`) are
defined in `project.yml`.

## Required-check pattern

PR workflows path-filter at the **job** level via a `changes` job + `if:` guard,
not at the workflow `on: paths:` level. A workflow skipped by an `on: paths:`
filter reports no status, so a required check would hang forever on non-iOS PRs.
A job skipped by `if:` reports "skipped", which branch rulesets count as a pass —
so docs-only PRs merge while iOS PRs stay gated. Mark `build-and-test` required
in the `main` branch ruleset.

## Environment

- macOS runner (`macos-26`) with Xcode 26 and the `iPhone 17 Pro` iOS 26 simulator.
- Signing: App Store Connect API key + signing cert / provisioning profile from secrets.

## Required repository secrets

Signing / upload (already configured): `SWIFT_CERTIFICATE_P12`,
`SWIFT_CERTIFICATE_PASSWORD`, `SWIFT_PROVISIONING_PROFILE`, `APPLE_TEAM_ID`,
`ASC_KEY_ID`, `ASC_API_KEY_P8`, `ASC_ISSUER_ID`.

Pre-flight soak gate (new): `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

Also requires TestFlight groups named **`Beta`** (internal, auto-distribute on)
and **`Pre-flight`** (external) in App Store Connect, and a `nightly-failure`
issue label.

## Local equivalent of CI

```bash
cd mobile-apps/ios
xcodegen generate
swiftlint lint

# Smoke (PR gate): full unit suite + UI render subset
xcodebuild test -project MigraLog.xcodeproj -scheme MigraLog -testPlan Smoke \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0'

# Full (nightly): everything minus screenshot capture
xcodebuild test -project MigraLog.xcodeproj -scheme MigraLog -testPlan Full \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0'
```
