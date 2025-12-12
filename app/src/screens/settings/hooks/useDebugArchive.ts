import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { logger } from '../../../utils/logger';
import { debugArchiveService } from '../../../services/debug';

export interface UseDebugArchive {
  generateArchive: () => Promise<void>;
  isGenerating: boolean;
  error: string | null;
  progress: number; // 0-100
  progressMessage: string;
  clearError: () => void;
}

export function useDebugArchive(): UseDebugArchive {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const shareFile = useCallback(async (filePath: string) => {
    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      // Share the debug archive file
      logger.log('[useDebugArchive] Opening share dialog for:', filePath);
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/zip',
        dialogTitle: 'Share Debug Archive',
        UTI: 'public.zip-archive',
      });

      logger.log('[useDebugArchive] Debug archive shared successfully');
    } catch (error) {
      logger.error('[useDebugArchive] Failed to share debug archive:', error);
      throw new Error(`Failed to share debug archive: ${(error as Error).message}`);
    }
  }, []);

  const generateArchive = useCallback(async () => {
    if (isGenerating) {
      return; // Already generating
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setProgressMessage('Starting...');

    try {
      logger.log('[useDebugArchive] Starting debug archive generation...');

      // Generate the debug archive with progress callback
      const archivePath = await debugArchiveService.generateDebugArchive({
        includeFullDatabase: true,
        includeLogs: true,
        includeNotifications: true,
        logHistoryHours: 48,
        progressCallback: (message: string, progressValue: number) => {
          setProgressMessage(message);
          setProgress(progressValue);
        },
      });

      logger.log('[useDebugArchive] Debug archive generated at:', archivePath);

      // Update progress to show sharing
      setProgressMessage('Opening share dialog...');
      setProgress(100);

      // Share the generated file
      await shareFile(archivePath);

      // Clear progress after successful completion
      setProgressMessage('');
      setProgress(0);
      setError(null); // Auto-clear any previous errors on success

      Alert.alert(
        'Debug Archive Created',
        'Debug archive has been generated and shared successfully. The archive contains logs, database state, and notification information for troubleshooting.'
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('[useDebugArchive] Failed to generate debug archive:', error);
      
      setError(errorMessage);
      setProgressMessage('');
      setProgress(0);

      Alert.alert(
        'Archive Generation Failed',
        `Failed to generate debug archive: ${errorMessage}`
      );
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, shareFile]);

  return {
    generateArchive,
    isGenerating,
    error,
    progress,
    progressMessage,
    clearError,
  };
}