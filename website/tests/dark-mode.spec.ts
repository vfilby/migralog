import { test, expect } from '@playwright/test';

test.describe('Dark Mode', () => {
  test('should follow system preference by default', async ({ page, colorScheme }) => {
    await page.goto('/');

    const html = page.locator('html');

    if (colorScheme === 'dark') {
      await expect(html).toHaveClass(/dark/);
    } else {
      await expect(html).not.toHaveClass(/dark/);
    }
  });

  test('should apply dark mode styles when enabled', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });

    const body = page.locator('body');
    await expect(body).toHaveClass(/dark:bg-black/);

    // Scope to the features section: a bare `.bg-white` would match <body>.
    const featureCard = page.locator('#features .bg-white').first();
    await expect(featureCard).toHaveClass(/dark:bg-gray-700/);
  });

  test('should apply light mode styles when disabled', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
    });

    const body = page.locator('body');
    await expect(body).toHaveClass(/bg-white/);
  });

  test('should toggle theme via the theme toggle button', async ({ page }) => {
    await page.goto('/');

    // Normalize to a known starting state (light) before toggling.
    await page.evaluate(() => document.documentElement.classList.remove('dark'));

    const html = page.locator('html');
    const toggle = page.getByRole('button', { name: 'Toggle dark mode' });

    await toggle.click();
    await expect(html).toHaveClass(/dark/);

    await toggle.click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test('should have readable headings in dark mode', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });

    const heading = page.getByRole('heading', { level: 2 }).first();
    await expect(heading).toBeVisible();
  });
});
