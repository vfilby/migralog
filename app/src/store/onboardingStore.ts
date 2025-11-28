import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const ONBOARDING_COMPLETE_KEY = '@onboarding_complete';

interface OnboardingState {
  isOnboardingComplete: boolean;
  isLoading: boolean;
  checkOnboardingStatus: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  isOnboardingComplete: false,
  isLoading: true,

  /**
   * Check if onboarding has been completed
   * Called on app initialization
   */
  checkOnboardingStatus: async () => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      const isComplete = value === 'true';
      
      logger.log('[Onboarding] Status checked:', { isComplete });
      
      set({ 
        isOnboardingComplete: isComplete,
        isLoading: false
      });
    } catch (error) {
      logger.error('[Onboarding] Error checking status:', error);
      // On error, assume not complete and show onboarding
      set({ 
        isOnboardingComplete: false,
        isLoading: false
      });
    }
  },

  /**
   * Mark onboarding as complete
   * Called after user completes the welcome flow
   */
  completeOnboarding: async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      logger.log('[Onboarding] Marked as complete');
      
      set({ isOnboardingComplete: true });
    } catch (error) {
      logger.error('[Onboarding] Error marking as complete:', error);
      throw error;
    }
  },

  /**
   * Skip onboarding (for E2E tests)
   * This sets the flag without going through the UI flow
   */
  skipOnboarding: async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      logger.log('[Onboarding] Skipped via deep link (E2E test mode)');
      
      set({ 
        isOnboardingComplete: true,
        isLoading: false
      });
    } catch (error) {
      logger.error('[Onboarding] Error skipping:', error);
      throw error;
    }
  },
}));
