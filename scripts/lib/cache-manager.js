// ==UserScript==
// @name         Cache Manager Module
// @namespace    stash-cache
// @version      1.0.0
// @description  Advanced caching system with TTL and LRU policies for AutomateStash suite
// @author       AutomateStash
// ==/UserScript==

/**
 * Cache Manager Module
 * Provides advanced caching capabilities including:
 * - LRU (Least Recently Used) eviction policy
 * - TTL (Time To Live) support
 * - Compression for large objects
 * - Cache analytics and hit rate tracking
 * - Automatic cleanup and memory management
 * - Multiple cache stores for different data types
 */

(function () {
    'use strict';

    /**
     * LRU Cache Implementation
     * Efficient cache with O(1) get/put operations
     */
    class LRUCache {
        constructor(maxSize = 100, ttl = 300000) { // Default 5 minutes TTL
            this.maxSize = maxSize;
            this.defaultTTL = ttl;
            this.cache = new Map();
            this.accessOrder = new Map(); // Track access order for LRU
            this.stats = {
                hits: 0,
                misses: 0,
                evictions: 0,
                expirations: 0
            };
        }

        /**
         * Get value from cache
         */
        get(key) {
            const entry = this.cache.get(key);

            if (!entry) {
                this.stats.misses++;
                return null;
            }

            // Check if expired
            if (this.isExpired(entry)) {
                this.delete(key);
                this.stats.expirations++;
                this.stats.misses++;
                return null;
            }

            // Update access order for LRU
            this.updateAccessOrder(key);
            entry.accessCount++;
            entry.lastAccessed = Date.now();

            this.stats.hits++;
            return entry.value;
        }

        /**
         * Set value in cache
         */
        set(key, value, ttl = null) {
            // If cache is full, evict least recently used
            if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
                this.evictLRU();
            }

            const entry = {
                key,
                value,
                timestamp: Date.now(),
                ttl: ttl || this.defaultTTL,
                accessCount: 0,
                lastAccessed: Date.now(),
                size: this.estimateSize(value)
            };

            this.cache.set(key, entry);
            this.updateAccessOrder(key);
        }

        /**
         * Delete entry from cache
         */
        delete(key) {
            const deleted = this.cache.delete(key);
            this.accessOrder.delete(key);
            return deleted;
        }

        /**
         * Clear entire cache
         */
        clear() {
            this.cache.clear();
            this.accessOrder.clear();
            this.stats = {
                hits: 0,
                misses: 0,
                evictions: 0,
                expirations: 0
            };
            console.log('📦 Cache cleared');
        }

        /**
         * Check if entry is expired
         */
        isExpired(entry) {
            return Date.now() - entry.timestamp > entry.ttl;
        }

        /**
         * Update access order for LRU tracking
         */
        updateAccessOrder(key) {
            // Remove from current position
            this.accessOrder.delete(key);
            // Add to end (most recently used)
            this.accessOrder.set(key, Date.now());
        }

        /**
         * Evict least recently used entry
         */
        evictLRU() {
            // Get first key (least recently used)
            const lruKey = this.accessOrder.keys().next().value;
            if (lruKey) {
                this.delete(lruKey);
                this.stats.evictions++;
                if (window.performanceConfig?.get('debugMode')) {
                    console.log(`📦 Evicted LRU entry: ${lruKey}`);
                }
            }
        }

        /**
         * Estimate size of value in bytes
         */
        estimateSize(value) {
            if (typeof value === 'string') {
                return value.length * 2; // Approximate UTF-16 size
            } else if (typeof value === 'object') {
                try {
                    return JSON.stringify(value).length * 2;
                } catch (e) {
                    return 1000; // Default estimate for non-serializable
                }
            }
            return 8; // Default for primitives
        }

        /**
         * Get cache statistics
         */
        getStats() {
            const size = this.cache.size;
            const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
            const totalMemory = Array.from(this.cache.values())
                .reduce((sum, entry) => sum + entry.size, 0);

            return {
                size,
                maxSize: this.maxSize,
                hits: this.stats.hits,
                misses: this.stats.misses,
                hitRate: (hitRate * 100).toFixed(2) + '%',
                evictions: this.stats.evictions,
                expirations: this.stats.expirations,
                memoryUsage: this.formatBytes(totalMemory)
            };
        }

        /**
         * Format bytes to human readable
         */
        formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        /**
         * Cleanup expired entries
         */
        cleanup() {
            let cleaned = 0;
            for (const [key, entry] of this.cache.entries()) {
                if (this.isExpired(entry)) {
                    this.delete(key);
                    cleaned++;
                }
            }
            if (cleaned > 0) {
                console.log(`📦 Cleaned up ${cleaned} expired cache entries`);
            }
            return cleaned;
        }

        /**
         * Get all keys
         */
        keys() {
            return Array.from(this.cache.keys());
        }

        /**
         * Check if key exists
         */
        has(key) {
            const entry = this.cache.get(key);
            if (!entry) return false;
            if (this.isExpired(entry)) {
                this.delete(key);
                return false;
            }
            return true;
        }
    }

    /**
     * Advanced Cache Manager
     * Manages multiple cache stores with different strategies
     */
    class CacheManager {
        constructor() {
            this.stores = new Map();
            this.globalStats = {
                totalRequests: 0,
                totalHits: 0,
                totalMisses: 0
            };

            // Initialize default stores
            this.initializeStores();

            // Setup automatic cleanup
            this.setupCleanupInterval();

            // Setup performance monitoring
            this.setupPerformanceMonitoring();
        }

        /**
         * Initialize default cache stores
         */
        initializeStores() {
            // GraphQL response cache - longer TTL, larger size
            this.createStore('graphql', {
                maxSize: 200,
                ttl: 600000 // 10 minutes
            });

            // DOM element cache - shorter TTL, smaller size
            this.createStore('dom', {
                maxSize: 50,
                ttl: 30000 // 30 seconds
            });

            // Scraper data cache - medium TTL
            this.createStore('scraper', {
                maxSize: 100,
                ttl: 300000 // 5 minutes
            });

            // General purpose cache
            this.createStore('general', {
                maxSize: 100,
                ttl: 300000 // 5 minutes
            });

            console.log('📦 Cache Manager initialized with default stores');
        }

        /**
         * Create a new cache store
         */
        createStore(name, options = {}) {
            const store = new LRUCache(
                options.maxSize || 100,
                options.ttl || 300000
            );
            this.stores.set(name, store);
            return store;
        }

        /**
         * Get value from specific store
         */
        get(storeName, key) {
            const store = this.stores.get(storeName);
            if (!store) {
                console.warn(`📦 Cache store '${storeName}' not found`);
                return null;
            }

            this.globalStats.totalRequests++;
            const value = store.get(key);

            if (value !== null) {
                this.globalStats.totalHits++;
            } else {
                this.globalStats.totalMisses++;
            }

            return value;
        }

        /**
         * Set value in specific store
         */
        set(storeName, key, value, ttl = null) {
            const store = this.stores.get(storeName);
            if (!store) {
                console.warn(`📦 Cache store '${storeName}' not found`);
                return false;
            }

            // Compress large objects if needed
            const processedValue = this.shouldCompress(value)
                ? this.compress(value)
                : value;

            store.set(key, processedValue, ttl);
            return true;
        }

        /**
         * Delete from specific store
         */
        delete(storeName, key) {
            const store = this.stores.get(storeName);
            if (!store) return false;
            return store.delete(key);
        }

        /**
         * Clear specific store or all stores
         */
        clear(storeName = null) {
            if (storeName) {
                const store = this.stores.get(storeName);
                if (store) store.clear();
            } else {
                this.stores.forEach(store => store.clear());
            }
        }

        /**
         * Get statistics for all stores
         */
        getAllStats() {
            const storeStats = {};
            this.stores.forEach((store, name) => {
                storeStats[name] = store.getStats();
            });

            const globalHitRate = this.globalStats.totalHits /
                this.globalStats.totalRequests || 0;

            return {
                global: {
                    totalRequests: this.globalStats.totalRequests,
                    totalHits: this.globalStats.totalHits,
                    totalMisses: this.globalStats.totalMisses,
                    hitRate: (globalHitRate * 100).toFixed(2) + '%'
                },
                stores: storeStats
            };
        }

        /**
         * Check if value should be compressed
         */
        shouldCompress(value) {
            if (typeof value !== 'object') return false;
            try {
                const size = JSON.stringify(value).length;
                return size > 10000; // Compress if larger than 10KB
            } catch (e) {
                return false;
            }
        }

        /**
         * Simple compression using base64 encoding
         * In production, you might use a real compression library
         */
        compress(value) {
            try {
                const json = JSON.stringify(value);
                const compressed = {
                    _compressed: true,
                    data: btoa(json) // Base64 encode
                };
                return compressed;
            } catch (e) {
                console.error('📦 Compression failed:', e);
                return value;
            }
        }

        /**
         * Decompress value
         */
        decompress(value) {
            if (value && value._compressed) {
                try {
                    const json = atob(value.data); // Base64 decode
                    return JSON.parse(json);
                } catch (e) {
                    console.error('📦 Decompression failed:', e);
                    return null;
                }
            }
            return value;
        }

        /**
         * Setup automatic cleanup interval
         */
        setupCleanupInterval() {
            // Run cleanup every 5 minutes
            setInterval(() => {
                this.cleanup();
            }, 300000);
        }

        /**
         * Cleanup all stores
         */
        cleanup() {
            let totalCleaned = 0;
            this.stores.forEach((store, name) => {
                const cleaned = store.cleanup();
                totalCleaned += cleaned;
            });

            if (totalCleaned > 0) {
                console.log(`📦 Total cache cleanup: ${totalCleaned} entries removed`);
            }

            // Also suggest memory cleanup if needed
            if (performance.memory && performance.memory.usedJSHeapSize > 100 * 1024 * 1024) {
                this.suggestMemoryOptimization();
            }
        }

        /**
         * Suggest memory optimization
         */
        suggestMemoryOptimization() {
            const stats = this.getAllStats();
            const lowHitRateStores = Object.entries(stats.stores)
                .filter(([name, stat]) => parseFloat(stat.hitRate) < 30)
                .map(([name]) => name);

            if (lowHitRateStores.length > 0) {
                console.warn('📦 Consider clearing low hit-rate caches:', lowHitRateStores);
            }
        }

        /**
         * Setup performance monitoring
         */
        setupPerformanceMonitoring() {
            // Monitor cache performance
            setInterval(() => {
                const stats = this.getAllStats();
                const globalHitRate = parseFloat(stats.global.hitRate);

                if (globalHitRate < 50 && this.globalStats.totalRequests > 100) {
                    console.warn('📦 Low cache hit rate detected:', stats.global.hitRate);
                    this.optimizeCacheStrategy();
                }
            }, 60000); // Check every minute
        }

        /**
         * Optimize cache strategy based on usage patterns
         */
        optimizeCacheStrategy() {
            this.stores.forEach((store, name) => {
                const stats = store.getStats();
                const hitRate = parseFloat(stats.hitRate);

                // Adjust cache size based on hit rate
                if (hitRate > 80 && store.cache.size === store.maxSize) {
                    // Increase cache size for high-performing caches
                    store.maxSize = Math.min(store.maxSize * 1.5, 500);
                    console.log(`📦 Increased ${name} cache size to ${store.maxSize}`);
                } else if (hitRate < 30 && store.cache.size < store.maxSize / 2) {
                    // Decrease cache size for underutilized caches
                    store.maxSize = Math.max(store.maxSize * 0.75, 10);
                    console.log(`📦 Decreased ${name} cache size to ${store.maxSize}`);
                }
            });
        }

        /**
         * Create cache key from multiple parts
         */
        createKey(...parts) {
            return parts.filter(p => p !== null && p !== undefined).join(':');
        }

        /**
         * Invalidate cache entries matching pattern
         */
        invalidatePattern(storeName, pattern) {
            const store = this.stores.get(storeName);
            if (!store) return 0;

            let invalidated = 0;
            const regex = new RegExp(pattern);

            for (const key of store.keys()) {
                if (regex.test(key)) {
                    store.delete(key);
                    invalidated++;
                }
            }

            if (invalidated > 0) {
                console.log(`📦 Invalidated ${invalidated} cache entries matching ${pattern}`);
            }

            return invalidated;
        }

        /**
         * Warm cache with preloaded data
         */
        warmCache(storeName, data) {
            const store = this.stores.get(storeName);
            if (!store) return false;

            let loaded = 0;
            for (const [key, value] of Object.entries(data)) {
                store.set(key, value);
                loaded++;
            }

            console.log(`📦 Warmed ${storeName} cache with ${loaded} entries`);
            return true;
        }

        /**
         * Export cache data for persistence
         */
        exportCache(storeName = null) {
            const data = {};

            if (storeName) {
                const store = this.stores.get(storeName);
                if (store) {
                    data[storeName] = Array.from(store.cache.entries())
                        .map(([key, entry]) => ({
                            key,
                            value: entry.value,
                            ttl: entry.ttl,
                            timestamp: entry.timestamp
                        }));
                }
            } else {
                this.stores.forEach((store, name) => {
                    data[name] = Array.from(store.cache.entries())
                        .map(([key, entry]) => ({
                            key,
                            value: entry.value,
                            ttl: entry.ttl,
                            timestamp: entry.timestamp
                        }));
                });
            }

            return data;
        }

        /**
         * Import cache data
         */
        importCache(data) {
            for (const [storeName, entries] of Object.entries(data)) {
                let store = this.stores.get(storeName);
                if (!store) {
                    store = this.createStore(storeName);
                }

                for (const entry of entries) {
                    const age = Date.now() - entry.timestamp;
                    if (age < entry.ttl) {
                        // Only import non-expired entries
                        store.set(entry.key, entry.value, entry.ttl - age);
                    }
                }
            }

            console.log('📦 Cache data imported successfully');
        }
    }

    /**
     * GraphQL Cache Wrapper
     * Specialized caching for GraphQL requests
     */
    class GraphQLCache {
        constructor(cacheManager) {
            this.cacheManager = cacheManager;
            this.storeName = 'graphql';
        }

        /**
         * Create cache key from GraphQL query and variables
         */
        createQueryKey(query, variables = {}) {
            // Remove whitespace from query for consistent keys
            const normalizedQuery = query.replace(/\s+/g, ' ').trim();
            const variableString = JSON.stringify(variables);
            return this.cacheManager.createKey('gql', normalizedQuery, variableString);
        }

        /**
         * Get cached GraphQL response
         */
        get(query, variables) {
            const key = this.createQueryKey(query, variables);
            const cached = this.cacheManager.get(this.storeName, key);

            if (cached) {
                // Decompress if needed
                return this.cacheManager.decompress(cached);
            }

            return null;
        }

        /**
         * Cache GraphQL response
         */
        set(query, variables, response, ttl = null) {
            const key = this.createQueryKey(query, variables);

            // Determine TTL based on query type
            if (!ttl) {
                ttl = this.determineTTL(query);
            }

            return this.cacheManager.set(this.storeName, key, response, ttl);
        }

        /**
         * Determine appropriate TTL based on query type
         */
        determineTTL(query) {
            // Mutations should not be cached
            if (query.includes('mutation')) {
                return 0;
            }

            // Frequently changing data - short TTL
            if (query.includes('findScenes') || query.includes('findPerformers')) {
                return 60000; // 1 minute
            }

            // Configuration data - long TTL
            if (query.includes('configuration') || query.includes('systemStatus')) {
                return 3600000; // 1 hour
            }

            // Default TTL
            return 300000; // 5 minutes
        }

        /**
         * Invalidate queries matching a pattern
         */
        invalidate(pattern) {
            return this.cacheManager.invalidatePattern(this.storeName, pattern);
        }
    }

    // Create global cache manager instance
    window.cacheManager = new CacheManager();
    window.graphQLCache = new GraphQLCache(window.cacheManager);

    // Export for use in other modules
    window.CacheManager = {
        manager: window.cacheManager,
        graphQL: window.graphQLCache,

        // Convenience methods
        get: (store, key) => window.cacheManager.get(store, key),
        set: (store, key, value, ttl) => window.cacheManager.set(store, key, value, ttl),
        clear: (store) => window.cacheManager.clear(store),
        stats: () => window.cacheManager.getAllStats(),
        cleanup: () => window.cacheManager.cleanup(),

        // GraphQL specific
        getQuery: (query, variables) => window.graphQLCache.get(query, variables),
        setQuery: (query, variables, response, ttl) => window.graphQLCache.set(query, variables, response, ttl),
        invalidateQueries: (pattern) => window.graphQLCache.invalidate(pattern)
    };

    console.log('📦 Cache Manager Module loaded successfully');
})();
