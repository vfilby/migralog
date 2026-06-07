# MigraLog Website Build Plan

## Recommended Approach

### Technology Stack

#### Core
- **HTML/CSS/JavaScript** - Pure static files, no build step required (simplest)
- **Alternative:** Tailwind CSS for styling (requires build step but worth it for maintenance)
- **Alternative:** Simple static site generator (Astro, 11ty) if you want component reusability

#### Email Collection
- **Buttondown** - Simple API, generous free tier, privacy-focused
- **Alternative:** ConvertKit - More features, good for newsletters
- **Alternative:** Mailchimp - Industry standard, more complex

#### Analytics
- **Plausible** or **Fathom** - Privacy-friendly, lightweight, GDPR-compliant
- **Alternative:** Google Analytics 4 - Free, comprehensive (privacy concerns)

#### Hosting & Infrastructure
- **AWS S3 + CloudFront** - Since you mentioned S3
  - S3 bucket for static files
  - CloudFront for CDN + HTTPS
  - Route 53 for DNS (migralog.app)
  - ACM for SSL certificate (free)
- **Alternative:** Cloudflare Pages - Simpler, includes CDN/HTTPS/DNS in one
- **Alternative:** Netlify or Vercel - Zero config, generous free tier

### Implementation Phases

#### Phase 1: Core Website (Week 1)
- [ ] Create HTML structure (single page)
- [ ] Implement responsive CSS
- [ ] Add hero section with value proposition
- [ ] Add features section (3 core differentiators)
- [ ] Add download section with app store buttons (placeholder links)
- [ ] Create footer
- [ ] Test mobile responsiveness

#### Phase 2: Email Signup (Week 1-2)
- [ ] Choose email provider (recommend Buttondown)
- [ ] Set up email provider account
- [ ] Implement signup form
- [ ] Add client-side form validation
- [ ] Integrate with provider's API
- [ ] Test signup flow
- [ ] Add success/error messaging

#### Phase 3: Polish & Content (Week 2)
- [ ] Add app screenshots (when available)
- [ ] Refine copy based on real content
- [ ] Add privacy policy page
- [ ] Add terms of service page
- [ ] Optimize images
- [ ] Add favicon and meta tags (SEO/social sharing)

#### Phase 4: Infrastructure (Week 2-3)
- [ ] Set up S3 bucket
- [ ] Configure bucket for static website hosting
- [ ] Set up CloudFront distribution
- [ ] Request SSL certificate in ACM
- [ ] Configure custom domain (migralog.app)
- [ ] Set up Route 53 DNS
- [ ] Test HTTPS and redirects

#### Phase 5: Analytics & Launch (Week 3)
- [ ] Add analytics tracking code
- [ ] Set up conversion goals
- [ ] Test all links and forms
- [ ] Performance audit (Lighthouse)
- [ ] Cross-browser testing
- [ ] Launch!

### Quick Start Option (MVP in 1 Day)

If you want to launch fast:
1. Use a pre-built template (HTML5 UP, Tailwind UI, etc.)
2. Customize copy from COPY.md
3. Deploy to Cloudflare Pages (drag & drop)
4. Add Buttondown form embed (5 minutes)
5. Launch with placeholder app store buttons

Refine later as the app develops.

### Recommended: Start Simple

**Initial recommendation:**
1. **Single HTML file** with embedded CSS and minimal JavaScript
2. **Tailwind CDN** for styling (no build step)
3. **Buttondown** for email (simple API, embed code available)
4. **Cloudflare Pages** for hosting (simplest deployment)
5. **Plausible** or skip analytics initially

**Why:**
- Zero build complexity
- Deploy in minutes
- Easy to iterate
- Can refactor to build system later if needed

### When You're Ready to Build

Let me know if you want me to:
1. Build the complete static site now
2. Create a template structure for you to fill in
3. Set up just the infrastructure (S3/CloudFront)
4. Recommend a specific template/framework

Also confirm:
- Do you have app screenshots ready?
- Do you have app store URLs yet?
- Any preference on email provider?
- Any preference on hosting (S3 vs Cloudflare vs Netlify)?
