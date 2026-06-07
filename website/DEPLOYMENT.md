# MigraLog Website Deployment Guide

This guide provides step-by-step instructions for deploying the MigraLog website to AWS S3 static hosting.

## Prerequisites

- AWS account created
- AWS CLI installed (version 2.x recommended)
- Git repository with website files

## Deployment Overview

The MigraLog website is deployed using:
- **S3 Static Website Hosting** for file storage and serving
- **IAM User** with minimal permissions for secure deployment
- **Bucket Policy** for public read access

## Step-by-Step Deployment

### 1. Create IAM Policy for S3 Deployment

1. **Go to AWS Console → IAM → Policies → Create Policy**
2. **Click "JSON" tab**
3. **Paste this policy** (saved in `iam-policy-fixed.json`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketWebsite",
        "s3:PutBucketWebsite",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy",
        "s3:DeleteBucketPolicy",
        "s3:PutBucketAcl",
        "s3:GetBucketAcl",
        "s3:PutBucketPublicAccessBlock",
        "s3:GetBucketPublicAccessBlock"
      ],
      "Resource": "arn:aws:s3:::migralog-website-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl",
        "s3:GetObjectAcl"
      ],
      "Resource": "arn:aws:s3:::migralog-website-*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListAllMyBuckets"
      ],
      "Resource": "*"
    }
  ]
}
```

4. **Policy name:** `MigralogS3WebsiteDeployment`
5. **Description:** `Minimal permissions for MigraLog website deployment to S3`
6. **Click "Create Policy"**

### 2. Create IAM User

1. **Go to IAM → Users → Create User**
2. **User name:** `migralog-deployer`
3. **Access type:** UNCHECK "Provide user access to the AWS Management Console"
4. **Click "Next"**
5. **Select "Attach policies directly"**
6. **Search for and select:** `MigralogS3WebsiteDeployment`
7. **Click "Next" → "Create User"**

### 3. Create Access Keys

1. **Click on user:** `migralog-deployer`
2. **Go to "Security credentials" tab**
3. **Click "Create access key"**
4. **Select:** "Command Line Interface (CLI)"
5. **Check confirmation box → "Next"**
6. **Description:** `MigraLog website deployment`
7. **Click "Create access key"**
8. **⚠️ IMPORTANT:** Save both Access Key ID and Secret Access Key immediately

### 4. Configure AWS CLI Profile

```bash
# Configure new profile
aws configure --profile migralog

# Enter when prompted:
# AWS Access Key ID: [Your access key]
# AWS Secret Access Key: [Your secret key]
# Default region name: us-east-1 (or your preferred region)
# Default output format: json

# Test the profile
aws sts get-caller-identity --profile migralog
```

### 5. Deploy Website

```bash
# Generate unique bucket name
BUCKET_NAME="migralog-website-$(date +%s)"
echo "Creating bucket: $BUCKET_NAME"

# Create S3 bucket
aws s3 mb s3://$BUCKET_NAME --profile migralog

# Enable static website hosting
aws s3 website s3://$BUCKET_NAME \
    --index-document index.html \
    --error-document index.html \
    --profile migralog

# Upload website files
aws s3 sync website/ s3://$BUCKET_NAME \
    --delete \
    --profile migralog

# Disable block public access
aws s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
    --profile migralog

# Create bucket policy for public read access
cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

# Apply bucket policy
aws s3api put-bucket-policy \
    --bucket $BUCKET_NAME \
    --policy file://bucket-policy.json \
    --profile migralog

# Get website URL
REGION=$(aws configure get region --profile migralog)
echo "🚀 Website deployed at: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
```

## Updating the Website

To deploy changes after initial setup:

```bash
# Replace BUCKET_NAME with your actual bucket name
BUCKET_NAME="your-bucket-name"

# Sync changes (add --dryrun to preview first)
aws s3 sync website/ s3://$BUCKET_NAME --delete --profile migralog

echo "✅ Website updated!"
```

## Current Deployment

**Active deployment:**
- **Bucket:** `migralog-website-1764739266`
- **URL:** `http://migralog-website-1764739266.s3-website-us-east-1.amazonaws.com`
- **Region:** `us-east-1`

## Troubleshooting

### Common Issues

1. **"Access Denied" errors:**
   - Check IAM policy includes all required permissions
   - Verify bucket policy is applied correctly
   - Ensure block public access is disabled

2. **"Bucket name already exists":**
   - S3 bucket names are globally unique
   - Use timestamp in bucket name: `migralog-website-$(date +%s)`

3. **Website not loading:**
   - Check bucket policy allows public read access
   - Verify static website hosting is enabled
   - Confirm files uploaded to correct bucket

4. **Forms not working:**
   - Verify Formspree endpoints are correct
   - Check browser console for errors
   - Test forms in incognito mode

### Verification Commands

```bash
# Check bucket exists and list contents
aws s3 ls s3://BUCKET_NAME --profile migralog

# Check website configuration
aws s3api get-bucket-website --bucket BUCKET_NAME --profile migralog

# Check bucket policy
aws s3api get-bucket-policy --bucket BUCKET_NAME --profile migralog

# Check public access block settings
aws s3api get-public-access-block --bucket BUCKET_NAME --profile migralog
```

## Security Notes

- IAM user has minimal permissions (only S3 actions for migralog-website-* buckets)
- Access keys should be rotated regularly
- Never commit access keys to version control
- Consider using temporary credentials for automated deployments

## Cost Optimization

- S3 Standard storage: ~$0.023 per GB per month
- Data transfer: First 100 GB/month free, then ~$0.09 per GB
- Requests: GET requests ~$0.0004 per 1,000 requests
- Expected monthly cost for typical website: < $5

## Future Enhancements

Consider adding:
- **CloudFront CDN** for HTTPS and global performance
- **Route 53** for custom domain management
- **GitHub Actions** for automated deployments
- **AWS Certificate Manager** for SSL certificates