#!/usr/bin/env node

/**
 * Post-processes CHANGELOG.md to separate user-facing and technical changes
 * Run this after auto-changelog generates the changelog
 */

const fs = require('fs');
const path = require('path');

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

if (!fs.existsSync(changelogPath)) {
  console.log('⚠️  CHANGELOG.md not found');
  process.exit(0);
}

const content = fs.readFileSync(changelogPath, 'utf8');
const lines = content.split('\n');

const userFacingPrefixes = ['✨', '🐛', '⚡', '🔒'];
const technicalPrefixes = ['♻️', '🔧', '📝', '✅', '💄', '🏗️', '👷', '⏪'];

let result = [];
let currentSection = null;
let userFacingChanges = [];
let technicalChanges = [];
let inUnreleasedSection = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Detect Unreleased section
  if (line.includes('#### Unreleased')) {
    inUnreleasedSection = true;
    result.push(line);
    result.push('');
    continue;
  }

  // Detect next version section (end of Unreleased)
  if (inUnreleasedSection && line.match(/^#### \[/)) {
    // Flush collected changes
    if (userFacingChanges.length > 0 || technicalChanges.length > 0) {
      if (userFacingChanges.length > 0) {
        result.push('##### 🎯 User-Facing Changes');
        result.push('');
        result.push(...userFacingChanges);
        result.push('');
      }

      if (technicalChanges.length > 0) {
        result.push('##### 🔧 Technical Changes');
        result.push('');
        result.push(...technicalChanges);
        result.push('');
      }

      userFacingChanges = [];
      technicalChanges = [];
    }

    inUnreleasedSection = false;
    result.push(line);
    continue;
  }

  // In Unreleased section, categorize changes
  if (inUnreleasedSection && line.trim().startsWith('-')) {
    const isUserFacing = userFacingPrefixes.some(prefix => line.includes(prefix));
    const isTechnical = technicalPrefixes.some(prefix => line.includes(prefix));

    if (isUserFacing) {
      userFacingChanges.push(line);
    } else if (isTechnical) {
      technicalChanges.push(line);
    } else {
      // Default to user-facing if not clearly categorized
      userFacingChanges.push(line);
    }
    continue;
  }

  // Skip empty lines in unreleased section (we'll add our own)
  if (inUnreleasedSection && line.trim() === '') {
    continue;
  }

  // Pass through all other lines
  result.push(line);
}

// Handle case where file ends while still in Unreleased section
if (inUnreleasedSection) {
  if (userFacingChanges.length > 0 || technicalChanges.length > 0) {
    if (userFacingChanges.length > 0) {
      result.push('##### 🎯 User-Facing Changes');
      result.push('');
      result.push(...userFacingChanges);
      result.push('');
    }

    if (technicalChanges.length > 0) {
      result.push('##### 🔧 Technical Changes');
      result.push('');
      result.push(...technicalChanges);
      result.push('');
    }
  }
}

// Write back to file
fs.writeFileSync(changelogPath, result.join('\n'));
console.log('✅ CHANGELOG.md formatted with user-facing and technical sections');
