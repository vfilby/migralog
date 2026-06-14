#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MigralogWebsiteStack } from '../lib/migralog-website-stack';
import { GitHubOidcStack } from '../lib/github-oidc-stack';

const app = new cdk.App();

// Get hosted zone ID from context
const hostedZoneId = app.node.tryGetContext('hostedZoneId');

if (!hostedZoneId) {
  console.warn('Warning: hostedZoneId not provided. DNS configuration will not be created.');
  console.warn('Usage: cdk deploy -c hostedZoneId=ZXXXXXXXXXXXXX');
}

// Environment configuration
const environments = {
  staging: {
    domainName: 'staging.migralog.app',
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'us-east-1',
    },
    enableS3Deployment: true,
  },
  production: {
    domainName: 'migralog.app',
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'us-east-1',
    },
    enableS3Deployment: false, // Production should be deployed via CI/CD
  },
};

// Deploy staging environment
new MigralogWebsiteStack(app, 'MigraLogWebsiteStack-staging', {
  ...environments.staging,
  hostedZoneId,
  hostedZoneName: 'migralog.app',
  environment: 'staging',
  description: 'MigraLog staging website infrastructure',
});

// Deploy production environment
new MigralogWebsiteStack(app, 'MigraLogWebsiteStack-production', {
  ...environments.production,
  hostedZoneId,
  hostedZoneName: 'migralog.app',
  environment: 'production',
  description: 'MigraLog production website infrastructure',
});

// GitHub Actions OIDC provider + scoped deploy roles (deployed once, by hand).
new GitHubOidcStack(app, 'MigraLogWebsiteOidc', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  repo: 'vfilby/migralog',
  description: 'GitHub Actions OIDC provider and website deploy roles',
});

app.synth();
