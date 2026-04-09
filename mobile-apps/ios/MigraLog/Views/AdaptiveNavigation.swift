import SwiftUI

/// Top-level navigation container that adapts between iPad (sidebar) and iPhone (tab bar).
struct AdaptiveNavigation: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selectedSection: NavigationSection = .dashboard
    @State private var selectedEpisodeId: String?
    @State private var selectedMedicationId: String?
    @State private var analyticsViewModel = AnalyticsViewModel()
    @State private var showAddOverlay = false
    @State private var editingOverlay: CalendarOverlay?

    /// Whether the selected section uses a three-column layout (sidebar + list + detail)
    private var usesThreeColumnLayout: Bool {
        switch selectedSection {
        case .episodes, .medications, .trends:
            return true
        case .dashboard, .settings:
            return false
        }
    }

    var body: some View {
        if sizeClass == .regular {
            iPadNavigation
        } else {
            iPhoneNavigation
        }
    }

    // MARK: - iPad Navigation

    private var iPadNavigation: some View {
        Group {
            if usesThreeColumnLayout {
                iPadThreeColumnNavigation
            } else {
                iPadTwoColumnNavigation
            }
        }
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
    }

    // MARK: - Two-Column: Sidebar + Detail (Dashboard, Settings)

    private var iPadTwoColumnNavigation: some View {
        NavigationSplitView {
            SidebarView(selection: $selectedSection)
        } detail: {
            NavigationStack {
                switch selectedSection {
                case .dashboard:
                    DashboardScreen()
                case .settings:
                    SettingsScreen()
                default:
                    EmptyView()
                }
            }
        }
    }

    // MARK: - Three-Column: Sidebar + List + Detail (Episodes, Medications, Trends)

    private var iPadThreeColumnNavigation: some View {
        NavigationSplitView {
            SidebarView(selection: $selectedSection)
        } content: {
            switch selectedSection {
            case .episodes:
                EpisodesListColumn(selectedEpisodeId: $selectedEpisodeId)
            case .medications:
                MedicationsListColumn(selectedMedicationId: $selectedMedicationId)
            case .trends:
                AnalyticsControlsColumn(
                    viewModel: analyticsViewModel,
                    onAddOverlay: { showAddOverlay = true },
                    onEditOverlay: { editingOverlay = $0 }
                )
            default:
                EmptyView()
            }
        } detail: {
            NavigationStack {
                switch selectedSection {
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
                    if let medicationId = selectedMedicationId {
                        MedicationDetailScreen(medicationId: medicationId)
                    } else {
                        ContentUnavailableView(
                            "No Medication Selected",
                            systemImage: "pills",
                            description: Text("Select a medication to view details.")
                        )
                    }
                case .trends:
                    AnalyticsVisualizationPane(viewModel: analyticsViewModel)
                default:
                    EmptyView()
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
        List {
            Section {
                sidebarButton(.dashboard, label: "Dashboard", icon: "house")
                sidebarButton(.episodes, label: "Episodes", icon: "bolt.heart")
                sidebarButton(.medications, label: "Medications", icon: "pills")
                sidebarButton(.trends, label: "Trends", icon: "chart.bar")
            }

            Section {
                sidebarButton(.settings, label: "Settings", icon: "gearshape")
            }
        }
        .navigationTitle("MigraLog")
        .listStyle(.sidebar)
    }

    private func sidebarButton(_ section: NavigationSection, label: String, icon: String) -> some View {
        Button {
            selection = section
        } label: {
            Label(label, systemImage: icon)
        }
        .listRowBackground(selection == section ? Color.accentColor.opacity(0.2) : nil)
        .foregroundStyle(selection == section ? Color.accentColor : .primary)
    }
}
