# Unit Test Coverage Improvement Plan for Screens

## Current State Analysis

**Critical Finding**: 0% test coverage for screens (17 screen components with no unit tests)

### Existing Infrastructure
- ✅ Jest setup with comprehensive mocking in `jest.setup.js`
- ✅ Testing utilities in `testHelpers.ts` for database fixtures
- ✅ Good testing patterns in repository tests
- ✅ React Native Testing Library not yet configured
- ❌ No screen tests exist

### Screen Complexity Assessment (by lines of code)
1. **High Complexity (>500 LOC)**:
   - `EpisodeDetailScreen.tsx` (1,305) - Complex state management, forms
   - `SettingsScreen.tsx` (843) - Multiple settings, preferences
   - `MedicationDetailScreen.tsx` (759) - Schedule management
   - `NewEpisodeScreen.tsx` (755) - Multi-step form validation
   - `EditMedicationScreen.tsx` (675) - Form validation, schedules
   - `AddMedicationScreen.tsx` (624) - Form validation
   - `MedicationsScreen.tsx` (597) - List management, actions
   - `DashboardScreen.tsx` (552) - Data aggregation, widgets

2. **Medium Complexity (200-500 LOC)**:
   - `LogMedicationScreen.tsx` (534)
   - `BackupRecoveryScreen.tsx` (470)
   - `LogUpdateScreen.tsx` (452)
   - `DailyStatusPromptScreen.tsx` (370)
   - `ErrorLogsScreen.tsx` (330)
   - `MedicationLogScreen.tsx` (236)
   - `ArchivedMedicationsScreen.tsx` (232)
   - `AnalyticsScreen.tsx` (214)

3. **Low Complexity (<200 LOC)**:
   - `EpisodesScreen.tsx` (104) - Simple list display

## Implementation Plan

### Phase 1: Infrastructure Setup (Priority: High)
1. **Install React Native Testing Library**
   ```bash
   npm install --save-dev @testing-library/react-native @testing-library/jest-native
   ```

2. **Create Screen Testing Utilities** (`src/utils/screenTestHelpers.ts`)
   - Mock navigation props factory
   - Theme provider wrapper
   - Store provider wrapper with mock data
   - Custom render function with all providers

3. **Update Jest Configuration**
   - Add `@testing-library/jest-native/extend-expect` to setup
   - Configure custom render helpers

### Phase 2: Low-Hanging Fruit (Priority: High, ~2-3 hours)
Start with simple screens to establish patterns:

1. **EpisodesScreen.tsx** - Simple list component
   - Render with empty state
   - Render with mock episodes
   - Navigation to episode details
   - Pull to refresh functionality

2. **AnalyticsScreen.tsx** - Data display component
   - Render with no data
   - Render with mock analytics data
   - Date range selection

3. **ErrorLogsScreen.tsx** - Log display component
   - Render empty state
   - Render with mock logs
   - Clear logs functionality

### Phase 3: Medium Complexity Screens (Priority: Medium, ~1-2 days)
Focus on screens with moderate complexity:

1. **DailyStatusPromptScreen.tsx**
   - Form submission
   - Input validation
   - Navigation after submission

2. **MedicationLogScreen.tsx**
   - List rendering
   - Filtering functionality
   - Date navigation

3. **ArchivedMedicationsScreen.tsx**
   - Archived items display
   - Restore functionality

4. **LogMedicationScreen.tsx**
   - Dose logging
   - Validation
   - Time selection

5. **LogUpdateScreen.tsx**
   - Update forms
   - Validation
   - Save functionality

6. **BackupRecoveryScreen.tsx**
   - File operations (mocked)
   - Import/export flows
   - Error handling

### Phase 4: High Complexity Screens (Priority: Medium-Low, ~3-5 days)
Complex screens requiring comprehensive testing:

1. **DashboardScreen.tsx**
   - Widget rendering
   - Data aggregation display
   - Multiple store interactions
   - Navigation to various screens

2. **MedicationsScreen.tsx**
   - CRUD operations
   - List management
   - Filtering and sorting
   - Schedule status display

3. **AddMedicationScreen.tsx**
   - Multi-step form
   - Validation logic
   - Schedule creation
   - Type-specific fields

4. **EditMedicationScreen.tsx**
   - Form pre-population
   - Update validation
   - Schedule modification
   - Delete confirmation

5. **NewEpisodeScreen.tsx**
   - Complex multi-section form
   - Real-time validation
   - Location services (mocked)
   - DateTime picker interactions

6. **MedicationDetailScreen.tsx**
   - Complex state display
   - Schedule management
   - Dose logging
   - History display

7. **EpisodeDetailScreen.tsx** (Most Complex)
   - Timeline visualization
   - Intensity tracking
   - Note management
   - Edit workflows

8. **SettingsScreen.tsx**
   - Multiple preference types
   - Theme switching
   - Storage operations
   - Navigation flows

## Testing Strategy

### Core Test Categories for Each Screen

1. **Rendering Tests**
   - Renders without crashing
   - Displays correct title/header
   - Shows appropriate content for different states

2. **Interaction Tests**
   - Button presses
   - Form submissions
   - Navigation actions
   - Gestures (scroll, swipe)

3. **State Management Tests**
   - Store integration
   - Data loading states
   - Error states
   - Empty states

4. **Theme Support Tests**
   - Light mode rendering
   - Dark mode rendering
   - Color accessibility

5. **Accessibility Tests**
   - Screen reader labels
   - Touch targets
   - Keyboard navigation

### Mock Strategy

1. **Navigation**: Use jest.mock with navigation.navigate tracking
2. **Stores**: Mock store providers with controlled state
3. **Database**: Use existing mock infrastructure
4. **Platform Services**: Mock location, notifications, file system
5. **Date/Time**: Mock for consistent test results

### Test Structure Template

```typescript
// Example structure for each screen test
describe('ScreenName', () => {
  beforeEach(() => {
    // Reset mocks and setup
  });

  describe('Rendering', () => {
    it('renders without crashing');
    it('displays correct header');
    it('shows loading state');
    it('shows empty state');
    it('shows data state');
  });

  describe('User Interactions', () => {
    it('handles button press');
    it('submits form correctly');
    it('navigates on action');
  });

  describe('Theme Support', () => {
    it('renders correctly in light mode');
    it('renders correctly in dark mode');
  });

  describe('Accessibility', () => {
    it('has proper accessibility labels');
  });
});
```

## Success Metrics

- **Target Coverage**: 80%+ line coverage for screens
- **Test Quality**: Each screen should have 15-25 meaningful tests
- **Maintainability**: Reusable testing utilities and patterns
- **CI Integration**: All tests pass in automated builds

## Timeline Estimate

- **Phase 1**: 4-6 hours (infrastructure)
- **Phase 2**: 6-8 hours (3 simple screens)
- **Phase 3**: 16-24 hours (6 medium screens)
- **Phase 4**: 32-40 hours (8 complex screens)

**Total Effort**: ~60-80 hours for comprehensive screen test coverage

## Risk Mitigation

1. **Mock Complexity**: Start with simple screens to validate mock strategy
2. **Theme Testing**: Establish theme testing pattern early
3. **Store Integration**: Create reusable store mock utilities
4. **CI Failures**: Ensure all mocks work in CI environment

This plan prioritizes establishing good testing patterns with simple screens first, then systematically covering more complex screens while building reusable testing infrastructure.

## Progress Tracking

### Phase 1: Infrastructure Setup
- [ ] Install React Native Testing Library
- [ ] Create screen testing utilities
- [ ] Update Jest configuration

### Phase 2: Simple Screens
- [ ] EpisodesScreen.tsx tests
- [ ] AnalyticsScreen.tsx tests  
- [ ] ErrorLogsScreen.tsx tests

### Phase 3: Medium Complexity Screens
- [ ] DailyStatusPromptScreen.tsx tests
- [ ] MedicationLogScreen.tsx tests
- [ ] ArchivedMedicationsScreen.tsx tests
- [ ] LogMedicationScreen.tsx tests
- [ ] LogUpdateScreen.tsx tests
- [ ] BackupRecoveryScreen.tsx tests

### Phase 4: High Complexity Screens
- [ ] DashboardScreen.tsx tests
- [ ] MedicationsScreen.tsx tests
- [ ] AddMedicationScreen.tsx tests
- [ ] EditMedicationScreen.tsx tests
- [ ] NewEpisodeScreen.tsx tests
- [ ] MedicationDetailScreen.tsx tests
- [ ] EpisodeDetailScreen.tsx tests
- [ ] SettingsScreen.tsx tests
