# MigraLog Website

Marketing website for MigraLog - a migraine and chronic pain tracking app.

> **Note:** This site was moved into the main [MigraLog monorepo](../README.md) (under `website/`) from its former standalone repository. Deployment is currently performed locally via [`deploy-website.sh`](./deploy-website.sh) (AWS CDK + S3/CloudFront, `migralog-website-deployer` profile). Automated CI deployment from the monorepo — described in [`docs/GITHUB-SETUP.md`](docs/GITHUB-SETUP.md) and [`docs/SECRETS-MANAGEMENT.md`](docs/SECRETS-MANAGEMENT.md) — still needs its AWS secrets configured on this repository; until then the `.github/workflows/deploy.yml` referenced below is not yet present here.

## Project Structure

```
.
├── website/              # Website source files
│   └── index.html        # Main website (single-page)
├── infrastructure/       # AWS CDK infrastructure
│   ├── bin/
│   ├── lib/
│   ├── package.json
│   └── README.md
├── docs/                 # Documentation
│   ├── PRODUCT.md        # Product definition
│   ├── WEBSITE-SPEC.md   # Website specification
│   ├── COPY.md           # Marketing copy
│   ├── BUILD-PLAN.md     # Implementation plan
│   ├── INFRASTRUCTURE.md # Infrastructure overview
│   ├── SECRETS-MANAGEMENT.md # Secrets & security
│   └── GITHUB-SETUP.md   # GitHub Actions setup
├── .github/
│   └── workflows/
│       └── deploy.yml    # CI/CD pipeline
└── README.md             # This file
```

## Quick Start

### View Website Locally

```bash
open website/index.html
# or
cd website && python -m http.server 8000
```

### Deploy to AWS

**Simple S3 Deployment (Recommended):**
See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step S3 static hosting instructions.

**Advanced CDK Deployment:**
See [infrastructure/README.md](infrastructure/README.md) for CDK infrastructure deployment.

## Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | **Step-by-step AWS S3 deployment guide** |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Product definition and philosophy |
| [docs/WEBSITE-SPEC.md](docs/WEBSITE-SPEC.md) | Website technical specification |
| [docs/COPY.md](docs/COPY.md) | All marketing copy for the website |
| [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) | Implementation phases and recommendations |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | AWS architecture overview |
| [docs/SECRETS-MANAGEMENT.md](docs/SECRETS-MANAGEMENT.md) | How to manage secrets and credentials |
| [docs/GITHUB-SETUP.md](docs/GITHUB-SETUP.md) | GitHub Actions setup guide |
| [infrastructure/README.md](infrastructure/README.md) | CDK deployment instructions |

## Website Features

- Responsive design (mobile-first)
- Email signup form (integration pending)
- App store download links (placeholder)
- iPhone mockups for screenshots (placeholder)

## Replacing Placeholders

### App Screenshots

Replace placeholder mockups with actual screenshots:
- iPhone 16 Pro Max resolution: 1284 × 2778px
- Update `.phone-screen` content in `website/index.html`
- Or replace entire `.phone-mockup` with `<img>` tags

### App Store Links

Update download links in the download section:
```html
<a href="YOUR_APP_STORE_URL">...</a>
<a href="YOUR_PLAY_STORE_URL">...</a>
```

### Email Signup Integration

Integrate with email provider (Buttondown, ConvertKit, etc.):
1. Sign up for email service
2. Get API credentials or embed code
3. Update form submission handler in `<script>` section

## Technology

- **HTML/CSS/JavaScript**: Static site, no build required
- **Tailwind CSS**: CDN version (no build step)
- **AWS CDK**: Infrastructure as code (TypeScript)
- **S3 + CloudFront**: Static hosting with HTTPS

## Domain

- **Domain**: migralog.app
- **HTTPS**: Required (mandatory for .app TLD)

## Deployment

### Quick S3 Deployment (Recommended)

```bash
# Follow complete guide in DEPLOYMENT.md
aws configure --profile migralog
BUCKET_NAME="migralog-website-$(date +%s)"
aws s3 mb s3://$BUCKET_NAME --profile migralog
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html --profile migralog
aws s3 sync website/ s3://$BUCKET_NAME --delete --profile migralog
```

### Advanced CDK Deployment

Requires IAM user with permissions defined in `iam-policy.json`:

```bash
# Configure IAM permissions first (see infrastructure/README.md)
aws iam put-user-policy \
  --user-name migralog-deployer \
  --policy-name MigraLogCDKDeployPolicy \
  --policy-document file://iam-policy.json

# Deploy infrastructure
cd infrastructure
npm install
npm run bootstrap  # One-time setup
npm run deploy:staging
npm run deploy:production
```

### Automatic Deployment (GitHub Actions)

1. Set up GitHub Secrets (see [docs/GITHUB-SETUP.md](docs/GITHUB-SETUP.md))
2. Push to `main` branch
3. GitHub Actions automatically deploys

## Next Steps

1. ✅ Set up GitHub repository
2. ✅ Configure GitHub Secrets
3. ✅ Deploy infrastructure (see infrastructure/README.md)
4. ⏳ Replace placeholder screenshots with real app screenshots
5. ⏳ Set up email signup integration
6. ⏳ Update app store links when available
7. ⏳ Add analytics tracking
