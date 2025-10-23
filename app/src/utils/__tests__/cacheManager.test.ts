import { CacheManager, cacheManager } from '../cacheManager';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager();
  });

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      const data = { id: '1', name: 'Test' };
      cache.set('test-key', data);

      const retrieved = cache.get('test-key');
      expect(retrieved).toEqual(data);
    });

    it('should handle primitive types', () => {
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('boolean', true);
      cache.set('null', null);

      expect(cache.get('string')).toBe('hello');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('boolean')).toBe(true);
      expect(cache.get('null')).toBe(null);
    });

    it('should handle arrays', () => {
      const array = [1, 2, 3, { id: 'nested' }];
      cache.set('array', array);

      expect(cache.get('array')).toEqual(array);
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('does-not-exist')).toBeUndefined();
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return data within TTL', () => {
      cache.set('test', 'data');

      // Advance time by 4 seconds (within 5s default TTL)
      jest.advanceTimersByTime(4000);

      expect(cache.get('test')).toBe('data');
    });

    it('should return undefined after TTL expires', () => {
      cache.set('test', 'data');

      // Advance time by 6 seconds (beyond 5s default TTL)
      jest.advanceTimersByTime(6000);

      expect(cache.get('test')).toBeUndefined();
    });

    it('should support custom TTL', () => {
      cache.set('short-ttl', 'data');

      // Advance time by 2 seconds
      jest.advanceTimersByTime(2000);

      // Should still exist with 5s default TTL
      expect(cache.get('short-ttl', 5000)).toBe('data');

      // Should be expired with 1s TTL
      expect(cache.get('short-ttl', 1000)).toBeUndefined();
    });

    it('should delete expired entries on access', () => {
      cache.set('test', 'data');

      // Advance time beyond TTL
      jest.advanceTimersByTime(6000);

      // Access should delete the entry
      cache.get('test');

      // Verify it was actually deleted from cache
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('has', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for valid cached data', () => {
      cache.set('test', 'data');
      expect(cache.has('test')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('does-not-exist')).toBe(false);
    });

    it('should return false for expired data', () => {
      cache.set('test', 'data');

      // Advance time beyond TTL
      jest.advanceTimersByTime(6000);

      expect(cache.has('test')).toBe(false);
    });

    it('should support custom TTL', () => {
      cache.set('test', 'data');

      // Advance time by 2 seconds
      jest.advanceTimersByTime(2000);

      expect(cache.has('test', 5000)).toBe(true);
      expect(cache.has('test', 1000)).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should remove specific key', () => {
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');

      cache.invalidate('key1');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('data2');
    });

    it('should be safe to invalidate non-existent key', () => {
      expect(() => cache.invalidate('does-not-exist')).not.toThrow();
    });
  });

  describe('invalidatePattern', () => {
    beforeEach(() => {
      cache.set('user:1', { id: 1 });
      cache.set('user:2', { id: 2 });
      cache.set('post:1', { id: 1 });
      cache.set('post:2', { id: 2 });
      cache.set('comment:1', { id: 1 });
    });

    it('should invalidate keys matching string pattern', () => {
      cache.invalidatePattern('user:');

      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('post:1')).toBeDefined();
      expect(cache.get('post:2')).toBeDefined();
      expect(cache.get('comment:1')).toBeDefined();
    });

    it('should invalidate keys matching regex pattern', () => {
      cache.invalidatePattern(/^(user|post):/);

      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('post:1')).toBeUndefined();
      expect(cache.get('post:2')).toBeUndefined();
      expect(cache.get('comment:1')).toBeDefined();
    });

    it('should handle pattern matching no keys', () => {
      expect(() => cache.invalidatePattern('nonexistent')).not.toThrow();
      expect(cache.getStats().size).toBe(5);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');
      cache.set('key3', 'data3');

      expect(cache.getStats().size).toBe(3);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
    });

    it('should work on empty cache', () => {
      expect(() => cache.clear()).not.toThrow();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toEqual(['key1', 'key2']);
    });

    it('should return empty stats for empty cache', () => {
      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
    });

    it('should reflect current state after operations', () => {
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');
      cache.invalidate('key1');

      const stats = cache.getStats();

      expect(stats.size).toBe(1);
      expect(stats.keys).toEqual(['key2']);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(cacheManager).toBeDefined();
      expect(cacheManager).toBeInstanceOf(CacheManager);
    });

    it('should maintain state across imports', () => {
      cacheManager.set('shared-key', 'shared-data');

      // In real usage, this would be imported in another module
      expect(cacheManager.get('shared-key')).toBe('shared-data');

      // Clean up
      cacheManager.clear();
    });
  });

  describe('edge cases', () => {
    it('should handle overwriting existing keys', () => {
      cache.set('key', 'original');
      cache.set('key', 'updated');

      expect(cache.get('key')).toBe('updated');
    });

    it('should handle complex nested objects', () => {
      const complex = {
        id: '1',
        nested: {
          array: [1, 2, { deep: 'value' }],
          map: new Map([['key', 'value']]),
        },
        date: new Date('2025-01-01'),
      };

      cache.set('complex', complex);

      const retrieved = cache.get('complex');
      expect(retrieved).toEqual(complex);
    });

    it('should handle undefined values', () => {
      cache.set('undefined-value', undefined);

      // Undefined is stored but may be indistinguishable from missing
      const result = cache.get('undefined-value');
      expect(result).toBeUndefined();
    });
  });

  describe('concurrent access', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle multiple gets on same key', () => {
      cache.set('key', 'value');

      const result1 = cache.get('key');
      const result2 = cache.get('key');
      const result3 = cache.get('key');

      expect(result1).toBe('value');
      expect(result2).toBe('value');
      expect(result3).toBe('value');
    });

    it('should handle rapid set/get cycles', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      for (let i = 0; i < 100; i++) {
        expect(cache.get(`key${i}`)).toBe(`value${i}`);
      }
    });

    it('should handle interleaved operations', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.get('key1')).toBe('value1');

      cache.set('key3', 'value3');

      expect(cache.get('key2')).toBe('value2');

      cache.invalidate('key1');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key3')).toBe('value3');
    });
  });
});
