import { test, expect } from '@playwright/test';

test.describe('User Interactions', () => {
  test('should scroll to signup section when clicking "Join Private Beta"', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /join migralog private beta/i }).click();

    await expect(page.getByRole('heading', { name: 'Join the MigraLog Private Beta' })).toBeInViewport();
  });

  test('should scroll to features section when clicking "Learn More"', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /learn more about migralog/i }).click();

    await expect(page.getByRole('heading', { name: 'Your daily dashboard for managing pain' })).toBeInViewport();
  });

  test('should accept email input', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.getByPlaceholder('Your email address');
    await emailInput.fill('test@example.com');

    await expect(emailInput).toHaveValue('test@example.com');
  });

  test('should show success message after a successful beta request', async ({ page }) => {
    // Intercept the Formspree submission so the test never hits the real
    // endpoint, and assert the client-side success handling.
    await page.route('**/formspree.io/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    );

    await page.goto('/');

    await page.getByPlaceholder('Your email address').fill('test@example.com');
    await page.getByRole('button', { name: 'Request Beta Access' }).click();

    await expect(page.getByText(/Thanks for requesting beta access/)).toBeVisible();
  });

  test('should show an error message when the submission fails', async ({ page }) => {
    await page.route('**/formspree.io/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'boom' }),
      })
    );

    await page.goto('/');

    await page.getByPlaceholder('Your email address').fill('test@example.com');
    await page.getByRole('button', { name: 'Request Beta Access' }).click();

    await expect(page.getByText(/there was an error/i)).toBeVisible();
  });

  test('should validate email format (HTML5 validation)', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.getByPlaceholder('Your email address');
    await emailInput.fill('invalid-email');

    await page.getByRole('button', { name: 'Request Beta Access' }).click();

    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });

  test('should require email before submission', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.getByPlaceholder('Your email address');

    const isRequired = await emailInput.evaluate((el: HTMLInputElement) => el.required);
    expect(isRequired).toBe(true);
  });
});
