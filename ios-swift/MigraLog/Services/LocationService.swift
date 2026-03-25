import Foundation
import CoreLocation

// MARK: - Location Result

struct LocationResult: Equatable, Sendable {
    let latitude: Double
    let longitude: Double
    let accuracy: Double
}

// MARK: - Protocol

protocol LocationServiceProtocol {
    func requestPermission() async -> Bool
    func getCurrentLocation() async -> LocationResult?
}

// MARK: - Location Manager Protocol (for testability)

protocol LocationManagerProtocol: AnyObject {
    var delegate: CLLocationManagerDelegate? { get set }
    var desiredAccuracy: CLLocationAccuracy { get set }
    var authorizationStatus: CLAuthorizationStatus { get }
    func requestWhenInUseAuthorization()
    func requestLocation()
}

extension CLLocationManager: LocationManagerProtocol {}

// MARK: - Location Service

final class LocationService: NSObject, LocationServiceProtocol {
    static let shared = LocationService()

    private let locationManager: LocationManagerProtocol
    private let logger = AppLogger.shared
    private let timeoutSeconds: TimeInterval

    private var permissionContinuation: CheckedContinuation<Bool, Never>?
    private var locationContinuation: CheckedContinuation<LocationResult?, Never>?

    /// Current authorization status.
    var authorizationStatus: CLAuthorizationStatus {
        locationManager.authorizationStatus
    }

    init(
        locationManager: LocationManagerProtocol = CLLocationManager(),
        timeoutSeconds: TimeInterval = 10.0
    ) {
        self.locationManager = locationManager
        self.timeoutSeconds = timeoutSeconds
        super.init()
        self.locationManager.delegate = self
        self.locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    /// Synchronous convenience that requests permission (non-blocking, fires the system dialog).
    func requestPermission() {
        locationManager.requestWhenInUseAuthorization()
    }

    // MARK: - Permission

    func requestPermission() async -> Bool {
        let status = locationManager.authorizationStatus

        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            return true
        case .denied, .restricted:
            logger.info("Location permission denied or restricted")
            return false
        case .notDetermined:
            return await withCheckedContinuation { continuation in
                self.permissionContinuation = continuation
                self.locationManager.requestWhenInUseAuthorization()
            }
        @unknown default:
            return false
        }
    }

    // MARK: - Get Current Location

    func getCurrentLocation() async -> LocationResult? {
        let status = locationManager.authorizationStatus
        guard status == .authorizedWhenInUse || status == .authorizedAlways else {
            logger.info("Location not authorized, returning nil")
            return nil
        }

        return await withCheckedContinuation { continuation in
            self.locationContinuation = continuation

            self.locationManager.requestLocation()

            // Timeout after configured seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + self.timeoutSeconds) { [weak self] in
                if let continuation = self?.locationContinuation {
                    self?.locationContinuation = nil
                    self?.logger.warn("Location request timed out")
                    continuation.resume(returning: nil)
                }
            }
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationService: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        let result = LocationResult(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracy: location.horizontalAccuracy
        )

        if let continuation = locationContinuation {
            locationContinuation = nil
            continuation.resume(returning: result)
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        logger.error("Location request failed", error: error)

        if let continuation = locationContinuation {
            locationContinuation = nil
            continuation.resume(returning: nil)
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        guard status != .notDetermined else { return }

        let granted = status == .authorizedWhenInUse || status == .authorizedAlways

        if let continuation = permissionContinuation {
            permissionContinuation = nil
            continuation.resume(returning: granted)
        }
    }
}
