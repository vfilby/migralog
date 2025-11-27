import React from 'react';
import { View, Text } from 'react-native';

export type MedicationType = 'preventative' | 'rescue' | 'other';

interface MedicationBadgesProps {
  type: MedicationType;
  testID?: string;
}

export default function MedicationBadges({ type, testID }: MedicationBadgesProps) {
  return (
    <View testID={testID}>
      <Text testID={testID ? `${testID}-type-badge` : undefined}>
        {type === 'preventative' ? 'Preventative' : type === 'rescue' ? 'Rescue' : 'Other'}
      </Text>
    </View>
  );
}