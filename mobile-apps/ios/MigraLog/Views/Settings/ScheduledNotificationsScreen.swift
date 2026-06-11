import SwiftUI
import UserNotifications

struct ScheduledNotificationEntry: Identifiable {
    enum Status {
        case both
        case dbOnly
        case osOnly

        var label: String {
            switch self {
            case .both: return "DB + OS"
            case .dbOnly: return "DB only"
            case .osOnly: return "OS only (orphan)"
            }
        }

        var color: Color {
            switch self {
            case .both: return .green
            case .dbOnly: return .orange
            case .osOnly: return .red
            }
        }
    }

    let id: String
    let triggerDate: Date?
    let status: Status
    let dbRow: ScheduledNotification?
    let osRequest: UNNotificationRequest?

    var notificationId: String {
        dbRow?.notificationId ?? osRequest?.identifier ?? id
    }

    var title: String {
        osRequest?.content.title ?? dbRow?.notificationTitle ?? "(no title)"
    }

    var body: String {
        osRequest?.content.body ?? dbRow?.notificationBody ?? ""
    }
}

struct ScheduledNotificationsScreen: View {
    @State private var entries: [ScheduledNotificationEntry] = []
    @State private var loadError: String?
    @State private var selected: ScheduledNotificationEntry?

    var body: some View {
        List {
            if let loadError {
                Section {
                    Text(loadError).foregroundStyle(.red)
                }
            }

            if entries.isEmpty {
                Section {
                    Text("No scheduled notifications.")
                        .foregroundStyle(.secondary)
                }
            } else {
                Section {
                    ForEach(entries) { entry in
                        Button {
                            selected = entry
                        } label: {
                            row(entry)
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("\(entries.count) entries")
                }
            }
        }
        .navigationTitle("Scheduled Notifications")
        .readableContentWidth()
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .task { await refresh() }
        .sheet(item: $selected) { entry in
            NavigationStack {
                ScheduledNotificationDetailView(entry: entry)
            }
        }
    }

    @ViewBuilder
    private func row(_ entry: ScheduledNotificationEntry) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(entry.status.label)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(entry.status.color.opacity(0.15))
                    .foregroundStyle(entry.status.color)
                    .clipShape(Capsule())

                if let type = entry.dbRow?.notificationType {
                    Text(type.rawValue)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if let date = entry.triggerDate {
                    Text(DateFormatting.displayDateTime(date))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Text(entry.title)
                .font(.subheadline)
                .lineLimit(1)

            if !entry.body.isEmpty {
                Text(entry.body)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private func refresh() async {
        do {
            let repo = ScheduledNotificationRepository(dbManager: DatabaseManager.shared)
            let dbRows = try repo.getAllPending()
            let osRequests = await UNUserNotificationCenter.current().pendingNotificationRequests()

            var byNotificationId: [String: (db: ScheduledNotification?, os: UNNotificationRequest?)] = [:]
            for row in dbRows {
                byNotificationId[row.notificationId, default: (nil, nil)].db = row
            }
            for req in osRequests {
                byNotificationId[req.identifier, default: (nil, nil)].os = req
            }

            let combined: [ScheduledNotificationEntry] = byNotificationId.map { (id, pair) in
                let status: ScheduledNotificationEntry.Status
                switch (pair.db, pair.os) {
                case (.some, .some): status = .both
                case (.some, .none): status = .dbOnly
                case (.none, .some): status = .osOnly
                case (.none, .none): status = .both
                }
                let triggerDate = computeTriggerDate(db: pair.db, os: pair.os)
                return ScheduledNotificationEntry(
                    id: id,
                    triggerDate: triggerDate,
                    status: status,
                    dbRow: pair.db,
                    osRequest: pair.os
                )
            }

            entries = combined.sorted {
                switch ($0.triggerDate, $1.triggerDate) {
                case let (l?, r?): return l < r
                case (nil, _?): return false
                case (_?, nil): return true
                case (nil, nil): return false
                }
            }
            loadError = nil
        } catch {
            loadError = "Failed to load: \(error.localizedDescription)"
        }
    }

    private func computeTriggerDate(db: ScheduledNotification?, os: UNNotificationRequest?) -> Date? {
        if let calendarTrigger = os?.trigger as? UNCalendarNotificationTrigger,
           let next = calendarTrigger.nextTriggerDate() {
            return next
        }
        if let intervalTrigger = os?.trigger as? UNTimeIntervalNotificationTrigger,
           let next = intervalTrigger.nextTriggerDate() {
            return next
        }
        guard let db,
              let dateOnly = DateFormatting.date(from: db.date),
              let timeStr = db.scheduledTriggerTime,
              let parts = parseHHmm(timeStr) else {
            return nil
        }
        return Calendar.current.date(
            bySettingHour: parts.hour, minute: parts.minute, second: 0, of: dateOnly
        )
    }

    private func parseHHmm(_ s: String) -> (hour: Int, minute: Int)? {
        let parts = s.split(separator: ":")
        guard parts.count == 2,
              let h = Int(parts[0]),
              let m = Int(parts[1]) else { return nil }
        return (h, m)
    }
}

private struct ScheduledNotificationDetailView: View {
    let entry: ScheduledNotificationEntry
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            Section("Status") {
                LabeledContent("State", value: entry.status.label)
                LabeledContent("Notification ID", value: entry.notificationId)
                if let trigger = entry.triggerDate {
                    LabeledContent("Trigger", value: DateFormatting.displayDateTime(trigger))
                }
            }

            if let db = entry.dbRow {
                Section("Database") {
                    LabeledContent("Type", value: db.notificationType.rawValue)
                    LabeledContent("Source", value: db.sourceType.rawValue)
                    LabeledContent("Date", value: db.date)
                    if let time = db.scheduledTriggerTime {
                        LabeledContent("Time", value: time)
                    }
                    LabeledContent("Grouped", value: db.isGrouped ? "yes" : "no")
                    if let groupKey = db.groupKey {
                        LabeledContent("Group key", value: groupKey)
                    }
                    if let medId = db.medicationId {
                        LabeledContent("Medication ID", value: medId)
                    }
                    if let medName = db.medicationName {
                        LabeledContent("Medication", value: medName)
                    }
                    if let scheduleId = db.scheduleId {
                        LabeledContent("Schedule ID", value: scheduleId)
                    }
                    if let category = db.categoryIdentifier {
                        LabeledContent("Category", value: category)
                    }
                    if let title = db.notificationTitle {
                        LabeledContent("Title", value: title)
                    }
                    if let body = db.notificationBody {
                        LabeledContent("Body", value: body)
                    }
                }
            } else {
                Section("Database") {
                    Text("No matching DB row.").foregroundStyle(.secondary)
                }
            }

            if let os = entry.osRequest {
                Section("OS Pending") {
                    LabeledContent("Identifier", value: os.identifier)
                    LabeledContent("Title", value: os.content.title)
                    LabeledContent("Body", value: os.content.body)
                    LabeledContent("Sound", value: os.content.sound.map { "\($0)" } ?? "—")
                    LabeledContent("Interruption", value: "\(os.content.interruptionLevel.rawValue)")
                    if !os.content.userInfo.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("userInfo").font(.caption).foregroundStyle(.secondary)
                            Text(formatUserInfo(os.content.userInfo))
                                .font(.caption.monospaced())
                        }
                    }
                }
            } else {
                Section("OS Pending") {
                    Text("No matching OS request.").foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Notification Detail")
        .readableContentWidth()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Done") { dismiss() }
            }
        }
    }

    private func formatUserInfo(_ info: [AnyHashable: Any]) -> String {
        info.map { "\($0.key) = \($0.value)" }.sorted().joined(separator: "\n")
    }
}
