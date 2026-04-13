import SwiftUI

/// Top-level navigation using a tab bar on all devices.
/// On iPad, list-detail tabs use NavigationSplitView internally for two-column layout.
struct AdaptiveNavigation: View {
    @Binding var selectedTab: TabSection

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                DashboardScreen()
            }
            .tabItem {
                Label("Dashboard", systemImage: "house")
            }
            .tag(TabSection.dashboard)

            EpisodesTab()
                .tabItem {
                    Label("Episodes", systemImage: "bolt.heart")
                }
                .tag(TabSection.episodes)

            MedicationsTab()
                .tabItem {
                    Label("Medications", systemImage: "pills")
                }
                .tag(TabSection.medications)

            TrendsTab()
                .tabItem {
                    Label("Trends", systemImage: "chart.bar")
                }
                .tag(TabSection.trends)
        }
    }
}

// MARK: - Tab Section Enum

enum TabSection: Hashable {
    case dashboard
    case episodes
    case medications
    case trends
}

// MARK: - Episodes Tab (two-column on iPad, stack on iPhone)

struct EpisodesTab: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selectedEpisodeId: String?

    var body: some View {
        if sizeClass == .regular {
            NavigationSplitView {
                EpisodesListColumn(selectedEpisodeId: $selectedEpisodeId)
            } detail: {
                if let episodeId = selectedEpisodeId {
                    EpisodeDetailScreen(episodeId: episodeId)
                } else {
                    ContentUnavailableView(
                        "No Episode Selected",
                        systemImage: "bolt.heart",
                        description: Text("Select an episode to view details.")
                    )
                }
            }
        } else {
            NavigationStack {
                EpisodesScreen()
            }
        }
    }
}

// MARK: - Medications Tab (two-column on iPad, stack on iPhone)

struct MedicationsTab: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selectedMedicationId: String?

    var body: some View {
        if sizeClass == .regular {
            NavigationSplitView {
                MedicationsListColumn(selectedMedicationId: $selectedMedicationId)
            } detail: {
                if let medicationId = selectedMedicationId {
                    MedicationDetailScreen(medicationId: medicationId)
                } else {
                    ContentUnavailableView(
                        "No Medication Selected",
                        systemImage: "pills",
                        description: Text("Select a medication to view details.")
                    )
                }
            }
        } else {
            NavigationStack {
                MedicationsScreen()
            }
        }
    }
}

// MARK: - Trends Tab (two-column on iPad, stack on iPhone)

struct TrendsTab: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var viewModel = AnalyticsViewModel()
    @State private var showAddOverlay = false
    @State private var editingOverlay: CalendarOverlay?

    var body: some View {
        Group {
            if sizeClass == .regular {
                NavigationSplitView {
                    AnalyticsControlsColumn(
                        viewModel: viewModel,
                        onAddOverlay: { showAddOverlay = true },
                        onEditOverlay: { editingOverlay = $0 }
                    )
                } detail: {
                    AnalyticsVisualizationPane(viewModel: viewModel)
                }
            } else {
                NavigationStack {
                    AnalyticsScreen()
                }
            }
        }
        .sheet(isPresented: $showAddOverlay, onDismiss: { Task { await viewModel.loadCalendarData(for: Date()) } }) {
            NavigationStack {
                OverlayFormSheet { overlay in
                    Task { await viewModel.saveOverlay(overlay) }
                }
            }
        }
        .sheet(item: $editingOverlay, onDismiss: { Task { await viewModel.loadCalendarData(for: Date()) } }) { overlay in
            NavigationStack {
                OverlayFormSheet(overlay: overlay, onSave: { updated in
                    Task { await viewModel.saveOverlay(updated) }
                }, onDelete: { id in
                    Task { await viewModel.deleteOverlay(id) }
                })
            }
        }
    }
}
