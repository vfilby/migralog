import SwiftUI

/// Settings → User Guide. Lists the user-guide topics; each opens an article
/// rendered from the bundled Markdown.
struct HelpScreen: View {
    var body: some View {
        List {
            Section {
                ForEach(HelpArticle.all) { article in
                    NavigationLink {
                        HelpArticleScreen(article: article)
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(article.title)
                                Text(article.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: article.systemImage)
                                .foregroundStyle(DesignTokens.Brand.orange)
                        }
                    }
                    .accessibilityIdentifier("help-\(article.id)")
                }
            } footer: {
                Text("Guides for getting the most out of MigraLog. The same content is available at migralog.app.")
            }

            Section {
                NavigationLink {
                    TipsAndChecklistScreen()
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Tips & Reminders")
                            Text("Manage dashboard tips and the setup checklist")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "lightbulb")
                            .foregroundStyle(DesignTokens.Brand.orange)
                    }
                }
                .accessibilityIdentifier("help-tips-and-reminders")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("User Guide")
        .readableContentWidth()
    }
}
