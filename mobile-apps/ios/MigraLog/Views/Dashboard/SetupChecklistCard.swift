import SwiftUI

/// Dashboard setup checklist, shown in the space where the episode list will be.
/// Lists the remaining one-time setup actions (add rescue / preventative meds);
/// each row deep-links to the add-med screen and can be individually dismissed.
/// The card hides itself once nothing remains to show.
struct SetupChecklistCard: View {
    let viewModel: SetupChecklistViewModel
    let onAction: (SetupTask) -> Void
    let onDismiss: (SetupTask) -> Void

    var body: some View {
        if viewModel.shouldShow {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("Finish setting up")
                    .font(.headline)

                ForEach(viewModel.visibleTasks) { task in
                    SetupTaskRow(
                        task: task,
                        onTap: { onAction(task) },
                        onDismiss: { onDismiss(task) }
                    )
                    if task.id != viewModel.visibleTasks.last?.id {
                        Divider()
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("setup-checklist-card")
        }
    }
}

private struct SetupTaskRow: View {
    let task: SetupTask
    let onTap: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Button(action: onTap) {
                HStack(spacing: DesignTokens.Spacing.md) {
                    Image(systemName: task.icon)
                        .font(.title3)
                        .foregroundStyle(Color.accentColor)
                        .frame(width: 28)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(task.title)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.primary)
                        Text(task.detail)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("setup-task-\(task.rawValue)")

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                    .padding(6)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss \(task.title)")
            .accessibilityIdentifier("setup-task-dismiss-\(task.rawValue)")
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
    }
}
