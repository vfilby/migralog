# Screen and Component Refactoring Strategy

## Overview

The MigraineTracker app has grown to a point where several screens exceed 1,000 lines of code, and components are organized in a flat structure without clear categorization. This document outlines a strategy to refactor and reorganize the codebase for better maintainability.

## Current State Analysis

### Problem Areas

1. **Oversized Screens** (>1,000 lines):
   - `EpisodeDetailScreen.tsx`: 1,641 lines
   - `SettingsScreen.tsx`: 1,582 lines

2. **Large Screens** (500-1,000 lines):
   - 11 screens in this range, including MedicationDetailScreen, NewEpisodeScreen, MedicationsScreen

3. **Flat Component Structure**:
   - All 13 components in a single directory
   - Mix of shared and screen-specific components
   - Some components only used by single screens

4. **Code Duplication**:
   - Inline render methods in screens
   - Similar UI patterns not extracted into reusable components

## Refactoring Strategy

### Phase 1: Component Organization (Week 1)

Create a feature-based component directory structure:

```
src/components/
├── common/              # Truly shared components
│   ├── EpisodeCard/
│   ├── ErrorBoundary/
│   └── LoadingSpinner/
├── analytics/           # Analytics-specific components
│   ├── TimeRangeSelector/
│   ├── IntensityHistogram/
│   ├── EpisodeStatistics/
│   ├── MedicationUsageStatistics/
│   └── MonthlyCalendarView/
├── episode/             # Episode-related components
│   ├── TimelineEvent/
│   ├── GroupedTimelineEvent/
│   ├── IntensitySparkline/
│   └── EpisodeHeader/
├── medication/          # Medication-related components
│   ├── MedicationAutocomplete/
│   ├── MedicationScheduleManager/
│   ├── NotificationSettings/
│   ├── MedicationCard/
│   └── ScheduleLogButtons/
├── daily-status/        # Daily status components
│   └── DailyStatusWidget/
└── settings/            # Settings-specific components
    ├── DeveloperSection/
    ├── DatabaseStatus/
    ├── ThemeSelector/
    └── VersionInfo/
```

### Phase 2: Screen Refactoring (Weeks 2-3)

#### Priority 1: EpisodeDetailScreen (1,641 → ~400 lines)

Extract components:
- `episode/TimelineEvent`: Individual timeline event display
- `episode/GroupedTimelineEvent`: Grouped events display
- `episode/TimelineHeader`: Navigation and date display
- `episode/EpisodeStats`: Statistics section
- `episode/TimelineContainer`: Main timeline container with scroll logic

#### Priority 2: SettingsScreen (1,582 → ~300 lines)

Extract components:
- `settings/DeveloperSection`: All developer mode options
- `settings/DatabaseStatus`: Database info and actions
- `settings/ThemeSelector`: Theme switching UI
- `settings/NotificationSection`: Notification preferences
- `settings/VersionInfo`: App version and build info
- `settings/ErrorLogsButton`: Error logs access

#### Priority 3: MedicationDetailScreen (944 → ~400 lines)

Extract components:
- `medication/MedicationSchedule`: Schedule display
- `medication/DoseHistory`: Historical doses timeline
- `medication/MedicationStats`: Usage statistics
- `medication/ArchiveControls`: Archive/unarchive UI

### Phase 3: Screen-Specific Organization (Week 4)

For complex screens with multiple sub-components, create screen-specific folders:

```
src/screens/
├── EpisodeDetailScreen/
│   ├── index.tsx                    # Main screen (thin)
│   ├── components/
│   │   ├── TimelineSection.tsx
│   │   └── HeaderSection.tsx
│   └── hooks/
│       └── useEpisodeDetail.ts
├── SettingsScreen/
│   ├── index.tsx
│   └── components/
│       └── SettingsList.tsx
```

### Phase 4: Testing and Documentation (Week 5)

1. Update all test files to match new component locations
2. Ensure E2E tests still pass
3. Update component documentation
4. Create component usage guidelines

## Implementation Guidelines

### Component Extraction Rules

1. **Size Limit**: Aim for components under 300 lines
2. **Single Responsibility**: Each component should have one clear purpose
3. **Props Interface**: Define clear TypeScript interfaces for all props
4. **Self-Contained**: Components should include their own styles

### File Structure Template

```typescript
// components/episode/TimelineEvent/index.tsx
export { TimelineEvent } from './TimelineEvent';
export type { TimelineEventProps } from './types';

// components/episode/TimelineEvent/TimelineEvent.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TimelineEventProps } from './types';

export const TimelineEvent: React.FC<TimelineEventProps> = ({ ... }) => {
  // Component logic
};

const styles = StyleSheet.create({
  // Styles
});

// components/episode/TimelineEvent/types.ts
export interface TimelineEventProps {
  // Props definition
}
```

### Testing Strategy

1. **Unit Tests**: Create tests for each extracted component
2. **Integration Tests**: Ensure screens work with new components
3. **E2E Tests**: Run full suite after each major refactor
4. **Snapshot Tests**: Update snapshots for visual regression

### Migration Approach

1. **Incremental**: Refactor one screen at a time
2. **Feature Flags**: Use flags for gradual rollout if needed
3. **Backwards Compatible**: Maintain imports during transition
4. **Git History**: Use `git mv` to preserve file history

## Success Metrics

- **File Size**: No screen >500 lines, no component >300 lines
- **Component Reuse**: Increase shared component usage by 50%
- **Test Coverage**: Maintain or improve current coverage
- **Performance**: No degradation in app performance
- **Developer Experience**: Faster feature development

## Rollback Plan

If issues arise:
1. Each refactor is a separate PR
2. Can revert individual PRs without affecting others
3. Keep old component references until migration complete
4. Maintain parallel implementations if needed

## Timeline

- Week 1: Component reorganization
- Week 2: EpisodeDetailScreen refactor
- Week 3: SettingsScreen refactor
- Week 4: MedicationDetailScreen + organization
- Week 5: Testing and documentation

Total estimated time: 5 weeks (part-time effort)