// ==UserScript==
// @name         Performance Enhancer Module
// @namespace    stash-performance
// @version      1.0.0
// @description  Performance optimization utilities for AutomateStash suite
// @author       AutomateStash
// ==/UserScript==

/**
 * Performance Enhancer Module
 * Provides centralized performance optimization utilities including:
 * - Real-time performance monitoring
 * - DOM operation batching
 * - Task queue management
 * - Intelligent element waiting
 * - Performance metrics collection
 */

(function () {
    'use strict';

    /**
     * Performance Monitor Class
     * Tracks and analyzes performance metrics in real-time
     */
    class PerformanceMonitor {
        constructor() {
            this.metrics = [];
            this.maxMetrics = 1000; // Keep last 1000 metrics
            this.observers = new Map();
            this.startTime = performance.now();
            this.domOperationCount = 0;
            this.initialized = false;

            // Performance thresholds
            this.thresholds = {
                executionTime: 100, // ms
                domOperations: 50,
                memoryUsage: 50 * 1024 * 1024, // 50MB
                cacheHitRate: 0.7 // 70%
            };

            this.initialize();
        }

        initialize() {
            if (this.initialized) return;

            // Setup Performance Observer for long tasks
            if ('PerformanceObserver' in window) {
                try {
                    const observer = new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            if (entry.duration > 50) { // Long task threshold
                                this.recordLongTask(entry);
                            }
                        }
                    });

                    // Observe long tasks if supported
                    if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
                        observer.observe({ entryTypes: ['longtask'] });
                        this.observers.set('longtask', observer);
                    }
                } catch (e) {
                    console.log('⚡ Long task monitoring not available');
                }
            }

            // Setup memory monitoring if available
            if (performance.memory) {
                this.startMemoryMonitoring();
            }

            this.initialized = true;
            console.log('⚡ Performance Monitor initialized');
        }

        startMemoryMonitoring() {
            setInterval(() => {
                if (performance.memory) {
                    const memoryUsage = performance.memory.usedJSHeapSize;
                    if (memoryUsage > this.thresholds.memoryUsage) {
                        this.suggestOptimization('memory', {
                            current: memoryUsage,
                            threshold: this.thresholds.memoryUsage,
                            suggestion: 'Consider clearing unused cache entries or optimizing data structures'
                        });
                    }
                }
            }, 30000); // Check every 30 seconds
        }

        recordLongTask(entry) {
            console.warn(`⚡ Long task detected: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
            this.addMetric({
                type: 'longtask',
                name: entry.name,
                duration: entry.duration,
                timestamp: Date.now()
            });
        }

        /**
         * Measure the performance of a function
         * @param {string} name - Name of the operation
         * @param {Function} fn - Function to measure
         * @returns {*} Result of the function
         */
        async measure(name, fn) {
            const startMark = `${name}-start`;
            const endMark = `${name}-end`;
            const measureName = `${name}-duration`;

            performance.mark(startMark);
            const startMemory = performance.memory?.usedJSHeapSize || 0;
            const startDOM = this.domOperationCount;

            try {
                const result = await fn();

                performance.mark(endMark);
                performance.measure(measureName, startMark, endMark);

                const measure = performance.getEntriesByName(measureName)[0];
                const endMemory = performance.memory?.usedJSHeapSize || 0;
                const memoryDelta = endMemory - startMemory;
                const domDelta = this.domOperationCount - startDOM;

                this.addMetric({
                    name,
                    executionTime: measure.duration,
                    memoryDelta,
                    domOperations: domDelta,
                    timestamp: Date.now()
                });

                // Check thresholds and suggest optimizations
                if (measure.duration > this.thresholds.executionTime) {
                    this.suggestOptimization('execution', {
                        operation: name,
                        duration: measure.duration,
                        threshold: this.thresholds.executionTime
                    });
                }

                // Cleanup marks and measures
                performance.clearMarks(startMark);
                performance.clearMarks(endMark);
                performance.clearMeasures(measureName);

                return result;
            } catch (error) {
                performance.clearMarks(startMark);
                throw error;
            }
        }

        /**
         * Add a metric to the collection
         */
        addMetric(metric) {
            this.metrics.push(metric);

            // Keep only last N metrics
            if (this.metrics.length > this.maxMetrics) {
                this.metrics.shift();
            }

            // Emit metric event for real-time monitoring
            this.emitMetricEvent(metric);
        }

        /**
         * Emit a custom event for metric updates
         */
        emitMetricEvent(metric) {
            const event = new CustomEvent('performanceMetric', {
                detail: metric
            });
            document.dispatchEvent(event);
        }

        /**
         * Suggest performance optimizations based on metrics
         */
        suggestOptimization(type, details) {
            const suggestions = {
                execution: '⚡ Consider optimizing this operation or using caching',
                memory: '💾 Memory usage is high, consider cleanup',
                dom: '🎯 Too many DOM operations, consider batching',
                cache: '📦 Low cache hit rate, review caching strategy'
            };

            console.warn(`Performance Optimization Suggested:`, {
                type,
                suggestion: suggestions[type],
                details
            });
        }

        /**
         * Get performance summary
         */
        getSummary() {
            if (this.metrics.length === 0) {
                return { message: 'No metrics collected yet' };
            }

            const executionTimes = this.metrics
                .filter(m => m.executionTime)
                .map(m => m.executionTime);

            return {
                totalMetrics: this.metrics.length,
                averageExecutionTime: executionTimes.length > 0
                    ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
                    : 0,
                maxExecutionTime: Math.max(...executionTimes, 0),
                totalDOMOperations: this.domOperationCount,
                uptime: performance.now() - this.startTime,
                memoryUsage: performance.memory?.usedJSHeapSize || 0
            };
        }

        /**
         * Increment DOM operation counter
         */
        incrementDOMOperations() {
            this.domOperationCount++;
        }

        /**
         * Clear all metrics
         */
        clear() {
            this.metrics = [];
            this.domOperationCount = 0;
            console.log('⚡ Performance metrics cleared');
        }

        /**
         * Cleanup and disconnect observers
         */
        destroy() {
            this.observers.forEach(observer => observer.disconnect());
            this.observers.clear();
            this.clear();
        }
    }

    /**
     * DOM Batch Processor
     * Batches DOM operations to reduce reflows and repaints
     */
    class DOMBatchProcessor {
        constructor() {
            this.readQueue = [];
            this.writeQueue = [];
            this.scheduled = false;
            this.rafId = null;
        }

        /**
         * Add a read operation to the queue
         */
        read(fn) {
            return new Promise((resolve, reject) => {
                this.readQueue.push(() => {
                    try {
                        resolve(fn());
                    } catch (error) {
                        reject(error);
                    }
                });
                this.scheduleFlush();
            });
        }

        /**
         * Add a write operation to the queue
         */
        write(fn) {
            return new Promise((resolve, reject) => {
                this.writeQueue.push(() => {
                    try {
                        resolve(fn());
                        if (window.performanceMonitor) {
                            window.performanceMonitor.incrementDOMOperations();
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
                this.scheduleFlush();
            });
        }

        /**
         * Schedule a flush of the queues
         */
        scheduleFlush() {
            if (!this.scheduled) {
                this.scheduled = true;
                this.rafId = requestAnimationFrame(() => this.flush());
            }
        }

        /**
         * Flush all queued operations
         */
        flush() {
            const reads = [...this.readQueue];
            const writes = [...this.writeQueue];

            this.readQueue = [];
            this.writeQueue = [];
            this.scheduled = false;

            // Execute all reads first
            reads.forEach(read => read());

            // Then execute all writes
            writes.forEach(write => write());
        }

        /**
         * Cancel scheduled flush
         */
        cancel() {
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
            this.scheduled = false;
            this.readQueue = [];
            this.writeQueue = [];
        }
    }

    /**
     * Task Queue with priority and concurrency control
     */
    class TaskQueue {
        constructor(options = {}) {
            this.queue = [];
            this.running = [];
            this.concurrency = options.concurrency || 3;
            this.retryDelay = options.retryDelay || 1000;
            this.defaultTimeout = options.defaultTimeout || 30000;
            this.paused = false;
        }

        /**
         * Add a task to the queue
         */
        add(operation, options = {}) {
            return new Promise((resolve, reject) => {
                const task = {
                    id: this.generateId(),
                    operation,
                    priority: options.priority || 0,
                    retryCount: 0,
                    maxRetries: options.maxRetries || 3,
                    timeout: options.timeout || this.defaultTimeout,
                    resolve,
                    reject,
                    name: options.name || 'unnamed-task'
                };

                this.queue.push(task);
                this.queue.sort((a, b) => b.priority - a.priority);

                if (!this.paused) {
                    this.process();
                }
            });
        }

        /**
         * Process tasks in the queue
         */
        async process() {
            while (this.running.length < this.concurrency && this.queue.length > 0 && !this.paused) {
                const task = this.queue.shift();
                this.running.push(task);

                try {
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error(`Task timeout: ${task.name}`)), task.timeout);
                    });

                    const result = await Promise.race([
                        task.operation(),
                        timeoutPromise
                    ]);

                    task.resolve(result);
                } catch (error) {
                    if (task.retryCount < task.maxRetries) {
                        task.retryCount++;
                        console.log(`⚡ Retrying task ${task.name} (attempt ${task.retryCount}/${task.maxRetries})`);

                        await this.delay(this.retryDelay * Math.pow(2, task.retryCount - 1)); // Exponential backoff
                        this.queue.unshift(task); // Add back to front of queue
                    } else {
                        task.reject(error);
                    }
                } finally {
                    this.running = this.running.filter(t => t.id !== task.id);
                    this.process(); // Process next task
                }
            }
        }

        /**
         * Pause the queue
         */
        pause() {
            this.paused = true;
            console.log('⚡ Task queue paused');
        }

        /**
         * Resume the queue
         */
        resume() {
            this.paused = false;
            console.log('⚡ Task queue resumed');
            this.process();
        }

        /**
         * Clear the queue
         */
        clear() {
            this.queue = [];
            console.log('⚡ Task queue cleared');
        }

        /**
         * Get queue status
         */
        getStatus() {
            return {
                queued: this.queue.length,
                running: this.running.length,
                paused: this.paused
            };
        }

        /**
         * Helper delay function
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Generate unique task ID
         */
        generateId() {
            return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
    }

    /**
     * Optimized Element Waiting with Intersection Observer
     */
    class OptimizedElementWaiter {
        constructor() {
            this.observers = new Map();
            this.pendingWaits = new Map();
        }

        /**
         * Wait for element with performance tracking
         */
        async wait(selectors, timeout = 8000, options = {}) {
            const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
            const waitId = this.generateWaitId();
            const startTime = performance.now();

            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    this.cleanup(waitId);
                    const duration = performance.now() - startTime;
                    console.warn(`⚡ Element wait timeout after ${duration.toFixed(2)}ms`);
                    reject(new Error(`Timeout waiting for elements: ${selectorArray.join(', ')}`));
                }, timeout);

                const checkElements = () => {
                    for (const selector of selectorArray) {
                        const element = document.querySelector(selector);
                        if (element) {
                            if (options.visible && !this.isVisible(element)) {
                                continue;
                            }

                            clearTimeout(timeoutId);
                            this.cleanup(waitId);

                            const duration = performance.now() - startTime;
                            if (duration > 100) {
                                console.log(`⚡ Element found in ${duration.toFixed(2)}ms: ${selector}`);
                            }

                            resolve(element);
                            return true;
                        }
                    }
                    return false;
                };

                // Check immediately
                if (checkElements()) return;

                // Use MutationObserver for efficient waiting
                const observer = new MutationObserver(() => {
                    if (checkElements()) {
                        observer.disconnect();
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                this.pendingWaits.set(waitId, {
                    observer,
                    timeoutId,
                    startTime
                });
            });
        }

        /**
         * Wait for element to disappear
         */
        async waitForDisappear(selector, timeout = 8000) {
            const startTime = performance.now();

            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Timeout waiting for element to disappear: ${selector}`));
                }, timeout);

                const checkDisappeared = () => {
                    const element = document.querySelector(selector);
                    if (!element) {
                        clearTimeout(timeoutId);
                        const duration = performance.now() - startTime;
                        console.log(`⚡ Element disappeared in ${duration.toFixed(2)}ms`);
                        resolve();
                        return true;
                    }
                    return false;
                };

                if (checkDisappeared()) return;

                const observer = new MutationObserver(() => {
                    if (checkDisappeared()) {
                        observer.disconnect();
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            });
        }

        /**
         * Check if element is visible
         */
        isVisible(element) {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);

            return rect.width > 0 &&
                rect.height > 0 &&
                style.opacity !== '0' &&
                style.visibility !== 'hidden' &&
                style.display !== 'none';
        }

        /**
         * Cleanup pending waits
         */
        cleanup(waitId) {
            const pending = this.pendingWaits.get(waitId);
            if (pending) {
                pending.observer.disconnect();
                clearTimeout(pending.timeoutId);
                this.pendingWaits.delete(waitId);
            }
        }

        /**
         * Generate unique wait ID
         */
        generateWaitId() {
            return `wait-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        /**
         * Clear all pending waits
         */
        clearAll() {
            this.pendingWaits.forEach((pending, waitId) => {
                this.cleanup(waitId);
            });
        }
    }

    /**
     * Performance Configuration Manager
     */
    class PerformanceConfig {
        constructor() {
            this.config = this.loadConfig();
        }

        loadConfig() {
            const defaults = {
                enableMonitoring: true,
                enableBatching: true,
                enableCaching: true,
                taskQueueConcurrency: 3,
                cacheMaxSize: 100,
                cacheTTL: 300000, // 5 minutes
                performanceThresholds: {
                    executionTime: 100,
                    domOperations: 50,
                    memoryUsage: 50 * 1024 * 1024,
                    cacheHitRate: 0.7
                },
                optimizationSuggestions: true,
                debugMode: false
            };

            // Try to load from GM storage
            if (typeof GM_getValue !== 'undefined') {
                try {
                    const saved = GM_getValue('performanceConfig');
                    if (saved) {
                        return Object.assign({}, defaults, JSON.parse(saved));
                    }
                } catch (e) {
                    console.error('Failed to load performance config:', e);
                }
            }

            return defaults;
        }

        saveConfig() {
            if (typeof GM_setValue !== 'undefined') {
                try {
                    GM_setValue('performanceConfig', JSON.stringify(this.config));
                    console.log('⚡ Performance configuration saved');
                } catch (e) {
                    console.error('Failed to save performance config:', e);
                }
            }
        }

        get(key) {
            return this.config[key];
        }

        set(key, value) {
            this.config[key] = value;
            this.saveConfig();
        }

        getAll() {
            return { ...this.config };
        }

        reset() {
            this.config = this.loadConfig();
            console.log('⚡ Performance configuration reset to defaults');
        }
    }

    // Create global instances
    window.performanceMonitor = new PerformanceMonitor();
    window.domBatch = new DOMBatchProcessor();
    window.taskQueue = new TaskQueue({ concurrency: 3 });
    window.elementWaiter = new OptimizedElementWaiter();
    window.performanceConfig = new PerformanceConfig();

    // Export for use in other modules
    window.PerformanceEnhancer = {
        monitor: window.performanceMonitor,
        batch: window.domBatch,
        queue: window.taskQueue,
        waiter: window.elementWaiter,
        config: window.performanceConfig,

        // Utility functions
        measure: (name, fn) => window.performanceMonitor.measure(name, fn),
        batchRead: (fn) => window.domBatch.read(fn),
        batchWrite: (fn) => window.domBatch.write(fn),
        queueTask: (operation, options) => window.taskQueue.add(operation, options),
        waitForElement: (selectors, timeout, options) => window.elementWaiter.wait(selectors, timeout, options),

        // Performance helpers
        debounce: function (func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        throttle: function (func, limit) {
            let inThrottle;
            return function (...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        // Memory management
        cleanupMemory: function () {
            // Clear unused cache entries
            if (window.CacheManager) {
                window.CacheManager.cleanup();
            }

            // Clear performance metrics if too many
            if (window.performanceMonitor.metrics.length > 500) {
                window.performanceMonitor.metrics = window.performanceMonitor.metrics.slice(-100);
            }

            // Suggest garbage collection if available
            if (window.gc) {
                window.gc();
            }

            console.log('⚡ Memory cleanup completed');
        }
    };

    console.log('⚡ Performance Enhancer Module loaded successfully');
})();
