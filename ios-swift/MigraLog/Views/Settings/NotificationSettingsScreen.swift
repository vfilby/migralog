import SwiftUI

struct NotificationSettingsScreen: View {
    @State private var viewModel = NotificationSettingsViewModel()

    var body: some View {
        List {
            Section {
                Toggle("Enable Notifications", isOn: $viewModel.notificationsEnabled)
                    .onChange(of: viewModel.notificationsEnabled) { _, newValue in
                        viewModel.saveSettings()
                        if !newValue {
                            // Cancel all notifications when disabled
                            Task { await viewModel.syncDailyCheckinNotification() }
                        }
                    }
                    .accessibilityIdentifier("enable-notifications-toggle")
            } footer: {
                if !viewModel.notificationsEnabled {
                    Text("All medication reminders and daily check-in notifications are disabled.")
                }
            }

            if viewModel.notificationsEnabled {
                Section("Medication Reminders") {
                    Toggle("Time-Sensitive Notifications", isOn: $viewModel.timeSensitiveEnabled)
                        .onChange(of: viewModel.timeSensitiveEnabled) { _, _ in
                            viewModel.saveSettings()
                        }

                    Picker("Follow-up Reminder", selection: $viewModel.followUpDelay) {
                        Text("Off").tag(0)
                        Text("15 min").tag(15)
                        Text("30 min").tag(30)
                        Text("45 min").tag(45)
                        Text("60 min").tag(60)
                    }
                    .onChange(of: viewModel.followUpDelay) { _, _ in
                        viewModel.saveSettings()
                    }

                    Toggle("Critical Alerts", isOn: $viewModel.criticalAlertsEnabled)
                        .onChange(of: viewModel.criticalAlertsEnabled) { _, _ in
                            viewModel.saveSettings()
                        }
                }

                Section("Daily Check-in") {
                    Toggle("Daily Check-in Reminder", isOn: $viewModel.dailyCheckinEnabled)
                        .onChange(of: viewModel.dailyCheckinEnabled) { _, _ in
                            viewModel.saveSettings()
                            Task {
                                await viewModel.syncDailyCheckinNotification()
                            }
                        }

                    if viewModel.dailyCheckinEnabled {
                        DatePicker("Check-in Time", selection: $viewModel.dailyCheckinTime, displayedComponents: .hourAndMinute)
                            .onChange(of: viewModel.dailyCheckinTime) { _, _ in
                                viewModel.saveSettings()
                                Task {
                                    await viewModel.syncDailyCheckinNotification()
                                }
                            }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Notification Settings")
        .task {
            viewModel.loadSettings()
            await viewModel.syncDailyCheckinNotification()
        }
    }
}
