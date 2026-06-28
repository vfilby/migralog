import SwiftUI

/// Dashboard "Did you know?" card: shows a single contextual tip (or nothing).
/// The tip is chosen by `DidYouKnowViewModel`; this view only renders it and
/// reports CTA/dismiss back to the host, which owns navigation.
struct DidYouKnowCard: View {
    let viewModel: DidYouKnowViewModel
    /// Fired when the user taps the tip's call-to-action.
    let onAction: (Tip) -> Void

    var body: some View {
        if let tip = viewModel.currentTip {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                header(tip)

                Text(tip.title)
                    .font(.headline)

                Text(tip.message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Button {
                    onAction(tip)
                } label: {
                    Text(tip.cta.label)
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.regular)
                .padding(.top, DesignTokens.Spacing.xs)
                .accessibilityIdentifier("did-you-know-cta")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("did-you-know-card")
        }
    }

    private func header(_ tip: Tip) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Label("Did you know?", systemImage: tip.icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.accentColor)
                .labelStyle(.titleAndIcon)

            Spacer()

            Button {
                viewModel.dismiss(tip)
            } label: {
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                    .padding(4)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss tip")
            .accessibilityIdentifier("did-you-know-dismiss")
        }
    }
}
