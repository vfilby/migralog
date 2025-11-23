# Localization Tracking for Date/Time Formatting

> **Status**: Planning
> **Issue**: #192
> **Related**: PR #188 (Initial date formatting utility extraction), Issue #191 (Consolidate date/time formatting)

## Overview

This document tracks the localization requirements and implementation plan for date/time formatting utilities in MigraLog. Currently, the app uses hardcoded English format strings and text, which limits accessibility for non-English speaking users.

## Current State

### Files Using date-fns Formatting

The following files currently use `date-fns` for date/time formatting:

**Core Utilities:**
- `src/utils/dateFormatting.ts` - Central date formatting utilities
- `src/utils/formatting.ts` - General formatting (uses `toLocaleString()`)
- `src/utils/timelineGrouping.ts` - Timeline grouping logic
- `src/utils/medicationTimeline.ts` - Medication timeline formatting

**Screens:**
- `src/screens/DashboardScreen.tsx`
- `src/screens/EpisodeDetailScreen.tsx`
- `src/screens/NewEpisodeScreen.tsx`
- `src/screens/MedicationsScreen.tsx`
- `src/screens/MedicationDetailScreen.tsx`
- `src/screens/LogMedicationScreen.tsx`
- `src/screens/EditMedicationDoseScreen.tsx`
- `src/screens/EditIntensityReadingScreen.tsx`
- `src/screens/EditEpisodeNoteScreen.tsx`
- `src/screens/DailyStatusPromptScreen.tsx`

**Components:**
- `src/components/EpisodeCard.tsx`
- `src/components/MonthlyCalendarView.tsx`
- `src/components/DailyStatusWidget.tsx`

**Services/Stores:**
- `src/services/dailyCheckinService.ts`
- `src/store/dailyStatusStore.ts`
- `src/database/dailyStatusRepository.ts`

### Hardcoded Format Strings

The following format strings are currently hardcoded:

| Format String | Usage | Example Output |
|---------------|-------|----------------|
| `'h:mm a'` | 12-hour time | "2:30 PM" |
| `'MMM d, h:mm a'` | Date with time | "Jan 15, 2:30 PM" |
| `'MMM d, yyyy'` | Full date | "Jan 15, 2024" |
| `'MMM d, yyyy h:mm a'` | Full date-time | "Jan 15, 2024 2:30 PM" |
| `'yyyy-MM-dd'` | ISO date (internal) | "2024-01-15" |
| `'EEEE'` | Day of week | "Monday" |

### Hardcoded English Text

The following English strings need localization:

**In `dateFormatting.ts`:**
- `"Started at"` - Used for ongoing episodes
- `"Started"` - Used for multi-day ongoing episodes
- `"Today"` / `"Yesterday"` - Relative date labels
- `"h"` / `"m"` - Duration abbreviations (e.g., "2h 30m")
- `"hour"` / `"hours"` / `"day"` / `"days"` - Duration words
- `"Unknown time"` / `"Unknown duration"` - Error fallbacks

## Localization Considerations

### 1. Time Format Preferences

**Issue**: Some users prefer 24-hour time (14:30) vs 12-hour time (2:30 PM)

**Options:**
- **A. System Default**: Use device locale setting via `Intl.DateTimeFormat`
- **B. User Preference**: Add setting in app to override (12h/24h/system)
- **C. date-fns Locale**: Pass locale to `format()` function

**Recommendation**: Option B - User preference with system default fallback

### 2. Date Format Preferences

**Issue**: Date ordering varies by locale (MM/DD vs DD/MM vs YYYY-MM-DD)

**Options:**
- **A. Locale-Aware Formatting**: Use locale tokens like `'P'` (short date) or `'PP'` (medium date)
- **B. Fixed Format**: Keep current format for consistency

**Recommendation**: Option A - Use locale-aware tokens where appropriate

### 3. Text Translations

**Issue**: UI text like "Started at", "Today", duration words need translation

**Options:**
- **A. react-i18next**: Full i18n framework with translation files
- **B. Simple Object Map**: Lightweight key-value translation object
- **C. Platform Intl**: Use `Intl.RelativeTimeFormat` where possible

**Recommendation**: Option A for future scalability, but start with Option B for MVP

### 4. Internal Date Storage

**Note**: The `'yyyy-MM-dd'` format is used internally for database keys and should NOT be localized. This is ISO 8601 standard for data storage.

## Implementation Plan

### Phase 1: Centralize Format Strings (Low Risk)

1. Create `src/utils/dateFormats.ts` constants file:
   ```typescript
   // Date format tokens - locale-aware
   export const DATE_FORMATS = {
     shortDate: 'P',      // Locale-aware: 01/15/24 or 15/01/24
     mediumDate: 'PP',    // Locale-aware: Jan 15, 2024
     longDate: 'PPP',     // Locale-aware: January 15, 2024
     fullDate: 'PPPP',    // Locale-aware: Monday, January 15, 2024

     // Time formats - user preference based
     time12h: 'h:mm a',   // 2:30 PM
     time24h: 'HH:mm',    // 14:30

     // Internal formats - never localized
     isoDate: 'yyyy-MM-dd',
   };
   ```

2. Update `dateFormatting.ts` to use constants

### Phase 2: Add Locale Support to date-fns (Medium Risk)

1. Create locale context/provider:
   ```typescript
   // src/utils/localeContext.ts
   import { enUS, enGB, es, fr, de } from 'date-fns/locale';

   const locales = { enUS, enGB, es, fr, de };

   export function getLocale(): Locale {
     // Return appropriate locale based on device/user settings
   }
   ```

2. Update format calls to include locale option:
   ```typescript
   format(date, 'PP', { locale: getLocale() })
   ```

### Phase 3: Add User Preferences (Medium Risk)

1. Add to Settings screen:
   - Time format: "12-hour" / "24-hour" / "System default"
   - Date format: "System default" (locale-aware tokens handle this)

2. Store preference in AsyncStorage

3. Create `useUserDatePreferences()` hook

### Phase 4: Text Translation (Higher Risk)

1. Extract hardcoded strings to translation keys
2. Choose i18n solution (react-i18next recommended)
3. Create translation files for supported locales
4. Update components to use translation function

## Testing Considerations

- Test with different device locales (Settings > General > Language)
- Test 12-hour and 24-hour time formats
- Test date ordering (US vs UK vs European)
- Verify internal date storage remains ISO format
- Test duration formatting in different locales

## Dependencies

**Already Available:**
- `date-fns` - Has built-in locale support
- React Native Intl polyfill - May need for older Android

**May Need to Add:**
- `react-i18next` - For text translations (if Phase 4)
- `i18next-react-native-language-detector` - Auto-detect device language

## References

- [date-fns i18n Documentation](https://date-fns.org/docs/I18n)
- [date-fns Locale Tokens](https://date-fns.org/docs/format) - See "Localized formats"
- [react-i18next Documentation](https://react.i18next.com/)
- [Intl.DateTimeFormat MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)

## Related Issues

- Issue #191 - Consolidate date/time formatting utilities (complete this first)
- PR #188 - Initial date formatting utility extraction (completed)
