# State Management Architecture

This document defines the state management patterns for MigraLog and provides guidance on when to use each approach.

## Architecture Overview

MigraLog uses **Zustand** for global state management with a clear separation between:
- **Store State**: Shared data that persists across screens
- **Local State**: UI-specific ephemeral state

## Core Principles

### 1. Single Source of Truth
- All persistent data lives in Zustand stores
- Stores wrap repository (database) calls
- No duplicate state between stores and components

### 2. Computed Values via Selectors
- Use store selectors for derived/computed data
- Selectors automatically recompute when dependencies change
- Never maintain computed values in local state

### 3. Clear State Ownership
- **Store State**: Domain data, API responses, cached data
- **Local State**: Form inputs, UI toggles, temporary selections

## State Categories

### Store State (Zustand)
Use Zustand stores for:
- ✅ Data from database/API
- ✅ Data shared across multiple screens
- ✅ Data that survives navigation
- ✅ Computed data derived from store state

**Examples:**
```typescript
// Episodes, medications, daily status
const { currentEpisode, episodes } = useEpisodeStore();
const { medications, schedules, doses } = useMedicationStore();

// Computed data via selectors
const todaysMedications = useMedicationStore(state => state.getTodaysMedications());
```

### Local State (useState)
Use local state for:
- ✅ Form field values (before submission)
- ✅ UI-only state (modals, dropdowns, loading indicators)
- ✅ Temporary selections (before confirmation)
- ✅ Screen-specific UI state

**Examples:**
```typescript
const [isModalVisible, setIsModalVisible] = useState(false);
const [selectedDate, setSelectedDate] = useState(new Date());
const [searchQuery, setSearchQuery] = useState('');
```

## Zustand Store Pattern

### Basic Store Structure

```typescript
interface ExampleState {
  // Data
  items: Item[];
  loading: boolean;
  error: string | null;

  // Actions (async operations that update state)
  loadItems: () => Promise<void>;
  addItem: (item: Omit<Item, 'id'>) => Promise<Item>;
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

  // Selectors (computed properties)
  getActiveItems: () => Item[];
  getItemById: (id: string) => Item | undefined;
}

export const useExampleStore = create<ExampleState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  loadItems: async () => {
    set({ loading: true, error: null });
    try {
      const items = await repository.getAll();
      set({ items, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  addItem: async (item) => {
    try {
      const newItem = await repository.create(item);
      set({ items: [...get().items, newItem] });
      return newItem;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Selectors return computed data from current state
  getActiveItems: () => {
    return get().items.filter(item => item.active);
  },

  getItemById: (id: string) => {
    return get().items.find(item => item.id === id);
  },
}));
```

### Using Selectors in Components

```typescript
function MyComponent() {
  // ❌ DON'T: Call store methods directly during render
  // const activeItems = useExampleStore().getActiveItems();

  // ✅ DO: Use Zustand selector to subscribe to computed values
  const activeItems = useExampleStore(state => state.getActiveItems());

  // ✅ DO: Extract actions separately (they're stable references)
  const { loadItems, addItem } = useExampleStore();

  // Component logic...
}
```

## Data Flow Patterns

### Pattern 1: Load and Display
```typescript
function DataScreen() {
  const { items, loadItems } = useExampleStore();

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  return (
    <View>
      {items.map(item => <ItemCard key={item.id} item={item} />)}
    </View>
  );
}
```

### Pattern 2: Computed Data
```typescript
function DashboardScreen() {
  // ❌ DON'T: Maintain computed state locally
  // const [todaysMeds, setTodaysMeds] = useState([]);
  // useEffect(() => {
  //   const computed = computeTodaysMeds(medications, doses);
  //   setTodaysMeds(computed);
  // }, [medications, doses]);

  // ✅ DO: Use store selector
  const todaysMeds = useMedicationStore(state => state.getTodaysMedications());

  return <View>{/* Render todaysMeds */}</View>;
}
```

### Pattern 3: User Actions
```typescript
function ItemForm() {
  // Local state for form inputs (ephemeral, UI-only)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Store action for persisting data
  const { addItem } = useExampleStore();

  const handleSubmit = async () => {
    // Save to store (and database)
    await addItem({ name, description });

    // Clear local form state
    setName('');
    setDescription('');

    // UI updates automatically via store subscription
  };

  return (
    <View>
      <TextInput value={name} onChangeText={setName} />
      <TextInput value={description} onChangeText={setDescription} />
      <Button onPress={handleSubmit} title="Submit" />
    </View>
  );
}
```

## Anti-Patterns to Avoid

### ❌ DON'T: Duplicate Store Data in Local State
```typescript
// BAD: Creating a copy of store data
const { medications } = useMedicationStore();
const [localMeds, setLocalMeds] = useState(medications);

useEffect(() => {
  setLocalMeds(medications);
}, [medications]);
```

**Why?** This creates synchronization issues and bugs.

**Solution:** Use store data directly or via selectors.

### ❌ DON'T: Mix Database Calls with Local State
```typescript
// BAD: Bypassing the store
const [items, setItems] = useState([]);

useEffect(() => {
  repository.getAll().then(setItems);
}, []);
```

**Why?** Creates multiple sources of truth and inconsistent state.

**Solution:** Always use store actions for data operations.

### ❌ DON'T: Store Computed Values
```typescript
// BAD: Storing derived data in the store
interface BadState {
  medications: Medication[];
  activeMedications: Medication[]; // ❌ Redundant!
}
```

**Why?** Creates redundancy and synchronization problems.

**Solution:** Use selectors to compute values on demand.

## Migration Guide

When refactoring components with mixed state patterns:

1. **Identify State Types**
   - Mark which state is domain data (→ store)
   - Mark which state is UI-only (→ local)

2. **Move Domain Data to Store**
   - Add state properties to store interface
   - Add actions for CRUD operations
   - Add selectors for computed data

3. **Update Component**
   - Replace local useState with store hooks
   - Replace useEffect data loading with useFocusEffect
   - Use store selectors for computed values

4. **Test**
   - Verify data loads correctly
   - Verify UI updates on store changes
   - Verify no stale data issues

## Example: DashboardScreen Refactoring

### Before (Anti-pattern)
```typescript
function DashboardScreen() {
  const { medications, schedules, doses } = useMedicationStore();
  const [todaysMeds, setTodaysMeds] = useState([]);

  const loadTodaysMeds = () => {
    const computed = computeTodaysMeds(medications, schedules, doses);
    setTodaysMeds(computed);
  };

  useEffect(() => {
    loadTodaysMeds();
  }, [medications, schedules, doses]);

  const handleTakeMed = async (item) => {
    await logDose(item);
    // Manually update local state
    setTodaysMeds(prev => prev.map(m =>
      m.id === item.id ? { ...m, taken: true } : m
    ));
  };

  return <View>{/* Render todaysMeds */}</View>;
}
```

**Problems:**
- Duplicate state (store + local)
- Manual synchronization needed
- Complex update logic
- Prone to bugs

### After (Correct pattern)
```typescript
function DashboardScreen() {
  const { logDose } = useMedicationStore();

  // Computed data via selector - automatically updates
  const todaysMeds = useMedicationStore(state => state.getTodaysMedications());

  const handleTakeMed = async (item) => {
    await logDose(item);
    // UI automatically updates via selector
  };

  return <View>{/* Render todaysMeds */}</View>;
}
```

**Benefits:**
- Single source of truth
- Automatic UI updates
- Simpler code
- No synchronization bugs

## Testing Patterns

### Testing Components with Store State
```typescript
// Mock the store with test data
jest.mock('../store/exampleStore');

const mockStore = {
  items: [mockItem1, mockItem2],
  getActiveItems: () => [mockItem1],
  loadItems: jest.fn(),
};

(useExampleStore as jest.Mock).mockReturnValue(mockStore);

// Test component behavior
test('displays active items', () => {
  render(<MyComponent />);
  expect(screen.getByText(mockItem1.name)).toBeInTheDocument();
});
```

## Summary

**DO:**
- ✅ Use Zustand for domain/shared data
- ✅ Use local state for UI-only state
- ✅ Use selectors for computed values
- ✅ Keep stores as single source of truth

**DON'T:**
- ❌ Duplicate store data in local state
- ❌ Store computed values in state
- ❌ Mix direct DB calls with store state
- ❌ Create multiple sources of truth

Following these patterns ensures:
- Predictable state updates
- Easier debugging
- Better testability
- Fewer bugs
- Consistent codebase
