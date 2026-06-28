import SwiftUI

/// Settings → User Guide → Tips & Reminders. One place to manage the two kinds of
/// contextual nudges the app shows on the dashboard:
///
/// - The **setup checklist** (add rescue / preventative meds), with per-item
///   hide/show and a "Dismiss All".
/// - The **tips** catalog — every "Did you know?" tip, so users can re-read them
///   and re-show any they've dismissed.
struct TipsAndChecklistScreen: View {
    @State private var checklist = SetupChecklistViewModel()
    @State private var tips = DidYouKnowViewModel()
    /// Bumped to force the list to re-read dismissed state after a change.
    @State private var revision = 0

    var body: some View {
        List {
            checklistSection
            tipsSection
        }
        .id(revision)
        .listStyle(.insetGrouped)
        .navigationTitle("Tips & Reminders")
        .readableContentWidth()
        .task { checklist.refresh() }
    }

    // MARK: - Setup checklist

    @ViewBuilder
    private var checklistSection: some View {
        Section {
            ForEach(checklist.allTasks) { task in
                ChecklistManageRow(
                    task: task,
                    isCompleted: checklist.isCompleted(task),
                    isDismissed: checklist.isDismissed(task),
                    onToggle: {
                        if checklist.isDismissed(task) {
                            checklist.restore(task)
                        } else {
                            checklist.dismiss(task)
                        }
                        revision += 1
                    }
                )
            }

            if checklist.hasDismissableTasks {
                Button("Dismiss All") {
                    checklist.dismissAll()
                    revision += 1
                }
                .accessibilityIdentifier("checklist-dismiss-all")
            }
        } header: {
            Text("Setup Checklist")
        } footer: {
            Text("These setup reminders appear on your dashboard until you've added your medications. Hide ones that don't apply, or bring them back here.")
        }
    }

    // MARK: - Tips

    @ViewBuilder
    private var tipsSection: some View {
        Section {
            ForEach(tips.allTips) { tip in
                TipCatalogRow(
                    tip: tip,
                    isDismissed: tips.isDismissed(tip),
                    onToggle: {
                        if tips.isDismissed(tip) {
                            tips.restore(tip)
                        } else {
                            tips.dismiss(tip)
                        }
                        revision += 1
                    }
                )
            }

            if tips.hasDismissedTips {
                Button("Show All Tips") {
                    tips.restoreAll()
                    revision += 1
                }
                .accessibilityIdentifier("tips-show-all")
            }
        } header: {
            Text("Tips")
        } footer: {
            Text("Tips appear one at a time on your dashboard when they're relevant. Hide ones you don't need, or show them again here.")
        }
    }
}

// MARK: - Rows

private struct ChecklistManageRow: View {
    let task: SetupTask
    let isCompleted: Bool
    let isDismissed: Bool
    let onToggle: () -> Void

    private var isMuted: Bool { isCompleted || isDismissed }

    var body: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: task.icon)
                .font(.title3)
                .foregroundStyle(isMuted ? AnyShapeStyle(.tertiary) : AnyShapeStyle(Color.accentColor))
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(isMuted ? .secondary : .primary)
                Text(task.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            if isCompleted {
                Label("Done", systemImage: "checkmark.circle.fill")
                    .labelStyle(.iconOnly)
                    .font(.title3)
                    .foregroundStyle(.green)
                    .accessibilityLabel("Done")
            } else {
                Button(action: onToggle) {
                    Text(isDismissed ? "Show" : "Hide")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.borderless)
                .accessibilityIdentifier("checklist-toggle-\(task.rawValue)")
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
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
