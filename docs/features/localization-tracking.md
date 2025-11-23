# Localization Tracking for Date/Time Formatting

**Status:** Tracking / Planning
**Created:** Issue #192 (PR #188 code review follow-up)
**Last Updated:** 2025-01-21

## Overview

This document tracks all date/time formatting that will need localization when MigraLog implements internationalization (i18n) support. The current implementation uses hardcoded English format strings and text.

## Scope

This tracking covers:
1. **Time format preferences** (12-hour vs 24-hour)
2. **Date format patterns** (locale-specific ordering)
3. **Hardcoded English text** (relative dates, labels)
4. **Duration formatting** (hours, minutes, days)

## Affected Files

### Core Utilities (High Priority)

| File | Issue | Current State |
|------|-------|---------------|
| `src/utils/dateFormatting.ts` | All functions | Hardcoded format strings (`'h:mm a'`, `'MMM d'`), English text ("Today", "Yesterday", "Started at", "hour", "day") |
| `src/utils/timelineGrouping.ts` | `format(dayStart, 'EEEE, MMM d')` | English weekday/month names |
| `src/utils/medicationTimeline.ts` | Date formatting | Imports from date-fns |

### Screen Components (Medium Priority)

| File | Issue | Current State |
|------|-------|---------------|
| `src/screens/DashboardScreen.tsx` | `format(item.doseTime, 'h:mm a')` | 12-hour time format hardcoded |
| `src/screens/MedicationsScreen.tsx` | Multiple `format()` calls | `'h:mm a'`, `'MMM d, yyyy'` |
| `src/screens/MedicationDetailScreen.tsx` | Multiple `format()` calls | `'EEE'`, `'d'`, `'MMM d, yyyy h:mm a'` |
| `src/screens/NewEpisodeScreen.tsx` | `format(startTime, 'MMM d, yyyy h:mm a')` | Full date-time format |
| `src/screens/EpisodeDetailScreen.tsx` | `format(dayGroup.date, 'MMM d')` | Short date format |
| `src/screens/LogMedicationScreen.tsx` | `format(timestamp, 'MMM d, yyyy h:mm a')` | Full date-time format |
| `src/screens/EditMedicationDoseScreen.tsx` | `format(timestamp, 'MMM d, yyyy h:mm a')` | Full date-time format |
| `src/screens/EditIntensityReadingScreen.tsx` | `format(timestamp, 'MMM d, yyyy h:mm a')` | Full date-time format |
| `src/screens/DailyStatusPromptScreen.tsx` | `format(date, 'EEEE, MMMM d, yyyy')` + "Yesterday" fallback | Full date with weekday |
| `src/screens/PerformanceScreen.tsx` | `format(new Date(metric.timestamp), 'HH:mm:ss')` | 24-hour debug format |
| `src/screens/ErrorLogsScreen.tsx` | `format(log.timestamp, 'MMM d, h:mm:ss a')` | Debug timestamp format |

### UI Components (Medium Priority)

| File | Issue | Current State |
|------|-------|---------------|
| `src/components/EpisodeCard.tsx` | `format(episode.startTime, ...)` | `'EEEE, MMM d, yyyy'` (accessibility), `'EEE, MMM d · h:mm a'` (display) |
| `src/components/MonthlyCalendarView.tsx` | Multiple `format()` calls | `'yyyy-MM-dd'` (data), `'MMMM d, yyyy'` (a11y), `'d'`, `'MMMM yyyy'` (display) |

### Database Layer (Low Priority - Data Storage)

| File | Issue | Current State |
|------|-------|---------------|
| `src/database/dailyStatusRepository.ts` | `format(date, 'yyyy-MM-dd')` | ISO format for data storage (OK to keep as-is) |
| `src/store/dailyStatusStore.ts` | `format(currentDate, 'yyyy-MM-dd')` | ISO format for data storage (OK to keep as-is) |

## Hardcoded English Text

### In `dateFormatting.ts`:
- `"Started at"` - prefix for ongoing episodes
- `"Started"` - prefix for ongoing episodes (different context)
- `"Today"` - relative date label
- `"Yesterday"` - relative date label
- `"day"` / `"days"` - duration units
- `"hour"` / `"hours"` - duration units
- `"Unknown time"` - error fallback
- `"Unknown duration"` - error fallback

### In Screen Components:
- `"Yesterday"` fallback in `DailyStatusPromptScreen.tsx`
- Various accessibility labels containing date/time descriptions

## Recommended Approach

### 1. Use date-fns Locales

date-fns has excellent locale support. Import the user's locale and pass it to format:

```typescript
import { format } from 'date-fns';
import { enUS, es, fr, de } from 'date-fns/locale';

// Get locale from user preferences or device settings
const userLocale = getUserLocale(); // e.g., enUS, es, fr

format(date, 'h:mm a', { locale: userLocale });
```

### 2. Handle 12h vs 24h Time Preference

Some locales use 24-hour time by default. Consider:
- Using device locale settings
- Adding user preference in Settings screen
- Using locale-appropriate format strings ('h:mm a' vs 'HH:mm')

```typescript
// Example: locale-aware time format
const timeFormat = is24HourLocale(userLocale) ? 'HH:mm' : 'h:mm a';
```

### 3. Implement i18n Library for Static Text

For hardcoded strings like "Today", "Yesterday", "Started at", use an i18n library:

**Options:**
- `react-i18next` - Most popular, full-featured
- `react-native-i18n` - Simple, lightweight
- `expo-localization` - Expo-native device locale detection

```typescript
import { t } from 'i18next';

// Instead of: `Started at ${format(startDate, 'h:mm a')}`
// Use: t('episode.startedAt', { time: formatTime(startDate) })
```

### 4. Centralize Format Patterns

Create a locale-aware formatting service:

```typescript
// src/services/localizationService.ts
export const DateFormats = {
  time: (locale: Locale) => is24Hour(locale) ? 'HH:mm' : 'h:mm a',
  shortDate: 'MMM d',
  fullDate: 'MMM d, yyyy',
  fullDateTime: (locale: Locale) => `MMM d, yyyy ${DateFormats.time(locale)}`,
  dayOfWeek: 'EEEE',
  // etc.
};
```

## Implementation Priority

1. **Phase 1 - Foundation:**
   - Add locale detection (expo-localization)
   - Create centralized formatting service
   - Add user preference for 12h/24h time

2. **Phase 2 - Core Utilities:**
   - Update `dateFormatting.ts` to use locales
   - Update `timelineGrouping.ts`

3. **Phase 3 - Screens:**
   - Update all screen components to use centralized formatting
   - Add i18n library for static text

4. **Phase 4 - Components:**
   - Update EpisodeCard, MonthlyCalendarView
   - Update accessibility labels

## Testing Considerations

- Test with RTL locales (Arabic, Hebrew)
- Test with different date orderings (MM/DD vs DD/MM)
- Test 12h and 24h time formats
- Test long month/day names in different languages
- Ensure accessibility labels are properly localized

## Related Issues

- Issue #192: Track localization for date/time formatting (this document)
- Future: Full i18n implementation

## Notes

- The `'yyyy-MM-dd'` format used for data storage in repositories should NOT be localized (ISO 8601 standard)
- Performance screen and error logs use debug-oriented formats that may not need localization
- Accessibility labels should be localized along with visual text
