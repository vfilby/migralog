# Store vs Repository Architectural Guidelines

**Last Updated:** 2025-12-07  
**Related Issue:** #271  
**Purpose:** Define when to use stores vs repositories and establish clear data flow patterns

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Data Flow Architecture](#data-flow-architecture)
3. [When to Use Stores](#when-to-use-stores)
4. [When to Use Repositories](#when-to-use-repositories)
5. [Legitimate Exceptions](#legitimate-exceptions)
6. [Store Responsibilities](#store-responsibilities)
7. [Repository Responsibilities](#repository-responsibilities)
8. [Code Examples](#code-examples)
9. [Testing Guidelines](#testing-guidelines)
10. [Common Pitfalls](#common-pitfalls)

---

## Core Principles

### The Golden Rule

**Components and Screens should NEVER import repositories directly. Always use stores.**

```typescript
// ❌ WRONG - Component importing repository directly
import { medicationRepository } from '../../database/medicationRepository';

// ✅ CORRECT - Component using store
import { useMedicationStore } from '../../store/medicationStore';
```

### Why This Matters

1. **Centralized Error Handling** - Stores provide consistent error handling and logging
2. **State Synchronization** - Store state stays in sync with database state
3. **Logging and Monitoring** - All operations logged through stores for debugging and Sentry
4. **Testing** - Easier to mock stores than repositories in component tests
5. **Architectural Clarity** - Clear separation of concerns

---

## Data Flow Architecture

### The Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                   │
│  (Components, Screens, UI Logic)                        │
│                                                          │
│  - React components                                     │
│  - Screen components                                    │
│  - UI-specific logic                                    │
│  - Event handlers                                       │
│                                                          │
│  RULE: Must use Stores, never Repositories              │
└─────────────────────────────────────────────────────────┘
                          ↓ ↑
                    Uses / Updates
                          ↓ ↑
┌─────────────────────────────────────────────────────────┐
│                      BUSINESS LAYER                      │
│  (Stores, State Management, Business Logic)             │
│                                                          │
│  - Zustand stores (episodeStore, medicationStore, etc) │
│  - State management                                     │
│  - Business logic                                       │
│  - Error handling                                       │
│  - Logging                                              │
│  - Caching                                              │
│                                                          │
│  RULE: Uses Repositories for data access                │
└─────────────────────────────────────────────────────────┘
                          ↓ ↑
                    Reads / Writes
                          ↓ ↑
┌─────────────────────────────────────────────────────────┐
│                       DATA LAYER                         │
│  (Repositories, Database Access)                        │
│                                                          │
│  - Repository modules (episodeRepository, etc)          │
│  - SQLite database operations                           │
│  - Data validation                                      │
│  - SQL queries                                          │
│  - Transaction management                               │
│                                                          │
│  RULE: No business logic, only data operations          │
└─────────────────────────────────────────────────────────┘
                          ↓ ↑
                          ↓ ↑
┌─────────────────────────────────────────────────────────┐
│                    DATABASE (SQLite)                     │
└─────────────────────────────────────────────────────────┘
```

### Data Flow Examples

#### Reading Data
```
Screen → Store.loadData() → Repository.getAll() → Database → Repository → Store.setState() → Screen renders
```

#### Writing Data
```
Screen → Store.create() → Repository.create() → Database → Repository → Store.setState() → Screen updates
```

---

## When to Use Stores

### ✅ ALWAYS use stores in:

1. **React Components**
   - All functional components
   - All class components (if any)
   - Custom hooks that access data

2. **Screen Components**
   - Navigation screens
   - Modal screens
   - Tab screens

3. **When you need:**
   - UI state (loading, error states)
   - Reactive updates (re-render on data change)
   - Error handling and user feedback
   - Operation logging
   - Data caching

### Store Usage Pattern

```typescript
// In a screen component
import { useMedicationStore } from '../../store/medicationStore';

function MedicationScreen() {
  // ✅ Get data and actions from store
  const { 
    medications, 
    loading, 
    error,
    loadMedications,
    addMedication 
  } = useMedicationStore();

  useEffect(() => {
    // ✅ Load data through store
    loadMedications();
  }, []);

  const handleAdd = async (data) => {
    try {
      // ✅ Create data through store
      await addMedication(data);
    } catch (error) {
      // Store handles error logging and user feedback
    }
  };

  // Component automatically re-renders when store state changes
  return <View>...</View>;
}
```

---

## When to Use Repositories

### ✅ ONLY use repositories directly in:

1. **Store Implementations**
   - Store action implementations
   - Store initialization

2. **Background Services** (with justification)
   - Notification handlers (app may be backgrounded)
   - Background sync services
   - System-level services

3. **Utility Services** (with justification)
   - Backup/export (needs complete DB access)
   - Data migration (operates outside normal app flow)
   - Database utilities

4. **Tests**
   - Unit tests
   - Integration tests
   - Test setup and teardown

### Repository Usage Pattern (Store Implementation)

```typescript
// In a store file (episodeStore.ts)
import { episodeRepository } from '../database/episodeRepository';
import { errorLogger } from '../services/errorLogger';
import { toastService } from '../services/toastService';

export const useEpisodeStore = create<EpisodeState>((set, get) => ({
  episodes: [],
  loading: false,
  error: null,

  loadEpisodes: async () => {
    set({ loading: true, error: null });
    try {
      // ✅ Repository access is correct here (in store)
      const episodes = await episodeRepository.getAll();
      set({ episodes, loading: false });
    } catch (error) {
      // ✅ Centralized error handling
      await errorLogger.log('database', 'Failed to load episodes', error);
      toastService.error('Failed to load episodes');
      set({ error: error.message, loading: false });
    }
  },

  addEpisode: async (data) => {
    set({ loading: true, error: null });
    try {
      // ✅ Repository access is correct here (in store)
      const newEpisode = await episodeRepository.create(data);
      set({ 
        episodes: [...get().episodes, newEpisode],
        loading: false 
      });
      return newEpisode;
    } catch (error) {
      // ✅ Centralized error handling
      await errorLogger.log('database', 'Failed to create episode', error);
      toastService.error('Failed to create episode');
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));
```

---

## Legitimate Exceptions

Some services need direct repository access. These must be:
1. Documented with code comments
2. Listed in this guide
3. Justified with clear reasoning

### Exception 1: Notification Services

**Files:**
- `src/services/notifications/medicationNotifications.ts`
- `src/services/notifications/notificationService.ts`

**Justification:**
- Notification handlers run in background when app may be suspended
- Cannot rely on store state (stores may be unloaded)
- Need direct database access to handle notification actions
- Examples: "Take Now" button, "Snooze" button

**Code Comment Required:**
```typescript
// ARCHITECTURAL EXCEPTION: Notification handlers need direct repository access
// because they run in background when the app may be suspended and stores
// may not be initialized. See docs/store-repository-guidelines.md
import { medicationRepository } from '../../database/medicationRepository';
```

### Exception 2: Backup/Export Service

**Files:**
- `src/services/backup/BackupExporter.ts`

**Justification:**
- Exports complete database independent of UI state
- Needs access to ALL data, including archived/deleted items
- Operates outside normal app data flow
- May export data not currently loaded in stores

**Code Comment Required:**
```typescript
// ARCHITECTURAL EXCEPTION: Backup service needs direct repository access
// to export complete database including archived items and data not loaded
// in stores. See docs/store-repository-guidelines.md
import { episodeRepository } from '../../database/episodeRepository';
```

### Exception 3: Test Files

**Justification:**
- Tests need to verify database state directly
- Tests need to setup test data
- Tests need to mock repository behavior
- This is standard testing practice

**No special comments required in test files.**

---

## Store Responsibilities

### What Stores SHOULD Do

1. **Provide State to UI**
   ```typescript
   const { medications, loading, error } = useMedicationStore();
   ```

2. **Manage Loading States**
   ```typescript
   set({ loading: true });
   // ... perform operation
   set({ loading: false });
   ```

3. **Handle Errors**
   ```typescript
   try {
     await repository.create(data);
   } catch (error) {
     await errorLogger.log('database', 'Operation failed', error);
     toastService.error('User-friendly message');
     set({ error: error.message });
     throw error; // Re-throw for caller
   }
   ```

4. **Log Operations**
   ```typescript
   logger.log('[Store] Creating medication:', data);
   const result = await medicationRepository.create(data);
   logger.log('[Store] Medication created:', result.id);
   ```

5. **Maintain State Consistency**
   ```typescript
   // After creating, update state
   set({ medications: [...get().medications, newMedication] });
   
   // After updating, update state
   set({ 
     medications: get().medications.map(m => 
       m.id === id ? { ...m, ...updates } : m
     )
   });
   
   // After deleting, update state
   set({ 
     medications: get().medications.filter(m => m.id !== id)
   });
   ```

6. **Implement Caching**
   ```typescript
   loadMedications: async () => {
     // Check cache first
     const cached = cacheManager.get('medications');
     if (cached) {
       set({ medications: cached, loading: false });
       return;
     }
     
     // Load from database
     const data = await medicationRepository.getAll();
     cacheManager.set('medications', data);
     set({ medications: data });
   }
   ```

### What Stores SHOULD NOT Do

1. **UI Logic** - Keep in components
2. **Navigation** - Use navigation service/hooks
3. **Complex Calculations** - Use utility functions
4. **Direct DOM/Native Access** - Keep in components

---

## Repository Responsibilities

### What Repositories SHOULD Do

1. **Database Operations**
   ```typescript
   async getAll(): Promise<Medication[]> {
     const db = await getDatabase();
     const result = await db.getAllAsync('SELECT * FROM medications');
     return result.map(row => this.mapRowToMedication(row));
   }
   ```

2. **Data Validation** (database-level)
   ```typescript
   async create(data: CreateMedicationInput): Promise<Medication> {
     // Validate required fields
     if (!data.name) throw new Error('Name is required');
     
     // Insert into database
     const result = await db.runAsync(
       'INSERT INTO medications (name, ...) VALUES (?, ...)',
       data.name, ...
     );
     
     return this.getById(result.lastInsertRowId);
   }
   ```

3. **Transaction Management**
   ```typescript
   async deleteWithRelated(id: string): Promise<void> {
     await withTransaction(async (db) => {
       await db.runAsync('DELETE FROM doses WHERE medication_id = ?', id);
       await db.runAsync('DELETE FROM schedules WHERE medication_id = ?', id);
       await db.runAsync('DELETE FROM medications WHERE id = ?', id);
     });
   }
   ```

4. **Data Mapping** (DB rows ↔ App models)
   ```typescript
   private mapRowToMedication(row: DatabaseRow): Medication {
     return {
       id: row.id,
       name: row.name,
       createdAt: row.created_at,
       // ... map all fields
     };
   }
   ```

### What Repositories SHOULD NOT Do

1. **Business Logic** - Keep in stores
2. **Error Logging to Sentry** - Keep in stores
3. **User Feedback (toasts)** - Keep in stores
4. **State Management** - Keep in stores
5. **UI Concerns** - Keep in components

---

## Code Examples

### ❌ WRONG - Screen Using Repository Directly

```typescript
// LogMedicationScreen.tsx - WRONG!
import { medicationRepository } from '../../database/medicationRepository';

function LogMedicationScreen({ route }: Props) {
  const [medication, setMedication] = useState(null);
  
  useEffect(() => {
    // ❌ Direct repository access from screen
    const loadMedication = async () => {
      const med = await medicationRepository.getById(route.params.medicationId);
      setMedication(med);
    };
    loadMedication();
  }, []);
  
  const handleLog = async (data) => {
    // ❌ Direct repository access from screen
    // No error handling, logging, or state updates!
    await medicationDoseRepository.create(data);
    navigation.goBack();
  };
  
  return <View>...</View>;
}
```

### ✅ CORRECT - Screen Using Store

```typescript
// LogMedicationScreen.tsx - CORRECT!
import { useMedicationStore } from '../../store/medicationStore';

function LogMedicationScreen({ route }: Props) {
  const { 
    medications, 
    loading,
    error,
    loadMedications, 
    logDose 
  } = useMedicationStore();
  
  // Find medication from store state
  const medication = medications.find(m => m.id === route.params.medicationId);
  
  useEffect(() => {
    // ✅ Load through store
    loadMedications();
  }, []);
  
  const handleLog = async (data) => {
    try {
      // ✅ Log through store
      // Store handles: error logging, user feedback, state updates
      await logDose(data);
      navigation.goBack();
    } catch (error) {
      // Store already logged error and showed toast
      // Just handle UI state if needed
    }
  };
  
  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;
  if (!medication) return <NotFoundView />;
  
  return <View>...</View>;
}
```

### ✅ CORRECT - Store Implementation

```typescript
// medicationStore.ts - CORRECT!
import { create } from 'zustand';
import { medicationRepository, medicationDoseRepository } from '../database/medicationRepository';
import { errorLogger } from '../services/errorLogger';
import { toastService } from '../services/toastService';
import { logger } from '../utils/logger';

export const useMedicationStore = create<MedicationState>((set, get) => ({
  medications: [],
  doses: [],
  loading: false,
  error: null,

  loadMedications: async () => {
    set({ loading: true, error: null });
    try {
      logger.log('[Store] Loading medications');
      
      // ✅ Repository access is correct in stores
      const medications = await medicationRepository.getActive();
      
      set({ medications, loading: false });
      logger.log('[Store] Loaded medications:', medications.length);
    } catch (error) {
      // ✅ Centralized error handling
      await errorLogger.log('database', 'Failed to load medications', error);
      toastService.error('Failed to load medications');
      set({ error: error.message, loading: false });
    }
  },

  logDose: async (dose) => {
    set({ loading: true, error: null });
    try {
      logger.log('[Store] Logging dose:', dose);
      
      // ✅ Repository access is correct in stores
      const newDose = await medicationDoseRepository.create(dose);
      
      // ✅ Update state
      set({ 
        doses: [newDose, ...get().doses],
        loading: false 
      });
      
      logger.log('[Store] Dose logged:', newDose.id);
      toastService.success('Medication logged');
      
      return newDose;
    } catch (error) {
      // ✅ Centralized error handling
      await errorLogger.log('database', 'Failed to log dose', error);
      toastService.error('Failed to log medication');
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));
```

---

## Testing Guidelines

### Testing Components

```typescript
// Component test - Mock the store, not the repository
import { useMedicationStore } from '../../store/medicationStore';

jest.mock('../../store/medicationStore');

describe('LogMedicationScreen', () => {
  it('should load medications on mount', () => {
    const mockLoadMedications = jest.fn();
    (useMedicationStore as jest.Mock).mockReturnValue({
      medications: [],
      loading: false,
      loadMedications: mockLoadMedications,
    });
    
    render(<LogMedicationScreen />);
    
    expect(mockLoadMedications).toHaveBeenCalled();
  });
});
```

### Testing Stores

```typescript
// Store test - Mock the repository
import { medicationRepository } from '../../database/medicationRepository';
import { useMedicationStore } from '../medicationStore';

jest.mock('../../database/medicationRepository');

describe('MedicationStore', () => {
  it('should load medications', async () => {
    const mockMedications = [{ id: '1', name: 'Test' }];
    (medicationRepository.getActive as jest.Mock).mockResolvedValue(mockMedications);
    
    const store = useMedicationStore.getState();
    await store.loadMedications();
    
    expect(store.medications).toEqual(mockMedications);
  });
});
```

### Testing Repositories

```typescript
// Repository test - Use actual database (test DB)
import { medicationRepository } from '../medicationRepository';
import { setupTestDatabase, cleanupTestDatabase } from '../../utils/testUtils';

describe('MedicationRepository', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });
  
  afterEach(async () => {
    await cleanupTestDatabase();
  });
  
  it('should create medication', async () => {
    const medication = await medicationRepository.create({
      name: 'Test Med',
      type: 'rescue',
    });
    
    expect(medication.id).toBeDefined();
    expect(medication.name).toBe('Test Med');
  });
});
```

---

## Common Pitfalls

### ❌ Pitfall 1: Direct Repository in useEffect

```typescript
// ❌ WRONG
useEffect(() => {
  const load = async () => {
    const data = await medicationRepository.getAll(); // WRONG!
    setMedications(data);
  };
  load();
}, []);

// ✅ CORRECT
const { medications, loadMedications } = useMedicationStore();
useEffect(() => {
  loadMedications(); // CORRECT!
}, []);
```

### ❌ Pitfall 2: Creating Without Updating Store

```typescript
// ❌ WRONG - Store state becomes stale
const handleCreate = async (data) => {
  await medicationRepository.create(data); // WRONG!
  // Store doesn't know about the new medication!
};

// ✅ CORRECT - Store state stays in sync
const { addMedication } = useMedicationStore();
const handleCreate = async (data) => {
  await addMedication(data); // CORRECT!
  // Store automatically updates state
};
```

### ❌ Pitfall 3: No Error Handling

```typescript
// ❌ WRONG - No error handling or user feedback
const handleDelete = async (id) => {
  await medicationRepository.delete(id); // WRONG!
  // If this fails, user has no idea!
};

// ✅ CORRECT - Store handles errors
const { deleteMedication } = useMedicationStore();
const handleDelete = async (id) => {
  try {
    await deleteMedication(id); // CORRECT!
    // Store logs to Sentry and shows error toast if needed
  } catch (error) {
    // Handle UI state if needed
  }
};
```

### ❌ Pitfall 4: Mixing Store and Repository

```typescript
// ❌ WRONG - Inconsistent data access
const { episodes } = useEpisodeStore(); // From store
const statuses = await dailyStatusRepository.getAll(); // Direct repository! WRONG!

// ✅ CORRECT - Consistent data access
const { episodes } = useEpisodeStore();
const { dailyStatuses } = useDailyStatusStore(); // CORRECT!
```

---

## Quick Reference Checklist

Before writing data access code, ask:

1. ☐ Am I in a component or screen?
   - **YES** → Use store
   - **NO** → Continue to question 2

2. ☐ Am I in a store implementation?
   - **YES** → Use repository
   - **NO** → Continue to question 3

3. ☐ Am I in a background service (notifications, sync)?
   - **YES** → Document exception, use repository
   - **NO** → Continue to question 4

4. ☐ Am I in a utility service (backup, migration)?
   - **YES** → Document exception, use repository
   - **NO** → Continue to question 5

5. ☐ Am I in a test file?
   - **YES** → Use repository directly (OK in tests)
   - **NO** → **You should probably use a store!**

---

## Enforcement

### Code Review

Reviewers should check:
- [ ] Components/screens don't import repositories
- [ ] Store methods include error handling
- [ ] Store methods update state after DB operations
- [ ] Repository direct access has justification comment (if not in store/test)

### Future: ESLint Rule

Consider adding ESLint rule:
```javascript
// .eslintrc.js
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/database/*Repository'],
        message: 'Do not import repositories directly. Use stores instead. See docs/store-repository-guidelines.md',
        // Allow in stores and tests
        allowTypeImports: true,
      }]
    }]
  }
}
```

---

## Summary

### The Rules

1. **Components/Screens** → Always use stores
2. **Stores** → Use repositories
3. **Services** → Only with documented exceptions
4. **Tests** → Can use repositories directly

### The Benefits

1. ✅ Centralized error handling
2. ✅ Consistent logging
3. ✅ Synchronized state
4. ✅ Better testing
5. ✅ Clear architecture

### When in Doubt

**Ask yourself: "Is this a UI component or business logic?"**
- **UI component** → Use store
- **Business logic** → You're in a store, use repository
- **Still unsure** → Default to using a store

---

## Related Documentation

- [Store Repository Audit](./store-repository-audit.md) - Complete audit of current codebase
- [State Management](../../docs/state-management.md) - Overview of state management
- [Error Handling Patterns](./error-handling-patterns.md) - Error handling best practices
- [Testing Guide](../../docs/wiki/Testing-Guide.md) - Testing patterns and practices

---

**Questions or exceptions not covered here?**  
Open an issue or ask in code review.
