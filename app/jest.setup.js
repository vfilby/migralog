// Set timezone to UTC for consistent date handling across different environments
process.env.TZ = 'UTC';

// Mock expo-modules-core (must be first)
jest.mock('expo-modules-core', () => ({
  EventEmitter: class MockEventEmitter {
    emit() {}
    addListener() { return { remove: () => {} }; }
    removeListener() {}
    removeAllListeners() {}
  },
  NativeModulesProxy: {},
  requireNativeModule: jest.fn(() => ({})),
  requireOptionalNativeModule: jest.fn(() => null),
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() =>
    Promise.resolve({
      execAsync: jest.fn(),
      runAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(() => Promise.resolve([])),
      prepareAsync: jest.fn(() =>
        Promise.resolve({
          executeAsync: jest.fn(),
          finalizeAsync: jest.fn(),
        })
      ),
    })
  ),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never',
    })
  ),
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never',
    })
  ),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  addNotificationReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    YEARLY: 'yearly',
    CALENDAR: 'calendar',
    TIME_INTERVAL: 'timeInterval',
  },
  AndroidNotificationPriority: {
    MIN: -2,
    LOW: -1,
    DEFAULT: 0,
    HIGH: 1,
    MAX: 2,
  },
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never',
    })
  ),
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never',
    })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 0,
        accuracy: 5,
        altitudeAccuracy: 5,
        heading: 0,
        speed: 0,
      },
      timestamp: Date.now(),
    })
  ),
  reverseGeocodeAsync: jest.fn(() =>
    Promise.resolve([
      {
        city: 'San Francisco',
        region: 'CA',
        country: 'USA',
      },
    ])
  ),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documents/',
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('{}')),
  readDirectoryAsync: jest.fn(() => Promise.resolve([])),
  deleteAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() =>
    Promise.resolve({
      canceled: true,
    })
  ),
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({
      canceled: true,
    })
  ),
  launchCameraAsync: jest.fn(() =>
    Promise.resolve({
      canceled: true,
    })
  ),
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never',
    })
  ),
  requestCameraPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never',
    })
  ),
  MediaTypeOptions: {
    Images: 'Images',
    Videos: 'Videos',
    All: 'All',
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    name: 'MigraLog',
    slug: 'migralog',
    version: '1.0.0',
  },
  manifest: {
    name: 'MigraLog',
    slug: 'migralog',
    version: '1.0.0',
  },
  platform: {
    ios: {
      bundleIdentifier: 'com.example.migralog',
    },
    android: {
      package: 'com.example.migralog',
    },
  },
  getWebViewUserAgentAsync: jest.fn(() => Promise.resolve('mock-user-agent')),
}));

// Mock date-fns to ensure consistent test results
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  // Can override specific functions if needed for deterministic tests
}));

// Silence console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock window.dispatchEvent for React Test Renderer
if (typeof window !== 'undefined' && !window.dispatchEvent) {
  window.dispatchEvent = jest.fn();
}

// Mock Sentry to prevent calls during tests
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((component) => component),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setContext: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  mobileReplayIntegration: jest.fn(() => ({})),
  feedbackIntegration: jest.fn(() => ({})),
}));

// Extend Jest matchers for React Native Testing Library
import '@testing-library/jest-native/extend-expect';

// Mock @react-native-community/datetimepicker
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
  };
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const View = require('react-native/Libraries/Components/View/View');

  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    // Don't mock these - let React Native's versions be used
    // ScrollView: View,
    // Slider: View,
    // Switch: View,
    // TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    // Don't mock FlatList - let React Native's version be used
    // FlatList: View,
    gestureHandlerRootHOC: jest.fn(),
    Directions: {},
    // GestureDetector should accept gesture prop and render children with press event wired up
    GestureDetector: ({ children, gesture }) => {
      const Touchable = require('react-native').TouchableOpacity;
      const onPress = gesture?._onStartCallback || (() => {});
      return React.createElement(Touchable, { onPress, activeOpacity: 1 }, children);
    },
    Gesture: {
      Tap: jest.fn(() => ({
        onStart: jest.fn(function(callback) {
          this._onStartCallback = callback;
          return this;
        }),
        onEnd: jest.fn().mockReturnThis(),
        enabled: jest.fn().mockReturnThis(),
      })),
      Pan: jest.fn(() => ({
        onStart: jest.fn(function(callback) {
          this._onStartCallback = callback;
          return this;
        }),
        onEnd: jest.fn().mockReturnThis(),
        enabled: jest.fn().mockReturnThis(),
      })),
    },
    GestureHandlerRootView: View,
  };
});
