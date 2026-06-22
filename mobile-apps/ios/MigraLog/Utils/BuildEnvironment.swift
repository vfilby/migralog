import Foundation

/// Describes the kind of build the app is running as, so pre-release-only
/// affordances (e.g. the "Load Sample Data" evaluation tool) can be shown in
/// DEBUG and TestFlight builds while staying hidden from App Store users.
enum BuildEnvironment {
    /// `true` for local DEBUG builds and TestFlight (sandbox receipt) installs;
    /// `false` for production App Store builds.
    ///
    /// TestFlight builds are signed with a `sandboxReceipt` rather than the
    /// production `receipt`, which is the standard runtime signal for an
    /// alpha/beta install.
    static var isPreRelease: Bool {
        #if DEBUG
        return true
        #else
        return Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        #endif
    }
}
