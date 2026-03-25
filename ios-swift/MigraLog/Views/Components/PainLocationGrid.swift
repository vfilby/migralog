import SwiftUI

struct PainLocationGrid: View {
    @Binding var selectedLocations: Set<PainLocation>

    private let regions: [(left: PainLocation, right: PainLocation)] = [
        (.leftEye, .rightEye),
        (.leftTemple, .rightTemple),
        (.leftNeck, .rightNeck),
        (.leftHead, .rightHead),
        (.leftTeeth, .rightTeeth),
    ]

    var body: some View {
        Grid(horizontalSpacing: 8, verticalSpacing: 8) {
            // Header row
            GridRow {
                Text("Left")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                Text("Right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
            }

            // Body region rows
            ForEach(regions, id: \.left) { region in
                GridRow {
                    locationButton(region.left)
                    locationButton(region.right)
                }
            }
        }
    }

    @ViewBuilder
    private func locationButton(_ location: PainLocation) -> some View {
        let isSelected = selectedLocations.contains(location)
        Button {
            if isSelected {
                selectedLocations.remove(location)
            } else {
                selectedLocations.insert(location)
            }
        } label: {
            Text(location.displayName)
                .font(.caption)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 44)
                .background(isSelected ? Color.accentColor.opacity(0.2) : Color(.tertiarySystemBackground))
                .foregroundStyle(isSelected ? Color.accentColor : .primary)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(isSelected ? Color.accentColor : Color(.separator), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("pain-location-\(location.rawValue)")
    }
}
