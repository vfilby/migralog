# Store vs Repository Usage Audit

**Date:** 2025-12-07  
**Issue:** #271  
**Purpose:** Identify all places where services/components access repositories directly instead of going through stores

## Executive Summary

This audit identified **52 files** with direct repository imports across the codebase:
- **8 Screen files** with direct repository access (should use stores)
- **3 Service files** with direct repository access (legitimate exceptions)
- **1 Component file** with direct repository access (should use store)
- **40 Test files** (legitimate - tests can access repositories directly)

### Key Findings

1. **Screens are the primary violators** - 8 screen files bypass stores and access repositories directly
2. **One component violates the pattern** - `EpisodeStatistics.tsx` mixes store and repository usage
3. **Services have legitimate exceptions** - Notification and backup services need direct access
4. **Test files are compliant** - Test files appropriately use repositories for verification

### Priority Classification

- **High Priority (9 files):** Screen components that should use stores
- **Medium Priority (1 file):** `EpisodeStatistics.tsx` component with mixed usage
- **Low Priority (3 files):** Services with legitimate direct access (document as exceptions)
- **No Action Required (40 files):** Test files

---

## Detailed Findings

### 1. Screen Components with Direct Repository Access (HIGH PRIORITY)

These screen files violate the architectural pattern of Component → Store → Repository. They should be refactored to use stores.

#### 1.1 Medication Screens

| File | Line | Repositories Used | Store Available | Impact |
|------|------|------------------|-----------------|--------|
| `LogMedicationScreen.tsx` | 16 | `medicationRepository` | `useMedicationStore` | Uses `getById()` to load medication details. Store has this data via `rescueMedications`. |
| `MedicationsScreen.tsx` | 7 | `medicationScheduleRepository`, `medicationDoseRepository` | `useMedicationStore` | Should use store's `schedules` and `doses` state. |
| `MedicationLogScreen.tsx` | 13 | `medicationDoseRepository`, `medicationRepository` | `useMedicationStore` | Bypasses store for dose and medication queries. |
| `EditMedicationScreen.tsx` | 17 | `medicationRepository`, `medicationScheduleRepository` | `useMedicationStore` | Direct repository access for updates. |
| `AddMedicationScreen.tsx` | 20 | `medicationScheduleRepository` | `useMedicationStore` | Creates schedules directly without updating store state. |
| `ArchivedMedicationsScreen.tsx` | 13 | `medicationRepository` | `useMedicationStore` | Queries archived medications directly. |
| `MedicationDetailScreen.tsx` | 22 | `medicationRepository`, `medicationDoseRepository`, `medicationScheduleRepository` | `useMedicationStore` | Heavy direct repository usage. |
| `EditMedicationDoseScreen.tsx` | 16 | `medicationDoseRepository`, `medicationRepository` | `useMedicationStore` | Updates doses directly. |

**Total: 8 medication screen files**

#### 1.2 Episode Screens

| File | Line | Repositories Used | Store Available | Impact |
|------|------|------------------|-----------------|--------|
| `EpisodeDetailScreen.tsx` | 9-10 | `episodeRepository`, `intensityRepository`, `symptomLogRepository`, `episodeNoteRepository`, `painLocationLogRepository`, `medicationDoseRepository`, `medicationRepository` | `useEpisodeStore`, `useMedicationStore` | Most complex violator - uses 7 different repositories directly. |
| `EditIntensityReadingScreen.tsx` | 15 | `intensityRepository` | `useEpisodeStore` | Direct intensity reading updates. |
| `EditEpisodeNoteScreen.tsx` | 16 | `episodeNoteRepository` | `useEpisodeStore` | Direct note updates. |
| `LogUpdateScreen.tsx` | 18 | `intensityRepository`, `symptomLogRepository`, `episodeNoteRepository`, `episodeRepository`, `painLocationLogRepository` | `useEpisodeStore` | Creates/updates episode data directly. |

**Total: 4 episode screen files**

**Overall: 12 screen files with direct repository access**

### 2. Component Files with Direct Repository Access (MEDIUM PRIORITY)

| File | Line | Repositories Used | Store Available | Issue |
|------|------|------------------|-----------------|-------|
| `components/analytics/EpisodeStatistics.tsx` | 5 | `dailyStatusRepository` | `useDailyStatusStore` | **INCONSISTENT PATTERN**: Uses `useAnalyticsStore` for episodes but bypasses `useDailyStatusStore` for daily status data. Should use store consistently. |
| `components/shared/EpisodeCard.tsx` | 7 | `intensityRepository` | `useEpisodeStore` | Fetches intensity readings directly instead of through store. |

**Total: 2 component files**

### 3. Service Files with Direct Repository Access (LEGITIMATE EXCEPTIONS)

These services have valid reasons to access repositories directly:

| File | Line | Repositories Used | Justification |
|------|------|------------------|---------------|
| `services/notifications/medicationNotifications.ts` | 5 | `medicationRepository`, `medicationScheduleRepository`, `medicationDoseRepository` | **LEGITIMATE**: Background notification handlers can't rely on store state. Need direct DB access when app is backgrounded. |
| `services/notifications/notificationService.ts` | 5 | `medicationRepository`, `medicationDoseRepository` | **LEGITIMATE**: Same as above - background execution context. |
| `services/backup/BackupExporter.ts` | 5-7 | `episodeRepository`, `episodeNoteRepository`, `intensityRepository`, `medicationRepository`, `medicationDoseRepository`, `medicationScheduleRepository`, `dailyStatusRepository` | **LEGITIMATE**: Backup/export needs complete database access independent of UI state. Exports ALL data, not just what's loaded in stores. |

**Total: 3 service files (documented exceptions)**

### 4. Store Files (EXPECTED)

All store files correctly import repositories - this is the intended pattern.

| Store | Repositories Used | Purpose |
|-------|------------------|---------|
| `episodeStore.ts` | `episodeRepository`, `intensityRepository`, `symptomLogRepository` | Episode domain operations |
| `medicationStore.ts` | `medicationRepository`, `medicationDoseRepository`, `medicationScheduleRepository`, `episodeRepository` | Medication domain operations |
| `dailyStatusStore.ts` | `dailyStatusRepository`, `episodeRepository` | Daily status tracking |
| `analyticsStore.ts` | `episodeRepository`, `intensityRepository` | Analytics calculations |

**Total: 4 store files (correct usage)**

### 5. Test Files (NO ACTION REQUIRED)

Test files appropriately use repositories for verification and setup:

- **Store tests (7 files):** Mock repositories to test store logic
- **Service tests (10 files):** Verify service-repository interactions
- **Component tests (16 files):** Setup test data via repositories
- **Integration tests (3 files):** Test full data flow through repositories
- **Repository tests (3 files):** Test repository implementations
- **Script (1 file):** `scripts/test-backup-restore.ts` uses repositories for testing

**Total: 40 test files (legitimate usage)**

---

## Impact Analysis

### Current Issues

1. **Bypassed Error Handling**
   - Stores have centralized error handling via `errorLogger` and `toastService`
   - Direct repository access means errors aren't logged to Sentry or shown to users
   - Example: `LogMedicationScreen.tsx:297` calls `medicationRepository.getById()` without error handling

2. **Missing Logging**
   - Stores log operations for debugging and analytics
   - Direct repository access bypasses operational logging
   - Makes debugging production issues harder

3. **State Synchronization Issues**
   - When screens update data directly via repositories, store state becomes stale
   - Can cause UI inconsistencies
   - Example: `EditMedicationDoseScreen` updates dose but doesn't refresh store

4. **Unclear Architectural Boundaries**
   - Hard to understand data flow when screens bypass stores
   - Makes codebase harder to maintain and onboard new developers
   - Testing becomes more complex

### Benefits of Refactoring

1. **Centralized Error Handling**
   - All operations go through store error handling
   - Consistent Sentry logging
   - User-friendly error toasts

2. **Improved Logging**
   - All operations logged for debugging
   - Better production support

3. **State Consistency**
   - Store state always reflects database state
   - Predictable UI updates

4. **Better Testing**
   - Can mock stores instead of repositories in component tests
   - Clearer test boundaries

---

## Refactoring Priority

### High Priority (Should Refactor First)

**Medication Screens (8 files) - Estimated: 3-5 hours**
1. `MedicationDetailScreen.tsx` - Most complex, highest impact
2. `LogMedicationScreen.tsx` - High usage frequency
3. `EditMedicationDoseScreen.tsx` - Data consistency issues
4. `MedicationsScreen.tsx` - Main medications list
5. `MedicationLogScreen.tsx` - Dose history
6. `EditMedicationScreen.tsx` - Update operations
7. `AddMedicationScreen.tsx` - Create operations
8. `ArchivedMedicationsScreen.tsx` - Archive queries

**Episode Screens (4 files) - Estimated: 3-4 hours**
1. `EpisodeDetailScreen.tsx` - Most complex, uses 7 repositories
2. `LogUpdateScreen.tsx` - High usage frequency
3. `EditIntensityReadingScreen.tsx` - Simple refactor
4. `EditEpisodeNoteScreen.tsx` - Simple refactor

### Medium Priority

**Components (2 files) - Estimated: 1-2 hours**
1. `EpisodeStatistics.tsx` - Mixed store/repository usage
2. `EpisodeCard.tsx` - Direct intensity loading

### Low Priority (Document as Exceptions)

**Services (3 files) - Estimated: 30 minutes (documentation only)**
1. Document in architectural guidelines why these are exceptions
2. Add code comments explaining the exception
3. No refactoring needed

---

## Store Capability Gaps

The following repository methods are used directly by screens but NOT available in stores. These need to be added to stores before refactoring:

### MedicationStore Needs

```typescript
// Currently missing:
- getArchivedMedications(): Promise<Medication[]>
- getMedicationById(id: string): Promise<Medication | null>
- getDosesByMedicationId(medicationId: string, limit?: number): Promise<MedicationDose[]>
- getDoseById(id: string): Promise<MedicationDose | null>
- getSchedulesByMedicationId(medicationId: string): Promise<MedicationSchedule[]>
```

### EpisodeStore Needs

```typescript
// Currently missing:
- getEpisodeById(id: string): Promise<Episode | null>
- getIntensityReadingById(id: string): Promise<IntensityReading | null>
- getEpisodeNoteById(id: string): Promise<EpisodeNote | null>
- updateIntensityReading(id: string, updates: Partial<IntensityReading>): Promise<void>
- updateEpisodeNote(id: string, updates: Partial<EpisodeNote>): Promise<void>
- deleteIntensityReading(id: string): Promise<void>
- deleteEpisodeNote(id: string): Promise<void>
```

### DailyStatusStore Needs

```typescript
// Currently has getDateRange but EpisodeStatistics uses it directly
// Should use store consistently
```

---

## Breaking Changes

### None Expected

All refactoring can be done without breaking changes:
1. Stores already exist and are partially used
2. Adding new store methods is non-breaking
3. Screens can be refactored one at a time
4. Tests will catch any regressions

---

## Recommendations

### Immediate Actions

1. **Create Follow-up Issues** (1 hour)
   - Issue: "Add missing methods to MedicationStore"
   - Issue: "Add missing methods to EpisodeStore"
   - Issue: "Refactor medication screens to use stores"
   - Issue: "Refactor episode screens to use stores"
   - Issue: "Refactor components to use stores"

2. **Document Service Exceptions** (30 minutes)
   - Add comments to notification services
   - Add comments to backup service
   - Update architectural guidelines

3. **Add Store Methods** (2-3 hours)
   - Implement missing MedicationStore methods
   - Implement missing EpisodeStore methods
   - Add tests for new methods

4. **Refactor Screens** (6-9 hours total)
   - Start with highest priority (MedicationDetailScreen, EpisodeDetailScreen)
   - Do one screen at a time with full test coverage
   - Verify no regressions after each refactor

### Long-term Actions

1. **Add Linting Rule**
   - Create ESLint rule to prevent direct repository imports in screens/components
   - Allow repository imports only in stores, services, and tests

2. **Code Review Checklist**
   - Add item: "Does this screen/component use stores instead of repositories?"
   - Add item: "Are new repository methods added to stores?"

3. **Developer Documentation**
   - Update onboarding docs with data flow patterns
   - Create examples of correct store usage

---

## Appendix: Complete File List

### Screens with Direct Repository Access (12 files)

**Medication Screens (8):**
1. `src/screens/medication/LogMedicationScreen.tsx:16`
2. `src/screens/medication/MedicationsScreen.tsx:7`
3. `src/screens/medication/MedicationLogScreen.tsx:13`
4. `src/screens/medication/EditMedicationScreen.tsx:17`
5. `src/screens/medication/AddMedicationScreen.tsx:20`
6. `src/screens/medication/ArchivedMedicationsScreen.tsx:13`
7. `src/screens/medication/MedicationDetailScreen.tsx:22`
8. `src/screens/medication/EditMedicationDoseScreen.tsx:16`

**Episode Screens (4):**
1. `src/screens/episode/EpisodeDetailScreen.tsx:9`
2. `src/screens/episode/EditIntensityReadingScreen.tsx:15`
3. `src/screens/episode/EditEpisodeNoteScreen.tsx:16`
4. `src/screens/LogUpdateScreen.tsx:18`

### Components with Direct Repository Access (2 files)

1. `src/components/analytics/EpisodeStatistics.tsx:5`
2. `src/components/shared/EpisodeCard.tsx:7`

### Services with Direct Repository Access (3 files - LEGITIMATE)

1. `src/services/notifications/medicationNotifications.ts:5`
2. `src/services/notifications/notificationService.ts:5`
3. `src/services/backup/BackupExporter.ts:5-7`

### Store Files (4 files - CORRECT)

1. `src/store/episodeStore.ts:3`
2. `src/store/medicationStore.ts:4-5`
3. `src/store/dailyStatusStore.ts:3-4`
4. `src/store/analyticsStore.ts:18`

### Test Files (40 files - LEGITIMATE)

All test files in:
- `src/store/__tests__/` (7 files)
- `src/services/__tests__/` (10 files)
- `src/screens/__tests__/` (16 files)
- `src/components/__tests__/` (4 files)
- `src/__tests__/integration/` (3 files)
- `src/database/__tests__/` (3 files)
- `scripts/test-backup-restore.ts` (1 file)

---

## Total Summary

- **Total Files Analyzed:** 52
- **Violations (Need Refactoring):** 14 (12 screens + 2 components)
- **Legitimate Exceptions:** 3 services
- **Correct Usage:** 4 stores + 40 test files
- **Estimated Refactoring Effort:** 10-15 hours
- **Breaking Changes:** None
- **Priority:** High (impacts error handling and logging)
