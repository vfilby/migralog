import SwiftUI

/// Opaque, branded cover shown over the app's content whenever the scene is not
/// `.active` (i.e. `.inactive` or `.background`). iOS snapshots the app for the
/// app-switcher thumbnail during the `.inactive` transition — BEFORE `.background` —
/// so covering on anything other than `.active` guarantees the snapshot captures
/// this view instead of on-screen PHI (episode notes, triggers, medication names).
///
/// The view is fully opaque (it fills the screen with `Color(.systemBackground)`)
/// so no underlying health data shows through. It carries no dynamic data and never
/// logs, keeping it HIPAA-safe and cheap to render.
struct PrivacyCoverView: View {
    var body: some View {
        ZStack {
            // Opaque base so nothing behind it is visible in the snapshot.
            Color(.systemBackground)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 80))
                    .foregroundStyle(Color.accentColor)

                Text("MigraLog")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(.primary)
            }
        }
        // Purely a privacy shield — hide it from assistive technologies so it
        // doesn't announce over the real content underneath.
        .accessibilityHidden(true)
    }
}

#Preview {
    PrivacyCoverView()
}
