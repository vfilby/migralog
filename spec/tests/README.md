# Test Specifications

Framework-agnostic test specifications for MigraineTracker.

## Files

- **[e2e-test-specs.md](e2e-test-specs.md)** — End-to-end test specifications (10 suites, 40+ test cases)
  - Onboarding, episode lifecycle, daily status, medication tracking,
    dose edit/delete, archiving, trends/analytics, notification settings,
    error handling, accessibility
  - Includes fixture data requirements, test IDs, and step-by-step flows
  - Currently implemented in Detox (`/react-native/e2e/`)

- **[unit-integration-test-specs.md](unit-integration-test-specs.md)** — Unit & integration test specifications
  - Coverage target: **75% line coverage** across business logic
  - Database repositories, state stores, services, utilities, schemas
  - Includes coverage gap analysis and prioritized modules to test
  - Currently implemented in Jest (`/react-native/src/**/__tests__/`)

## Current Implementation Status

| Layer | Test Files | Coverage |
|-------|-----------|----------|
| Database repositories | 14 files | Good |
| State stores | 7 files | Good |
| Services | 22 files | Good (some gaps in notifications) |
| Utilities | 17 files | Good |
| Schemas | 3 files | Partial (overlay, common missing) |
| E2E | 12 files | Good |
| **Total** | **125+ test files** | **~77% of modules covered** |
