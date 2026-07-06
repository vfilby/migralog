import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const heroHeading = page.getByRole('heading', { name: 'Make sense of your migraines.', level: 1 });
    await expect(heroHeading).toBeVisible();

    const box = await heroHeading.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(375);
    }
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Make sense of your migraines.', level: 1 })).toBeVisible();
    await expect(page.getByText('Understand today. Improve tomorrow.')).toBeVisible();
  });

  test('should display correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Make sense of your migraines.', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Features' })).toBeVisible();
  });

  test('should stack hero CTAs vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const betaButton = page.locator('.hero').getByRole('link', { name: 'Join the private beta' });
    const howItWorksButton = page.getByRole('link', { name: 'See how it works' });

    const betaBox = await betaButton.boundingBox();
    const howBox = await howItWorksButton.boundingBox();

    expect(betaBox).toBeTruthy();
    expect(howBox).toBeTruthy();
    if (betaBox && howBox) {
      // Column layout on mobile: "See how it works" renders below the beta CTA.
      expect(howBox.y).toBeGreaterThan(betaBox.y);
    }
  });

  test('should collapse the nav link row on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Nav link row collapses below 900px; brand and beta pill remain.
    await expect(page.locator('nav .links')).toBeHidden();
    await expect(page.getByRole('link', { name: 'MigraLog home' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Join the beta' })).toBeVisible();
  });
});
