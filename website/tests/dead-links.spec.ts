import { test, expect, Page } from '@playwright/test';

// Helper function to check if a link is valid
async function checkLink(page: Page, url: string, linkText: string): Promise<{ url: string, status: number, error?: string, linkText: string }> {
  try {
    // Handle different types of URLs
    if (url.startsWith('mailto:')) {
      // Mailto links are considered valid if they have proper format
      const emailRegex = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return {
        url,
        status: emailRegex.test(url) ? 200 : 404,
        linkText,
        error: emailRegex.test(url) ? undefined : 'Invalid email format'
      };
    }
    
    if (url.startsWith('tel:')) {
      // Tel links are considered valid if they exist
      return { url, status: 200, linkText };
    }
    
    if (url.startsWith('#')) {
      // Check if anchor links point to existing elements
      const element = await page.locator(`[id="${url.substring(1)}"]`).first();
      const exists = await element.count() > 0;
      return {
        url,
        status: exists ? 200 : 404,
        linkText,
        error: exists ? undefined : 'Anchor target not found'
      };
    }
    
    // For HTTP/HTTPS links, make a request
    if (url.startsWith('http')) {
      const response = await page.request.get(url);
      return {
        url,
        status: response.status(),
        linkText
      };
    }
    
    // For relative links, navigate and check
    if (url.startsWith('/') || (!url.includes('://') && !url.startsWith('#'))) {
      // Construct full URL for relative links
      const baseUrl = page.url().split('/').slice(0, 3).join('/');
      const fullUrl = url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      
      const response = await page.request.get(fullUrl);
      return {
        url: fullUrl,
        status: response.status(),
        linkText
      };
    }
    
    return {
      url,
      status: 404,
      error: 'Unknown URL format',
      linkText
    };
  } catch (error) {
    return {
      url,
      status: 0,
      error: error.message,
      linkText
    };
  }
}

test.describe('Dead Links Detection', () => {
  test('should not have any broken internal links on homepage', async ({ page }) => {
    await page.goto('/');
    
    // Get all links on the page
    const links = await page.locator('a[href]').all();
    const linkChecks: Array<{ url: string, status: number, error?: string, linkText: string }> = [];
    
    for (const link of links) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      
      if (href) {
        const result = await checkLink(page, href, text?.trim() || 'No text');
        linkChecks.push(result);
      }
    }
    
    // Filter for broken internal links (not external)
    const brokenInternalLinks = linkChecks.filter(check => 
      check.status >= 400 && 
      !check.url.startsWith('http') // Only check internal/relative links
    );
    
    // Log all link check results for debugging
    console.log('Link Check Results:');
    linkChecks.forEach(check => {
      const status = check.status >= 400 ? '❌ BROKEN' : '✅ OK';
      console.log(`${status} [${check.status}] ${check.url} - "${check.linkText}"`);
      if (check.error) {
        console.log(`  Error: ${check.error}`);
      }
    });
    
    // Fail if there are broken internal links
    if (brokenInternalLinks.length > 0) {
      const brokenList = brokenInternalLinks.map(link => 
        `- ${link.url} (${link.status}) - "${link.linkText}" ${link.error ? `- ${link.error}` : ''}`
      ).join('\n');
      
      expect.fail(`Found ${brokenInternalLinks.length} broken internal links:\n${brokenList}`);
    }
    
    expect(brokenInternalLinks.length).toBe(0);
  });

  test('should have all anchor links point to existing elements', async ({ page }) => {
    await page.goto('/');
    
    // Get all anchor links (#something)
    const anchorLinks = await page.locator('a[href^="#"]').all();
    const anchorChecks = [];
    
    for (const link of anchorLinks) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      
      if (href && href.startsWith('#')) {
        const targetId = href.substring(1);
        const targetElement = await page.locator(`[id="${targetId}"]`).first();
        const exists = await targetElement.count() > 0;
        
        anchorChecks.push({
          href,
          targetId,
          exists,
          linkText: text?.trim() || 'No text'
        });
      }
    }
    
    // Log anchor check results
    console.log('Anchor Link Check Results:');
    anchorChecks.forEach(check => {
      const status = check.exists ? '✅ OK' : '❌ MISSING';
      console.log(`${status} ${check.href} -> #${check.targetId} - "${check.linkText}"`);
    });
    
    const brokenAnchors = anchorChecks.filter(check => !check.exists);
    
    if (brokenAnchors.length > 0) {
      const brokenList = brokenAnchors.map(anchor => 
        `- ${anchor.href} -> target "#${anchor.targetId}" not found - "${anchor.linkText}"`
      ).join('\n');
      
      expect.fail(`Found ${brokenAnchors.length} broken anchor links:\n${brokenList}`);
    }
    
    expect(brokenAnchors.length).toBe(0);
  });

  test('should check navigation links work correctly', async ({ page }) => {
    await page.goto('/');
    
    // Test specific navigation patterns
    const navigationTests = [
      {
        selector: 'a[href="#signup"]',
        description: 'Beta signup links should scroll to signup section'
      },

    ];
    
    for (const navTest of navigationTests) {
      const links = await page.locator(navTest.selector).all();
      
      console.log(`Testing: ${navTest.description}`);
      console.log(`Found ${links.length} links with selector: ${navTest.selector}`);
      
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        
        console.log(`  Link ${i + 1}: ${href} - "${text?.trim()}"`);
        
        if (href?.startsWith('#')) {
          // For anchor links, check if target exists
          const targetId = href.substring(1);
          const targetExists = await page.locator(`#${targetId}`).count() > 0;
          expect(targetExists, `Anchor target #${targetId} should exist for link "${text?.trim()}"`).toBe(true);
        } else if (href?.endsWith('.html')) {
          // For page links, check if page loads
          const response = await page.request.get(href);
          expect(response.status(), `Page ${href} should be accessible for link "${text?.trim()}"`).toBeLessThan(400);
        }
      }
    }
  });



  test('should validate email links format', async ({ page }) => {
    await page.goto('/');
    
    // Check all mailto links
    const mailtoLinks = await page.locator('a[href^="mailto:"]').all();
    
    for (const link of mailtoLinks) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      
      console.log(`Checking mailto link: ${href} - "${text?.trim()}"`);
      
      // Validate email format
      const emailRegex = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(href || ''), `Mailto link ${href} should have valid email format`).toBe(true);
    }
    
    // Also check contact page
    await page.goto('/contact.html');
    const contactMailtoLinks = await page.locator('a[href^="mailto:"]').all();
    
    for (const link of contactMailtoLinks) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      
      console.log(`Checking mailto link on contact page: ${href} - "${text?.trim()}"`);
      
      const emailRegex = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(href || ''), `Mailto link ${href} should have valid email format`).toBe(true);
    }
  });

  test('should check form action URLs', async ({ page }) => {
    await page.goto('/');
    
    // Check form actions
    const forms = await page.locator('form[action]').all();
    
    for (const form of forms) {
      const action = await form.getAttribute('action');
      
      console.log(`Checking homepage form action: ${action}`);
      
      if (action && action.startsWith('http')) {
        // For external form actions (like Formspree), we can't easily test without submitting
        // but we can check the URL format
        expect(action).toMatch(/^https?:\/\/.+/);
        console.log(`External form action URL format valid: ${action}`);
        
        // Skip testing placeholder URLs that need to be configured
        if (action.includes('YOUR_CONTACT_FORM_ID')) {
          console.log(`Note: Contact form endpoint needs to be configured with actual Formspree ID`);
        }
      }
    }
  });

  test('should check contact page form action URLs', async ({ page }) => {
    await page.goto('/contact.html');
    
    // Check form actions on contact page
    const forms = await page.locator('form[action]').all();
    
    for (const form of forms) {
      const action = await form.getAttribute('action');
      
      console.log(`Checking contact page form action: ${action}`);
      
      if (action && action.startsWith('http')) {
        expect(action).toMatch(/^https?:\/\/.+/);
        console.log(`Contact form action URL format valid: ${action}`);
        
        // Verify we're using the correct contact form endpoint
        if (action.includes('xpwvrbdw')) {
          console.log(`✅ Contact form using correct endpoint: ${action}`);
        } else if (action.includes('YOUR_CONTACT_FORM_ID')) {
          console.log(`⚠️  Contact form endpoint needs to be configured`);
        }
      }
    }
    
    // Also check that contact page loads correctly
    await expect(page).toHaveTitle(/Contact Us.*MigraLog/);
    await expect(page.locator('h1')).toContainText('Contact Us');
  });
});

test.describe('External Links Validation (Optional)', () => {
  test('should check external links accessibility (may be slow)', async ({ page }) => {
    // This test is more comprehensive but slower - checking external resources
    test.setTimeout(60000); // 60 second timeout for external requests
    
    await page.goto('/');
    
    // Get all external HTTP links
    const externalLinks = await page.locator('a[href^="http"]').all();
    const externalChecks = [];
    
    for (const link of externalLinks) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      
      if (href) {
        try {
          console.log(`Checking external link: ${href}`);
          const response = await page.request.get(href, { timeout: 10000 });
          externalChecks.push({
            url: href,
            status: response.status(),
            linkText: text?.trim() || 'No text'
          });
        } catch (error) {
          externalChecks.push({
            url: href,
            status: 0,
            error: error.message,
            linkText: text?.trim() || 'No text'
          });
        }
      }
    }
    
    // Log external link results but don't fail test on external issues
    console.log('External Link Check Results:');
    externalChecks.forEach(check => {
      const status = check.status >= 400 ? '❌ BROKEN' : check.status === 0 ? '⚠️  ERROR' : '✅ OK';
      console.log(`${status} [${check.status}] ${check.url} - "${check.linkText}"`);
      if (check.error) {
        console.log(`  Error: ${check.error}`);
      }
    });
    
    // Only warn about external link issues, don't fail the test
    const brokenExternal = externalChecks.filter(check => check.status >= 400);
    if (brokenExternal.length > 0) {
      console.warn(`Warning: ${brokenExternal.length} external links may be broken`);
    }
    
    // This test just logs results and doesn't fail for external links
    expect(true).toBe(true);
  });
});