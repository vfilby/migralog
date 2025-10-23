/**
 * Cache Manager
 * Provides TTL (Time-To-Live) based caching for store data
 * Prevents excessive database queries on rapid screen focus events
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL: number = 5000; // 5 seconds default

  /**
   * Get cached data if it exists and is not stale
   * @param key - Cache key
   * @param ttl - Time to live in milliseconds (default: 5000ms)
   * @returns Cached data or undefined if stale/missing
   */
  get<T>(key: string, ttl: number = this.defaultTTL): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if data is stale
    if (age > ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  /**
   * Set cached data with current timestamp
   * @param key - Cache key
   * @param data - Data to cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if cache has valid (non-stale) entry
   * @param key - Cache key
   * @param ttl - Time to live in milliseconds (default: 5000ms)
   * @returns true if valid cached data exists
   */
  has(key: string, ttl: number = this.defaultTTL): boolean {
    return this.get(key, ttl) !== undefined;
  }

  /**
   * Invalidate (delete) cached entry
   * @param key - Cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cached entries matching a pattern
   * @param pattern - String or RegExp to match against keys
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Export class for testing
export { CacheManager };
