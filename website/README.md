# MigraLog Website

Marketing website for MigraLog - a migraine and chronic pain tracking app.

> **Note:** This site lives in the main [MigraLog monorepo](../README.md) under `website/` (the former standalone website repository has been retired). Deployment is automated: a push to `main` touching `website/**` runs the **[Web] Deploy** pipeline (`.github/workflows/website-deploy.yml`), which deploys `staging.migralog.app`, runs the Playwright suite against it, waits for the `production` environment approval, then deploys and tests `migralog.app`. Auth is via GitHub OIDC into the Migralog AWS account — no stored AWS keys. See [`docs/PIPELINE.md`](docs/PIPELINE.md) for the full flow. The local [`deploy-website.sh`](./deploy-website.sh) is still available for manual/break-glass deploys.

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
│   ├── PIPELINE.md       # CI/CD pipeline (current)
│   ├── SECRETS-MANAGEMENT.md # Secrets & security (legacy)
│   └── GITHUB-SETUP.md   # IAM access-key CI setup (superseded by PIPELINE.md)
├── deploy-website.sh     # Manual/break-glass deploy script
└── README.md             # This file

The CI/CD workflow lives at the repo root: .github/workflows/website-deploy.yml
```

## Quick Start

### View Website Locally

```bash
open website/index.html
# or
cd website && python -m http.server 8000
```

### Deploy to AWS

**Automated (default):** Merge a change touching `website/**` to `main`. The
**[Web] Deploy** pipeline deploys staging → tests it → (production approval) →
deploys and tests production. See [docs/PIPELINE.md](docs/PIPELINE.md).

**Manual / break-glass:** Run `./deploy-website.sh <staging|production>` locally
(requires the `migralog-website-deployer` AWS profile). See
[infrastructure/README.md](infrastructure/README.md) for the underlying CDK stack.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/PIPELINE.md](docs/PIPELINE.md) | **CI/CD deploy pipeline (current — OIDC, staging→prod)** |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Product definition and philosophy |
| [docs/WEBSITE-SPEC.md](docs/WEBSITE-SPEC.md) | Website technical specification |
| [docs/COPY.md](docs/COPY.md) | All marketing copy for the website |
| [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) | Implementation phases and recommendations |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | AWS architecture overview |
| [infrastructure/README.md](infrastructure/README.md) | CDK deployment instructions |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Legacy: manual AWS S3 deployment guide |
| [docs/SECRETS-MANAGEMENT.md](docs/SECRETS-MANAGEMENT.md) | Legacy: managing access-key secrets |
| [docs/GITHUB-SETUP.md](docs/GITHUB-SETUP.md) | Legacy: IAM access-key CI setup (superseded by PIPELINE.md) |

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

Merge a change touching `website/**` to `main` — the **[Web] Deploy** pipeline
(`.github/workflows/website-deploy.yml`) deploys staging, tests it, waits for the
`production` environment approval, then deploys and tests production. It uses
GitHub OIDC to assume short-lived roles in AWS (no stored keys). Full details and
one-time setup are in [docs/PIPELINE.md](docs/PIPELINE.md).

## Next Steps

1. ✅ Move site into the monorepo and retire the standalone repo
2. ✅ Deploy infrastructure (see infrastructure/README.md)
3. ✅ Automated OIDC CI/CD pipeline (see docs/PIPELINE.md)
4. ⏳ Replace placeholder screenshots with real app screenshots
5. ⏳ Set up email signup integration
6. ⏳ Update app store links when available
7. ⏳ Add analytics tracking
