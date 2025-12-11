/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
      maxWorkers: 3, // Run tests in parallel with 3 workers (simulators must be shutdown between runs)
    },
    jest: {
      setupTimeout: 180000, // 3 minutes for CI environments
      testTimeout: 300000,  // 5 minutes per test for CI environments
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      build: 'scripts/build-ios-for-detox.sh --configuration Debug',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/MigraLog.app',
    },
    'ios.testing': {
      type: 'ios.app',
      build: 'scripts/build-ios-for-detox.sh --configuration Testing',
      binaryPath: 'ios/build/Build/Products/Testing-iphonesimulator/MigraLog.app',
    },
    'ios.release': {
      type: 'ios.app',
      build: 'npx expo run:ios --configuration Release --no-install --no-bundler',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/MigraLog.app',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 16 Pro Max',
      },
    },
    'simulator.se': {
      type: 'ios.simulator',
      device: {
        type: 'iPhone SE (3rd generation)',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.debug.se': {
      device: 'simulator.se',
      app: 'ios.debug',
    },
    'ios.sim.testing': {
      device: 'simulator',
      app: 'ios.testing',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
  },
  artifacts: {
    rootDir: './e2e/artifacts',
    plugins: {
      screenshot: {
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: false,
        takeWhen: {
          testStart: false,
          testDone: true,
        },
      },
      log: {
        enabled: true,
        keepOnlyFailedTestsArtifacts: false,
      },
    },
  },
};
