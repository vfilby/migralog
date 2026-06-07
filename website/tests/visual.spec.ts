import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
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
