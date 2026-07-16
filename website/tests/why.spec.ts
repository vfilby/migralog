import { test, expect } from '@playwright/test';

test.describe('Why page', () => {
  test('should load with the story heading and title', async ({ page }) => {
    await page.goto('/why.html');

    await expect(page).toHaveTitle(/Why MigraLog/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/three decades of migraines/i)).toBeVisible();
  });

  test('should be reachable from the homepage nav', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1280) < 900, 'nav links are hidden below 900px; phones navigate via the footer');
    await page.goto('/');

    const whyLink = page.locator('nav').getByRole('link', { name: 'Why', exact: true });
    await expect(whyLink).toHaveAttribute('href', '/why.html');

    await whyLink.click();
    await expect(page).toHaveURL(/\/why\.html$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should link back home and to the TestFlight beta', async ({ page }) => {
    await page.goto('/why.html');

    await expect(page.locator('nav').getByRole('link', { name: 'MigraLog home' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('link', { name: 'Join the public beta on TestFlight' })).toHaveAttribute(
      'href',
      'https://testflight.apple.com/join/UpVgBMcZ'
    );
  });
});
