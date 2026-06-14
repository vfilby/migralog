import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const heroHeading = page.getByRole('heading', { name: 'MigraLog', level: 1 });
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

    await expect(page.getByRole('heading', { name: 'MigraLog', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Understand today. Improve tomorrow.', level: 2 })).toBeVisible();
  });

  test('should display correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'MigraLog', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Understand today. Improve tomorrow.', level: 2 })).toBeVisible();
  });

  test('should stack hero CTAs vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const betaButton = page.getByRole('link', { name: /join migralog private beta/i });
    const learnMoreButton = page.getByRole('link', { name: /learn more about migralog/i });

    const betaBox = await betaButton.boundingBox();
    const learnMoreBox = await learnMoreButton.boundingBox();

    expect(betaBox).toBeTruthy();
    expect(learnMoreBox).toBeTruthy();
    if (betaBox && learnMoreBox) {
      // flex-col on mobile: "Learn More" renders below "Join Private Beta".
      expect(learnMoreBox.y).toBeGreaterThan(betaBox.y);
    }
  });
});
