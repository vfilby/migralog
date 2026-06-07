# Secrets Management

## Overview

This project uses AWS CDK which does not require secrets to be stored in the repository. AWS credentials are managed through the AWS CLI and IAM, not committed to git.

## What NOT to Commit

### Never Commit These Files
- `.env` files with AWS credentials
- `cdk.context.json` (can contain account IDs)
- AWS credentials or access keys
- API keys for email services
- Any file containing sensitive data

### Already Protected by .gitignore
- `node_modules/`
- `.env` and `.env.local`
- `cdk.out/` (CDK build output)
- `.cdk.staging/`
- `cdk.context.json` (should be added)

## AWS Credentials

### Recommended: AWS CLI Configuration

AWS credentials should be configured via AWS CLI, not stored in repo:

```bash
aws configure
```

This stores credentials in:
- `~/.aws/credentials` (access keys)
- `~/.aws/config` (region, output format)

### For CI/CD (GitHub Actions)

Use GitHub Secrets to store AWS credentials:

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION` (optional, can be hardcoded)
   - `HOSTED_ZONE_ID` (for CDK deployment)

### CDK Context Values

Some CDK context values are sensitive (account IDs, hosted zone IDs).

**Option 1: Pass via CLI (Recommended for local dev)**
```bash
cdk deploy -c hostedZoneId=ZXXXXXXXXXXXXX
```

**Option 2: Use Environment Variables**
```bash
export HOSTED_ZONE_ID=ZXXXXXXXXXXXXX
cdk deploy
```

Then read in CDK code:
```typescript
const hostedZoneId = process.env.HOSTED_ZONE_ID || app.node.tryGetContext('hostedZoneId');
```

**Option 3: Create `cdk.context.json` (gitignored)**
```json
{
  "hostedZoneId": "ZXXXXXXXXXXXXX",
  "domainName": "migralog.app"
}
```

Add to `.gitignore`:
```
cdk.context.json
```

**Option 4: Use AWS SSM Parameter Store**

Store secrets in AWS SSM, retrieve in CDK:
```typescript
const hostedZoneId = ssm.StringParameter.valueFromLookup(this, '/migralog/hostedZoneId');
```

## Email Service API Keys

When you integrate email signup (Buttondown, ConvertKit, etc.), you'll need to handle API keys.

### Client-Side Only (Recommended for Static Site)

Most email services support public API keys or form embeds that are safe to expose:

**Buttondown**: Use public form embed or JavaScript SDK (no secret key needed)
**ConvertKit**: Use form embed or public API key (designed for client-side)
**Mailchimp**: Use embedded form (no API key in browser)

### If Backend Is Needed

If you must use secret API keys:

**Option 1: AWS Lambda + API Gateway**
- Create Lambda function to handle form submission
- Store API key in AWS Secrets Manager or SSM Parameter Store
- Lambda reads secret at runtime
- Frontend calls API Gateway endpoint

**Option 2: Environment Variables in CDK**
```typescript
const emailApiKey = process.env.EMAIL_API_KEY;
// Pass to Lambda function
```

Never hardcode in source files.

## GitHub Actions Secrets

### Setup GitHub Secrets

For automated deployment via GitHub Actions:

```yaml
# .github/workflows/deploy.yml
env:
  AWS_REGION: us-east-1
  
jobs:
  deploy:
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Deploy CDK
        run: |
          cd infrastructure
          npm ci
          npx cdk deploy --require-approval never \
            -c hostedZoneId=${{ secrets.HOSTED_ZONE_ID }}
```

### Required GitHub Secrets
- `AWS_ACCESS_KEY_ID`: IAM user access key
- `AWS_SECRET_ACCESS_KEY`: IAM user secret key
- `HOSTED_ZONE_ID`: Route 53 hosted zone ID

## IAM Best Practices

### Create Dedicated IAM User for CI/CD

Don't use root account or personal credentials:

```bash
# Create IAM user
aws iam create-user --user-name migralog-github-actions

# Attach policies (minimum required)
aws iam attach-user-policy \
  --user-name migralog-github-actions \
  --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationFullAccess

# Create access key
aws iam create-access-key --user-name migralog-github-actions
```

### Minimum Required Permissions

Create a custom policy with least privilege:
- CloudFormation (stacks)
- S3 (bucket operations)
- CloudFront (distributions)
- ACM (certificates)
- Route 53 (DNS records)
- IAM (roles for CloudFormation)

## Checking for Leaked Secrets

### Pre-commit Hooks

Install `gitleaks` or `git-secrets` to scan for secrets before commit:

```bash
# Install gitleaks
brew install gitleaks

# Run scan
gitleaks detect --source . --verbose
```

### GitHub Secret Scanning

GitHub automatically scans for exposed secrets:
- AWS credentials
- API keys from popular services
- Private keys

Enable in: Settings → Code security and analysis → Secret scanning

## Summary

### Safe to Commit
✅ CDK TypeScript code (no hardcoded secrets)
✅ `cdk.json` (configuration)
✅ `package.json`, `tsconfig.json`
✅ README and documentation
✅ HTML/CSS/JS (if no API keys)

### Never Commit
❌ `.env` files
❌ `cdk.context.json` (if contains sensitive values)
❌ AWS credentials
❌ Private API keys
❌ Account IDs (if sensitive to you)

### Best Practice Workflow

1. **Local Development**:
   - Use AWS CLI configured credentials
   - Pass context via CLI: `cdk deploy -c hostedZoneId=ZXX...`

2. **CI/CD**:
   - Use GitHub Secrets for AWS credentials
   - Use environment variables for context values

3. **Email Integration**:
   - Prefer client-side safe solutions (form embeds)
   - If backend needed, use Lambda + Secrets Manager

4. **Git Hygiene**:
   - Keep `.gitignore` updated
   - Use pre-commit hooks
   - Enable GitHub secret scanning
