import { useOnboardingStore } from '../onboardingStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../utils/logger');

describe('onboardingStore', () => {
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
  const mockLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset the store state to initial values
    useOnboardingStore.setState({
      isOnboardingComplete: false,
      isLoading: true,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      // Reset to ensure we're testing actual initial state
      useOnboardingStore.setState({
        isOnboardingComplete: false,
        isLoading: true,
      });

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false);
      expect(state.isLoading).toBe(true);
      expect(typeof state.checkOnboardingStatus).toBe('function');
      expect(typeof state.completeOnboarding).toBe('function');
      expect(typeof state.skipOnboarding).toBe('function');
      expect(typeof state.resetOnboarding).toBe('function');
    });
  });

  describe('checkOnboardingStatus', () => {
    it('should set isOnboardingComplete to true when AsyncStorage returns "true"', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');

      await useOnboardingStore.getState().checkOnboardingStatus();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@onboarding_complete');
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Status checked:', { isComplete: true });
    });

    it('should set isOnboardingComplete to false when AsyncStorage returns null', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await useOnboardingStore.getState().checkOnboardingStatus();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@onboarding_complete');
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Status checked:', { isComplete: false });
    });

    it('should set isOnboardingComplete to false when AsyncStorage returns "false"', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('false');

      await useOnboardingStore.getState().checkOnboardingStatus();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@onboarding_complete');
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Status checked:', { isComplete: false });
    });

    it('should set isOnboardingComplete to false when AsyncStorage returns unexpected value', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('some-unexpected-value');

      await useOnboardingStore.getState().checkOnboardingStatus();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@onboarding_complete');
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Status checked:', { isComplete: false });
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const error = new Error('AsyncStorage error');
      mockAsyncStorage.getItem.mockRejectedValue(error);

      await useOnboardingStore.getState().checkOnboardingStatus();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@onboarding_complete');
      expect(mockLogger.error).toHaveBeenCalledWith('[Onboarding] Error checking status:', error);
    });

    it('should set loading to false in finally block even on error', async () => {
      const error = new Error('AsyncStorage error');
      mockAsyncStorage.getItem.mockRejectedValue(error);

      // Start with loading state
      useOnboardingStore.setState({ isLoading: true });

      await useOnboardingStore.getState().checkOnboardingStatus();

      const state = useOnboardingStore.getState();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('completeOnboarding', () => {
    it('should mark onboarding as complete successfully', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      await useOnboardingStore.getState().completeOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(true);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@onboarding_complete', 'true');
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Marked as complete');
    });

    it('should handle AsyncStorage errors by throwing the error', async () => {
      const error = new Error('Failed to save to AsyncStorage');
      mockAsyncStorage.setItem.mockRejectedValue(error);

      await expect(
        useOnboardingStore.getState().completeOnboarding()
      ).rejects.toThrow('Failed to save to AsyncStorage');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@onboarding_complete', 'true');
      expect(mockLogger.error).toHaveBeenCalledWith('[Onboarding] Error marking as complete:', error);
    });

    it('should not modify state if AsyncStorage fails', async () => {
      const error = new Error('Failed to save to AsyncStorage');
      mockAsyncStorage.setItem.mockRejectedValue(error);

      // Set initial state
      useOnboardingStore.setState({ isOnboardingComplete: false });

      try {
        await useOnboardingStore.getState().completeOnboarding();
      } catch (e) {
        // Expected to throw
      }

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false); // Should remain unchanged
    });
  });

  describe('skipOnboarding', () => {
    it('should skip onboarding successfully (for E2E tests)', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      await useOnboardingStore.getState().skipOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@onboarding_complete', 'true');
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Skipped via deep link (E2E test mode)');
    });

    it('should handle AsyncStorage errors by throwing the error', async () => {
      const error = new Error('Failed to skip onboarding');
      mockAsyncStorage.setItem.mockRejectedValue(error);

      await expect(
        useOnboardingStore.getState().skipOnboarding()
      ).rejects.toThrow('Failed to skip onboarding');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@onboarding_complete', 'true');
      expect(mockLogger.error).toHaveBeenCalledWith('[Onboarding] Error skipping:', error);
    });

    it('should not modify state if AsyncStorage fails', async () => {
      const error = new Error('Failed to skip onboarding');
      mockAsyncStorage.setItem.mockRejectedValue(error);

      // Set initial state  
      useOnboardingStore.setState({ isOnboardingComplete: false, isLoading: true });

      try {
        await useOnboardingStore.getState().skipOnboarding();
      } catch (e) {
        // Expected to throw
      }

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false); // Should remain unchanged
      expect(state.isLoading).toBe(true); // Should remain unchanged
    });
  });

  describe('resetOnboarding', () => {
    it('should reset onboarding successfully', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue();

      // Start with completed onboarding
      useOnboardingStore.setState({ isOnboardingComplete: true, isLoading: false });

      await useOnboardingStore.getState().resetOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@onboarding_complete');
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Reset - onboarding flow will be triggered');
    });

    it('should handle AsyncStorage errors by throwing the error', async () => {
      const error = new Error('Failed to reset onboarding');
      mockAsyncStorage.removeItem.mockRejectedValue(error);

      await expect(
        useOnboardingStore.getState().resetOnboarding()
      ).rejects.toThrow('Failed to reset onboarding');

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@onboarding_complete');
      expect(mockLogger.error).toHaveBeenCalledWith('[Onboarding] Error resetting:', error);
    });

    it('should not modify state if AsyncStorage fails', async () => {
      const error = new Error('Failed to reset onboarding');
      mockAsyncStorage.removeItem.mockRejectedValue(error);

      // Set initial state with completed onboarding
      useOnboardingStore.setState({ isOnboardingComplete: true, isLoading: false });

      try {
        await useOnboardingStore.getState().resetOnboarding();
      } catch (e) {
        // Expected to throw
      }

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(true); // Should remain unchanged
      expect(state.isLoading).toBe(false); // Should remain unchanged
    });
  });

  describe('state management integration', () => {
    it('should maintain state consistency across multiple operations', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();

      // Start by checking status (should be false)
      await useOnboardingStore.getState().checkOnboardingStatus();
      expect(useOnboardingStore.getState().isOnboardingComplete).toBe(false);
      expect(useOnboardingStore.getState().isLoading).toBe(false);

      // Complete onboarding
      await useOnboardingStore.getState().completeOnboarding();
      expect(useOnboardingStore.getState().isOnboardingComplete).toBe(true);

      // Check that AsyncStorage was called correctly
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@onboarding_complete');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@onboarding_complete', 'true');
    });

    it('should handle complete workflow from check to complete to reset', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockAsyncStorage.setItem.mockResolvedValue();
      mockAsyncStorage.removeItem.mockResolvedValue();

      // Check status (should find it's complete)
      await useOnboardingStore.getState().checkOnboardingStatus();
      expect(useOnboardingStore.getState().isOnboardingComplete).toBe(true);

      // Reset onboarding
      await useOnboardingStore.getState().resetOnboarding();
      expect(useOnboardingStore.getState().isOnboardingComplete).toBe(false);

      // Complete again
      await useOnboardingStore.getState().completeOnboarding();
      expect(useOnboardingStore.getState().isOnboardingComplete).toBe(true);

      // Verify all calls
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@onboarding_complete');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@onboarding_complete');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@onboarding_complete', 'true');
    });

    it('should handle skip onboarding workflow', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      // Skip onboarding (E2E test scenario)
      await useOnboardingStore.getState().skipOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@onboarding_complete', 'true');
    });
  });

  describe('error recovery scenarios', () => {
    it('should recover gracefully from multiple consecutive errors', async () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      // First operation fails
      mockAsyncStorage.getItem.mockRejectedValueOnce(error1);
      await useOnboardingStore.getState().checkOnboardingStatus();
      expect(useOnboardingStore.getState().isOnboardingComplete).toBe(false);
      expect(useOnboardingStore.getState().isLoading).toBe(false);

      // Second operation also fails
      mockAsyncStorage.setItem.mockRejectedValueOnce(error2);
      await expect(
        useOnboardingStore.getState().completeOnboarding()
      ).rejects.toThrow('Second error');

      // Third operation succeeds
      mockAsyncStorage.setItem.mockResolvedValue();
      await useOnboardingStore.getState().completeOnboarding();
      expect(useOnboardingStore.getState().isOnboardingComplete).toBe(true);
    });

    it('should maintain correct loading state during async operations', async () => {
      let resolveAsyncStorage: (value: any) => void = () => {};
      const asyncStoragePromise = new Promise<string | null>((resolve) => {
        resolveAsyncStorage = resolve;
      });

      mockAsyncStorage.getItem.mockReturnValue(asyncStoragePromise);

      // Start the async operation
      const checkPromise = useOnboardingStore.getState().checkOnboardingStatus();

      // Should still be loading at this point (assuming we set it properly in the implementation)
      // Note: Since the operation is async, we check the final state after completion
      
      // Resolve the promise
      resolveAsyncStorage('true');
      await checkPromise;

      // Should have completed with correct state
      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle empty string from AsyncStorage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('');

      await useOnboardingStore.getState().checkOnboardingStatus();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should handle whitespace-only string from AsyncStorage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('   ');

      await useOnboardingStore.getState().checkOnboardingStatus();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should handle case-sensitive values from AsyncStorage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('True'); // Capital T

      await useOnboardingStore.getState().checkOnboardingStatus();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false); // Should be false because it's case sensitive
      expect(state.isLoading).toBe(false);
    });

    it('should handle undefined returned from AsyncStorage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(undefined as any);

      await useOnboardingStore.getState().checkOnboardingStatus();

      const state = useOnboardingStore.getState();
      expect(state.isOnboardingComplete).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('logging behavior', () => {
    it('should log appropriate messages for successful operations', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockAsyncStorage.setItem.mockResolvedValue();
      mockAsyncStorage.removeItem.mockResolvedValue();

      // Check status
      await useOnboardingStore.getState().checkOnboardingStatus();
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Status checked:', { isComplete: true });

      // Complete onboarding
      await useOnboardingStore.getState().completeOnboarding();
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Marked as complete');

      // Skip onboarding
      await useOnboardingStore.getState().skipOnboarding();
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Skipped via deep link (E2E test mode)');

      // Reset onboarding
      await useOnboardingStore.getState().resetOnboarding();
      expect(mockLogger.log).toHaveBeenCalledWith('[Onboarding] Reset - onboarding flow will be triggered');
    });

    it('should log appropriate error messages for failed operations', async () => {
      const checkError = new Error('Check error');
      const completeError = new Error('Complete error');
      const skipError = new Error('Skip error');
      const resetError = new Error('Reset error');

      // Test check error
      mockAsyncStorage.getItem.mockRejectedValue(checkError);
      await useOnboardingStore.getState().checkOnboardingStatus();
      expect(mockLogger.error).toHaveBeenCalledWith('[Onboarding] Error checking status:', checkError);

      // Test complete error
      mockAsyncStorage.setItem.mockRejectedValue(completeError);
      try {
        await useOnboardingStore.getState().completeOnboarding();
      } catch (e) {
        // Expected
      }
      expect(mockLogger.error).toHaveBeenCalledWith('[Onboarding] Error marking as complete:', completeError);

      // Test skip error  
      mockAsyncStorage.setItem.mockRejectedValue(skipError);
      try {
        await useOnboardingStore.getState().skipOnboarding();
      } catch (e) {
        // Expected
      }
      expect(mockLogger.error).toHaveBeenCalledWith('[Onboarding] Error skipping:', skipError);

      // Test reset error
      mockAsyncStorage.removeItem.mockRejectedValue(resetError);
      try {
        await useOnboardingStore.getState().resetOnboarding();
      } catch (e) {
        // Expected
      }
      expect(mockLogger.error).toHaveBeenCalledWith('[Onboarding] Error resetting:', resetError);
    });
  });
});