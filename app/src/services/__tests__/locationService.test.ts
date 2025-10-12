import { locationService } from '../locationService';
import * as Location from 'expo-location';

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: {
    Low: 1,
    Balanced: 3,
    High: 4,
    Highest: 6,
    BestForNavigation: 5,
  },
}));

describe('locationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Reset locationService cache by setting lastLocationTime to 0
    (locationService as any).lastLocation = null;
    (locationService as any).lastLocationTime = 0;
    (locationService as any).hasPermission = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requestPermission', () => {
    it('should request and grant location permission', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await locationService.requestPermission();

      expect(result).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('should handle denied permission', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await locationService.requestPermission();

      expect(result).toBe(false);
    });

    it('should handle errors when requesting permission', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission request failed')
      );

      const result = await locationService.requestPermission();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to request location permission:',
        expect.any(Error)
      );
    });
  });

  describe('checkPermission', () => {
    it('should check if permission is granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await locationService.checkPermission();

      expect(result).toBe(true);
      expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('should check if permission is denied', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await locationService.checkPermission();

      expect(result).toBe(false);
    });

    it('should handle errors when checking permission', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Check failed')
      );

      const result = await locationService.checkPermission();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to check location permission:',
        expect.any(Error)
      );
    });
  });

  describe('getCurrentLocation', () => {
    it('should get current location when permission is granted', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
        },
        timestamp: 1234567890,
      });

      const location = await locationService.getCurrentLocation();

      expect(location).toEqual({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        timestamp: 1234567890,
      });

      expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
        accuracy: Location.Accuracy.Low,
        mayShowUserSettingsDialog: false,
        timeInterval: 1000,
        distanceInterval: 0,
      });
    });

    it('should return null when permission is not granted', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const location = await locationService.getCurrentLocation();

      expect(location).toBe(null);
      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('should handle location without accuracy field', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
        timestamp: 1234567890,
      });

      const location = await locationService.getCurrentLocation();

      expect(location).toEqual({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: undefined,
        timestamp: 1234567890,
      });
    });

    it('should handle errors when getting location', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(
        new Error('Location unavailable')
      );

      const location = await locationService.getCurrentLocation();

      expect(location).toBe(null);
    });
  });

  describe('getLocationWithPermissionRequest', () => {
    it('should request permission and get location', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
        },
        timestamp: 1234567890,
      });

      const location = await locationService.getLocationWithPermissionRequest();

      expect(location).toEqual({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 5,
        timestamp: 1234567890,
      });
    });

    it('should return null if permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const location = await locationService.getLocationWithPermissionRequest();

      expect(location).toBe(null);
    });

    it('should handle errors during permission request', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission failed')
      );

      await expect(
        locationService.getLocationWithPermissionRequest()
      ).resolves.toBe(null);
    });
  });

  describe('reverseGeocode', () => {
    it('should return city and region', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        {
          city: 'San Francisco',
          region: 'CA',
          country: 'USA',
        },
      ]);

      const result = await locationService.reverseGeocode(37.7749, -122.4194);

      expect(result).toBe('San Francisco, CA');
      expect(Location.reverseGeocodeAsync).toHaveBeenCalledWith({
        latitude: 37.7749,
        longitude: -122.4194,
      });
    });

    it('should return city and country when region is missing', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        {
          city: 'Paris',
          country: 'France',
        },
      ]);

      const result = await locationService.reverseGeocode(48.8566, 2.3522);

      expect(result).toBe('Paris, France');
    });

    it('should return null if no results', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([]);

      const result = await locationService.reverseGeocode(0, 0);

      expect(result).toBe(null);
    });

    it('should return country if only country available', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        {
          country: 'USA',
        },
      ]);

      const result = await locationService.reverseGeocode(37.7749, -122.4194);

      // Returns just country if city/region not available
      expect(result).toBe('USA');
    });

    it('should handle errors during reverse geocoding', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValue(
        new Error('Geocoding failed')
      );

      const result = await locationService.reverseGeocode(37.7749, -122.4194);

      expect(result).toBe(null);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to reverse geocode:',
        expect.any(Error)
      );
    });

    it('should handle partial location data', async () => {
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        {
          city: 'Los Angeles',
          region: undefined,
          country: 'USA',
        },
      ]);

      const result = await locationService.reverseGeocode(34.0522, -118.2437);

      expect(result).toBe('Los Angeles, USA');
    });
  });
});
