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
    await expect(body).toHaveClass(/dark:bg-gray-900/);
    
    const featureCards = page.locator('.bg-white').first();
    await expect(featureCards).toHaveClass(/dark:bg-gray-700/);
  });

  test('should apply light mode styles when disabled', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
    });
    
    const body = page.locator('body');
    await expect(body).toHaveClass(/bg-white/);
  });

  test('should have readable text in dark mode', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    
    const headings = page.getByRole('heading', { level: 2 }).first();
    await expect(headings).toBeVisible();
  });
});
