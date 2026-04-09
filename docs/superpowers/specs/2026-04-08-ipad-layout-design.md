# iPad Layout Design — Hybrid Sidebar + Split View

## Summary

Add iPad-optimized layouts to MigraLog using SwiftUI's `NavigationSplitView`. The app gains a sidebar for top-level navigation and adapts each section's content pane based on its nature. On iPhone, everything collapses back to the current tab bar + stack navigation with zero changes to the existing experience.

## Architecture

### Navigation Strategy

- **iPad**: `NavigationSplitView` with a persistent sidebar replaces the tab bar. Sections that have list-detail flows (Episodes, Medications) use three-column layout. Sections without lists (Dashboard, Trends) use two-column layout.
- **iPhone**: `NavigationSplitView` automatically collapses. The sidebar items map to the existing tab bar. All current navigation behavior is preserved.

The key structural change is in `ContentView.swift` / `MainTabView`. The current `TabView` wrapping four `NavigationStack` views becomes a `NavigationSplitView` on iPad, with a sidebar enum driving which content is shown. On iPhone, the `TabView` remains as-is. This is achieved by checking `horizontalSizeClass` and rendering the appropriate container.

### Sidebar

The sidebar contains five items:
1. Dashboard (house icon)
2. Episodes (bolt.heart icon)
3. Medications (pills icon)
4. Trends (chart.bar icon)
5. Settings (gear icon) — at the bottom

Settings moves from a toolbar button on the Dashboard into the sidebar as a first-class navigation item on iPad.

## Section Layouts

### Dashboard (Two-Column: Sidebar | Content)

The dashboard is not a list-detail view — it's a hub with widgets. On iPad, the content pane uses a 2-column CSS grid-style layout:

- **Row 1**: Today's Medications card | Daily Status ("How was yesterday?") card — side by side
- **Row 2**: Action buttons (Start Episode + Log Medication) — full width
- **Row 3**: Recent Episodes card — full width

Implementation: Wrap the existing `DashboardScreen` content in a `ViewThatFits` or `horizontalSizeClass` check. On regular width, use a `LazyVGrid` with two flexible columns for the top cards, single column for action buttons and recent episodes. On compact width, keep the current single-column `ScrollView`.

### Episodes (Three-Column: Sidebar | List | Detail)

The Episodes tab is a natural fit for three-column split:

- **Column 1**: Sidebar (shared across all sections)
- **Column 2**: Episode list (`EpisodesScreen` content — the scrollable list of `EpisodeCardView` items)
- **Column 3**: Episode detail (`EpisodeDetailScreen` — summary, timeline, action buttons)

When no episode is selected, the detail pane shows an empty state: centered icon + "Select an episode to view details" text.

Implementation: The existing `EpisodesScreen` already uses `NavigationLink` to push `EpisodeDetailScreen`. Converting to `NavigationSplitView` means changing the `NavigationLink` to set a `selectedEpisodeId` binding, and the detail column renders `EpisodeDetailScreen(episodeId:)` based on that selection.

### Medications (Three-Column: Sidebar | List | Detail)

Same pattern as Episodes:

- **Column 2**: Medication list (`MedicationsScreen` — grouped by type: Preventative, Rescue, Other, plus Archived link)
- **Column 3**: Medication detail (`MedicationDetailScreen` — info, schedules, recent doses, archive button)

Empty state when no medication is selected.

Implementation: Same approach as Episodes — `selectedMedicationId` binding drives the detail column.

### Trends (Two-Column: Sidebar | Controls + Visualization)

The Trends tab uses a two-column layout where the content pane itself is split:

- **Column 2 (narrow, ~280pt)**: Controls and summary stats — time range selector, day statistics, episode stats, duration metrics, medication usage, overlay management
- **Column 3 (wide, flex)**: Visualization canvas — monthly calendar, charts, and future data visualizations (trend lines, pattern detection, multi-month comparisons)

This gives the visualization pane maximum horizontal space for charts and graphs, which is the primary value of the iPad layout for this section.

Implementation: The current `AnalyticsScreen` is a single `ScrollView` with all content stacked. For iPad, split the content: controls/stats go into the list column, calendar/charts go into the detail column. The `AnalyticsViewModel` is shared between both columns. On iPhone, everything stays in a single scroll view as it is today.

### Settings (Two-Column: Sidebar | Content)

Settings uses a simple two-column layout:

- **Column 2**: Settings list (the current `SettingsScreen` content)

When a settings sub-page is selected (Notifications, Location, Data, Developer), it pushes within the content column via `NavigationStack`. No third column needed — settings doesn't benefit from a persistent list.

## Implementation Approach

### Key Files to Modify

1. **`ContentView.swift`** — The main structural change. Add `horizontalSizeClass` check. On `.regular`, render `NavigationSplitView` with sidebar. On `.compact`, render the existing `TabView`.

2. **`EpisodesScreen.swift`** — Extract the list content so it can be used as a list column in the split view. The `NavigationLink` destinations change to selection bindings on iPad.

3. **`MedicationsScreen.swift`** — Same extraction as Episodes.

4. **`DashboardScreen.swift`** — Add a `horizontalSizeClass` check to switch between single-column and two-column grid layout for the widget cards.

5. **`AnalyticsScreen.swift`** — Split into two sub-views: `AnalyticsControlsView` (stats, controls, overlays) and `AnalyticsVisualizationView` (calendar, charts). On iPhone, both render in a single scroll view. On iPad, they go into separate columns.

### New Files

1. **`AdaptiveNavigation.swift`** (or similar) — A wrapper view that handles the `TabView` vs `NavigationSplitView` switch based on size class. Contains the sidebar definition and the selected-section state.

### What Does NOT Change

- All existing View files continue to work — they are composed into the new layout, not rewritten
- All ViewModels are untouched
- All Repositories, Services, Models are untouched
- iPhone layout is pixel-identical to current behavior
- Sheet/modal presentations remain the same
- All existing navigation within screens (context menus, toolbar buttons, etc.) is preserved

## Testing

- Test on iPad simulator (various sizes: iPad mini, iPad Pro 11", iPad Pro 12.9")
- Test on iPhone simulator to confirm zero regression
- Test split-screen multitasking on iPad (compact width should collapse to phone layout)
- Test rotation (portrait/landscape) on iPad
- Verify all existing UI tests still pass on iPhone
