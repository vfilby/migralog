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
} else {
  // Alpha/Beta tag: alpha-v1.0.0, beta-v1.0.0
  // No more RC numbers - versions are auto-incremented via GitHub Actions
  newTag = `${releaseType}-v${version}`;
}

// Check if this tag already exists
try {
  execSync(`git rev-parse ${newTag}`, { stdio: 'ignore' });
  console.error(`❌ Tag ${newTag} already exists!`);
  if (releaseType === 'production') {
    console.error('   Bump version first: npm version minor|major');
  } else {
    console.error('   Version was already tagged for ${releaseType}.');
    console.error('   Merge another PR to auto-increment the patch version,');
    console.error('   or manually bump: npm version patch|minor|major');
  }
  process.exit(1);
} catch {
  // Tag doesn't exist, good to proceed
}

console.log(`\n🏷️  Creating release: ${newTag}`);

// Extract changelog entry for release notes
let releaseNotes = `Release ${newTag}`;
try {
  const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');

  // Extract the section for unreleased changes (will be this version)
  const lines = changelog.split('\n');
  let capturing = false;
  let changelogLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start capturing after "Unreleased" header
    if (line.includes('Unreleased')) {
      capturing = true;
      continue;
    }

    // Stop at next version header or after 30 lines
    if (capturing && (line.match(/^####\s+\[/) || changelogLines.length > 30)) {
      break;
    }

    if (capturing && line.trim()) {
      changelogLines.push(line);
    }
  }

  if (changelogLines.length > 0) {
    releaseNotes = changelogLines.slice(0, 20).join('\n');
  }
} catch (error) {
  // If we can't read changelog, use simple message
  console.log('⚠️  Could not extract changelog excerpt, using simple release notes');
}

// Create GitHub release via API (this creates both the tag and release)
// Using gh CLI instead of git tag + push to ensure workflow triggers
const isPrerelease = releaseType !== 'production';
try {
  console.log('⬆️  Creating GitHub release...');

  // Write release notes to temp file to handle special characters
  const tempNotesFile = path.join(__dirname, '.release-notes-temp.md');
  fs.writeFileSync(tempNotesFile, releaseNotes);

  const prereleaseFlag = isPrerelease ? '--prerelease' : '';
  execSync(
    `gh release create ${newTag} --title "Release ${newTag}" --notes-file "${tempNotesFile}" ${prereleaseFlag}`,
    { stdio: 'inherit' }
  );

  // Clean up temp file
  fs.unlinkSync(tempNotesFile);

  console.log('✅ GitHub release created');
} catch (error) {
  console.error('❌ Failed to create GitHub release:', error.message);
  console.error('   Make sure you have the GitHub CLI installed and authenticated.');
  console.error('   Run: gh auth status');
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
