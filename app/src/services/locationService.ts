import * as Location from 'expo-location';
import { EpisodeLocation } from '../models/types';

class LocationService {
  private hasPermission: boolean = false;

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
      // Check if we have permission
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        console.log('Location permission not granted');
        return null;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('Failed to get current location:', error);
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
