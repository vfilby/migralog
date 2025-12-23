# Calendar Overlays Design Options

## Problem Statement

Users need the ability to add contextual overlays to the calendar view that span multiple days. Examples include:
- Illness periods (e.g., "cold - on constant medication")
- Vacation time
- Work trips
- Menstrual cycles
- Stressful periods
- Any user-defined context

This feature should help users identify correlations between life events and migraine patterns.

## Requirements

### Functional Requirements
1. Overlays must support multi-day date ranges (start date to end date)
2. Multiple overlays can exist on the same day(s)
3. Overlays should be categorized (illness, travel, stress, custom)
4. Users can add custom labels/notes to overlays
5. Overlays should be visually distinguishable from migraine status
6. Easy to create, edit, and delete overlays

### Non-Functional Requirements
1. Calendar must remain scannable and not overwhelming
2. Must be accessible (color-blind friendly, screen reader support)
3. Touch targets must be sufficient (minimum 44pt)
4. Must work well in both light and dark themes
5. Performance: calendar should load quickly even with many overlays

## Current Architecture

### Data Model
- Episodes stored with `startTime` and `endTime` (Unix timestamps)
- Daily status logs stored by date string (YYYY-MM-DD)
- Calendar already handles multi-day episode spans at data level

### UI Components
- `MonthlyCalendarView.tsx` - Main calendar grid (7-column layout)
- Individual day cells show date number + status indicator
- Theme-aware with ThemeContext

---

## Design Options

### Option A: Inline Bar Overlays (Horizontal Spans)

**Visual Concept:**
```
┌─────────────────────────────────────────────┐
│  Mon   Tue   Wed   Thu   Fri   Sat   Sun   │
├─────────────────────────────────────────────┤
│   1     2     3     4     5     6     7    │
│  ●     ●    ●     ●     ●                  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ "Sick - Cold"              │
├─────────────────────────────────────────────┤
│   8     9    10    11    12    13    14    │
│  ●     ●     ●     ●                       │
│  ░░░░░░░░░░░░░░░░░░░░░░ "Work Trip"        │
└─────────────────────────────────────────────┘
```

**Implementation:**
- Overlay bars render between day rows
- Bars span across multiple day columns
- Colors distinguish overlay types (with patterns for accessibility)
- Labels appear on the bar or as tooltip on tap

**Pros:**
- Clear visual connection between days in the same overlay
- Familiar pattern (similar to Gantt charts, project management tools)
- Doesn't obscure individual day data
- Can handle overlapping overlays by stacking bars

**Cons:**
- Increases row height when overlays present
- Complex layout calculations for cross-week spans
- May become cluttered with many overlays

**Technical Complexity:** Medium-High
- Requires custom layout calculations
- Must handle week boundaries
- Need to manage bar stacking

---

### Option B: Background Shading with Edge Markers

**Visual Concept:**
```
┌─────────────────────────────────────────────┐
│  Mon   Tue   Wed   Thu   Fri   Sat   Sun   │
├─────────────────────────────────────────────┤
│   1     2     3     4     5     6     7    │
│  ●    [●     ●     ●]    ●                 │
│       ████████████████                     │
│       "Cold"                               │
└─────────────────────────────────────────────┘

[ = start edge marker
] = end edge marker
████ = subtle background shading
```

**Implementation:**
- Subtle background color/pattern on overlay days
- Start and end days have special edge indicators (rounded corners, brackets)
- Tap on shaded area shows overlay details
- Multiple overlays use different shading patterns

**Pros:**
- Doesn't add vertical space
- Maintains clean calendar grid
- Edge markers make span boundaries clear
- Works well with existing day cell structure

**Cons:**
- Overlapping overlays harder to distinguish
- Shading may conflict with migraine status colors
- Limited to ~2-3 overlays per day before visual confusion

**Technical Complexity:** Medium
- Modify day cell styling based on overlay membership
- Calculate "position in span" (start/middle/end) for each day
- Handle multiple overlay intersection

---

### Option C: Icon Strip Below Date

**Visual Concept:**
```
┌─────────────────────────────────────────────┐
│  Mon   Tue   Wed   Thu   Fri   Sat   Sun   │
├─────────────────────────────────────────────┤
│   1     2     3     4     5     6     7    │
│   ●     ●     ●     ●     ●     ●     ●    │
│        💊    💊    💊    💊               │
│                          ✈️    ✈️    ✈️    │
└─────────────────────────────────────────────┘

💊 = Illness/medication
✈️ = Travel
```

**Implementation:**
- Small icon row below status indicator
- Icons represent overlay categories
- Tap icon to see overlay details
- Multiple icons can stack or scroll

**Pros:**
- Very compact representation
- Clear category identification
- Familiar iconography
- Each day is self-contained

**Cons:**
- No visual connection between days (each day independent)
- Limited icon space (2-3 max)
- Icons may be too small for touch
- Relies on users understanding icon meaning
- Note: Could use simple shapes/patterns instead of emojis per Issue #304

**Technical Complexity:** Low-Medium
- Add icon render area to day cells
- Category-to-icon mapping
- Handle overflow when many overlays

---

### Option D: Bottom Edge Indicator Strips

**Visual Concept:**
```
┌─────────────────────────────────────────────┐
│  Mon   Tue   Wed   Thu   Fri   Sat   Sun   │
├─────────────────────────────────────────────┤
│   1  │  2  │  3  │  4  │  5  │  6  │  7   │
│   ●  │  ●  │  ●  │  ●  │  ●  │  ●  │  ●   │
│──────┼──────────────────┼──────┼──────────│
│  ▓▓▓   ▓▓▓   ▓▓▓   ▓▓▓                     │
│                          ░░░   ░░░   ░░░   │
└─────────────────────────────────────────────┘

▓▓▓ = Illness overlay (spans days 1-4)
░░░ = Travel overlay (spans days 5-7)
```

**Implementation:**
- Thin colored strips at bottom of day cells
- Strips connect across days in the same overlay
- Different patterns/colors for different overlay types
- Vertical stacking for multiple overlays

**Pros:**
- Minimal space usage
- Clear visual spans
- Can show multiple overlays (2-4 strips)
- Non-intrusive

**Cons:**
- Very small touch targets
- May be hard to see
- Limited vertical space for many overlays
- Color differentiation critical

**Technical Complexity:** Medium
- Similar to Option B but focused on bottom edge
- Handle strip continuity across week boundaries

---

### Option E: Composite Day Indicator with Expandable Detail

**Visual Concept:**
```
Standard View:
┌──────┐
│  15  │
│  ●   │  ← Primary status (migraine)
│ ● ● │  ← Small dots for active overlays
└──────┘

Expanded View (on tap):
┌──────────────────────┐
│  December 15, 2024   │
│  Status: Green ●     │
│  ────────────────    │
│  📋 Sick: Cold       │
│     Dec 12-18        │
│  ✈️ Travel: Work     │
│     Dec 15-17        │
└──────────────────────┘
```

**Implementation:**
- Day cells show compact composite indicator
- Small dots/markers show overlay presence
- Tapping opens detail popover/modal
- Detail shows all overlays affecting that day

**Pros:**
- Keeps calendar compact
- Progressive disclosure (summary → detail)
- Handles unlimited overlays
- Detail view can show rich information

**Cons:**
- Requires user interaction to see overlay details
- Less scannable at a glance
- Two-step process to understand overlays
- May hide important correlation info

**Technical Complexity:** Low-Medium
- Overlay count/presence indicator simple
- Need modal/popover component
- Detail view list of overlays

---

## Recommended Approach: Simplified Overlay Line with Category Dots

After UX review, a simpler approach was selected that addresses mobile-first concerns:

### Design Principles
1. **Don't try to show everything** - Show "overlays exist" and drill down for details
2. **Single visual element for overlays** - One line, not multiple stripes
3. **Replace emoji status with colored circles** - Per Issue #304
4. **Progressive disclosure** - Summary on calendar, detail on tap

### Primary Calendar View

```
Standard Day Cell:
┌──────────────┐
│      15      │  ← Date (larger, more readable)
│      ●       │  ← Status indicator (colored circle, no emoji)
│   ━━━━━━━    │  ← Single overlay indicator line (if overlays exist)
│    ⬤ ⬤      │  ← Category dots (up to 3 unique categories)
└──────────────┘

Start of overlay period:
┌──────────────┐
│      15      │
│      ●       │
│  ╺━━━━━━━    │  ← Left cap indicates start
│    ⬤ ⬤      │
└──────────────┘

End of overlay period:
┌──────────────┐
│      17      │
│      ●       │
│   ━━━━━━━╸   │  ← Right cap indicates end
│    ⬤ ⬤      │
└──────────────┘

Continuous (middle of period):
┌──────────────┐
│      16      │
│      ●       │
│   ━━━━━━━    │  ← No caps, continuous
│    ⬤ ⬤      │
└──────────────┘
```

### Key Features

#### 1. Status Circle (Not Emoji)
- Large filled circle for migraine status (green/yellow/red)
- Solves Issue #304 (no emojis)
- Can add patterns for color blindness (solid, striped, dotted)
- Touch target is entire day cell

#### 2. Single Overlay Line
- One continuous line shows "overlays are active on this day"
- Start cap, end cap, or continuous based on position in span
- Grey/muted color - doesn't compete with status
- Simple to implement, easy week boundary handling

#### 3. Category Dots Below Line
- Small colored dots show unique overlay categories active
- Maximum 3 visible (deduplicated by category)
- If more than 3 categories: "+N" indicator
- Colors match category palette

#### 4. Detail Modal on Tap
- Full list of all overlays affecting the day
- Date ranges shown for each overlay
- Quick actions: "End today", "Edit", "Delete"
- "Add new overlay" button

### Why This Works Better

**Mobile-Optimized:**
- Maintains grid integrity
- Large touch targets (entire day cell)
- Minimal visual elements per cell
- Predictable, consistent layout

**Scannable:**
- Users quickly scan for overlay line presence
- Category dots give high-level sense of what's happening
- Don't need to decode multiple stripe colors

**Scalable:**
- Works with 1 overlay or 10 overlays
- Gracefully handles overlap
- Detail view shows complete information

**Accessible:**
- Status circles can use patterns
- High contrast line indicator
- Screen readers announce overlay summary
- Haptic feedback on interaction

### Data Model
```typescript
interface CalendarOverlay {
  id: string;
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  category: OverlayCategory;
  label: string;          // User-friendly name
  notes?: string;         // Optional detailed notes
  isActive: boolean;      // Soft delete without losing data
  createdAt: number;
  updatedAt: number;
}

type OverlayCategory =
  | 'illness'
  | 'travel'
  | 'stress'
  | 'menstrual'
  | 'weather'
  | 'medication'
  | 'custom';

// Predefined category colors (accessible palette)
const OVERLAY_CATEGORY_COLORS = {
  illness: '#FF9800',     // Orange
  travel: '#2196F3',      // Blue
  stress: '#9C27B0',      // Purple
  menstrual: '#E91E63',   // Pink
  weather: '#607D8B',     // Blue Gray
  medication: '#4CAF50',  // Green
  custom: '#795548',      // Brown
};
```

### Accessibility Considerations
1. Status circles with patterns (solid for green, horizontal lines for yellow, crosshatch for red)
2. Sufficient contrast ratios (WCAG AA)
3. Screen reader announces overlays with day
4. Haptic feedback on overlay interaction
5. Large touch targets (entire day cell is tappable)

---

## Component Architecture

Break calendar into composable pieces for maintainability:

```
MonthlyCalendarView.tsx
├── CalendarDayCell.tsx
│   ├── StatusIndicator.tsx (colored circle, replaces emoji)
│   ├── OverlayLineIndicator.tsx (the horizontal line)
│   └── OverlayCategoryDots.tsx (category dots below line)
├── DayDetailModal.tsx
│   ├── OverlayList.tsx
│   └── OverlayQuickActions.tsx
└── OverlayCreateModal.tsx
```

---

## Implementation Plan

### Phase 1: Data Layer (MVP)
1. Add `calendar_overlays` table to database schema
2. Create `CalendarOverlay` types in types.ts
3. Create `overlayRepository.ts` with CRUD operations
4. Add `overlayStore.ts` with Zustand
5. Add migration for new table

### Phase 2: Calendar UI Updates
1. Create `StatusIndicator` component (colored circle, replaces emoji)
2. Create `OverlayLineIndicator` component
3. Create `OverlayCategoryDots` component
4. Refactor `MonthlyCalendarView` to use new components
5. Update `dailyStatusStore` to load overlays for date range

### Phase 3: Overlay Management
1. Create `DayDetailModal` for viewing day overlays
2. Create `OverlayCreateModal` for adding new overlays
3. Add overlay edit/delete functionality
4. Integrate modals with calendar day tap

### Phase 4: Polish & Testing
1. Add haptic feedback
2. Accessibility testing (VoiceOver, patterns)
3. Performance optimization for many overlays
4. Unit tests for new components
5. E2E tests for overlay creation flow

---

## Questions for Review

1. Should overlays be synced across devices (future cloud sync)?
2. Maximum number of concurrent overlays to support?
3. Should overlays affect analytics calculations?
4. Do we need recurring overlays (e.g., weekly patterns)?
5. Integration with notification system?
