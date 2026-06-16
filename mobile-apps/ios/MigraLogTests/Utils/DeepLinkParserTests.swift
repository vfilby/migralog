import XCTest
@testable import MigraLog

/// Unit tests for `DeepLinkParser`, which turns incoming `migralog://` URLs from
/// the Live Activity quick actions into typed `DeepLinkTarget` cases.
final class DeepLinkParserTests: XCTestCase {

    private let episodeId = "episode-123"

    private func url(_ string: String) -> URL {
        guard let url = URL(string: string) else {
            preconditionFailure("Invalid URL literal in test: \(string)")
        }
        return url
    }

    // MARK: - Recognized shapes

    func testParsesLogRescueMed() {
        let target = DeepLinkParser.parse(url("migralog://episode/\(episodeId)/log-med?category=rescue"))
        XCTAssertEqual(target, .logRescueMed(episodeId: episodeId))
    }

    func testParsesLogIntensity() {
        let target = DeepLinkParser.parse(url("migralog://episode/\(episodeId)/log-intensity"))
        XCTAssertEqual(target, .logIntensity(episodeId: episodeId))
    }

    func testParsesOpenEpisode() {
        let target = DeepLinkParser.parse(url("migralog://episode/\(episodeId)"))
        XCTAssertEqual(target, .openEpisode(episodeId: episodeId))
    }

    func testParsesEndEpisode() {
        let target = DeepLinkParser.parse(url("migralog://episode/\(episodeId)/end"))
        XCTAssertEqual(target, .endEpisode(episodeId: episodeId))
    }

    // MARK: - Round-trip with the builder the widget uses

    func testRoundTripsAllBuilderURLs() {
        XCTAssertEqual(
            DeepLinkParser.parse(EpisodeActivityDeepLink.logRescueMed(episodeId: episodeId)),
            .logRescueMed(episodeId: episodeId)
        )
        XCTAssertEqual(
            DeepLinkParser.parse(EpisodeActivityDeepLink.logIntensity(episodeId: episodeId)),
            .logIntensity(episodeId: episodeId)
        )
        XCTAssertEqual(
            DeepLinkParser.parse(EpisodeActivityDeepLink.openEpisode(episodeId: episodeId)),
            .openEpisode(episodeId: episodeId)
        )
        XCTAssertEqual(
            DeepLinkParser.parse(EpisodeActivityDeepLink.endEpisode(episodeId: episodeId)),
            .endEpisode(episodeId: episodeId)
        )
    }

    // MARK: - Rejected / malformed input

    func testRejectsGarbageURL() {
        XCTAssertNil(DeepLinkParser.parse(url("https://example.com/episode/123/end")))
    }

    func testRejectsWrongScheme() {
        XCTAssertNil(DeepLinkParser.parse(url("notmigralog://episode/\(episodeId)/end")))
    }

    func testRejectsWrongHost() {
        XCTAssertNil(DeepLinkParser.parse(url("migralog://medication/\(episodeId)")))
    }

    func testRejectsUnknownAction() {
        XCTAssertNil(DeepLinkParser.parse(url("migralog://episode/\(episodeId)/teleport")))
    }

    func testRejectsMissingEpisodeId() {
        XCTAssertNil(DeepLinkParser.parse(url("migralog://episode")))
        XCTAssertNil(DeepLinkParser.parse(url("migralog://episode/")))
    }
}
