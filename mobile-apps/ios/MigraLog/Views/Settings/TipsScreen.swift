import SwiftUI

/// Settings → Help → Tips. A browsable catalog of every contextual tip, so users
/// can re-read them and re-show any they've dismissed.
struct TipsScreen: View {
    @State private var viewModel = DidYouKnowViewModel()
    /// Bumped to force the list to re-read dismissed state after a change.
    @State private var revision = 0

    var body: some View {
        List {
            Section {
                ForEach(viewModel.allTips) { tip in
                    TipCatalogRow(
                        tip: tip,
                        isDismissed: viewModel.isDismissed(tip),
                        onToggle: {
                            if viewModel.isDismissed(tip) {
                                viewModel.restore(tip)
                            } else {
                                viewModel.dismiss(tip)
                            }
                            revision += 1
                        }
                    )
                }
            } footer: {
                Text("Tips appear one at a time on your dashboard when they're relevant. Hide ones you don't need, or show them again here.")
            }
        }
        .id(revision)
        .listStyle(.insetGrouped)
        .navigationTitle("Tips")
        .readableContentWidth()
        .toolbar {
            if viewModel.hasDismissedTips {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Show All") {
                        viewModel.restoreAll()
                        revision += 1
                    }
                    .accessibilityIdentifier("tips-show-all")
                }
            }
        }
    }
}

private struct TipCatalogRow: View {
    let tip: Tip
    let isDismissed: Bool
    let onToggle: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: tip.icon)
                .font(.title3)
                .foregroundStyle(isDismissed ? AnyShapeStyle(.tertiary) : AnyShapeStyle(Color.accentColor))
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(tip.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(isDismissed ? .secondary : .primary)
                Text(tip.message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            Button(action: onToggle) {
                Text(isDismissed ? "Show" : "Hide")
                    .font(.caption.weight(.semibold))
            }
            .buttonStyle(.borderless)
            .accessibilityIdentifier("tip-toggle-\(tip.rawValue)")
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}
