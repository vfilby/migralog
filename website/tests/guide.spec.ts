import { test, expect } from '@playwright/test';

test.describe('User guide', () => {
  test('should load with the four articles from the shared source', async ({ page }) => {
    await page.goto('/guide/');

    await expect(page).toHaveTitle('User Guide | MigraLog');
    await expect(page.getByRole('heading', { name: 'Using MigraLog', level: 1 })).toBeVisible();

    // One <section> per article, mirroring the in-app User Guide order.
    for (const id of ['tracking-philosophy', 'medications', 'calendar', 'trends-and-analytics']) {
      await expect(page.locator(`section#${id}`)).toHaveCount(1);
    }
  });

  test('should render the contents sidebar with in-page anchors', async ({ page }) => {
    await page.goto('/guide/');

    const toc = page.locator('.guide-toc');
    await expect(toc.getByRole('link', { name: 'How tracking works' })).toHaveAttribute('href', '#tracking-philosophy');
    await expect(toc.getByRole('link', { name: 'The calendar' })).toHaveAttribute('href', '#calendar');

    await toc.getByRole('link', { name: 'The calendar' }).click();
    await expect(page.locator('section#calendar')).toBeInViewport();
  });

  test('should render Markdown constructs (table, nested list, blockquote)', async ({ page }) => {
    await page.goto('/guide/');

    // The GFM table in calendar.md.
    await expect(page.locator('section#calendar table')).toBeVisible();
    await expect(page.locator('section#calendar table th')).toHaveCount(3);

    // Nested list under "Not Clear".
    await expect(page.locator('section#calendar li ul li').first()).toBeVisible();

    // Blockquotes render as callouts.
    await expect(page.locator('section#calendar blockquote').first()).toBeVisible();
  });

  test('should rewrite intra-guide .md links to in-page anchors', async ({ page }) => {
    await page.goto('/guide/');

    // No raw .md links survive the build.
    await expect(page.locator('a[href$=".md"]')).toHaveCount(0);

    // Cross-references resolve to sections on this same page.
    const crossRef = page.locator('section#calendar a[href="#trends-and-analytics"]').first();
    await expect(crossRef).toHaveCount(1);
  });

  test('should not scroll horizontally on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/guide/');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // The contents sidebar is a <nav>; it must not inherit the top-bar's
    // flex-row / fixed-height styling (that made the list escape its card).
    await expect(page.locator('.guide-toc')).toHaveCSS('display', 'block');
  });

  test('should link back to the homepage', async ({ page }) => {
    await page.goto('/guide/');

    await expect(page.locator('nav').getByRole('link', { name: 'MigraLog home' })).toHaveAttribute('href', '/');
    if ((page.viewportSize()?.width ?? 1280) >= 900) {
      // The text nav links are hidden below 900px; phones navigate via the footer.
      await expect(page.locator('nav').getByRole('link', { name: 'User guide' })).toHaveAttribute('href', '/guide/');
    }
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'User guide' })).toHaveAttribute('href', '/guide/');
  });
});
