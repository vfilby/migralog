import SwiftUI
import CoreLocation
import UIKit

/// Privacy → Location Services as an inline toggle.
///
/// The toggle combines the app's own switch (`LocationService.enabledPreferenceKey`)
/// with the iOS permission:
///
/// - **Turning off** simply disables location *within the app* — no system trip,
///   even if iOS still grants permission. The app stops capturing location.
/// - **Turning on** enables it in the app, and additionally resolves the iOS
///   permission if needed: the first time it shows the system prompt; if iOS has
///   already denied it, it explains that and deep-links into MigraLog's own page
///   in iOS Settings (an app cannot grant its own permission).
///
/// `displayOn` is the toggle's shown state, kept in sync with the effective state
/// (`app-enabled AND iOS-authorized`). The Toggle's setter only fires on user
/// taps, so syncing `displayOn` programmatically never re-triggers side effects.
struct LocationToggleRow: View {
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage(LocationService.enabledPreferenceKey) private var locationEnabled = true
    @State private var authStatus = LocationService.shared.authorizationStatus
    @State private var displayOn = false
    @State private var showSettingsNotice = false

    private var isAuthorized: Bool {
        authStatus == .authorizedWhenInUse || authStatus == .authorizedAlways
    }

    var body: some View {
        Toggle(isOn: Binding(get: { displayOn }, set: userToggled)) {
            Label("Location Services", systemImage: "location")
        }
        .accessibilityIdentifier("location-toggle")
        .onAppear(perform: sync)
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { sync() }
        }
        .alert("Location Is Off in iOS Settings", isPresented: $showSettingsNotice) {
            Button("Open Settings") { openAppSettings() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Location is turned off for MigraLog in iOS Settings. "
                + "To turn it on, open Settings and allow Location.")
        }
    }

    /// Reflect the effective state into the toggle. Programmatic — does not run
    /// the user-tap side effects.
    private func sync() {
        authStatus = LocationService.shared.authorizationStatus
        displayOn = locationEnabled && isAuthorized
    }

    /// Handles a user tap on the toggle.
    private func userToggled(_ turnOn: Bool) {
        guard turnOn else {
            // Turning off only disables location within the app.
            locationEnabled = false
            displayOn = false
            return
        }

        // Turning on: enable in the app, then resolve iOS permission if needed.
        locationEnabled = true
        switch authStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            displayOn = true // already permitted — now active
        case .notDetermined:
            displayOn = true // optimistic; corrected once the prompt resolves
            Task {
                _ = await LocationService.shared.requestPermission()
                await MainActor.run { sync() }
            }
        default: // denied or restricted — only iOS Settings can grant it
            displayOn = false
            showSettingsNotice = true
        }
    }

    /// Opens MigraLog's own page in iOS Settings (not the general app list).
    private func openAppSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}
