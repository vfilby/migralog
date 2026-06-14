# Website CI/CD Pipeline

Deployments to `migralog.app` now happen from GitHub Actions in this repo, using
**GitHub OIDC** to assume short-lived roles in the Migralog AWS account
(`483643755230`) — no long-lived AWS keys are stored anywhere.

> This supersedes the long-lived IAM access-key approach in `GITHUB-SETUP.md`.

## Flow

It's a **single pipeline** (`.github/workflows/website-deploy.yml`, "[Web] Deploy")
triggered by a push to `main` touching `website/**` (or manual `workflow_dispatch`):

```
deploy staging ──▶ test staging ──▶ [production gate] ──▶ deploy prod ──▶ test prod
```

| Stage | What | Auth / Gate |
|---|---|---|
| **deploy staging** | deploy `staging.migralog.app` | OIDC role `migralog-website-deploy-staging`, trust-scoped to `repo:vfilby/migralog:ref:refs/heads/main` |
| **test staging** | Playwright suite vs `https://staging.migralog.app` | none (public URL) |
| **production gate** | manual approval | GitHub `production` Environment (required reviewer) — staging must be deployed *and* its tests green first |
| **deploy prod** | deploy `migralog.app` | OIDC role `migralog-website-deploy-production`, trust-scoped to `repo:vfilby/migralog:environment:production` (the job's `environment: production` both gates it and scopes the OIDC token) |
| **test prod** | Playwright suite vs `https://migralog.app` | none (public URL) |

If the staging tests fail, the production stages never run. The production deploy
waits on the environment's required-reviewer approval.

The deploy stages run `website/deploy-website.sh <env> --force`, which deploys the
CDK stack, syncs `website/website/` to S3 with cache headers, and invalidates
CloudFront. The script auto-detects CI (`$CI`) and skips its local `aws-vault`
re-exec, using the OIDC credentials directly.

## Testing

It's all one workflow file (`.github/workflows/website-deploy.yml`). The
Playwright suite (`website/tests/`) runs via `npm run test:ci`, which excludes
the `@visual` platform-specific screenshot specs, in three places:

- **Pre-merge gate** — on every PR touching `website/**`, the `test` job serves
  `website/` locally and runs the functional suite. This keeps the tests in sync
  with the site (they drifted before because nothing ran them pre-merge).
- **Post-deploy smoke** — the `test-staging` and `test-production` stages run the
  same suite against the live URLs (`PLAYWRIGHT_BASE_URL`), waiting for HTTP 200
  first.

Run locally with `cd website && npm run test` (serves `website/` and tests it),
or against a deployed site with `PLAYWRIGHT_BASE_URL=https://staging.migralog.app npm run test:ci`.

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

That's it. After this, pushing to `main` with changes under `website/**` runs the
full pipeline: deploy staging → test staging → (approve the `production`
environment) → deploy prod → test prod.

## Roles / trust (defined in `infrastructure/lib/github-oidc-stack.ts`)

Each role grants only what the deploy needs: assume the CDK bootstrap roles,
read its stack's outputs, sync its own S3 bucket, and invalidate CloudFront.
Security rests on the OIDC trust policy — a role can only be assumed by this
repo, and only from the allowed branch (staging) or Environment (production).
