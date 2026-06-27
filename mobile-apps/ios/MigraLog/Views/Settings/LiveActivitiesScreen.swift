import SwiftUI

/// Live Activities settings, surfaced as its own top-level row under the
/// Notifications category rather than buried at the bottom of the notification
/// toggles. Controls whether live episode status appears on the Lock Screen and
/// in the Dynamic Island while an episode is active.
struct LiveActivitiesScreen: View {
    @State private var viewModel = NotificationSettingsViewModel()

    var body: some View {
        List {
            Section {
                Toggle("Live Activities", isOn: $viewModel.liveActivitiesEnabled)
                    .onChange(of: viewModel.liveActivitiesEnabled) { _, _ in
                        viewModel.saveSettings()
                        viewModel.applyLiveActivitiesSettingChange()
                    }
                    .accessibilityIdentifier("live-activities-toggle")
            } footer: {
                Text("Show live episode status on the Lock Screen and in the Dynamic Island while an episode is active.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Live Activities")
        .readableContentWidth()
        .task {
            viewModel.loadSettings()
        }
    }
}
