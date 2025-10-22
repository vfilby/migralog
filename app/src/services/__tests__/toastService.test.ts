import { toastService } from '../toastService';
import Toast from 'react-native-toast-message';

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
  hide: jest.fn(),
}));

describe('toastService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('error()', () => {
    it('shows error toast with default options', () => {
      toastService.error('Something went wrong');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Error',
        text2: 'Something went wrong',
        visibilityTime: 4000,
        position: 'top',
        topOffset: 60,
      });
    });

    it('shows error toast with custom title', () => {
      toastService.error('Database error occurred', { title: 'Database Error' });

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Database Error',
        text2: 'Database error occurred',
        visibilityTime: 4000,
        position: 'top',
        topOffset: 60,
      });
    });

    it('shows error toast with custom duration', () => {
      toastService.error('Network timeout', { duration: 6000 });

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Error',
        text2: 'Network timeout',
        visibilityTime: 6000,
        position: 'top',
        topOffset: 60,
      });
    });

    it('shows error toast with both custom title and duration', () => {
      toastService.error('Failed to save', { title: 'Save Failed', duration: 5000 });

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Failed to save',
        visibilityTime: 5000,
        position: 'top',
        topOffset: 60,
      });
    });

    it('handles empty message string', () => {
      toastService.error('');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Error',
        text2: '',
        visibilityTime: 4000,
        position: 'top',
        topOffset: 60,
      });
    });
  });

  describe('success()', () => {
    it('shows success toast with default options', () => {
      toastService.success('Operation completed');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'success',
        text1: 'Success',
        text2: 'Operation completed',
        visibilityTime: 3000,
        position: 'top',
        topOffset: 60,
      });
    });

    it('shows success toast with custom title', () => {
      toastService.success('Medication logged successfully', { title: 'Logged' });

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'success',
        text1: 'Logged',
        text2: 'Medication logged successfully',
        visibilityTime: 3000,
        position: 'top',
        topOffset: 60,
      });
    });

    it('shows success toast with custom duration', () => {
      toastService.success('Backup created', { duration: 2000 });

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'success',
        text1: 'Success',
        text2: 'Backup created',
        visibilityTime: 2000,
        position: 'top',
        topOffset: 60,
      });
    });

    it('shows success toast with both custom title and duration', () => {
      toastService.success('Changes saved', { title: 'Saved', duration: 2500 });

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'success',
        text1: 'Saved',
        text2: 'Changes saved',
        visibilityTime: 2500,
        position: 'top',
        topOffset: 60,
      });
    });
  });

  describe('info()', () => {
    it('shows info toast with default options', () => {
      toastService.info('Database synced');

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'info',
        text1: 'Info',
        text2: 'Database synced',
        visibilityTime: 3000,
        position: 'top',
        topOffset: 60,
      });
    });

    it('shows info toast with custom title', () => {
      toastService.info('New version available', { title: 'Update' });

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'info',
        text1: 'Update',
        text2: 'New version available',
        visibilityTime: 3000,
        position: 'top',
        topOffset: 60,
      });
    });

    it('shows info toast with custom duration', () => {
      toastService.info('Loading data', { duration: 5000 });

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'info',
        text1: 'Info',
        text2: 'Loading data',
        visibilityTime: 5000,
        position: 'top',
        topOffset: 60,
      });
    });

    it('shows info toast with both custom title and duration', () => {
      toastService.info('Checking for updates', { title: 'Please Wait', duration: 4000 });

      expect(Toast.show).toHaveBeenCalledWith({
        type: 'info',
        text1: 'Please Wait',
        text2: 'Checking for updates',
        visibilityTime: 4000,
        position: 'top',
        topOffset: 60,
      });
    });
  });

  describe('hide()', () => {
    it('hides any visible toast', () => {
      toastService.hide();

      expect(Toast.hide).toHaveBeenCalledTimes(1);
    });

    it('can be called multiple times', () => {
      toastService.hide();
      toastService.hide();
      toastService.hide();

      expect(Toast.hide).toHaveBeenCalledTimes(3);
    });

    it('can be called without showing a toast first', () => {
      // Should not throw
      expect(() => toastService.hide()).not.toThrow();
      expect(Toast.hide).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sequential calls', () => {
    it('handles multiple toasts in sequence', () => {
      toastService.error('Error 1');
      toastService.success('Success 1');
      toastService.info('Info 1');

      expect(Toast.show).toHaveBeenCalledTimes(3);
      expect(Toast.show).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'error' }));
      expect(Toast.show).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'success' }));
      expect(Toast.show).toHaveBeenNthCalledWith(3, expect.objectContaining({ type: 'info' }));
    });

    it('handles show and hide in sequence', () => {
      toastService.success('Operation completed');
      toastService.hide();
      toastService.error('New error occurred');

      expect(Toast.show).toHaveBeenCalledTimes(2);
      expect(Toast.hide).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles very long messages', () => {
      const longMessage = 'This is a very long message that should still work correctly. '.repeat(10);

      toastService.error(longMessage);

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          text2: longMessage,
        })
      );
    });

    it('handles special characters in message', () => {
      const specialMessage = 'Error: "Something" failed @ 10:30 <PM> & more!';

      toastService.error(specialMessage);

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          text2: specialMessage,
        })
      );
    });

    it('handles very short duration', () => {
      toastService.success('Quick!', { duration: 1 });

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          visibilityTime: 1,
        })
      );
    });

    it('handles very long duration', () => {
      toastService.info('Very slow message', { duration: 999999 });

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          visibilityTime: 999999,
        })
      );
    });

    it('handles zero duration (uses default)', () => {
      toastService.error('Instant message', { duration: 0 });

      // Note: duration: 0 is falsy, so default 4000 is used
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          visibilityTime: 4000,
        })
      );
    });
  });
});
