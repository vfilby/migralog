import SwiftUI

/// Renders the bundled privacy policy (Settings → Privacy → Privacy Policy).
/// The Markdown lives in the repo-root `legal/` folder and is bundled as a
/// resource, so the app and the website can share one source.
struct PrivacyPolicyScreen: View {
    @State private var markdown = ""

    var body: some View {
        ScrollView {
            MarkdownView(markdown: markdown)
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .readableContentWidth()
        }
        .navigationTitle("Privacy Policy")
        .navigationBarTitleDisplayMode(.large)
        .task { markdown = loadMarkdown() }
    }

    private func loadMarkdown() -> String {
        guard let url = Bundle.main.url(forResource: "privacy-policy", withExtension: "md", subdirectory: "legal"),
              let text = try? String(contentsOf: url, encoding: .utf8) else {
            return "The privacy policy could not be loaded.\n\nYou can also read it at migralog.app."
        }
        // The title is shown in the navigation bar; drop a leading H1.
        var lines = text.components(separatedBy: .newlines)
        while let first = lines.first, first.trimmingCharacters(in: .whitespaces).isEmpty {
            lines.removeFirst()
        }
        if let first = lines.first, first.trimmingCharacters(in: .whitespaces).hasPrefix("# ") {
            lines.removeFirst()
        }
        return lines.joined(separator: "\n")
    }
}
