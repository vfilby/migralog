import SwiftUI

struct LogViewerScreen: View {
    @State private var entries: [AppLogEntry] = []
    @State private var minLevel: LogLevel = .info

    var body: some View {
        List {
            Section {
                Picker("Minimum Level", selection: $minLevel) {
                    Text("Debug").tag(LogLevel.debug)
                    Text("Info").tag(LogLevel.info)
                    Text("Warn").tag(LogLevel.warn)
                    Text("Error").tag(LogLevel.error)
                }
                .pickerStyle(.segmented)
            }

            Section {
                if filtered.isEmpty {
                    Text("No log entries at or above \(minLevel.label).")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(filtered) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                Text(entry.level.label)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(color(for: entry.level))
                                Text(DateFormatting.displayDateTime(entry.timestamp))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Text(entry.message)
                                .font(.subheadline)
                            if let context = entry.context {
                                Text(context)
                                    .font(.caption.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Log Viewer")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    refresh()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button(role: .destructive) {
                    AppLogger.shared.clearBuffer()
                    refresh()
                } label: {
                    Image(systemName: "trash")
                }
            }
        }
        .onAppear { refresh() }
    }

    private var filtered: [AppLogEntry] {
        entries
            .filter { $0.level >= minLevel }
            .reversed()
    }

    private func refresh() {
        entries = AppLogger.shared.recentEntries()
    }

    private func color(for level: LogLevel) -> Color {
        switch level {
        case .debug: return .secondary
        case .info: return .blue
        case .warn: return .orange
        case .error: return .red
        }
    }
}
