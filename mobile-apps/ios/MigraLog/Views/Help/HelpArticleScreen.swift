import SwiftUI

/// Renders one user-guide article from its bundled Markdown. Relative `*.md`
/// links within an article push the linked article onto the same navigation
/// stack; external links open normally.
struct HelpArticleScreen: View {
    let article: HelpArticle

    @State private var markdown = ""
    @State private var linkedArticle: HelpArticle?

    var body: some View {
        ScrollView {
            MarkdownView(markdown: markdown)
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .readableContentWidth()
        }
        .navigationTitle(article.title)
        .navigationBarTitleDisplayMode(.large)
        .task { markdown = stripLeadingTitle(article.loadMarkdown()) }
        .navigationDestination(item: $linkedArticle) { linked in
            HelpArticleScreen(article: linked)
        }
        .environment(\.openURL, OpenURLAction { url in
            guard url.absoluteString.hasSuffix(".md") else { return .systemAction }
            let base = url.lastPathComponent.replacingOccurrences(of: ".md", with: "")
            guard let target = HelpArticle.find(id: base) else { return .discarded }
            linkedArticle = target
            return .handled
        })
    }

    /// The article title is shown in the navigation bar, so drop a leading H1 to
    /// avoid showing it twice.
    private func stripLeadingTitle(_ md: String) -> String {
        var lines = md.components(separatedBy: .newlines)
        while let first = lines.first, first.trimmingCharacters(in: .whitespaces).isEmpty {
            lines.removeFirst()
        }
        if let first = lines.first, first.trimmingCharacters(in: .whitespaces).hasPrefix("# ") {
            lines.removeFirst()
        }
        return lines.joined(separator: "\n")
    }
}
