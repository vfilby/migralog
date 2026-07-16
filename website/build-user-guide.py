#!/usr/bin/env python3
"""Compile the canonical user guide into a web page for the marketing site.

Single source of truth: ``user-guide/guide/*.md`` at the repo root — the very
same Markdown that is bundled into the iOS app (see ``mobile-apps/ios/project.yml``
and ``Views/Help``). This script renders those files into one styled, themed page
at ``website/website/guide/index.html`` so ``migralog.app/guide/`` and the in-app
User Guide stay in lockstep from a single content home.

Run it whenever the guide content changes:

    python3 website/build-user-guide.py

It has no dependencies (stdlib only) and ships a small, purpose-built Markdown
renderer covering exactly the constructs the guide uses: headings, paragraphs,
nested unordered lists, blockquotes, one GFM table, and inline bold / italic /
code / links (``*.md`` links are rewritten to in-page anchors).
"""

from __future__ import annotations

import html
import re
from pathlib import Path

# Repo-root-relative paths. This file lives at website/build-user-guide.py.
ROOT = Path(__file__).resolve().parent.parent
GUIDE_SRC = ROOT / "user-guide" / "guide"
OUT = ROOT / "website" / "website" / "guide" / "index.html"

# Reading order + titles, mirroring HelpArticle.all in the iOS app so the web and
# in-app guides present the same articles in the same order.
ARTICLES = [
    ("tracking-philosophy", "How tracking works"),
    ("medications", "Medications"),
    ("calendar", "The calendar"),
    ("trends-and-analytics", "Trends & analytics"),
]


# ── Inline Markdown ──────────────────────────────────────────────────────────
def render_inline(text: str) -> str:
    """Render inline Markdown (code, links, bold, italic) in already-plain text."""
    text = html.escape(text, quote=False)

    stash: list[str] = []

    def keep(markup: str) -> str:
        stash.append(markup)
        return f"\x00{len(stash) - 1}\x00"

    # Inline code first so its contents are never treated as emphasis.
    text = re.sub(r"`([^`]+)`", lambda m: keep(f"<code>{m.group(1)}</code>"), text)

    def link(m: re.Match) -> str:
        label, href = m.group(1), m.group(2)
        md = re.match(r"^([\w-]+)\.md(#.*)?$", href)
        if md:  # intra-guide link → in-page anchor on this single page
            href = "#" + md.group(1) + (md.group(2) or "")
        attrs = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
        return keep(f'<a href="{html.escape(href, quote=True)}"{attrs}>{label}</a>')

    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link, text)

    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    text = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"<em>\1</em>", text)

    for i, markup in enumerate(stash):
        text = text.replace(f"\x00{i}\x00", markup)
    return text


# ── Block Markdown ───────────────────────────────────────────────────────────
def render_list(lines: list[str]) -> str:
    """Render an unordered (optionally nested) list from its raw lines."""
    html_parts: list[str] = []
    stack: list[int] = []  # indentation levels of currently-open <ul>s

    def open_ul(indent: int) -> None:
        stack.append(indent)
        html_parts.append("<ul>")

    def close_ul() -> None:
        stack.pop()
        html_parts.append("</li></ul>")

    for line in lines:
        stripped = line.lstrip(" ")
        indent = len(line) - len(stripped)
        bullet = re.match(r"[-*]\s+(.*)$", stripped)
        if bullet:
            if not stack or indent > stack[-1]:
                open_ul(indent)
            else:
                while len(stack) > 1 and indent < stack[-1]:
                    close_ul()
                html_parts.append("</li>")
            html_parts.append("<li>" + render_inline(bullet.group(1)))
        else:
            # Lazy continuation of the current item (wrapped line).
            html_parts.append(" " + render_inline(stripped))

    while stack:
        close_ul()
    return "".join(html_parts)


def render_table(lines: list[str]) -> str:
    def cells(row: str) -> list[str]:
        return [c.strip() for c in row.strip().strip("|").split("|")]

    header = cells(lines[0])
    body = [cells(r) for r in lines[2:]]  # lines[1] is the --- separator
    out = ['<div class="table-wrap"><table><thead><tr>']
    out += [f"<th>{render_inline(c)}</th>" for c in header]
    out.append("</tr></thead><tbody>")
    for row in body:
        out.append("<tr>" + "".join(f"<td>{render_inline(c)}</td>" for c in row) + "</tr>")
    out.append("</tbody></table></div>")
    return "".join(out)


def render_markdown(md: str, *, heading_shift: int = 1) -> str:
    """Render a Markdown document body to HTML.

    ``heading_shift`` demotes headings (``#`` becomes ``<h2>`` by default) so the
    page keeps a single top-level ``<h1>``.
    """
    lines = md.replace("\r\n", "\n").split("\n")
    blocks: list[str] = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        if not line.strip():
            i += 1
            continue

        heading = re.match(r"^(#{1,6})\s+(.*)$", line)
        if heading:
            level = min(len(heading.group(1)) + heading_shift, 6)
            blocks.append(f"<h{level}>{render_inline(heading.group(2).strip())}</h{level}>")
            i += 1
            continue

        if line.lstrip().startswith(">"):
            quote: list[str] = []
            while i < n and lines[i].lstrip().startswith(">"):
                quote.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            blocks.append(f"<blockquote><p>{render_inline(' '.join(quote).strip())}</p></blockquote>")
            continue

        if line.startswith("|"):
            table: list[str] = []
            while i < n and lines[i].startswith("|"):
                table.append(lines[i])
                i += 1
            blocks.append(render_table(table))
            continue

        if re.match(r"^\s*[-*]\s+", line):
            items: list[str] = []
            while i < n and (re.match(r"^\s*[-*]\s+", lines[i]) or (lines[i].startswith(" ") and lines[i].strip())):
                items.append(lines[i])
                i += 1
            blocks.append(render_list(items))
            continue

        # Paragraph: gather consecutive plain lines.
        para: list[str] = []
        while i < n and lines[i].strip() and not re.match(r"^(#{1,6}\s|\s*[-*]\s|\||\s*>)", lines[i]):
            para.append(lines[i].strip())
            i += 1
        blocks.append(f"<p>{render_inline(' '.join(para))}</p>")

    return "\n".join(blocks)


# ── Page assembly ────────────────────────────────────────────────────────────
# Design tokens copied verbatim from website/website/index.html so the guide
# matches the redesigned site (colours, dark mode, fonts).
TOKENS = """
        /* Brand palette — mirrors css/tokens.css: navy #152233, orange #FF552A. */
        :root {
            --ink: #152233; --mut: #5a6a80; --soft: #8d99ab; --line: #e3e7ec;
            --bg: #f8f9fa; --card: #ffffff; --inner: #f4f6f9; --accent: #ff552a;
            --accentd: #ce4420; --accs: rgba(255, 85, 42, .10);
            --shadow-card: 0 40px 80px -50px rgba(21, 34, 51, .4);
            color-scheme: light;
        }
        [data-theme="dark"] {
            --ink: #e8edf4; --mut: #9faec2; --soft: #6d7e95; --line: #29394e;
            --bg: #0e1826; --card: #152233; --inner: #1b2a3e; --accent: #ff5f38;
            --accentd: #ff8a6b; --accs: rgba(255, 112, 85, .16);
            --shadow-card: 0 40px 80px -50px rgba(0, 0, 0, .8);
            color-scheme: dark;
        }
        @media (prefers-color-scheme: dark) {
            :root:not([data-theme="light"]) {
                --ink: #e8edf4; --mut: #9faec2; --soft: #6d7e95; --line: #29394e;
                --bg: #0e1826; --card: #152233; --inner: #1b2a3e; --accent: #ff5f38;
                --accentd: #ff8a6b; --accs: rgba(255, 112, 85, .16);
                --shadow-card: 0 40px 80px -50px rgba(0, 0, 0, .8);
                color-scheme: dark;
            }
        }
"""

STYLES = """
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Hanken Grotesk', system-ui, sans-serif; color: var(--ink); background: var(--bg); -webkit-font-smoothing: antialiased; }
        a { color: inherit; text-decoration: none; }
        a, .btn { transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
        :focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
        .wrap { max-width: 1080px; margin: 0 auto; padding: 0 60px; }
        .skip-link { position: absolute; left: -9999px; top: 0; background: var(--ink); color: #fff; padding: 10px 16px; border-radius: 0 0 8px 0; z-index: 100; }
        .skip-link:focus { left: 0; }

        nav { display: flex; align-items: center; height: 74px; }
        .brand { display: flex; align-items: center; gap: 11px; font-weight: 700; font-size: 19px; letter-spacing: -.4px; }
        .mk { width: 24px; height: 24px; border-radius: 6px; flex: 0 0 auto; }
        nav .links { margin-left: 42px; display: flex; gap: 30px; font-size: 15px; color: var(--mut); font-weight: 500; }
        nav .links a:hover, nav .links a.active { color: var(--ink); }
        nav .nav-right { margin-left: auto; display: flex; align-items: center; gap: 20px; }
        .ghl { display: flex; align-items: center; gap: 7px; font-size: 14px; color: var(--mut); font-weight: 500; }
        .ghl:hover { color: var(--ink); }
        .pill-btn { background: var(--ink); color: var(--bg); font-size: 14px; font-weight: 600; padding: 10px 18px; border-radius: 999px; white-space: nowrap; }
        .pill-btn:hover { opacity: .85; }
        .theme-switch { display: flex; align-items: center; gap: 2px; background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 3px; }
        .theme-switch button { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: none; border-radius: 999px; background: transparent; color: var(--soft); cursor: pointer; padding: 0; }
        .theme-switch button:hover { color: var(--ink); }
        .theme-switch button[aria-pressed="true"] { background: var(--accs); color: var(--accentd); }

        /* ── Guide layout ── */
        .guide-hero { padding: 40px 0 8px; }
        .guide-hero .kick { font-size: 14px; font-weight: 700; color: var(--accentd); letter-spacing: .02em; margin: 0 0 14px; }
        .guide-hero h1 { font-size: clamp(32px, 4.4vw, 48px); line-height: 1.05; letter-spacing: -1.6px; font-weight: 800; margin: 0 0 16px; }
        .guide-hero .lead { font-size: 18px; line-height: 1.6; color: var(--mut); max-width: 40em; margin: 0; font-weight: 450; }

        .guide-layout { display: grid; grid-template-columns: 232px 1fr; gap: 56px; align-items: start; padding: 30px 0 90px; }
        /* The TOC is a <nav>, so reset the top-bar nav rule (flex row, 74px). */
        .guide-toc { display: block; height: auto; position: sticky; top: 24px; }
        .guide-toc h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--soft); font-weight: 700; margin: 0 0 12px; }
        .guide-toc ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .guide-toc a { display: block; padding: 8px 12px; border-radius: 9px; font-size: 14.5px; font-weight: 500; color: var(--mut); border-left: 2px solid transparent; }
        .guide-toc a:hover { color: var(--ink); background: var(--accs); }
        .guide-toc a.active { color: var(--accentd); font-weight: 600; background: var(--accs); }

        .guide-body { min-width: 0; max-width: 44em; }
        .guide-article { scroll-margin-top: 24px; }
        .guide-article + .guide-article { margin-top: 24px; padding-top: 40px; border-top: 1px solid var(--line); }
        .guide-body h2 { font-size: 27px; letter-spacing: -.6px; font-weight: 800; line-height: 1.15; margin: 0 0 6px; }
        .guide-body h3 { font-size: 19px; letter-spacing: -.3px; font-weight: 700; line-height: 1.25; margin: 34px 0 4px; }
        .guide-body h4 { font-size: 16px; font-weight: 700; margin: 22px 0 2px; }
        .guide-body p { font-size: 16.5px; line-height: 1.68; color: var(--mut); margin: 14px 0; }
        .guide-body strong { color: var(--ink); font-weight: 700; }
        .guide-body a { color: var(--accentd); font-weight: 600; }
        .guide-body a:hover { text-decoration: underline; }
        .guide-body ul { margin: 14px 0; padding-left: 22px; }
        .guide-body li { font-size: 16.5px; line-height: 1.62; color: var(--mut); margin: 7px 0; }
        .guide-body li::marker { color: var(--soft); }
        .guide-body ul ul { margin: 6px 0; }
        .guide-body code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .88em; background: var(--accs); color: var(--accentd); padding: 1px 6px; border-radius: 6px; }
        .guide-body blockquote { margin: 20px 0; padding: 2px 20px; border-left: 3px solid var(--accent); background: var(--inner); border-radius: 0 10px 10px 0; }
        .guide-body blockquote p { color: var(--ink); font-size: 15.5px; }
        .table-wrap { overflow-x: auto; margin: 18px 0; }
        .guide-body table { border-collapse: collapse; width: 100%; font-size: 15px; }
        .guide-body th, .guide-body td { text-align: left; padding: 11px 14px; border-bottom: 1px solid var(--line); color: var(--mut); vertical-align: top; }
        .guide-body th { color: var(--ink); font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; }
        .guide-body td strong { color: var(--ink); }

        footer { display: flex; align-items: center; padding: 30px 0; border-top: 1px solid var(--line); font-size: 14px; color: var(--mut); margin-top: 20px; flex-wrap: wrap; gap: 14px; }
        .foot-right { margin-left: auto; display: flex; gap: 18px; flex-wrap: wrap; row-gap: 8px; }
        .foot-right a:hover { color: var(--ink); }

        @media (max-width: 860px) {
            .wrap { padding: 0 24px; }
            .guide-layout { grid-template-columns: 1fr; gap: 12px; }
            .guide-toc { position: static; border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; background: var(--card); }
            nav .links { display: none; }
        }
        @media (max-width: 560px) {
            .brand { font-size: 17px; }
            .nav-right { gap: 12px; }
            .ghl { display: none; }        /* GitHub stays reachable in the footer */
            .pill-btn { padding: 9px 14px; }
        }
"""

THEME_SCRIPT = """
        (function () {
            const buttons = document.querySelectorAll('[data-set-theme]');
            const media = window.matchMedia('(prefers-color-scheme: dark)');
            function stored() { try { return localStorage.getItem('theme') || 'system'; } catch (e) { return 'system'; } }
            function apply(theme) {
                if (theme === 'system') { document.documentElement.removeAttribute('data-theme'); }
                else { document.documentElement.setAttribute('data-theme', theme); }
                buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setTheme === theme)));
            }
            buttons.forEach(b => b.addEventListener('click', () => {
                const theme = b.dataset.setTheme;
                try { localStorage.setItem('theme', theme); } catch (e) {}
                apply(theme);
            }));
            media.addEventListener('change', () => { if (stored() === 'system') apply('system'); });
            apply(stored());
        })();

        // Highlight the current article in the table of contents while scrolling.
        (function () {
            const links = Array.from(document.querySelectorAll('.guide-toc a'));
            const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        links.forEach(a => a.classList.remove('active'));
                        const link = byId.get(e.target.id);
                        if (link) link.classList.add('active');
                    }
                });
            }, { rootMargin: '-20% 0px -70% 0px' });
            document.querySelectorAll('.guide-article').forEach(s => observer.observe(s));
        })();
"""

NAV = """
    <div class="wrap">
        <nav aria-label="Main navigation">
            <a class="brand" href="/" aria-label="MigraLog home"><img class="mk" src="/android-chrome-192x192.png" alt="" aria-hidden="true">MigraLog</a>
            <div class="links">
                <a href="/why.html">Why</a>
                <a href="/guide/" class="active" aria-current="page">User guide</a>
            </div>
            <div class="nav-right">
                <div class="theme-switch" role="group" aria-label="Color theme">
                    <button type="button" data-set-theme="light" aria-pressed="false" aria-label="Light theme" title="Light">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                    </button>
                    <button type="button" data-set-theme="system" aria-pressed="true" aria-label="Follow system theme" title="System">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8m-4-3v3"/></svg>
                    </button>
                    <button type="button" data-set-theme="dark" aria-pressed="false" aria-label="Dark theme" title="Dark">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
                    </button>
                </div>
                <a class="ghl" href="https://github.com/vfilby/migralog" target="_blank" rel="noopener">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
                    <span class="ghl-text">GitHub</span>
                </a>
                <a class="pill-btn" href="/#signup">Join the beta</a>
            </div>
        </nav>
    </div>
"""

FOOTER = """
    <div class="wrap">
        <footer>
            <a class="brand" href="/" aria-label="MigraLog home"><img class="mk" src="/android-chrome-192x192.png" alt="" aria-hidden="true">MigraLog</a>
            <div class="foot-right">
                <a href="/why.html">Why</a>
                <a href="/guide/">User guide</a>
                <a href="https://github.com/vfilby/migralog" target="_blank" rel="noopener">GitHub</a>
                <a href="/#privacy">Privacy</a>
                <a href="/contact.html">Contact</a>
            </div>
        </footer>
    </div>
"""


def build() -> None:
    toc_items: list[str] = []
    sections: list[str] = []

    for article_id, title in ARTICLES:
        md = (GUIDE_SRC / f"{article_id}.md").read_text(encoding="utf-8")
        body = render_markdown(md)
        toc_items.append(
            f'                    <li><a href="#{article_id}">{html.escape(title)}</a></li>'
        )
        sections.append(
            f'                <section id="{article_id}" class="guide-article" '
            f'aria-label="{html.escape(title)}">\n{body}\n                </section>'
        )

    toc = "\n".join(toc_items)
    articles_html = "\n".join(sections)

    page = f"""<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Guide | MigraLog</title>
    <meta name="description" content="How to use MigraLog: the timeline-based approach to tracking, medications and safety limits, the calendar, and trends and analytics.">
    <link rel="canonical" href="https://migralog.app/guide/">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#f8f9fa" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#0e1826" media="(prefers-color-scheme: dark)">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@450;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        (function () {{
            let theme = 'system';
            try {{ theme = localStorage.getItem('theme') || 'system'; }} catch (e) {{}}
            if (theme === 'light' || theme === 'dark') {{ document.documentElement.setAttribute('data-theme', theme); }}
        }})();
    </script>
    <style>{TOKENS}{STYLES}    </style>
</head>
<body>
    <a href="#guide-main" class="skip-link">Skip to main content</a>
{NAV}
    <main id="guide-main" class="wrap">
        <header class="guide-hero">
            <p class="kick">User guide</p>
            <h1>Using MigraLog</h1>
            <p class="lead">Everything the app can do, in plain language &mdash; the same guide that ships inside MigraLog on your iPhone. Read it here, or find it any time under <strong>Settings &rarr; User Guide</strong> in the app.</p>
        </header>
        <div class="guide-layout">
            <nav class="guide-toc" aria-label="Guide contents">
                <h2>Contents</h2>
                <ol>
{toc}
                </ol>
            </nav>
            <div class="guide-body">
{articles_html}
            </div>
        </div>
    </main>
{FOOTER}
    <script>{THEME_SCRIPT}    </script>
</body>
</html>
"""

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(ARTICLES)} articles).")


if __name__ == "__main__":
    build()
