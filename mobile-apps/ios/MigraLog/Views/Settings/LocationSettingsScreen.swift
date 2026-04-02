import SwiftUI
import CoreLocation

struct LocationSettingsScreen: View {
    @State private var authStatus: CLAuthorizationStatus = .notDetermined

    var body: some View {
        List {
            Section {
                HStack {
                    Text("Location Permission")
                    Spacer()
                    Text(statusText)
                        .foregroundStyle(.secondary)
                }

                if authStatus == .notDetermined {
                    Button("Request Permission") {
                        LocationService.shared.requestPermission()
                    }
                } else if authStatus == .denied || authStatus == .restricted {
                    Button("Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                }
            } footer: {
                Text("Location is used to correlate environmental factors with migraine episodes.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Location Services")
        .onAppear {
            authStatus = LocationService.shared.authorizationStatus
        }
    }

    private var statusText: String {
        switch authStatus {
        case .authorizedWhenInUse: return "When In Use"
        case .authorizedAlways: return "Always"
        case .denied: return "Denied"
        case .restricted: return "Restricted"
        case .notDetermined: return "Not Set"
        @unknown default: return "Unknown"
        }
    }
}
