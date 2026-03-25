import { Alert } from 'react-native';
import { errorLogger } from '../../../services/errorLogger';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';

export function useErrorLogManagement(
  navigation: NativeStackNavigationProp<RootStackParamList, 'DeveloperToolsScreen'>,
  onLogsUpdated: () => Promise<void>
) {
  const viewErrorLogs = () => {
    navigation.navigate('ErrorLogs');
  };

  const viewPerformance = () => {
    navigation.navigate('Performance');
  };

  const clearAllLogs = async () => {
    Alert.alert(
      'Clear Error Logs',
      'Are you sure you want to clear all error logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await errorLogger.clearLogs();
            await onLogsUpdated();
            Alert.alert('Success', 'Error logs cleared');
          },
        },
      ]
    );
  };

  const testErrorLogging = async () => {
    await errorLogger.log(
      'general',
      'Test error log',
      new Error('This is a test error'),
      { timestamp: new Date().toISOString() }
    );
    await onLogsUpdated();
    Alert.alert('Success', 'Test error logged');
  };

  return {
    viewErrorLogs,
    viewPerformance,
    clearAllLogs,
    testErrorLogging,
  };
}
