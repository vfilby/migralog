import Toast from 'react-native-toast-message';

/**
 * Toast Service - Centralized toast notifications
 * Provides consistent, user-friendly error and success messages
 */
export const toastService = {
  /**
   * Show an error toast notification
   */
  error(message: string, options?: { title?: string; duration?: number }) {
    Toast.show({
      type: 'error',
      text1: options?.title || 'Error',
      text2: message,
      visibilityTime: options?.duration || 4000,
      position: 'top',
      topOffset: 60,
    });
  },

  /**
   * Show a success toast notification
   */
  success(message: string, options?: { title?: string; duration?: number }) {
    Toast.show({
      type: 'success',
      text1: options?.title || 'Success',
      text2: message,
      visibilityTime: options?.duration || 3000,
      position: 'top',
      topOffset: 60,
    });
  },

  /**
   * Show an info toast notification
   */
  info(message: string, options?: { title?: string; duration?: number }) {
    Toast.show({
      type: 'info',
      text1: options?.title || 'Info',
      text2: message,
      visibilityTime: options?.duration || 3000,
      position: 'top',
      topOffset: 60,
    });
  },

  /**
   * Hide any visible toast
   */
  hide() {
    Toast.hide();
  },
};
