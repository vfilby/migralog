# Website CI/CD Pipeline

Deployments to `migralog.app` now happen from GitHub Actions in this repo, using
**GitHub OIDC** to assume short-lived roles in the Migralog AWS account
(`483643755230`) — no long-lived AWS keys are stored anywhere.

> This supersedes the long-lived IAM access-key approach in `GITHUB-SETUP.md`.

## Flow

| Environment | Trigger | Auth | Gate |
|---|---|---|---|
| **staging** (`staging.migralog.app`) | push to `main` touching `website/**` (or manual) | OIDC role `migralog-website-deploy-staging`, trust-scoped to `repo:vfilby/migralog:ref:refs/heads/main` | none — auto |
| **production** (`migralog.app`) | manual `workflow_dispatch` ("[Web] Deploy Production", type `deploy`) | OIDC role `migralog-website-deploy-production`, trust-scoped to `repo:vfilby/migralog:environment:production` | GitHub `production` Environment (required reviewer) |

Both workflows run `website/deploy-website.sh <env> --force`, which deploys the
CDK stack, syncs `website/website/` to S3 with cache headers, and invalidates
CloudFront. The script auto-detects CI (`$CI`) and skips its local `aws-vault`
re-exec, using the OIDC credentials directly.

## One-time setup

1. **Deploy the OIDC provider + roles** (creates the GitHub OIDC provider and the
   two deploy roles in account `483643755230`):
   ```bash
   cd website/infrastructure
   AWS_PROFILE=migralog-sso npm ci
   AWS_PROFILE=migralog-sso npm run deploy:oidc
   ```

2. **Create the `production` GitHub Environment**: repo **Settings → Environments
   → New environment → `production`**, and add yourself as a **required reviewer**
   (this is the manual approval gate for prod).

3. **Set the hosted-zone repo secret**: repo **Settings → Secrets and variables
   → Actions → Secrets → New repository secret**:
   - `HOSTED_ZONE_ID` = `Z0406970129G0QZZ2UCT6`

That's it. After this:
- Pushing to `main` with changes under `website/**` auto-deploys staging.
- Running **[Web] Deploy Production** (and approving the environment) ships prod.

## Roles / trust (defined in `infrastructure/lib/github-oidc-stack.ts`)

Each role grants only what the deploy needs: assume the CDK bootstrap roles,
read its stack's outputs, sync its own S3 bucket, and invalidate CloudFront.
Security rests on the OIDC trust policy — a role can only be assumed by this
repo, and only from the allowed branch (staging) or Environment (production).
