import { Alert } from 'react-native';
import { logger } from '../../../utils/logger';

export function useDatabaseOperations() {
  const handleResetDatabase = async () => {
    Alert.alert(
      'Reset Database (Testing)',
      'This will:\n• Create an automatic backup\n• Clear ALL data from the database\n\nYou can restore from the backup in Backup & Recovery.\n\nThis action is for testing only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Dynamically import test helper (only available in __DEV__)
              if (__DEV__) {
                const { resetDatabaseForTesting } = await import('../../../utils/devTestHelpers');
                const result = await resetDatabaseForTesting({
                  createBackup: true,
                  loadFixtures: false,
                });
                Alert.alert('Database Reset', result.message);
              } else {
                Alert.alert('Error', 'Database reset is only available in development mode');
              }
            } catch (error) {
              logger.error('Failed to reset database:', error);
              Alert.alert('Error', `Failed to reset database: ${(error as Error).message}`);
            }
          },
        },
      ]
    );
  };

  const handleResetDatabaseWithFixtures = async () => {
    Alert.alert(
      'Reset with Test Data',
      'This will:\n• Create an automatic backup\n• Clear ALL data from the database\n• Load test medications and episodes\n\nTest data includes:\n• Preventative medication with daily schedule (8:00 AM)\n• Rescue medication\n• Sample episode from yesterday\n\nThis action is for testing only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset & Load',
          style: 'default',
          onPress: async () => {
            try {
              // Dynamically import test helper (only available in __DEV__)
              if (__DEV__) {
                const { resetDatabaseForTesting } = await import('../../../utils/devTestHelpers');
                await resetDatabaseForTesting({
                  createBackup: true,
                  loadFixtures: true,
                });
                Alert.alert('Success', 'Database reset with test data loaded!\n\nCheck Dashboard to see test medications.');
              } else {
                Alert.alert('Error', 'Database reset is only available in development mode');
              }
            } catch (error) {
              logger.error('Failed to reset database with fixtures:', error);
              Alert.alert('Error', `Failed to reset database: ${(error as Error).message}`);
            }
          },
        },
      ]
    );
  };

  return {
    handleResetDatabase,
    handleResetDatabaseWithFixtures,
  };
}
