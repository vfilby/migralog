import Foundation

/// A typed destination parsed from an incoming `migralog://` deep link.
///
/// The Live Activity quick actions (see `EpisodeActivityDeepLink`) emit URLs
/// that the app receives via `onOpenURL`. `DeepLinkParser` converts those URLs
/// into one of these cases so the UI can route without string-matching in a view.
enum DeepLinkTarget: Equatable, Sendable {
    /// Open the Log Medication surface for the episode, filtered to rescue meds.
    case logRescueMed(episodeId: String)
    /// Open the intensity logger (`LogUpdateScreen`) for the episode.
    case logIntensity(episodeId: String)
    /// Open Episode Detail.
    case openEpisode(episodeId: String)
    /// Open Episode Detail and present the end-episode confirm.
    case endEpisode(episodeId: String)

    /// The episode the target acts on. Every case carries one.
    var episodeId: String {
        switch self {
        case let .logRescueMed(episodeId),
             let .logIntensity(episodeId),
             let .openEpisode(episodeId),
             let .endEpisode(episodeId):
            return episodeId
        }
    }
}

/// A surface `EpisodeDetailScreen` should present after a deep link selects an
/// episode. Kept distinct from `DeepLinkTarget` (which still carries the episode
/// id and is the parser's output) so the detail screen only observes the small
/// "what to show" decision.
enum PendingEpisodeAction: Equatable, Sendable {
    /// Present the rescue-filtered Log Medication sheet.
    case logMedication
    /// Present the intensity logger (`LogUpdateScreen`).
    case logIntensity
    /// Present the end-episode confirmation.
    case endConfirm
}

/// Pure, `Sendable` parser for `migralog://` deep links.
///
/// Kept free of any view/state so it is trivially unit-testable. Malformed,
/// non-`migralog`, or unrecognized URLs return `nil` rather than throwing, so the
/// caller can ignore them silently.
enum DeepLinkParser {
    /// Parse an incoming URL into a `DeepLinkTarget`, or `nil` if it is not a
    /// link we recognize.
    ///
    /// Recognized shapes (host `episode`):
    /// - `migralog://episode/<id>/log-med?category=rescue` → `.logRescueMed`
    /// - `migralog://episode/<id>/log-intensity`           → `.logIntensity`
    /// - `migralog://episode/<id>`                         → `.openEpisode`
    /// - `migralog://episode/<id>/end`                     → `.endEpisode`
    static func parse(_ url: URL) -> DeepLinkTarget? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme == EpisodeActivityDeepLink.scheme,
              components.host == "episode" else {
            return nil
        }

        // Split on "/" and drop empties so the leading slash and any trailing
        // slash don't produce blank segments; first segment is the episode id.
        let segments = components.path
            .split(separator: "/", omittingEmptySubsequences: true)
            .map(String.init)

        guard let episodeId = segments.first, !episodeId.isEmpty else {
            return nil
        }

        // No action segment → open detail.
        guard segments.count > 1 else {
            return .openEpisode(episodeId: episodeId)
        }

        switch segments[1] {
        case "log-med":
            // Only the rescue category is supported today; ignore an unexpected
            // `category` value gracefully and still open the rescue surface.
            return .logRescueMed(episodeId: episodeId)
        case "log-intensity":
            return .logIntensity(episodeId: episodeId)
        case "end":
            return .endEpisode(episodeId: episodeId)
        default:
            return nil
        }
    }
}
