# App-Specific Technical Documentation

This directory contains technical implementation details, strategies, and historical documentation specific to the MigraineTracker mobile app.

## Quick Reference

📖 **For project specifications and data models, see [/spec/](../../spec/)**

## Contents

### Implementation Guides
- **[Accessibility Guide](accessibility-guide.md)** - WCAG compliance and accessibility implementation
- **[Backup Strategy](backup-strategy.md)** - Data backup and recovery implementation
- **[Database Retry Mechanism](database-retry-mechanism.md)** - SQLite error handling and retry logic
- **[Dependency Policy](dependency-policy.md)** - Guidelines for adding/updating dependencies
- **[Error Handling Patterns](error-handling-patterns.md)** - Error handling best practices
- **[Logging Guide](logging-guide.md)** - Enhanced logging system documentation
- **[Refactoring Strategy](refactoring-strategy.md)** - Systematic approach to code improvements
- **[Sentry Setup](sentry-setup.md)** - Error tracking and monitoring configuration

### Testing Documentation
- **[Migration Integration Tests](migration-integration-tests.md)** - Database migration testing strategy
- **[Migration Manual Testing Checklist](migration-manual-testing-checklist.md)** - Manual QA checklist for migrations
- **[Migration Testing Strategy](migration-testing-strategy.md)** - Comprehensive migration testing approach
- **[E2E Test Deep Links Security](e2e-test-deep-links-security.md)** - Security considerations for testing deep links
- **[Test Improvements Summary (AppNavigator)](test-improvements-summary-appnavigator.md)** - Navigation testing improvements

### Data & Export
- **[JSON Export Format](json-export-format.md)** - Data export structure and format specification

### Screenshots
- **[Screenshots](screenshots/)** - Visual documentation and issue tracking screenshots

### Historical Documentation
- **[Archive](archive/)** - Completed work and historical reference documents
  - Migration analysis and findings (completed)
  - E2E test optimization results (integrated into main testing docs)
  - Welcome screen refactoring summary (completed)

## Organization

### Implementation-Specific vs. General Documentation

**App-Specific Documentation (this directory):**
- Technical implementation details
- Testing strategies and results
- Migration guides and checklists
- Setup and configuration guides
- Historical analysis and completed work

**Shared Specifications ([/spec/](../../spec/)):**
- Feature specifications
- Architecture overview
- Data model documentation
- Project-wide standards

### Archive Policy

Completed work is moved to the `archive/` directory rather than deleted to:
- Preserve decision-making context
- Maintain historical reference
- Support future similar work
- Document lessons learned

## Contributing to App Documentation

When adding new implementation documentation:

1. **Choose the right location:**
   - App-specific implementation details → this directory
   - Project-wide specifications → `/spec/`
   - User-facing guides → `./wiki/`

2. **Use clear, descriptive filenames:**
   - Include the domain/area (e.g., `migration-`, `testing-`, `setup-`)
   - Use descriptive names over generic ones

3. **Link related documentation:**
   - Reference main project docs where appropriate
   - Cross-link between related implementation guides
   - Update this README when adding new files

4. **Archive completed work:**
   - Move completed project documentation to `archive/`
   - Update archive README with brief descriptions
   - Preserve for historical reference

## See Also

- [Shared Specifications](../../spec/)
- [Testing Guide](./testing.md)
- [Architecture Overview](./wiki/Architecture.md)