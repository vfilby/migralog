# CLAUDE.md - AI Agent Guidelines for MigraLog

Welcome! This document provides clear guidelines for AI agents (like Claude Code) working on the MigraLog codebase. Following these guidelines ensures code quality, maintains consistency, and protects user data.

## Table of Contents

1. [Git Workflow](#git-workflow)
2. [Pre-commit Requirements](#pre-commit-requirements)
3. [Development Process](#development-process)
4. [Testing Requirements](#testing-requirements)
5. [Code Quality Standards](#code-quality-standards)
6. [Important Notes](#important-notes)

---

## Git Workflow

### ⚠️ CRITICAL RULE: NEVER PUSH TO MAIN ⚠️

**ABSOLUTELY FORBIDDEN:**
- ❌ NEVER commit directly to `main`
- ❌ NEVER push directly to `main` 
- ❌ NEVER merge directly to `main`

**ALWAYS follow this process:**
- ✅ Create feature/bugfix branches
- ✅ Push to feature branches only
- ✅ Use pull requests for all changes to main
- ✅ Get code review before merging

### Branch Strategy

**ALWAYS** use feature or bugfix branches. **NEVER** commit directly to `main`.

- **Feature branches**: `feature/descriptive-name`
  - Example: `feature/add-weather-trigger-tracking`
  - Example: `feature/improve-analytics-charts`

- **Bugfix branches**: `bugfix/descriptive-name`
  - Example: `bugfix/fix-episode-end-time-validation`
  - Example: `bugfix/resolve-dark-mode-contrast-issue`

### Branch Naming Guidelines

- Use lowercase with hyphens
- Be descriptive but concise
- Include ticket/issue number if applicable: `feature/ISSUE-123-add-export-feature`

### Pull Request Workflow

1. Create a branch from `main`
2. Make your changes
3. Run `npm run precommit` (see below)
4. Commit your changes
5. Push to remote
6. Create a Pull Request for review

**Example:**
```bash
# Create and switch to feature branch
git checkout -b feature/add-medication-reminder

# Make changes, then run precommit checks
npm run precommit

# If checks pass, commit
git add .
git commit -m "Add medication reminder notification feature"

# Push and create PR
git push -u origin feature/add-medication-reminder
```

---

## Pre-commit Requirements

### The Golden Rule

**ALWAYS** run `npm run precommit` before committing code.

This command runs three critical checks:
1. **Linting** (`npm run test:lint:ci`) - ESLint with **zero warnings** allowed
2. **Type checking** (`npx tsc --noEmit`) - TypeScript compilation must succeed
3. **Tests** (`npm run test:ci`) - All unit tests must pass

### What the Precommit Script Does

```bash
npm run precommit
# Runs: npm run test:lint:ci && npx tsc --noEmit && npm run test:ci
```

- **Linting**: Checks code style and catches common errors (max-warnings=0)
- **TypeScript**: Ensures type safety across the codebase
- **Tests**: Runs all unit tests with coverage reporting

### If Precommit Fails

**Do NOT commit until all checks pass.** Instead:

1. **Lint errors**: Run `npm run test:lint:fix` to auto-fix issues, then manually fix remaining problems
2. **TypeScript errors**: Fix type errors reported by the compiler
3. **Test failures**: Fix failing tests or update tests if behavior changed intentionally

---

## Development Process

### Starting New Work

1. **Understand the requirement**
   - Read related code
   - Check existing patterns
   - Review similar implementations

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes**
   - Follow existing code patterns
   - Update or add tests
   - Add JSDoc comments for complex logic

4. **Run precommit checks**
   ```bash
   npm run precommit
   ```

5. **Fix any issues**
   - Address lint warnings/errors
   - Fix TypeScript errors
   - Fix failing tests

6. **Commit and push**
   ```bash
   git add .
   git commit -m "Clear, descriptive commit message"
   git push -u origin feature/your-feature-name
   ```

7. **Create Pull Request**
   - Provide clear description
   - Reference related issues
   - Request review if applicable

### Handling Test Failures

When tests fail:

1. **Read the error message carefully** - Jest provides detailed output
2. **Check if your changes broke existing functionality** - Fix the code or update the test
3. **Ensure new features have tests** - Add tests for new functionality
4. **Run specific tests during development**:
   ```bash
   npm test -- path/to/test.test.ts  # Run specific test file
   npm run test:watch                # Watch mode for iterative development
   ```

### When to Update Documentation

Update documentation when:

- Adding new features or APIs
- Changing existing behavior
- Adding new npm scripts
- Modifying database schema
- Changing configuration

---

## Testing Requirements

All code must meet these testing standards:

### Unit Tests (Jest)

- **Must pass**: All unit tests must pass before committing
- **Coverage**: Maintain or improve test coverage
- **New features**: Write tests for new functionality
- **Bug fixes**: Add regression tests

```bash
npm test              # Run all tests once
npm run test:watch    # Run in watch mode
npm run test:coverage # Generate coverage report
```

### TypeScript Compilation

- **Zero errors**: TypeScript must compile without errors
- **Strict mode**: Follow strict TypeScript settings in `tsconfig.json`
- **Type safety**: Avoid `any` types when possible

```bash
npx tsc --noEmit      # Check types without emitting files
```

### Linting (ESLint)

- **Zero warnings**: ESLint must pass with `--max-warnings=0`
- **Auto-fix first**: Use `npm run test:lint:fix` for auto-fixable issues
- **Manual fixes**: Address remaining issues manually

```bash
npm run test:lint        # Check for issues
npm run test:lint:fix    # Auto-fix what's possible
npm run test:lint:ci     # CI mode (zero warnings)
```

### End-to-End Tests (Detox)

For UI changes, consider running E2E tests:

```bash
npm run test:ui:build    # Build app for E2E testing (required first)
npm run test:ui          # Run E2E tests
npm run test:ui:select   # Run specific E2E test
```

**Note**: E2E tests are slower but catch integration issues that unit tests miss.

---

## Code Quality Standards

### Follow Existing Patterns

This codebase has established patterns. **Always follow them**.

#### Repository Pattern for Database Access

All database operations go through repository classes:

```typescript
// ✅ GOOD: Use repository
import { EpisodeRepository } from '@/database/EpisodeRepository';

const episodes = await EpisodeRepository.getAll();

// ❌ BAD: Direct database access
const db = await SQLite.openDatabaseAsync('migralog.db');
const episodes = await db.getAllAsync('SELECT * FROM episodes');
```

**Repository locations**: `src/database/*Repository.ts`

#### State Management with Zustand

State management wraps repositories:

```typescript
// ✅ GOOD: Use Zustand store
import { useEpisodeStore } from '@/store/episodeStore';

const { episodes, loadEpisodes } = useEpisodeStore();

// ❌ BAD: Direct repository calls in components
import { EpisodeRepository } from '@/database/EpisodeRepository';
const episodes = await EpisodeRepository.getAll(); // Don't do this in components
```

**Store locations**: `src/store/*Store.ts`

#### Platform-Specific Files

Use `.platform.ext` pattern for platform-specific code:

```
db.ts         # iOS/Android implementation
db.web.ts     # Web implementation (no-op for MigraLog)
```

Metro bundler automatically selects the correct file based on platform.

### Naming Conventions

- **Files**: camelCase for utilities, PascalCase for components/classes
- **Components**: PascalCase (e.g., `EpisodeCard.tsx`)
- **Hooks**: camelCase starting with `use` (e.g., `useEpisodes.ts`)
- **Types/Interfaces**: PascalCase (e.g., `Episode`, `MedicationDose`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_INTENSITY`)

### Comments and Documentation

Add comments for:

- **Complex logic**: Explain the "why" not the "what"
- **Business rules**: Health data calculations, validation rules
- **Workarounds**: Platform-specific issues or temporary solutions
- **Public APIs**: JSDoc for exported functions/classes

```typescript
// ✅ GOOD: Explains why
// Filter out incomplete episodes (no end time) from statistics
// to avoid skewing average duration calculations
const completedEpisodes = episodes.filter(e => e.endTime !== null);

// ❌ BAD: States the obvious
// Filter episodes
const completedEpisodes = episodes.filter(e => e.endTime !== null);
```

### TypeScript Best Practices

- Use explicit types for function parameters and return values
- Leverage type inference for local variables
- Create types/interfaces in `src/models/` for reusability
- Use `unknown` instead of `any` when type is truly unknown

```typescript
// ✅ GOOD
function calculateAveragePain(episodes: Episode[]): number {
  // Implementation
}

// ❌ BAD
function calculateAveragePain(episodes: any): any {
  // Implementation
}
```

---

## Important Notes

### Platform Priority

**iOS is the primary development platform.**

- Test primarily on iOS simulator or device
- iOS-specific features take precedence
- Android compatibility is important but secondary
- Web version has limited functionality (database is no-op)

### Health Data Privacy

**This app handles sensitive health data subject to HIPAA requirements.**

Critical rules:

1. **NEVER log sensitive information**
   ```typescript
   // ❌ BAD: Logging health data
   console.log('Episode data:', episode);

   // ✅ GOOD: Log non-sensitive info only
   console.log('Episode loaded:', episode.id);
   ```

2. **Data storage**
   - All data stored locally by default (SQLite)
   - No cloud sync currently implemented
   - If adding cloud features, encryption at rest is required

3. **Security practices**
   - Never expose patient data in error messages
   - Sanitize data before logging
   - Follow security best practices for any backend integration

### Database Migrations

- Migrations run automatically on app start
- Automatic backups created before migration execution
- Migration files: `src/database/migrations.ts`
- **Never** modify existing migrations - create new ones
- Test migrations thoroughly with backup data

### Performance Considerations

- Tab bar styling assumes iPhone with home indicator
- Test on physical iOS devices for accurate performance
- SQLite queries should be optimized (use indexes)
- Minimize re-renders in React components

### Key Dependencies

- **React Native 0.81.5** - Mobile framework
- **Expo ~54** - Development tooling
- **TypeScript 5.9** - Type safety
- **SQLite** (expo-sqlite) - Offline-first storage
- **Zustand** - State management
- **React Navigation** - Routing
- **date-fns** - Date utilities

---

## Quick Reference

### Common Commands

```bash
# Development
npm start                    # Start Expo dev server
npm run ios                 # Run on iOS simulator
npm run android             # Run on Android emulator

# Quality Checks
npm run precommit           # REQUIRED before committing
npm run test:lint           # Run linter
npm run test:lint:fix       # Auto-fix lint issues
npx tsc --noEmit           # Check TypeScript types
npm test                    # Run unit tests

# Testing
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Generate coverage report
npm run test:ui:build      # Build for E2E tests
npm run test:ui            # Run E2E tests

# Building
npm run build:ios          # Build iOS with EAS
npm run submit:ios         # Submit to TestFlight
```

### File Structure

```
src/
├── components/         # Reusable UI components
├── database/          # SQLite + Repositories
├── models/            # TypeScript types
├── navigation/        # React Navigation
├── screens/           # Screen components
├── services/          # Business logic
├── store/             # Zustand state management
├── theme/             # Theme and colors
└── utils/             # Utility functions
```

### Need Help?

- Check existing code for patterns
- Review the main README.md for project overview
- Test changes thoroughly before committing
- When in doubt, ask for clarification

---

**Remember**: Run `npm run precommit` before every commit. Your future self (and your team) will thank you!
