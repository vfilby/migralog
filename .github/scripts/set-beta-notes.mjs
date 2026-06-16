// Generates TestFlight "What to Test" notes from the commits since the previous
// release and writes them to the just-uploaded build's betaBuildLocalizations.
//
// Notes are built deterministically from conventional-commit subjects — no LLM,
// no extra secret. `feat:` commits become a "New" list, `fix:` commits a "Fixed"
// list; trailing PR refs like "(#486)" are stripped for tester-facing prose.
//
// To keep the notes focused on changes a tester would care about, two classes of
// commit are dropped: those whose scope is in EXCLUDE_SCOPES (default "ci"), and
// those whose subject matches EXCLUDE_PATTERN (default: test-infrastructure
// churn — UI/unit test fixes, nightly/flaky stabilization, etc.).
//
// Non-fatal by design: "What to Test" is cosmetic, so any failure (ASC hiccup,
// build slow to process) logs a warning and exits 0 — it never blocks a deploy.
//
// Env:
//   APP_BUNDLE_ID     — bundle id of the app (e.g. com.eff3.migralog)
//   APP_VERSION       — marketing version of the build just uploaded (e.g. 1.1.200)
//   APP_BUILD         — build number (CFBundleVersion) of that build
//   PREVIOUS_VERSION  — marketing version of the previous release; lower bound for
//                       the changelog range. Empty on the very first release.
//   MAX_WAIT_SECONDS  — optional; how long to poll for the build to appear (default 1200)
//   EXCLUDE_SCOPES    — optional; comma-separated scopes to drop (default "ci")
//   EXCLUDE_PATTERN   — optional; JS regex (case-insensitive); subjects matching it
//                       are dropped. Defaults to a test-infrastructure filter.
//   ASC_*             — via asc-client

import { execSync } from 'node:child_process';
import { required, getAppId, getBuild, setBetaBuildNotes } from './asc-client.mjs';

const CHAR_LIMIT = 4000; // App Store Connect whatsNew max length

// Subjects that are real commits but not tester-facing: test scaffolding,
// flaky-test stabilization, snapshot/UI/unit test repair, CI plumbing wording.
const DEFAULT_EXCLUDE_PATTERN =
  '\\b(ui|unit|snapshot)\\s+tests?\\b|\\bnightly\\b|\\bflaky\\b|waitfor\\w+|\\btest\\s+(suite|harness|plan)\\b';

const excludeScopes = new Set(
  (process.env.EXCLUDE_SCOPES ?? 'ci')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);
const excludePattern = new RegExp(process.env.EXCLUDE_PATTERN || DEFAULT_EXCLUDE_PATTERN, 'i');

function capitalize(s) {
  // Leave camelCase / brand tokens like iCloud, iPad, iOS untouched.
  if (/^[a-z][A-Z]/.test(s)) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Resolve the previous release's marketing version to an existing tag ref. The
// pipeline tags new releases deploy/<version>; the pre-existing scheme used
// alpha-v<version>. Try both.
function resolveLowerBound(prev) {
  if (!prev) return null;
  for (const ref of [`deploy/${prev}`, `alpha-v${prev}`]) {
    try {
      execSync(`git rev-parse --verify --quiet "${ref}^{commit}"`, { stdio: 'pipe' });
      return ref;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function generateNotes(lowerRef) {
  const range = lowerRef ? `${lowerRef}..HEAD` : 'HEAD';
  const raw = execSync(`git log --no-merges --format=%s ${range}`, { encoding: 'utf8' });
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
    // Drop non-tester-facing noise: excluded scopes (e.g. ci) and test churn.
    if (excludeScopes.has(scope)) continue;
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

async function pollForBuild(appId, version, buildNumber, maxWaitSeconds) {
  const deadline = Date.now() + maxWaitSeconds * 1000;
  let attempt = 0;
  for (;;) {
    const build = await getBuild(appId, { version, buildNumber });
    if (build) return build;
    if (Date.now() >= deadline) return null;
    attempt += 1;
    console.log(`Build ${version} (${buildNumber}) not yet visible in App Store Connect; retry ${attempt} in 30s…`);
    await sleep(30_000);
  }
}

async function main() {
  const bundleId = required('APP_BUNDLE_ID');
  const version = required('APP_VERSION');
  const buildNumber = required('APP_BUILD');
  const previous = process.env.PREVIOUS_VERSION || '';
  const maxWait = Number(process.env.MAX_WAIT_SECONDS || '1200');

  const lowerRef = resolveLowerBound(previous);
  console.log(`Changelog range: ${lowerRef ? `${lowerRef}..HEAD` : 'entire history (no previous release tag found)'}`);

  const notes = generateNotes(lowerRef);
  if (!notes) {
    console.log('No feat/fix commits in range; leaving "What to Test" unset.');
    return;
  }
  console.log(`Generated "What to Test":\n${notes}`);

  const appId = await getAppId(bundleId);
  const build = await pollForBuild(appId, version, buildNumber, maxWait);
  if (!build) {
    console.warn(`::warning::Build ${version} (${buildNumber}) never appeared in App Store Connect within ${maxWait}s; skipping notes.`);
    return;
  }

  await setBetaBuildNotes(build.id, notes);
  console.log(`Set "What to Test" on build ${version} (${buildNumber}).`);
}

main().catch((err) => {
  // Non-fatal: never fail a deploy over cosmetic release notes.
  console.warn(`::warning::Failed to set "What to Test" notes: ${err.message}`);
  process.exit(0);
});
