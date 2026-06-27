# MigraLog User Guide

Single source of truth for MigraLog's user-facing help documentation.

The Markdown files in this folder are the **canonical** content for how to use
the app. The goal is to author the guide here once and "compile" it into both:

- **Web** — a `/help` (or similar) section on `migralog.app`, built and deployed
  by the website pipeline.
- **In-app** — bundled into the iOS app and rendered in a help/guide view.

## Status

Early scaffold. The compile/build pipeline to web and app is **not built yet** —
this folder establishes the content home so writing can start independently of
the tooling.

## Structure

```
user-guide/
├── README.md          # this file
└── guide/             # the guide content, one Markdown file per topic
    ├── tracking-philosophy.md
    ├── medications.md
    ├── calendar.md
    └── trends-and-analytics.md
```

## Pages

1. [How tracking works](guide/tracking-philosophy.md) — the timeline-based
   philosophy and the three layers of tracking (episodes, timeline, daily status).
2. [Medications](guide/medications.md) — adding medications, and setting
   cooldowns and overuse safety limits.
3. [The calendar](guide/calendar.md) — the day-status colours; migraine days are
   automatic, other days are logged as Clear or Not Clear.
4. [Trends and analytics](guide/trends-and-analytics.md) — insights, charts,
   medication response, and the Doctor Visit Summary export.

## Authoring guidelines

- One topic per file; keep filenames kebab-case (e.g. `logging-an-episode.md`).
- Write for end users, not developers — no implementation detail.
- Health data is sensitive: never include real personal health information in
  examples or screenshots.
