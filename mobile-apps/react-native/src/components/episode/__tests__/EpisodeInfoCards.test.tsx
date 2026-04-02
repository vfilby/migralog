import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { EpisodeInfoCards } from '../EpisodeInfoCards';

// Mock the theme hook to return a fixed theme
jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      background: '#FFFFFF',
      backgroundSecondary: '#F5F5F5',
      card: '#FFFFFF',
      text: '#000000',
      textSecondary: '#666666',
      textTertiary: '#999999',
      border: '#E0E0E0',
      borderLight: '#F0F0F0',
      primary: '#007AFF',
      primaryText: '#FFFFFF',
      danger: '#FF3B30',
      dangerText: '#FFFFFF',
      shadow: '#000000',
      ongoing: '#FF9500',
      ongoingText: '#FFFFFF',
    },
  }),
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(component);
};

describe('EpisodeInfoCards', () => {
  it('should render pain qualities when provided', () => {
    renderWithTheme(<EpisodeInfoCards qualities={['throbbing', 'pulsing']} triggers={[]} />);
    
    expect(screen.getByText('Pain Quality')).toBeTruthy();
    expect(screen.getByText('Throbbing')).toBeTruthy();
    expect(screen.getByText('Pulsing')).toBeTruthy();
  });

  it('should not render pain qualities section when empty', () => {
    renderWithTheme(<EpisodeInfoCards qualities={[]} triggers={[]} />);
    
    expect(screen.queryByText('Pain Quality')).toBeNull();
  });

  it('should render triggers when provided', () => {
    renderWithTheme(<EpisodeInfoCards qualities={[]} triggers={['stress', 'lack_of_sleep']} />);
    
    expect(screen.getByText('Possible Triggers')).toBeTruthy();
    expect(screen.getByText('Stress')).toBeTruthy();
    expect(screen.getByText('Lack Of Sleep')).toBeTruthy();
  });

  it('should not render triggers section when empty', () => {
    renderWithTheme(<EpisodeInfoCards qualities={[]} triggers={[]} />);
    
    expect(screen.queryByText('Possible Triggers')).toBeNull();
  });

  it('should render both sections when both have data', () => {
    renderWithTheme(<EpisodeInfoCards qualities={['throbbing']} triggers={['stress']} />);
    
    expect(screen.getByText('Pain Quality')).toBeTruthy();
    expect(screen.getByText('Throbbing')).toBeTruthy();
    expect(screen.getByText('Possible Triggers')).toBeTruthy();
    expect(screen.getByText('Stress')).toBeTruthy();
  });
});