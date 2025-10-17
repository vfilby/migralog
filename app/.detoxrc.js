/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
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
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
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
};
