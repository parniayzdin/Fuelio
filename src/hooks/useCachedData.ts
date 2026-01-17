import { useState, useEffect, useCallback } from 'react';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface UseCachedDataOptions {
    cacheKey: string;
    ttlMs?: number; // Time to live in milliseconds, default 5 minutes
    staleWhileRevalidate?: boolean;
}

const cache = new Map<string, CacheEntry<any>>();

/**
 * Custom hook for caching API data with optional stale-while-revalidate pattern
 * 
 * Usage:
 * const { data, isLoading, isStale, refresh } = useCachedData(
 *   'prices-toronto',
 *   () => fetchPrices('toronto'),
 *   { ttlMs: 60000 }
 * );
 */
export function useCachedData<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    options: Partial<UseCachedDataOptions> = {}
) {
    const { ttlMs = 5 * 60 * 1000, staleWhileRevalidate = true } = options;

    const [data, setData] = useState<T | null>(() => {
        const cached = cache.get(cacheKey);
        return cached ? cached.data : null;
    });
    const [isLoading, setIsLoading] = useState(!data);
    const [isStale, setIsStale] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
        const cached = cache.get(cacheKey);
        return cached ? new Date(cached.timestamp) : null;
    });

    const fetchData = useCallback(async (force = false) => {
        const cached = cache.get(cacheKey);
        const now = Date.now();

        // Return cached data if still fresh and not forcing refresh
        if (!force && cached && (now - cached.timestamp) < ttlMs) {
            setData(cached.data);
            setIsLoading(false);
            setIsStale(false);
            return cached.data;
        }

        // Show stale data while fetching new data
        if (staleWhileRevalidate && cached) {
            setData(cached.data);
            setIsStale(true);
        }

        setIsLoading(!cached);

        try {
            const freshData = await fetcher();
            cache.set(cacheKey, { data: freshData, timestamp: now });
            setData(freshData);
            setIsStale(false);
            setLastUpdated(new Date(now));
            setError(null);
            return freshData;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch data'));
            // Keep stale data on error
            if (cached) {
                setData(cached.data);
                setIsStale(true);
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [cacheKey, fetcher, ttlMs, staleWhileRevalidate]);

    const refresh = useCallback(() => fetchData(true), [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        data,
        isLoading,
        isStale,
        error,
        lastUpdated,
        refresh,
    };
}

/**
 * Clear specific cache entry or all cache
 */
export function clearCache(cacheKey?: string) {
    if (cacheKey) {
        cache.delete(cacheKey);
    } else {
        cache.clear();
    }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
    const entries: { key: string; age: number }[] = [];
    const now = Date.now();

    cache.forEach((entry, key) => {
        entries.push({
            key,
            age: now - entry.timestamp,
        });
    });

    return {
        size: cache.size,
        entries,
    };
}
