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
    'ios.release': {
      type: 'ios.app',
      build: 'npx expo run:ios --configuration Release --no-install --no-bundler',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/MigraineTracker.app',
    },
    'ios.debug': {
      type: 'ios.app',
      build: 'npx expo run:ios --configuration Debug',
      binaryPath: '/Users/vfilby/Library/Developer/Xcode/DerivedData/MigraineTracker-dbcroprvgxbqlrfveyoyxqtksiqq/Build/Products/Debug-iphonesimulator/MigraineTracker.app',
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
