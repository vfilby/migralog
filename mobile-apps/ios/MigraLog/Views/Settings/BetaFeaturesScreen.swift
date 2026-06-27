import SwiftUI

/// Top-level Settings category (pre-release builds only) collecting tools meant
/// for evaluators and internal testing: experimental feature flags, sample-data
/// loading, and similar affordances. Gated behind `BuildEnvironment.isPreRelease`
/// at the call site so it never appears in App Store builds.
struct BetaFeaturesScreen: View {
    var body: some View {
        List {
            FeatureFlagsSectionView()
            SampleDataSectionView()
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Beta Features")
        .readableContentWidth()
    }
}

/// Renders a toggle for every registered `FeatureFlag`. Shows an empty state
/// when no flags are currently defined.
struct FeatureFlagsSectionView: View {
    var body: some View {
        Section {
            if FeatureFlag.all.isEmpty {
                Text("No experimental features are available right now.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(FeatureFlag.all) { flag in
                    FeatureFlagToggle(flag: flag)
                }
            }
        } header: {
            Text("Feature Flags")
        } footer: {
            Text("Opt in to in-progress features. These are experimental, may be "
                + "incomplete, and only appear in test builds.")
        }
    }
}

/// A single feature-flag toggle, persisted under the flag's namespaced key.
private struct FeatureFlagToggle: View {
    let flag: FeatureFlag

    @State private var isOn: Bool

    init(flag: FeatureFlag) {
        self.flag = flag
        _isOn = State(initialValue: FeatureFlags.isEnabled(flag))
    }

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(flag.title)
                Text(flag.details)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityIdentifier("feature-flag-\(flag.key)")
        .onChange(of: isOn) { _, newValue in
            UserDefaults.standard.set(newValue, forKey: flag.storageKey)
        }
    }
}
