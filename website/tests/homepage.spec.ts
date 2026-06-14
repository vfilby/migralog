import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('MigraLog - Understand today. Improve tomorrow. | Migraine Tracking App');
  });

  test('should display hero section with correct content', async ({ page }) => {
    await page.goto('/');

    const heroHeading = page.getByRole('heading', { name: 'MigraLog', level: 1 });
    await expect(heroHeading).toBeVisible();

    const heroSubheading = page.getByRole('heading', { name: 'Understand today. Improve tomorrow.', level: 2 });
    await expect(heroSubheading).toBeVisible();

    const heroDescription = page.getByText(/After 3 decades of migraines/);
    await expect(heroDescription).toBeVisible();

    // Hero CTAs carry aria-labels, so match by accessible name.
    const betaButton = page.getByRole('link', { name: /join migralog private beta/i });
    await expect(betaButton).toBeVisible();
    await expect(betaButton).toHaveAttribute('href', '#signup');

    const learnMoreButton = page.getByRole('link', { name: /learn more about migralog/i });
    await expect(learnMoreButton).toBeVisible();
    await expect(learnMoreButton).toHaveAttribute('href', '#features');
  });

  test('should display all three core features', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Track or add notes to ongoing episodes', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Track preventative medications', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Track pain-free days', level: 3 })).toBeVisible();
  });

  test('should display the features dashboard heading', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Your daily dashboard for managing pain', level: 2 })).toBeVisible();
  });

  test('should display medication management section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Smart medication tracking', level: 2 })).toBeVisible();
    await expect(page.getByText('Smart autocomplete for common migraine medications')).toBeVisible();
  });

  test('should display trends and analytics section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Trends and Analytics', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Summary statistics for your doctor', level: 2 })).toBeVisible();
  });

  test('should display the data privacy section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Your data, your control', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Data Lives on Your Device', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Works Offline', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Export Everything', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dark Mode Support', level: 3 })).toBeVisible();
  });

  test('should display private beta signup section', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Join the MigraLog Private Beta', level: 2 })).toBeVisible();
    await expect(page.getByText(/Get early access to MigraLog/)).toBeVisible();
    await expect(page.getByPlaceholder('Your email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request Beta Access' })).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');

    const footer = page.getByRole('contentinfo');
    await expect(footer.getByText('Understand today. Improve tomorrow.')).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Contact' })).toBeVisible();
    await expect(footer.getByText('© 2025 MigraLog. All rights reserved.')).toBeVisible();
  });
});
