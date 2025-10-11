import * as Location from 'expo-location';
import { EpisodeLocation } from '../models/types';

class LocationService {
  private hasPermission: boolean = false;
  private lastLocation: EpisodeLocation | null = null;
  private lastLocationTime: number = 0;
  private readonly CACHE_DURATION_MS = 5000; // Cache location for 5 seconds

  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.hasPermission = status === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('Failed to request location permission:', error);
      return false;
    }
  }

  async checkPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      this.hasPermission = status === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('Failed to check location permission:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<EpisodeLocation | null> {
    try {
      // Return cached location if it's recent enough (within 5 seconds)
      const now = Date.now();
      if (this.lastLocation && (now - this.lastLocationTime) < this.CACHE_DURATION_MS) {
        console.log('[Location] Returning cached location from', (now - this.lastLocationTime), 'ms ago');
        return this.lastLocation;
      }

      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      console.log('[Location] Services enabled:', servicesEnabled);
      if (!servicesEnabled) {
        console.log('[Location] Location services are disabled');
        return null;
      }

      // Check if we have permission
      const hasPermission = await this.checkPermission();
      console.log('[Location] Has permission:', hasPermission);
      if (!hasPermission) {
        console.log('[Location] Location permission not granted');
        return null;
      }

      // Get current location
      console.log('[Location] Attempting to get current position...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        mayShowUserSettingsDialog: false,
        timeInterval: 1000,
        distanceInterval: 0,
      });

      console.log('[Location] Successfully got location:', {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });

      const episodeLocation: EpisodeLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };

      // Cache the location
      this.lastLocation = episodeLocation;
      this.lastLocationTime = now;

      return episodeLocation;
    } catch (error) {
      console.log('[Location] Failed to get current location');
      console.error('[Location] Error code:', (error as any)?.code);
      console.error('[Location] Error message:', (error as any)?.message);
      console.error('[Location] Full error:', JSON.stringify(error, null, 2));

      // Return cached location as fallback if available
      if (this.lastLocation) {
        console.log('[Location] Returning stale cached location as fallback');
        return this.lastLocation;
      }

      return null;
    }
  }

  async getLocationWithPermissionRequest(): Promise<EpisodeLocation | null> {
    try {
      // Request permission if not already granted
      if (!this.hasPermission) {
        const granted = await this.requestPermission();
        if (!granted) {
          console.log('Location permission denied');
          return null;
        }
      }

      return await this.getCurrentLocation();
    } catch (error) {
      console.error('Failed to get location with permission request:', error);
      return null;
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (results.length > 0) {
        const result = results[0];
        // Return coarse location: "City, State" or "City, Country"
        const parts = [];
        if (result.city) parts.push(result.city);
        if (result.region) parts.push(result.region);
        else if (result.country) parts.push(result.country);

        return parts.length > 0 ? parts.join(', ') : null;
      }

      return null;
    } catch (error) {
      console.error('Failed to reverse geocode:', error);
      return null;
    }
  }
}

export const locationService = new LocationService();
