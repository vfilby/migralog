#!/usr/bin/env python3
"""Weekly MigraLog Sentry triage.

Pulls unresolved issues for the eff3/migralog Sentry project, triages them, and
files a `[Sentry]` GitHub issue in the repo for each NEW actionable one
(deduping against issues already filed by a previous run).

Runs remotely from GitHub Actions (see .github/workflows/sentry-triage.yml):
  - Sentry auth: the `SENTRY_AUTH_TOKEN` env var (a repo secret; read scopes are
    sufficient — org:read, project:read, event:read). Falls back to
    ~/.sentryclirc for local runs.
  - GitHub auth: the `gh` CLI, which reads GH_TOKEN/GITHUB_TOKEN from the env.

Set DRY_RUN=1 to print the plan without creating any GitHub issues.

HIPAA note: MigraLog is a health app. Sentry scrubs PHI at the source, but this
script still only ever copies error titles, counts, levels, build metadata, and
the Sentry permalink into GitHub — never raw event data.
"""
import json
import os
import subprocess
import sys
import urllib.request
from configparser import ConfigParser
from pathlib import Path

ORG = "eff3"
PROJECT = "migralog"
REPO = os.environ.get("GITHUB_REPOSITORY", "vfilby/migralog")
# Sentry's issues endpoint only accepts specific windows (7d is rejected with a
# 400). 14d is the smallest that covers a full week with margin; the weekly run
# plus Sentry-Issue-ID dedup means the overlap never double-files.
STATS_PERIOD = "14d"
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

# Titles we never file: App Hang "Fully Blocked" reports are suspended-app
# false positives that App Hang tracking was disabled for in #489. Multi-minute
# "hangs" are the OS terminating a backgrounded app, not a real main-thread block.
NOISE_PREFIXES = ("App Hang", "Fatal App Hang")


def log(msg):
    print(msg, flush=True)


def sentry_token():
    tok = os.environ.get("SENTRY_AUTH_TOKEN")
    if tok:
        return tok.strip()
    cfg = ConfigParser()
    cfg.read(Path.home() / ".sentryclirc")
    for section in cfg.sections():
        if cfg.has_option(section, "token"):
            return cfg.get(section, "token").strip()
    raise SystemExit("No Sentry token: set SENTRY_AUTH_TOKEN or ~/.sentryclirc")


def sentry_get(path, token):
    req = urllib.request.Request(
        f"https://sentry.io/api/0{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def is_noise(issue):
    title = issue.get("title", "")
    return any(title.startswith(p) for p in NOISE_PREFIXES)


def gh(args):
    return subprocess.run(["gh", *args], capture_output=True, text=True, check=True)


def already_filed_ids():
    """Sentry issue IDs already tracked by a `sentry`-labeled GitHub issue."""
    res = gh([
        "issue", "list", "--repo", REPO, "--state", "all",
        "--label", "sentry", "--limit", "300", "--json", "body",
    ])
    filed = set()
    for item in json.loads(res.stdout or "[]"):
        for line in (item.get("body") or "").splitlines():
            if line.startswith("Sentry-Issue-ID:"):
                filed.add(line.split(":", 1)[1].strip())
    return filed


def ensure_sentry_label():
    if DRY_RUN:
        return
    subprocess.run(
        ["gh", "label", "create", "sentry", "--repo", REPO, "--color", "FFA500",
         "--description", "Filed automatically from Sentry triage"],
        capture_output=True, text=True,
    )  # no check=: a pre-existing label exits non-zero, which is fine


def latest_build(token, issue_id):
    try:
        ev = sentry_get(f"/issues/{issue_id}/events/latest/", token)
    except Exception:
        return None
    app = (ev.get("contexts") or {}).get("app") or {}
    return app.get("app_version") or (
        ev.get("release", {}).get("version") if isinstance(ev.get("release"), dict) else ev.get("release")
    )


def build_body(issue, build):
    return "\n".join([
        f"Sentry-Issue-ID: {issue['id']}",
        "",
        f"**[{issue.get('title')}]({issue.get('permalink')})**",
        "",
        f"- Level: `{issue.get('level')}`",
        f"- Events (last {STATS_PERIOD}): {issue.get('count')} across {issue.get('userCount')} user(s)",
        f"- First seen: {issue.get('firstSeen', '')[:10]} · Last seen: {issue.get('lastSeen', '')[:10]}",
        f"- Affected build: {build or 'unknown'}",
        f"- Culprit: `{issue.get('culprit') or 'n/a'}`",
        "",
        "_Filed automatically by the weekly Sentry triage job. Close if not actionable._",
    ])


def main():
    token = sentry_token()
    issues = sentry_get(
        f"/projects/{ORG}/{PROJECT}/issues/"
        f"?query=is:unresolved&statsPeriod={STATS_PERIOD}&sort=freq&limit=50",
        token,
    )
    if not isinstance(issues, list):
        raise SystemExit(f"Unexpected Sentry response: {issues}")

    log(f"[triage] {len(issues)} unresolved issue(s) in last {STATS_PERIOD}"
        + (" (DRY RUN)" if DRY_RUN else ""))

    actionable = [i for i in issues if not is_noise(i)]
    noise = [i for i in issues if is_noise(i)]
    for i in noise:
        log(f"[skip noise] {i.get('title')}")

    filed = already_filed_ids()
    ensure_sentry_label()

    created, skipped_dupe = [], []
    for issue in actionable:
        if issue["id"] in filed:
            skipped_dupe.append(issue)
            log(f"[already filed] {issue.get('title')}")
            continue
        build = latest_build(token, issue["id"])
        title = f"[Sentry] {issue.get('title')}"
        body = build_body(issue, build)
        if DRY_RUN:
            log(f"[would file] {title}")
            created.append(issue)
            continue
        res = subprocess.run(
            ["gh", "issue", "create", "--repo", REPO, "--title", title,
             "--body", body, "--label", "sentry", "--label", "bug"],
            capture_output=True, text=True,
        )
        if res.returncode == 0:
            log(f"[filed] {title} -> {res.stdout.strip()}")
            created.append(issue)
        else:
            log(f"[ERROR filing] {title}: {res.stderr.strip()}")

    log(f"[triage] done: {len(created)} filed, {len(skipped_dupe)} already tracked, "
        f"{len(noise)} noise skipped")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # keep CI logs readable on failure
        log(f"[triage] FAILED: {exc}")
        sys.exit(1)
