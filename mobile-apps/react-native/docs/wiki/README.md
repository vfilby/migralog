# GitHub Wiki Documentation

This directory contains documentation formatted for GitHub Wiki.

## Using with GitHub Wiki

You can sync these markdown files to your GitHub repository's wiki:

### Option 1: Manual Copy

1. Navigate to your repository's Wiki on GitHub
2. Create a new page for each markdown file
3. Copy the content from each file
4. Use the filename (without `.md`) as the page title

### Option 2: Wiki Git Repository

GitHub wikis are backed by a Git repository. You can clone and push to it:

```bash
# Clone the wiki repository
git clone https://github.com/vfilby/MigraineTracker.wiki.git

# Copy wiki files
cp docs/wiki/*.md MigraineTracker.wiki/

# Commit and push
cd MigraineTracker.wiki
git add .
git commit -m "Update wiki documentation"
git push
```

### Option 3: Automated Sync

You can set up a GitHub Action to automatically sync these files to the wiki:

```yaml
# .github/workflows/sync-wiki.yml
name: Sync Wiki
on:
  push:
    branches: [main]
    paths:
      - 'app/docs/wiki/**'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Sync to Wiki
        uses: Andrew-Chen-Wang/github-wiki-action@v4
        with:
          wiki-folder: app/docs/wiki
```

## File Naming Convention

GitHub Wiki pages are referenced by their filename:
- `Home.md` → Home page
- `Getting-Started.md` → "Getting Started" page (accessed as `Getting-Started`)
- Use hyphens for spaces in filenames

## Wiki Structure

Current wiki pages:
- `Home.md` - Wiki landing page with navigation
- `Getting-Started.md` - Setup and installation guide
- `Architecture.md` - System architecture documentation
- `Testing-Guide.md` - Testing practices and guidelines
- `Features.md` - Feature documentation and roadmap

## Maintaining Documentation

When updating documentation:
1. Update the markdown files in this directory
2. Sync to GitHub Wiki using one of the methods above
3. Ensure internal links use Wiki-style references: `[Link Text](Page-Name)`

## Note on Dual Documentation

This project has documentation in two locations:
- `/docs/` - Root level documentation (project-wide)
- `/app/docs/` - App-specific documentation including wiki files

The wiki files in `/app/docs/wiki/` are designed to be synced to GitHub Wiki for easier browsing and discoverability.
