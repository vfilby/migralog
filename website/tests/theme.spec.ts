import { test, expect } from '@playwright/test';

const LIGHT_BG = 'rgb(244, 242, 237)'; // --bg light #f4f2ed
const DARK_BG = 'rgb(22, 23, 27)'; // --bg dark #16171b

function bodyBackground(page: import('@playwright/test').Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test.describe('Theme', () => {
  test('should follow the system preference by default', async ({ page, colorScheme }) => {
    await page.goto('/');

    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
    expect(await bodyBackground(page)).toBe(colorScheme === 'dark' ? DARK_BG : LIGHT_BG);
  });

  test('should switch to dark mode and persist the choice', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    await page.getByRole('button', { name: 'Dark theme' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bodyBackground(page)).toBe(DARK_BG);
    await expect(page.getByRole('button', { name: 'Dark theme' })).toHaveAttribute('aria-pressed', 'true');

    // The choice survives a reload without a flash of the wrong theme.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bodyBackground(page)).toBe(DARK_BG);
  });

  test('should force light mode even when the system is dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    await page.getByRole('button', { name: 'Light theme' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
  });

  test('should return to system preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    await page.getByRole('button', { name: 'Dark theme' }).click();
    await page.getByRole('button', { name: 'Follow system theme' }).click();

    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
    expect(await bodyBackground(page)).toBe(DARK_BG); // system is dark

    await page.emulateMedia({ colorScheme: 'light' });
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
  });

  test('should swap carousel screenshots to match the theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    await expect(page.locator('#car-img')).toHaveAttribute('src', /-light\.png$/);

    await page.getByRole('button', { name: 'Dark theme' }).click();
    await expect(page.locator('#car-img')).toHaveAttribute('src', /-dark\.png$/);
  });
});
