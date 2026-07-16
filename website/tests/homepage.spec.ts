import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('MigraLog - Make sense of your migraines | Private Migraine Tracker for iPhone');
  });

  test('should display hero section with correct content', async ({ page }) => {
    await page.goto('/');

    const heroHeading = page.getByRole('heading', { name: 'Make sense of your migraines.', level: 1 });
    await expect(heroHeading).toBeVisible();

    await expect(page.getByText(/A patient-focused, private migraine tracker for iPhone/)).toBeVisible();
  });

  test('should link to the user guide from the nav', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1280) < 900, 'nav links are hidden below 900px; phones navigate via the footer');
    await page.goto('/');

    const guideLink = page.locator('nav').getByRole('link', { name: 'User guide' });
    await expect(guideLink).toBeVisible();
    await expect(guideLink).toHaveAttribute('href', 'guide/');

    await guideLink.click();
    await expect(page).toHaveURL(/\/guide\/$/);
    await expect(page.getByRole('heading', { name: 'Using MigraLog', level: 1 })).toBeVisible();
  });

  test('should display the trust pills', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('On-device & private')).toBeVisible();
    await expect(page.getByText('No account, no ads')).toBeVisible();
    await expect(page.getByText('Free & open source')).toBeVisible();
  });

  test('should display the screenshot carousel', async ({ page }) => {
    await page.goto('/');

    const shot = page.locator('#car-img');
    await expect(shot).toBeVisible();
    await expect(shot).toHaveAttribute('alt', /.+/);

    await expect(page.getByRole('heading', { name: 'Every attack, as it unfolds', level: 3 })).toBeVisible();
    await expect(page.locator('#car-bullets li')).toHaveCount(3);
    await expect(page.locator('#car-dots button')).toHaveCount(5);
  });

  test('should show the doctor-summary PDF as a document (last slide)', async ({ page }) => {
    await page.goto('/');

    // Advance to the last slide via its dot (count-agnostic).
    await page.locator('#car-dots button').last().click();

    await expect(page.getByRole('heading', { name: 'A summary built for your doctor', level: 3 })).toBeVisible();
    // The PDF slide uses a single theme-agnostic document image (no -light/-dark),
    // framed as a paper document rather than a phone.
    await expect(page.locator('#car-img')).toHaveAttribute('src', /doctor-summary\.png$/);
    await expect(page.locator('#car-img').locator('xpath=ancestor::span[contains(@class,"dphone")]')).toHaveClass(/as-doc/);
  });

  test('should display all four feature cards', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Tracking that keeps up with an attack.', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A timeline for every attack', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Visualizations you'll read", level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reminders that respect rebound', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Exports without lock-in', level: 3 })).toBeVisible();
  });

  test('should display the privacy section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Private by default — and open about it.', level: 2 })).toBeVisible();
    await expect(page.getByText('Stays on your device')).toBeVisible();
    await expect(page.getByText('Yours to export')).toBeVisible();
    await expect(page.getByText(/three decades of migraines/)).toBeVisible();
  });

  test('should display the public beta section with the TestFlight link', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Start understanding the pattern.', level: 2 })).toBeVisible();
    await expect(page.getByText(/MigraLog is in public beta on iPhone/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Join the public beta on TestFlight' })).toHaveAttribute(
      'href',
      'https://testflight.apple.com/join/UpVgBMcZ'
    );
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');

    const footer = page.getByRole('contentinfo');
    // Why and the user guide must be in the footer: the nav links are hidden
    // below 900px, so on phones the footer is the only path to those pages.
    await expect(footer.getByRole('link', { name: 'Why', exact: true })).toHaveAttribute('href', 'why.html');
    await expect(footer.getByRole('link', { name: 'User guide' })).toHaveAttribute('href', 'guide/');
    await expect(footer.getByRole('link', { name: 'GitHub' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Contact' })).toBeVisible();
  });
});
