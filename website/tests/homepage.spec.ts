import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('MigraLog - Track Your Pain Timeline');
  });

  test('should display hero section with correct content', async ({ page }) => {
    await page.goto('/');
    
    const heroHeading = page.getByRole('heading', { name: 'MigraLog', level: 1 });
    await expect(heroHeading).toBeVisible();
    
    const heroSubheading = page.getByRole('heading', { name: 'Everything you need to get back to that better place', level: 2 });
    await expect(heroSubheading).toBeVisible();
    
    const heroDescription = page.getByText('MigraLog helps you understand your migraines and chronic pain');
    await expect(heroDescription).toBeVisible();
    
    const betaButton = page.getByRole('link', { name: 'Join Private Beta' });
    await expect(betaButton).toBeVisible();
    
    const learnMoreButton = page.getByRole('link', { name: 'Learn More' });
    await expect(learnMoreButton).toBeVisible();
  });

  test('should display all three core features', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Track how your pain evolves', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Designed for when you\'re in pain', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your health data belongs to you', level: 3 })).toBeVisible();
  });

  test('should display medication management section', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Never miss a dose', level: 2 })).toBeVisible();
    await expect(page.getByText('Medication tracking and reminders')).toBeVisible();
  });

  test('should display analytics coming soon section', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Statistics that matter', level: 2 })).toBeVisible();
    await expect(page.getByText('Coming Soon')).toBeVisible();
  });



  test('should display private beta signup section', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Join the MigraLog Private Beta', level: 2 })).toBeVisible();
    await expect(page.getByText('Private Beta')).toBeVisible();
    await expect(page.getByPlaceholder('Your email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request Beta Access' })).toBeVisible();
    await expect(page.getByText('Get early access to MigraLog and help shape the future')).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByText('Your pain timeline, your data')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contact' })).toBeVisible();
    await expect(page.getByText('© 2025 MigraLog. All rights reserved.')).toBeVisible();
  });
});
