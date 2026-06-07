# Testing Strategy

## Overview

For a static marketing website, testing can be done through:
1. **Manual browser testing** - Direct inspection
2. **Playwright** - Automated browser testing (recommended for AI assistant)
3. **Lighthouse** - Performance and accessibility audits

## Playwright for AI Assistant Testing

Playwright is the best option for me (Claude) to validate changes because:
- I can navigate and interact with the site programmatically
- I can take screenshots to verify visual appearance
- I can check for broken links, form functionality, etc.
- I can verify responsive design at different viewport sizes

### Setup Playwright

**Option 1: Standalone (No installation needed)**

I can use Playwright directly without any project setup. Just:
1. Start a local server: `cd website && python3 -m http.server 8000`
2. I'll use my Playwright tools to test

**Option 2: Project-based (For CI/CD)**

If you want to run tests in CI/CD:

```bash
# In project root
npm init -y
npm install -D @playwright/test
npx playwright install
```

### What I Can Test

When you ask me to test the website, I can:

✅ **Visual Validation**
- Take screenshots of the full page or specific sections
- Verify layout at different screen sizes (mobile, tablet, desktop)
- Check that mockups/placeholders render correctly

✅ **Functionality**
- Test email signup form (client-side validation)
- Verify all links work (internal anchors, external links)
- Check smooth scrolling behavior
- Test button clicks and interactions

✅ **Content**
- Verify all text content is present
- Check that headings and copy match specification
- Validate meta tags for SEO

✅ **Responsive Design**
- Test at iPhone, iPad, and desktop sizes
- Verify mobile menu works (if applicable)
- Check that layout doesn't break at various widths

✅ **Accessibility**
- Check heading hierarchy
- Verify form labels
- Test keyboard navigation
- Check color contrast (basic)

### Example Test Scenarios

**Scenario 1: Visual Regression**
```
"Take a screenshot of the hero section at desktop size"
"Take a full page screenshot at iPhone 16 Pro Max size"
```

**Scenario 2: Functionality**
```
"Test the email signup form with a valid email"
"Click all navigation links and verify they scroll to correct sections"
```

**Scenario 3: Responsive**
```
"Take screenshots at mobile, tablet, and desktop sizes"
"Verify the phone mockups display correctly on mobile"
```

**Scenario 4: Content Validation**
```
"Verify all hero section copy matches COPY.md"
"Check that all three feature cards are present"
```

## Manual Testing Checklist

For you to test manually:

### Desktop (1920×1080)
- [ ] Hero section displays correctly
- [ ] All three feature cards visible
- [ ] Phone mockups render properly
- [ ] Email form visible and styled
- [ ] Download buttons present
- [ ] Footer displays correctly
- [ ] Smooth scroll to sections works

### Mobile (iPhone 16 Pro Max - 430×932)
- [ ] Layout stacks vertically
- [ ] Phone mockups don't overflow
- [ ] Text is readable (not too small)
- [ ] Buttons are tappable (min 44px)
- [ ] Email form is usable
- [ ] No horizontal scrolling

### Tablet (iPad - 768×1024)
- [ ] Layout adapts appropriately
- [ ] All content visible and readable

### Interactions
- [ ] Email form validates email format
- [ ] Success message displays (placeholder)
- [ ] All anchor links scroll smoothly
- [ ] External links open in new tab (if applicable)

## Lighthouse Audit

Run Chrome Lighthouse for performance and accessibility:

1. Open website in Chrome
2. Open DevTools (F12)
3. Go to "Lighthouse" tab
4. Run audit for:
   - Performance
   - Accessibility
   - Best Practices
   - SEO

**Target Scores:**
- Performance: 90+
- Accessibility: 90+
- Best Practices: 90+
- SEO: 90+

## Testing Workflow

### When Making Changes

1. **Start local server**
   ```bash
   cd website && python3 -m http.server 8000
   ```

2. **Ask me to test**
   - "Test the website and take screenshots"
   - "Verify the email form works"
   - "Check responsive design at mobile size"

3. **I'll validate and report**
   - Take screenshots
   - Test functionality
   - Report any issues found

### Before Deployment

- [ ] Test on local server
- [ ] Run Lighthouse audit
- [ ] Test in multiple browsers (Chrome, Safari, Firefox)
- [ ] Test on actual mobile device
- [ ] Verify all placeholder content updated (if applicable)
- [ ] Check broken links

## CI/CD Testing (Optional)

If you want automated testing in GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Test Website

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Playwright
        run: |
          npm init -y
          npm install -D @playwright/test
          npx playwright install --with-deps chromium
      
      - name: Start server
        run: |
          cd website && python3 -m http.server 8000 &
          sleep 2
      
      - name: Run tests
        run: npx playwright test
      
      - name: Upload screenshots
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: screenshots
          path: screenshots/
```

## Best Approach for This Project

**Recommendation:**
1. **For development**: Ask me to test with Playwright (no setup needed)
2. **For quick checks**: Open in browser manually
3. **Before deployment**: Run Lighthouse audit
4. **Optional**: Add automated Playwright tests for CI/CD later

## How to Request Testing

Just ask me naturally:

- "Can you test the website?"
- "Take a screenshot of the hero section"
- "Test the email form"
- "Check if the website looks good on mobile"
- "Verify all the copy is correct"

I'll start a local server (or you can) and use Playwright to validate everything.
