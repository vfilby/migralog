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

    await expect(page.getByText('Understand today. Improve tomorrow.')).toBeVisible();
    await expect(page.getByText(/A patient-focused, private migraine tracker for iPhone/)).toBeVisible();

    const betaButton = page.locator('.hero').getByRole('link', { name: 'Join the private beta' });
    await expect(betaButton).toBeVisible();
    await expect(betaButton).toHaveAttribute('href', '#signup');

    const howItWorksButton = page.getByRole('link', { name: 'See how it works' });
    await expect(howItWorksButton).toBeVisible();
    await expect(howItWorksButton).toHaveAttribute('href', '#how-it-works');
  });

  test('should display the trust pills', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('On-device & private')).toBeVisible();
    await expect(page.getByText('No account, no ads')).toBeVisible();
    await expect(page.getByText('Free & open source')).toBeVisible();
  });

  test('should display the episode timeline showcase', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /episode/, level: 3 })).toBeVisible();
    await expect(page.getByText('last 30 days')).toBeVisible();
    await expect(page.getByText(/average episode/)).toBeVisible();
    await expect(page.getByText('No warning signs')).toBeVisible();
  });

  test('should display the screenshot carousel', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'A quick look inside' })).toBeVisible();

    const shot = page.locator('#car-img');
    await expect(shot).toBeVisible();
    await expect(shot).toHaveAttribute('alt', /.+/);

    await expect(page.getByRole('heading', { name: 'Every attack, as it unfolds', level: 3 })).toBeVisible();
    await expect(page.locator('#car-bullets li')).toHaveCount(3);
    await expect(page.locator('#car-dots button')).toHaveCount(3);
  });

  test('should display all four feature cards', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Tracking that keeps up with an attack.', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Intra-migraine timelines', level: 3 })).toBeVisible();
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

  test('should display private beta signup section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Start understanding the pattern.', level: 2 })).toBeVisible();
    await expect(page.getByText(/MigraLog is in private beta on iPhone/)).toBeVisible();
    await expect(page.getByPlaceholder('Your email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join the private beta' })).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');

    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'GitHub' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Contact' })).toBeVisible();
  });
});
