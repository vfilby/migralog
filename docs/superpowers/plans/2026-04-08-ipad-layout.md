# iPad Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add iPad-optimized layouts using NavigationSplitView with a sidebar, three-column splits for list-detail screens, and a two-column grid dashboard, while preserving the existing iPhone experience unchanged.

**Architecture:** On iPad (regular horizontal size class), replace the TabView with a NavigationSplitView featuring a sidebar. Episodes and Medications use three-column layout (sidebar | list | detail). Dashboard uses a two-column card grid. Trends splits controls into a narrow column with visualizations in the wide pane. On iPhone (compact), the existing TabView remains pixel-identical.

**Tech Stack:** SwiftUI (NavigationSplitView, horizontalSizeClass, LazyVGrid), iOS 17+

**Spec:** `docs/superpowers/specs/2026-04-08-ipad-layout-design.md`

---

### Task 1: Add iPad to Supported Device Families

The app currently targets iPhone only. We need to add iPad as a supported device family in the project configuration.

**Files:**
- Modify: `mobile-apps/ios/project.yml:20-35`
- Modify: `mobile-apps/ios/MigraLog/App/Info.plist`

- [ ] **Step 1: Update project.yml to support iPad**

Add `TARGETED_DEVICE_FAMILY` to the MigraLog target settings. Value `"1,2"` means iPhone + iPad.

In `mobile-apps/ios/project.yml`, add this line under `targets.MigraLog.settings.base`:

```yaml
        TARGETED_DEVICE_FAMILY: "1,2"
```

So the settings block becomes:

```yaml
    settings:
      base:
        INFOPLIST_FILE: MigraLog/App/Info.plist
        PRODUCT_BUNDLE_IDENTIFIER: com.migralog.app
        MARKETING_VERSION: "1.0.0"
        CURRENT_PROJECT_VERSION: "1"
        DEVELOPMENT_TEAM: ""
        CODE_SIGN_STYLE: Automatic
        ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
        GENERATE_INFOPLIST_FILE: false
        SWIFT_STRICT_CONCURRENCY: complete
        TARGETED_DEVICE_FAMILY: "1,2"
```

- [ ] **Step 2: Update Info.plist to support all iPad orientations**

In `mobile-apps/ios/MigraLog/App/Info.plist`, add the `UISupportedInterfaceOrientations~ipad` key with all four orientations. Read the file first to find the exact location, then add after the existing `UISupportedInterfaceOrientations` array:

```xml
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationPortraitUpsideDown</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

- [ ] **Step 3: Regenerate Xcode project**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodegen generate`

Expected: "Generated project MigraLog.xcodeproj" or similar success message.

- [ ] **Step 4: Commit**

```bash
cd /Users/vfilby/Projects/MigraineTracker
git add mobile-apps/ios/project.yml mobile-apps/ios/MigraLog/App/Info.plist
git commit -m "feat(ios): add iPad as supported device family"
```

---

### Task 2: Create AdaptiveNavigation — Sidebar + TabView Switch

This is the core structural change. Create a new view that renders `NavigationSplitView` with a sidebar on iPad and the existing `TabView` on iPhone, then wire it into `ContentView`.

**Files:**
- Create: `mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift`
- Modify: `mobile-apps/ios/MigraLog/App/ContentView.swift`

- [ ] **Step 1: Create AdaptiveNavigation.swift**

Create file at `mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift`:

```swift
import SwiftUI

/// Top-level navigation container that adapts between iPad (sidebar) and iPhone (tab bar).
struct AdaptiveNavigation: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selectedSection: NavigationSection = .dashboard
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        if sizeClass == .regular {
            iPadNavigation
        } else {
            iPhoneNavigation
        }
    }

    // MARK: - iPad: Sidebar + Content

    private var iPadNavigation: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(selection: $selectedSection)
        } detail: {
            NavigationStack {
                switch selectedSection {
                case .dashboard:
                    DashboardScreen()
                case .episodes:
                    EpisodesScreen()
                case .medications:
                    MedicationsScreen()
                case .trends:
                    AnalyticsScreen()
                case .settings:
                    SettingsScreen()
                }
            }
        }
    }

    // MARK: - iPhone: Tab Bar (existing behavior)

    private var iPhoneNavigation: some View {
        TabView(selection: $selectedSection) {
            NavigationStack {
                DashboardScreen()
            }
            .tabItem {
                Label("Dashboard", systemImage: "house")
            }
            .tag(NavigationSection.dashboard)

            NavigationStack {
                EpisodesScreen()
            }
            .tabItem {
                Label("Episodes", systemImage: "bolt.heart")
            }
            .tag(NavigationSection.episodes)

            NavigationStack {
                MedicationsScreen()
            }
            .tabItem {
                Label("Medications", systemImage: "pills")
            }
            .tag(NavigationSection.medications)

            NavigationStack {
                AnalyticsScreen()
            }
            .tabItem {
                Label("Trends", systemImage: "chart.bar")
            }
            .tag(NavigationSection.trends)
        }
    }
}

// MARK: - Navigation Section Enum

enum NavigationSection: Hashable {
    case dashboard
    case episodes
    case medications
    case trends
    case settings
}

// MARK: - Sidebar View

struct SidebarView: View {
    @Binding var selection: NavigationSection

    var body: some View {
        List(selection: $selection) {
            Section {
                Label("Dashboard", systemImage: "house")
                    .tag(NavigationSection.dashboard)
                Label("Episodes", systemImage: "bolt.heart")
                    .tag(NavigationSection.episodes)
                Label("Medications", systemImage: "pills")
                    .tag(NavigationSection.medications)
                Label("Trends", systemImage: "chart.bar")
                    .tag(NavigationSection.trends)
            }

            Section {
                Label("Settings", systemImage: "gearshape")
                    .tag(NavigationSection.settings)
            }
        }
        .navigationTitle("MigraLog")
        .listStyle(.sidebar)
    }
}
```

- [ ] **Step 2: Update ContentView.swift to use AdaptiveNavigation**

Replace `MainTabView()` reference in `ContentView` and remove the old `MainTabView` struct. Edit `mobile-apps/ios/MigraLog/App/ContentView.swift`:

Replace the entire file contents with:

```swift
import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if DatabaseManager.initializationError != nil {
                DatabaseErrorView()
            } else if appState.isLoading {
                ProgressView("Loading...")
            } else if !appState.isOnboardingComplete {
                WelcomeScreen()
            } else {
                AdaptiveNavigation()
            }
        }
    }
}
```

The `MainTabView` struct is no longer needed — its functionality is now in `AdaptiveNavigation.iPhoneNavigation`. Delete the `MainTabView` struct and its `Tab` enum from the file.

- [ ] **Step 3: Build and verify on iPhone simulator**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' 2>&1 | tail -5`

Expected: `BUILD SUCCEEDED`

- [ ] **Step 4: Build and verify on iPad simulator**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4),OS=26.0' 2>&1 | tail -5`

Expected: `BUILD SUCCEEDED`

- [ ] **Step 5: Commit**

```bash
cd /Users/vfilby/Projects/MigraineTracker
git add mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift mobile-apps/ios/MigraLog/App/ContentView.swift
git commit -m "feat(ios): add adaptive navigation with iPad sidebar"
```

---

### Task 3: Episodes Three-Column Split on iPad

Convert the Episodes section to use a three-column layout on iPad: sidebar | episode list | episode detail. The existing `EpisodesScreen` becomes the list column, and `EpisodeDetailScreen` renders in the detail column based on selection.

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift:30-35`
- Modify: `mobile-apps/ios/MigraLog/Views/Episodes/EpisodesScreen.swift`

- [ ] **Step 1: Add selectedEpisodeId state to AdaptiveNavigation**

In `mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift`, add a new `@State` property after `columnVisibility`:

```swift
    @State private var selectedEpisodeId: String?
```

- [ ] **Step 2: Update the episodes case in iPadNavigation to use three-column split**

In the `iPadNavigation` computed property, replace the `.episodes` case in the switch statement. The entire `iPadNavigation` property becomes:

```swift
    private var iPadNavigation: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(selection: $selectedSection)
        } content: {
            switch selectedSection {
            case .episodes:
                EpisodesListColumn(selectedEpisodeId: $selectedEpisodeId)
            case .medications:
                MedicationsScreen()
            default:
                Text("")
                    .hidden()
            }
        } detail: {
            NavigationStack {
                switch selectedSection {
                case .dashboard:
                    DashboardScreen()
                case .episodes:
                    if let episodeId = selectedEpisodeId {
                        EpisodeDetailScreen(episodeId: episodeId)
                    } else {
                        ContentUnavailableView(
                            "No Episode Selected",
                            systemImage: "bolt.heart",
                            description: Text("Select an episode to view details.")
                        )
                    }
                case .medications:
                    ContentUnavailableView(
                        "No Medication Selected",
                        systemImage: "pills",
                        description: Text("Select a medication to view details.")
                    )
                case .trends:
                    AnalyticsScreen()
                case .settings:
                    SettingsScreen()
                }
            }
        }
    }
```

Note: This switches from a two-column (`sidebar` + `detail`) to a three-column (`sidebar` + `content` + `detail`) `NavigationSplitView`. The `content` column shows lists for sections that have them (Episodes, Medications), and hides for others (Dashboard, Trends, Settings) where the detail column shows the full content.

- [ ] **Step 3: Create EpisodesListColumn — a selection-based variant of the episodes list**

Add a new view at the bottom of `mobile-apps/ios/MigraLog/Views/Episodes/EpisodesScreen.swift`:

```swift
/// Episodes list adapted for the iPad content column.
/// Uses selection binding instead of NavigationLink destination push.
struct EpisodesListColumn: View {
    @Binding var selectedEpisodeId: String?
    @State private var viewModel = EpisodesListViewModel()

    var body: some View {
        Group {
            if viewModel.episodes.isEmpty && !viewModel.isLoading {
                ContentUnavailableView(
                    "No Episodes",
                    systemImage: "bolt.heart",
                    description: Text("Start tracking your first migraine episode from the Dashboard.")
                )
            } else {
                List(viewModel.episodes, selection: $selectedEpisodeId) { episode in
                    EpisodeCardView(
                        episode: episode,
                        readings: viewModel.readingsMap[episode.id] ?? []
                    )
                    .tag(episode.id)
                    .listRowInsets(EdgeInsets(top: 4, leading: 8, bottom: 4, trailing: 8))
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Episodes")
        .task {
            await viewModel.loadEpisodes()
        }
    }
}
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4),OS=26.0' 2>&1 | tail -5`

Expected: `BUILD SUCCEEDED`

- [ ] **Step 5: Commit**

```bash
cd /Users/vfilby/Projects/MigraineTracker
git add mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift mobile-apps/ios/MigraLog/Views/Episodes/EpisodesScreen.swift
git commit -m "feat(ios): add three-column episodes split on iPad"
```

---

### Task 4: Medications Three-Column Split on iPad

Same pattern as Episodes — the Medications section gets a selection-based list column on iPad.

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift`
- Modify: `mobile-apps/ios/MigraLog/Views/Medications/MedicationsScreen.swift`

- [ ] **Step 1: Add selectedMedicationId state to AdaptiveNavigation**

In `mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift`, add after `selectedEpisodeId`:

```swift
    @State private var selectedMedicationId: String?
```

- [ ] **Step 2: Update the medications case in the content and detail columns**

In the `content` column switch, replace the `.medications` case:

```swift
            case .medications:
                MedicationsListColumn(selectedMedicationId: $selectedMedicationId)
```

In the `detail` column switch, replace the `.medications` case:

```swift
                case .medications:
                    if let medicationId = selectedMedicationId {
                        MedicationDetailScreen(medicationId: medicationId)
                    } else {
                        ContentUnavailableView(
                            "No Medication Selected",
                            systemImage: "pills",
                            description: Text("Select a medication to view details.")
                        )
                    }
```

- [ ] **Step 3: Create MedicationsListColumn**

Add a new view at the bottom of `mobile-apps/ios/MigraLog/Views/Medications/MedicationsScreen.swift`:

```swift
/// Medications list adapted for the iPad content column.
/// Uses selection binding instead of NavigationLink destination push.
struct MedicationsListColumn: View {
    @Binding var selectedMedicationId: String?
    @State private var viewModel = MedicationsListViewModel()

    var body: some View {
        List(selection: $selectedMedicationId) {
            if !viewModel.preventativeMedications.isEmpty {
                Section("Preventative") {
                    ForEach(viewModel.preventativeMedications) { med in
                        MedicationRowView(medication: med)
                            .tag(med.id)
                    }
                }
            }

            if !viewModel.rescueMedications.isEmpty {
                Section("Rescue") {
                    ForEach(viewModel.rescueMedications) { med in
                        MedicationRowView(medication: med)
                            .tag(med.id)
                    }
                }
            }

            if !viewModel.otherMedications.isEmpty {
                Section("Other") {
                    ForEach(viewModel.otherMedications) { med in
                        MedicationRowView(medication: med)
                            .tag(med.id)
                    }
                }
            }

            Section {
                NavigationLink {
                    ArchivedMedicationsScreen()
                } label: {
                    Text("Archived")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Medications")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    AddMedicationScreen()
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .overlay {
            if viewModel.preventativeMedications.isEmpty &&
                viewModel.rescueMedications.isEmpty &&
                viewModel.otherMedications.isEmpty &&
                !viewModel.isLoading {
                ContentUnavailableView(
                    "No Medications",
                    systemImage: "pills",
                    description: Text("Add your first medication using the + button.")
                )
            }
        }
        .task {
            await viewModel.loadMedications()
        }
        .onReceive(NotificationCenter.default.publisher(for: .medicationDataChanged)) { _ in
            Task { await viewModel.loadMedications() }
        }
    }
}
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4),OS=26.0' 2>&1 | tail -5`

Expected: `BUILD SUCCEEDED`

- [ ] **Step 5: Commit**

```bash
cd /Users/vfilby/Projects/MigraineTracker
git add mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift mobile-apps/ios/MigraLog/Views/Medications/MedicationsScreen.swift
git commit -m "feat(ios): add three-column medications split on iPad"
```

---

### Task 5: Dashboard Two-Column Grid on iPad

Adapt the Dashboard to use a two-column card grid on iPad while keeping the single-column stack on iPhone.

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Views/Dashboard/DashboardScreen.swift`

- [ ] **Step 1: Add horizontalSizeClass to DashboardScreen**

In `mobile-apps/ios/MigraLog/Views/Dashboard/DashboardScreen.swift`, add after the existing `@State` properties:

```swift
    @Environment(\.horizontalSizeClass) private var sizeClass
```

- [ ] **Step 2: Replace the VStack body with adaptive layout**

Replace the `ScrollView` content (the `VStack(spacing: 16)` block inside `ScrollView`) with a layout that adapts based on size class:

```swift
        ScrollView {
            if sizeClass == .regular {
                iPadDashboardLayout
            } else {
                iPhoneDashboardLayout
            }
        }
```

Then add two computed properties to `DashboardScreen`:

```swift
    // MARK: - iPhone Layout (existing single-column)

    private var iPhoneDashboardLayout: some View {
        VStack(spacing: 16) {
            TodaysMedicationsCard(viewModel: viewModel)
            DailyStatusWidgetView(viewModel: viewModel)
            HStack(spacing: 12) {
                startEpisodeButton
                logMedicationButton
            }
            RecentEpisodesCard(viewModel: viewModel)
        }
        .padding()
    }

    // MARK: - iPad Layout (two-column grid)

    private var iPadDashboardLayout: some View {
        VStack(spacing: 16) {
            // Row 1: Medications + Daily Status side by side
            HStack(alignment: .top, spacing: 16) {
                TodaysMedicationsCard(viewModel: viewModel)
                    .frame(maxWidth: .infinity)
                DailyStatusWidgetView(viewModel: viewModel)
                    .frame(maxWidth: .infinity)
            }

            // Row 2: Action buttons full width
            HStack(spacing: 12) {
                startEpisodeButton
                logMedicationButton
            }

            // Row 3: Recent episodes full width
            RecentEpisodesCard(viewModel: viewModel)
        }
        .padding()
    }
```

- [ ] **Step 3: Extract the action buttons into computed properties**

The Start Episode and Log Medication buttons are now referenced from two layouts. Extract them as computed properties on `DashboardScreen` (add after `iPadDashboardLayout`):

```swift
    private var startEpisodeButton: some View {
        Button {
            viewModel.showNewEpisode = true
        } label: {
            Label("Start Episode", systemImage: "plus.circle.fill")
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .accessibilityIdentifier("start-episode-button")
        .accessibilityHint("Start tracking a new migraine episode")
    }

    private var logMedicationButton: some View {
        Button {
            viewModel.showLogMedication = true
        } label: {
            Label("Log Medication", systemImage: "pills.circle.fill")
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.blue.opacity(0.1))
                .foregroundStyle(.blue)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .accessibilityIdentifier("log-medication-button")
    }
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4),OS=26.0' 2>&1 | tail -5`

Expected: `BUILD SUCCEEDED`

- [ ] **Step 5: Commit**

```bash
cd /Users/vfilby/Projects/MigraineTracker
git add mobile-apps/ios/MigraLog/Views/Dashboard/DashboardScreen.swift
git commit -m "feat(ios): add two-column dashboard grid on iPad"
```

---

### Task 6: Trends Split — Controls Column + Visualization Pane

Split the Analytics screen so controls/stats go in the narrow content column and calendar/charts fill the wide detail pane on iPad.

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Views/Analytics/AnalyticsScreen.swift`
- Modify: `mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift`

- [ ] **Step 1: Extract AnalyticsControlsColumn from AnalyticsScreen**

Add a new view at the bottom of `mobile-apps/ios/MigraLog/Views/Analytics/AnalyticsScreen.swift`:

```swift
/// Controls and statistics for the iPad narrow column.
struct AnalyticsControlsColumn: View {
    @Bindable var viewModel: AnalyticsViewModel
    var onAddOverlay: () -> Void
    var onEditOverlay: (CalendarOverlay) -> Void

    var body: some View {
        List {
            Section("Time Range") {
                TimeRangeSelectorView(viewModel: viewModel)
            }

            Section("Day Statistics") {
                DayStatisticsContent(viewModel: viewModel)
            }

            Section("Episodes") {
                EpisodeStatisticsContent(viewModel: viewModel)
            }

            Section("Duration") {
                DurationMetricsContent(viewModel: viewModel)
            }

            Section("Rescue Medication Usage") {
                MedicationUsageContent(viewModel: viewModel)
            }

            Section("Overlays") {
                OverlayListContent(
                    overlays: viewModel.calendarOverlays,
                    onAdd: onAddOverlay,
                    onEdit: onEditOverlay
                )
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Trends")
    }
}

// MARK: - Inline content views for list sections

/// Day statistics content without card wrapper (for use in List sections).
private struct DayStatisticsContent: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        HStack {
            StatRow(label: "Migraine", value: "\(viewModel.migraineDays)", color: .red)
            Spacer()
            StatRow(label: "Not-clear", value: "\(viewModel.notClearDays)", color: .yellow)
            Spacer()
            StatRow(label: "Clear", value: "\(viewModel.clearDays)", color: .green)
            Spacer()
            StatRow(label: "Unknown", value: "\(viewModel.unknownDays)", color: .gray)
        }
    }
}

private struct EpisodeStatisticsContent: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        if viewModel.episodes.isEmpty {
            Text("No episodes in selected period")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } else {
            LabeledContent("Total") {
                Text("\(viewModel.episodes.count)")
            }
        }
    }
}

private struct DurationMetricsContent: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        let durations = viewModel.episodes.compactMap { $0.durationMillis }
        if durations.isEmpty {
            Text("No data")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } else {
            LabeledContent("Shortest") {
                Text(DateFormatting.formatDuration(milliseconds: durations.min() ?? 0))
            }
            LabeledContent("Longest") {
                Text(DateFormatting.formatDuration(milliseconds: durations.max() ?? 0))
            }
            LabeledContent("Average") {
                let avg = durations.reduce(0, +) / Int64(durations.count)
                Text(DateFormatting.formatDuration(milliseconds: avg))
            }
        }
    }
}

private struct MedicationUsageContent: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        if viewModel.rescueDoses.isEmpty {
            Text("No rescue medication usage in selected period")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } else {
            ForEach(viewModel.medicationUsageSummary, id: \.name) { usage in
                LabeledContent(usage.name) {
                    Text("\(usage.count) doses")
                }
            }
        }
    }
}

private struct OverlayListContent: View {
    let overlays: [CalendarOverlay]
    var onAdd: () -> Void
    var onEdit: (CalendarOverlay) -> Void

    var body: some View {
        Button { onAdd() } label: {
            Label("Add Overlay", systemImage: "plus.circle")
        }

        ForEach(overlays) { overlay in
            Button { onEdit(overlay) } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(overlay.label)
                        .font(.subheadline.weight(.medium))
                    Text("\(overlay.startDate) — \(overlay.endDate ?? "Ongoing")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
        }
    }
}

/// Calendar and visualizations for the iPad wide pane.
struct AnalyticsVisualizationPane: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                MonthlyCalendarView(viewModel: viewModel)
                // Future visualizations go here:
                // trend lines, pattern detection, multi-month comparisons
            }
            .padding()
        }
        .navigationTitle("Visualizations")
    }
}
```

- [ ] **Step 2: Update AdaptiveNavigation to use the trends split**

In `mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift`, add state for Trends overlay sheets after the medication state:

```swift
    @State private var analyticsViewModel = AnalyticsViewModel()
    @State private var showAddOverlay = false
    @State private var editingOverlay: CalendarOverlay?
```

Update the `.trends` case in the `content` column:

```swift
            case .trends:
                AnalyticsControlsColumn(
                    viewModel: analyticsViewModel,
                    onAddOverlay: { showAddOverlay = true },
                    onEditOverlay: { editingOverlay = $0 }
                )
```

Update the `.trends` case in the `detail` column:

```swift
                case .trends:
                    AnalyticsVisualizationPane(viewModel: analyticsViewModel)
```

Add the overlay sheet modifiers to the `iPadNavigation` view (after the closing brace of `NavigationSplitView`):

```swift
        .sheet(isPresented: $showAddOverlay, onDismiss: { Task { await analyticsViewModel.loadCalendarData(for: Date()) } }) {
            NavigationStack {
                OverlayFormSheet { overlay in
                    Task { await analyticsViewModel.saveOverlay(overlay) }
                }
            }
        }
        .sheet(item: $editingOverlay, onDismiss: { Task { await analyticsViewModel.loadCalendarData(for: Date()) } }) { overlay in
            NavigationStack {
                OverlayFormSheet(overlay: overlay, onSave: { updated in
                    Task { await analyticsViewModel.saveOverlay(updated) }
                }, onDelete: { id in
                    Task { await analyticsViewModel.deleteOverlay(id) }
                })
            }
        }
        .task {
            if selectedSection == .trends {
                await analyticsViewModel.fetchData()
            }
        }
```

Also update the `content` column `default` case to show the Dashboard and Settings in the detail column only (no content column needed):

```swift
            default:
                // Dashboard and Settings don't use a content column
                EmptyView()
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4),OS=26.0' 2>&1 | tail -5`

Expected: `BUILD SUCCEEDED`

- [ ] **Step 4: Commit**

```bash
cd /Users/vfilby/Projects/MigraineTracker
git add mobile-apps/ios/MigraLog/Views/Analytics/AnalyticsScreen.swift mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift
git commit -m "feat(ios): add trends split with controls column and visualization pane"
```

---

### Task 7: Run All Tests and Verify iPhone Regression

Verify the existing test suites still pass to confirm zero iPhone regression.

**Files:**
- No file changes — verification only

- [ ] **Step 1: Run unit tests**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild test -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' -only-testing:MigraLogTests 2>&1 | grep -E "Executed.*tests" | tail -1`

Expected: `Executed 684 tests, with 0 failures` (or similar — all pass, zero failures)

- [ ] **Step 2: Run UI tests on iPhone**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild test -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' -only-testing:MigraLogUITests 2>&1 | grep -E "Executed.*tests" | tail -1`

Expected: `Executed 41 tests, with 0 failures` (or similar — all pass, zero failures)

If any tests fail, investigate and fix before proceeding. The iPad layout changes should not affect iPhone behavior.

- [ ] **Step 3: Build for iPad simulator**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4),OS=26.0' 2>&1 | tail -5`

Expected: `BUILD SUCCEEDED`

---

### Task 8: Clear Content Column for Non-List Sections

When Dashboard or Settings is selected, the three-column NavigationSplitView still shows the content column. We need to ensure those sections display properly without a visible list column. This task handles the edge cases in navigation behavior.

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift`

- [ ] **Step 1: Auto-adjust column visibility based on selected section**

Add an `.onChange` modifier to the `iPadNavigation` view to automatically adjust column visibility when the selected section changes. Sections with lists (Episodes, Medications, Trends) should show all three columns. Sections without (Dashboard, Settings) should hide the content column.

Add this modifier after the sheet modifiers on the NavigationSplitView:

```swift
        .onChange(of: selectedSection) { _, newValue in
            switch newValue {
            case .episodes, .medications, .trends:
                columnVisibility = .all
            case .dashboard, .settings:
                columnVisibility = .detailOnly
            }
        }
```

- [ ] **Step 2: Set initial column visibility**

Update the initial value of `columnVisibility` to `.detailOnly` since Dashboard is the default section and doesn't use a content column:

```swift
    @State private var columnVisibility: NavigationSplitViewVisibility = .detailOnly
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4),OS=26.0' 2>&1 | tail -5`

Expected: `BUILD SUCCEEDED`

- [ ] **Step 4: Commit**

```bash
cd /Users/vfilby/Projects/MigraineTracker
git add mobile-apps/ios/MigraLog/Views/AdaptiveNavigation.swift
git commit -m "feat(ios): auto-adjust column visibility based on selected section"
```

---

### Task 9: Remove Settings Toolbar Button on iPad

On iPad, Settings is in the sidebar, so the gear icon in the Dashboard toolbar is redundant. Hide it when in regular size class.

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Views/Dashboard/DashboardScreen.swift`

- [ ] **Step 1: Conditionally hide the settings toolbar button**

The `sizeClass` environment variable was already added in Task 5. Wrap the toolbar settings button with a size class check. Replace the `.toolbar` modifier on the ScrollView:

```swift
        .toolbar {
            if sizeClass != .regular {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        SettingsScreen()
                    } label: {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityIdentifier("settings-button")
                    .accessibilityLabel("Settings")
                    .accessibilityHint("Open application settings")
                }
            }
        }
```

- [ ] **Step 2: Build and verify**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4),OS=26.0' 2>&1 | tail -5`

Expected: `BUILD SUCCEEDED`

- [ ] **Step 3: Commit**

```bash
cd /Users/vfilby/Projects/MigraineTracker
git add mobile-apps/ios/MigraLog/Views/Dashboard/DashboardScreen.swift
git commit -m "feat(ios): hide settings toolbar button on iPad (available in sidebar)"
```

---

### Task 10: Final Verification and Cleanup

Run the full test suite one more time and verify the build on both platforms.

**Files:**
- No file changes — verification only

- [ ] **Step 1: Run unit tests**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild test -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' -only-testing:MigraLogTests 2>&1 | grep -E "Executed.*tests" | tail -1`

Expected: All tests pass, zero failures.

- [ ] **Step 2: Run UI tests on iPhone**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild test -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' -only-testing:MigraLogUITests 2>&1 | grep -E "Executed.*tests" | tail -1`

Expected: All tests pass, zero failures.

- [ ] **Step 3: Build for iPad**

Run: `cd /Users/vfilby/Projects/MigraineTracker/mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4),OS=26.0' 2>&1 | tail -5`

Expected: `BUILD SUCCEEDED`

- [ ] **Step 4: Verify .gitignore includes .superpowers/**

Check if `.superpowers/` is in `.gitignore`. If not, add it:

```bash
cd /Users/vfilby/Projects/MigraineTracker
grep -q '.superpowers/' .gitignore 2>/dev/null || echo '.superpowers/' >> .gitignore
git add .gitignore && git diff --cached --quiet || git commit -m "chore: add .superpowers to gitignore"
```
