import { logger } from '../../utils/logger';
import { Episode } from '../../models/types';
import { LiveActivityModule } from './LiveActivityNativeModule';

/**
 * Live Activity Service
 *
 * Manages iOS Live Activities for ongoing migraine episodes.
 * Displays episode information on Lock Screen and Dynamic Island (iPhone 14 Pro+).
 *
 * HIPAA Compliance:
 * - Only displays generic "Migraine Episode" text
 * - Shows duration and intensity level (0-10 scale)
 * - No PHI (symptoms, medications, triggers, location)
 * - All sensitive data remains in main app
 *
 * Requirements:
 * - iOS 16.1+
 * - Native module implementation (see docs/LIVE_ACTIVITIES_SETUP.md)
 * - Widget Extension configured in Xcode
 */

export interface LiveActivityAttributes {
  episodeId: string;
  startTime: number;
}

export interface LiveActivityContentState {
  currentIntensity: number;
  duration: number; // in milliseconds
  lastUpdated: number;
}

class LiveActivityServiceImpl {
  private activityId: string | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private supportChecked: boolean = false;
  private isSupported: boolean = false;

  /**
   * Check if Live Activities are supported on current device
   */
  private async checkSupport(): Promise<boolean> {
    if (this.supportChecked) {
      return this.isSupported;
    }

    try {
      // Check if device supports Live Activities (iOS 16.1+)
      const supported = await LiveActivityModule.areActivitiesSupported();
      this.isSupported = supported;
      this.supportChecked = true;

      if (supported) {
        logger.log('[LiveActivity] Supported and enabled');
      } else {
        logger.log('[LiveActivity] Not supported or disabled');
      }

      return supported;
    } catch (error) {
      logger.error('[LiveActivity] Failed to check support:', error);
      this.isSupported = false;
      this.supportChecked = true;
      return false;
    }
  }

  /**
   * Start a Live Activity for an episode
   *
   * @param episode - Episode to display
   * @param initialIntensity - Initial pain intensity (0-10)
   */
  async startActivity(episode: Episode, initialIntensity: number): Promise<void> {
    const supported = await this.checkSupport();
    if (!supported) {
      logger.log('[LiveActivity] Not starting: Not supported');
      return;
    }

    // Don't start if already active
    if (this.activityId) {
      logger.warn('[LiveActivity] Activity already active');
      return;
    }

    try {
      const attributes: LiveActivityAttributes = {
        episodeId: episode.id,
        startTime: episode.startTime,
      };

      const contentState: LiveActivityContentState = {
        currentIntensity: initialIntensity,
        duration: 0,
        lastUpdated: Date.now(),
      };

      // Start the Live Activity
      const activityId = await LiveActivityModule.startActivity(
        'MigraLogEpisode',
        attributes,
        contentState
      );

      this.activityId = activityId;
      logger.log('[LiveActivity] Started:', { activityId, episodeId: episode.id });

      // Start periodic updates for duration
      this.startPeriodicUpdates(episode.startTime);
    } catch (error) {
      logger.error('[LiveActivity] Failed to start activity:', error);
    }
  }

  /**
   * Update Live Activity with new intensity reading
   *
   * @param intensity - New pain intensity (0-10)
   */
  async updateIntensity(intensity: number): Promise<void> {
    if (!this.activityId) {
      return;
    }

    const supported = await this.checkSupport();
    if (!supported) {
      return;
    }

    try {
      // Get current activity state to preserve duration
      const activities = await LiveActivityModule.getAllActivities();
      const currentActivity = activities.find(a => a.activityId === this.activityId);

      if (!currentActivity) {
        logger.warn('[LiveActivity] Activity not found, resetting activityId');
        this.activityId = null;
        this.stopPeriodicUpdates();
        return;
      }

      const currentState = currentActivity.contentState as LiveActivityContentState;

      const updatedState: LiveActivityContentState = {
        ...currentState,
        currentIntensity: intensity,
        lastUpdated: Date.now(),
      };

      await LiveActivityModule.updateActivity(this.activityId, updatedState);

      logger.log('[LiveActivity] Updated intensity:', intensity);
    } catch (error) {
      logger.error('[LiveActivity] Failed to update intensity:', error);
    }
  }

  /**
   * End the Live Activity (episode completed)
   */
  async endActivity(): Promise<void> {
    if (!this.activityId) {
      return;
    }

    const supported = await this.checkSupport();
    if (!supported) {
      return;
    }

    try {
      await LiveActivityModule.endActivity(this.activityId);

      logger.log('[LiveActivity] Ended:', this.activityId);
      this.activityId = null;
      this.stopPeriodicUpdates();
    } catch (error) {
      logger.error('[LiveActivity] Failed to end activity:', error);
      // Reset state even if error occurred
      this.activityId = null;
      this.stopPeriodicUpdates();
    }
  }

  /**
   * Start periodic updates to keep duration fresh
   * Updates every minute to show current episode duration
   *
   * @param startTime - Episode start timestamp
   */
  private startPeriodicUpdates(startTime: number): void {
    // Clear any existing interval
    this.stopPeriodicUpdates();

    // Update every minute
    this.updateInterval = setInterval(async () => {
      if (!this.activityId) {
        this.stopPeriodicUpdates();
        return;
      }

      const supported = await this.checkSupport();
      if (!supported) {
        this.stopPeriodicUpdates();
        return;
      }

      try {
        const activities = await LiveActivityModule.getAllActivities();
        const currentActivity = activities.find(a => a.activityId === this.activityId);

        if (!currentActivity) {
          logger.warn('[LiveActivity] Activity not found during periodic update');
          this.stopPeriodicUpdates();
          this.activityId = null;
          return;
        }

        const currentState = currentActivity.contentState as LiveActivityContentState;
        const duration = Date.now() - startTime;

        const updatedState: LiveActivityContentState = {
          ...currentState,
          duration,
          lastUpdated: Date.now(),
        };

        await LiveActivityModule.updateActivity(this.activityId, updatedState);

        logger.log('[LiveActivity] Updated duration:', duration);
      } catch (error) {
        logger.error('[LiveActivity] Failed to update duration:', error);
      }
    }, 60000); // Every minute
  }

  /**
   * Stop periodic updates
   */
  private stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Get current activity status
   */
  isActive(): boolean {
    return this.activityId !== null;
  }

  /**
   * Clean up (called on app unmount)
   */
  cleanup(): void {
    this.stopPeriodicUpdates();
  }
}

// Export singleton instance
export const liveActivityService = new LiveActivityServiceImpl();
