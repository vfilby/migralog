import SwiftUI

struct SettingsScreen: View {
    @Environment(AppState.self) private var appState
    @AppStorage("developerModeEnabled") private var developerModeEnabled = false

    var body: some View {
        List {
            // Theme Section
            Section("Appearance") {
                ThemeSectionView()
            }

            // Notifications
            Section("Notifications") {
                NavigationLink {
                    NotificationSettingsScreen()
                } label: {
                    Label("Notifications", systemImage: "bell")
                }
                .accessibilityIdentifier("notification-settings")

                NavigationLink {
                    LiveActivitiesScreen()
                } label: {
                    Label("Live Activities", systemImage: "dot.radiowaves.left.and.right")
                }
                .accessibilityIdentifier("live-activities-settings")
            }

            // Tracking — each pick list gets its own row, plus the medication
            // safety limits that govern dose tracking.
            Section("Tracking") {
                NavigationLink {
                    TrackingOptionsScreen(category: .symptom)
                } label: {
                    Label("Symptoms", systemImage: "list.bullet.clipboard")
                }
                .accessibilityIdentifier("tracking-symptoms")

                NavigationLink {
                    TrackingOptionsScreen(category: .trigger)
                } label: {
                    Label("Triggers", systemImage: "exclamationmark.triangle")
                }
                .accessibilityIdentifier("tracking-triggers")

                NavigationLink {
                    TrackingOptionsScreen(category: .painQuality)
                } label: {
                    Label("Pain Qualities", systemImage: "waveform.path.ecg")
                }
                .accessibilityIdentifier("tracking-pain-qualities")

                NavigationLink {
                    CategorySafetyRulesScreen()
                } label: {
                    Label("Medication Safety Limits", systemImage: "exclamationmark.shield")
                }
                .accessibilityIdentifier("medication-safety-limits")
            }

            // Location
            Section("Location") {
                NavigationLink {
                    LocationSettingsScreen()
                } label: {
                    Label("Location Services", systemImage: "location")
                }
            }

            // Data
            Section("Data") {
                DoctorSummaryExportButton { isGenerating in
                    HStack {
                        Label("Doctor Visit Summary", systemImage: "doc.richtext")
                        Spacer()
                        if isGenerating { ProgressView() }
                    }
                }
                .accessibilityIdentifier("settings-doctor-summary")

                NavigationLink {
                    DataSettingsScreen()
                } label: {
                    Label("Backup & Export", systemImage: "externaldrive")
                }

                NavigationLink {
                    SyncSettingsScreen()
                } label: {
                    Label("iCloud Sync", systemImage: "arrow.triangle.2.circlepath.icloud")
                }
            }

            // Beta Features (test builds only) — feature flags, sample data, and
            // other tools for evaluators and internal testing. Hidden in App
            // Store builds via BuildEnvironment.isPreRelease.
            if BuildEnvironment.isPreRelease {
                Section("Beta") {
                    NavigationLink {
                        BetaFeaturesScreen()
                    } label: {
                        Label("Beta Features", systemImage: "flask")
                    }
                    .accessibilityIdentifier("beta-features")
                }
            }

            // Developer Tools (unlocked by tapping the version row 7 times)
            if developerModeEnabled {
                Section("Developer") {
                    NavigationLink {
                        DeveloperToolsScreen()
                    } label: {
                        Label("Developer Tools", systemImage: "wrench.and.screwdriver")
                    }
                    .accessibilityIdentifier("developer-tools")
                }
            }

            // App Information — version, source repo, and open source licenses.
            Section {
                VersionSectionView(developerModeEnabled: $developerModeEnabled)

                if let repoURL = URL(string: "https://github.com/vfilby/migralog") {
                    Link(destination: repoURL) {
                        Label("View Source on GitHub", systemImage: "chevron.left.forwardslash.chevron.right")
                    }
                    .accessibilityIdentifier("github-repo")
                }

                NavigationLink {
                    LicensesScreen()
                } label: {
                    Label("Open Source Licenses", systemImage: "doc.text")
                }
                .accessibilityIdentifier("open-source-licenses")
            } header: {
                Text("App Information")
            } footer: {
                Text("MigraLog is open source. Browse the code, report issues, or contribute on GitHub.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
        .readableContentWidth()
    }
}

// MARK: - Theme Section

/// Appearance picker rendered as three preview swatch cards (Light / Dark /
/// System). Each card shows a fixed miniature of the app in that appearance —
/// the colors are intentionally non-adaptive so a card always depicts its own
/// theme regardless of the mode currently in effect. The selected card gets a
/// tinted ring and a checkmark.
struct ThemeSectionView: View {
    @AppStorage("selectedTheme") private var selectedTheme: ThemePreference = .system

    var body: some View {
        HStack(spacing: 12) {
            ForEach(ThemePreference.allCases) { theme in
                Button {
                    withAnimation(.snappy) { selectedTheme = theme }
                } label: {
                    ThemeOptionCard(theme: theme, isSelected: selectedTheme == theme)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("theme-\(theme.rawValue)")
                .accessibilityLabel(theme.displayName)
                .accessibilityAddTraits(selectedTheme == theme ? [.isSelected] : [])
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }
}

/// A single appearance option: a miniature preview tile, a selection ring +
/// checkmark, and the theme's name.
private struct ThemeOptionCard: View {
    let theme: ThemePreference
    let isSelected: Bool

    var body: some View {
        VStack(spacing: 8) {
            ThemePreviewTile(theme: theme)
                .frame(height: 88)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(
                            isSelected ? Color.accentColor : Color(.separator),
                            lineWidth: isSelected ? 3 : 1
                        )
                }
                .overlay(alignment: .bottomTrailing) {
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(.white, Color.accentColor)
                            .font(.title3)
                            .padding(5)
                    }
                }

            Text(theme.displayName)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundStyle(isSelected ? Color.accentColor : .primary)
        }
        .contentShape(Rectangle())
    }
}

/// Fixed (non-adaptive) miniature of the app used inside a `ThemeOptionCard`.
/// `.system` overlays the dark palette on a diagonal so it reads as "auto".
private struct ThemePreviewTile: View {
    let theme: ThemePreference

    // Fixed palettes so each swatch always depicts its own appearance.
    private static let lightBG = Color.white
    private static let lightTitle = Color(white: 0.45)
    private static let lightCard = Color(white: 0.88)
    private static let darkBG = Color(white: 0.12)
    private static let darkTitle = Color(white: 0.78)
    private static let darkCard = Color(white: 0.30)

    var body: some View {
        switch theme {
        case .light:
            tile(bg: Self.lightBG, title: Self.lightTitle, card: Self.lightCard)
        case .dark:
            tile(bg: Self.darkBG, title: Self.darkTitle, card: Self.darkCard)
        case .system:
            ZStack {
                tile(bg: Self.lightBG, title: Self.lightTitle, card: Self.lightCard)
                tile(bg: Self.darkBG, title: Self.darkTitle, card: Self.darkCard)
                    .clipShape(DiagonalHalf())
            }
        }
    }

    private func tile(bg: Color, title: Color, card: Color) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(title)
                .frame(width: 26, height: 5)
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(card)
                .frame(height: 12)
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(card)
                .frame(width: 34, height: 8)
            Spacer(minLength: 0)
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(bg)
    }
}

/// The lower-right triangle of a rect, split along the anti-diagonal — used to
/// reveal the dark half of the System preview.
private struct DiagonalHalf: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

// MARK: - Version Section

struct VersionSectionView: View {
    @Binding var developerModeEnabled: Bool
    @State private var versionTapCount = 0
    @State private var showDeveloperModeAlert = false

    private static let tapsToToggle = 7

    var body: some View {
        HStack {
            Text("Version")
            Spacer()
            if developerModeEnabled {
                Image(systemName: "wrench.and.screwdriver")
                    .font(.footnote)
                    .foregroundStyle(.tint)
                    .accessibilityIdentifier("developer-mode-indicator")
            }
            Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
                .foregroundStyle(.secondary)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: handleVersionTap)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("version-row")
        .alert(
            developerModeEnabled ? "Developer Mode Enabled" : "Developer Mode Disabled",
            isPresented: $showDeveloperModeAlert
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(developerModeEnabled
                ? "Developer tools are now visible in Settings."
                : "Developer tools have been hidden.")
        }
    }

    private func handleVersionTap() {
        versionTapCount += 1
        guard versionTapCount >= Self.tapsToToggle else { return }
        versionTapCount = 0
        developerModeEnabled.toggle()
        showDeveloperModeAlert = true
    }
}
