import SwiftUI
import WidgetKit

/// Entry point for the MigraLog widget extension. For v1 it vends only the
/// episode Live Activity; Home Screen / Lock Screen widgets are out of scope
/// (#416).
@main
struct MigraLogWidgetsBundle: WidgetBundle {
    var body: some Widget {
        EpisodeLiveActivity()
    }
}
