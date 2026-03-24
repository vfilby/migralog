#!/bin/bash

# Script to interactively select and run a single UI test file

# Get list of test files
TEST_FILES=($(ls e2e/*.test.js 2>/dev/null))

if [ ${#TEST_FILES[@]} -eq 0 ]; then
  echo "No test files found in e2e/ directory"
  exit 1
fi

echo "Select a UI test to run:"
echo ""

# Create selection menu
select TEST_FILE in "${TEST_FILES[@]}" "Cancel"; do
  if [ "$REPLY" -eq $((${#TEST_FILES[@]} + 1)) ] 2>/dev/null; then
    echo "Cancelled"
    exit 0
  elif [ -n "$TEST_FILE" ]; then
    echo ""
    echo "Running: $TEST_FILE"
    echo ""
    npx detox test "$TEST_FILE" --configuration ios.sim.debug --maxWorkers 1
    exit $?
  else
    echo "Invalid selection. Please try again."
  fi
done
