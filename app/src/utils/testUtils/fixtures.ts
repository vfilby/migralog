/**
 * Test Fixtures - Common Mock Objects for Testing
 *
 * This file contains reusable mock objects and factory functions
 * to reduce duplication across test files.
 */

import type { NavigationProp } from '@react-navigation/native';

/**
 * Create a mock navigation object for React Navigation testing
 * 
 * @example
 * ```typescript
 * const navigation = createMockNavigation();
 * const { navigate, goBack } = navigation;
 * 
 * fireEvent.press(button);
 * expect(navigate).toHaveBeenCalledWith('ScreenName', { id: '123' });
 * ```
 */
export function createMockNavigation<T extends Record<string, unknown> = Record<string, unknown>>(): NavigationProp<T> {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()), // Returns unsubscribe function
    removeListener: jest.fn(),
    reset: jest.fn(),
    dispatch: jest.fn(),
    isFocused: jest.fn(() => true),
    canGoBack: jest.fn(() => false),
    getId: jest.fn(() => 'test-screen-id'),
    getParent: jest.fn(),
    getState: jest.fn(() => ({
      key: 'test-state-key',
      index: 0,
      routeNames: ['TestRoute'],
      routes: [{ key: 'test-route-key', name: 'TestRoute' }],
      type: 'stack',
      stale: false,
    })),
    setParams: jest.fn(),
    navigateDeprecated: jest.fn(),
    preload: jest.fn(),
  } as unknown as NavigationProp<T>;
}

/**
 * Create a mock route object for React Navigation testing
 * 
 * @param name The route name
 * @param params Optional route parameters
 * 
 * @example
 * ```typescript
 * const route = createMockRoute('EpisodeDetail', { episodeId: 'ep-123' });
 * expect(route.params.episodeId).toBe('ep-123');
 * ```
 */
export function createMockRoute<T = Record<string, unknown>>(
  name: string = 'TestRoute',
  params?: T
): { key: string; name: string; params?: T } {
  return {
    key: `test-route-${Date.now()}`,
    name,
    ...(params && { params }),
  };
}

/**
 * Create a mock theme object for testing
 * 
 * @param isDark Whether to use dark theme colors
 * 
 * @example
 * ```typescript
 * const theme = createMockTheme();
 * expect(theme.colors.background).toBe('#FFFFFF');
 * ```
 */
export function createMockTheme(isDark: boolean = false) {
  return {
    dark: isDark,
    colors: {
      primary: isDark ? '#BB86FC' : '#6200EE',
      background: isDark ? '#121212' : '#FFFFFF',
      card: isDark ? '#1E1E1E' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#000000',
      border: isDark ? '#272727' : '#C7C7CC',
      notification: isDark ? '#FF453A' : '#FF3B30',
      // Add more colors as needed
    },
  };
}

/**
 * Create a mock medication for testing
 * 
 * @param overrides Partial medication properties to override defaults
 * 
 * @example
 * ```typescript
 * const medication = createMockMedication({ name: 'Ibuprofen', type: 'rescue' });
 * expect(medication.dosageAmount).toBe(400); // Default value
 * ```
 */
interface MockMedication {
  id: string;
  name: string;
  type: 'rescue' | 'preventative';
  dosageAmount: number;
  dosageUnit: string;
  defaultQuantity: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export function createMockMedication(overrides: Partial<MockMedication> = {}): MockMedication {
  return {
    id: `med-${Date.now()}`,
    name: 'Test Medication',
    type: 'rescue' as const,
    dosageAmount: 400,
    dosageUnit: 'mg',
    defaultQuantity: 1,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock episode for testing
 * 
 * @param overrides Partial episode properties to override defaults
 * 
 * @example
 * ```typescript
 * const episode = createMockEpisode({ endTime: Date.now() });
 * expect(episode.endTime).toBeDefined();
 * ```
 */
interface MockEpisode {
  id: string;
  startTime: number;
  endTime: number | null;
  locations: string[];
  qualities: string[];
  symptoms: string[];
  triggers: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export function createMockEpisode(overrides: Partial<MockEpisode> = {}): MockEpisode {
  const now = Date.now();
  return {
    id: `ep-${Date.now()}`,
    startTime: now - 2 * 60 * 60 * 1000, // 2 hours ago
    endTime: null, // Ongoing by default
    locations: ['front'],
    qualities: ['throbbing'],
    symptoms: ['nausea'],
    triggers: ['stress'],
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create multiple mock items using a factory function
 * 
 * @param count Number of items to create
 * @param factory Factory function to create each item
 * @param getOverrides Optional function to get overrides for each item
 * 
 * @example
 * ```typescript
 * const medications = createMockList(3, createMockMedication, (i) => ({ 
 *   name: `Medication ${i + 1}` 
 * }));
 * expect(medications).toHaveLength(3);
 * expect(medications[0].name).toBe('Medication 1');
 * ```
 */
export function createMockList<T>(
  count: number,
  factory: (overrides?: Record<string, unknown>) => T,
  getOverrides?: (index: number) => Record<string, unknown>
): T[] {
  return Array.from({ length: count }, (_, i) => 
    factory(getOverrides ? getOverrides(i) : {})
  );
}