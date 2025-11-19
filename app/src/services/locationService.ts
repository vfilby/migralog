import * as Location from 'expo-location';
import { logger } from '../utils/logger';
import { EpisodeLocation } from '../models/types';

interface GeocodeQueueItem {
  latitude: number;
  longitude: number;
  resolve: (value: string | null) => void;
  reject: (error: Error) => void;
}

class LocationService {
  private hasPermission: boolean = false;
  private lastLocation: EpisodeLocation | null = null;
  private lastLocationTime: number = 0;
  private readonly CACHE_DURATION_MS = 5000; // Cache location for 5 seconds

  // Reverse geocoding cache and rate limiting
  private geocodeCache: Map<string, { address: string | null; timestamp: number }> = new Map();
  private readonly GEOCODE_CACHE_DURATION_MS = 3600000; // Cache for 1 hour
  private geocodeQueue: GeocodeQueueItem[] = [];
  private isProcessingQueue: boolean = false;
  private lastGeocodeTime: number = 0;
  private readonly MIN_GEOCODE_INTERVAL_MS = 1000; // Min 1 second between requests

  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.hasPermission = status === 'granted';
      return this.hasPermission;
    } catch (error) {
      logger.error('Failed to request location permission:', error);
      return false;
    }
  }

  async checkPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      this.hasPermission = status === 'granted';
      return this.hasPermission;
    } catch (error) {
      logger.error('Failed to check location permission:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<EpisodeLocation | null> {
    try {
      // Return cached location if it's recent enough (within 5 seconds)
      const now = Date.now();
      if (this.lastLocation && (now - this.lastLocationTime) < this.CACHE_DURATION_MS) {
        logger.log('[Location] Returning cached location from', (now - this.lastLocationTime), 'ms ago');
        return this.lastLocation;
      }

      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      logger.log('[Location] Services enabled:', servicesEnabled);
      if (!servicesEnabled) {
        logger.log('[Location] Location services are disabled');
        return null;
      }

      // Check if we have permission
      const hasPermission = await this.checkPermission();
      logger.log('[Location] Has permission:', hasPermission);
      if (!hasPermission) {
        logger.log('[Location] Location permission not granted');
        return null;
      }

      // Get current location
      logger.log('[Location] Attempting to get current position...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        mayShowUserSettingsDialog: false,
        timeInterval: 1000,
        distanceInterval: 0,
      });

      logger.log('[Location] Successfully got location:', {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });

      const episodeLocation: EpisodeLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: Math.floor(location.timestamp),
      };

      // Cache the location
      this.lastLocation = episodeLocation;
      this.lastLocationTime = now;

      return episodeLocation;
    } catch (error) {
      logger.log('[Location] Failed to get current location');
      // Error object structure is not typed by expo-location
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger.error('[Location] Error code:', (error as any)?.code);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger.error('[Location] Error message:', (error as any)?.message);
      logger.error('[Location] Full error:', JSON.stringify(error, null, 2));

      // Return cached location as fallback if available
      if (this.lastLocation) {
        logger.log('[Location] Returning stale cached location as fallback');
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
          logger.log('Location permission denied');
          return null;
        }
      }

      return await this.getCurrentLocation();
    } catch (error) {
      logger.error('Failed to get location with permission request:', error);
      return null;
    }
  }

  /**
   * Process the geocoding queue with rate limiting
   * Ensures requests are spaced out by MIN_GEOCODE_INTERVAL_MS
   */
  private async processGeocodeQueue(): Promise<void> {
    if (this.isProcessingQueue || this.geocodeQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.geocodeQueue.length > 0) {
      const item = this.geocodeQueue.shift();
      if (!item) break;

      // Rate limiting: wait if needed to avoid hitting API limits
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastGeocodeTime;
      if (timeSinceLastRequest < this.MIN_GEOCODE_INTERVAL_MS) {
        const waitTime = this.MIN_GEOCODE_INTERVAL_MS - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: item.latitude,
          longitude: item.longitude,
        });

        this.lastGeocodeTime = Date.now();

        if (results.length > 0) {
          const result = results[0];
          // Return coarse location: "City, State" or "City, Country"
          const parts = [];
          if (result.city) parts.push(result.city);
          if (result.region) parts.push(result.region);
          else if (result.country) parts.push(result.country);

          const address = parts.length > 0 ? parts.join(', ') : null;

          // Cache the result
          const cacheKey = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
          this.geocodeCache.set(cacheKey, {
            address,
            timestamp: Date.now(),
          });

          item.resolve(address);
        } else {
          item.resolve(null);
        }
      } catch (error) {
        logger.error('Failed to reverse geocode:', error);
        item.resolve(null); // Resolve with null instead of rejecting to avoid breaking UI
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Reverse geocode a lat/lng coordinate to a human-readable address
   * Uses caching and rate limiting to avoid API rate limits
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    // Round coordinates to 4 decimal places for cache key (~11m precision)
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

    // Check cache first
    const cached = this.geocodeCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.GEOCODE_CACHE_DURATION_MS) {
        return cached.address;
      } else {
        // Cache expired, remove it
        this.geocodeCache.delete(cacheKey);
      }
    }

    // Add to queue and process
    return new Promise((resolve, reject) => {
      this.geocodeQueue.push({ latitude, longitude, resolve, reject });
      this.processGeocodeQueue();
    });
  }
}

export const locationService = new LocationService();
