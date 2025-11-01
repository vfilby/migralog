#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const releaseType = process.argv[2];
const validTypes = ['alpha', 'beta', 'production'];

if (!releaseType || !validTypes.includes(releaseType)) {
  console.error('❌ Invalid release type. Usage: node tag-release.js [alpha|beta|production]');
  process.exit(1);
}

// Read current version from package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = pkg.version;

console.log(`📦 Current version: ${version}`);
console.log(`🎯 Release type: ${releaseType}`);

// Ensure we're on main branch and up to date
try {
  const currentBranch = execSync('git branch --show-current').toString().trim();
  if (currentBranch !== 'main') {
    console.error(`❌ Must be on main branch (currently on: ${currentBranch})`);
    console.error('   Run: git checkout main');
    process.exit(1);
  }

  // Check for uncommitted changes
  const status = execSync('git status --porcelain').toString().trim();
  if (status) {
    console.error('❌ You have uncommitted changes. Please commit or stash them first.');
    process.exit(1);
  }

  // Fetch latest tags
  execSync('git fetch --tags', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Git command failed:', error.message);
  process.exit(1);
}

// Determine tag pattern and create new tag
let newTag;

if (releaseType === 'production') {
  // Production tag: v1.0.0
  newTag = `v${version}`;

  // Check if this version tag already exists
  try {
    execSync(`git rev-parse ${newTag}`, { stdio: 'ignore' });
    console.error(`❌ Tag ${newTag} already exists!`);
    console.error('   Bump version first: npm version patch|minor|major');
    process.exit(1);
  } catch {
    // Tag doesn't exist, good to proceed
  }
} else {
  // Alpha/Beta tag: alpha-v1.0.0-rc.1, beta-v1.0.0-rc.1
  const tagPrefix = `${releaseType}-v${version}-rc.`;

  // Get all existing tags matching this pattern
  let existingTags = [];
  try {
    const tagsOutput = execSync(`git tag -l "${tagPrefix}*"`).toString();
    existingTags = tagsOutput.trim().split('\n').filter(Boolean);
  } catch (error) {
    // No existing tags, that's fine
  }

  // Find highest RC number
  let maxRc = 0;
  existingTags.forEach(tag => {
    const match = tag.match(/rc\.(\d+)$/);
    if (match) {
      maxRc = Math.max(maxRc, parseInt(match[1], 10));
    }
  });

  // Create next tag
  const nextRc = maxRc + 1;
  newTag = `${tagPrefix}${nextRc}`;
}

console.log(`\n🏷️  Creating tag: ${newTag}`);

// Create tag
try {
  execSync(`git tag ${newTag}`, { stdio: 'inherit' });
  console.log('✅ Tag created locally');
} catch (error) {
  console.error('❌ Failed to create tag:', error.message);
  process.exit(1);
}

// Push tag to remote
try {
  console.log('⬆️  Pushing tag to remote...');
  execSync(`git push origin ${newTag}`, { stdio: 'inherit' });
  console.log('✅ Tag pushed to remote');
} catch (error) {
  console.error('❌ Failed to push tag:', error.message);
  console.error('   Cleaning up local tag...');
  execSync(`git tag -d ${newTag}`);
  process.exit(1);
}

// Success message
console.log('\n🎉 Release tag created successfully!');
console.log(`📌 Tag: ${newTag}`);
console.log(`🚀 GitHub Actions will now build and deploy to TestFlight`);
console.log(`📱 Track progress: https://github.com/vfilby/migralog/actions`);

// Show what this means
const deploymentInfo = {
  alpha: 'Internal Alpha TestFlight build (preview profile)',
  beta: 'External Beta TestFlight build (preview profile)',
  production: 'Production App Store build (production profile)'
};

console.log(`\n${deploymentInfo[releaseType]}`);
