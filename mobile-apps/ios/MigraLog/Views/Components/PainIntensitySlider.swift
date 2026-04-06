import SwiftUI

/// Reusable pain intensity slider matching the RN app's layout:
/// - Number (colored) + Label (bold) on top row
/// - Slider with colored tint
/// - "0 - No Pain" / "10 - Debilitating" range labels
/// - Description text below
struct PainIntensitySlider: View {
    @Binding var intensity: Double

    var body: some View {
        let level = PainScale.level(for: intensity)

        VStack(spacing: 8) {
            // Number + Label
            HStack {
                Text(String(format: "%.0f", intensity))
                    .font(.title.weight(.bold))
                    .foregroundStyle(level.color)
                Spacer()
                Text(level.label)
                    .font(.headline)
            }

            // Slider
            Slider(value: $intensity, in: 0...10, step: 1)
                .tint(level.color)

            // Range labels
            HStack {
                Text("0 - No Pain")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("10 - Debilitating")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            // Description
            Text(level.description)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.top, 2)
        }
    }
}
