import Foundation

/// Aggregators backing the one-page doctor-visit summary (`DoctorSummaryReport`).
///
/// Kept in a separate extension from the in-app insight aggregators so neither
/// file grows past the lint size limits. Same conventions: deterministic, taking
/// repository rows plus an explicit `calendar`, returning render-ready values.
/// Informational only, not medical advice.
extension AnalyticsInsights {
    // MARK: - Monthly headache days

    /// Headache days within a single calendar month, for the long-term trend
    /// bars on the doctor-visit summary. `isPartial` is set when the month is
    /// only partly covered by the requested range (the first and current month).
    struct MonthlyHeadacheDays: Equatable, Identifiable {
        let monthStart: Date
        let headacheDayCount: Int
        let isPartial: Bool
        var id: Date { monthStart }
    }

    /// Headache-day counts bucketed per calendar month over `from...to`.
    /// `headacheDays` is the pre-computed day set (episodes + red statuses,
    /// minus excluded days); days are assigned to a month by their "yyyy-MM"
    /// prefix and clipped to the requested range, so partial months only count
    /// covered days.
    static func monthlyHeadacheDays(
        headacheDays: Set<String>,
        from: Date,
        to: Date,
        calendar: Calendar = .current
    ) -> [MonthlyHeadacheDays] {
        guard from <= to,
              let firstMonth = calendar.dateInterval(of: .month, for: from)?.start else { return [] }

        let fromString = TimestampHelper.dateString(from: from)
        let toString = TimestampHelper.dateString(from: to)
        let rangeStartDay = calendar.startOfDay(for: from)
        let rangeEndExclusive = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: to)) ?? to

        var result: [MonthlyHeadacheDays] = []
        var monthStart = firstMonth
        while monthStart < rangeEndExclusive {
            guard let monthEnd = calendar.date(byAdding: .month, value: 1, to: monthStart) else { break }
            let monthKey = String(TimestampHelper.dateString(from: monthStart).prefix(7))
            let isPartial = monthStart < rangeStartDay || monthEnd > rangeEndExclusive
            let count = headacheDays.filter {
                $0.hasPrefix(monthKey) && $0 >= fromString && $0 <= toString
            }.count
            result.append(MonthlyHeadacheDays(monthStart: monthStart, headacheDayCount: count, isPartial: isPartial))
            monthStart = monthEnd
        }
        return result
    }

    // MARK: - Medication usage

    /// Per-rescue-medication usage over a window, for the medication table on
    /// the doctor-visit summary. Captures both how often ("how much of each")
    /// and the total dispensed amount.
    struct MedicationUsage: Equatable, Identifiable {
        let medicationId: String
        let medicationName: String
        let category: MedicationCategory?
        /// Taken doses counted in the window.
        let doseCount: Int
        /// Distinct days with at least one taken dose.
        let dayCount: Int
        /// Sum over taken doses of `quantity × per-dose dosage amount`.
        let totalAmount: Double
        /// Unit label for `totalAmount`/`averageAmount` (the medication's unit).
        let dosageUnit: String
        var id: String { medicationId }

        /// Mean amount per taken dose — the typical strength taken each time,
        /// which reads more usefully on the report than a 30-day total.
        var averageAmount: Double {
            doseCount > 0 ? totalAmount / Double(doseCount) : 0
        }
    }

    /// Per-rescue-medication usage over `from...to` (excluded-overlay days
    /// dropped). Per-dose amount uses the dose's own dosage amount when it
    /// overrides the medication default. Only medications with at least one
    /// taken dose in range are returned, sorted by dose count descending then
    /// name, so the heaviest-used medication leads the table.
    static func medicationUsage(
        doses: [MedicationDose],
        medications: [Medication],
        excluded: Set<String>,
        from: Date,
        to: Date,
        calendar: Calendar = .current
    ) -> [MedicationUsage] {
        let rescueById = Dictionary(
            medications.filter { $0.type == .rescue }.map { ($0.id, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        guard !rescueById.isEmpty else { return [] }

        let fromMs = TimestampHelper.fromDate(calendar.startOfDay(for: from))
        let toMs = TimestampHelper.fromDate(
            calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: to)) ?? to
        )

        var doseCount: [String: Int] = [:]
        var days: [String: Set<String>] = [:]
        var amount: [String: Double] = [:]
        for dose in doses where dose.status == .taken {
            guard let med = rescueById[dose.medicationId] else { continue }
            guard dose.timestamp >= fromMs, dose.timestamp < toMs else { continue }
            let dayString = TimestampHelper.dateString(from: TimestampHelper.toDate(dose.timestamp))
            guard !excluded.contains(dayString) else { continue }
            doseCount[med.id, default: 0] += 1
            days[med.id, default: []].insert(dayString)
            amount[med.id, default: 0] += dose.quantity * (dose.dosageAmount ?? med.dosageAmount)
        }

        return doseCount.keys.compactMap { medId -> MedicationUsage? in
            guard let med = rescueById[medId], let count = doseCount[medId], count > 0 else { return nil }
            return MedicationUsage(
                medicationId: medId,
                medicationName: med.name,
                category: med.category,
                doseCount: count,
                dayCount: days[medId]?.count ?? 0,
                totalAmount: amount[medId] ?? 0,
                dosageUnit: med.dosageUnit
            )
        }
        .sorted {
            $0.doseCount != $1.doseCount
                ? $0.doseCount > $1.doseCount
                : ($0.medicationName != $1.medicationName
                    ? $0.medicationName < $1.medicationName
                    : $0.medicationId < $1.medicationId)
        }
    }

    // MARK: - Preventative compliance

    /// Per-preventative adherence over a window, for the compliance table on
    /// the doctor-visit summary. The whole-range counterpart of
    /// `weeklyAdherence`: same expected/taken rules, aggregated per medication.
    struct PreventativeCompliance: Equatable, Identifiable {
        let medicationId: String
        let medicationName: String
        /// Enabled schedules per day × covered days in the window.
        let expectedDoses: Int
        /// Taken doses, capped per day at the expected count.
        let takenDoses: Int
        /// Enabled schedules per day (e.g. 2 for a twice-daily medication).
        let dosesPerDay: Int
        var id: String { medicationId }

        var percent: Double {
            expectedDoses > 0 ? Double(takenDoses) / Double(expectedDoses) * 100 : 0
        }
    }

    /// Per-active-preventative adherence over `from...to`. Expected doses per
    /// day come from the medication's expectation periods, so each day is
    /// graded against the configuration true on that day — a medication added
    /// mid-window only accrues expectations from its start, and archived gaps
    /// aren't graded. Taken doses are capped per day at the expected count so
    /// extra logs can't push adherence over 100%. Excluded-overlay days are
    /// dropped from both sides. Active preventatives with a current (open)
    /// period are always returned (sorted by name) — including 0%-adherence
    /// ones — so a missed medication still shows on the report.
    static func preventativeCompliance(
        doses: [MedicationDose],
        medications: [Medication],
        periods: [MedicationExpectationPeriod],
        excluded: Set<String>,
        from: Date,
        to: Date,
        calendar: Calendar = .current
    ) -> [PreventativeCompliance] {
        let periodsByMed = Dictionary(grouping: periods, by: \.medicationId)
        var dosesPerDay: [String: Int] = [:]
        var nameById: [String: String] = [:]
        for med in medications where med.type == .preventative && med.active {
            // The report describes the current regimen: the open period's rate.
            let current = (periodsByMed[med.id] ?? [])
                .filter { $0.endDate == nil }
                .map(\.expectedDailyDoses)
                .max()
            if let current {
                dosesPerDay[med.id] = current
                nameById[med.id] = med.name
            }
        }
        guard !dosesPerDay.isEmpty else { return [] }

        var takenByMedDay: [String: Int] = [:]
        for dose in doses where dose.status == .taken && dosesPerDay[dose.medicationId] != nil {
            let dayString = TimestampHelper.dateString(from: TimestampHelper.toDate(dose.timestamp))
            takenByMedDay["\(dose.medicationId)|\(dayString)", default: 0] += 1
        }

        var expected: [String: Int] = [:]
        var taken: [String: Int] = [:]
        var day = calendar.startOfDay(for: from)
        let lastDay = calendar.startOfDay(for: to)
        while day <= lastDay {
            let dayString = TimestampHelper.dateString(from: day)
            if !excluded.contains(dayString) {
                for medId in dosesPerDay.keys {
                    let perDay = (periodsByMed[medId] ?? []).lazy
                        .filter { $0.covers(dayString) }
                        .map(\.expectedDailyDoses)
                        .max() ?? 0
                    guard perDay > 0 else { continue }
                    expected[medId, default: 0] += perDay
                    taken[medId, default: 0] += min(takenByMedDay["\(medId)|\(dayString)"] ?? 0, perDay)
                }
            }
            guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
            day = next
        }

        return dosesPerDay.keys.compactMap { medId -> PreventativeCompliance? in
            guard let perDay = dosesPerDay[medId], let name = nameById[medId] else { return nil }
            return PreventativeCompliance(
                medicationId: medId,
                medicationName: name,
                expectedDoses: expected[medId] ?? 0,
                takenDoses: taken[medId] ?? 0,
                dosesPerDay: perDay
            )
        }
        .sorted {
            $0.medicationName != $1.medicationName
                ? $0.medicationName < $1.medicationName
                : $0.medicationId < $1.medicationId
        }
    }
}
