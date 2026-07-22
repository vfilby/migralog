// Shared changelog generation for TestFlight "What to Test" notes.
//
// Builds notes deterministically from conventional-commit subjects — no LLM, no
// extra secret. `feat:` commits become a "New" list, `fix:` commits a "Fixed"
// list; trailing PR refs like "(#486)" are stripped for tester-facing prose.
//
// Only commits that touch the iOS app (INCLUDE_PATHS, default "mobile-apps/ios",
// minus EXCLUDE_PATHS) are eligible — website, tooling, and repo-script changes
// never reach testers, whatever their scope says. Because the marketing-screenshot
// generator lives *inside* the iOS test target (MigraLogUITests/ScreenshotsUITests.swift),
// a website commit that only regenerates screenshots would otherwise sneak past the
// path filter; EXCLUDE_PATHS carves that file back out so such commits don't count
// as iOS-app changes. On top of the path filter, two classes of commit are dropped
// as non-tester-facing: those whose scope is in EXCLUDE_SCOPES (default: "ci" plus
// the website family — website/web/site/docs/marketing, including hyphen/slash
// suffixes like "website-infra"), and those whose subject matches EXCLUDE_PATTERN
// (default: test-infrastructure churn).
//
// Used by:
//   set-beta-notes.mjs      — upload-time notes for a single build (range: prev release..HEAD)
//   promote-preflight.mjs   — rollup notes at promotion (range: last Pre-flight..promoted build)
//
// Env (read once at import):
//   INCLUDE_PATHS     — optional; comma-separated pathspecs a commit must touch to be
//                       listed (default "mobile-apps/ios"). Empty string disables the filter.
//   EXCLUDE_PATHS     — optional; comma-separated pathspecs to carve back out of
//                       INCLUDE_PATHS (default: the website-screenshot generator that
//                       lives under the iOS test target). Empty string disables it.
//   EXCLUDE_SCOPES    — optional; comma-separated scopes to drop (default:
//                       "ci,website,web,site,docs,marketing"). A commit is dropped when
//                       its scope equals an entry or starts with "<entry>-"/"<entry>/"
//                       (so "website-infra" is caught by "website").
//   EXCLUDE_PATTERN   — optional; JS regex (case-insensitive) dropping matching subjects

import { execSync } from 'node:child_process';

export const CHAR_LIMIT = 4000; // App Store Connect whatsNew max length

// Subjects that are real commits but not tester-facing: test scaffolding,
// flaky-test stabilization, snapshot/UI/unit test repair, CI plumbing wording.
const DEFAULT_EXCLUDE_PATTERN =
  '\\b(ui|unit|snapshot)\\s+tests?\\b|\\bnightly\\b|\\bflaky\\b|waitfor\\w+|\\btest\\s+(suite|harness|plan)\\b';

// Website work is tester-invisible even when its scope is present. "ci" stays for
// pipeline plumbing; the rest cover the marketing-site family. See isExcludedScope
// for the suffix rule that also catches "website-infra", "web/deploy", etc.
const DEFAULT_EXCLUDE_SCOPES = 'ci,website,web,site,docs,marketing';

// The App Store screenshot generator is an iOS test file but exists solely to feed
// the marketing website; edits to it are website work, not app changes. Carving it
// out of the include filter stops screenshot-only website commits from qualifying.
const DEFAULT_EXCLUDE_PATHS = 'mobile-apps/ios/MigraLogUITests/ScreenshotsUITests.swift';

const excludeScopes = new Set(
  (process.env.EXCLUDE_SCOPES ?? DEFAULT_EXCLUDE_SCOPES)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

// A scope is excluded if it matches an entry exactly, or is a hyphen/slash-suffixed
// sub-scope of one ("website" also drops "website-infra" and "web/deploy").
function isExcludedScope(scope) {
  if (!scope) return false;
  if (excludeScopes.has(scope)) return true;
  for (const ex of excludeScopes) {
    if (scope.startsWith(`${ex}-`) || scope.startsWith(`${ex}/`)) return true;
  }
  return false;
}

const excludePattern = new RegExp(process.env.EXCLUDE_PATTERN || DEFAULT_EXCLUDE_PATTERN, 'i');

const includePaths = (process.env.INCLUDE_PATHS ?? 'mobile-apps/ios')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const excludePaths = (process.env.EXCLUDE_PATHS ?? DEFAULT_EXCLUDE_PATHS)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function capitalize(s) {
  // Leave camelCase / brand tokens like iCloud, iPad, iOS untouched.
  if (/^[a-z][A-Z]/.test(s)) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Resolve a marketing version to an existing tag ref. The pipeline tags new
// releases deploy/<version>; the pre-existing scheme used alpha-v<version>. Try
// both. Returns the ref string, or null if neither tag exists.
export function resolveVersionRef(version) {
  if (!version) return null;
  for (const ref of [`deploy/${version}`, `alpha-v${version}`]) {
    try {
      execSync(`git rev-parse --verify --quiet "${ref}^{commit}"`, { stdio: 'pipe' });
      return ref;
    } catch {
      // try next candidate
    }
  }
  return null;
}

// Generate "What to Test" notes from feat/fix commits in (lowerRef, upperRef]
// that touch INCLUDE_PATHS. lowerRef null → from the start of history. Returns
// the notes string, or null when the range contains no tester-facing feat/fix
// commits.
export function generateNotes(lowerRef, upperRef = 'HEAD') {
  const range = lowerRef ? `${lowerRef}..${upperRef}` : upperRef;
  // Include the iOS app paths, then carve out excluded sub-paths (e.g. the
  // website-screenshot generator) with git's :(exclude) pathspec magic. Exclude
  // pathspecs are ignored by git unless a positive pathspec is also present.
  const pathParts = [
    ...includePaths.map((p) => `"${p}"`),
    ...(includePaths.length ? excludePaths.map((p) => `":(exclude)${p}"`) : []),
  ];
  const pathspec = pathParts.length ? ` -- ${pathParts.join(' ')}` : '';
  const raw = execSync(`git log --no-merges --format=%s ${range}${pathspec}`, { encoding: 'utf8' });
  const subjects = raw.split('\n').map((s) => s.trim()).filter(Boolean);

  const features = [];
  const fixes = [];
  for (const s of subjects) {
    const m = s.match(/^(feat|fix)(?:\(([^)]*)\))?!?:\s*(.+)$/i);
    if (!m) continue;
    const type = m[1].toLowerCase();
    const scope = (m[2] || '').toLowerCase();
    // Strip trailing PR refs like " (#486)" or " (#486) (#500)".
    const text = m[3].replace(/\s*\(#\d+\)/g, '').trim();
    if (!text) continue;
    // Drop non-tester-facing noise: excluded scopes (ci, website family) and test churn.
    if (isExcludedScope(scope)) continue;
    if (excludePattern.test(text)) continue;
    (type === 'feat' ? features : fixes).push(capitalize(text));
  }

  if (features.length === 0 && fixes.length === 0) return null;

  const lines = [];
  if (features.length) {
    lines.push('New:');
    for (const f of features) lines.push(`• ${f}`);
  }
  if (fixes.length) {
    if (lines.length) lines.push('');
    lines.push('Fixed:');
    for (const f of fixes) lines.push(`• ${f}`);
  }
  let notes = lines.join('\n');
  if (notes.length > CHAR_LIMIT) notes = `${notes.slice(0, CHAR_LIMIT - 1)}…`;
  return notes;
}
