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

                // Background gradient (green at bottom, purple at top)
                RoundedRectangle(cornerRadius: 4)
                    .fill(
                        LinearGradient(
                            colors: Self.gradientColors.map { $0.opacity(0.15) },
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )

                // Sample-and-hold step function line
                Path { path in
                    for (i, reading) in sorted.enumerated() {
                        let x = padding + chartW * CGFloat(Double(reading.timestamp - startT) / timeRange)
                        let y = padding + chartH * (1 - CGFloat(reading.intensity / 10.0))
                        if i == 0 {
                            path.move(to: CGPoint(x: x, y: y))
                        } else {
                            // Horizontal segment at previous intensity, then vertical jump
                            path.addLine(to: CGPoint(x: x, y: path.currentPoint?.y ?? y))
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                    // Hold last value to end of episode
                    if let lastY = path.currentPoint?.y {
                        let endX = padding + chartW
                        path.addLine(to: CGPoint(x: endX, y: lastY))
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

                // Reading dots
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

    /// Sample-and-hold interpolation at fixed intervals
}
