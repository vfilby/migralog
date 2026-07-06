import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto('http://localhost:8123/', { waitUntil: 'networkidle' });
await page.screenshot({ path: process.env.OUT + '/desktop-full.png', fullPage: true });
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto('http://localhost:8123/', { waitUntil: 'networkidle' });
await m.screenshot({ path: process.env.OUT + '/mobile-full.png', fullPage: true });
await browser.close();
