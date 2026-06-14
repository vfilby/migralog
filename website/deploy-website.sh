#!/bin/bash

# MigraLog Comprehensive Deployment Script
# Manages infrastructure (CDK) and content deployment to staging/production
# Usage: ./deploy-website.sh [staging|production] [--infrastructure-only|--content-only]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AWS_PROFILE="migralog-website-deployer"
INFRASTRUCTURE_DIR="infrastructure"
WEBSITE_DIR="website"

# Credentials:
#   - In CI (GitHub Actions sets CI=true), credentials are already in the
#     environment via OIDC role assumption — use them directly.
#   - Locally, re-exec under aws-vault once so every child (aws CLI, CDK)
#     inherits session creds for the migralog-website-deployer profile.
if [ -z "$CI" ] && [ -z "$AWS_VAULT" ]; then
    # Prefer aws-vault-op (1Password-aware wrapper), fall back to aws-vault
    if command -v aws-vault-op >/dev/null 2>&1; then
        AWS_VAULT_CMD="aws-vault-op"
    else
        echo "Warning: aws-vault-op not found — falling back to aws-vault (expect passphrase + MFA prompts)" >&2
        AWS_VAULT_CMD="aws-vault"
    fi
    exec $AWS_VAULT_CMD exec "$AWS_PROFILE" -- "$0" "$@"
fi

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Show usage
show_usage() {
    cat << EOF
MigraLog Website Deployment Script

Usage:
  ./deploy-website.sh [command] [options]

Commands:
  staging                 Deploy to staging environment (staging.migralog.app)
  promote                 Promote staging to production (RECOMMENDED)
  production              Deploy directly to production (USE WITH CAUTION)

Options:
  --infrastructure-only    Only deploy CDK infrastructure
  --content-only          Only deploy website content
  --diff                  Show infrastructure changes without deploying
  --force                 Skip confirmation prompts (for production)
  --help, -h              Show this help message

Recommended Workflow:
  1. ./deploy-website.sh staging           # Deploy to staging
  2. Test at https://staging.migralog.app
  3. ./deploy-website.sh promote           # Promote to production

Direct Production Deployment (Not Recommended):
  ./deploy-website.sh production           # Requires confirmation

Examples:
  ./deploy-website.sh staging              # Deploy to staging
  ./deploy-website.sh promote              # Promote staging to production
  ./deploy-website.sh staging --diff       # Preview staging changes

Environment Variables:
  HOSTED_ZONE_ID          Route53 hosted zone ID (required for first deployment)

AWS credentials are supplied via aws-vault using the "migralog-website-deployer"
profile; the script re-execs itself under aws-vault-op (or aws-vault) on startup.

EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install it first."
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install it first."
        exit 1
    fi

    # Check AWS session (session creds exported by aws-vault at top of script)
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS session invalid — check vault passphrase, MFA, and IAM policy"
        exit 1
    fi

    # Check infrastructure directory
    if [ ! -d "$INFRASTRUCTURE_DIR" ]; then
        log_error "Infrastructure directory not found: $INFRASTRUCTURE_DIR"
        exit 1
    fi

    # Check website directory
    if [ ! -d "$WEBSITE_DIR" ]; then
        log_error "Website directory not found: $WEBSITE_DIR"
        exit 1
    fi

    log_success "Prerequisites checked"
}

# Install/update dependencies
install_dependencies() {
    log_info "Installing infrastructure dependencies..."

    cd "$INFRASTRUCTURE_DIR"

    if [ ! -d "node_modules" ]; then
        npm install
    else
        log_info "Dependencies already installed"
    fi

    cd ..
    log_success "Dependencies ready"
}

# Build infrastructure
build_infrastructure() {
    log_info "Building CDK infrastructure..."

    cd "$INFRASTRUCTURE_DIR"
    npm run build
    cd ..

    log_success "Infrastructure built"
}

# Get stack outputs
get_stack_outputs() {
    local environment="$1"
    local stack_name="MigraLogWebsiteStack-${environment}"

    # Log to stderr so it doesn't interfere with command substitution
    echo -e "${BLUE}ℹ️  Retrieving stack outputs for $environment...${NC}" >&2

    # Get outputs as JSON
    local outputs
    outputs=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region us-east-1 \
        --query 'Stacks[0].Outputs' \
        --output json 2>&1)

    local aws_exit=$?

    if [ $aws_exit -ne 0 ]; then
        echo -e "${RED}❌ Failed to retrieve stack outputs: $outputs${NC}" >&2
        return 1
    fi

    if [ -z "$outputs" ] || [ "$outputs" = "null" ]; then
        echo -e "${RED}❌ Stack $stack_name not found or has no outputs${NC}" >&2
        return 1
    fi

    echo "$outputs"
}

# Deploy infrastructure
deploy_infrastructure() {
    local environment="$1"
    local stack_name="MigraLogWebsiteStack-${environment}"

    log_info "Deploying infrastructure for $environment..."

    cd "$INFRASTRUCTURE_DIR"

    local context_args=""
    if [ -n "$HOSTED_ZONE_ID" ]; then
        context_args="-c hostedZoneId=$HOSTED_ZONE_ID"
    fi

    # In CI there is no TTY to confirm an IAM diff, so deploy non-interactively.
    # (deploy:staging already passes --require-approval never.)
    local approval_args=""
    if [ -n "$CI" ]; then
        approval_args="--require-approval never"
    fi

    if [ "$environment" = "staging" ]; then
        npm run deploy:staging -- $context_args
    else
        npm run deploy:production -- $context_args $approval_args
    fi

    cd ..
    log_success "Infrastructure deployed"
}

# Show infrastructure diff
show_infrastructure_diff() {
    local environment="$1"

    log_info "Showing infrastructure diff for $environment..."

    cd "$INFRASTRUCTURE_DIR"

    local context_args=""
    if [ -n "$HOSTED_ZONE_ID" ]; then
        context_args="-c hostedZoneId=$HOSTED_ZONE_ID"
    fi

    if [ "$environment" = "staging" ]; then
        npm run diff:staging -- $context_args
    else
        npm run diff:production -- $context_args
    fi

    cd ..
}

# Deploy website content
deploy_content() {
    local environment="$1"

    log_info "Deploying website content to $environment..."

    # Get stack outputs
    local outputs
    outputs=$(get_stack_outputs "$environment") || {
        log_error "Cannot deploy content: infrastructure not deployed"
        exit 1
    }

    if [ -z "$outputs" ] || [ "$outputs" = "null" ]; then
        log_error "Cannot deploy content: infrastructure not deployed"
        exit 1
    fi

    # Extract bucket name and distribution ID
    local bucket_name
    local distribution_id
    bucket_name=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="BucketName") | .OutputValue' 2>/dev/null)
    distribution_id=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="DistributionId") | .OutputValue' 2>/dev/null)

    if [ -z "$bucket_name" ] || [ "$bucket_name" = "null" ]; then
        log_error "Could not find bucket name in stack outputs"
        log_info "Stack outputs received:"
        echo "$outputs" | jq '.' 2>/dev/null || echo "$outputs"
        exit 1
    fi

    log_info "Uploading files to S3 bucket: $bucket_name"

    # Sync website files to S3
    aws s3 sync "$WEBSITE_DIR/" "s3://$bucket_name" \
        --delete \
        --cache-control "public, max-age=31536000, immutable" \
        --exclude "*.html" \
        --exclude "*.json"

    # Upload HTML files with shorter cache
    aws s3 sync "$WEBSITE_DIR/" "s3://$bucket_name" \
        --cache-control "public, max-age=300" \
        --exclude "*" \
        --include "*.html" \
        --include "*.json"

    log_success "Files uploaded to S3"

    # Invalidate CloudFront cache
    if [ -n "$distribution_id" ] && [ "$distribution_id" != "null" ]; then
        log_info "Invalidating CloudFront cache..."

        local invalidation_id=$(aws cloudfront create-invalidation \
            --distribution-id "$distribution_id" \
            --paths "/*" \
            --query 'Invalidation.Id' \
            --output text)

        log_success "CloudFront invalidation created: $invalidation_id"
    fi
}

# Validate deployment
validate_deployment() {
    local environment="$1"

    log_info "Validating deployment..."

    # Get stack outputs
    local outputs=$(get_stack_outputs "$environment")
    if [ $? -ne 0 ]; then
        return 1
    fi

    # Extract website URL
    local website_url=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="WebsiteURL") | .OutputValue')

    if [ -z "$website_url" ] || [ "$website_url" = "null" ]; then
        log_warning "Could not find website URL in outputs"
        return 1
    fi

    log_info "Testing website: $website_url"

    # Wait a moment for changes to propagate
    sleep 5

    # Test website
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$website_url" --max-time 15)

    if [ "$http_code" = "200" ]; then
        log_success "Website is accessible (HTTP $http_code)"

        # Check content
        local content=$(curl -s "$website_url" --max-time 15)
        if echo "$content" | grep -q "MigraLog"; then
            log_success "Website content verified"
            return 0
        else
            log_warning "Website accessible but content verification failed"
            return 1
        fi
    else
        log_error "Website not accessible (HTTP $http_code)"
        log_warning "CloudFront may take a few minutes to propagate. Try accessing: $website_url"
        return 1
    fi
}

# Promote staging to production
promote_to_production() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}⚠️  PROMOTE STAGING TO PRODUCTION${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    # Verify staging is deployed
    log_info "Verifying staging environment..."
    local staging_outputs
    staging_outputs=$(get_stack_outputs "staging") || {
        log_error "Staging environment not found. Deploy to staging first."
        exit 1
    }

    if [ -z "$staging_outputs" ] || [ "$staging_outputs" = "null" ]; then
        log_error "Staging environment not found. Deploy to staging first."
        exit 1
    fi

    local staging_url
    local staging_bucket
    staging_url=$(echo "$staging_outputs" | jq -r '.[] | select(.OutputKey=="WebsiteURL") | .OutputValue' 2>/dev/null)
    staging_bucket=$(echo "$staging_outputs" | jq -r '.[] | select(.OutputKey=="BucketName") | .OutputValue' 2>/dev/null)

    log_success "Staging environment found"
    echo -e "${BLUE}Staging URL:${NC} $staging_url"
    echo

    # Test staging
    log_info "Testing staging environment..."
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$staging_url" --max-time 15)

    if [ "$http_code" != "200" ]; then
        log_error "Staging environment is not accessible (HTTP $http_code)"
        log_error "Fix staging before promoting to production"
        exit 1
    fi
    log_success "Staging environment is healthy"
    echo

    # Get production info
    local production_outputs
    local production_bucket=""
    local production_dist=""

    if production_outputs=$(get_stack_outputs "production" 2>/dev/null); then
        if [ -n "$production_outputs" ] && [ "$production_outputs" != "null" ]; then
            production_bucket=$(echo "$production_outputs" | jq -r '.[] | select(.OutputKey=="BucketName") | .OutputValue' 2>/dev/null)
            production_dist=$(echo "$production_outputs" | jq -r '.[] | select(.OutputKey=="DistributionId") | .OutputValue' 2>/dev/null)
        fi
    fi

    # Show promotion details
    echo -e "${YELLOW}This will:${NC}"
    echo "  1. Copy all content from staging to production"
    echo "  2. Invalidate production CloudFront cache"
    echo "  3. Make changes live at https://migralog.app"
    echo
    echo -e "${BLUE}Source:${NC} $staging_bucket (staging)"
    echo -e "${BLUE}Destination:${NC} ${production_bucket:-"production bucket (to be created)"}"
    echo

    # Confirmation
    if [ "$force_mode" != true ]; then
        read -p "Are you sure you want to promote to production? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            log_warning "Promotion cancelled"
            exit 0
        fi
    fi

    echo

    # Deploy production infrastructure if needed
    if [ -z "$production_bucket" ]; then
        log_info "Production infrastructure not found. Deploying infrastructure first..."
        deploy_infrastructure "production"
        production_outputs=$(get_stack_outputs "production")
        production_bucket=$(echo "$production_outputs" | jq -r '.[] | select(.OutputKey=="BucketName") | .OutputValue' 2>/dev/null)
        production_dist=$(echo "$production_outputs" | jq -r '.[] | select(.OutputKey=="DistributionId") | .OutputValue' 2>/dev/null)
    fi

    # Sync from staging to production
    log_info "Syncing content from staging to production..."

    aws s3 sync "s3://$staging_bucket/" "s3://$production_bucket/" \
        --delete

    log_success "Content synced to production"

    # Invalidate CloudFront
    if [ -n "$production_dist" ] && [ "$production_dist" != "null" ]; then
        log_info "Invalidating production CloudFront cache..."

        local invalidation_id=$(aws cloudfront create-invalidation \
            --distribution-id "$production_dist" \
            --paths "/*" \
            --query 'Invalidation.Id' \
            --output text)

        log_success "CloudFront invalidation created: $invalidation_id"
    fi

    echo
    log_success "Promotion complete!"

    # Validate production
    validate_deployment "production"
}

# Production deployment warning
warn_production_deployment() {
    echo
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                                ║${NC}"
    echo -e "${RED}║                    ⚠️  PRODUCTION DEPLOYMENT ⚠️                 ║${NC}"
    echo -e "${RED}║                                                                ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${YELLOW}WARNING: You are about to deploy DIRECTLY to PRODUCTION!${NC}"
    echo
    echo -e "${YELLOW}This is NOT the recommended workflow.${NC}"
    echo
    echo -e "${BLUE}Recommended workflow:${NC}"
    echo "  1. ./deploy-website.sh staging"
    echo "  2. Test at https://staging.migralog.app"
    echo "  3. ./deploy-website.sh promote"
    echo
    echo -e "${RED}Direct production deployment bypasses staging validation!${NC}"
    echo

    if [ "$force_mode" = true ]; then
        log_warning "Forced mode enabled - proceeding without confirmation"
        return 0
    fi

    read -p "Type 'DEPLOY TO PRODUCTION' to continue: " confirm

    if [ "$confirm" != "DEPLOY TO PRODUCTION" ]; then
        log_error "Production deployment cancelled"
        exit 1
    fi

    echo
    log_warning "Proceeding with direct production deployment..."
    sleep 2
}

# Show deployment summary
show_summary() {
    local environment="$1"

    echo
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}🎉 Deployment Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    # Get and display stack outputs
    local outputs=$(get_stack_outputs "$environment" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo -e "${BLUE}Environment:${NC} $environment"
        echo

        # Show relevant outputs
        echo "$outputs" | jq -r '.[] | "  \(.OutputKey): \(.OutputValue)"'
    fi

    echo
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Visit the website URL above"
    echo "  2. Test all functionality"
    echo "  3. Monitor CloudFront metrics in AWS Console"
    echo
}

# Main deployment flow
main() {
    local command=""
    local environment=""
    local infrastructure_only=false
    local content_only=false
    local show_diff=false
    force_mode=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            staging)
                command="deploy"
                environment="staging"
                shift
                ;;
            production)
                command="deploy"
                environment="production"
                shift
                ;;
            promote)
                command="promote"
                shift
                ;;
            --infrastructure-only)
                infrastructure_only=true
                shift
                ;;
            --content-only)
                content_only=true
                shift
                ;;
            --diff)
                show_diff=true
                shift
                ;;
            --force)
                force_mode=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Validate command
    if [ -z "$command" ]; then
        log_error "Command required (staging, production, or promote)"
        show_usage
        exit 1
    fi

    # Handle promote command
    if [ "$command" = "promote" ]; then
        promote_to_production
        show_summary "production"
        exit 0
    fi

    # Show production warning
    if [ "$environment" = "production" ]; then
        warn_production_deployment
    fi

    # Show header
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🚀 MigraLog Deployment${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Environment:${NC} $environment"
    echo -e "${BLUE}Profile:${NC} $AWS_PROFILE"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    # Check prerequisites
    check_prerequisites

    # Show diff only
    if [ "$show_diff" = true ]; then
        install_dependencies
        build_infrastructure
        show_infrastructure_diff "$environment"
        exit 0
    fi

    # Deploy infrastructure
    if [ "$content_only" = false ]; then
        install_dependencies
        build_infrastructure
        deploy_infrastructure "$environment"
    fi

    # Deploy content
    if [ "$infrastructure_only" = false ]; then
        deploy_content "$environment"
    fi

    # Validate
    validate_deployment "$environment"

    # Show summary
    show_summary "$environment"
}

# Run main function
main "$@"
