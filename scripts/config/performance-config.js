// ==UserScript==
// @name         Performance Configuration
// @namespace    stash-performance-config
// @version      1.0.0
// @description  Centralized performance configuration for AutomateStash suite
// @author       AutomateStash
// ==/UserScript==

/**
 * Performance Configuration Module
 * Provides centralized configuration for all performance optimizations
 * including thresholds, limits, and feature toggles
 */

(function () {
    'use strict';

    /**
     * Default Performance Configuration
     */
    const DEFAULT_CONFIG = {
        // Performance Monitoring
        monitoring: {
            enabled: true,
            sampleRate: 1, // 1 = 100% sampling
            reportingInterval: 60000, // Report every minute
            metricsRetention: 1000, // Keep last 1000 metrics
            longTaskThreshold: 50, // ms
            warnThreshold: 100, // ms for operation warnings
            criticalThreshold: 500 // ms for critical warnings
        },

        // Caching Configuration
        cache: {
            enabled: true,
            graphql: {
                maxSize: 200,
                ttl: 600000, // 10 minutes
                compressionThreshold: 10000 // Compress if larger than 10KB
            },
            dom: {
                maxSize: 50,
                ttl: 30000 // 30 seconds
            },
            scraper: {
                maxSize: 100,
                ttl: 300000 // 5 minutes
            },
            general: {
                maxSize: 100,
                ttl: 300000 // 5 minutes
            },
            warmupEnabled: true,
            cleanupInterval: 300000 // 5 minutes
        },

        // DOM Operations
        dom: {
            batchingEnabled: true,
            batchFlushDelay: 16, // ~60fps
            mutationObserverDelay: 1000, // Debounce delay
            scrollThrottle: 100, // ms
            resizeThrottle: 250, // ms
            intersectionThreshold: 0.1, // 10% visible
            lazyLoadOffset: 100 // px before viewport
        },

        // Task Queue
        taskQueue: {
            enabled: true,
            defaultConcurrency: 3,
            maxConcurrency: 10,
            defaultTimeout: 30000, // 30 seconds
            retryEnabled: true,
            maxRetries: 3,
            retryDelay: 1000, // Base delay, uses exponential backoff
            priorityLevels: {
                critical: 10,
                high: 5,
                normal: 0,
                low: -5,
                background: -10
            }
        },

        // Element Waiting
        elementWaiting: {
            defaultTimeout: 8000,
            pollInterval: 100,
            useIntersectionObserver: true,
            useMutationObserver: true,
            performanceTracking: true,
            warnOnSlowWait: true,
            slowWaitThreshold: 2000 // ms
        },

        // Memory Management
        memory: {
            monitoringEnabled: true,
            checkInterval: 30000, // 30 seconds
            warningThreshold: 50 * 1024 * 1024, // 50MB
            criticalThreshold: 100 * 1024 * 1024, // 100MB
            autoCleanup: true,
            cleanupThreshold: 75 * 1024 * 1024, // 75MB
            gcSuggestion: true // Suggest garbage collection when available
        },

        // Network Optimization
        network: {
            requestDeduplication: true,
            requestBatching: true,
            batchWindowSize: 50, // ms
            maxBatchSize: 10,
            compressionEnabled: true,
            cacheFirstStrategy: true,
            timeoutRetry: true,
            maxConcurrentRequests: 6
        },

        // Performance Budgets
        budgets: {
            enabled: true,
            pageLoadTime: 3000, // ms
            firstContentfulPaint: 1500, // ms
            timeToInteractive: 5000, // ms
            maxBundleSize: 500000, // 500KB
            maxImageSize: 200000, // 200KB
            maxScriptExecutionTime: 100, // ms
            maxLayoutShiftScore: 0.1,
            warnOnBudgetExceed: true,
            blockOnCriticalExceed: false
        },

        // Optimization Suggestions
        suggestions: {
            enabled: true,
            autoSuggest: true,
            suggestionThreshold: 0.7, // Confidence threshold
            categories: {
                cache: true,
                dom: true,
                network: true,
                memory: true,
                code: true
            },
            maxSuggestionsPerCategory: 3,
            dismissDuration: 86400000 // 24 hours
        },

        // Debug Options
        debug: {
            enabled: false,
            verboseLogging: false,
            performanceMarks: false,
            cacheLogging: false,
            networkLogging: false,
            domLogging: false,
            showMetricsOverlay: false,
            exportMetrics: false
        },

        // Feature Flags
        features: {
            advancedCaching: true,
            performanceMonitoring: true,
            domBatching: true,
            taskQueue: true,
            memoryOptimization: true,
            networkOptimization: true,
            intelligentWaiting: true,
            progressiveEnhancement: true,
            webWorkers: false, // Disabled for userscript compatibility
            serviceWorker: false // Disabled for userscript compatibility
        }
    };

    /**
     * Performance Configuration Manager
     */
    class PerformanceConfigManager {
        constructor() {
            this.config = this.loadConfiguration();
            this.listeners = new Map();
            this.overrides = new Map();
            this.setupAutoSave();
        }

        /**
         * Load configuration from storage or defaults
         */
        loadConfiguration() {
            let config = { ...DEFAULT_CONFIG };

            // Try to load saved configuration
            if (typeof GM_getValue !== 'undefined') {
                try {
                    const saved = GM_getValue('performanceConfig');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        config = this.mergeConfigs(config, parsed);
                    }
                } catch (e) {
                    console.error('Failed to load performance configuration:', e);
                }
            }

            return config;
        }

        /**
         * Deep merge configurations
         */
        mergeConfigs(target, source) {
            const result = { ...target };

            for (const key in source) {
                if (source.hasOwnProperty(key)) {
                    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                        result[key] = this.mergeConfigs(target[key] || {}, source[key]);
                    } else {
                        result[key] = source[key];
                    }
                }
            }

            return result;
        }

        /**
         * Save configuration to storage
         */
        saveConfiguration() {
            if (typeof GM_setValue !== 'undefined') {
                try {
                    GM_setValue('performanceConfig', JSON.stringify(this.config));
                    console.log('⚙️ Performance configuration saved');
                } catch (e) {
                    console.error('Failed to save performance configuration:', e);
                }
            }
        }

        /**
         * Setup auto-save on configuration changes
         */
        setupAutoSave() {
            // Debounced save function
            let saveTimeout;
            this.debouncedSave = () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    this.saveConfiguration();
                }, 1000);
            };
        }

        /**
         * Get configuration value
         */
        get(path, defaultValue = undefined) {
            // Check for overrides first
            if (this.overrides.has(path)) {
                return this.overrides.get(path);
            }

            const keys = path.split('.');
            let value = this.config;

            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return defaultValue;
                }
            }

            return value;
        }

        /**
         * Set configuration value
         */
        set(path, value) {
            const keys = path.split('.');
            let target = this.config;

            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!(key in target) || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                target = target[key];
            }

            const lastKey = keys[keys.length - 1];
            const oldValue = target[lastKey];
            target[lastKey] = value;

            // Notify listeners
            this.notifyListeners(path, value, oldValue);

            // Auto-save
            this.debouncedSave();
        }

        /**
         * Set temporary override
         */
        setOverride(path, value) {
            this.overrides.set(path, value);
            this.notifyListeners(path, value, this.get(path));
        }

        /**
         * Clear override
         */
        clearOverride(path) {
            if (this.overrides.has(path)) {
                this.overrides.delete(path);
                this.notifyListeners(path, this.get(path), null);
            }
        }

        /**
         * Register configuration change listener
         */
        on(path, callback) {
            if (!this.listeners.has(path)) {
                this.listeners.set(path, new Set());
            }
            this.listeners.get(path).add(callback);

            // Return unsubscribe function
            return () => {
                const callbacks = this.listeners.get(path);
                if (callbacks) {
                    callbacks.delete(callback);
                    if (callbacks.size === 0) {
                        this.listeners.delete(path);
                    }
                }
            };
        }

        /**
         * Notify listeners of configuration changes
         */
        notifyListeners(path, newValue, oldValue) {
            // Notify exact path listeners
            if (this.listeners.has(path)) {
                this.listeners.get(path).forEach(callback => {
                    try {
                        callback(newValue, oldValue, path);
                    } catch (e) {
                        console.error(`Error in config listener for ${path}:`, e);
                    }
                });
            }

            // Notify parent path listeners
            const parts = path.split('.');
            for (let i = parts.length - 1; i > 0; i--) {
                const parentPath = parts.slice(0, i).join('.');
                if (this.listeners.has(parentPath)) {
                    this.listeners.get(parentPath).forEach(callback => {
                        try {
                            callback(this.get(parentPath), null, parentPath);
                        } catch (e) {
                            console.error(`Error in config listener for ${parentPath}:`, e);
                        }
                    });
                }
            }
        }

        /**
         * Reset configuration to defaults
         */
        reset(path = null) {
            if (path) {
                const keys = path.split('.');
                let defaultValue = DEFAULT_CONFIG;
                let target = this.config;

                for (let i = 0; i < keys.length - 1; i++) {
                    const key = keys[i];
                    defaultValue = defaultValue[key];
                    target = target[key];
                }

                const lastKey = keys[keys.length - 1];
                target[lastKey] = defaultValue[lastKey];
                this.notifyListeners(path, defaultValue[lastKey], null);
            } else {
                this.config = { ...DEFAULT_CONFIG };
                this.notifyListeners('', this.config, null);
            }

            this.debouncedSave();
        }

        /**
         * Export configuration
         */
        export() {
            return JSON.stringify(this.config, null, 2);
        }

        /**
         * Import configuration
         */
        import(configString) {
            try {
                const imported = JSON.parse(configString);
                this.config = this.mergeConfigs(DEFAULT_CONFIG, imported);
                this.saveConfiguration();
                this.notifyListeners('', this.config, null);
                console.log('⚙️ Configuration imported successfully');
                return true;
            } catch (e) {
                console.error('Failed to import configuration:', e);
                return false;
            }
        }

        /**
         * Get performance profile preset
         */
        applyProfile(profileName) {
            const profiles = {
                balanced: {
                    cache: { enabled: true },
                    monitoring: { enabled: true, sampleRate: 0.5 },
                    dom: { batchingEnabled: true },
                    taskQueue: { defaultConcurrency: 3 }
                },
                performance: {
                    cache: { enabled: true },
                    monitoring: { enabled: true, sampleRate: 1 },
                    dom: { batchingEnabled: true },
                    taskQueue: { defaultConcurrency: 5 },
                    memory: { autoCleanup: true }
                },
                lowResource: {
                    cache: { enabled: true, graphql: { maxSize: 100 } },
                    monitoring: { enabled: false },
                    dom: { batchingEnabled: false },
                    taskQueue: { defaultConcurrency: 1 },
                    suggestions: { enabled: false }
                },
                debug: {
                    debug: {
                        enabled: true,
                        verboseLogging: true,
                        performanceMarks: true,
                        cacheLogging: true,
                        networkLogging: true,
                        domLogging: true
                    }
                }
            };

            const profile = profiles[profileName];
            if (profile) {
                this.config = this.mergeConfigs(this.config, profile);
                this.saveConfiguration();
                console.log(`⚙️ Applied ${profileName} performance profile`);
                return true;
            }
            return false;
        }

        /**
         * Get current performance score
         */
        getPerformanceScore() {
            let score = 100;
            const metrics = window.performanceMonitor?.getSummary() || {};

            // Deduct points for poor performance
            if (metrics.averageExecutionTime > this.get('monitoring.warnThreshold')) {
                score -= 20;
            }
            if (metrics.averageExecutionTime > this.get('monitoring.criticalThreshold')) {
                score -= 30;
            }

            // Cache performance
            const cacheStats = window.cacheManager?.getAllStats() || {};
            const hitRate = parseFloat(cacheStats.global?.hitRate || 0);
            if (hitRate < 50) score -= 15;
            if (hitRate < 30) score -= 15;

            // Memory usage
            if (performance.memory) {
                const memoryUsage = performance.memory.usedJSHeapSize;
                if (memoryUsage > this.get('memory.warningThreshold')) score -= 10;
                if (memoryUsage > this.get('memory.criticalThreshold')) score -= 20;
            }

            return Math.max(0, score);
        }

        /**
         * Get optimization suggestions based on current performance
         */
        getOptimizationSuggestions() {
            const suggestions = [];
            const score = this.getPerformanceScore();

            if (score < 80) {
                // Check specific areas
                const metrics = window.performanceMonitor?.getSummary() || {};
                const cacheStats = window.cacheManager?.getAllStats() || {};

                if (metrics.averageExecutionTime > this.get('monitoring.warnThreshold')) {
                    suggestions.push({
                        category: 'performance',
                        priority: 'high',
                        message: 'High execution times detected',
                        action: 'Consider enabling DOM batching and task queue optimization'
                    });
                }

                const hitRate = parseFloat(cacheStats.global?.hitRate || 0);
                if (hitRate < 50) {
                    suggestions.push({
                        category: 'cache',
                        priority: 'medium',
                        message: 'Low cache hit rate',
                        action: 'Increase cache sizes or adjust TTL values'
                    });
                }

                if (performance.memory && performance.memory.usedJSHeapSize > this.get('memory.warningThreshold')) {
                    suggestions.push({
                        category: 'memory',
                        priority: 'high',
                        message: 'High memory usage detected',
                        action: 'Enable automatic cleanup and reduce cache sizes'
                    });
                }
            }

            return suggestions;
        }
    }

    // Create global instance
    window.performanceConfigManager = new PerformanceConfigManager();

    // Export convenience methods
    window.PerformanceConfig = {
        get: (path, defaultValue) => window.performanceConfigManager.get(path, defaultValue),
        set: (path, value) => window.performanceConfigManager.set(path, value),
        on: (path, callback) => window.performanceConfigManager.on(path, callback),
        reset: (path) => window.performanceConfigManager.reset(path),
        applyProfile: (profile) => window.performanceConfigManager.applyProfile(profile),
        getScore: () => window.performanceConfigManager.getPerformanceScore(),
        getSuggestions: () => window.performanceConfigManager.getOptimizationSuggestions(),
        export: () => window.performanceConfigManager.export(),
        import: (config) => window.performanceConfigManager.import(config)
    };

    console.log('⚙️ Performance Configuration Module loaded successfully');
})();
