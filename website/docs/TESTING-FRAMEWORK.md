# Testing Framework

## Overview

This project uses Playwright for automated testing to prevent regressions and ensure the website works correctly across browsers and devices.

## Setup

### Install Dependencies

```bash
npm install
npx playwright install
```

This installs Playwright and the necessary browser binaries.

## Running Tests

### Run All Tests

```bash
npm test
```

This will:
1. Start a local server on port 8000
2. Run all tests across all configured browsers (Chrome, Firefox, Safari, Mobile)
3. Generate a test report

### Run Tests with UI

```bash
npm run test:ui
```

Opens Playwright's interactive UI for running and debugging tests.

### Run Tests in Headed Mode

```bash
npm run test:headed
```

Runs tests with visible browsers (useful for debugging).

### Run Specific Test File

```bash
npx playwright test tests/homepage.spec.ts
```

### Run Tests for Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
npx playwright test --project=mobile-chrome
npx playwright test --project=mobile-safari
```

### Update Visual Snapshots

When you intentionally change the UI:

```bash
npx playwright test --update-snapshots
```

This updates the baseline screenshots for visual regression tests.

## Test Structure

### Test Files

All tests are in the `tests/` directory:

```
tests/
├── homepage.spec.ts      # Content and layout tests
├── interactions.spec.ts  # User interaction tests
├── responsive.spec.ts    # Responsive design tests
└── visual.spec.ts        # Visual regression tests
```

### Test Categories

#### 1. Content Tests (homepage.spec.ts)
Verifies all content is present:
- Hero section with correct copy
- All three core features
- Medication management section
- Analytics section
- Use cases
- Email signup
- Download section
- Footer

#### 2. Interaction Tests (interactions.spec.ts)
Tests user interactions:
- Smooth scroll navigation
- Email form submission
- Email validation
- Form field requirements

#### 3. Responsive Tests (responsive.spec.ts)
Validates responsive design:
- Mobile viewport (375×667)
- Tablet viewport (768×1024)
- Desktop viewport (1920×1080)
- Element stacking on mobile

#### 4. Visual Regression Tests (visual.spec.ts)
Screenshot comparisons:
- Full page desktop
- Full page mobile
- Hero section

## Browser Coverage

Tests run on:
- **Desktop Chrome** (Chromium)
- **Desktop Firefox**
- **Desktop Safari** (WebKit)
- **Mobile Chrome** (Pixel 5)
- **Mobile Safari** (iPhone 13)

## Continuous Integration

### GitHub Actions Integration

Tests run automatically on pull requests. Add to `.github/workflows/test.yml`:

```yaml
name: Test Website

on: [pull_request, push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Run tests
        run: npm test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Writing New Tests

### Example: Testing a New Section

```typescript
import { test, expect } from '@playwright/test';

test('should display new feature section', async ({ page }) => {
  await page.goto('/');
  
  // Check heading exists
  await expect(page.getByRole('heading', { name: 'New Feature' })).toBeVisible();
  
  // Check content is present
  await expect(page.getByText('Feature description')).toBeVisible();
  
  // Check interaction works
  await page.getByRole('button', { name: 'Try It' }).click();
  await expect(page.getByText('Success!')).toBeVisible();
});
```

### Best Practices

1. **Use semantic selectors**: Prefer `getByRole()`, `getByLabel()`, `getByText()` over CSS selectors
2. **Test user behavior**: Focus on what users do, not implementation details
3. **Keep tests independent**: Each test should work standalone
4. **Use meaningful names**: Test names should describe what they verify
5. **Avoid hardcoded waits**: Use Playwright's auto-waiting features

## Visual Regression Testing

### How It Works

1. First run: Playwright takes baseline screenshots
2. Subsequent runs: Compares current screenshots to baseline
3. Fails if differences detected (beyond threshold)

### Managing Snapshots

Snapshots are stored in `tests/*.spec.ts-snapshots/`:
- Committed to git
- Different snapshots per browser
- Updated with `--update-snapshots` flag

### When to Update Snapshots

✅ **Update when:**
- Intentional design changes
- Content updates
- Layout improvements

❌ **Don't update when:**
- Tests fail unexpectedly
- Visual bugs appear
- Investigating regressions

## Debugging Failed Tests

### View Test Report

After test failure:
```bash
npx playwright show-report
```

Opens HTML report with:
- Test results
- Screenshots on failure
- Trace viewer
- Error messages

### Debug Specific Test

```bash
npx playwright test tests/homepage.spec.ts --debug
```

Opens Playwright Inspector for step-by-step debugging.

### View Test Traces

Traces are captured on first retry. View with:
```bash
npx playwright show-trace trace.zip
```

## Test Configuration

Configuration in `playwright.config.ts`:

```typescript
{
  testDir: './tests',           // Test directory
  fullyParallel: true,          // Run tests in parallel
  retries: 2,                   // Retry failed tests in CI
  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',    // Capture trace on retry
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'cd website && python3 -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: true,  // Don't start if already running
  },
}
```

## Common Issues

### Port Already in Use

If port 8000 is busy:
```bash
# Find and kill process
lsof -ti:8000 | xargs kill -9
```

Or change port in `playwright.config.ts`.

### Browsers Not Installed

```bash
npx playwright install
```

### Tests Pass Locally, Fail in CI

- Check for timing issues (use proper waits)
- Verify browser versions match
- Check for environment-specific issues

## Preventing Regressions

### Pre-commit Hook (Optional)

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
npm test
if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
```

### Pull Request Checks

Configure GitHub to require tests pass before merging.

## Cost of Testing

- **Development**: ~5-10 minutes initial setup
- **Per test run**: ~30-60 seconds for all tests
- **Maintenance**: Update snapshots when UI changes intentionally

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Install browsers: `npx playwright install`
3. ✅ Run tests: `npm test`
4. ✅ Add to CI/CD pipeline
5. ✅ Write tests for new features as you build them
