import SwiftUI
import UserNotifications

struct TestNotificationsScreen: View {
    private let logger = AppLogger.shared

    @State private var settings: UNNotificationSettings?

    var body: some View {
        List {
            Section {
                if let settings {
                    permissionRow("Authorization", value: authStatusLabel(settings.authorizationStatus))
                    permissionRow("Alert", value: settingLabel(settings.alertSetting))
                    permissionRow("Sound", value: settingLabel(settings.soundSetting))
                    permissionRow("Badge", value: settingLabel(settings.badgeSetting))
                    permissionRow("Critical Alert", value: settingLabel(settings.criticalAlertSetting))
                    permissionRow("Time-Sensitive", value: settingLabel(settings.timeSensitiveSetting))
                    permissionRow("Notification Center", value: settingLabel(settings.notificationCenterSetting))
                    permissionRow("Lock Screen", value: settingLabel(settings.lockScreenSetting))
                    permissionRow("Banner", value: settingLabel(settings.alertSetting))
                } else {
                    Text("Loading…").foregroundStyle(.secondary)
                }
            } header: {
                Text("Permissions")
            } footer: {
                Text("These reflect what iOS reports right now. Toggle a permission in Settings → MigraLog → Notifications and tap Refresh to update.")
            }

            Section {
                Button {
                    Task { await requestPermission() }
                } label: {
                    Label("Request Permission", systemImage: "lock.shield")
                }
            } footer: {
                Text("Asks for alert + sound + badge + critical-alert authorization. Time-sensitive is granted via the entitlement.")
            }

            Section {
                Button {
                    Task { await schedule(level: .active, critical: false, label: "Regular") }
                } label: {
                    Label("Send Regular in 10s", systemImage: "bell")
                }

                Button {
                    Task { await schedule(level: .timeSensitive, critical: false, label: "Time-Sensitive") }
                } label: {
                    Label("Send Time-Sensitive in 10s", systemImage: "bell.badge")
                }

                Button {
                    Task { await schedule(level: .critical, critical: true, label: "Critical") }
                } label: {
                    Label("Send Critical in 10s", systemImage: "exclamationmark.triangle.fill")
                }
            } header: {
                Text("Test Triggers")
            } footer: {
                Text("Background the app after tapping — iOS routes notifications to the in-app delegate while the app is foregrounded.\n\nNote: critical sound (.defaultCritical) may crash SpringBoard on the iOS 26.0 simulator. Test critical on a real device via TestFlight.")
            }
        }
        .navigationTitle("Test Notifications")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await loadSettings() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .task { await loadSettings() }
    }

    @ViewBuilder
    private func permissionRow(_ name: String, value: String) -> some View {
        LabeledContent(name, value: value)
    }

    private func loadSettings() async {
        settings = await UNUserNotificationCenter.current().notificationSettings()
    }

    private func authStatusLabel(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "Not determined"
        case .denied: return "Denied"
        case .authorized: return "Authorized"
        case .provisional: return "Provisional"
        case .ephemeral: return "Ephemeral"
        @unknown default: return "Unknown"
        }
    }

    private func settingLabel(_ setting: UNNotificationSetting) -> String {
        switch setting {
        case .notSupported: return "Not supported"
        case .disabled: return "Disabled"
        case .enabled: return "Enabled"
        @unknown default: return "Unknown"
        }
    }

    private func requestPermission() async {
        let granted = await NotificationService.shared.requestPermission()
        logger.info("Test notifications: permission request returned \(granted)")
        await loadSettings()
    }

    private func schedule(level: UNNotificationInterruptionLevel, critical: Bool, label: String) async {
        let id = "test-\(label.lowercased())-\(UUID().uuidString)"
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 10, repeats: false)
        do {
            try await NotificationService.shared.scheduleNotification(
                id: id,
                title: "Test (\(label))",
                body: "Fired 10s after tap.",
                trigger: trigger,
                categoryIdentifier: nil,
                userInfo: ["test": true],
                interruptionLevel: level,
                useCriticalSound: critical
            )
            logger.info("Test notification scheduled: \(label) in 10s (id=\(id))")
        } catch {
            logger.error("Failed to schedule test notification (\(label))", error: error)
        }
    }
}
