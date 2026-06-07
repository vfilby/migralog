# GitHub Setup Guide

## Initial Repository Setup

### 1. Create GitHub Repository

```bash
git init
git add .
git commit -m "Initial commit: Migralog website"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/migralog-app-website.git
git push -u origin main
```

## GitHub Secrets Configuration

### Required Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

#### AWS_ACCESS_KEY_ID
Your IAM user access key ID for deployment.

**How to create:**
```bash
# Create dedicated IAM user
aws iam create-user --user-name migralog-github-actions

# Attach required policies
aws iam attach-user-policy \
  --user-name migralog-github-actions \
  --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationFullAccess

# Create access key
aws iam create-access-key --user-name migralog-github-actions
```

Copy the `AccessKeyId` value.

#### AWS_SECRET_ACCESS_KEY
Your IAM user secret access key.

Copy the `SecretAccessKey` value from the previous command output.

**⚠️ Important:** Save this immediately - AWS only shows it once!

#### HOSTED_ZONE_ID
Your Route 53 hosted zone ID for migralog.app.

**How to find:**
```bash
aws route53 list-hosted-zones-by-name --dns-name migralog.app
```

Look for the `Id` field (format: `/hostedzone/ZXXXXXXXXXXXXX`), use just the `ZXXXXXXXXXXXXX` part.

### Summary of Required Secrets

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `HOSTED_ZONE_ID` | Route 53 zone ID | `Z2FDTNDATAQYW2` |

## IAM User Permissions

### Minimum Required Policies

The IAM user needs these permissions:

1. **CloudFormation** - Deploy stacks
2. **S3** - Create/manage buckets, upload files
3. **CloudFront** - Create/manage distributions
4. **ACM** - Request/manage certificates
5. **Route 53** - Create/manage DNS records
6. **IAM** - Create service roles

### Recommended: Use Managed Policies (Quick Setup)

```bash
aws iam attach-user-policy \
  --user-name migralog-github-actions \
  --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationFullAccess

aws iam attach-user-policy \
  --user-name migralog-github-actions \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam attach-user-policy \
  --user-name migralog-github-actions \
  --policy-arn arn:aws:iam::aws:policy/CloudFrontFullAccess

aws iam attach-user-policy \
  --user-name migralog-github-actions \
  --policy-arn arn:aws:iam::aws:policy/AWSCertificateManagerFullAccess

aws iam attach-user-policy \
  --user-name migralog-github-actions \
  --policy-arn arn:aws:iam::aws:policy/AmazonRoute53FullAccess
```

### Alternative: Least Privilege Policy (Production)

Create a custom policy with minimum required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "cloudfront:*",
        "acm:*",
        "route53:*",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRole",
        "iam:PassRole",
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:GetPolicy",
        "iam:GetPolicyVersion"
      ],
      "Resource": "*"
    }
  ]
}
```

Save as `migralog-deploy-policy.json` and attach:

```bash
aws iam create-policy \
  --policy-name MigralogDeployPolicy \
  --policy-document file://migralog-deploy-policy.json

aws iam attach-user-policy \
  --user-name migralog-github-actions \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/MigralogDeployPolicy
```

## Enable GitHub Actions

### 1. Activate Workflow

The workflow file is located at `.github/workflows/deploy.yml`.

It will automatically run on:
- Push to `main` branch
- Manual trigger (workflow_dispatch)

### 2. Manual Trigger

To manually trigger deployment:
1. Go to GitHub repository
2. Click "Actions" tab
3. Select "Deploy Website" workflow
4. Click "Run workflow" → "Run workflow"

### 3. Monitor Deployment

Check deployment status:
- Actions tab shows workflow runs
- Click on a run to see detailed logs
- Each step shows output

## Deployment Process

When you push to `main`, GitHub Actions will:

1. ✅ Checkout code
2. ✅ Setup Node.js
3. ✅ Configure AWS credentials
4. ✅ Install CDK dependencies
5. ✅ Show infrastructure diff
6. ✅ Deploy CDK stack (if changes detected)
7. ✅ Get S3 bucket and CloudFront distribution from stack outputs
8. ✅ Sync website files to S3
9. ✅ Invalidate CloudFront cache
10. ✅ Display success message with URL

Total time: ~5-10 minutes (first deploy with certificate: 20-30 minutes)

## Troubleshooting

### Workflow Fails: "Error: Credentials not found"

**Cause:** GitHub Secrets not configured correctly.

**Fix:** Verify secrets in Settings → Secrets and variables → Actions

### Workflow Fails: "Access Denied"

**Cause:** IAM user lacks required permissions.

**Fix:** Add missing IAM policies to the user.

### CDK Deploy Fails: "Hosted zone not found"

**Cause:** Invalid `HOSTED_ZONE_ID` or zone doesn't exist.

**Fix:** 
```bash
aws route53 list-hosted-zones
```
Verify the zone ID and update GitHub Secret.

### Certificate Validation Stuck

**Cause:** DNS not properly configured or nameservers not updated.

**Fix:** 
1. Verify domain nameservers point to Route 53
2. Check ACM console for validation status
3. May take up to 30 minutes

### S3 Sync Fails: "Bucket does not exist"

**Cause:** CDK stack not deployed successfully.

**Fix:** Check CDK deployment logs. Ensure stack completed successfully before S3 sync runs.

## Branch Protection (Optional)

To prevent accidental deployments:

1. Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Enable:
   - Require pull request reviews
   - Require status checks to pass (add "Deploy to AWS")
4. Save

Now deployments only happen after PR approval.

## Local Development vs CI/CD

### Local Development
```bash
cd infrastructure
npm install
cdk deploy -c hostedZoneId=ZXXXXXXXXXXXXX
```

### CI/CD (Automatic)
Push to `main` branch - GitHub Actions handles everything.

## Security Best Practices

✅ **Do:**
- Use dedicated IAM user for CI/CD (not personal account)
- Apply least privilege IAM policies
- Enable MFA on IAM user if possible
- Rotate access keys periodically
- Use GitHub's secret scanning
- Review workflow logs for sensitive data exposure

❌ **Don't:**
- Commit AWS credentials to repository
- Use root AWS account credentials
- Share IAM access keys
- Log sensitive data in workflow
- Give excessive IAM permissions

## Next Steps

After setup:
1. ✅ Create IAM user
2. ✅ Add GitHub Secrets
3. ✅ Push code to trigger first deployment
4. ✅ Monitor deployment in Actions tab
5. ✅ Verify website at https://migralog.app

## Emergency: Disable Auto-Deploy

To temporarily disable automatic deployments:

**Option 1:** Delete workflow file
```bash
git rm .github/workflows/deploy.yml
git commit -m "Disable auto-deploy"
git push
```

**Option 2:** Disable workflow in GitHub
1. Actions tab
2. Select "Deploy Website"
3. Click "..." → "Disable workflow"

**Option 3:** Modify workflow trigger
Change `on.push.branches` to a non-existent branch:
```yaml
on:
  push:
    branches:
      - deploy  # Only deploys when pushing to 'deploy' branch
```
