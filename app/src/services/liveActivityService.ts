import { Platform } from 'react-native';
import type { Episode } from '../models/types';

// Lazy load the native module to avoid crashes when not available
let LiveActivityModule: typeof import('expo-live-activity') | undefined;
let moduleLoadAttempted = false;
let currentActivityId: string | undefined;

function getLiveActivityModule() {
  if (!moduleLoadAttempted && Platform.OS === 'ios') {
    moduleLoadAttempted = true;
    try {
      LiveActivityModule = require('expo-live-activity');
    } catch (e) {
      // Module not available - silently continue
    }
  }
  return LiveActivityModule;
}

/**
 * Check if Live Activities are available on this device
 * Requires iOS 16.1+ and a development build
 */
export function isLiveActivityAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const module = getLiveActivityModule();
    return module !== undefined;
  } catch {
    return false;
  }
}

/**
 * Format elapsed time as HH:MM or MM:SS
 */
function formatElapsedTime(startTime: number): string {
  const now = Date.now();
  const elapsed = Math.floor((now - startTime) / 1000);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get intensity color for display
 */
function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return '#4CAF50'; // Green - mild
  if (intensity <= 6) return '#FFA726'; // Orange - moderate
  return '#EF5350'; // Red - severe
}

/**
 * Start a Live Activity for a migraine episode
 * HIPAA Compliant: Only displays generic episode info, no PHI
 */
export function startEpisodeLiveActivity(episode: Episode, intensity: number): void {
  if (!isLiveActivityAvailable()) {
    return;
  }

  const module = getLiveActivityModule();
  if (!module) {
    return;
  }

  try {
    // End any existing activity first
    if (currentActivityId) {
      endEpisodeLiveActivity();
    }

    const elapsed = formatElapsedTime(episode.startTime);
    const intensityColor = getIntensityColor(intensity);

    const contentState = {
      title: 'Migraine Episode',
      subtitle: `${elapsed} • Intensity: ${intensity}/10`,
      progressBar: { progress: intensity / 10 },
    };

    const presentation = {
      backgroundColor: '#1a1a1a',
      titleColor: '#ffffff',
      subtitleColor: '#a0a0a0',
      progressViewTint: intensityColor,
    };

    const activityId = module.startActivity(contentState, presentation);

    if (activityId) {
      currentActivityId = activityId;
    }
  } catch (error) {
    // Silently fail - Live Activities are optional
  }
}

/**
 * Update the Live Activity with current episode state
 */
export function updateEpisodeLiveActivity(episode: Episode, intensity: number): void {
  if (!isLiveActivityAvailable()) {
    return;
  }

  if (!currentActivityId) {
    return;
  }

  const module = getLiveActivityModule();
  if (!module) {
    return;
  }

  try {
    const elapsed = formatElapsedTime(episode.startTime);
    const intensityColor = getIntensityColor(intensity);

    const updatePayload = {
      title: 'Migraine Episode',
      subtitle: `${elapsed} • Intensity: ${intensity}/10`,
      progressBar: { progress: intensity / 10 },
    };

    module.updateActivity(currentActivityId, updatePayload);
  } catch (error) {
    // Silently fail - Live Activities are optional
  }
}

/**
 * End the Live Activity
 */
export function endEpisodeLiveActivity(message?: string): void {
  if (!isLiveActivityAvailable()) {
    return;
  }

  if (!currentActivityId) {
    return;
  }

  const module = getLiveActivityModule();
  if (!module) {
    return;
  }

  try {
    const endPayload = {
      title: message || 'Episode Ended',
      subtitle: 'Take care of yourself',
    };

    module.stopActivity(currentActivityId, endPayload);
    currentActivityId = undefined;
  } catch (error) {
    // Silently fail - Live Activities are optional
  }
}
