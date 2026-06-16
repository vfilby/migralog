import Foundation

/// Builds the `migralog://` deep links used by the Live Activity quick actions.
///
/// Lives in shared sources so the widget extension (which builds the links) and
/// the app (which parses them — see Phase 3 routing) agree on the URL shape. The
/// links are inert until the app registers the `migralog` URL scheme and handles
/// them in `onOpenURL`.
enum EpisodeActivityDeepLink {
    static let scheme = "migralog"

    /// Log a rescue dose for the episode, pre-filtered to rescue categories.
    static func logRescueMed(episodeId: String) -> URL {
        build(host: "episode", path: episodeId, action: "log-med", query: ["category": "rescue"])
    }

    /// Open the intensity logger for the episode.
    static func logIntensity(episodeId: String) -> URL {
        build(host: "episode", path: episodeId, action: "log-intensity")
    }

    /// Open Episode Detail.
    static func openEpisode(episodeId: String) -> URL {
        build(host: "episode", path: episodeId, action: nil)
    }

    /// End the episode (the app presents a confirm before ending).
    static func endEpisode(episodeId: String) -> URL {
        build(host: "episode", path: episodeId, action: "end")
    }

    private static func build(host: String, path: String, action: String?, query: [String: String] = [:]) -> URL {
        var components = URLComponents()
        components.scheme = scheme
        components.host = host
        // Percent-encode the (untrusted-length) episode id path segment so an
        // unexpected id never yields a nil URL that would crash the widget.
        let encoded = path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path
        var fullPath = "/\(encoded)"
        if let action { fullPath += "/\(action)" }
        components.path = fullPath
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        // Fall back to a bare scheme URL rather than force-unwrapping, so a
        // malformed component can never crash the extension.
        return components.url ?? URL(string: "\(scheme)://\(host)")!
    }
}
