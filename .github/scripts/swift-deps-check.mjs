// Check the Swift packages declared in mobile-apps/ios/project.yml (XcodeGen)
// against their latest GitHub releases. Dependabot's swift ecosystem only reads
// SPM manifests (Package.swift / Package.resolved), which this repo doesn't
// have — project.yml is the source of truth — so this script fills that gap.
// Run weekly by .github/workflows/swift-deps-update.yml.
//
// Usage:
//   node .github/scripts/swift-deps-check.mjs [--write] [path/to/project.yml]
//
// Prints a JSON summary to stdout: {"updates": [{name, url, from, to, toTag, major}]}
// With --write, also rewrites the exactVersion pins in place.
// Human-readable progress goes to stderr.
//
// Env:
//   GH_TOKEN / GITHUB_TOKEN  (optional) — raises the GitHub API rate limit.

import { readFileSync, writeFileSync } from 'node:fs';

const DEFAULT_MANIFEST = 'mobile-apps/ios/project.yml';

const args = process.argv.slice(2);
const write = args.includes('--write');
const manifestPath = args.find((a) => !a.startsWith('--')) ?? DEFAULT_MANIFEST;

// Line-oriented parse of the top-level `packages:` block. Only handles the
// shapes this repo uses (two-space-indented name, four-space-indented keys);
// xcodegen validates the real semantics, this just needs url + exactVersion.
function parsePackages(lines) {
  const pkgs = [];
  let inPackages = false;
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    if (/^\S/.test(line)) break; // next top-level key
    const name = line.match(/^ {2}(\S+):\s*$/);
    if (name) {
      current = { name: name[1] };
      pkgs.push(current);
      continue;
    }
    const kv = line.match(/^ {4}(\w+):\s*"?([^"#\s]+)"?\s*$/);
    if (kv && current) {
      current[kv[1]] = kv[2];
      if (kv[1] === 'exactVersion') current.exactVersionLine = i;
    }
  }
  return pkgs;
}

function parseSemver(tag) {
  const m = tag.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m ? m.slice(1, 4).map(Number) : null;
}

function newer(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

async function ghApi(path) {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'migralog-swift-deps-check',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${path} -> ${res.status}`);
  return res.json();
}

// Latest stable version of a github.com repo. Prefers the "latest" release
// (excludes prereleases/drafts); falls back to the highest semver tag for
// repos that tag without cutting releases.
async function latestVersion(owner, repo) {
  const release = await ghApi(`/repos/${owner}/${repo}/releases/latest`);
  if (release?.tag_name) {
    const v = parseSemver(release.tag_name);
    if (v) return { version: v, tag: release.tag_name };
  }
  const tags = (await ghApi(`/repos/${owner}/${repo}/tags?per_page=100`)) ?? [];
  let best = null;
  for (const t of tags) {
    const v = parseSemver(t.name);
    if (v && (!best || newer(v, best.version))) best = { version: v, tag: t.name };
  }
  return best;
}

const text = readFileSync(manifestPath, 'utf8');
const lines = text.split('\n');
const packages = parsePackages(lines);
if (packages.length === 0) {
  console.error(`No packages found in ${manifestPath}`);
  process.exit(1);
}

const updates = [];
for (const pkg of packages) {
  const gh = pkg.url?.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!gh) {
    console.error(`skip ${pkg.name}: not a github.com URL (${pkg.url})`);
    continue;
  }
  if (!pkg.exactVersion) {
    console.error(`skip ${pkg.name}: no exactVersion pin — pin it so updates are tracked`);
    continue;
  }
  const current = parseSemver(pkg.exactVersion);
  if (!current) {
    console.error(`skip ${pkg.name}: unparseable exactVersion "${pkg.exactVersion}"`);
    continue;
  }
  const latest = await latestVersion(gh[1], gh[2]);
  if (!latest) {
    console.error(`skip ${pkg.name}: no stable release/tag found`);
    continue;
  }
  if (newer(latest.version, current)) {
    const to = latest.version.join('.');
    console.error(`${pkg.name}: ${pkg.exactVersion} -> ${to}`);
    updates.push({
      name: pkg.name,
      url: pkg.url,
      from: pkg.exactVersion,
      to,
      toTag: latest.tag,
      major: latest.version[0] !== current[0],
      line: pkg.exactVersionLine,
    });
  } else {
    console.error(`${pkg.name}: ${pkg.exactVersion} is current`);
  }
}

if (write && updates.length > 0) {
  for (const u of updates) {
    lines[u.line] = lines[u.line].replace(`"${u.from}"`, `"${u.to}"`);
  }
  writeFileSync(manifestPath, lines.join('\n'));
  console.error(`wrote ${updates.length} update(s) to ${manifestPath}`);
}

console.log(JSON.stringify({ updates: updates.map(({ line, ...u }) => u) }, null, 2));
