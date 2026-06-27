import SwiftUI

/// Dashboard "Get Started" card: a short checklist that walks a new user through
/// the core features. Renders nothing once dismissed or once every available item
/// is complete (see `OnboardingChecklistViewModel.shouldShow`). Action handling is
/// delegated to the host so this view stays free of navigation/sheet plumbing.
struct OnboardingChecklistCard: View {
    let viewModel: OnboardingChecklistViewModel
    /// Fired when the user taps an actionable (incomplete, unlocked) row.
    let onAction: (OnboardingChecklistViewModel.Item) -> Void

    var body: some View {
        if viewModel.shouldShow {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                header

                ForEach(viewModel.orderedItems) { item in
                    OnboardingChecklistRow(
                        item: item,
                        isCompleted: viewModel.isCompleted(item),
                        isLocked: !viewModel.isUnlocked(item),
                        lockHint: viewModel.lockHint(for: item),
                        onTap: { onAction(item) }
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
            // Contain children so this identifier stays on the card and doesn't
            // override the per-row identifiers.
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("onboarding-checklist-card")
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Get Started")
                    .font(.headline)
                Text("\(viewModel.completedCount) of \(viewModel.totalCount) complete")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("onboarding-progress-label")
                ProgressView(value: Double(viewModel.completedCount), total: Double(max(viewModel.totalCount, 1)))
                    .tint(.accentColor)
                    .padding(.top, 2)
            }

            Spacer()

            Button("Dismiss") {
                viewModel.dismiss()
            }
            .font(.caption)
            .accessibilityIdentifier("onboarding-dismiss-button")
        }
    }
}

/// A single checklist row: status glyph + title, with a chevron when actionable
/// and a lock hint when gated.
private struct OnboardingChecklistRow: View {
    let item: OnboardingChecklistViewModel.Item
    let isCompleted: Bool
    let isLocked: Bool
    let lockHint: String?
    let onTap: () -> Void

    /// A row is tappable only when it's something the user can still act on.
    private var isActionable: Bool { !isCompleted && !isLocked }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignTokens.Spacing.md) {
                statusIcon
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.subheadline)
                        .foregroundStyle(isCompleted ? .secondary : .primary)
                        .strikethrough(isCompleted, color: .secondary)
                    if let lockHint {
                        Text(lockHint)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }

                Spacer()

                if isActionable {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isActionable)
        .accessibilityIdentifier("onboarding-item-\(item.rawValue)")
        .accessibilityValue(isCompleted ? "Completed" : (isLocked ? "Locked" : "Not started"))
    }

    @ViewBuilder
    private var statusIcon: some View {
        if isCompleted {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
        } else if isLocked {
            Image(systemName: "lock.fill")
                .foregroundStyle(.tertiary)
                .font(.subheadline)
        } else {
            Image(systemName: item.systemImage)
                .foregroundStyle(Color.accentColor)
                .font(.subheadline)
        }
    }
}
