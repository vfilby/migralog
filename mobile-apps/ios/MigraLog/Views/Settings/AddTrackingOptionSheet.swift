import SwiftUI

/// Sheet for adding a tracking option: type a name and either pick one of the
/// suggested catalog values (filtered as you type) or add the typed text as a
/// free-form custom option. Suggestions store canonical snake_case values so
/// the same concept serializes identically for every user.
struct AddTrackingOptionSheet: View {
    let category: TrackingOptionCategory
    let viewModel: TrackingOptionsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @FocusState private var nameFieldFocused: Bool

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Name", text: $name)
                        .focused($nameFieldFocused)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                        .submitLabel(.done)
                        .onSubmit { addTyped() }
                        .accessibilityIdentifier("tracking-option-name-field")
                } footer: {
                    Text("Pick a suggestion below, or enter your own.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                let matches = viewModel.suggestions(for: category, query: name)
                if !matches.isEmpty {
                    Section("Suggestions") {
                        ForEach(matches) { suggestion in
                            Button {
                                add(suggestion.displayName)
                            } label: {
                                HStack {
                                    Text(suggestion.displayName)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    Image(systemName: "plus.circle")
                                        .foregroundStyle(.tint)
                                        .accessibilityHidden(true)
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("tracking-option-suggestion-\(suggestion.value)")
                        }
                    }
                }
            }
            .navigationTitle("Add \(category.singularDisplayName)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { addTyped() }
                        .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityIdentifier("tracking-option-add-confirm")
                }
            }
            .onAppear { nameFieldFocused = true }
            // The screen's error alert can't present while this sheet covers
            // it, so add/duplicate errors are surfaced here.
            .alert(
                "Couldn't Add Option",
                isPresented: Binding(
                    get: { viewModel.error != nil },
                    set: { if !$0 { viewModel.error = nil } }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.error ?? "")
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func addTyped() {
        add(name)
    }

    private func add(_ value: String) {
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        if viewModel.addCustomOption(category: category, value: value) {
            dismiss()
        }
    }
}
