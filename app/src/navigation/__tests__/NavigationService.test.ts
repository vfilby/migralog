/**
 * NavigationService Test Suite
 *
 * Tests for the navigation service providing programmatic navigation
 * outside of React components (e.g., for deep links and utilities)
 */

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => {
  const mockNavigationRef = {
    isReady: jest.fn(),
    navigate: jest.fn(),
    goBack: jest.fn(),
    current: null,
    getRootState: jest.fn(),
    dispatch: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    canGoBack: jest.fn(),
    isFocused: jest.fn(),
    getCurrentRoute: jest.fn(),
    getCurrentOptions: jest.fn(),
    getParent: jest.fn(),
    getState: jest.fn(),
    getId: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
  };

  return {
    createNavigationContainerRef: jest.fn(() => mockNavigationRef),
    __mockNavigationRef: mockNavigationRef, // Export for access in tests
  };
});

// Import modules after mocking
import { navigationRef, navigate, goBack } from '../NavigationService';
import { RootStackParamList } from '../types';

// Get the mock reference
const mockNavigationModule = jest.requireMock('@react-navigation/native');
const mockNavigationRef = mockNavigationModule.__mockNavigationRef;

describe('NavigationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks to default behavior
    mockNavigationRef.isReady.mockReturnValue(true);
    mockNavigationRef.navigate.mockImplementation(() => {});
    mockNavigationRef.goBack.mockImplementation(() => {});
  });

  describe('Module Exports', () => {
    it('should export navigationRef', () => {
      expect(navigationRef).toBeDefined();
    });

    it('should export navigate function', () => {
      expect(typeof navigate).toBe('function');
    });

    it('should export goBack function', () => {
      expect(typeof goBack).toBe('function');
    });
  });

  describe('navigationRef', () => {
    it('should have all required methods', () => {
      expect(typeof navigationRef.isReady).toBe('function');
      expect(typeof navigationRef.navigate).toBe('function');
      expect(typeof navigationRef.goBack).toBe('function');
    });
  });

  describe('navigate()', () => {
    describe('when navigation is ready', () => {
      beforeEach(() => {
        mockNavigationRef.isReady.mockReturnValue(true);
      });

      it('should navigate to route without parameters', () => {
        navigate('Welcome');

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(1);
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Welcome', undefined);
      });

      it('should navigate to route with parameters', () => {
        const params = { episodeId: '123' };
        navigate('EpisodeDetail', params);

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(1);
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('EpisodeDetail', params);
      });

      it('should navigate to MainTabs route', () => {
        navigate('MainTabs');

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(1);
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('MainTabs', undefined);
      });

      it('should navigate to NewEpisode with optional episodeId', () => {
        const params = { episodeId: 'episode-456' };
        navigate('NewEpisode', params);

        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('NewEpisode', params);
      });

      it('should navigate to NewEpisode without episodeId', () => {
        navigate('NewEpisode');

        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('NewEpisode', undefined);
      });

      it('should navigate to LogUpdate route', () => {
        const params = { episodeId: 'episode-789' };
        navigate('LogUpdate', params);

        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('LogUpdate', params);
      });

      it('should navigate to medication routes', () => {
        // AddMedication (no params)
        navigate('AddMedication');
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('AddMedication', undefined);

        // EditMedication (with medicationId)
        navigate('EditMedication', { medicationId: 'med-123' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('EditMedication', { medicationId: 'med-123' });

        // MedicationDetail
        navigate('MedicationDetail', { medicationId: 'med-456' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('MedicationDetail', { medicationId: 'med-456' });
      });

      it('should navigate to LogMedication with optional parameters', () => {
        // With medicationId only
        navigate('LogMedication', { medicationId: 'med-123' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('LogMedication', { medicationId: 'med-123' });

        // With episodeId only  
        navigate('LogMedication', { episodeId: 'episode-456' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('LogMedication', { episodeId: 'episode-456' });

        // With both parameters
        navigate('LogMedication', { medicationId: 'med-789', episodeId: 'episode-789' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('LogMedication', { medicationId: 'med-789', episodeId: 'episode-789' });

        // Without parameters
        navigate('LogMedication');
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('LogMedication', undefined);
      });

      it('should navigate to settings routes', () => {
        // Settings main
        navigate('Settings');
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Settings', undefined);

        // Notification settings
        navigate('NotificationSettingsScreen');
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('NotificationSettingsScreen', undefined);

        // Location settings
        navigate('LocationSettingsScreen');
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('LocationSettingsScreen', undefined);

        // Data settings
        navigate('DataSettingsScreen');
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('DataSettingsScreen', undefined);
      });

      it('should navigate to developer and debug routes', () => {
        navigate('DeveloperToolsScreen');
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('DeveloperToolsScreen', undefined);

        navigate('ErrorLogs');
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('ErrorLogs', undefined);

        navigate('Performance');
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Performance', undefined);
      });

      it('should navigate to edit routes with required IDs', () => {
        navigate('EditMedicationDose', { doseId: 'dose-123' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('EditMedicationDose', { doseId: 'dose-123' });

        navigate('EditIntensityReading', { readingId: 'reading-456' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('EditIntensityReading', { readingId: 'reading-456' });

        navigate('EditSymptomLog', { symptomLogId: 'symptom-789' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('EditSymptomLog', { symptomLogId: 'symptom-789' });

        navigate('EditPainLocationLog', { painLocationLogId: 'pain-123' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('EditPainLocationLog', { painLocationLogId: 'pain-123' });

        navigate('EditEpisodeNote', { noteId: 'note-456' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('EditEpisodeNote', { noteId: 'note-456' });
      });

      it('should navigate to DailyStatusPrompt with optional date', () => {
        // With date
        navigate('DailyStatusPrompt', { date: '2023-12-01' });
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('DailyStatusPrompt', { date: '2023-12-01' });

        // Without date
        navigate('DailyStatusPrompt');
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('DailyStatusPrompt', undefined);
      });

      it('should handle multiple navigation calls', () => {
        navigate('Welcome');
        navigate('MainTabs');
        navigate('EpisodeDetail', { episodeId: 'test-episode' });

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(3);
        expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(3);
        expect(mockNavigationRef.navigate).toHaveBeenNthCalledWith(1, 'Welcome', undefined);
        expect(mockNavigationRef.navigate).toHaveBeenNthCalledWith(2, 'MainTabs', undefined);
        expect(mockNavigationRef.navigate).toHaveBeenNthCalledWith(3, 'EpisodeDetail', { episodeId: 'test-episode' });
      });
    });

    describe('when navigation is not ready', () => {
      beforeEach(() => {
        mockNavigationRef.isReady.mockReturnValue(false);
      });

      it('should not navigate when navigation ref is not ready', () => {
        navigate('Welcome');

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(1);
        expect(mockNavigationRef.navigate).not.toHaveBeenCalled();
      });

      it('should not navigate with parameters when not ready', () => {
        navigate('EpisodeDetail', { episodeId: '123' });

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(1);
        expect(mockNavigationRef.navigate).not.toHaveBeenCalled();
      });

      it('should check readiness for each navigate call', () => {
        navigate('Welcome');
        navigate('MainTabs');
        navigate('Settings');

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(3);
        expect(mockNavigationRef.navigate).not.toHaveBeenCalled();
      });

      it('should handle transition from not ready to ready', () => {
        // First call - not ready
        navigate('Welcome');
        expect(mockNavigationRef.navigate).not.toHaveBeenCalled();

        // Make ready
        mockNavigationRef.isReady.mockReturnValue(true);

        // Second call - ready
        navigate('MainTabs');
        expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(1);
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('MainTabs', undefined);
      });
    });

    describe('edge cases', () => {
      beforeEach(() => {
        mockNavigationRef.isReady.mockReturnValue(true);
      });

      it('should handle empty parameters object', () => {
        // TypeScript would prevent this, but testing runtime behavior
        navigate('EpisodeDetail', {} as any);

        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('EpisodeDetail', {});
      });

      it('should handle null parameters', () => {
        // TypeScript would prevent this, but testing runtime behavior
        navigate('Welcome', null as any);

        expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Welcome', null);
      });

      it('should handle isReady throwing an error', () => {
        mockNavigationRef.isReady.mockImplementation(() => {
          throw new Error('Navigation ref error');
        });

        expect(() => navigate('Welcome')).toThrow('Navigation ref error');
        expect(mockNavigationRef.navigate).not.toHaveBeenCalled();
      });

      it('should handle navigate throwing an error when ready', () => {
        mockNavigationRef.navigate.mockImplementation(() => {
          throw new Error('Navigate error');
        });

        expect(() => navigate('Welcome')).toThrow('Navigate error');
      });
    });
  });

  describe('goBack()', () => {
    describe('when navigation is ready', () => {
      beforeEach(() => {
        mockNavigationRef.isReady.mockReturnValue(true);
      });

      it('should call goBack when navigation is ready', () => {
        goBack();

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(1);
        expect(mockNavigationRef.goBack).toHaveBeenCalledTimes(1);
      });

      it('should handle multiple goBack calls', () => {
        goBack();
        goBack();
        goBack();

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(3);
        expect(mockNavigationRef.goBack).toHaveBeenCalledTimes(3);
      });

      it('should call goBack without parameters', () => {
        goBack();

        expect(mockNavigationRef.goBack).toHaveBeenCalledWith();
      });
    });

    describe('when navigation is not ready', () => {
      beforeEach(() => {
        mockNavigationRef.isReady.mockReturnValue(false);
      });

      it('should not call goBack when navigation ref is not ready', () => {
        goBack();

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(1);
        expect(mockNavigationRef.goBack).not.toHaveBeenCalled();
      });

      it('should check readiness for each goBack call', () => {
        goBack();
        goBack();
        goBack();

        expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(3);
        expect(mockNavigationRef.goBack).not.toHaveBeenCalled();
      });

      it('should handle transition from not ready to ready', () => {
        // First call - not ready
        goBack();
        expect(mockNavigationRef.goBack).not.toHaveBeenCalled();

        // Make ready
        mockNavigationRef.isReady.mockReturnValue(true);

        // Second call - ready
        goBack();
        expect(mockNavigationRef.goBack).toHaveBeenCalledTimes(1);
      });
    });

    describe('edge cases', () => {
      beforeEach(() => {
        mockNavigationRef.isReady.mockReturnValue(true);
      });

      it('should handle isReady throwing an error', () => {
        mockNavigationRef.isReady.mockImplementation(() => {
          throw new Error('Navigation ref error');
        });

        expect(() => goBack()).toThrow('Navigation ref error');
        expect(mockNavigationRef.goBack).not.toHaveBeenCalled();
      });

      it('should handle goBack throwing an error when ready', () => {
        mockNavigationRef.goBack.mockImplementation(() => {
          throw new Error('GoBack error');
        });

        expect(() => goBack()).toThrow('GoBack error');
      });
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      mockNavigationRef.isReady.mockReturnValue(true);
    });

    it('should handle navigation followed by goBack', () => {
      navigate('EpisodeDetail', { episodeId: '123' });
      goBack();

      expect(mockNavigationRef.navigate).toHaveBeenCalledWith('EpisodeDetail', { episodeId: '123' });
      expect(mockNavigationRef.goBack).toHaveBeenCalledTimes(1);
    });

    it('should handle complex navigation flow', () => {
      // Navigate to episode detail
      navigate('EpisodeDetail', { episodeId: '123' });
      
      // Navigate to edit screen
      navigate('EditIntensityReading', { readingId: 'reading-456' });
      
      // Go back
      goBack();
      
      // Navigate to another screen
      navigate('Settings');

      expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(3);
      expect(mockNavigationRef.goBack).toHaveBeenCalledTimes(1);
      expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(4);
    });

    it('should handle rapid navigate and goBack calls', () => {
      for (let i = 0; i < 5; i++) {
        navigate('Settings');
        goBack();
      }

      expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(5);
      expect(mockNavigationRef.goBack).toHaveBeenCalledTimes(5);
      expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(10);
    });
  });

  describe('Type safety and parameter validation', () => {
    beforeEach(() => {
      mockNavigationRef.isReady.mockReturnValue(true);
    });

    it('should handle all route types from RootStackParamList', () => {
      // Routes without parameters
      const noParamRoutes: (keyof RootStackParamList)[] = [
        'Welcome',
        'MainTabs', 
        'AddMedication',
        'MedicationLog',
        'ArchivedMedications',
        'Settings',
        'NotificationSettingsScreen',
        'LocationSettingsScreen',
        'DataSettingsScreen',
        'DeveloperToolsScreen',
        'ErrorLogs',
        'Performance'
      ];

      noParamRoutes.forEach(route => {
        navigate(route);
        expect(mockNavigationRef.navigate).toHaveBeenCalledWith(route, undefined);
      });
    });

    it('should handle routes with required parameters', () => {
      navigate('EpisodeDetail', { episodeId: 'test-episode' });
      navigate('EditMedication', { medicationId: 'test-med' });
      navigate('LogUpdate', { episodeId: 'test-episode' });
      navigate('MedicationDetail', { medicationId: 'test-med' });
      navigate('EditMedicationDose', { doseId: 'test-dose' });
      navigate('EditIntensityReading', { readingId: 'test-reading' });
      navigate('EditSymptomLog', { symptomLogId: 'test-symptom' });
      navigate('EditPainLocationLog', { painLocationLogId: 'test-pain' });
      navigate('EditEpisodeNote', { noteId: 'test-note' });

      expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(9);
    });

    it('should handle routes with optional parameters', () => {
      // NewEpisode with and without episodeId
      navigate('NewEpisode', { episodeId: 'test-episode' });
      navigate('NewEpisode');

      // LogMedication with various parameter combinations
      navigate('LogMedication', { medicationId: 'test-med' });
      navigate('LogMedication', { episodeId: 'test-episode' });
      navigate('LogMedication', { medicationId: 'test-med', episodeId: 'test-episode' });
      navigate('LogMedication');

      // DailyStatusPrompt with and without date
      navigate('DailyStatusPrompt', { date: '2023-12-01' });
      navigate('DailyStatusPrompt');

      expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(8);
    });
  });

  describe('Error recovery', () => {
    it('should recover from navigation ref errors', () => {
      // First call fails
      mockNavigationRef.isReady.mockImplementationOnce(() => {
        throw new Error('Temporary error');
      });

      expect(() => navigate('Welcome')).toThrow('Temporary error');

      // Second call succeeds
      mockNavigationRef.isReady.mockReturnValue(true);
      navigate('MainTabs');

      expect(mockNavigationRef.navigate).toHaveBeenCalledWith('MainTabs', undefined);
    });

    it('should handle navigation ref becoming unavailable', () => {
      mockNavigationRef.isReady.mockReturnValue(true);
      navigate('Settings');
      expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(1);

      // Navigation becomes unavailable
      mockNavigationRef.isReady.mockReturnValue(false);
      navigate('Welcome');
      expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(1); // Still just 1 call

      // Navigation becomes available again
      mockNavigationRef.isReady.mockReturnValue(true);
      navigate('MainTabs');
      expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance considerations', () => {
    beforeEach(() => {
      mockNavigationRef.isReady.mockReturnValue(true);
    });

    it('should efficiently handle repeated calls', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        navigate('Settings');
      }
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(100);
      expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(100);
    });

    it('should handle mixed navigate and goBack calls efficiently', () => {
      const operations = 50;
      
      for (let i = 0; i < operations; i++) {
        if (i % 2 === 0) {
          navigate('Settings');
        } else {
          goBack();
        }
      }
      
      expect(mockNavigationRef.isReady).toHaveBeenCalledTimes(operations);
      expect(mockNavigationRef.navigate).toHaveBeenCalledTimes(operations / 2);
      expect(mockNavigationRef.goBack).toHaveBeenCalledTimes(operations / 2);
    });
  });
});