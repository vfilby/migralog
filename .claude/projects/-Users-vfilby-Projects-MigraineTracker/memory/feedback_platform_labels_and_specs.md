---
name: feedback_platform_labels_and_specs
description: Use GitHub issue platform labels to determine which codebase to fix, and always update specs alongside code
type: feedback
---

Use `platform:ios`, `platform:android`, and `platform:react-native` GitHub labels on issues to determine which codebase a fix belongs in. If an issue has no platform label, check the issue content and ask if unclear.

When fixing bugs or implementing features, also update the relevant spec files in `spec/` to keep them in sync with the code.

**Why:** Fixes were made only in React Native when the iOS Swift app was the one being deployed to TestFlight. The user had to point out the mistake after a release went out without the fixes. Platform labels now exist to prevent this.

**How to apply:** Before starting work on an issue, check its labels. If labeled `platform:ios`, fix in `mobile-apps/ios/`. If labeled `platform:react-native`, fix in `mobile-apps/react-native/`. If both apply, fix both. Always check if specs in `spec/` need updating too.
