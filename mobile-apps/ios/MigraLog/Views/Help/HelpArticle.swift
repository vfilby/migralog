import Foundation

/// A single user-guide page. The content itself lives in the repo-root
/// `user-guide/guide/*.md` files, which are bundled into the app as resources
/// (see `project.yml`) — the same Markdown that will drive the website, so there
/// is a single source of truth for help content.
struct HelpArticle: Identifiable, Hashable {
    /// The resource base name, matching the `.md` filename (without extension).
    let id: String
    let title: String
    let subtitle: String
    let systemImage: String

    /// Curated reading order (the filenames don't sort this way).
    static let all: [HelpArticle] = [
        HelpArticle(
            id: "tracking-philosophy",
            title: "How tracking works",
            subtitle: "The timeline-based approach and the three layers of tracking.",
            systemImage: "waveform.path.ecg"
        ),
        HelpArticle(
            id: "medications",
            title: "Medications",
            subtitle: "Adding medications, cooldowns, and overuse safety limits.",
            systemImage: "pills"
        ),
        HelpArticle(
            id: "calendar",
            title: "The calendar",
            subtitle: "Day-status colours, and logging clear or not-clear days.",
            systemImage: "calendar"
        ),
        HelpArticle(
            id: "trends-and-analytics",
            title: "Trends & analytics",
            subtitle: "Insights, charts, and the Doctor Visit Summary.",
            systemImage: "chart.xyaxis.line"
        ),
    ]

    static func find(id: String) -> HelpArticle? {
        all.first { $0.id == id }
    }

    /// Loads the bundled Markdown for this article. The files ship inside the
    /// `guide/` folder reference within the app bundle.
    func loadMarkdown() -> String {
        guard let url = Bundle.main.url(forResource: id, withExtension: "md", subdirectory: "guide"),
              let text = try? String(contentsOf: url, encoding: .utf8) else {
            return "This help page could not be loaded.\n\nYou can also read the guide at migralog.app."
        }
        return text
    }
}
