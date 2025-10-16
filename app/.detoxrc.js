/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 180000, // 3 minutes for CI environments
      testTimeout: 300000,  // 5 minutes per test for CI environments
    },
  },
  apps: {
    'ios.release': {
      type: 'ios.app',
      build: 'npx expo run:ios --configuration Release --no-install --no-bundler',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/MigraLog.app',
    },
    'ios.debug': {
      type: 'ios.app',
      build: 'scripts/build-ios-for-detox.sh',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/MigraLog.app',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 16 Pro Max',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
  },
};
