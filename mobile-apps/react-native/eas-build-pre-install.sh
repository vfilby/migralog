#!/usr/bin/env bash

# EAS Build Pre-Install Hook
# This script runs before npm install during EAS builds
# It generates the buildInfo.ts file needed by the app

set -e

echo "🔧 Generating build info..."

# Create the buildInfo directory if it doesn't exist
mkdir -p src

# Get git commit hash (or use 'unknown' if not in a git repo)
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Get git branch (or use 'unknown' if not in a git repo)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Get current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Generate buildInfo.ts
cat > src/buildInfo.ts <<EOF
// Auto-generated build info
// This file is generated during the build process

export const buildInfo = {
  commitHash: '${COMMIT_HASH}',
  branch: '${BRANCH}',
  buildTime: '${TIMESTAMP}',
};
EOF

echo "✅ Build info generated:"
echo "   Commit: ${COMMIT_HASH}"
echo "   Branch: ${BRANCH}"
echo "   Time: ${TIMESTAMP}"
