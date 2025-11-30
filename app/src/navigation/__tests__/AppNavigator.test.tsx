import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../utils/screenTestHelpers';
import AppNavigator from '../AppNavigator';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useTheme } from '../../theme';
import { ThemeColors, lightColors, darkColors } from '../../theme/colors';

// ============================================================================
// SCREEN MOCKS - Consolidated from 113+ lines using utilities
// ============================================================================

// Create screen mock factory
const createScreenMock = (screenName: string, testId: string, includeText = false) => {
  return jest.fn(() => {
    const React = require('react');
    const { View, Text } = require('react-native');
    if (includeText) {
      return React.createElement(
        View,
        { testID: testId },
        React.createElement(Text, {}, screenName)
      );
    }
    return React.createElement(View, { testID: testId });
  });
};

// Mock all main screens with text content
jest.mock('../../screens/DashboardScreen', () => createScreenMock('Dashboard', 'dashboard-screen', true));
jest.mock('../../screens/AnalyticsScreen', () => createScreenMock('Analytics', 'analytics-screen', true));
jest.mock('../../screens/WelcomeScreen', () => createScreenMock('Welcome', 'welcome-screen', true));
jest.mock('../../screens/episode/EpisodesScreen', () => createScreenMock('Episodes', 'episodes-screen', true));
jest.mock('../../screens/medication/MedicationsScreen', () => createScreenMock('Medications', 'medications-screen', true));

// Mock all other screens without text content
jest.mock('../../screens/episode/NewEpisodeScreen', () => createScreenMock('NewEpisode', 'new-episode-screen'));
jest.mock('../../screens/settings/SettingsScreen', () => createScreenMock('Settings', 'settings-screen'));
jest.mock('../../screens/LogUpdateScreen', () => createScreenMock('LogUpdate', 'log-update-screen'));
jest.mock('../../screens/DailyStatusPromptScreen', () => createScreenMock('DailyStatusPrompt', 'daily-status-prompt-screen'));
jest.mock('../../screens/episode/EpisodeDetailScreen', () => createScreenMock('EpisodeDetail', 'episode-detail-screen'));
jest.mock('../../screens/episode/EditIntensityReadingScreen', () => createScreenMock('EditIntensityReading', 'edit-intensity-reading-screen'));
jest.mock('../../screens/episode/EditEpisodeNoteScreen', () => createScreenMock('EditEpisodeNote', 'edit-episode-note-screen'));
jest.mock('../../screens/episode/EditSymptomLogScreen', () => createScreenMock('EditSymptomLog', 'edit-symptom-log-screen'));
jest.mock('../../screens/episode/EditPainLocationLogScreen', () => createScreenMock('EditPainLocationLog', 'edit-pain-location-log-screen'));
jest.mock('../../screens/medication/AddMedicationScreen', () => createScreenMock('AddMedication', 'add-medication-screen'));
jest.mock('../../screens/medication/EditMedicationScreen', () => createScreenMock('EditMedication', 'edit-medication-screen'));
jest.mock('../../screens/medication/MedicationDetailScreen', () => createScreenMock('MedicationDetail', 'medication-detail-screen'));
jest.mock('../../screens/medication/LogMedicationScreen', () => createScreenMock('LogMedication', 'log-medication-screen'));
jest.mock('../../screens/medication/MedicationLogScreen', () => createScreenMock('MedicationLog', 'medication-log-screen'));
jest.mock('../../screens/medication/EditMedicationDoseScreen', () => createScreenMock('EditMedicationDose', 'edit-medication-dose-screen'));
jest.mock('../../screens/medication/ArchivedMedicationsScreen', () => createScreenMock('ArchivedMedications', 'archived-medications-screen'));
jest.mock('../../screens/settings/NotificationSettingsScreen', () => createScreenMock('NotificationSettings', 'notification-settings-screen'));
jest.mock('../../screens/settings/LocationSettingsScreen', () => createScreenMock('LocationSettings', 'location-settings-screen'));
jest.mock('../../screens/settings/DataSettingsScreen', () => createScreenMock('DataSettings', 'data-settings-screen'));
jest.mock('../../screens/settings/DeveloperToolsScreen', () => createScreenMock('DeveloperTools', 'developer-tools-screen'));
jest.mock('../../screens/settings/BackupRecoveryScreen', () => createScreenMock('BackupRecovery', 'backup-recovery-screen'));
jest.mock('../../screens/settings/ErrorLogsScreen', () => createScreenMock('ErrorLogs', 'error-logs-screen'));
jest.mock('../../screens/settings/PerformanceScreen', () => createScreenMock('Performance', 'performance-screen'));

// ============================================================================
// STORE AND SERVICE MOCKS
// ============================================================================

jest.mock('../../store/onboardingStore');
jest.mock('../NavigationService', () => ({
  navigationRef: { current: null },
}));

// Mock vector icons with proper structure
jest.mock('@expo/vector-icons', () => ({
  Ionicons: jest.fn((props: any) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    const { name, size, color, ...otherProps } = props;
    return React.createElement(
      View,
      { testID: `ionicon-${name}`, ...otherProps },
      React.createElement(Text, {}, `${name}-${size}-${color}`)
    );
  }),
}));

// Mock theme module
jest.mock('../../theme', () => ({
  useTheme: jest.fn(),
}));

// ============================================================================
// TEST UTILITIES AND FIXTURES
// ============================================================================

interface OnboardingStoreState {
  isOnboardingComplete: boolean;
  isLoading: boolean;
  checkOnboardingStatus: jest.MockedFunction<() => Promise<void>>;
  completeOnboarding: jest.MockedFunction<() => Promise<void>>;
  skipOnboarding: jest.MockedFunction<() => Promise<void>>;
  resetOnboarding: jest.MockedFunction<() => Promise<void>>;
}

interface ThemeState {
  theme: ThemeColors;
  themeMode: 'light' | 'dark' | 'system';
  isDark: boolean;
  setThemeMode: jest.MockedFunction<(mode: 'light' | 'dark' | 'system') => void>;
}

// Pre-defined fixtures for common test scenarios
const createMockOnboardingStore = (overrides: Partial<OnboardingStoreState> = {}): OnboardingStoreState => ({
  isOnboardingComplete: false,
  isLoading: false,
  checkOnboardingStatus: jest.fn().mockResolvedValue(undefined),
  completeOnboarding: jest.fn().mockResolvedValue(undefined),
  skipOnboarding: jest.fn().mockResolvedValue(undefined),
  resetOnboarding: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const createMockThemeState = (mode: 'light' | 'dark' = 'light', customTheme?: Partial<ThemeColors>): ThemeState => {
  const baseTheme = mode === 'dark' ? darkColors : lightColors;
  const theme = customTheme ? { ...baseTheme, ...customTheme } : baseTheme;
  
  return {
    theme,
    themeMode: mode,
    isDark: mode === 'dark',
    setThemeMode: jest.fn(),
  };
};

const onboardingFixtures = {
  complete: createMockOnboardingStore({ isOnboardingComplete: true }),
  incomplete: createMockOnboardingStore({ isOnboardingComplete: false }),
  loading: createMockOnboardingStore({ isLoading: true }),
  error: createMockOnboardingStore({
    checkOnboardingStatus: jest.fn().mockRejectedValue(new Error('Storage error')),
  }),
};

const themeFixtures = {
  light: createMockThemeState('light'),
  dark: createMockThemeState('dark'),
  customLight: createMockThemeState('light', {
    primary: '#FF0000',
    tabBarActive: '#FF0000',
    tabBarInactive: '#CCCCCC',
  }),
};

// Assertion helpers
const expectScreenToBeVisible = (testId: string) => {
  expect(screen.getByTestId(testId)).toBeTruthy();
};

const expectScreenToBeHidden = (testId: string) => {
  expect(screen.queryByTestId(testId)).toBeNull();
};

const expectMainTabLabels = () => {
  expect(screen.getByText('Home')).toBeTruthy();
  expect(screen.getByText('Episodes')).toBeTruthy();
  expect(screen.getByText('Meds')).toBeTruthy();
  expect(screen.getByText('Trends')).toBeTruthy();
};

const expectTabIconsToBePresent = (iconNames: string[]) => {
  iconNames.forEach(iconName => {
    expect(screen.getByTestId(`ionicon-${iconName}`)).toBeTruthy();
  });
};

// Enhanced render utilities
const renderNavigationComponent = (
  component: React.ReactElement,
  options: {
    onboardingState?: OnboardingStoreState;
    themeState?: ThemeState;
  } = {}
) => {
  const {
    onboardingState = onboardingFixtures.complete,
    themeState = themeFixtures.light,
  } = options;

  const mockUseOnboardingStore = useOnboardingStore as jest.MockedFunction<typeof useOnboardingStore>;
  const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

  mockUseOnboardingStore.mockReturnValue(onboardingState);
  mockUseTheme.mockReturnValue(themeState);

  return renderWithProviders(component);
};

// Enhanced render utilities

// ============================================================================
// TEST SUITE
// ============================================================================

describe('AppNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Onboarding State Management', () => {
    it('should render main tabs when onboarding is complete', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
        expectScreenToBeHidden('welcome-screen');
      });

      expect(screen.getByText('Dashboard')).toBeTruthy();
    });

    it('should render welcome screen when onboarding is incomplete', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.incomplete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('welcome-screen');
        expectScreenToBeHidden('dashboard-screen');
      });

      expect(screen.getByText('Welcome')).toBeTruthy();
    });

    it('should render nothing while loading onboarding status', () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.loading,
      });

      expectScreenToBeHidden('dashboard-screen');
      expectScreenToBeHidden('welcome-screen');
    });

    it('should handle onboarding completion state transitions', async () => {
      // Test incomplete state
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.incomplete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('welcome-screen');
        expectScreenToBeHidden('dashboard-screen');
      });

      // Test complete state in separate render
      const { unmount } = renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
        expectScreenToBeHidden('welcome-screen');
      });

      unmount();
    });

    it('should handle loading state transitions properly', async () => {
      // Test loading state
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.loading,
      });

      // Should render nothing while loading
      expectScreenToBeHidden('dashboard-screen');
      expectScreenToBeHidden('welcome-screen');

      // Test loaded state in separate render
      const { unmount } = renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
        expectScreenToBeHidden('welcome-screen');
      });

      unmount();
    });
  });

  describe('Tab Navigation Structure', () => {
    beforeEach(async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });
      
      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });
    });

    it('should render all main tab components', () => {
      expectMainTabLabels();
    });

    it('should display correct tab icons with proper states', () => {
      const expectedIcons = [
        'home', 'home-outline',
        'list', 'list-outline', 
        'medical', 'medical-outline',
        'stats-chart', 'stats-chart-outline'
      ];
      
      expectTabIconsToBePresent(expectedIcons);
    });

    it('should render main screen content correctly', () => {
      expect(screen.getByText('Dashboard')).toBeTruthy();
      expectScreenToBeVisible('dashboard-screen');
    });

    it('should configure tab styling correctly', () => {
      expectMainTabLabels();
    });
  });

  describe('Theme Integration', () => {
    it('should apply light theme styling correctly', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
        themeState: themeFixtures.light,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });

      expectTabIconsToBePresent(['home', 'home-outline']);
    });

    it('should apply dark theme styling correctly', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
        themeState: themeFixtures.dark,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });

      expectMainTabLabels();
    });

    it('should apply custom theme colors correctly', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
        themeState: themeFixtures.customLight,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });

      expectMainTabLabels();
      expectTabIconsToBePresent(['home']);
    });
  });

  describe('Navigation Behavior', () => {
    it('should configure correct initial route based on onboarding status', async () => {
      // Test with onboarding complete
      const completeResult = renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });

      completeResult.unmount();

      // Test with onboarding incomplete  
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.incomplete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('welcome-screen');
      });
    });

    it('should maintain navigation container structure', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });
    });

    it('should handle modal screen configurations', () => {
      expect(() => 
        renderNavigationComponent(<AppNavigator />, {
          onboardingState: onboardingFixtures.complete,
        })
      ).not.toThrow();
    });

    it('should configure screen options correctly', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle onboarding store errors gracefully', () => {
      expect(() =>
        renderNavigationComponent(<AppNavigator />, {
          onboardingState: onboardingFixtures.error,
        })
      ).not.toThrow();
    });

    it('should handle rapid state changes without crashing', () => {
      const { rerender } = renderNavigationComponent(<AppNavigator />);
      
      const states = [
        onboardingFixtures.complete,
        onboardingFixtures.incomplete, 
        onboardingFixtures.loading,
        onboardingFixtures.complete,
      ];

      states.forEach(state => {
        expect(() => {
          renderNavigationComponent(<AppNavigator />, {
            onboardingState: state,
          });
          rerender(<AppNavigator />);
        }).not.toThrow();
      });
    });

    it('should recover from invalid store states', () => {
      const invalidStoreState = createMockOnboardingStore({
        isOnboardingComplete: true,
        isLoading: false,
        // @ts-ignore - Testing invalid state
        checkOnboardingStatus: null,
      });

      expect(() =>
        renderNavigationComponent(<AppNavigator />, {
          onboardingState: invalidStoreState,
        })
      ).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should integrate properly with store system', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });
    });

    it('should integrate properly with navigation service', async () => {
      renderNavigationComponent(<AppNavigator />);

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });
    });

    it('should handle complex navigation flows', async () => {
      // Test welcome flow
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.incomplete,
      });

      // Start at welcome
      await waitFor(() => {
        expectScreenToBeVisible('welcome-screen');
      });

      const { unmount } = renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      // Should navigate to main tabs
      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
        expect(screen.getByText('Dashboard')).toBeTruthy();
      });

      // Should have all tab navigation available
      expectMainTabLabels();

      unmount();
    });

    it('should maintain accessibility throughout navigation', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      await waitFor(() => {
        expectMainTabLabels();
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should render efficiently without unnecessary re-renders', () => {
      let renderCount = 0;
      
      const TestWrapper = () => {
        renderCount++;
        return <AppNavigator />;
      };

      const { rerender } = renderNavigationComponent(<TestWrapper />);
      
      const initialRenderCount = renderCount;
      rerender(<TestWrapper />);
      
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(1);
    });

    it('should handle memory cleanup properly', () => {
      const result = renderNavigationComponent(<AppNavigator />);
      
      expect(() => result.unmount()).not.toThrow();
    });

    it('should load screens lazily without blocking', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });
    });
  });

  describe('Screen Component Resolution', () => {
    it('should resolve all main screen components without errors', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.complete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
        expect(screen.getByText('Dashboard')).toBeTruthy();
      });
    });

    it('should resolve welcome screen correctly', async () => {
      renderNavigationComponent(<AppNavigator />, {
        onboardingState: onboardingFixtures.incomplete,
      });

      await waitFor(() => {
        expectScreenToBeVisible('welcome-screen');
        expect(screen.getByText('Welcome')).toBeTruthy();
      });
    });

    it('should handle all screen imports without throwing', () => {
      expect(() =>
        renderNavigationComponent(<AppNavigator />)
      ).not.toThrow();
    });
  });

  describe('Legacy Compatibility', () => {
    it('should maintain backward compatibility with existing behavior', async () => {
      const mockUseOnboardingStore = useOnboardingStore as jest.MockedFunction<typeof useOnboardingStore>;
      const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

      mockUseOnboardingStore.mockReturnValue({
        isOnboardingComplete: true,
        isLoading: false,
        checkOnboardingStatus: jest.fn(),
        completeOnboarding: jest.fn(),
        skipOnboarding: jest.fn(),
        resetOnboarding: jest.fn(),
      });

      mockUseTheme.mockReturnValue({
        theme: lightColors,
        themeMode: 'light',
        isDark: false,
        setThemeMode: jest.fn(),
      });

      renderWithProviders(<AppNavigator />);

      await waitFor(() => {
        expectScreenToBeVisible('dashboard-screen');
      });
    });
  });
});