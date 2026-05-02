import SwiftUI

// MARK: - Intensity Sparkline

struct IntensitySparklineView: View {
    let readings: [IntensityReading]
    /// Episode start time — chart X axis starts here
    var episodeStart: Int64?
    /// Episode end time (nil for ongoing — uses current time)
    var episodeEnd: Int64?

    /// Pain scale gradient colors from 0 (green) to 10 (purple)
    private static let gradientColors: [Color] = [
        Color(hex: "#2E7D32"), // 0 - Dark Green
        Color(hex: "#558B2F"), // 1
        Color(hex: "#689F38"), // 2
        Color(hex: "#F9A825"), // 3
        Color(hex: "#FF8F00"), // 4
        Color(hex: "#EF6C00"), // 5
        Color(hex: "#E65100"), // 6
        Color(hex: "#D84315"), // 7
        Color(hex: "#C62828"), // 8
        Color(hex: "#EC407A"), // 9
        Color(hex: "#AB47BC"), // 10
    ]

    var body: some View {
        GeometryReader { geo in
            let sorted = readings
                .filter { $0.intensity >= 0 }
                .sorted { $0.timestamp < $1.timestamp }

            if !sorted.isEmpty {
                let startT = episodeStart ?? sorted.first!.timestamp
                let endT = episodeEnd ?? Int64(Date().timeIntervalSince1970 * 1000)
                let timeRange = max(Double(endT - startT), 1)
                let padding: CGFloat = 4
                let chartW = geo.size.width - padding * 2
                let chartH = geo.size.height - padding * 2

                // Interpolate at 5-minute intervals with sample-and-hold, then smooth
                let smoothed = Self.smoothedData(
                    readings: sorted, start: startT, end: endT
                )

                // Background gradient (green at bottom, purple at top)
                RoundedRectangle(cornerRadius: 4)
                    .fill(
                        LinearGradient(
                            colors: Self.gradientColors.map { $0.opacity(0.15) },
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )

                // Smoothed line with gradient stroke
                if smoothed.count > 1 {
                    Path { path in
                        for (i, point) in smoothed.enumerated() {
                            let x = padding + chartW * CGFloat(Double(point.timestamp - startT) / timeRange)
                            let y = padding + chartH * (1 - CGFloat(point.intensity / 10.0))
                            if i == 0 {
                                path.move(to: CGPoint(x: x, y: y))
                            } else {
                                path.addLine(to: CGPoint(x: x, y: y))
                            }
                        }
                    }
                    .stroke(
                        LinearGradient(
                            colors: Self.gradientColors,
                            startPoint: .bottom,
                            endPoint: .top
                        ),
                        style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
                    )
                } else if sorted.count == 1 {
                    // Single reading: flat line across full width
                    let y = padding + chartH * (1 - CGFloat(sorted[0].intensity / 10.0))
                    Path { path in
                        path.move(to: CGPoint(x: padding, y: y))
                        path.addLine(to: CGPoint(x: padding + chartW, y: y))
                    }
                    .stroke(
                        PainScale.color(for: sorted[0].intensity),
                        style: StrokeStyle(lineWidth: 2, lineCap: .round)
                    )
                }

                // Reading dots at actual data points
                ForEach(sorted) { reading in
                    let x = padding + chartW * CGFloat(Double(reading.timestamp - startT) / timeRange)
                    let y = padding + chartH * (1 - CGFloat(reading.intensity / 10.0))
                    Circle()
                        .fill(PainScale.color(for: reading.intensity))
                        .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                        .frame(width: 7, height: 7)
                        .position(x: x, y: y)
                }
            }
        }
    }

    // MARK: - Smoothing

    /// Interpolate readings at 5-minute intervals using sample-and-hold,
    /// then apply reverse (look-ahead) EMA smoothing.
    private static func smoothedData(
        readings: [IntensityReading], start: Int64, end: Int64
    ) -> [(timestamp: Int64, intensity: Double)] {
        guard !readings.isEmpty else { return [] }

        let intervalMs: Int64 = 5 * 60 * 1000 // 5 minutes

        // Step 1: Interpolate at fixed intervals with sample-and-hold
        var interpolated: [(timestamp: Int64, intensity: Double)] = []
        var time = start
        while time <= end {
            var intensity: Double = 0
            for i in stride(from: readings.count - 1, through: 0, by: -1) {
                if readings[i].timestamp <= time {
                    intensity = readings[i].intensity
                    break
                }
            }
            interpolated.append((timestamp: time, intensity: intensity))
            time += intervalMs
        }
        // Ensure end point is included
        if interpolated.last?.timestamp != end {
            var intensity: Double = 0
            for i in stride(from: readings.count - 1, through: 0, by: -1) {
                if readings[i].timestamp <= end {
                    intensity = readings[i].intensity
                    break
                }
            }
            interpolated.append((timestamp: end, intensity: intensity))
        }

        guard interpolated.count > 1 else { return interpolated }

        // Step 2: Apply reverse (look-ahead) EMA smoothing
        // Process backwards so the curve anticipates changes instead of lagging
        let alpha = 0.30
        var smoothed = interpolated
        for i in stride(from: interpolated.count - 2, through: 0, by: -1) {
            let ema = alpha * interpolated[i].intensity + (1 - alpha) * smoothed[i + 1].intensity
            smoothed[i] = (timestamp: interpolated[i].timestamp, intensity: ema)
        }

        return smoothed
    }
}
