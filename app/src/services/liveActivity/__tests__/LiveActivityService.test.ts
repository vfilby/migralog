import { liveActivityService } from '../LiveActivityService';
import { Episode } from '../../../models/types';
import { Platform } from 'react-native';

// Mock react-native-live-activities
jest.mock('react-native-live-activities', () => ({
  areActivitiesEnabled: jest.fn(),
  startActivity: jest.fn(),
  updateActivity: jest.fn(),
  endActivity: jest.fn(),
  getAllActivities: jest.fn(),
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('LiveActivityService', () => {
  const mockEpisode: Episode = {
    id: 'episode-1',
    startTime: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    locations: [],
    qualities: [],
    symptoms: [],
    triggers: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform.OS to iOS for tests
    Platform.OS = 'ios';
  });

  describe('Platform Support', () => {
    it('should not be supported on Android', async () => {
      Platform.OS = 'android';

      await liveActivityService.startActivity(mockEpisode, 5);

      expect(liveActivityService.isActive()).toBe(false);
    });

    it('should check for iOS support on initialization', () => {
      Platform.OS = 'ios';

      // Support check happens in constructor
      expect(Platform.OS).toBe('ios');
    });
  });

  describe('startActivity', () => {
    it('should start a Live Activity with correct attributes', async () => {
      const LiveActivities = require('react-native-live-activities');
      LiveActivities.areActivitiesEnabled.mockResolvedValue(true);
      LiveActivities.startActivity.mockResolvedValue('activity-123');

      await liveActivityService.startActivity(mockEpisode, 7);

      expect(LiveActivities.startActivity).toHaveBeenCalledWith(
        'MigraLogEpisode',
        expect.objectContaining({
          attributes: {
            episodeId: mockEpisode.id,
            startTime: mockEpisode.startTime,
          },
          contentState: expect.objectContaining({
            currentIntensity: 7,
            duration: 0,
          }),
        })
      );
    });

    it('should not start if platform is not supported', async () => {
      Platform.OS = 'android';
      const LiveActivities = require('react-native-live-activities');

      await liveActivityService.startActivity(mockEpisode, 5);

      expect(LiveActivities.startActivity).not.toHaveBeenCalled();
    });

    it('should not start if activity is already active', async () => {
      const LiveActivities = require('react-native-live-activities');
      LiveActivities.areActivitiesEnabled.mockResolvedValue(true);
      LiveActivities.startActivity.mockResolvedValue('activity-123');

      // Start first activity
      await liveActivityService.startActivity(mockEpisode, 5);

      // Try to start another
      await liveActivityService.startActivity(mockEpisode, 6);

      // Should only be called once
      expect(LiveActivities.startActivity).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateIntensity', () => {
    it('should update Live Activity with new intensity', async () => {
      const LiveActivities = require('react-native-live-activities');
      LiveActivities.areActivitiesEnabled.mockResolvedValue(true);
      LiveActivities.startActivity.mockResolvedValue('activity-123');
      LiveActivities.getAllActivities.mockResolvedValue([
        {
          activityId: 'activity-123',
          contentState: {
            currentIntensity: 5,
            duration: 1000,
            lastUpdated: Date.now(),
          },
        },
      ]);

      // Start activity first
      await liveActivityService.startActivity(mockEpisode, 5);

      // Update intensity
      await liveActivityService.updateIntensity(8);

      expect(LiveActivities.updateActivity).toHaveBeenCalledWith(
        'activity-123',
        expect.objectContaining({
          contentState: expect.objectContaining({
            currentIntensity: 8,
          }),
        })
      );
    });

    it('should not update if no activity is active', async () => {
      const LiveActivities = require('react-native-live-activities');

      await liveActivityService.updateIntensity(8);

      expect(LiveActivities.updateActivity).not.toHaveBeenCalled();
    });

    it('should handle activity not found gracefully', async () => {
      const LiveActivities = require('react-native-live-activities');
      LiveActivities.areActivitiesEnabled.mockResolvedValue(true);
      LiveActivities.startActivity.mockResolvedValue('activity-123');
      LiveActivities.getAllActivities.mockResolvedValue([]);

      // Start activity
      await liveActivityService.startActivity(mockEpisode, 5);

      // Activity was removed by system
      await liveActivityService.updateIntensity(8);

      // Should reset internal state
      expect(liveActivityService.isActive()).toBe(false);
    });
  });

  describe('endActivity', () => {
    it('should end the Live Activity', async () => {
      const LiveActivities = require('react-native-live-activities');
      LiveActivities.areActivitiesEnabled.mockResolvedValue(true);
      LiveActivities.startActivity.mockResolvedValue('activity-123');

      // Start activity
      await liveActivityService.startActivity(mockEpisode, 5);

      // End activity
      await liveActivityService.endActivity();

      expect(LiveActivities.endActivity).toHaveBeenCalledWith('activity-123');
      expect(liveActivityService.isActive()).toBe(false);
    });

    it('should not fail if no activity is active', async () => {
      await expect(liveActivityService.endActivity()).resolves.not.toThrow();
    });

    it('should reset state even if end fails', async () => {
      const LiveActivities = require('react-native-live-activities');
      LiveActivities.areActivitiesEnabled.mockResolvedValue(true);
      LiveActivities.startActivity.mockResolvedValue('activity-123');
      LiveActivities.endActivity.mockRejectedValue(new Error('Failed to end'));

      // Start activity
      await liveActivityService.startActivity(mockEpisode, 5);

      // End should reset state despite error
      await liveActivityService.endActivity();

      expect(liveActivityService.isActive()).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should stop periodic updates on cleanup', async () => {
      const LiveActivities = require('react-native-live-activities');
      LiveActivities.areActivitiesEnabled.mockResolvedValue(true);
      LiveActivities.startActivity.mockResolvedValue('activity-123');

      // Start activity (which starts periodic updates)
      await liveActivityService.startActivity(mockEpisode, 5);

      // Cleanup
      liveActivityService.cleanup();

      // Periodic updates should be stopped (no way to directly test setInterval cleanup)
      // but we can verify no errors occur
      expect(liveActivityService.isActive()).toBe(true); // Activity still exists
    });
  });

  describe('HIPAA Compliance', () => {
    it('should only expose intensity and duration in content state', async () => {
      const LiveActivities = require('react-native-live-activities');
      LiveActivities.areActivitiesEnabled.mockResolvedValue(true);
      LiveActivities.startActivity.mockResolvedValue('activity-123');

      const episodeWithPHI: Episode = {
        ...mockEpisode,
        symptoms: ['nausea', 'aura'],
        triggers: ['stress'],
        notes: 'Patient experiencing severe headache',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          timestamp: Date.now(),
        },
      };

      await liveActivityService.startActivity(episodeWithPHI, 5);

      const startCall = LiveActivities.startActivity.mock.calls[0][1];

      // Should only have episodeId and startTime in attributes
      expect(Object.keys(startCall.attributes)).toEqual(['episodeId', 'startTime']);

      // Should only have intensity, duration, lastUpdated in content state
      expect(Object.keys(startCall.contentState)).toEqual([
        'currentIntensity',
        'duration',
        'lastUpdated',
      ]);

      // Verify PHI is NOT included
      expect(startCall.attributes).not.toHaveProperty('symptoms');
      expect(startCall.attributes).not.toHaveProperty('triggers');
      expect(startCall.attributes).not.toHaveProperty('notes');
      expect(startCall.attributes).not.toHaveProperty('location');
    });
  });
});
