/**
 * Simple in-memory cache with TTL support
 * Used for dashboard metrics and frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number = 60000): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Get or set cache with a factory function
 */
export async function getOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlMs: number = 60000
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return cached;

  const data = await factory();
  setCache(key, data, ttlMs);
  return data;
}
