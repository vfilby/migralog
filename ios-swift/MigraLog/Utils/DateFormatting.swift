import Foundation

enum DateFormatting {
    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    private static let displayDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    private static let displayTimeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .none
        f.timeStyle = .short
        return f
    }()

    private static let displayDateTimeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    // MARK: - Date String (YYYY-MM-DD)

    static func dateString(from date: Date) -> String {
        dateFormatter.string(from: date)
    }

    static func date(from string: String) -> Date? {
        dateFormatter.date(from: string)
    }

    // MARK: - Display Formatting

    static func displayDate(_ date: Date) -> String {
        displayDateFormatter.string(from: date)
    }

    static func displayTime(_ date: Date) -> String {
        displayTimeFormatter.string(from: date)
    }

    static func displayDateTime(_ date: Date) -> String {
        displayDateTimeFormatter.string(from: date)
    }

    // MARK: - Duration Formatting

    static func formatDuration(milliseconds: Int64) -> String {
        let totalMinutes = Int(milliseconds / 60_000)
        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60

        if hours > 0 && minutes > 0 {
            return "\(hours)h \(minutes)m"
        } else if hours > 0 {
            return "\(hours)h"
        } else {
            return "\(minutes)m"
        }
    }

    static func formatDuration(from start: Int64, to end: Int64?) -> String {
        guard let end = end else {
            let elapsed = TimestampHelper.now - start
            return formatDuration(milliseconds: elapsed) + " and ongoing"
        }
        return formatDuration(milliseconds: end - start)
    }

    // MARK: - Relative

    static func relativeDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            return displayDate(date)
        }
    }

    // MARK: - Time from HH:mm string

    static func displayTime(from timeString: String) -> String {
        let parts = timeString.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else { return timeString }

        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        guard let date = Calendar.current.date(from: components) else { return timeString }
        return displayTime(date)
    }
}
