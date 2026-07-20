import Foundation

extension Notification.Name {
    static let medicationDataChanged = Notification.Name("medicationDataChanged")
    static let episodeDataChanged = Notification.Name("episodeDataChanged")
    static let dailyStatusDataChanged = Notification.Name("dailyStatusDataChanged")
    /// A 2h dose check-in notification was tapped; userInfo carries "episodeId".
    /// Posted by `NotificationResponseHandler`, observed by `ContentView` to
    /// route to the episode's Log Update screen.
    static let doseCheckinTapped = Notification.Name("doseCheckinTapped")
}
