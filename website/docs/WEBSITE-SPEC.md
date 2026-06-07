# MigraLog Website Specification

## Purpose
Marketing website to showcase MigraLog's capabilities and drive app store downloads.

## Primary Goals
1. Communicate app value proposition
2. Direct users to app store downloads
3. Capture email signups for updates
4. Build trust through transparency about data ownership

## Key Pages/Sections

### Hero Section
- Clear value proposition
- Primary CTA: Download app (App Store/Google Play badges)
- Secondary CTA: Sign up for updates
- Visual: App screenshot or hero image

### Features Section
Highlight three core differentiators:

#### 1. Timeline-Based Tracking
- Tagline: "Track how your pain evolves, not just when it starts"
- Description: Log symptom changes, interventions, and responses throughout each episode
- Visual: Timeline UI screenshot

#### 2. Simple When You Need It
- Tagline: "Designed for when you're in pain"
- Description: Frustration-free interface with minimal friction
- Visual: Simple data entry screenshot

#### 3. Your Data, Your Control
- Tagline: "Your health data belongs to you"
- Description: Export everything, anytime
- Visual: Export/data ownership icon or screenshot

### Additional Features
- Medication tracking and reminders
- Analytics for doctor appointments (coming soon)
- Pattern recognition (coming soon)

### Use Cases / Benefits
- Better conversations with doctors (data-driven)
- Identify triggers and patterns
- Track medication effectiveness
- Remember details you'd otherwise forget

### Email Signup
- Form: Email address
- Privacy note: "We respect your privacy. Unsubscribe anytime."
- Value proposition: "Get notified when new features launch"

### Download Section
- App Store badge
- Google Play badge
- QR codes (optional)

### Footer
- Links: Privacy Policy, Terms of Service, Contact
- Social media links (if applicable)
- Copyright notice

## Tone & Messaging

### Voice
- Empathetic and understanding
- Clear and direct
- Trustworthy
- Not overly medical or technical

### Key Messages
1. "We understand tracking pain shouldn't add to your pain"
2. "Your complete health timeline in your pocket"
3. "Finally, a pain tracker designed for actual pain sufferers"
4. "Your data, your control, always"

## Technical Requirements

### Architecture
- Static site (no server-side rendering)
- Client-side code only
- Hosted on S3 (or similar static hosting)
- CloudFront or CDN for HTTPS and performance

### Domain & Hosting
- Domain: migralog.app
- HTTPS required (mandatory for .app TLD)
- SSL/TLS certificate via CloudFront or CDN
- S3 bucket for static file hosting

### Email Signup
- Client-side form submission
- Integration with email service provider API (Mailchimp, ConvertKit, Buttondown, etc.)
- Direct API calls from browser (using provider's JavaScript SDK or REST API)
- Confirmation email flow (handled by email provider)
- Privacy compliance (GDPR/CCPA considerations)

### App Store Links
- iOS App Store URL
- Google Play Store URL
- Deep linking support (if applicable)

### Analytics
- Client-side analytics (Google Analytics, Plausible, or similar)
- Track page views
- Monitor conversion rates (downloads, signups)
- Event tracking for CTA clicks
- A/B testing capability (optional, via client-side tools)

### Performance
- Fast load times
- Mobile responsive
- Accessible (WCAG compliance)

## Content Needs
- App screenshots (iPhone, Android)
- App icons
- Promotional images/graphics
- Copy for each section
- Privacy policy
- Terms of service
