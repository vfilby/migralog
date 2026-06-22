import Foundation
import GRDB

/// Populates the database with a rich, realistic dataset (~90 days of episodes,
/// daily statuses, medication routines and rescue doses, and a calendar overlay)
/// so the app can be evaluated without hand-entering data.
///
/// Used both by the `--load-screenshot-data` UI-testing launch argument and by
/// the in-app "Load Sample Data" tool in Settings (pre-release builds only), so
/// the two paths stay in lockstep. All identifiers are prefixed `sample-` so the
/// data is recognizable and self-contained.
enum SampleDataLoader {
    /// Inserts the full sample dataset into `dbManager`'s database.
    ///
    /// Assumes the database is empty (callers reset first); rows use fixed,
    /// prefixed ids so re-running on a non-empty database would collide.
    // swiftlint:disable:next function_body_length
    static func load(into dbManager: DatabaseManager = .shared) throws {
        let now = TimestampHelper.now
        let cal = Calendar.current

        try dbManager.dbQueue.write { database in
            // --- Medications (generic names throughout) ---
            let erenumabId = "sample-med-erenumab"
            try database.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency, active, category, created_at, updated_at)
                VALUES (?, 'Erenumab', 'preventative', 70.0, 'mg', 1.0, 'monthly', 1, 'cgrp', ?, ?)
                """, arguments: [erenumabId, now, now])
            try database.execute(sql: """
                INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled, reminder_enabled)
                VALUES (?, ?, '08:00', ?, 1.0, 1, 1)
                """, arguments: ["sample-sched-erenumab", erenumabId, TimeZone.current.identifier])

            let magnesiumId = "sample-med-magnesium"
            try database.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency, active, category, created_at, updated_at)
                VALUES (?, 'Magnesium Glycinate', 'preventative', 400.0, 'mg', 1.0, 'daily', 1, 'supplement', ?, ?)
                """, arguments: [magnesiumId, now, now])
            try database.execute(sql: """
                INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled, reminder_enabled)
                VALUES (?, ?, '21:00', ?, 1.0, 1, 1)
                """, arguments: ["sample-sched-magnesium", magnesiumId, TimeZone.current.identifier])

            let sumatriptanId = "sample-med-sumatriptan"
            try database.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, active, category, min_interval_hours, created_at, updated_at)
                VALUES (?, 'Sumatriptan', 'rescue', 100.0, 'mg', 1.0, 1, 'triptan', 2.0, ?, ?)
                """, arguments: [sumatriptanId, now, now])

            let ibuprofenId = "sample-med-ibuprofen"
            try database.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, active, category, min_interval_hours, created_at, updated_at)
                VALUES (?, 'Ibuprofen', 'rescue', 400.0, 'mg', 2.0, 1, 'nsaid', 6.0, ?, ?)
                """, arguments: [ibuprofenId, now, now])

            // --- Closed historical episodes spread over the last ~80 days ---
            // Tuples: (daysAgo, durationHours, peakIntensity, symptoms JSON, triggers JSON, locations JSON, notes)
            // swiftlint:disable:next large_tuple
            let episodes: [(Int, Double, Double, String, String, String, String)] = [
                (78, 6.0, 8.0, "[\"nausea\",\"photophobia\"]", "[\"weather\"]", "[\"left_temple\"]", "Storm front rolling in."),
                (71, 4.5, 6.0, "[\"photophobia\"]", "[\"sleep\"]", "[\"forehead\"]", "Slept 5 hours, woke up with it."),
                (62, 7.0, 9.0, "[\"nausea\",\"photophobia\",\"phonophobia\"]", "[\"stress\"]", "[\"right_temple\",\"right_eye\"]", "Bad week at work."),
                (54, 3.0, 5.0, "[\"nausea\"]", "[\"food\"]", "[\"forehead\"]", ""),
                (45, 5.5, 7.0, "[\"photophobia\"]", "[\"weather\",\"stress\"]", "[\"left_temple\",\"left_eye\"]", "Heat wave."),
                (38, 4.0, 6.0, "[\"nausea\"]", "[\"hormonal\"]", "[\"forehead\",\"right_temple\"]", ""),
                (30, 8.0, 9.0, "[\"nausea\",\"photophobia\",\"phonophobia\"]", "[\"stress\",\"sleep\"]", "[\"right_temple\",\"right_eye\",\"neck\"]", "Worst this month."),
                (24, 2.5, 4.0, "[]", "[\"food\"]", "[\"forehead\"]", "Caught it early."),
                (17, 6.0, 7.0, "[\"photophobia\"]", "[\"weather\"]", "[\"left_temple\"]", ""),
                (11, 4.0, 6.0, "[\"nausea\"]", "[\"stress\"]", "[\"forehead\",\"left_temple\"]", "Long meeting day."),
                (5, 5.0, 7.0, "[\"photophobia\",\"phonophobia\"]", "[\"sleep\"]", "[\"right_temple\"]", ""),
                (2, 3.5, 5.0, "[\"nausea\"]", "[\"food\"]", "[\"forehead\"]", "Skipped lunch.")
            ]

            for (idx, ep) in episodes.enumerated() {
                let (daysAgo, durationHours, peak, symptoms, triggers, locations, notes) = ep
                let day = cal.date(byAdding: .day, value: -daysAgo, to: Date())!
                let startOfDay = cal.startOfDay(for: day)
                let startHour = 9 + (idx % 6) // vary start time 9am-2pm
                let episodeStart = startOfDay.addingTimeInterval(Double(startHour) * 3600)
                let episodeEnd = episodeStart.addingTimeInterval(durationHours * 3600)
                let startMs = TimestampHelper.fromDate(episodeStart)
                let endMs = TimestampHelper.fromDate(episodeEnd)
                let episodeId = "sample-episode-\(daysAgo)"
                let notesValue: String? = notes.isEmpty ? nil : notes

                try database.execute(sql: """
                    INSERT INTO episodes (id, start_time, end_time, locations, qualities, symptoms, triggers, notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, '[\"throbbing\"]', ?, ?, ?, ?, ?)
                    """, arguments: [episodeId, startMs, endMs, locations, symptoms, triggers, notesValue, startMs, endMs])

                // Intensity readings spread across the episode: rise → peak → fall
                let durationMs = Int64(durationHours * 3_600_000)
                let r1Time = startMs + durationMs / 5            // 20% in
                let peakTime = startMs + (durationMs * 11 / 20)  // 55% in (peak)
                let r3Time = startMs + (durationMs * 17 / 20)    // 85% in
                let r1 = max(2.0, peak - 4.0)
                let r2 = peak
                let r3 = max(1.0, peak - 5.0)
                try database.execute(sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, arguments: ["\(episodeId)-r1", episodeId, r1Time, r1, r1Time, r1Time])
                try database.execute(sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, arguments: ["\(episodeId)-r2", episodeId, peakTime, r2, peakTime, peakTime])
                try database.execute(sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, arguments: ["\(episodeId)-r3", episodeId, r3Time, r3, r3Time, r3Time])

                // Rescue dose for moderate+ episodes, ~30% into the episode
                if peak >= 6.0 {
                    let doseTime = startMs + (durationMs * 3 / 10)
                    let doseMed = peak >= 7.0 ? sumatriptanId : ibuprofenId
                    let doseAmount: Double = peak >= 7.0 ? 100.0 : 400.0
                    let doseUnit = "mg"
                    try database.execute(sql: """
                        INSERT INTO medication_doses (id, medication_id, timestamp, quantity, dosage_amount, dosage_unit, status, episode_id, effectiveness_rating, created_at, updated_at)
                        VALUES (?, ?, ?, 1.0, ?, ?, 'taken', ?, ?, ?, ?)
                        """, arguments: ["\(episodeId)-dose", doseMed, doseTime, doseAmount, doseUnit, episodeId, 7.0, doseTime, doseTime])
                }
            }

            // --- Active episode: started 2 hours ago, no end_time ---
            let activeStart = Date().addingTimeInterval(-2 * 3600)
            let activeStartMs = TimestampHelper.fromDate(activeStart)
            let activeId = "sample-episode-active"
            try database.execute(sql: """
                INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers, notes, created_at, updated_at)
                VALUES (?, ?, '[\"left_temple\",\"left_eye\"]', '[\"throbbing\"]', '[\"photophobia\"]', '[\"weather\"]', 'Started after lunch.', ?, ?)
                """, arguments: [activeId, activeStartMs, activeStartMs, activeStartMs])
            let activeMidMs = activeStartMs + 3600 * 1000
            try database.execute(sql: """
                INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                VALUES (?, ?, ?, 4.0, ?, ?)
                """, arguments: ["\(activeId)-r1", activeId, activeStartMs, activeStartMs, activeStartMs])
            try database.execute(sql: """
                INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                VALUES (?, ?, ?, 6.0, ?, ?)
                """, arguments: ["\(activeId)-r2", activeId, activeMidMs, activeMidMs, activeMidMs])
            try database.execute(sql: """
                INSERT INTO medication_doses (id, medication_id, timestamp, quantity, dosage_amount, dosage_unit, status, episode_id, created_at, updated_at)
                VALUES (?, ?, ?, 1.0, 100.0, 'mg', 'taken', ?, ?, ?)
                """, arguments: ["\(activeId)-dose", sumatriptanId, activeMidMs, activeId, activeMidMs, activeMidMs])

            // --- Daily status logs covering the last 90 days ---
            // Episode days are 'red'; a few yellow prodrome/postdrome days; the rest 'green'.
            let redDays = Set(episodes.map { $0.0 })
            let postdromeDays = Set(episodes.map { $0.0 - 1 }.filter { $0 > 0 })
            let prodromeDays: Set<Int> = [13, 26, 41, 73]
            for daysAgo in 1...90 {
                let date = cal.date(byAdding: .day, value: -daysAgo, to: Date())!
                let dateStr = TimestampHelper.dateString(from: date)
                let status: String
                let statusType: String?
                if redDays.contains(daysAgo) {
                    status = "red"
                    statusType = nil
                } else if postdromeDays.contains(daysAgo) {
                    status = "yellow"
                    statusType = "postdrome"
                } else if prodromeDays.contains(daysAgo) {
                    status = "yellow"
                    statusType = "prodrome"
                } else {
                    status = "green"
                    statusType = nil
                }
                try database.execute(sql: """
                    INSERT INTO daily_status_logs (id, date, status, status_type, prompted, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 1, ?, ?)
                    """, arguments: ["sample-status-\(daysAgo)", dateStr, status, statusType, now, now])
            }

            // --- Calendar overlay (e.g. travel) ---
            let overlayStart = cal.date(byAdding: .day, value: -50, to: Date())!
            let overlayEnd = cal.date(byAdding: .day, value: -43, to: Date())!
            try database.execute(sql: """
                INSERT INTO calendar_overlays (id, start_date, end_date, label, exclude_from_stats, created_at, updated_at)
                VALUES (?, ?, ?, 'Vacation', 0, ?, ?)
                """, arguments: [
                    "sample-overlay-vacation",
                    TimestampHelper.dateString(from: overlayStart),
                    TimestampHelper.dateString(from: overlayEnd),
                    now, now
                ])

            // --- Routine doses ---
            // Erenumab: monthly 70mg injection at 8am, last 3 months
            for monthsAgo in 1...3 {
                let date = cal.date(byAdding: .month, value: -monthsAgo, to: Date())!
                let morning = cal.startOfDay(for: date).addingTimeInterval(8 * 3600)
                let mMs = TimestampHelper.fromDate(morning)
                try database.execute(sql: """
                    INSERT INTO medication_doses (id, medication_id, timestamp, quantity, dosage_amount, dosage_unit, status, created_at, updated_at)
                    VALUES (?, ?, ?, 1.0, 70.0, 'mg', 'taken', ?, ?)
                    """, arguments: ["sample-dose-eren-\(monthsAgo)", erenumabId, mMs, mMs, mMs])
            }
            // Magnesium: nightly 400mg, last 30 days
            for daysAgo in 1...30 {
                let date = cal.date(byAdding: .day, value: -daysAgo, to: Date())!
                let evening = cal.startOfDay(for: date).addingTimeInterval(21 * 3600)
                let eMs = TimestampHelper.fromDate(evening)
                try database.execute(sql: """
                    INSERT INTO medication_doses (id, medication_id, timestamp, quantity, dosage_amount, dosage_unit, status, created_at, updated_at)
                    VALUES (?, ?, ?, 1.0, 400.0, 'mg', 'taken', ?, ?)
                    """, arguments: ["sample-dose-mag-\(daysAgo)", magnesiumId, eMs, eMs, eMs])
            }
        }
    }
}
