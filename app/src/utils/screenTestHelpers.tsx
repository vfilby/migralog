import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../theme/ThemeContext';

// Mock navigation props factory
export const createMockNavigation = (overrides = {}) => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
  getId: jest.fn(() => 'test-route-id'),
  getParent: jest.fn(),
  getState: jest.fn(() => ({
    key: 'test-state-key',
    index: 0,
    routeNames: ['Test'],
    routes: [{ key: 'test-route-key', name: 'Test' }],
  })),
  dispatch: jest.fn(),
  setParams: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
  isFocused: jest.fn(() => true),
  ...overrides,
});

// Mock route props factory
export const createMockRoute = (params = {}, name = 'TestScreen') => ({
  key: 'test-route-key',
  name,
  params,
});

// Mock store data
export const mockEpisodeData = {
  episodes: [
    {
      id: 'test-episode-1',
      startTime: Date.now() - 24 * 60 * 60 * 1000,
      endTime: Date.now() - 20 * 60 * 60 * 1000,
      peakIntensity: 7,
      averageIntensity: 5,
      locations: ['front'],
      qualities: ['throbbing'],
      symptoms: ['nausea'],
      triggers: ['stress'],
      notes: 'Test episode',
      createdAt: Date.now() - 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 20 * 60 * 60 * 1000,
    },
  ],
  currentEpisode: null,
  loading: false,
  error: null,
  // Mock functions
  loadEpisodes: jest.fn(),
  loadCurrentEpisode: jest.fn(),
  startEpisode: jest.fn(),
  endEpisode: jest.fn(),
  updateEpisode: jest.fn(),
  deleteEpisode: jest.fn(),
};

export const mockMedicationData = {
  medications: [
    {
      id: 'test-med-1',
      name: 'Test Medication',
      type: 'rescue' as const,
      dosageAmount: 400,
      dosageUnit: 'mg',
      defaultDosage: 1,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  doses: [],
  schedules: [],
  reminders: [],
  loading: false,
  error: null,
  // Mock functions
  loadMedications: jest.fn(),
  loadSchedules: jest.fn(),
  loadDoses: jest.fn(),
  addMedication: jest.fn(),
  updateMedication: jest.fn(),
  deleteMedication: jest.fn(),
  logDose: jest.fn(),
};

export const mockDailyStatusData = {
  logs: [],
  todayStatus: null,
  loading: false,
  error: null,
  // Mock functions
  loadLogs: jest.fn(),
  logStatus: jest.fn(),
  updateStatus: jest.fn(),
  reset: jest.fn(),
};

// Theme wrapper
const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

// Navigation wrapper
const NavigationWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NavigationContainer>
    {children}
  </NavigationContainer>
);

// Combined wrapper for all providers
const AllTheProviders: React.FC<{
  children: React.ReactNode;
  withNavigation?: boolean;
}> = ({ 
  children, 
  withNavigation = false 
}) => {
  const content = (
    <ThemeWrapper>
      {children}
    </ThemeWrapper>
  );

  if (withNavigation) {
    return <NavigationWrapper>{content}</NavigationWrapper>;
  }

  return content;
};

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  episodeData?: Partial<typeof mockEpisodeData>;
  medicationData?: Partial<typeof mockMedicationData>;
  dailyStatusData?: Partial<typeof mockDailyStatusData>;
  withNavigation?: boolean;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const {
    episodeData,
    medicationData,
    dailyStatusData,
    withNavigation,
    ...renderOptions
  } = options;

  // Mock the stores before rendering
  if (episodeData) {
    jest.doMock('../store/episodeStore', () => ({
      useEpisodeStore: jest.fn(() => ({
        ...mockEpisodeData,
        ...episodeData,
      })),
    }));
  }

  if (medicationData) {
    jest.doMock('../store/medicationStore', () => ({
      useMedicationStore: jest.fn(() => ({
        ...mockMedicationData,
        ...medicationData,
      })),
    }));
  }

  if (dailyStatusData) {
    jest.doMock('../store/dailyStatusStore', () => ({
      useDailyStatusStore: jest.fn(() => ({
        ...mockDailyStatusData,
        ...dailyStatusData,
      })),
    }));
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders
      withNavigation={withNavigation}
    >
      {children}
    </AllTheProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Re-export everything from React Native Testing Library
export * from '@testing-library/react-native';
export { renderWithProviders as render };
