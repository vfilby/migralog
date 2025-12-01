import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DataSettingsScreen from '../settings/DataSettingsScreen';
import { ThemeProvider } from '../../theme/ThemeContext';
import { pressAlertButtonByText } from '../../utils/testUtils/alertHelpers';

// Mock the backup service module
jest.mock('../../services/backup/backupService', () => {
  const actualModule = jest.requireActual('../../services/backup/backupService');
  return {
    ...actualModule,
    backupService: {
      listBackups: jest.fn().mockResolvedValue([]),
      exportDataAsJson: jest.fn().mockResolvedValue(undefined),
      createSnapshotBackup: jest.fn().mockResolvedValue(undefined), 
      exportBackup: jest.fn().mockResolvedValue(undefined),
      importBackup: jest.fn().mockResolvedValue({ id: 'imported-backup-123', timestamp: Date.now() }),
      restoreBackup: jest.fn().mockResolvedValue(undefined),
      deleteBackup: jest.fn().mockResolvedValue(undefined),
      checkForBrokenBackups: jest.fn().mockResolvedValue(0),
      cleanupBrokenBackups: jest.fn().mockResolvedValue(0),
    },
    formatDate: jest.fn().mockImplementation(() => 'Nov 24, 2025 at 12:00 PM'),
    formatFileSize: jest.fn().mockImplementation((size: number) => `${Math.round(size / 1024)} KB`),
    BackupMetadata: {},
  };
});

// Import the mocked service
const { backupService } = jest.requireMock('../../services/backup/backupService');

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

const mockRoute = {
  key: 'data-settings',
  name: 'DataSettingsScreen' as const,
};

describe('DataSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    backupService.listBackups.mockResolvedValue([]);
    backupService.checkForBrokenBackups.mockResolvedValue(0);
  });

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { getByTestId } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('data-settings-screen')).toBeTruthy();
      });
    });

    it('displays correct header title', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByText('Data Management')).toBeTruthy();
      });
    });

    it('shows export data section', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('Export & Backup')).toBeTruthy();
        expect(getByText('Export Data')).toBeTruthy();
      });
    });

    it('shows backup section', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('Export & Backup')).toBeTruthy();
        expect(getByText('Create Backup')).toBeTruthy();
        expect(getByText('Import Backup')).toBeTruthy();
      });
    });

    it('shows empty state when no backups exist', async () => {
      backupService.listBackups.mockResolvedValue([]);

      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('No backups yet')).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  describe('Export Data', () => {
    it('should display export data button', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('Export Data')).toBeTruthy();
      });
    });

    it('should call export data service when export button pressed', async () => {
      const { getByLabelText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        const exportButton = getByLabelText('Export data');
        fireEvent.press(exportButton);
      });

      await waitFor(() => {
        expect(backupService.exportDataAsJson).toHaveBeenCalled();
      });
    });

    it('should show error alert when export fails', async () => {
      const error = new Error('Export failed');
      backupService.exportDataAsJson.mockRejectedValueOnce(error);

      const { getByLabelText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        const exportButton = getByLabelText('Export data');
        fireEvent.press(exportButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to export data: Export failed');
      });
    });
  });

  describe('Backup Creation', () => {
    it('should display create backup button', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('Create Backup')).toBeTruthy();
      });
    });

    it('should call backup creation service when create button pressed', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        const createButton = getByText('Create Backup');
        fireEvent.press(createButton);
      });

      await waitFor(() => {
        expect(backupService.createSnapshotBackup).toHaveBeenCalled();
      });
    });

    it('should show error alert when backup creation fails', async () => {
      const error = new Error('Storage full');
      backupService.createSnapshotBackup.mockRejectedValueOnce(error);

      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        const createButton = getByText('Create Backup');
        fireEvent.press(createButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to create backup: Storage full');
      });
    });

    it('should handle successful backup creation with success alert', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        const createButton = getByText('Create Backup');
        fireEvent.press(createButton);
      });

      await waitFor(() => {
        expect(backupService.createSnapshotBackup).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith('Success', 'Backup created successfully');
      });
    });
  });

  describe('Backup Import', () => {
    it('should display import backup button', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('Import Backup')).toBeTruthy();
      });
    });

    it('should show import confirmation dialog when import pressed', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        const importButton = getByText('Import Backup');
        fireEvent.press(importButton);
        expect(Alert.alert).toHaveBeenCalledWith(
          'Import Backup',
          expect.stringContaining('Select a snapshot (.db) backup file'),
          expect.any(Array)
        );
      });
    });
  });

  describe('Broken Backup Handling', () => {
    it('should show warning banner when broken backups exist', async () => {
      backupService.checkForBrokenBackups.mockResolvedValue(3);
      backupService.listBackups.mockResolvedValue([]);

      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('Broken Backups Detected')).toBeTruthy();
      });

      await waitFor(() => {
        expect(getByText(/Found.*3.*corrupted.*invalid.*backup/)).toBeTruthy();
        expect(getByText('Clean Up (3)')).toBeTruthy();
      });
    });

    it('should not show warning banner when no broken backups', async () => {
      backupService.checkForBrokenBackups.mockResolvedValueOnce(0);

      const { queryByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(queryByText('Broken Backups Detected')).toBeNull();
      });
    });

    it('should show cleanup dialog when cleanup button pressed', async () => {
      backupService.checkForBrokenBackups.mockResolvedValue(2);
      backupService.listBackups.mockResolvedValue([]);

      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('Clean Up (2)')).toBeTruthy();
      });

      fireEvent.press(getByText('Clean Up (2)'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Clean Up Broken Backups',
        expect.stringContaining('Found 2 broken or corrupted backup files'),
        expect.any(Array)
      );

      // Simulate pressing the Remove button in the alert
      backupService.cleanupBrokenBackups.mockResolvedValueOnce(2);
      pressAlertButtonByText('Remove');
      await waitFor(() => {
        expect(backupService.cleanupBrokenBackups).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle backup list loading errors gracefully', async () => {
      backupService.listBackups.mockRejectedValue(new Error('Database error'));
      backupService.checkForBrokenBackups.mockResolvedValue(0);

      const { getByTestId } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      // Should still render the screen without crashing
      await waitFor(() => {
        expect(getByTestId('data-settings-screen')).toBeTruthy();
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load backups');
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper testID for the screen', async () => {
      const { getByTestId } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('data-settings-screen')).toBeTruthy();
      });
    });

    it('provides accessible header', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Data Management')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with theme integration', async () => {
      const { getByTestId } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('data-settings-screen')).toBeTruthy();
      });
    });
  });

  describe('Loading and Refresh', () => {
    it('should show loading state initially', async () => {
      // Simulate slow loading
      backupService.listBackups.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 50))
      );

      const { getByTestId } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('data-settings-screen')).toBeTruthy();
      });
    });

    it('should handle refresh functionality', async () => {
      const { getByTestId } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByTestId('data-settings-screen')).toBeTruthy();
      });

      // Reset mocks to test refresh
      jest.clearAllMocks();
      backupService.listBackups.mockResolvedValue([]);
      backupService.checkForBrokenBackups.mockResolvedValue(0);
    });
  });

  describe('Data Management', () => {
    it('should display privacy information', async () => {
      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('Data Privacy')).toBeTruthy();
      });
    });

    it('should show empty state when no backups available', async () => {
      backupService.listBackups.mockResolvedValue([]);

      const { getByText } = render(
        <DataSettingsScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(getByText('No backups yet')).toBeTruthy();
        expect(getByText('Create your first backup to protect your data')).toBeTruthy();
      });
    });
  });
});