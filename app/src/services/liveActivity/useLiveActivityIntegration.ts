import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useEpisodeStore } from '../../store/episodeStore';
import { liveActivityService } from './LiveActivityService';
import { logger } from '../../utils/logger';

/**
 * Live Activity Integration Hook
 *
 * Integrates Live Activities with the episode store.
 * Automatically starts/updates/ends Live Activities based on episode state.
 *
 * Usage:
 * - Call this hook once at the app root level
 * - It will automatically manage Live Activities for current episode
 * - No manual intervention needed
 */
export function useLiveActivityIntegration() {
  const currentEpisode = useEpisodeStore((state) => state.currentEpisode);
  const intensityReadings = useEpisodeStore((state) => state.intensityReadings);
  const hasStartedActivity = useRef(false);
  const appState = useRef(AppState.currentState);
  const lastIntensityRef = useRef<number | null>(null);

  // Handle episode lifecycle
  useEffect(() => {
    if (!currentEpisode) {
      // Episode ended - end Live Activity
      if (hasStartedActivity.current) {
        logger.log('[LiveActivityIntegration] Episode ended, ending Live Activity');
        liveActivityService.endActivity();
        hasStartedActivity.current = false;
        lastIntensityRef.current = null;
      }
      return;
    }

    // Episode exists - start Live Activity if not started
    if (!hasStartedActivity.current) {
      const currentReadings = intensityReadings.filter(
        (r) => r.episodeId === currentEpisode.id
      );

      // Get most recent intensity or default to 5
      const latestIntensity =
        currentReadings.length > 0
          ? currentReadings[currentReadings.length - 1].intensity
          : 5;

      logger.log('[LiveActivityIntegration] Starting Live Activity for episode:', {
        episodeId: currentEpisode.id,
        initialIntensity: latestIntensity,
      });

      liveActivityService.startActivity(currentEpisode, latestIntensity);
      hasStartedActivity.current = true;
      lastIntensityRef.current = latestIntensity;
    }
  }, [currentEpisode, intensityReadings]);

  // Handle intensity updates
  useEffect(() => {
    if (!currentEpisode || !hasStartedActivity.current) {
      return;
    }

    const currentReadings = intensityReadings.filter(
      (r) => r.episodeId === currentEpisode.id
    );

    if (currentReadings.length === 0) {
      return;
    }

    // Get latest intensity reading
    const latestReading = currentReadings[currentReadings.length - 1];

    // Only update if intensity changed
    if (latestReading.intensity !== lastIntensityRef.current) {
      logger.log('[LiveActivityIntegration] Updating intensity:', {
        episodeId: currentEpisode.id,
        intensity: latestReading.intensity,
      });

      liveActivityService.updateIntensity(latestReading.intensity);
      lastIntensityRef.current = latestReading.intensity;
    }
  }, [intensityReadings, currentEpisode]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        // App coming to foreground
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          logger.log('[LiveActivityIntegration] App became active');

          // If we have a current episode but no active Live Activity, restart it
          if (currentEpisode && !liveActivityService.isActive()) {
            const currentReadings = intensityReadings.filter(
              (r) => r.episodeId === currentEpisode.id
            );
            const latestIntensity =
              currentReadings.length > 0
                ? currentReadings[currentReadings.length - 1].intensity
                : 5;

            logger.log('[LiveActivityIntegration] Restarting Live Activity after foreground');
            liveActivityService.startActivity(currentEpisode, latestIntensity);
            hasStartedActivity.current = true;
            lastIntensityRef.current = latestIntensity;
          }
        }

        appState.current = nextAppState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [currentEpisode, intensityReadings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      liveActivityService.cleanup();
    };
  }, []);
}
