import SwiftUI

/// Settings screen for customizing the pain-quality / symptom / trigger pick
/// lists. Built-in options can be hidden (and shown again) with their toggle;
/// custom options are added via each section's "Add" row and removed with a
/// swipe. Hiding or deleting an option never changes past episodes — it only
/// affects what the episode-entry pickers offer.
struct TrackingOptionsScreen: View {
    /// When set, the screen shows only this category — used by the per-category
    /// rows under Settings → Tracking (Symptoms, Triggers, Pain Qualities).
    /// When nil, every category is shown in one combined list.
    let category: TrackingOptionCategory?

    @State private var viewModel = TrackingOptionsViewModel()
    @State private var addingCategory: TrackingOptionCategory?

    init(category: TrackingOptionCategory? = nil) {
        self.category = category
    }

    private var categories: [TrackingOptionCategory] {
        if let category { return [category] }
        return TrackingOptionCategory.allCases
    }

    var body: some View {
        List {
            ForEach(categories) { category in
                section(for: category)
            }
        }
        .navigationTitle(category?.displayName ?? "Tracking Options")
        .readableContentWidth()
        .navigationBarTitleDisplayMode(.inline)
        .task {
            viewModel.load()
        }
        .sheet(item: $addingCategory) { category in
            AddTrackingOptionSheet(category: category, viewModel: viewModel)
        }
        // While the add sheet is up, its own alert presents the error —
        // a second presentation attempt from the covered screen would
        // conflict and neither alert would show.
        .alert(
            "Couldn't Update Options",
            isPresented: Binding(
                get: { viewModel.error != nil && addingCategory == nil },
                set: { if !$0 { viewModel.error = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.error ?? "")
        }
    }

    // MARK: - Sections

    private func section(for category: TrackingOptionCategory) -> some View {
        Section {
            ForEach(viewModel.rows(for: category)) { row in
                optionRow(row, in: category)
            }
            Button {
                addingCategory = category
            } label: {
                Label("Add \(category.singularDisplayName)", systemImage: "plus.circle.fill")
            }
            .accessibilityIdentifier("tracking-options-add-\(category.rawValue)")
        } header: {
            // In the combined list each section needs its own header; when the
            // screen is scoped to one category the navigation title already names it.
            if self.category == nil {
                Text(category.displayName)
            }
        } footer: {
            // Show the "only affects the pickers" note once: under Triggers in the
            // combined list, or on every scoped per-category screen.
            if self.category != nil || category == .trigger {
                // swiftlint:disable:next line_length
                Text("Hiding or deleting an option only changes which choices the pickers offer — episodes you already logged keep their values.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func optionRow(
        _ row: TrackingOptionsViewModel.OptionRow,
        in category: TrackingOptionCategory
    ) -> some View {
        Toggle(isOn: Binding(
            get: { !row.isHidden },
            set: { viewModel.setHidden(category: category, value: row.value, hidden: !$0) }
        )) {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.displayName)
                if !row.isBuiltIn {
                    Text("Custom")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityIdentifier("tracking-option-\(category.rawValue)-\(row.value)")
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            if !row.isBuiltIn {
                Button(role: .destructive) {
                    viewModel.deleteCustomOption(row)
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                .accessibilityIdentifier("tracking-option-delete-\(row.value)")
            }
        }
    }

}
