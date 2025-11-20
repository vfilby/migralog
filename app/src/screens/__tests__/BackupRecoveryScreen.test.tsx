import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import BackupRecoveryScreen from '../BackupRecoveryScreen';
import { ThemeProvider } from '../../theme/ThemeContext';

const mockBackupService = {
  listBackups: jest.fn(),
  createBackup: jest.fn(),
  exportBackup: jest.fn(),
  importBackup: jest.fn(),
  deleteBackup: jest.fn(),
  checkForBrokenBackups: jest.fn(),
  cleanupBrokenBackups: jest.fn(),
  formatDate: jest.fn((timestamp: number) => new Date(timestamp).toLocaleString()),
  formatFileSize: jest.fn((size: number) => `${Math.round(size / 1024)} KB`),
};

jest.mock('../../services/backupService', () => ({
  backupService: mockBackupService,
  BackupMetadata: {},
}));

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
  key: 'backup-recovery',
  name: 'BackupRecovery' as const,
};

describe('BackupRecoveryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBackupService.listBackups.mockResolvedValue([]);
    mockBackupService.checkForBrokenBackups.mockResolvedValue(0);
  });

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { getByTestId } = render(
        <BackupRecoveryScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('backup-recovery-screen')).toBeTruthy();
      });
    });

    it('displays correct header title', async () => {
      const { getByText } = render(
        <BackupRecoveryScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByText('Backup & Recovery')).toBeTruthy();
      });
    });

    it('shows empty state when no backups exist', async () => {
      mockBackupService.listBackups.mockResolvedValue([]);

      const { getByText } = render(
        <BackupRecoveryScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('No backups yet')).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  describe('Accessibility', () => {
    it('has proper testID for the screen', async () => {
      const { getByTestId } = render(
        <BackupRecoveryScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('backup-recovery-screen')).toBeTruthy();
      });
    });

    it('provides accessible header', async () => {
      const { getByText } = render(
        <BackupRecoveryScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      
      await waitFor(() => {
        expect(getByText('Backup & Recovery')).toBeTruthy();
      });
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with theme integration', async () => {
      const { getByTestId } = render(
        <BackupRecoveryScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );
      await waitFor(() => {
        expect(getByTestId('backup-recovery-screen')).toBeTruthy();
      });
    });
  });

  describe('Error Handling and Data Integrity', () => {
    it('should not display warning banner when no broken backups', async () => {
      mockBackupService.listBackups.mockResolvedValue([]);
      mockBackupService.checkForBrokenBackups.mockResolvedValue(0);

      const { queryByText } = render(
        <BackupRecoveryScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(queryByText('Broken Backups Detected')).toBeNull();
      });
    });

    it('should handle backup list loading errors gracefully', async () => {
      mockBackupService.listBackups.mockRejectedValue(new Error('Database error'));
      mockBackupService.checkForBrokenBackups.mockResolvedValue(0);

      const { getByTestId } = render(
        <BackupRecoveryScreen navigation={{ goBack: mockGoBack } as any} route={mockRoute} />,
        { wrapper: TestWrapper }
      );

      // Should still render the screen without crashing
      await waitFor(() => {
        expect(getByTestId('backup-recovery-screen')).toBeTruthy();
      });
    });
  });
});
