# Test Specifications

Framework-agnostic test specifications for MigraineTracker.

## Files

- **[e2e-test-specs.md](e2e-test-specs.md)** — End-to-end test specifications (10 suites, 40+ test cases)
  - Onboarding, episode lifecycle, daily status, medication tracking,
    dose edit/delete, archiving, trends/analytics, notification settings,
    error handling, accessibility
  - Includes fixture data requirements, test IDs, and step-by-step flows
  - Currently implemented as XCUITest in `mobile-apps/ios/MigraLogUITests/`

- **[unit-integration-test-specs.md](unit-integration-test-specs.md)** — Unit & integration test specifications
  - Coverage target: **75% line coverage** across business logic
  - Repositories, view models, services, utilities, models
  - Includes coverage gap analysis and prioritized modules to test
  - Currently implemented as XCTest in `mobile-apps/ios/MigraLogTests/`

## Current Implementation Status

| Layer | Test Files |
|-------|-----------|
| Repositories | 6 |
| View models | 14 |
| Services | 17 |
| Utilities | 7 |
| Database | 2 |
| Models | 1 |
| UI tests | 12 |
| **Total** | **~60 test files** |
