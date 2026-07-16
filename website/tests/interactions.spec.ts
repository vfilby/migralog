import { test, expect } from '@playwright/test';

test.describe('User Interactions', () => {
  test('should scroll to signup section when clicking the "Join the beta" nav pill', async ({ page }) => {
    await page.goto('/');

    await page.locator('nav').getByRole('link', { name: 'Join the beta' }).click();

    await expect(page.getByRole('heading', { name: 'Start understanding the pattern.' })).toBeInViewport();
  });

  test('should advance the carousel with next/prev and dots', async ({ page }) => {
    await page.goto('/');

    // The episode timeline leads the carousel.
    await expect(page.getByRole('heading', { name: 'Every attack, as it unfolds', level: 3 })).toBeVisible();
    await expect(page.locator('#car-img')).toHaveAttribute('src', /episode-details/);

    await page.getByRole('button', { name: 'Next screenshot' }).click();
    await expect(page.getByRole('heading', { name: 'Dose tracking that knows your limits', level: 3 })).toBeVisible();
    await expect(page.locator('#car-img')).toHaveAttribute('src', /med-limits/);

    // Prev from med-limits → episode → wraps to the last slide (doctor summary).
    await page.getByRole('button', { name: 'Previous screenshot' }).click();
    await page.getByRole('button', { name: 'Previous screenshot' }).click();
    await expect(page.getByRole('heading', { name: 'A summary built for your doctor', level: 3 })).toBeVisible();

    await page.getByRole('button', { name: /Screenshot 1 of/ }).click();
    await expect(page.getByRole('heading', { name: 'Every attack, as it unfolds', level: 3 })).toBeVisible();
  });

  test('should open the screenshot lightbox from the phone and close it', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'View screenshot full size' }).click();

    const modal = page.locator('#car-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Every attack, as it unfolds', level: 3 })).toBeVisible();
    await expect(modal.locator('#modal-bullets li')).toHaveCount(3);

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(modal).toBeHidden();

    // Reopen and close with Escape.
    await page.getByRole('button', { name: 'View screenshot full size' }).click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('should link straight to the TestFlight beta', async ({ page }) => {
    await page.goto('/');

    const cta = page.getByRole('link', { name: 'Join the public beta on TestFlight' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', 'https://testflight.apple.com/join/UpVgBMcZ');
    await expect(cta).toHaveAttribute('target', '_blank');
    await expect(cta).toHaveAttribute('rel', 'noopener');
  });
});
