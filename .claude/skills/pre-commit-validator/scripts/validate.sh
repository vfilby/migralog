#!/bin/bash

# Pre-commit validation script for MigraineTracker
# Runs all required checks before allowing commits

set -e  # Exit on first error

WORKING_DIR="/app"
COVERAGE_THRESHOLD=80

echo "🔍 Running pre-commit validation checks..."
echo ""

# Check 1: Verify we're in the correct directory
echo "📂 Step 1/6: Verifying working directory..."
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from the /app directory"
    exit 1
fi
echo "✅ Working directory verified"
echo ""

# Check 2: Linting
echo "🧹 Step 2/6: Running ESLint..."
if ! npm run test:lint:ci; then
    echo "❌ Linting errors found. Fix linting errors before committing."
    exit 1
fi
echo "✅ Linting passed"
echo ""

# Check 3: TypeScript type checking
echo "🔧 Step 3/6: Running TypeScript type checker..."
if ! npx tsc --noEmit; then
    echo "❌ TypeScript errors found. Fix type errors before committing."
    exit 1
fi
echo "✅ TypeScript check passed"
echo ""

# Check 4: Unit/Integration tests
echo "🧪 Step 4/6: Running unit and integration tests..."
if ! npm run test:ci; then
    echo "❌ Unit/integration tests failed. Fix failing tests before committing."
    exit 1
fi
echo "✅ Unit/integration tests passed"
echo ""

# Check 5: Test coverage validation
echo "📊 Step 5/6: Validating test coverage (>=${COVERAGE_THRESHOLD}%)..."
# Coverage report is in coverage/coverage-summary.json
if [ -f "coverage/coverage-summary.json" ]; then
    # Extract coverage percentages for statements, branches, functions, lines
    STMT_COV=$(node -pe "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.statements.pct")
    BRANCH_COV=$(node -pe "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.branches.pct")
    FUNC_COV=$(node -pe "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.functions.pct")
    LINE_COV=$(node -pe "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.lines.pct")

    echo "  Statements: ${STMT_COV}%"
    echo "  Branches:   ${BRANCH_COV}%"
    echo "  Functions:  ${FUNC_COV}%"
    echo "  Lines:      ${LINE_COV}%"

    # Check if any coverage metric is below threshold
    if (( $(echo "$STMT_COV < $COVERAGE_THRESHOLD" | bc -l) )) || \
       (( $(echo "$BRANCH_COV < $COVERAGE_THRESHOLD" | bc -l) )) || \
       (( $(echo "$FUNC_COV < $COVERAGE_THRESHOLD" | bc -l) )) || \
       (( $(echo "$LINE_COV < $COVERAGE_THRESHOLD" | bc -l) )); then
        echo "❌ Test coverage below ${COVERAGE_THRESHOLD}% threshold. Add more tests."
        exit 1
    fi
    echo "✅ Test coverage meets requirements"
else
    echo "⚠️  Coverage report not found, skipping coverage check"
fi
echo ""

# Check 6: Branch strategy validation
echo "🌿 Step 6/6: Validating branch strategy..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" == "main" ] || [ "$CURRENT_BRANCH" == "master" ]; then
    echo "❌ Cannot commit directly to main/master branch."
    echo "   Please create a feature branch: git checkout -b feature/your-feature-name"
    exit 1
fi
echo "✅ Branch strategy validated (on branch: $CURRENT_BRANCH)"
echo ""

echo "✅ All pre-commit validation checks passed!"
echo "   You may proceed with your commit."
