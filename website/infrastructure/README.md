# MigraLog Website Infrastructure

AWS CDK infrastructure for the MigraLog marketing website with **staging** and **production** environments.

## Quick Start

Use the deployment script from the project root:

```bash
# From project root
./deploy-website.sh staging      # Deploy to staging
./deploy-website.sh production   # Deploy to production
```

See [QUICK-START.md](../QUICK-START.md) for a complete quick start guide.

## Architecture

This CDK project creates **two independent environments**:

- **Staging**: `staging.migralog.app`
- **Production**: `migralog.app`

Each environment has its own:
- S3 bucket
- CloudFront distribution
- ACM certificate
- Route53 DNS records

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Domain**: migralog.app must be registered and in Route 53
3. **Route 53 Hosted Zone**: Created for migralog.app
4. **AWS CLI**: Configured with credentials (`aws configure --profile migralog`)
5. **Node.js**: v20 or later
6. **AWS CDK CLI**: Install globally (`npm install -g aws-cdk`)

## Setup

### 1. Configure IAM Permissions

Create an IAM user (e.g., `migralog-deployer`) with the policy defined in `../iam-policy.json`. This policy grants the minimum permissions needed for CDK bootstrap and deployment operations.

Apply the policy to your deployment user:

```bash
aws iam put-user-policy \
  --user-name migralog-deployer \
  --policy-name MigraLogCDKDeployPolicy \
  --policy-document file://../iam-policy.json
```

The policy includes scoped permissions for:
- CDK bootstrap resources (SSM, IAM roles/policies, S3, ECR, CloudFormation)
- S3 buckets for staging and production
- CloudFront distributions
- ACM certificates
- Route53 DNS records

All IAM permissions are scoped to CDK-specific resources (`cdk-hnb659fds-*` pattern) for security.

### 2. Install Dependencies

```bash
npm install
```

### 3. Bootstrap CDK (First Time Only)

Bootstrap creates the supporting infrastructure needed for CDK deployments (S3 for assets, IAM roles, ECR repositories, SSM parameters):

```bash
npm run bootstrap
# or manually: cdk bootstrap aws://ACCOUNT-ID/us-east-1
```

Replace `ACCOUNT-ID` with your AWS account ID.

**Note**: Bootstrap is a one-time setup per AWS account/region. It requires elevated IAM permissions but only needs to run once.

### 3. Create Route 53 Hosted Zone (If Not Already Done)

```bash
aws route53 create-hosted-zone \
  --name migralog.app \
  --caller-reference $(date +%s)
```

Note the Hosted Zone ID from the output. Update your domain registrar's nameservers to point to the Route 53 nameservers.

## Deployment

### Environment-Based Deployment

This project supports two environments:

**Staging Environment** (`staging.migralog.app`):
```bash
npm run deploy:staging
```

**Production Environment** (`migralog.app`):
```bash
npm run deploy:production
```

**Both Environments**:
```bash
npm run deploy:all
```

Each deployment will:
1. Create S3 bucket for website files
2. Create CloudFront distribution with HTTPS
3. Request SSL certificate via ACM (auto-validated via DNS)
4. Create DNS records (A, AAAA) for apex and www domains

**Note**: Certificate validation may take 5-30 minutes on first deployment.

### Manual CDK Deployment

```bash
cdk deploy MigraLogWebsiteStack-staging -c hostedZoneId=ZXXXXXXXXXXXXX
cdk deploy MigraLogWebsiteStack-production -c hostedZoneId=ZXXXXXXXXXXXXX
```

Replace `ZXXXXXXXXXXXXX` with your actual Route 53 Hosted Zone ID.

### Upload Website Files

After the stack is deployed:

```bash
# Get bucket name from stack outputs
aws cloudformation describe-stacks \
  --stack-name MigralogWebsiteStack \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text

# Upload files
aws s3 sync ../ s3://BUCKET_NAME/ \
  --exclude "infrastructure/*" \
  --exclude ".git/*" \
  --exclude "*.md" \
  --exclude ".gitignore"
```

### Invalidate CloudFront Cache

After uploading new files:

```bash
# Get distribution ID from stack outputs
aws cloudformation describe-stacks \
  --stack-name MigralogWebsiteStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text

# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXXXXXX \
  --paths "/*"
```

## Useful Commands

### Build and Development
```bash
npm run build                # Compile TypeScript
npm run watch                # Watch for changes
npm run cdk                  # Run CDK CLI
npm run synth                # Generate CloudFormation templates
npm run synth:staging        # Synth staging only
npm run synth:production     # Synth production only
```

### Preview Changes
```bash
npm run diff:staging         # Show staging changes
npm run diff:production      # Show production changes
```

### Deploy
```bash
npm run deploy:staging       # Deploy staging
npm run deploy:production    # Deploy production
npm run deploy:all           # Deploy both environments
```

### Destroy
```bash
npm run destroy:staging      # Delete staging resources
npm run destroy:production   # Delete production resources
```

**Warning**: Destroy commands will delete all resources including S3 buckets (with RETAIN policy).

## Stack Outputs

After deployment, each stack outputs:

- **Environment**: Environment name (staging/production)
- **BucketName**: S3 bucket name for website files
- **DistributionId**: CloudFront distribution ID
- **DistributionDomainName**: CloudFront domain
- **WebsiteURL**: Final website URL
- **CertificateArn**: ACM certificate ARN

View outputs:

```bash
# Staging
aws cloudformation describe-stacks \
  --stack-name MigraLogWebsiteStack-staging \
  --query 'Stacks[0].Outputs' \
  --profile migralog

# Production
aws cloudformation describe-stacks \
  --stack-name MigraLogWebsiteStack-production \
  --query 'Stacks[0].Outputs' \
  --profile migralog
```

## Configuration

### Custom Domain

By default, uses `migralog.app`. To change:

```bash
cdk deploy -c domainName=example.com -c hostedZoneId=ZXXXXXXXXXXXXX
```

### AWS Region

Certificate and CloudFront must be in `us-east-1` (required by AWS). This is configured in `bin/migralog-website.ts`.

## Architecture

```
Internet
    ↓
Route 53 (migralog.app)
    ↓
CloudFront (HTTPS)
    ↓
S3 Bucket (Static Files)
```

## Cost Estimate

Approximate monthly costs:
- Route 53: $0.50/month (hosted zone)
- S3: ~$0.02/month (1GB storage)
- CloudFront: $0.085/GB data transfer (first 10TB)
- ACM Certificate: Free
- **Total**: $1-5/month for low traffic

**Free Tier** (first 12 months):
- CloudFront: 1TB data transfer, 10M requests/month
- S3: 5GB storage, 20K GET requests/month

## Troubleshooting

### Certificate Validation Stuck

If certificate validation takes more than 30 minutes:
1. Check Route 53 DNS records are created (CNAME for validation)
2. Verify domain nameservers point to Route 53
3. Check ACM console for validation status

### 403 Forbidden Error

- Ensure CloudFront OAI has S3 bucket read permissions
- Check bucket policy allows CloudFront access
- Verify files are uploaded to bucket

### Custom Domain Not Working

- Verify Route 53 hosted zone exists
- Check domain nameservers match Route 53
- Wait for DNS propagation (up to 48 hours, usually faster)
- Test with CloudFront domain first

## Cleanup

To delete all resources:

```bash
cdk destroy
```

**Warning**: This will delete the S3 bucket and all website files. The bucket has `RETAIN` policy by default to prevent accidental deletion.
