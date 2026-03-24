import XCTest
import CoreLocation
@testable import MigraLog

// MARK: - Mock Location Manager

final class MockLocationManager: LocationManagerProtocol {
    weak var delegate: CLLocationManagerDelegate?
    var desiredAccuracy: CLLocationAccuracy = kCLLocationAccuracyBest
    var authorizationStatus: CLAuthorizationStatus = .notDetermined

    var requestWhenInUseAuthorizationCalled = false
    var requestLocationCalled = false

    /// When set, simulates a location response after requestLocation
    var simulatedLocation: CLLocation?
    /// When set, simulates an error after requestLocation
    var simulatedError: Error?
    /// When set, simulates an authorization change after requestWhenInUseAuthorization
    var simulatedAuthorizationStatus: CLAuthorizationStatus?

    func requestWhenInUseAuthorization() {
        requestWhenInUseAuthorizationCalled = true

        if let newStatus = simulatedAuthorizationStatus {
            authorizationStatus = newStatus
            // Simulate the delegate callback
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                if let mgr = self as? CLLocationManager {
                    self.delegate?.locationManagerDidChangeAuthorization?(mgr)
                } else {
                    // For testing, we call the delegate method with a real CLLocationManager
                    // but that won't work well. Instead, use a workaround.
                    self.notifyAuthorizationChange()
                }
            }
        }
    }

    func requestLocation() {
        requestLocationCalled = true

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if let error = self.simulatedError {
                self.notifyError(error)
            } else if let location = self.simulatedLocation {
                self.notifyLocation(location)
            }
        }
    }

    // MARK: - Notification Helpers

    private func notifyAuthorizationChange() {
        // We need a real CLLocationManager for the delegate callback
        // So we directly invoke the LocationService method via its protocol
        guard let service = delegate as? LocationService else { return }
        // Use the real callback
        let mgr = CLLocationManager()
        // Unfortunately we can't set authorizationStatus on a real CLLocationManager
        // Instead, we test through the service's public API
        service.locationManagerDidChangeAuthorization(mgr)
    }

    private func notifyLocation(_ location: CLLocation) {
        let mgr = CLLocationManager()
        delegate?.locationManager?(mgr, didUpdateLocations: [location])
    }

    private func notifyError(_ error: Error) {
        let mgr = CLLocationManager()
        delegate?.locationManager?(mgr, didFailWithError: error)
    }
}

// MARK: - Tests

final class LocationServiceTests: XCTestCase {
    private var mockManager: MockLocationManager!
    private var locationService: LocationService!

    override func setUp() {
        mockManager = MockLocationManager()
        locationService = LocationService(locationManager: mockManager, timeoutSeconds: 1.0)
    }

    override func tearDown() {
        locationService = nil
        mockManager = nil
    }

    // MARK: - Permission Already Granted

    func testRequestPermissionWhenAlreadyAuthorized() async {
        mockManager.authorizationStatus = .authorizedWhenInUse

        let granted = await locationService.requestPermission()

        XCTAssertTrue(granted)
        XCTAssertFalse(mockManager.requestWhenInUseAuthorizationCalled)
    }

    func testRequestPermissionWhenAlreadyAuthorizedAlways() async {
        mockManager.authorizationStatus = .authorizedAlways

        let granted = await locationService.requestPermission()

        XCTAssertTrue(granted)
    }

    // MARK: - Permission Denied

    func testRequestPermissionWhenDenied() async {
        mockManager.authorizationStatus = .denied

        let granted = await locationService.requestPermission()

        XCTAssertFalse(granted)
    }

    func testRequestPermissionWhenRestricted() async {
        mockManager.authorizationStatus = .restricted

        let granted = await locationService.requestPermission()

        XCTAssertFalse(granted)
    }

    // MARK: - Get Location Without Permission

    func testGetCurrentLocationWithoutPermission() async {
        mockManager.authorizationStatus = .denied

        let result = await locationService.getCurrentLocation()

        XCTAssertNil(result, "Should return nil when permission not granted")
        XCTAssertFalse(mockManager.requestLocationCalled)
    }

    func testGetCurrentLocationNotDetermined() async {
        mockManager.authorizationStatus = .notDetermined

        let result = await locationService.getCurrentLocation()

        XCTAssertNil(result, "Should return nil when permission not determined")
    }

    // MARK: - Get Location With Permission

    func testGetCurrentLocationSuccess() async throws {
        mockManager.authorizationStatus = .authorizedWhenInUse
        mockManager.simulatedLocation = CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: 45.5, longitude: -122.6),
            altitude: 0,
            horizontalAccuracy: 50.0,
            verticalAccuracy: 0,
            timestamp: Date()
        )

        let result = await locationService.getCurrentLocation()

        let unwrapped = try XCTUnwrap(result)
        XCTAssertEqual(unwrapped.latitude, 45.5, accuracy: 0.001)
        XCTAssertEqual(unwrapped.longitude, -122.6, accuracy: 0.001)
        XCTAssertEqual(unwrapped.accuracy, 50.0, accuracy: 0.001)
        XCTAssertTrue(mockManager.requestLocationCalled)
    }

    // MARK: - Get Location Error

    func testGetCurrentLocationError() async {
        mockManager.authorizationStatus = .authorizedWhenInUse
        mockManager.simulatedError = NSError(
            domain: kCLErrorDomain,
            code: CLError.locationUnknown.rawValue
        )

        let result = await locationService.getCurrentLocation()

        XCTAssertNil(result, "Should return nil on error")
    }

    // MARK: - Location Timeout

    func testGetCurrentLocationTimeout() async {
        mockManager.authorizationStatus = .authorizedWhenInUse
        // Don't set simulatedLocation or simulatedError - triggers timeout

        let result = await locationService.getCurrentLocation()

        XCTAssertNil(result, "Should return nil on timeout")
    }

    // MARK: - Location Result

    func testLocationResultEquality() {
        let loc1 = LocationResult(latitude: 45.5, longitude: -122.6, accuracy: 50.0)
        let loc2 = LocationResult(latitude: 45.5, longitude: -122.6, accuracy: 50.0)
        let loc3 = LocationResult(latitude: 46.0, longitude: -122.6, accuracy: 50.0)

        XCTAssertEqual(loc1, loc2)
        XCTAssertNotEqual(loc1, loc3)
    }

    // MARK: - Desired Accuracy

    func testDesiredAccuracyIsSet() {
        XCTAssertEqual(
            mockManager.desiredAccuracy,
            kCLLocationAccuracyHundredMeters,
            "Should use hundred-meter accuracy"
        )
    }
}
