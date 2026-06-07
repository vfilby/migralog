import { test, expect } from '@playwright/test';

test.describe('User Interactions', () => {
  test('should scroll to signup section when clicking "Get Updates"', async ({ page }) => {
    await page.goto('/');
    
    await page.getByRole('link', { name: 'Get Updates' }).click();
    
    await expect(page.getByRole('heading', { name: 'Stay updated on new features' })).toBeInViewport();
  });

  test('should scroll to download section when clicking "Download Now"', async ({ page }) => {
    await page.goto('/');
    
    await page.getByRole('link', { name: 'Download Now' }).click();
    
    await expect(page.getByRole('heading', { name: 'Start tracking today' })).toBeInViewport();
  });

  test('should accept email input and show success message', async ({ page }) => {
    await page.goto('/');
    
    const emailInput = page.getByPlaceholder('Your email address');
    await emailInput.fill('test@example.com');
    
    await page.getByRole('button', { name: 'Sign Up' }).click();
    
    await expect(page.getByText(/Email signup integration pending/)).toBeVisible();
    await expect(page.getByText(/test@example.com/)).toBeVisible();
  });

  test('should validate email format (HTML5 validation)', async ({ page }) => {
    await page.goto('/');
    
    const emailInput = page.getByPlaceholder('Your email address');
    await emailInput.fill('invalid-email');
    
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    
    await page.getByRole('button', { name: 'Sign Up' }).click();
    
    expect(validationMessage).toBeTruthy();
  });

  test('should require email before submission', async ({ page }) => {
    await page.goto('/');
    
    const emailInput = page.getByPlaceholder('Your email address');
    
    const isRequired = await emailInput.evaluate((el: HTMLInputElement) => el.required);
    expect(isRequired).toBe(true);
  });
});
