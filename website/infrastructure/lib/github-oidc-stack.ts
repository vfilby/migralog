import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface GitHubOidcStackProps extends cdk.StackProps {
  /** GitHub "owner/repo", e.g. "vfilby/migralog". */
  repo: string;
  /** Branch whose pushes may assume the staging deploy role. */
  stagingBranch?: string;
  /** GitHub Environment name that gates the production deploy role. */
  productionEnvironment?: string;
}

/**
 * GitHub Actions OIDC provider + two scoped website deploy roles, so CI can
 * deploy without any long-lived AWS keys. Security comes from the trust policy:
 * each role is assumable only by this repo, and only for a specific ref
 * (staging) or GitHub Environment (production).
 *
 * Deployed once, by hand, with: npm run deploy:oidc  (AWS_PROFILE=migralog-sso)
 */
export class GitHubOidcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    const { repo, stagingBranch = 'main', productionEnvironment = 'production' } = props;

    const provider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    // Permissions the CI principal itself needs (everything else flows through
    // the CDK bootstrap roles it assumes during `cdk deploy`):
    //   - assume the CDK bootstrap roles (deploy/file-publishing/lookup/...)
    //   - read the env's stack outputs (deploy-website.sh `get_stack_outputs`)
    //   - sync the env's website bucket
    //   - invalidate CloudFront
    const deployStatements = (bucketName: string, stackName: string): iam.PolicyStatement[] => [
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
      new iam.PolicyStatement({
        sid: 'ReadStackOutputs',
        actions: ['cloudformation:DescribeStacks'],
        resources: [`arn:aws:cloudformation:${this.region}:${this.account}:stack/${stackName}/*`],
      }),
      new iam.PolicyStatement({
        sid: 'SyncWebsiteBucket',
        actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
      }),
      new iam.PolicyStatement({
        sid: 'InvalidateCloudFront',
        // CreateInvalidation does not support resource-level scoping.
        actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation', 'cloudfront:ListDistributions'],
        resources: ['*'],
      }),
    ];

    const makeRole = (name: string, sub: string, bucketName: string, stackName: string): iam.Role => {
      const role = new iam.Role(this, name, {
        roleName: name,
        description: `GitHub Actions website deploy role (${name})`,
        maxSessionDuration: cdk.Duration.hours(1),
        assumedBy: new iam.OpenIdConnectPrincipal(provider, {
          StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
          StringLike: { 'token.actions.githubusercontent.com:sub': sub },
        }),
      });
      deployStatements(bucketName, stackName).forEach((s) => role.addToPolicy(s));
      return role;
    };

    const stagingRole = makeRole(
      'migralog-website-deploy-staging',
      `repo:${repo}:ref:refs/heads/${stagingBranch}`,
      'staging.migralog.app-website',
      'MigraLogWebsiteStack-staging',
    );

    const productionRole = makeRole(
      'migralog-website-deploy-production',
      `repo:${repo}:environment:${productionEnvironment}`,
      'migralog.app-website',
      'MigraLogWebsiteStack-production',
    );

    new cdk.CfnOutput(this, 'OidcProviderArn', { value: provider.openIdConnectProviderArn });
    new cdk.CfnOutput(this, 'StagingRoleArn', { value: stagingRole.roleArn });
    new cdk.CfnOutput(this, 'ProductionRoleArn', { value: productionRole.roleArn });
  }
}
