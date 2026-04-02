import SwiftUI

/// A chip-style toggle button matching the RN app:
/// - Selected: blue filled background, white text
/// - Unselected: dark gray background with subtle border, primary text
struct SelectableChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .foregroundStyle(isSelected ? .white : .primary)
                .background(isSelected ? Color.accentColor : Color(.tertiarySystemBackground))
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isSelected ? Color.accentColor : Color(.separator), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
