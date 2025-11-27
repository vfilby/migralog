import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/ThemeContext';
import MedicationBadges from '../MedicationBadges.test-minimal';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('MedicationBadges', () => {
  it('can import component', () => {
    expect(MedicationBadges).toBeDefined();
  });

  describe('Type badges', () => {
    it('component renders without theme provider', () => {
      render(<MedicationBadges type="preventative" testID="badges" />);
      
      // Try to find the testID first
      const container = screen.queryByTestId('badges');
      expect(container).not.toBeNull();
    });

    it('component renders and has content', () => {
      try {
        const result = renderWithTheme(<MedicationBadges type="preventative" testID="badges" />);
        console.log('Render result:', !!result);
        screen.debug();
        
        // Try to find the testID first
        const container = screen.queryByTestId('badges');
        console.log('Container found:', !!container);
        expect(container).not.toBeNull();
      } catch (error) {
        console.error('Test error:', error);
        throw error;
      }
    });

    it('component renders type badge content', () => {
      renderWithTheme(<MedicationBadges type="preventative" testID="badges" />);
      
      // Try to find the type badge specifically
      const typeBadge = screen.queryByTestId('badges-type-badge');
      expect(typeBadge).not.toBeNull();
    });

    it('renders preventative badge correctly', () => {
      render(<MedicationBadges type="preventative" testID="badges" />);
      
      expect(screen.getByText('Preventative')).toBeTruthy();
      expect(screen.getByTestId('badges-type-badge')).toBeTruthy();
    });

    it('renders rescue badge correctly', () => {
      renderWithTheme(<MedicationBadges type="rescue" testID="badges" />);
      
      expect(screen.getByText('Rescue')).toBeTruthy();
      expect(screen.getByTestId('badges-type-badge')).toBeTruthy();
    });

    it('renders other badge correctly', () => {
      renderWithTheme(<MedicationBadges type="other" testID="badges" />);
      
      expect(screen.getByText('Other')).toBeTruthy();
      expect(screen.getByTestId('badges-type-badge')).toBeTruthy();
    });
  });
});