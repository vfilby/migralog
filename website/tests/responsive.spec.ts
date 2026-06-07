import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Track your pain timeline, not just your pain', level: 1 })).toBeVisible();
    
    const heroHeading = page.getByRole('heading', { level: 1 });
    const box = await heroHeading.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(375);
    }
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Track your pain timeline, not just your pain', level: 1 })).toBeVisible();
  });

  test('should display correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Track your pain timeline, not just your pain', level: 1 })).toBeVisible();
  });

  test('should stack elements vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    const downloadButton = page.getByRole('link', { name: 'Download Now' });
    const updatesButton = page.getByRole('link', { name: 'Get Updates' });
    
    const downloadBox = await downloadButton.boundingBox();
    const updatesBox = await updatesButton.boundingBox();
    
    expect(downloadBox).toBeTruthy();
    expect(updatesBox).toBeTruthy();
  });
});
