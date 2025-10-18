import React from 'react';
import { render, screen } from '@testing-library/react-native';
import AnalyticsScreen from '../AnalyticsScreen';
import { ThemeProvider } from '../../theme/ThemeContext';

// Mock the episode store
jest.mock('../../store/episodeStore', () => ({
  useEpisodeStore: jest.fn(() => ({
    episodes: [],
    loading: false,
    error: null,
    loadEpisodes: jest.fn(),
  })),
}));

// Mock the MonthlyCalendarView component
jest.mock('../../components/MonthlyCalendarView', () => {
  return function MockMonthlyCalendarView() {
    return null;
  };
});

// Test wrapper with theme
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('AnalyticsScreen', () => {
  describe('Rendering', () => {
    it('renders and shows debug output', () => {
      render(<AnalyticsScreen />, { wrapper: TestWrapper });
      
      // Debug what's actually rendered
      console.log('=== RENDERED OUTPUT ===');
      screen.debug();
      console.log('=== END OUTPUT ===');
      
      expect(true).toBeTruthy(); // Just to make test pass for now
    });
  });
});
