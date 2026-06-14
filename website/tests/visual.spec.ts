import { test, expect } from '@playwright/test';

// Tagged @visual so the deploy pipeline can exclude it (--grep-invert @visual).
// Snapshots are platform-specific (chromium-darwin) and pixel-diff tests are the
// wrong fit for a live-site deploy gate; run these locally during dev instead.
test.describe('Visual Regression @visual', () => {
  test('should match homepage screenshot on desktop', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage-desktop.png', { fullPage: true });
  });

  test('should match homepage screenshot on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage-mobile.png', { fullPage: true });
  });

  test('should match hero section screenshot', async ({ page }) => {
    await page.goto('/');
    const heroSection = page.locator('section').first();
    await expect(heroSection).toHaveScreenshot('hero-section.png');
  });
});
