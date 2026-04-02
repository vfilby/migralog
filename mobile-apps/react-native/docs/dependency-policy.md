# Dependency Management Policy

## Overview

This document outlines the policy for managing dependencies in MigraLog to ensure security, stability, and maintainability.

## Automated Updates

### Dependabot Configuration

We use GitHub Dependabot for automated dependency updates:

- **Schedule**: Weekly on Mondays at 9:00 AM
- **Grouping**: Minor and patch updates are grouped together
- **Major updates**: Created as separate PRs for careful review
- **Limit**: Maximum 5 open PRs at a time

### What Gets Auto-Updated

- ✅ Minor version updates (1.2.x → 1.3.0)
- ✅ Patch version updates (1.2.3 → 1.2.4)
- ✅ GitHub Actions
- ⚠️ Major version updates (requires manual review)

## Manual Review Required

The following packages require manual review for major version updates due to potential breaking changes:

### Core Framework
- **React Native** - Major updates require extensive testing across iOS/Android
- **React** / **React DOM** - Must stay in sync, major changes affect component APIs
- **Expo** - SDK updates require migration guide review

### Testing Infrastructure
- **Jest** - Major versions may require test configuration changes
- **Detox** - May require changes to E2E test setup

### Critical Libraries
- **Zod** - Schema validation changes could break existing validations
- **React Navigation** - Major updates may change navigation APIs

## Security Policy

### Vulnerability Scanning

- **CI Integration**: `npm audit` runs on every PR and push to main
- **Audit Level**: Moderate and above will fail CI
- **Production Dependencies**: Only production dependencies are audited (`--omit=dev`)

### Vulnerability Response

1. **Critical/High vulnerabilities**:
   - Address within 24 hours
   - Create hotfix branch if needed
   - Deploy patch ASAP

2. **Moderate vulnerabilities**:
   - Review within 1 week
   - Schedule fix in next sprint
   - Document any accepted risks

3. **Low vulnerabilities**:
   - Review monthly
   - Include in routine dependency updates

## Update Cadence

### Weekly (Automated via Dependabot)
- Minor version updates
- Patch version updates
- Security patches

### Monthly (Manual Review)
- Review Dependabot PRs
- Check for stale dependencies
- Review npm audit report
- Update major versions if needed

### Quarterly (Major Updates)
- React Native SDK updates
- Expo SDK updates
- Major library updates
- Breaking changes migration

## Testing Requirements

All dependency updates must pass:

1. ✅ Type checking (`npx tsc --noEmit`)
2. ✅ ESLint (`npm run test:lint:ci`)
3. ✅ Unit tests (`npm run test:ci`)
4. ✅ E2E tests (`npm run test:e2e`)
5. ✅ Security audit (`npm audit --omit=dev --audit-level=moderate`)

## Pinning Strategy

### Do NOT Pin
- Development dependencies (allow automatic minor/patch updates)
- Non-critical utilities

### Pin Versions When
- Known compatibility issues exist
- Waiting for bug fix in newer version
- Package has history of breaking changes in minor versions

### Document Exceptions

When pinning a version:
1. Add comment in `package.json` explaining why
2. Create GitHub issue to track when unpinning is safe
3. Link to relevant bug reports or issues

Example:
```json
{
  "some-package": "1.2.3", // Pinned: v1.3.0 breaks iOS builds (see issue #123)
}
```

## Dependency Audit Process

### Before Adding New Dependencies

Ask:
1. Is this package actively maintained?
2. Does it have good test coverage?
3. Are there known security issues?
4. Is the bundle size reasonable?
5. Do we really need it? (can we use built-in functionality?)

### Tools
- `npm audit` - Security vulnerabilities
- `npm outdated` - Check for updates
- `npx depcheck` - Find unused dependencies
- Bundle size analysis (future: source-map-explorer)

## Current Known Issues

### Peer Dependency Warnings

**xdl / react-redux**
- Non-critical warning from Expo tooling
- Does not affect production app
- Will be resolved when Expo updates xdl

## Update Log

### 2025-10-28: Initial Dependency Update
Updated the following packages:
- @babel/preset-env: 7.28.3 → 7.28.5
- @babel/preset-typescript: 7.27.1 → 7.28.5
- @react-native-community/slider: 5.0.1 → 5.1.0
- @react-navigation/bottom-tabs: 7.4.7 → 7.7.1
- @react-navigation/native: 7.1.17 → 7.1.19
- @react-navigation/native-stack: 7.3.26 → 7.6.1
- @typescript-eslint/eslint-plugin: 8.46.1 → 8.46.2
- @typescript-eslint/parser: 8.46.1 → 8.46.2
- detox: 20.43.0 → 20.45.0
- eslint-plugin-react-hooks: 7.0.0 → 7.0.1
- expo: 54.0.20 → 54.0.21
- react-native-screens: 4.16.0 → 4.18.0

**Note:** React 19.1.0 → 19.2.0 update was attempted but reverted due to incompatibility with React Native 0.81.5 (which depends on react-native-renderer@19.1.0). This confirms the importance of our policy to carefully coordinate React Native and React version updates.

**Note:** react-native-web was not updated due to peer dependency conflicts with React versions.

**Note:** react-native-safe-area-context 5.6.1 → 5.6.2 was attempted but reverted due to "unimplemented Component <RNSSafeAreaView>" errors on iOS 16. Native module updates require rebuild which is beyond scope of this PR.

All tests passing ✅
Security audit: 0 vulnerabilities ✅

## Resources

- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [npm audit Documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [Semantic Versioning](https://semver.org/)
- [React Native Upgrade Helper](https://react-native-community.github.io/upgrade-helper/)
