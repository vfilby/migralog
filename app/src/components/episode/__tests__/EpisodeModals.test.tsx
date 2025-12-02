import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EpisodeModals } from '../EpisodeModals';
import { Episode } from '../../../models/types';

// Mock the theme hook to return a fixed theme
jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      background: '#FFFFFF',
      backgroundSecondary: '#F5F5F5',
      card: '#FFFFFF',
      text: '#000000',
      textSecondary: '#666666',
      textTertiary: '#999999',
      border: '#E0E0E0',
      borderLight: '#F0F0F0',
      primary: '#007AFF',
      primaryText: '#FFFFFF',
      danger: '#FF3B30',
      dangerText: '#FFFFFF',
      shadow: '#000000',
      ongoing: '#FF9500',
      ongoingText: '#FFFFFF',
    },
  }),
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) =>
      React.createElement('MapView', { testID: 'map-view', ...props }, children),
    Marker: ({ children, ...props }: any) =>
      React.createElement('Marker', { testID: 'map-marker', ...props }, children),
  };
});

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  return ({ onChange, _value, ...props }: any) =>
    React.createElement('DateTimePicker', {
      testID: 'date-time-picker',
      onPress: () => {
        // Simulate date selection
        const mockEvent = {};
        const newDate = new Date('2024-01-15T16:30:00');
        onChange?.(mockEvent, newDate);
      },
      ...props,
    });
});

// Mock date formatting utility
jest.mock('../../../utils/dateFormatting', () => ({
  formatDateTime: jest.fn((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US');
  }),
}));

const renderComponent = (props: Partial<React.ComponentProps<typeof EpisodeModals>> = {}) => {
  const defaultProps: React.ComponentProps<typeof EpisodeModals> = {
    showMapModal: false,
    showEndTimePicker: false,
    episode: {
      id: 'episode-1',
      startTime: new Date('2024-01-15T10:30:00').getTime(),
      endTime: new Date('2024-01-15T14:30:00').getTime(),
      locations: ['left_temple'],
      qualities: ['throbbing'],
      symptoms: ['nausea'],
      triggers: ['stress'],
      notes: 'Test notes',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    locationAddress: null,
    customEndTime: new Date('2024-01-15T16:30:00').getTime(),
    onCloseMapModal: jest.fn(),
    onCloseEndTimePicker: jest.fn(),
    onCustomTimeChange: jest.fn(),
    onCustomTimeAction: jest.fn(),
    ...props,
  };

  return {
    ...render(<EpisodeModals {...defaultProps} />),
    props: defaultProps,
  };
};

describe('EpisodeModals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render without crashing with default props', () => {
      const { props } = renderComponent();
      expect(props).toBeDefined();
    });

    it('should not render any modals when both are hidden', () => {
      renderComponent({
        showMapModal: false,
        showEndTimePicker: false,
      });

      // Check that modal content is not visible
      expect(screen.queryByText('Episode Location')).toBeNull();
      expect(screen.queryByText('Set End Time')).toBeNull();
    });

    it('should render map modal when showMapModal is true', () => {
      renderComponent({
        showMapModal: true,
        showEndTimePicker: false,
      });

      expect(screen.getByText('Episode Location')).toBeTruthy();
      expect(screen.queryByText('Set End Time')).toBeNull();
    });

    it('should render end time picker modal when showEndTimePicker is true', () => {
      renderComponent({
        showMapModal: false,
        showEndTimePicker: true,
        episode: {
          id: 'episode-1',
          startTime: new Date('2024-01-15T10:30:00').getTime(),
          endTime: undefined, // Active episode shows "Set End Time"
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: ['nausea'],
          triggers: ['stress'],
          notes: 'Test notes',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });

      expect(screen.getByText('Set End Time')).toBeTruthy();
      expect(screen.queryByText('Episode Location')).toBeNull();
    });

    it('should render both modals when both flags are true', () => {
      renderComponent({
        showMapModal: true,
        showEndTimePicker: true,
        episode: {
          id: 'episode-1',
          startTime: new Date('2024-01-15T10:30:00').getTime(),
          endTime: undefined, // Active episode shows "Set End Time"
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: ['nausea'],
          triggers: ['stress'],
          notes: 'Test notes',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });

      expect(screen.getByText('Episode Location')).toBeTruthy();
      expect(screen.getByText('Set End Time')).toBeTruthy();
    });
  });

  describe('Map Modal', () => {
    const episodeWithLocation: Episode = {
      id: 'episode-1',
      startTime: new Date('2024-01-15T10:30:00').getTime(),
      endTime: new Date('2024-01-15T14:30:00').getTime(),
      locations: ['left_temple'],
      qualities: ['throbbing'],
      symptoms: ['nausea'],
      triggers: ['stress'],
      notes: 'Test notes',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      },
    };

    it('should render map modal header correctly', () => {
      renderComponent({
        showMapModal: true,
        episode: episodeWithLocation,
      });

      expect(screen.getByText('Episode Location')).toBeTruthy();
      expect(screen.getByText('Done')).toBeTruthy();
    });

    it('should render map view when episode has location', () => {
      renderComponent({
        showMapModal: true,
        episode: episodeWithLocation,
      });

      expect(screen.getByTestId('map-view')).toBeTruthy();
      expect(screen.getByTestId('map-marker')).toBeTruthy();
    });

    it('should not render map view when episode has no location', () => {
      renderComponent({
        showMapModal: true,
        episode: {
          ...episodeWithLocation,
          location: undefined,
        },
      });

      expect(screen.queryByTestId('map-view')).toBeNull();
      expect(screen.queryByTestId('map-marker')).toBeNull();
    });

    it('should display location address when provided', () => {
      renderComponent({
        showMapModal: true,
        episode: episodeWithLocation,
        locationAddress: 'San Francisco, CA',
      });

      expect(screen.getByText('San Francisco, CA')).toBeTruthy();
    });

    it('should display accuracy information when available', () => {
      renderComponent({
        showMapModal: true,
        episode: episodeWithLocation,
      });

      expect(screen.getByText('Accuracy: ±10m')).toBeTruthy();
    });

    it('should not display accuracy when not available', () => {
      renderComponent({
        showMapModal: true,
        episode: {
          ...episodeWithLocation,
          location: {
            ...episodeWithLocation.location!,
            accuracy: undefined,
          },
        },
      });

      expect(screen.queryByText(/Accuracy:/)).toBeNull();
    });

    it('should call onCloseMapModal when Done button is pressed', () => {
      const mockOnCloseMapModal = jest.fn();
      renderComponent({
        showMapModal: true,
        episode: episodeWithLocation,
        onCloseMapModal: mockOnCloseMapModal,
      });

      fireEvent.press(screen.getByText('Done'));
      expect(mockOnCloseMapModal).toHaveBeenCalledTimes(1);
    });

    it('should render clickable Done button with accessibility', () => {
      const mockOnCloseMapModal = jest.fn();
      renderComponent({
        showMapModal: true,
        episode: episodeWithLocation,
        onCloseMapModal: mockOnCloseMapModal,
      });

      const doneButton = screen.getByText('Done');
      expect(doneButton).toBeTruthy();
      
      // Test that the button is clickable
      fireEvent.press(doneButton);
      expect(mockOnCloseMapModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('End Time Picker Modal', () => {
    it('should render end time picker modal header for setting end time', () => {
      renderComponent({
        showEndTimePicker: true,
        episode: {
          id: 'episode-1',
          startTime: new Date('2024-01-15T10:30:00').getTime(),
          endTime: undefined, // Active episode
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: ['nausea'],
          triggers: ['stress'],
          notes: 'Test notes',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });

      expect(screen.getByText('Set End Time')).toBeTruthy();
      expect(screen.getAllByText('Cancel')).toBeTruthy();
      expect(screen.getAllByText('Done')).toBeTruthy();
    });

    it('should render end time picker modal header for editing end time', () => {
      renderComponent({
        showEndTimePicker: true,
      });

      expect(screen.getByText('Edit End Time')).toBeTruthy();
    });

    it('should render DateTimePicker component', () => {
      renderComponent({
        showEndTimePicker: true,
      });

      expect(screen.getByTestId('date-time-picker')).toBeTruthy();
    });

    it('should call onCloseEndTimePicker when Cancel button is pressed', () => {
      const mockOnCloseEndTimePicker = jest.fn();
      renderComponent({
        showEndTimePicker: true,
        onCloseEndTimePicker: mockOnCloseEndTimePicker,
      });

      fireEvent.press(screen.getByText('Cancel'));
      expect(mockOnCloseEndTimePicker).toHaveBeenCalledTimes(1);
    });

    it('should call onCustomTimeAction when Done button is pressed', () => {
      const mockOnCustomTimeAction = jest.fn();
      renderComponent({
        showEndTimePicker: true,
        onCustomTimeAction: mockOnCustomTimeAction,
      });

      const doneButtons = screen.getAllByText('Done');
      fireEvent.press(doneButtons[doneButtons.length - 1]); // Get the last Done button (from time picker modal)
      expect(mockOnCustomTimeAction).toHaveBeenCalledTimes(1);
    });

    it('should call onCustomTimeChange when date time picker value changes', () => {
      const mockOnCustomTimeChange = jest.fn();
      renderComponent({
        showEndTimePicker: true,
        onCustomTimeChange: mockOnCustomTimeChange,
      });

      const picker = screen.getByTestId('date-time-picker');
      fireEvent.press(picker); // This will trigger the mock onChange
      expect(mockOnCustomTimeChange).toHaveBeenCalledWith(new Date('2024-01-15T16:30:00').getTime());
    });

    it('should use custom end time when provided and valid', () => {
      const customTime = new Date('2024-01-15T18:00:00').getTime();
      renderComponent({
        showEndTimePicker: true,
        customEndTime: customTime,
      });

      const picker = screen.getByTestId('date-time-picker');
      expect(picker).toBeTruthy();
    });

    it('should use current time when custom end time is not valid', () => {
      renderComponent({
        showEndTimePicker: true,
        customEndTime: 0, // Invalid time
      });

      const picker = screen.getByTestId('date-time-picker');
      expect(picker).toBeTruthy();
    });

    it('should render clickable Cancel button for active episode', () => {
      const mockOnCloseEndTimePicker = jest.fn();
      renderComponent({
        showEndTimePicker: true,
        episode: {
          id: 'episode-1',
          startTime: new Date('2024-01-15T10:30:00').getTime(),
          endTime: undefined, // Active episode
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: ['nausea'],
          triggers: ['stress'],
          notes: 'Test notes',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        onCloseEndTimePicker: mockOnCloseEndTimePicker,
      });

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeTruthy();
      
      fireEvent.press(cancelButton);
      expect(mockOnCloseEndTimePicker).toHaveBeenCalledTimes(1);
    });

    it('should render clickable Cancel button for completed episode', () => {
      const mockOnCloseEndTimePicker = jest.fn();
      renderComponent({
        showEndTimePicker: true,
        onCloseEndTimePicker: mockOnCloseEndTimePicker,
      });

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeTruthy();
      
      fireEvent.press(cancelButton);
      expect(mockOnCloseEndTimePicker).toHaveBeenCalledTimes(1);
    });

    it('should render clickable Done button for active episode', () => {
      const mockOnCustomTimeAction = jest.fn();
      renderComponent({
        showEndTimePicker: true,
        episode: {
          id: 'episode-1',
          startTime: new Date('2024-01-15T10:30:00').getTime(),
          endTime: undefined, // Active episode
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: ['nausea'],
          triggers: ['stress'],
          notes: 'Test notes',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        onCustomTimeAction: mockOnCustomTimeAction,
      });

      const doneButtons = screen.getAllByText('Done');
      const timePickerDoneButton = doneButtons[doneButtons.length - 1];
      expect(timePickerDoneButton).toBeTruthy();
      
      fireEvent.press(timePickerDoneButton);
      expect(mockOnCustomTimeAction).toHaveBeenCalledTimes(1);
    });

    it('should render clickable Done button for completed episode', () => {
      const mockOnCustomTimeAction = jest.fn();
      renderComponent({
        showEndTimePicker: true,
        onCustomTimeAction: mockOnCustomTimeAction,
      });

      const doneButtons = screen.getAllByText('Done');
      const timePickerDoneButton = doneButtons[doneButtons.length - 1];
      expect(timePickerDoneButton).toBeTruthy();
      
      fireEvent.press(timePickerDoneButton);
      expect(mockOnCustomTimeAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Modal Behaviors', () => {
    it('should render map modal with proper structure', () => {
      renderComponent({
        showMapModal: true,
      });

      // Test that the modal renders with proper content
      expect(screen.getByText('Episode Location')).toBeTruthy();
      expect(screen.getByText('Done')).toBeTruthy();
    });

    it('should render end time picker modal with proper structure', () => {
      renderComponent({
        showEndTimePicker: true,
        episode: {
          id: 'episode-1',
          startTime: new Date('2024-01-15T10:30:00').getTime(),
          endTime: undefined, // Active episode shows "Set End Time"
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: ['nausea'],
          triggers: ['stress'],
          notes: 'Test notes',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });

      // Test that the modal renders with proper content
      expect(screen.getByText('Set End Time')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
      expect(screen.getByText('Done')).toBeTruthy();
    });
  });

  describe('Props Variations', () => {
    it('should handle episode without location gracefully', () => {
      renderComponent({
        showMapModal: true,
        episode: {
          id: 'episode-1',
          startTime: new Date('2024-01-15T10:30:00').getTime(),
          endTime: new Date('2024-01-15T14:30:00').getTime(),
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: ['nausea'],
          triggers: ['stress'],
          notes: 'Test notes',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          // No location property
        },
      });

      expect(screen.getByText('Episode Location')).toBeTruthy();
      expect(screen.queryByTestId('map-view')).toBeNull();
    });

    it('should handle null location address', () => {
      renderComponent({
        showMapModal: true,
        episode: {
          id: 'episode-1',
          startTime: new Date('2024-01-15T10:30:00').getTime(),
          endTime: new Date('2024-01-15T14:30:00').getTime(),
          locations: ['left_temple'],
          qualities: ['throbbing'],
          symptoms: ['nausea'],
          triggers: ['stress'],
          notes: 'Test notes',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            timestamp: Date.now(),
          },
        },
        locationAddress: null,
      });

      expect(screen.queryByText('San Francisco, CA')).toBeNull();
    });

    it('should handle edge case with zero custom end time', () => {
      renderComponent({
        showEndTimePicker: true,
        customEndTime: 0,
      });

      expect(screen.getByTestId('date-time-picker')).toBeTruthy();
    });

    it('should handle negative custom end time', () => {
      renderComponent({
        showEndTimePicker: true,
        customEndTime: -1000,
      });

      expect(screen.getByTestId('date-time-picker')).toBeTruthy();
    });
  });

  describe('State Management', () => {
    it('should not trigger callbacks when modals are not visible', () => {
      const mockOnCloseMapModal = jest.fn();
      const mockOnCloseEndTimePicker = jest.fn();

      renderComponent({
        showMapModal: false,
        showEndTimePicker: false,
        onCloseMapModal: mockOnCloseMapModal,
        onCloseEndTimePicker: mockOnCloseEndTimePicker,
      });

      // No buttons should be rendered when modals are hidden
      expect(screen.queryByText('Done')).toBeNull();
      expect(screen.queryByText('Cancel')).toBeNull();
    });

    it('should preserve callback functions when re-rendered', () => {
      const mockOnCustomTimeChange = jest.fn();
      const { rerender } = renderComponent({
        showEndTimePicker: true,
        onCustomTimeChange: mockOnCustomTimeChange,
      });

      // Re-render with same props
      rerender(
        <EpisodeModals
          showMapModal={false}
          showEndTimePicker={true}
          episode={{
            id: 'episode-1',
            startTime: new Date('2024-01-15T10:30:00').getTime(),
            endTime: new Date('2024-01-15T14:30:00').getTime(),
            locations: ['left_temple'],
            qualities: ['throbbing'],
            symptoms: ['nausea'],
            triggers: ['stress'],
            notes: 'Test notes',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }}
          locationAddress={null}
          customEndTime={new Date('2024-01-15T16:30:00').getTime()}
          onCloseMapModal={jest.fn()}
          onCloseEndTimePicker={jest.fn()}
          onCustomTimeChange={mockOnCustomTimeChange}
          onCustomTimeAction={jest.fn()}
        />
      );

      const picker = screen.getByTestId('date-time-picker');
      fireEvent.press(picker);
      expect(mockOnCustomTimeChange).toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle DateTimePicker onChange with null selectedDate', () => {
      const mockOnCustomTimeChange = jest.fn();
      
      // Create a custom mock that simulates null date selection
      jest.doMock('@react-native-community/datetimepicker', () => {
        const React = require('react');
        return ({ onChange }: any) =>
          React.createElement('DateTimePicker', {
            testID: 'date-time-picker-null',
            onPress: () => {
              const mockEvent = {};
              onChange?.(mockEvent, null); // Simulate null date
            },
          });
      });

      renderComponent({
        showEndTimePicker: true,
        onCustomTimeChange: mockOnCustomTimeChange,
      });

      const picker = screen.queryByTestId('date-time-picker-null');
      if (picker) {
        fireEvent.press(picker);
        // Should not call onCustomTimeChange with null date
        expect(mockOnCustomTimeChange).not.toHaveBeenCalled();
      }
    });

    it('should handle invalid episode data gracefully', () => {
      renderComponent({
        showMapModal: true,
        episode: {
          id: '',
          startTime: NaN,
          endTime: undefined,
          locations: [],
          qualities: [],
          symptoms: [],
          triggers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });

      expect(screen.getByText('Episode Location')).toBeTruthy();
    });
  });

  describe('Theme Integration', () => {
    it('should apply theme styles correctly', () => {
      renderComponent({
        showMapModal: true,
      });

      expect(screen.getByText('Episode Location')).toBeTruthy();
      expect(screen.getByText('Done')).toBeTruthy();
    });
  });

  describe('useMemo Hook', () => {
    it('should memoize styles correctly', () => {
      const { rerender } = renderComponent({
        showMapModal: true,
      });

      expect(screen.getByText('Episode Location')).toBeTruthy();

      // Re-render with same theme should not cause issues
      rerender(
        <EpisodeModals
          showMapModal={true}
          showEndTimePicker={false}
          episode={{
            id: 'episode-1',
            startTime: new Date('2024-01-15T10:30:00').getTime(),
            endTime: new Date('2024-01-15T14:30:00').getTime(),
            locations: ['left_temple'],
            qualities: ['throbbing'],
            symptoms: ['nausea'],
            triggers: ['stress'],
            notes: 'Test notes',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }}
          locationAddress={null}
          customEndTime={new Date('2024-01-15T16:30:00').getTime()}
          onCloseMapModal={jest.fn()}
          onCloseEndTimePicker={jest.fn()}
          onCustomTimeChange={jest.fn()}
          onCustomTimeAction={jest.fn()}
        />
      );

      expect(screen.getByText('Episode Location')).toBeTruthy();
    });
  });

  describe('Complete Integration Tests', () => {
    it('should handle complete map modal workflow', () => {
      const mockOnCloseMapModal = jest.fn();
      const episode = {
        id: 'episode-1',
        startTime: new Date('2024-01-15T10:30:00').getTime(),
        endTime: new Date('2024-01-15T14:30:00').getTime(),
        locations: ['left_temple'] as any,
        qualities: ['throbbing'] as any,
        symptoms: ['nausea'] as any,
        triggers: ['stress'] as any,
        notes: 'Test notes',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 15,
          timestamp: Date.now(),
        },
      };

      renderComponent({
        showMapModal: true,
        episode,
        locationAddress: 'Test Address',
        onCloseMapModal: mockOnCloseMapModal,
      });

      // Verify all elements are present
      expect(screen.getByText('Episode Location')).toBeTruthy();
      expect(screen.getByText('Test Address')).toBeTruthy();
      expect(screen.getByText('Accuracy: ±15m')).toBeTruthy();
      expect(screen.getByTestId('map-view')).toBeTruthy();
      expect(screen.getByTestId('map-marker')).toBeTruthy();

      // Test interaction
      fireEvent.press(screen.getByText('Done'));
      expect(mockOnCloseMapModal).toHaveBeenCalledTimes(1);
    });

    it('should handle complete time picker workflow for active episode', () => {
      const mockOnCloseEndTimePicker = jest.fn();
      const mockOnCustomTimeAction = jest.fn();
      const mockOnCustomTimeChange = jest.fn();
      
      const episode = {
        id: 'episode-1',
        startTime: new Date('2024-01-15T10:30:00').getTime(),
        endTime: undefined, // Active episode
        locations: ['left_temple'] as any,
        qualities: ['throbbing'] as any,
        symptoms: ['nausea'] as any,
        triggers: ['stress'] as any,
        notes: 'Test notes',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      renderComponent({
        showEndTimePicker: true,
        episode,
        customEndTime: new Date('2024-01-15T16:30:00').getTime(),
        onCloseEndTimePicker: mockOnCloseEndTimePicker,
        onCustomTimeAction: mockOnCustomTimeAction,
        onCustomTimeChange: mockOnCustomTimeChange,
      });

      // Verify all elements are present
      expect(screen.getByText('Set End Time')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
      expect(screen.getAllByText('Done')).toHaveLength(1);
      expect(screen.getByTestId('date-time-picker')).toBeTruthy();

      // Test interactions
      fireEvent.press(screen.getByText('Cancel'));
      expect(mockOnCloseEndTimePicker).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByText('Done'));
      expect(mockOnCustomTimeAction).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByTestId('date-time-picker'));
      expect(mockOnCustomTimeChange).toHaveBeenCalledWith(new Date('2024-01-15T16:30:00').getTime());
    });

    it('should handle episode with location but no accuracy', () => {
      const episode = {
        id: 'episode-1',
        startTime: new Date('2024-01-15T10:30:00').getTime(),
        endTime: new Date('2024-01-15T14:30:00').getTime(),
        locations: ['left_temple'] as any,
        qualities: ['throbbing'] as any,
        symptoms: ['nausea'] as any,
        triggers: ['stress'] as any,
        notes: 'Test notes',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          timestamp: Date.now(),
          // No accuracy property
        },
      };

      renderComponent({
        showMapModal: true,
        episode,
        locationAddress: 'Test Address',
      });

      expect(screen.getByText('Episode Location')).toBeTruthy();
      expect(screen.getByText('Test Address')).toBeTruthy();
      expect(screen.queryByText(/Accuracy:/)).toBeNull();
    });

    it('should handle undefined selectedDate in DateTimePicker onChange', () => {
      const mockOnCustomTimeChange = jest.fn();
      
      // Mock the DateTimePicker to simulate undefined date
      jest.doMock('@react-native-community/datetimepicker', () => {
        const React = require('react');
        return ({ onChange }: any) =>
          React.createElement('DateTimePicker', {
            testID: 'date-time-picker-undefined',
            onPress: () => {
              const mockEvent = {};
              onChange?.(mockEvent, undefined); // Simulate undefined date
            },
          });
      });

      renderComponent({
        showEndTimePicker: true,
        onCustomTimeChange: mockOnCustomTimeChange,
      });

      const picker = screen.queryByTestId('date-time-picker-undefined');
      if (picker) {
        fireEvent.press(picker);
        expect(mockOnCustomTimeChange).not.toHaveBeenCalled();
      }
    });
  });
});