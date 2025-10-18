import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

// Simple test component to verify testing infrastructure
const TestComponent: React.FC = () => (
  <View testID="test-component">
    <Text>Hello Test</Text>
  </View>
);

describe('Testing Infrastructure', () => {
  it('can render a simple component', () => {
    const { getByText, getByTestId } = render(<TestComponent />);
    expect(getByText('Hello Test')).toBeTruthy();
    expect(getByTestId('test-component')).toBeTruthy();
  });
});
