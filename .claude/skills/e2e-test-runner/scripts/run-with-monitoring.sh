#!/bin/bash

# E2E Test Runner with Real-time Monitoring and Early Exit
# Usage: ./run-with-monitoring.sh [test-file]
#
# Features:
# - Captures all console output
# - Monitors for errors in real-time
# - Kills test on first failure (saves time)
# - Collects artifacts and logs
# - Provides diagnostic summary

set -e

TEST_FILE="${1:-}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUTPUT_LOG="/tmp/e2e-test-${TIMESTAMP}.log"

echo "🧪 Running E2E tests with monitoring..."
echo "   Output log: $OUTPUT_LOG"
if [ -n "$TEST_FILE" ]; then
  echo "   Test file: $TEST_FILE"
else
  echo "   Running: All tests"
fi
echo ""

# Change to app directory
cd /Users/vfilby/Projects/MigraineTracker/app

# Start test with output capture in background
if [ -n "$TEST_FILE" ]; then
  npm run test:ui -- "$TEST_FILE" 2>&1 | tee "$OUTPUT_LOG" &
else
  npm run test:ui 2>&1 | tee "$OUTPUT_LOG" &
fi
TEST_PID=$!

# Monitor for failures in real-time
echo "📊 Monitoring for errors (PID: $TEST_PID)..."
echo ""

# Watch for error patterns
tail -f "$OUTPUT_LOG" 2>/dev/null | while read -r line; do
  # Check for test failures or errors
  if echo "$line" | grep -qE "FAIL|✕.*test|Error code [0-9]+|constraint failed"; then
    echo ""
    echo "🚨 ERROR DETECTED! Killing test early to save time..."
    echo ""

    # Kill the test process
    kill $TEST_PID 2>/dev/null || true
    pkill -f "jest.*e2e" 2>/dev/null || true

    # Give it a moment to finish writing logs
    sleep 2

    break
  fi
done &
MONITOR_PID=$!

# Wait for test to complete or be killed
wait $TEST_PID 2>/dev/null
TEST_EXIT_CODE=$?

# Stop monitoring
kill $MONITOR_PID 2>/dev/null || true

echo ""
echo "============================================"
echo "📋 DIAGNOSTIC SUMMARY"
echo "============================================"
echo ""

# Find most recent artifacts
LATEST_ARTIFACTS=$(ls -td e2e/artifacts/ios.sim.debug.* 2>/dev/null | head -1)

if [ -n "$LATEST_ARTIFACTS" ]; then
  echo "📁 Latest artifacts: $LATEST_ARTIFACTS"
  echo ""

  # Count failures
  FAILED_COUNT=$(ls "$LATEST_ARTIFACTS" 2>/dev/null | grep -c "✗" || echo "0")
  PASSED_COUNT=$(ls "$LATEST_ARTIFACTS" 2>/dev/null | grep -c "✓" || echo "0")

  echo "   ✅ Passed: $PASSED_COUNT"
  echo "   ❌ Failed: $FAILED_COUNT"
  echo ""

  if [ "$FAILED_COUNT" -gt 0 ]; then
    echo "🔍 Failed tests:"
    ls "$LATEST_ARTIFACTS" | grep "✗" | sed 's/^/   - /'
    echo ""
  fi
fi

# Search for errors in output
echo "🔍 Error Analysis:"
echo ""

# Check for database errors
if grep -q "constraint failed\|Error code 19" "$OUTPUT_LOG" 2>/dev/null; then
  echo "   ⚠️  DATABASE CONSTRAINT ERROR detected"
  grep -A 2 "constraint failed\|Error code 19" "$OUTPUT_LOG" | head -5 | sed 's/^/      /'
  echo ""
fi

# Check for TestHelpers errors
if grep -q "TestHelpers.*Failed" "$OUTPUT_LOG" 2>/dev/null; then
  echo "   ⚠️  DATABASE RESET FAILURE detected"
  grep "TestHelpers.*Failed" "$OUTPUT_LOG" | head -3 | sed 's/^/      /'
  echo ""
fi

# Check for timeout errors
if grep -q "Timed out while waiting" "$OUTPUT_LOG" 2>/dev/null; then
  echo "   ⚠️  TIMEOUT ERRORS detected"
  grep -A 1 "Timed out while waiting" "$OUTPUT_LOG" | head -5 | sed 's/^/      /'
  echo ""
fi

echo ""
echo "============================================"
echo "📝 NEXT STEPS"
echo "============================================"
echo ""

if [ "$TEST_EXIT_CODE" -eq 0 ]; then
  echo "✅ All tests passed! No action needed."
else
  echo "❌ Tests failed. Recommended actions:"
  echo ""
  echo "1. Review full output:"
  echo "   cat $OUTPUT_LOG"
  echo ""
  echo "2. Check failure screenshots:"
  if [ -n "$LATEST_ARTIFACTS" ]; then
    echo "   find \"$LATEST_ARTIFACTS\" -name \"*Failure*.png\""
  fi
  echo ""
  echo "3. Search for specific errors:"
  echo "   grep -A 20 'Error code' $OUTPUT_LOG"
  echo "   grep -A 20 'constraint' $OUTPUT_LOG"
  echo "   grep -A 20 'TestHelpers' $OUTPUT_LOG"
  echo ""
  echo "4. Check known issues:"
  echo "   cat ../.claude/skills/e2e-test-runner/references/known-issues.md"
fi

echo ""
echo "Test completed with exit code: $TEST_EXIT_CODE"

exit $TEST_EXIT_CODE
