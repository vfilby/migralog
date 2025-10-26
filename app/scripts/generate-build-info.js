#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get version from package.json
  const packageJson = require('../package.json');
  const version = packageJson.version;

  // Get git commit hash
  const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

  // Get git branch
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();

  // Get build timestamp
  const buildTime = new Date().toISOString();

  // Build number - for local development, use 'dev'
  // In EAS builds, this will be overridden by the actual build number
  const buildNumber = process.env.EAS_BUILD_NUMBER || 'dev';

  const buildInfo = {
    version,
    buildNumber,
    commitHash,
    branch,
    buildTime,
  };

  const content = `// Auto-generated file - do not edit manually
// Generated at: ${buildTime}

export const buildInfo = ${JSON.stringify(buildInfo, null, 2)};
`;

  const outputPath = path.join(__dirname, '../src/buildInfo.ts');
  fs.writeFileSync(outputPath, content, 'utf-8');

  console.log('✅ Build info generated successfully');
  console.log(`   Version: ${version}`);
  console.log(`   Build: ${buildNumber}`);
  console.log(`   Commit: ${commitHash}`);
  console.log(`   Branch: ${branch}`);
} catch (error) {
  console.error('⚠️  Warning: Could not generate build info:', error.message);

  // Create a fallback file
  // Try to at least get version from package.json even if git commands failed
  let fallbackVersion = '1.0.0';
  try {
    const packageJson = require('../package.json');
    fallbackVersion = packageJson.version;
  } catch (pkgError) {
    console.error('⚠️  Could not read package.json, using hardcoded version');
  }

  const fallbackContent = `// Auto-generated file - do not edit manually
// Build info could not be generated

export const buildInfo = {
  version: '${fallbackVersion}',
  buildNumber: 'unknown',
  commitHash: 'unknown',
  branch: 'unknown',
  buildTime: '${new Date().toISOString()}',
};
`;

  const outputPath = path.join(__dirname, '../src/buildInfo.ts');
  fs.writeFileSync(outputPath, fallbackContent, 'utf-8');
}
