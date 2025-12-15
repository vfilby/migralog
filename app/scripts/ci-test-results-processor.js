/**
 * CI Test Results Processor for Notification-Schedule Consistency Tests
 * 
 * Processes Jest test results and generates CI-specific reports and metrics
 * for the notification-schedule consistency testing suite.
 */

const fs = require('fs');
const path = require('path');

/**
 * Process Jest test results and generate CI reports
 * @param {Object} results - Jest test results object
 * @returns {Object} Processed results
 */
function processTestResults(results) {
  const timestamp = new Date().toISOString();
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  // Extract notification consistency test results
  const notificationTests = results.testResults.filter(testResult => 
    testResult.testFilePath.includes('notification') && 
    testResult.testFilePath.includes('consistency')
  );
  
  // Calculate performance metrics
  const performanceMetrics = calculatePerformanceMetrics(notificationTests);
  
  // Generate CI-specific summary
  const ciSummary = generateCISummary(results, notificationTests, performanceMetrics);
  
  // Generate detailed report
  const detailedReport = generateDetailedReport(results, notificationTests, performanceMetrics);
  
  // Write reports to files if in CI environment
  if (isCI) {
    writeReportsToFiles(ciSummary, detailedReport, timestamp);
  }
  
  // Log summary to console
  console.log('\n=== CI Test Results Summary ===');
  console.log(JSON.stringify(ciSummary, null, 2));
  
  // Check for failures and provide guidance
  if (ciSummary.failed > 0) {
    console.error('\n=== Test Failures Detected ===');
    console.error(`${ciSummary.failed} test(s) failed. Check detailed report for analysis.`);
    
    // Provide debugging hints
    if (ciSummary.performanceFailures > 0) {
      console.error('Performance-related failures detected. Consider:');
      console.error('- Adjusting CI performance thresholds');
      console.error('- Optimizing test execution environment');
      console.error('- Checking for resource constraints in CI');
    }
    
    if (ciSummary.timeoutFailures > 0) {
      console.error('Timeout failures detected. Consider:');
      console.error('- Increasing test timeouts for CI environment');
      console.error('- Optimizing slow test operations');
      console.error('- Checking for deadlocks or infinite loops');
    }
  }
  
  return results;
}

/**
 * Calculate performance metrics from test results
 */
function calculatePerformanceMetrics(notificationTests) {
  const allTests = notificationTests.flatMap(testResult => testResult.assertionResults);
  
  const totalTests = allTests.length;
  const passedTests = allTests.filter(test => test.status === 'passed').length;
  const failedTests = allTests.filter(test => test.status === 'failed').length;
  const skippedTests = allTests.filter(test => test.status === 'skipped').length;
  
  // Calculate execution times
  const executionTimes = notificationTests
    .filter(testResult => testResult.perfStats && testResult.perfStats.runtime)
    .map(testResult => testResult.perfStats.runtime);
  
  const totalExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0);
  const avgExecutionTime = executionTimes.length > 0 ? totalExecutionTime / executionTimes.length : 0;
  const maxExecutionTime = executionTimes.length > 0 ? Math.max(...executionTimes) : 0;
  
  // Identify performance-related failures
  const performanceFailures = allTests.filter(test => 
    test.status === 'failed' && 
    test.failureMessages.some(msg => 
      msg.includes('Performance threshold') || 
      msg.includes('timeout') ||
      msg.includes('memory')
    )
  ).length;
  
  // Identify timeout failures
  const timeoutFailures = allTests.filter(test =>
    test.status === 'failed' &&
    test.failureMessages.some(msg => msg.includes('timeout'))
  ).length;
  
  return {
    totalTests,
    passedTests,
    failedTests,
    skippedTests,
    totalExecutionTime,
    avgExecutionTime,
    maxExecutionTime,
    performanceFailures,
    timeoutFailures,
    testFiles: notificationTests.length,
    passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
  };
}

/**
 * Generate CI-specific summary
 */
function generateCISummary(results, notificationTests, performanceMetrics) {
  return {
    timestamp: new Date().toISOString(),
    environment: {
      ci: process.env.CI === 'true',
      githubActions: process.env.GITHUB_ACTIONS === 'true',
      nodeVersion: process.version,
      platform: process.platform,
      timezone: process.env.TZ,
    },
    testSuite: {
      name: 'notification-schedule-consistency',
      totalTestFiles: notificationTests.length,
      totalTests: performanceMetrics.totalTests,
      passed: performanceMetrics.passedTests,
      failed: performanceMetrics.failedTests,
      skipped: performanceMetrics.skippedTests,
      passRate: Math.round(performanceMetrics.passRate * 100) / 100,
    },
    performance: {
      totalExecutionTimeMs: Math.round(performanceMetrics.totalExecutionTime),
      avgExecutionTimeMs: Math.round(performanceMetrics.avgExecutionTime * 100) / 100,
      maxExecutionTimeMs: Math.round(performanceMetrics.maxExecutionTime),
      performanceFailures: performanceMetrics.performanceFailures,
      timeoutFailures: performanceMetrics.timeoutFailures,
    },
    coverage: {
      global: results.coverageMap ? {
        lines: results.coverageMap.getCoverageSummary().lines.pct,
        functions: results.coverageMap.getCoverageSummary().functions.pct,
        branches: results.coverageMap.getCoverageSummary().branches.pct,
        statements: results.coverageMap.getCoverageSummary().statements.pct,
      } : null,
    },
    ciReadiness: {
      status: performanceMetrics.failedTests === 0 ? 'READY' : 'NEEDS_ATTENTION',
      recommendations: generateRecommendations(performanceMetrics),
    },
  };
}

/**
 * Generate detailed report
 */
function generateDetailedReport(results, notificationTests, performanceMetrics) {
  const failedTests = notificationTests.flatMap(testResult => 
    testResult.assertionResults.filter(test => test.status === 'failed')
      .map(test => ({
        testFile: testResult.testFilePath,
        testName: test.ancestorTitles.concat(test.title).join(' › '),
        failureMessages: test.failureMessages,
        duration: test.duration,
      }))
  );
  
  const slowTests = notificationTests
    .filter(testResult => testResult.perfStats && testResult.perfStats.runtime > 5000) // > 5 seconds
    .map(testResult => ({
      testFile: path.basename(testResult.testFilePath),
      runtime: testResult.perfStats.runtime,
      numPassingAsserts: testResult.numPassingAsserts,
      numFailingAsserts: testResult.numFailingAsserts,
    }))
    .sort((a, b) => b.runtime - a.runtime);
  
  return {
    summary: performanceMetrics,
    failedTests,
    slowTests,
    testFiles: notificationTests.map(testResult => ({
      file: path.basename(testResult.testFilePath),
      numTests: testResult.assertionResults.length,
      numPassing: testResult.numPassingAsserts,
      numFailing: testResult.numFailingAsserts,
      runtime: testResult.perfStats ? testResult.perfStats.runtime : 0,
    })),
    ciOptimizations: {
      suggestedMaxWorkers: Math.max(1, Math.ceil(require('os').cpus().length * 0.5)),
      suggestedTimeout: Math.max(30000, performanceMetrics.maxExecutionTime * 1.5),
      memoryOptimizations: [
        'Consider using --maxWorkers=50% for CI environments',
        'Enable garbage collection with --expose-gc if memory issues persist',
        'Monitor heap usage and adjust workerIdleMemoryLimit if needed',
      ],
    },
  };
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(performanceMetrics) {
  const recommendations = [];
  
  if (performanceMetrics.failedTests > 0) {
    recommendations.push('Address failing tests before deploying to production');
  }
  
  if (performanceMetrics.performanceFailures > 0) {
    recommendations.push('Review and adjust performance thresholds for CI environment');
  }
  
  if (performanceMetrics.timeoutFailures > 0) {
    recommendations.push('Increase test timeouts or optimize test execution speed');
  }
  
  if (performanceMetrics.avgExecutionTime > 10000) { // > 10 seconds average
    recommendations.push('Consider optimizing test execution speed for better CI performance');
  }
  
  if (performanceMetrics.passRate < 95) {
    recommendations.push('Investigate test reliability issues to improve pass rate');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Test suite is ready for production deployment');
  }
  
  return recommendations;
}

/**
 * Write reports to files for CI artifacts
 */
function writeReportsToFiles(ciSummary, detailedReport, _timestamp) {
  try {
    const reportsDir = path.join(process.cwd(), 'coverage', 'ci-reports');
    
    // Ensure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Write CI summary
    const summaryFile = path.join(reportsDir, 'notification-consistency-ci-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(ciSummary, null, 2));
    
    // Write detailed report
    const detailsFile = path.join(reportsDir, 'notification-consistency-ci-details.json');
    fs.writeFileSync(detailsFile, JSON.stringify(detailedReport, null, 2));
    
    // Write markdown summary for GitHub Actions
    const markdownFile = path.join(reportsDir, 'notification-consistency-ci-summary.md');
    const markdownContent = generateMarkdownSummary(ciSummary, detailedReport);
    fs.writeFileSync(markdownFile, markdownContent);
    
    console.log(`CI reports written to ${reportsDir}`);
    
  } catch (error) {
    console.error('Failed to write CI reports:', error.message);
  }
}

/**
 * Generate markdown summary for GitHub Actions
 */
function generateMarkdownSummary(ciSummary, detailedReport) {
  const { testSuite, performance, ciReadiness } = ciSummary;
  
  return `# Notification-Schedule Consistency Test Results

## Summary
- **Status**: ${ciReadiness.status}
- **Total Tests**: ${testSuite.totalTests}
- **Passed**: ${testSuite.passed} ✅
- **Failed**: ${testSuite.failed} ${testSuite.failed > 0 ? '❌' : ''}
- **Pass Rate**: ${testSuite.passRate}%

## Performance Metrics
- **Total Execution Time**: ${performance.totalExecutionTimeMs}ms
- **Average Test Time**: ${performance.avgExecutionTimeMs}ms
- **Max Test Time**: ${performance.maxExecutionTimeMs}ms
- **Performance Failures**: ${performance.performanceFailures}
- **Timeout Failures**: ${performance.timeoutFailures}

## CI Readiness
${ciReadiness.recommendations.map(rec => `- ${rec}`).join('\n')}

${detailedReport.failedTests.length > 0 ? `
## Failed Tests
${detailedReport.failedTests.map(test => `- **${test.testName}**\n  File: ${path.basename(test.testFile)}`).join('\n')}
` : ''}

${detailedReport.slowTests.length > 0 ? `
## Slow Tests (>5s)
${detailedReport.slowTests.map(test => `- ${test.testFile}: ${test.runtime}ms`).join('\n')}
` : ''}

---
Generated on ${ciSummary.timestamp}
`;
}

module.exports = processTestResults;