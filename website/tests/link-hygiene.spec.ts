import { test, expect } from '@playwright/test';

/**
 * Link/asset hygiene. The CDN serves index.html as the 404 error document,
 * so a page can be rendered at ANY path (e.g. /guide/guide/guide/). Relative
 * URLs resolve against that bogus path and compound on every click, and
 * relative image paths 404. The invariant that prevents the whole class of
 * bug: every internal URL on every page must be root-absolute.
 */

const PAGES = ['/', '/why.html', '/guide/', '/contact.html'];

const OK_URL = /^(\/|#|https?:|mailto:|data:)/;

for (const path of PAGES) {
  test(`all URLs on ${path} are root-absolute`, async ({ page }) => {
    await page.goto(path);

    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      const check = (el: Element, attr: string) => {
        const v = el.getAttribute(attr);
        if (v && !/^(\/|#|https?:|mailto:|data:)/.test(v)) {
          bad.push(`<${el.tagName.toLowerCase()} ${attr}="${v}">`);
        }
      };
      document.querySelectorAll('a[href]').forEach((el) => check(el, 'href'));
      document.querySelectorAll('link[href]').forEach((el) => check(el, 'href'));
      document.querySelectorAll('img[src]').forEach((el) => check(el, 'src'));
      document.querySelectorAll('script[src]').forEach((el) => check(el, 'src'));
      document.querySelectorAll('source[srcset]').forEach((el) => check(el, 'srcset'));
      return bad;
    });

    expect(offenders, `Relative URLs break under the CDN 404 fallback:\n${offenders.join('\n')}`).toEqual([]);
  });

  test(`all images on ${path} actually load`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('load');

    const broken = await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll('img'))
        // Deferred images (e.g. the lightbox img) may sit hidden with an empty
        // src until they're populated; only an empty src on a VISIBLE img is
        // a bug. The carousel/lightbox test covers the deferred ones.
        .filter((img) => img.getAttribute('src') || img.checkVisibility());
      await Promise.all(
        imgs.map((img) =>
          img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = res; })
        )
      );
      return imgs.filter((img) => img.naturalWidth === 0).map((img) => img.src || '(empty src)');
    });

    expect(broken, `Images that failed to load:\n${broken.join('\n')}`).toEqual([]);
  });
}

test('every carousel slide image loads in both themes', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');

    const dots = page.locator('#car-dots button');
    const count = await dots.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await dots.nth(i).click();
      const img = page.locator('#car-img');
      await expect(img).toBeVisible();
      await expect
        .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), {
          message: `slide ${i} (${scheme}) image did not load`,
        })
        .toBeGreaterThan(0);
    }
  }
});

test('social/canonical metas point at migralog.app and og-image exists', async ({ page }) => {
  await page.goto('/');

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonical).toBe('https://migralog.app/');

  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(ogImage).toBe('https://migralog.app/og-image.png');

  // The image must exist in THIS deploy (fetch it from the origin under test).
  const res = await page.request.get('/og-image.png');
  expect(res.status()).toBe(200);
});
