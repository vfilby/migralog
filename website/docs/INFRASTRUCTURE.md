# Infrastructure Setup - AWS CDK

> **Note:** The "GitHub Actions (Optional)" example below shows an illustrative
> `.github/workflows/deploy.yml`. The actual deploy workflow is
> `.github/workflows/website-deploy.yml` (OIDC, staging→prod) — see
> [PIPELINE.md](PIPELINE.md).

## Overview
Static website hosted on AWS S3 with CloudFront CDN, managed via AWS CDK.

## Architecture

```
Route 53 (migralog.app)
    ↓
CloudFront Distribution (HTTPS)
    ↓
S3 Bucket (Static Website Hosting)
```

## AWS Resources

### Required Services
- **S3**: Static file hosting
- **CloudFront**: CDN + HTTPS termination
- **Route 53**: DNS management for migralog.app
- **ACM (Certificate Manager)**: SSL/TLS certificate
- **IAM**: Permissions for CloudFront to access S3

### Resource Details

#### S3 Bucket
- Public read access (via CloudFront only)
- Static website hosting enabled
- Bucket policy allows CloudFront OAI access

#### CloudFront Distribution
- Custom domain: migralog.app, www.migralog.app
- SSL certificate from ACM (us-east-1 region required)
- Default root object: index.html
- Custom error responses (404 → index.html for SPA-like behavior)
- Caching configuration for static assets
- Gzip/Brotli compression enabled

#### Route 53
- Hosted zone for migralog.app
- A record (alias) pointing to CloudFront distribution
- AAAA record (alias) for IPv6 support

#### ACM Certificate
- Domain: migralog.app
- Subject Alternative Names: www.migralog.app
- DNS validation (automated via Route 53)
- Must be created in us-east-1 region for CloudFront

## CDK Implementation

### Project Structure
```
infrastructure/
├── bin/
│   └── migralog-website.ts       # CDK app entry point
├── lib/
│   └── migralog-website-stack.ts # Stack definition
├── cdk.json                       # CDK configuration
├── package.json
└── tsconfig.json
```

### Stack Components
1. S3 Bucket for website content
2. CloudFront Origin Access Identity
3. Bucket policy for CloudFront access
4. ACM Certificate (with DNS validation)
5. CloudFront Distribution
6. Route 53 DNS records

### Environment Variables / Context
- `domainName`: migralog.app
- `hostedZoneId`: Route 53 hosted zone ID (must exist)
- `certificateArn`: (optional, will create if not provided)

## Prerequisites

### Before CDK Deploy
1. **AWS Account** with appropriate permissions
2. **Domain registered**: migralog.app must be registered
3. **Route 53 Hosted Zone**: Create hosted zone for migralog.app
4. **Update domain nameservers** to Route 53 nameservers
5. **AWS CLI configured** with credentials
6. **CDK CLI installed**: `npm install -g aws-cdk`
7. **CDK bootstrapped**: `cdk bootstrap aws://ACCOUNT-ID/REGION`

### Required IAM Permissions
- S3: Create/manage buckets
- CloudFront: Create/manage distributions
- ACM: Request/manage certificates
- Route 53: Manage DNS records
- IAM: Create roles and policies

## Deployment Process

### Initial Setup
```bash
cd infrastructure
npm install
```

### Configure Context
Edit `cdk.json` or use CLI context:
```bash
cdk deploy -c domainName=migralog.app -c hostedZoneId=ZXXXXXXXXXXXXX
```

### Deploy Stack
```bash
cdk deploy
```

### Upload Website Files
```bash
aws s3 sync ../dist s3://migralog-app-website --delete
# Or if using CDK deployment:
aws s3 sync . s3://BUCKET_NAME --exclude "node_modules/*" --exclude ".git/*"
```

### Invalidate CloudFront Cache
```bash
aws cloudfront create-invalidation --distribution-id EXXXXXXXXXXXXX --paths "/*"
```

## CDK Stacks

### Option 1: Single Stack
All resources in one stack:
- Simpler to manage
- All resources deployed together
- Good for small projects

### Option 2: Multi-Stack
Separate stacks for different concerns:
- **NetworkStack**: Route 53, ACM certificate
- **WebsiteStack**: S3, CloudFront
- Better for larger projects
- Can update website without touching DNS

**Recommendation**: Start with single stack for simplicity.

## Cost Estimate

### Monthly Costs (Approximate)
- **Route 53 Hosted Zone**: $0.50/month
- **Route 53 Queries**: ~$0.40/month (1M queries)
- **S3 Storage**: ~$0.02/month (1GB)
- **S3 Requests**: Minimal (<$0.01/month)
- **CloudFront**: $0.085/GB (first 10TB)
  - First 10TB: $0.085/GB
  - Data transfer out: depends on traffic
  - Requests: $0.0075 per 10,000 HTTPS requests
- **ACM Certificate**: Free
- **Total**: ~$1-5/month for low traffic

### Free Tier Benefits
- CloudFront: 1TB data transfer out, 10M HTTPS requests/month (first year)
- S3: 5GB storage, 20,000 GET requests (first year)

## Deployment Automation

### GitHub Actions (Optional)
```yaml
# .github/workflows/deploy.yml
name: Deploy Website
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Sync to S3
        run: aws s3 sync . s3://BUCKET_NAME --delete
      - name: Invalidate CloudFront
        run: aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
```

## Useful CDK Commands

```bash
cdk synth          # Generate CloudFormation template
cdk diff           # Show changes before deploy
cdk deploy         # Deploy stack
cdk destroy        # Delete all resources
cdk ls             # List all stacks
```

## Next Steps

1. Create infrastructure CDK code
2. Set up Route 53 hosted zone manually (one-time)
3. Deploy CDK stack
4. Upload index.html to S3
5. Test website at migralog.app
6. Set up deployment automation
