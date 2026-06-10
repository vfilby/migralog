import SwiftUI

/// Settings screen for customizing the pain-quality / symptom / trigger pick
/// lists. Built-in options can be hidden (and shown again) with their toggle;
/// custom options are added via each section's "Add" row and removed with a
/// swipe. Hiding or deleting an option never changes past episodes — it only
/// affects what the episode-entry pickers offer.
struct TrackingOptionsScreen: View {
    @State private var viewModel = TrackingOptionsViewModel()
    @State private var addingCategory: TrackingOptionCategory?

    var body: some View {
        List {
            ForEach(TrackingOptionCategory.allCases) { category in
                section(for: category)
            }
        }
        .navigationTitle("Tracking Options")
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
            Text(category.displayName)
        } footer: {
            if category == .trigger {
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
