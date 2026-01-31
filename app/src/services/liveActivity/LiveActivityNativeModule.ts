import { NativeModules, Platform } from 'react-native';

/**
 * Native Module Interface for Live Activities
 *
 * This module must be implemented in native iOS code (Swift).
 * See docs/LIVE_ACTIVITIES_SETUP.md for implementation instructions.
 */

export interface LiveActivityNativeModule {
  /**
   * Check if Live Activities are supported and enabled
   */
  areActivitiesSupported(): Promise<boolean>;

  /**
   * Start a new Live Activity
   * @param activityType - Type identifier for the activity
   * @param attributes - Static attributes (don't change)
   * @param contentState - Dynamic content state (can be updated)
   * @returns Activity ID
   */
  startActivity(
    activityType: string,
    attributes: Record<string, unknown>,
    contentState: Record<string, unknown>
  ): Promise<string>;

  /**
   * Update an existing Live Activity
   * @param activityId - ID of the activity to update
   * @param contentState - New content state
   */
  updateActivity(
    activityId: string,
    contentState: Record<string, unknown>
  ): Promise<void>;

  /**
   * End a Live Activity
   * @param activityId - ID of the activity to end
   */
  endActivity(activityId: string): Promise<void>;

  /**
   * Get all active Live Activities
   * @returns Array of active activities with their IDs and states
   */
  getAllActivities(): Promise<Array<{
    activityId: string;
    attributes: Record<string, unknown>;
    contentState: Record<string, unknown>;
  }>>;
}

/**
 * Stub implementation for when native module is not available
 */
const stubModule: LiveActivityNativeModule = {
  async areActivitiesSupported(): Promise<boolean> {
    return false;
  },
  async startActivity(): Promise<string> {
    throw new Error('Live Activities native module not implemented');
  },
  async updateActivity(): Promise<void> {
    throw new Error('Live Activities native module not implemented');
  },
  async endActivity(): Promise<void> {
    throw new Error('Live Activities native module not implemented');
  },
  async getAllActivities(): Promise<Array<{
    activityId: string;
    attributes: Record<string, unknown>;
    contentState: Record<string, unknown>;
  }>> {
    return [];
  },
};

/**
 * Get the native module or stub if not available
 */
export const LiveActivityModule: LiveActivityNativeModule =
  Platform.OS === 'ios' && NativeModules.LiveActivityModule
    ? (NativeModules.LiveActivityModule as LiveActivityNativeModule)
    : stubModule;
