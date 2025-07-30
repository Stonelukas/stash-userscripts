// ==UserScript==
// @name         Stash Performance Monitor
// @namespace    https://github.com/stashapp/stash
// @version      1.0.8
// @description  Comprehensive performance monitoring, database optimization analysis, scan progress tracking, and system resource monitoring for Stash
// @author       StashDevelopment
// @match        http://localhost:9998/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    console.log('📊 Stash Performance Monitor v1.0.6 - Initializing');

    // ===== CONFIGURATION =====
    const CONFIG = {
        // Collection intervals
        METRICS_INTERVAL: 'metricsInterval', // milliseconds
        HISTORY_RETENTION: 'historyRetention', // days
        
        // Performance thresholds
        CPU_WARNING: 'cpuWarning', // percentage
        CPU_CRITICAL: 'cpuCritical',
        MEMORY_WARNING: 'memoryWarning',
        MEMORY_CRITICAL: 'memoryCritical',
        QUERY_SLOW_THRESHOLD: 'querySlowThreshold', // milliseconds
        
        // Feature toggles
        ENABLE_DATABASE_MONITORING: 'enableDatabaseMonitoring',
        ENABLE_RESOURCE_MONITORING: 'enableResourceMonitoring',
        ENABLE_SCAN_TRACKING: 'enableScanTracking',
        ENABLE_ALERTS: 'enableAlerts',
        ENABLE_HISTORY: 'enableHistory',
        ENABLE_BENCHMARKS: 'enableBenchmarks',
        
        // UI settings
        SHOW_DASHBOARD: 'showDashboard',
        DASHBOARD_POSITION: 'dashboardPosition',
        COMPACT_MODE: 'compactMode'
    };

    const DEFAULTS = {
        [CONFIG.METRICS_INTERVAL]: 5000, // 5 seconds
        [CONFIG.HISTORY_RETENTION]: 7, // 7 days
        
        [CONFIG.CPU_WARNING]: 80,
        [CONFIG.CPU_CRITICAL]: 95,
        [CONFIG.MEMORY_WARNING]: 85,
        [CONFIG.MEMORY_CRITICAL]: 95,
        [CONFIG.QUERY_SLOW_THRESHOLD]: 1000, // 1 second
        
        [CONFIG.ENABLE_DATABASE_MONITORING]: true,
        [CONFIG.ENABLE_RESOURCE_MONITORING]: true,
        [CONFIG.ENABLE_SCAN_TRACKING]: true,
        [CONFIG.ENABLE_ALERTS]: true,
        [CONFIG.ENABLE_HISTORY]: true,
        [CONFIG.ENABLE_BENCHMARKS]: false,
        
        [CONFIG.SHOW_DASHBOARD]: true,
        [CONFIG.DASHBOARD_POSITION]: 'bottom-left',
        [CONFIG.COMPACT_MODE]: false
    };

    // GraphQL Queries
    const GRAPHQL_QUERIES = {
        SYSTEM_STATUS: `
            query SystemStatus {
                systemStatus {
                    databaseSchema
                    databasePath
                    configPath
                    appSchema
                    status
                    os
                    workingDir
                    homeDir
                }
            }
        `,
        JOB_STATUS: `
            query JobQueue {
                jobQueue {
                    id
                    status
                    subTasks
                    description
                    progress
                }
            }
        `,
        SCAN_STATUS: `
            query FindJob($input: FindJobInput!) {
                findJob(input: $input) {
                    id
                    status
                    progress
                    startTime
                    endTime
                    addTime
                    error
                }
            }
        `,
        STATS: `
            query Stats {
                stats {
                    scene_count
                    scenes_size
                    scenes_duration
                    image_count
                    images_size
                    gallery_count
                    performer_count
                    studio_count
                    group_count
                    tag_count
                    total_o_count
                    total_play_duration
                    total_play_count
                    scenes_played
                }
            }
        `
    };

    // Utility functions
    function getConfig(key) {
        return GM_getValue(key, DEFAULTS[key]);
    }

    function setConfig(key, value) {
        GM_setValue(key, value);
    }

    function formatBytes(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours}h ${minutes}m ${secs}s`;
    }

    // ===== GRAPHQL CLIENT =====
    class GraphQLClient {
        constructor() {
            this.endpoint = '/graphql';
        }

        async query(query, variables = {}) {
            try {
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query,
                        variables
                    })
                });

                const data = await response.json();
                if (data.errors) {
                    console.error('GraphQL errors:', data.errors);
                    throw new Error(`GraphQL query failed: ${data.errors[0].message}`);
                }
                return data.data;
            } catch (error) {
                console.error('GraphQL query failed:', error);
                throw error;
            }
        }

        async getSystemStatus() {
            const data = await this.query(GRAPHQL_QUERIES.SYSTEM_STATUS);
            return data?.systemStatus || null;
        }

        async getJobStatus() {
            const data = await this.query(GRAPHQL_QUERIES.JOB_STATUS);
            return data?.jobQueue || [];
        }

        async getScanStatus(jobId) {
            const data = await this.query(GRAPHQL_QUERIES.SCAN_STATUS, {
                input: { id: jobId }
            });
            return data?.findJob || null;
        }

        async getStats() {
            const data = await this.query(GRAPHQL_QUERIES.STATS);
            return data?.stats || null;
        }
    }

    // ===== PERFORMANCE METRICS COLLECTOR =====
    class PerformanceMetricsCollector {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.metrics = new Map();
            this.isCollecting = false;
            this.collectionInterval = null;
            this.queryTimings = [];
            this.lastStats = null;
            this.currentFPS = 60;
            this.initFPSTracking();
        }

        async startCollection() {
            if (this.isCollecting) return;

            this.isCollecting = true;
            const interval = getConfig(CONFIG.METRICS_INTERVAL);

            this.collectionInterval = setInterval(async () => {
                try {
                    const metrics = await this.collectAllMetrics();
                    this.storeMetrics(Date.now(), metrics);
                    this.broadcastMetrics(metrics);
                } catch (error) {
                    console.error('Metric collection error:', error);
                }
            }, interval);

            // Initial collection
            this.collectAllMetrics();
        }

        stopCollection() {
            this.isCollecting = false;
            if (this.collectionInterval) {
                clearInterval(this.collectionInterval);
                this.collectionInterval = null;
            }
        }

        async collectAllMetrics() {
            const metrics = {
                timestamp: Date.now(),
                system: await this.collectSystemMetrics(),
                database: await this.collectDatabaseMetrics(),
                stash: await this.collectStashMetrics(),
                performance: this.collectPerformanceMetrics()
            };

            console.log('📊 Collected metrics:', metrics);
            return metrics;
        }

        async collectSystemMetrics() {
            const metrics = {
                memory: this.getMemoryUsage(),
                navigation: this.getNavigationTiming(),
                resources: this.getResourceTiming()
            };

            // Try to get more detailed metrics if available
            if (performance.measureUserAgentSpecificMemory) {
                try {
                    const detailedMemory = await performance.measureUserAgentSpecificMemory();
                    metrics.detailedMemory = detailedMemory;
                } catch (e) {
                    // Not available in this context
                }
            }

            return metrics;
        }

        getMemoryUsage() {
            // Note: performance.memory is only available in Chrome/Chromium
            if (performance.memory) {
                const used = performance.memory.usedJSHeapSize;
                const limit = performance.memory.jsHeapSizeLimit;
                return {
                    usedJSHeapSize: used,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: limit,
                    usage: limit > 0 ? (used / limit) * 100 : 0
                };
            }
            // Fallback: estimate memory usage (not accurate but better than nothing)
            return {
                usedJSHeapSize: 0,
                totalJSHeapSize: 0,
                jsHeapSizeLimit: 0,
                usage: 0
            };
        }

        getNavigationTiming() {
            const navigation = performance.getEntriesByType('navigation')[0];
            if (navigation) {
                return {
                    loadTime: navigation.loadEventEnd - navigation.loadEventStart,
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                    responseTime: navigation.responseEnd - navigation.requestStart
                };
            }
            return null;
        }

        getResourceTiming() {
            const resources = performance.getEntriesByType('resource');
            const graphqlRequests = resources.filter(r => r.name.includes('/graphql'));
            
            return {
                totalResources: resources.length,
                graphqlRequests: graphqlRequests.length,
                avgGraphQLTime: graphqlRequests.length > 0 
                    ? graphqlRequests.reduce((sum, r) => sum + r.duration, 0) / graphqlRequests.length
                    : 0
            };
        }

        async collectDatabaseMetrics() {
            // Track GraphQL query performance
            const recentQueries = this.queryTimings.slice(-100); // Last 100 queries
            
            return {
                queryCount: recentQueries.length,
                avgQueryTime: recentQueries.length > 0 
                    ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length
                    : 0,
                slowQueries: recentQueries.filter(q => q.duration > getConfig(CONFIG.QUERY_SLOW_THRESHOLD))
            };
        }

        async collectStashMetrics() {
            try {
                const [stats, jobs, systemStatus] = await Promise.all([
                    this.graphql.getStats(),
                    this.graphql.getJobStatus(),
                    this.graphql.getSystemStatus()
                ]);

                const activeJobs = jobs.filter(job => job.status === 'RUNNING');
                const scanJobs = activeJobs.filter(job => 
                    job.description && job.description.toLowerCase().includes('scan')
                );

                return {
                    stats,
                    systemStatus,
                    activeJobs: activeJobs.length,
                    scanJobs: scanJobs.length,
                    jobDetails: activeJobs,
                    statsChanges: this.calculateStatsChanges(stats)
                };
            } catch (error) {
                console.error('Failed to collect Stash metrics:', error);
                return null;
            }
        }

        calculateStatsChanges(currentStats) {
            if (!this.lastStats || !currentStats) return null;

            const changes = {};
            for (const key in currentStats) {
                if (typeof currentStats[key] === 'number' && typeof this.lastStats[key] === 'number') {
                    changes[key] = currentStats[key] - this.lastStats[key];
                }
            }

            this.lastStats = currentStats;
            return changes;
        }

        collectPerformanceMetrics() {
            return {
                fps: this.currentFPS,
                mainThreadBlocking: this.detectMainThreadBlocking()
            };
        }

        initFPSTracking() {
            let lastTime = performance.now();
            let frames = 0;

            const countFrames = () => {
                frames++;
                const currentTime = performance.now();
                if (currentTime >= lastTime + 1000) {
                    this.currentFPS = Math.round((frames * 1000) / (currentTime - lastTime));
                    frames = 0;
                    lastTime = currentTime;
                }
                requestAnimationFrame(countFrames);
            };

            requestAnimationFrame(countFrames);
        }

        detectMainThreadBlocking() {
            // Detect long tasks that block the main thread
            try {
                // Try to use PerformanceObserver if available
                if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
                    // This would need to be set up differently for continuous monitoring
                    // For now, we'll just return a placeholder
                    return { count: 0, totalDuration: 0 };
                }
                
                // Fallback: try the deprecated API with error handling
                const longTasks = performance.getEntriesByType('longtask') || [];
                return {
                    count: longTasks.length,
                    totalDuration: longTasks.reduce((sum, task) => sum + task.duration, 0)
                };
            } catch (e) {
                // If neither method works, return zero values
                return { count: 0, totalDuration: 0 };
            }
        }

        trackQueryTiming(query, duration) {
            console.log('📊 Tracking query:', query.substring(0, 50), 'Duration:', duration + 'ms');
            this.queryTimings.push({
                query: query.substring(0, 100), // First 100 chars
                duration,
                timestamp: Date.now()
            });

            // Keep only last 1000 queries
            if (this.queryTimings.length > 1000) {
                this.queryTimings = this.queryTimings.slice(-1000);
            }
        }

        storeMetrics(timestamp, metrics) {
            this.metrics.set(timestamp, metrics);

            // Cleanup old metrics based on retention policy
            if (getConfig(CONFIG.ENABLE_HISTORY)) {
                this.cleanupOldMetrics();
            }
        }

        cleanupOldMetrics() {
            const retentionDays = getConfig(CONFIG.HISTORY_RETENTION);
            const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

            for (const [timestamp, ] of this.metrics) {
                if (timestamp < cutoffTime) {
                    this.metrics.delete(timestamp);
                }
            }
        }

        broadcastMetrics(metrics) {
            // Dispatch custom event for UI updates
            window.dispatchEvent(new CustomEvent('performanceMetricsUpdate', {
                detail: metrics
            }));
        }

        getLatestMetrics() {
            const timestamps = Array.from(this.metrics.keys()).sort((a, b) => b - a);
            return timestamps.length > 0 ? this.metrics.get(timestamps[0]) : null;
        }

        getMetricsHistory(duration = 3600000) { // Default 1 hour
            const cutoffTime = Date.now() - duration;
            const history = [];

            for (const [timestamp, metrics] of this.metrics) {
                if (timestamp >= cutoffTime) {
                    history.push({ timestamp, ...metrics });
                }
            }

            return history.sort((a, b) => a.timestamp - b.timestamp);
        }
    }

    // ===== DATABASE PERFORMANCE ANALYZER =====
    class DatabasePerformanceAnalyzer {
        constructor(metricsCollector) {
            this.metricsCollector = metricsCollector;
            this.analysisResults = new Map();
        }

        async analyzePerformance() {
            const metrics = this.metricsCollector.getLatestMetrics();
            if (!metrics || !metrics.database) return null;

            const analysis = {
                timestamp: Date.now(),
                queryPerformance: this.analyzeQueryPerformance(metrics.database),
                recommendations: [],
                score: 100
            };

            // Generate recommendations based on analysis
            analysis.recommendations = this.generateRecommendations(analysis);
            analysis.score = this.calculatePerformanceScore(analysis);

            this.analysisResults.set(analysis.timestamp, analysis);
            return analysis;
        }

        analyzeQueryPerformance(dbMetrics) {
            const slowThreshold = getConfig(CONFIG.QUERY_SLOW_THRESHOLD);
            
            return {
                totalQueries: dbMetrics.queryCount,
                avgQueryTime: dbMetrics.avgQueryTime,
                slowQueries: dbMetrics.slowQueries,
                performanceRating: this.getPerformanceRating(dbMetrics.avgQueryTime),
                slowQueryPercentage: dbMetrics.queryCount > 0 
                    ? (dbMetrics.slowQueries.length / dbMetrics.queryCount) * 100 
                    : 0
            };
        }

        getPerformanceRating(avgTime) {
            if (avgTime < 100) return 'excellent';
            if (avgTime < 500) return 'good';
            if (avgTime < 1000) return 'fair';
            if (avgTime < 2000) return 'poor';
            return 'critical';
        }

        generateRecommendations(analysis) {
            const recommendations = [];

            // Query performance recommendations
            if (analysis.queryPerformance.avgQueryTime > 1000) {
                recommendations.push({
                    type: 'query_optimization',
                    priority: 'high',
                    title: 'Slow Query Performance Detected',
                    description: `Average query time is ${Math.round(analysis.queryPerformance.avgQueryTime)}ms`,
                    actions: [
                        'Consider optimizing database indexes',
                        'Review and optimize complex queries',
                        'Check database vacuum/analyze status'
                    ]
                });
            }

            if (analysis.queryPerformance.slowQueryPercentage > 10) {
                recommendations.push({
                    type: 'slow_queries',
                    priority: 'medium',
                    title: 'High Percentage of Slow Queries',
                    description: `${analysis.queryPerformance.slowQueryPercentage.toFixed(1)}% of queries are slow`,
                    actions: [
                        'Identify and optimize frequently slow queries',
                        'Consider query result caching',
                        'Review database connection pooling'
                    ]
                });
            }

            return recommendations;
        }

        calculatePerformanceScore(analysis) {
            let score = 100;

            // Deduct points for query performance issues
            if (analysis.queryPerformance.avgQueryTime > 2000) score -= 30;
            else if (analysis.queryPerformance.avgQueryTime > 1000) score -= 20;
            else if (analysis.queryPerformance.avgQueryTime > 500) score -= 10;

            // Deduct points for slow query percentage
            score -= Math.min(20, analysis.queryPerformance.slowQueryPercentage * 2);

            return Math.max(0, Math.round(score));
        }

        getLatestAnalysis() {
            const timestamps = Array.from(this.analysisResults.keys()).sort((a, b) => b - a);
            return timestamps.length > 0 ? this.analysisResults.get(timestamps[0]) : null;
        }
    }

    // ===== RESOURCE MONITOR =====
    class ResourceMonitor {
        constructor(metricsCollector) {
            this.metricsCollector = metricsCollector;
            this.alerts = [];
            this.thresholds = {
                cpu: {
                    warning: getConfig(CONFIG.CPU_WARNING),
                    critical: getConfig(CONFIG.CPU_CRITICAL)
                },
                memory: {
                    warning: getConfig(CONFIG.MEMORY_WARNING),
                    critical: getConfig(CONFIG.MEMORY_CRITICAL)
                }
            };
        }

        async monitorResources() {
            const metrics = this.metricsCollector.getLatestMetrics();
            if (!metrics || !metrics.system) return null;

            const analysis = {
                timestamp: Date.now(),
                memory: this.analyzeMemoryUsage(metrics.system.memory),
                performance: this.analyzePerformance(metrics.performance),
                alerts: [],
                recommendations: []
            };

            // Check thresholds and generate alerts
            analysis.alerts = this.checkThresholds(analysis);
            analysis.recommendations = this.generateRecommendations(analysis);

            return analysis;
        }

        analyzeMemoryUsage(memory) {
            if (!memory) return null;

            return {
                usage: memory.usage,
                usedMB: memory.usedJSHeapSize / (1024 * 1024),
                totalMB: memory.totalJSHeapSize / (1024 * 1024),
                limitMB: memory.jsHeapSizeLimit / (1024 * 1024),
                status: this.getMemoryStatus(memory.usage)
            };
        }

        getMemoryStatus(usage) {
            if (usage >= this.thresholds.memory.critical) return 'critical';
            if (usage >= this.thresholds.memory.warning) return 'warning';
            return 'normal';
        }

        analyzePerformance(performance) {
            if (!performance) return null;

            return {
                fps: performance.fps,
                mainThreadBlocking: performance.mainThreadBlocking,
                status: this.getPerformanceStatus(performance)
            };
        }

        getPerformanceStatus(performance) {
            if (performance.fps < 30) return 'poor';
            if (performance.fps < 50) return 'fair';
            return 'good';
        }

        checkThresholds(analysis) {
            const alerts = [];

            // Memory alerts
            if (analysis.memory && analysis.memory.status !== 'normal') {
                alerts.push({
                    type: 'memory',
                    severity: analysis.memory.status,
                    message: `Memory usage is ${analysis.memory.usage.toFixed(1)}%`,
                    timestamp: Date.now()
                });
            }

            // Performance alerts
            if (analysis.performance && analysis.performance.status === 'poor') {
                alerts.push({
                    type: 'performance',
                    severity: 'warning',
                    message: `Low FPS detected: ${analysis.performance.fps}`,
                    timestamp: Date.now()
                });
            }

            // Store alerts
            this.alerts = [...this.alerts, ...alerts].slice(-50); // Keep last 50 alerts

            return alerts;
        }

        generateRecommendations(analysis) {
            const recommendations = [];

            if (analysis.memory && analysis.memory.status !== 'normal') {
                recommendations.push({
                    type: 'memory_optimization',
                    priority: analysis.memory.status === 'critical' ? 'high' : 'medium',
                    title: 'High Memory Usage Detected',
                    description: `Memory usage is at ${analysis.memory.usage.toFixed(1)}%`,
                    actions: [
                        'Close unnecessary browser tabs',
                        'Reduce concurrent Stash operations',
                        'Consider increasing browser memory limits'
                    ]
                });
            }

            if (analysis.performance && analysis.performance.mainThreadBlocking.count > 5) {
                recommendations.push({
                    type: 'performance_optimization',
                    priority: 'medium',
                    title: 'Main Thread Blocking Detected',
                    description: `${analysis.performance.mainThreadBlocking.count} blocking tasks detected`,
                    actions: [
                        'Reduce UI complexity',
                        'Disable unnecessary browser extensions',
                        'Consider using Stash in a dedicated browser profile'
                    ]
                });
            }

            return recommendations;
        }

        getRecentAlerts(count = 10) {
            return this.alerts.slice(-count);
        }

        clearAlerts() {
            this.alerts = [];
        }
    }

    // ===== SCAN PROGRESS TRACKER =====
    class ScanProgressTracker {
        constructor(graphqlClient, metricsCollector) {
            this.graphql = graphqlClient;
            this.metricsCollector = metricsCollector;
            this.activeScan = null;
            this.scanHistory = [];
        }

        async trackScanProgress() {
            const metrics = this.metricsCollector.getLatestMetrics();
            if (!metrics || !metrics.stash) return null;

            const scanJobs = metrics.stash.jobDetails?.filter(job => 
                job.description && job.description.toLowerCase().includes('scan')
            ) || [];

            if (scanJobs.length === 0) {
                this.activeScan = null;
                return null;
            }

            // Track the first active scan
            const scanJob = scanJobs[0];
            
            const scanProgress = {
                jobId: scanJob.id,
                description: scanJob.description,
                progress: scanJob.progress || 0,
                status: scanJob.status,
                startTime: this.activeScan?.startTime || Date.now(),
                estimatedCompletion: this.estimateCompletion(scanJob.progress),
                filesPerMinute: this.calculateScanSpeed(scanJob)
            };

            this.activeScan = scanProgress;
            return scanProgress;
        }

        estimateCompletion(progress) {
            if (!this.activeScan || progress === 0) return null;

            const elapsedTime = Date.now() - this.activeScan.startTime;
            const estimatedTotalTime = (elapsedTime / progress) * 100;
            const remainingTime = estimatedTotalTime - elapsedTime;

            return Date.now() + remainingTime;
        }

        calculateScanSpeed(scanJob) {
            if (!this.activeScan) return 0;

            const elapsedMinutes = (Date.now() - this.activeScan.startTime) / 60000;
            if (elapsedMinutes === 0) return 0;

            // This is an estimate - actual file count would need to come from scan details
            const estimatedFiles = (scanJob.progress / 100) * 1000; // Placeholder
            return Math.round(estimatedFiles / elapsedMinutes);
        }

        completeScan(scanResult) {
            if (this.activeScan) {
                const completedScan = {
                    ...this.activeScan,
                    endTime: Date.now(),
                    duration: Date.now() - this.activeScan.startTime,
                    result: scanResult
                };

                this.scanHistory.push(completedScan);
                this.activeScan = null;

                // Keep only last 50 scans
                if (this.scanHistory.length > 50) {
                    this.scanHistory = this.scanHistory.slice(-50);
                }
            }
        }

        getScanHistory() {
            return this.scanHistory;
        }

        getAverageScanSpeed() {
            if (this.scanHistory.length === 0) return 0;

            const totalSpeed = this.scanHistory.reduce((sum, scan) => 
                sum + (scan.filesPerMinute || 0), 0
            );

            return totalSpeed / this.scanHistory.length;
        }
    }

    // ===== OPTIMIZATION ENGINE =====
    class OptimizationEngine {
        constructor(dbAnalyzer, resourceMonitor, scanTracker) {
            this.dbAnalyzer = dbAnalyzer;
            this.resourceMonitor = resourceMonitor;
            this.scanTracker = scanTracker;
        }

        async generateOptimizations() {
            const [dbAnalysis, resourceAnalysis] = await Promise.all([
                this.dbAnalyzer.analyzePerformance(),
                this.resourceMonitor.monitorResources()
            ]);

            const allRecommendations = [];

            if (dbAnalysis) {
                allRecommendations.push(...dbAnalysis.recommendations);
            }

            if (resourceAnalysis) {
                allRecommendations.push(...resourceAnalysis.recommendations);
            }

            // Add scan-specific recommendations
            const scanRecommendations = this.generateScanRecommendations();
            allRecommendations.push(...scanRecommendations);

            // Prioritize and deduplicate recommendations
            const prioritized = this.prioritizeRecommendations(allRecommendations);

            return {
                timestamp: Date.now(),
                recommendations: prioritized,
                overallScore: this.calculateOverallScore(dbAnalysis, resourceAnalysis),
                categories: {
                    database: dbAnalysis?.score || 0,
                    resources: resourceAnalysis ? 100 - (resourceAnalysis.memory?.usage || 0) : 0,
                    scanning: this.calculateScanScore()
                }
            };
        }

        generateScanRecommendations() {
            const recommendations = [];
            const avgSpeed = this.scanTracker.getAverageScanSpeed();

            if (avgSpeed > 0 && avgSpeed < 100) {
                recommendations.push({
                    type: 'scan_optimization',
                    priority: 'medium',
                    title: 'Slow Scan Speed Detected',
                    description: `Average scan speed is ${avgSpeed} files/minute`,
                    actions: [
                        'Check disk I/O performance',
                        'Reduce concurrent operations during scans',
                        'Consider scanning in smaller batches'
                    ]
                });
            }

            return recommendations;
        }

        prioritizeRecommendations(recommendations) {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            
            return recommendations
                .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
                .slice(0, 10); // Top 10 recommendations
        }

        calculateOverallScore(dbAnalysis, resourceAnalysis) {
            let scores = [];
            
            if (dbAnalysis) scores.push(dbAnalysis.score);
            if (resourceAnalysis?.memory) scores.push(100 - resourceAnalysis.memory.usage);
            
            const scanScore = this.calculateScanScore();
            if (scanScore > 0) scores.push(scanScore);

            if (scores.length === 0) return 0;
            
            return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
        }

        calculateScanScore() {
            const avgSpeed = this.scanTracker.getAverageScanSpeed();
            if (avgSpeed === 0) return 100; // No scans

            // Score based on files per minute
            if (avgSpeed > 500) return 100;
            if (avgSpeed > 300) return 90;
            if (avgSpeed > 200) return 80;
            if (avgSpeed > 100) return 70;
            if (avgSpeed > 50) return 60;
            return 50;
        }
    }

    // ===== PERFORMANCE DASHBOARD UI =====
    class PerformanceDashboardUI {
        constructor(metricsCollector, dbAnalyzer, resourceMonitor, scanTracker, optimizationEngine) {
            this.metricsCollector = metricsCollector;
            this.dbAnalyzer = dbAnalyzer;
            this.resourceMonitor = resourceMonitor;
            this.scanTracker = scanTracker;
            this.optimizationEngine = optimizationEngine;
            this.isMinimized = false;
            this.setupStyles();
            this.createToggleButton();
            this.createDashboard();
            this.setupEventListeners();
            this.startUpdates();
        }

        setupStyles() {
            GM_addStyle(`
                /* Performance Dashboard Styles */
                .perf-dashboard {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    width: 400px;
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    color: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    z-index: 10000;
                    font-family: Arial, sans-serif;
                    transition: all 0.3s ease;
                }

                .perf-dashboard.minimized {
                    width: auto;
                    height: auto;
                }

                .perf-dashboard-header {
                    padding: 15px;
                    background: rgba(0,0,0,0.2);
                    border-radius: 10px 10px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                }

                .perf-dashboard-title {
                    font-weight: bold;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .perf-dashboard-controls {
                    display: flex;
                    gap: 10px;
                }

                .perf-dashboard-btn {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 5px;
                    transition: opacity 0.2s;
                }

                .perf-dashboard-btn:hover {
                    opacity: 0.7;
                }

                .perf-dashboard-content {
                    padding: 15px;
                    max-height: 500px;
                    overflow-y: auto;
                }

                .perf-dashboard.minimized .perf-dashboard-content {
                    display: none;
                }

                /* Metric sections */
                .perf-metric-section {
                    margin-bottom: 20px;
                    padding: 15px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                }

                .perf-metric-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #3498db;
                }

                .perf-metric-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }

                .perf-metric-item {
                    display: flex;
                    flex-direction: column;
                }

                .perf-metric-label {
                    font-size: 12px;
                    color: #bdc3c7;
                }

                .perf-metric-value {
                    font-size: 18px;
                    font-weight: bold;
                }

                /* Status indicators */
                .perf-status {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                }

                .perf-status-excellent {
                    background: #27ae60;
                }

                .perf-status-good {
                    background: #3498db;
                }

                .perf-status-fair {
                    background: #f39c12;
                }

                .perf-status-poor {
                    background: #e67e22;
                }

                .perf-status-critical {
                    background: #e74c3c;
                }

                /* Score display */
                .perf-score-container {
                    text-align: center;
                    padding: 20px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    margin-bottom: 20px;
                }

                .perf-score-value {
                    font-size: 48px;
                    font-weight: bold;
                    background: linear-gradient(135deg, #3498db, #2ecc71);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .perf-score-label {
                    font-size: 14px;
                    color: #bdc3c7;
                    margin-top: 5px;
                }

                /* Progress bars */
                .perf-progress-bar {
                    width: 100%;
                    height: 8px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                    overflow: hidden;
                    margin-top: 5px;
                }

                .perf-progress-fill {
                    height: 100%;
                    transition: width 0.3s ease;
                }

                .perf-progress-good {
                    background: #27ae60;
                }

                .perf-progress-warning {
                    background: #f39c12;
                }

                .perf-progress-critical {
                    background: #e74c3c;
                }

                /* Recommendations */
                .perf-recommendations {
                    margin-top: 20px;
                }

                .perf-recommendation {
                    padding: 10px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 6px;
                    margin-bottom: 10px;
                    border-left: 3px solid #3498db;
                }

                .perf-recommendation-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .perf-recommendation-desc {
                    font-size: 12px;
                    color: #bdc3c7;
                }

                .perf-recommendation-actions {
                    margin-top: 8px;
                    font-size: 11px;
                }

                .perf-recommendation-action {
                    margin-left: 15px;
                    color: #95a5a6;
                }

                /* Alerts */
                .perf-alerts {
                    margin-bottom: 15px;
                }

                .perf-alert {
                    padding: 8px 12px;
                    border-radius: 6px;
                    margin-bottom: 5px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .perf-alert-warning {
                    background: rgba(243, 156, 18, 0.2);
                    border: 1px solid #f39c12;
                }

                .perf-alert-critical {
                    background: rgba(231, 76, 60, 0.2);
                    border: 1px solid #e74c3c;
                }

                .perf-alert-info {
                    background: rgba(52, 152, 219, 0.2);
                    border: 1px solid #3498db;
                }

                .perf-alert-icon {
                    font-size: 16px;
                }

                .perf-alert-message {
                    flex: 1;
                }

                .perf-alert-close {
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.6);
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    margin-left: 10px;
                }

                .perf-alert-close:hover {
                    color: rgba(255,255,255,0.9);
                }

                /* Scan progress */
                .perf-scan-progress {
                    padding: 15px;
                    background: rgba(52, 152, 219, 0.1);
                    border-radius: 8px;
                    margin-bottom: 15px;
                }

                .perf-scan-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                }

                .perf-scan-details {
                    font-size: 12px;
                    color: #bdc3c7;
                }

                /* Settings button */
                .perf-settings-btn {
                    position: absolute;
                    bottom: 10px;
                    right: 10px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }

                .perf-settings-btn:hover {
                    background: rgba(255,255,255,0.2);
                }

                /* Scrollbar */
                .perf-dashboard-content::-webkit-scrollbar {
                    width: 8px;
                }

                .perf-dashboard-content::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.05);
                }

                .perf-dashboard-content::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.2);
                    border-radius: 4px;
                }

                .perf-dashboard-content::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.3);
                }

                /* Toggle Button */
                .perf-toggle-btn {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    width: 50px;
                    height: 50px;
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    z-index: 9999;
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }

                .perf-toggle-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 25px rgba(0,0,0,0.7);
                }

                .perf-toggle-btn.hidden {
                    display: none;
                }
            `);
        }

        createToggleButton() {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'perf-toggle-btn';
            toggleBtn.innerHTML = '📊';
            toggleBtn.title = 'Toggle Performance Monitor';
            document.body.appendChild(toggleBtn);
            this.toggleBtn = toggleBtn;
        }

        createDashboard() {
            const dashboard = document.createElement('div');
            dashboard.className = 'perf-dashboard';
            dashboard.innerHTML = `
                <div class="perf-dashboard-header">
                    <div class="perf-dashboard-title">
                        📊 Performance Monitor
                    </div>
                    <div class="perf-dashboard-controls">
                        <button class="perf-dashboard-btn" id="perf-export-btn" title="Export Data">💾</button>
                        <button class="perf-dashboard-btn" id="perf-benchmark-btn" title="Run Benchmark">⚡</button>
                        <button class="perf-dashboard-btn" id="perf-refresh-btn" title="Refresh">🔄</button>
                        <button class="perf-dashboard-btn" id="perf-minimize-btn" title="Minimize">−</button>
                        <button class="perf-dashboard-btn" id="perf-close-btn" title="Close">×</button>
                    </div>
                </div>
                <div class="perf-dashboard-content">
                    <!-- Alerts Section -->
                    <div class="perf-alerts" id="perf-alerts"></div>

                    <!-- Overall Score -->
                    <div class="perf-score-container">
                        <div class="perf-score-value" id="perf-overall-score">--</div>
                        <div class="perf-score-label">Overall Performance Score</div>
                    </div>

                    <!-- Active Scan Progress -->
                    <div class="perf-scan-progress" id="perf-scan-progress" style="display: none;">
                        <div class="perf-scan-title">Active Scan</div>
                        <div class="perf-scan-details" id="perf-scan-details"></div>
                        <div class="perf-progress-bar">
                            <div class="perf-progress-fill perf-progress-good" id="perf-scan-progress-bar"></div>
                        </div>
                    </div>

                    <!-- System Metrics -->
                    <div class="perf-metric-section">
                        <div class="perf-metric-title">System Resources</div>
                        <div class="perf-metric-grid">
                            <div class="perf-metric-item">
                                <span class="perf-metric-label">Memory Usage</span>
                                <span class="perf-metric-value" id="perf-memory-usage">--</span>
                            </div>
                            <div class="perf-metric-item">
                                <span class="perf-metric-label">FPS</span>
                                <span class="perf-metric-value" id="perf-fps">--</span>
                            </div>
                        </div>
                        <div class="perf-progress-bar">
                            <div class="perf-progress-fill" id="perf-memory-bar"></div>
                        </div>
                    </div>

                    <!-- Database Metrics -->
                    <div class="perf-metric-section">
                        <div class="perf-metric-title">Database Performance</div>
                        <div class="perf-metric-grid">
                            <div class="perf-metric-item">
                                <span class="perf-metric-label">Avg Query Time</span>
                                <span class="perf-metric-value" id="perf-query-time">--</span>
                            </div>
                            <div class="perf-metric-item">
                                <span class="perf-metric-label">Query Status</span>
                                <span class="perf-status" id="perf-query-status">--</span>
                            </div>
                        </div>
                    </div>

                    <!-- Stash Metrics -->
                    <div class="perf-metric-section">
                        <div class="perf-metric-title">Stash Statistics</div>
                        <div class="perf-metric-grid">
                            <div class="perf-metric-item">
                                <span class="perf-metric-label">Active Jobs</span>
                                <span class="perf-metric-value" id="perf-active-jobs">--</span>
                            </div>
                            <div class="perf-metric-item">
                                <span class="perf-metric-label">Total Scenes</span>
                                <span class="perf-metric-value" id="perf-scene-count">--</span>
                            </div>
                        </div>
                    </div>

                    <!-- Recommendations -->
                    <div class="perf-recommendations" id="perf-recommendations">
                        <div class="perf-metric-title">Optimization Recommendations</div>
                        <div id="perf-recommendations-list"></div>
                    </div>

                    <button class="perf-settings-btn" id="perf-settings-btn">⚙️ Settings</button>
                </div>
            `;

            document.body.appendChild(dashboard);
            this.dashboard = dashboard;

            // Position based on config
            const position = getConfig(CONFIG.DASHBOARD_POSITION);
            this.setDashboardPosition(position);

            // Show/hide based on config
            if (!getConfig(CONFIG.SHOW_DASHBOARD)) {
                this.dashboard.style.display = 'none';
            }
            
            // Update toggle button visibility now that dashboard exists
            this.updateToggleButtonVisibility();
        }

        setDashboardPosition(position) {
            const positions = {
                'top-left': { top: '20px', left: '20px', bottom: 'auto', right: 'auto' },
                'top-right': { top: '20px', right: '20px', bottom: 'auto', left: 'auto' },
                'bottom-left': { bottom: '20px', left: '20px', top: 'auto', right: 'auto' },
                'bottom-right': { bottom: '20px', right: '20px', top: 'auto', left: 'auto' }
            };

            const pos = positions[position] || positions['bottom-left'];
            Object.assign(this.dashboard.style, pos);
        }

        setupEventListeners() {
            // Toggle button
            this.toggleBtn.addEventListener('click', () => {
                this.toggleDashboard();
            });

            // Dashboard controls
            document.getElementById('perf-minimize-btn').addEventListener('click', () => {
                this.toggleMinimize();
            });

            document.getElementById('perf-close-btn').addEventListener('click', () => {
                this.closeDashboard();
            });

            document.getElementById('perf-refresh-btn').addEventListener('click', () => {
                this.updateDashboard();
            });

            document.getElementById('perf-settings-btn').addEventListener('click', () => {
                this.showSettings();
            });

            // Export button
            document.getElementById('perf-export-btn').addEventListener('click', () => {
                this.showExportMenu();
            });

            // Benchmark button
            document.getElementById('perf-benchmark-btn').addEventListener('click', () => {
                this.runBenchmark();
            });

            // Listen for metric updates
            window.addEventListener('performanceMetricsUpdate', (event) => {
                this.updateDashboard(event.detail);
            });

            // Make dashboard draggable
            this.makeDraggable();
        }

        makeDraggable() {
            const header = this.dashboard.querySelector('.perf-dashboard-header');
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;

            const dragStart = (e) => {
                if (e.type === "touchstart") {
                    initialX = e.touches[0].clientX - xOffset;
                    initialY = e.touches[0].clientY - yOffset;
                } else {
                    initialX = e.clientX - xOffset;
                    initialY = e.clientY - yOffset;
                }

                if (e.target === header) {
                    isDragging = true;
                }
            };

            const dragEnd = (e) => {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
            };

            const drag = (e) => {
                if (isDragging) {
                    e.preventDefault();

                    if (e.type === "touchmove") {
                        currentX = e.touches[0].clientX - initialX;
                        currentY = e.touches[0].clientY - initialY;
                    } else {
                        currentX = e.clientX - initialX;
                        currentY = e.clientY - initialY;
                    }

                    xOffset = currentX;
                    yOffset = currentY;

                    this.dashboard.style.transform = `translate(${currentX}px, ${currentY}px)`;
                }
            };

            header.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
        }

        toggleMinimize() {
            this.isMinimized = !this.isMinimized;
            this.dashboard.classList.toggle('minimized', this.isMinimized);
            document.getElementById('perf-minimize-btn').textContent = this.isMinimized ? '+' : '−';
        }

        closeDashboard() {
            setConfig(CONFIG.SHOW_DASHBOARD, false);
            this.dashboard.style.display = 'none';
            this.updateToggleButtonVisibility();
        }

        toggleDashboard() {
            const isShowing = this.dashboard.style.display !== 'none';
            
            if (isShowing) {
                this.closeDashboard();
            } else {
                setConfig(CONFIG.SHOW_DASHBOARD, true);
                this.dashboard.style.display = 'block';
                this.updateToggleButtonVisibility();
                this.updateDashboard();
            }
        }

        updateToggleButtonVisibility() {
            const isDashboardVisible = this.dashboard.style.display !== 'none';
            this.toggleBtn.classList.toggle('hidden', isDashboardVisible);
        }

        startUpdates() {
            // Update dashboard periodically
            setInterval(() => {
                // Only update if dashboard is visible and not minimized
                if (this.dashboard.style.display !== 'none' && !this.isMinimized) {
                    this.updateDashboard();
                }
            }, 5000);

            // Initial update
            this.updateDashboard();
        }

        async updateDashboard(metrics) {
            try {
                // Get latest data if not provided
                if (!metrics) {
                    metrics = this.metricsCollector.getLatestMetrics();
                }

                // Update system metrics
                this.updateSystemMetrics(metrics);

                // Update database metrics
                this.updateDatabaseMetrics(metrics);

                // Update Stash metrics
                this.updateStashMetrics(metrics);

                // Update scan progress
                this.updateScanProgress();

                // Update alerts
                this.updateAlerts();

                // Update recommendations
                await this.updateRecommendations();

                // Update overall score
                await this.updateOverallScore();

            } catch (error) {
                console.error('Dashboard update error:', error);
            }
        }

        updateSystemMetrics(metrics) {
            if (!metrics?.system?.memory) {
                document.getElementById('perf-memory-usage').textContent = '--';
                document.getElementById('perf-fps').textContent = '--';
                return;
            }

            // Memory usage
            const memoryUsage = metrics.system.memory.usage || 0;
            
            // Only show memory if we have real data
            if (memoryUsage > 0) {
                document.getElementById('perf-memory-usage').textContent = `${memoryUsage.toFixed(1)}%`;
                
                const memoryBar = document.getElementById('perf-memory-bar');
                memoryBar.style.width = `${memoryUsage}%`;
                
                if (memoryUsage >= getConfig(CONFIG.MEMORY_CRITICAL)) {
                    memoryBar.className = 'perf-progress-fill perf-progress-critical';
                } else if (memoryUsage >= getConfig(CONFIG.MEMORY_WARNING)) {
                    memoryBar.className = 'perf-progress-fill perf-progress-warning';
                } else {
                    memoryBar.className = 'perf-progress-fill perf-progress-good';
                }
            } else {
                document.getElementById('perf-memory-usage').textContent = 'N/A';
                const memoryBar = document.getElementById('perf-memory-bar');
                memoryBar.style.width = '0%';
            }

            // FPS
            if (metrics.performance?.fps) {
                document.getElementById('perf-fps').textContent = `${metrics.performance.fps} fps`;
            }
        }

        updateDatabaseMetrics(metrics) {
            if (!metrics?.database) {
                document.getElementById('perf-query-time').textContent = '--';
                document.getElementById('perf-query-status').textContent = '--';
                return;
            }

            // Query time
            const avgTime = metrics.database.avgQueryTime;
            document.getElementById('perf-query-time').textContent = `${Math.round(avgTime)}ms`;

            // Query status
            const status = document.getElementById('perf-query-status');
            const rating = this.getQueryRating(avgTime);
            status.textContent = rating.toUpperCase();
            status.className = `perf-status perf-status-${rating}`;
        }

        getQueryRating(avgTime) {
            if (avgTime < 100) return 'excellent';
            if (avgTime < 500) return 'good';
            if (avgTime < 1000) return 'fair';
            if (avgTime < 2000) return 'poor';
            return 'critical';
        }

        updateStashMetrics(metrics) {
            if (!metrics?.stash) {
                document.getElementById('perf-active-jobs').textContent = '--';
                document.getElementById('perf-scene-count').textContent = '--';
                return;
            }

            // Active jobs
            document.getElementById('perf-active-jobs').textContent = metrics.stash.activeJobs || 0;

            // Scene count
            if (metrics.stash.stats?.scene_count) {
                document.getElementById('perf-scene-count').textContent = 
                    metrics.stash.stats.scene_count.toLocaleString();
            }
        }

        updateScanProgress() {
            const scanProgress = this.scanTracker.trackScanProgress();
            const scanContainer = document.getElementById('perf-scan-progress');
            
            if (scanProgress && scanProgress.status === 'RUNNING') {
                scanContainer.style.display = 'block';
                
                const details = document.getElementById('perf-scan-details');
                details.innerHTML = `
                    <div>${scanProgress.description}</div>
                    <div>Progress: ${scanProgress.progress.toFixed(1)}%</div>
                    <div>Speed: ${scanProgress.filesPerMinute} files/min</div>
                `;
                
                const progressBar = document.getElementById('perf-scan-progress-bar');
                progressBar.style.width = `${scanProgress.progress}%`;
            } else {
                scanContainer.style.display = 'none';
            }
        }

        updateAlerts() {
            const alertsContainer = document.getElementById('perf-alerts');
            const recentAlerts = this.resourceMonitor.getRecentAlerts(3);
            
            if (recentAlerts.length === 0) {
                alertsContainer.innerHTML = '';
                return;
            }

            alertsContainer.innerHTML = recentAlerts.map(alert => `
                <div class="perf-alert perf-alert-${alert.severity}">
                    <span>${alert.severity === 'critical' ? '🚨' : '⚠️'}</span>
                    <span>${alert.message}</span>
                </div>
            `).join('');
        }

        async updateRecommendations() {
            const optimizations = await this.optimizationEngine.generateOptimizations();
            const container = document.getElementById('perf-recommendations-list');
            
            if (!optimizations || optimizations.recommendations.length === 0) {
                container.innerHTML = '<div style="color: #95a5a6; font-size: 12px;">No recommendations at this time</div>';
                return;
            }

            container.innerHTML = optimizations.recommendations.slice(0, 3).map(rec => `
                <div class="perf-recommendation">
                    <div class="perf-recommendation-title">${rec.title}</div>
                    <div class="perf-recommendation-desc">${rec.description}</div>
                    <div class="perf-recommendation-actions">
                        ${rec.actions.slice(0, 2).map(action => 
                            `<div class="perf-recommendation-action">• ${action}</div>`
                        ).join('')}
                    </div>
                </div>
            `).join('');
        }

        async updateOverallScore() {
            const optimizations = await this.optimizationEngine.generateOptimizations();
            const scoreElement = document.getElementById('perf-overall-score');
            
            if (optimizations && optimizations.overallScore !== undefined) {
                scoreElement.textContent = optimizations.overallScore;
                
                // Color based on score
                if (optimizations.overallScore >= 90) {
                    scoreElement.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
                } else if (optimizations.overallScore >= 70) {
                    scoreElement.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
                } else if (optimizations.overallScore >= 50) {
                    scoreElement.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
                } else {
                    scoreElement.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
                }
                scoreElement.style.webkitBackgroundClip = 'text';
                scoreElement.style.webkitTextFillColor = 'transparent';
            } else {
                scoreElement.textContent = '--';
            }
        }

        showSettings() {
            const settingsDialog = document.createElement('div');
            settingsDialog.className = 'perf-settings-dialog';
            settingsDialog.innerHTML = `
                <div class="perf-settings-overlay"></div>
                <div class="perf-settings-content">
                    <div class="perf-settings-header">
                        <h3>Performance Monitor Settings</h3>
                        <button class="perf-settings-close">✕</button>
                    </div>
                    <div class="perf-settings-body">
                        <div class="perf-settings-section">
                            <h4>Collection Settings</h4>
                            <div class="perf-setting-item">
                                <label>Metrics Collection Interval (seconds)</label>
                                <input type="number" id="metrics-interval" min="1" max="60" value="${getConfig(CONFIG.METRICS_INTERVAL) / 1000}">
                            </div>
                            <div class="perf-setting-item">
                                <label>History Retention (days)</label>
                                <input type="number" id="history-retention" min="1" max="30" value="${getConfig(CONFIG.HISTORY_RETENTION)}">
                            </div>
                        </div>
                        
                        <div class="perf-settings-section">
                            <h4>Performance Thresholds</h4>
                            <div class="perf-setting-item">
                                <label>CPU Warning Threshold (%)</label>
                                <input type="number" id="cpu-warning" min="50" max="100" value="${getConfig(CONFIG.CPU_WARNING)}">
                            </div>
                            <div class="perf-setting-item">
                                <label>CPU Critical Threshold (%)</label>
                                <input type="number" id="cpu-critical" min="50" max="100" value="${getConfig(CONFIG.CPU_CRITICAL)}">
                            </div>
                            <div class="perf-setting-item">
                                <label>Memory Warning Threshold (%)</label>
                                <input type="number" id="memory-warning" min="50" max="100" value="${getConfig(CONFIG.MEMORY_WARNING)}">
                            </div>
                            <div class="perf-setting-item">
                                <label>Memory Critical Threshold (%)</label>
                                <input type="number" id="memory-critical" min="50" max="100" value="${getConfig(CONFIG.MEMORY_CRITICAL)}">
                            </div>
                            <div class="perf-setting-item">
                                <label>Slow Query Threshold (ms)</label>
                                <input type="number" id="query-slow-threshold" min="100" max="10000" value="${getConfig(CONFIG.QUERY_SLOW_THRESHOLD)}">
                            </div>
                        </div>
                        
                        <div class="perf-settings-section">
                            <h4>Feature Toggles</h4>
                            <div class="perf-setting-item">
                                <label>
                                    <input type="checkbox" id="enable-database-monitoring" ${getConfig(CONFIG.ENABLE_DATABASE_MONITORING) ? 'checked' : ''}>
                                    Enable Database Monitoring
                                </label>
                            </div>
                            <div class="perf-setting-item">
                                <label>
                                    <input type="checkbox" id="enable-resource-monitoring" ${getConfig(CONFIG.ENABLE_RESOURCE_MONITORING) ? 'checked' : ''}>
                                    Enable Resource Monitoring
                                </label>
                            </div>
                            <div class="perf-setting-item">
                                <label>
                                    <input type="checkbox" id="enable-scan-tracking" ${getConfig(CONFIG.ENABLE_SCAN_TRACKING) ? 'checked' : ''}>
                                    Enable Scan Tracking
                                </label>
                            </div>
                            <div class="perf-setting-item">
                                <label>
                                    <input type="checkbox" id="enable-alerts" ${getConfig(CONFIG.ENABLE_ALERTS) ? 'checked' : ''}>
                                    Enable Performance Alerts
                                </label>
                            </div>
                            <div class="perf-setting-item">
                                <label>
                                    <input type="checkbox" id="enable-history" ${getConfig(CONFIG.ENABLE_HISTORY) ? 'checked' : ''}>
                                    Enable History Tracking
                                </label>
                            </div>
                            <div class="perf-setting-item">
                                <label>
                                    <input type="checkbox" id="enable-benchmarks" ${getConfig(CONFIG.ENABLE_BENCHMARKS) ? 'checked' : ''}>
                                    Enable Benchmarking
                                </label>
                            </div>
                        </div>
                        
                        <div class="perf-settings-section">
                            <h4>UI Settings</h4>
                            <div class="perf-setting-item">
                                <label>
                                    <input type="checkbox" id="compact-mode" ${getConfig(CONFIG.COMPACT_MODE) ? 'checked' : ''}>
                                    Compact Mode
                                </label>
                            </div>
                            <div class="perf-setting-item">
                                <label>Dashboard Position</label>
                                <select id="dashboard-position">
                                    <option value="bottom-left" ${getConfig(CONFIG.DASHBOARD_POSITION) === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
                                    <option value="bottom-right" ${getConfig(CONFIG.DASHBOARD_POSITION) === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
                                    <option value="top-left" ${getConfig(CONFIG.DASHBOARD_POSITION) === 'top-left' ? 'selected' : ''}>Top Left</option>
                                    <option value="top-right" ${getConfig(CONFIG.DASHBOARD_POSITION) === 'top-right' ? 'selected' : ''}>Top Right</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="perf-settings-actions">
                            <button class="perf-btn perf-btn-primary" id="perf-save-settings">Save Settings</button>
                            <button class="perf-btn perf-btn-secondary" id="perf-cancel-settings">Cancel</button>
                            <button class="perf-btn perf-btn-danger" id="perf-reset-settings">Reset to Defaults</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(settingsDialog);
            
            // Add settings styles
            GM_addStyle(`
                .perf-settings-dialog {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10001;
                }
                
                .perf-settings-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.7);
                }
                
                .perf-settings-content {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #2c3e50;
                    border-radius: 10px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    width: 600px;
                    max-width: 90%;
                    max-height: 80vh;
                    overflow: hidden;
                }
                
                .perf-settings-header {
                    padding: 20px;
                    background: #34495e;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .perf-settings-header h3 {
                    margin: 0;
                    color: #ecf0f1;
                }
                
                .perf-settings-close {
                    background: none;
                    border: none;
                    color: #ecf0f1;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                }
                
                .perf-settings-body {
                    padding: 20px;
                    overflow-y: auto;
                    max-height: calc(80vh - 150px);
                }
                
                .perf-settings-section {
                    margin-bottom: 25px;
                }
                
                .perf-settings-section h4 {
                    color: #3498db;
                    margin-bottom: 15px;
                }
                
                .perf-setting-item {
                    margin-bottom: 15px;
                }
                
                .perf-setting-item label {
                    display: block;
                    color: #ecf0f1;
                    margin-bottom: 5px;
                    font-size: 14px;
                }
                
                .perf-setting-item input[type="number"],
                .perf-setting-item select {
                    width: 100%;
                    padding: 8px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 4px;
                    color: #ecf0f1;
                }
                
                .perf-setting-item input[type="checkbox"] {
                    margin-right: 8px;
                }
                
                .perf-settings-actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                
                .perf-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s ease;
                }
                
                .perf-btn-primary {
                    background: #3498db;
                    color: white;
                }
                
                .perf-btn-secondary {
                    background: #7f8c8d;
                    color: white;
                }
                
                .perf-btn-danger {
                    background: #e74c3c;
                    color: white;
                    margin-left: auto;
                }
                
                .perf-btn:hover {
                    opacity: 0.8;
                }
            `);
            
            // Event handlers
            const closeDialog = () => settingsDialog.remove();
            
            settingsDialog.querySelector('.perf-settings-overlay').addEventListener('click', closeDialog);
            settingsDialog.querySelector('.perf-settings-close').addEventListener('click', closeDialog);
            document.getElementById('perf-cancel-settings').addEventListener('click', closeDialog);
            
            document.getElementById('perf-save-settings').addEventListener('click', () => {
                // Save all settings
                setConfig(CONFIG.METRICS_INTERVAL, parseInt(document.getElementById('metrics-interval').value) * 1000);
                setConfig(CONFIG.HISTORY_RETENTION, parseInt(document.getElementById('history-retention').value));
                setConfig(CONFIG.CPU_WARNING, parseInt(document.getElementById('cpu-warning').value));
                setConfig(CONFIG.CPU_CRITICAL, parseInt(document.getElementById('cpu-critical').value));
                setConfig(CONFIG.MEMORY_WARNING, parseInt(document.getElementById('memory-warning').value));
                setConfig(CONFIG.MEMORY_CRITICAL, parseInt(document.getElementById('memory-critical').value));
                setConfig(CONFIG.QUERY_SLOW_THRESHOLD, parseInt(document.getElementById('query-slow-threshold').value));
                
                setConfig(CONFIG.ENABLE_DATABASE_MONITORING, document.getElementById('enable-database-monitoring').checked);
                setConfig(CONFIG.ENABLE_RESOURCE_MONITORING, document.getElementById('enable-resource-monitoring').checked);
                setConfig(CONFIG.ENABLE_SCAN_TRACKING, document.getElementById('enable-scan-tracking').checked);
                setConfig(CONFIG.ENABLE_ALERTS, document.getElementById('enable-alerts').checked);
                setConfig(CONFIG.ENABLE_HISTORY, document.getElementById('enable-history').checked);
                setConfig(CONFIG.ENABLE_BENCHMARKS, document.getElementById('enable-benchmarks').checked);
                
                setConfig(CONFIG.COMPACT_MODE, document.getElementById('compact-mode').checked);
                setConfig(CONFIG.DASHBOARD_POSITION, document.getElementById('dashboard-position').value);
                
                closeDialog();
                
                // Notify user
                alert('Settings saved! The monitor will restart with the new configuration.');
                location.reload();
            });
            
            document.getElementById('perf-reset-settings').addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all settings to defaults?')) {
                    Object.keys(CONFIG).forEach(key => {
                        setConfig(CONFIG[key], DEFAULTS[CONFIG[key]]);
                    });
                    closeDialog();
                    alert('Settings reset to defaults! The page will reload.');
                    location.reload();
                }
            });
        }

        showExportMenu() {
            const exportDialog = document.createElement('div');
            exportDialog.className = 'perf-settings-dialog';
            exportDialog.innerHTML = `
                <div class="perf-settings-overlay"></div>
                <div class="perf-settings-content" style="width: 400px;">
                    <div class="perf-settings-header">
                        <h3>Export Performance Data</h3>
                        <button class="perf-settings-close">✕</button>
                    </div>
                    <div class="perf-settings-body">
                        <div class="perf-settings-section">
                            <h4>Export Format</h4>
                            <div class="perf-setting-item">
                                <button class="perf-btn perf-btn-primary" id="export-json" style="width: 100%; margin-bottom: 10px;">
                                    📄 Export as JSON
                                </button>
                                <button class="perf-btn perf-btn-primary" id="export-csv" style="width: 100%; margin-bottom: 10px;">
                                    📊 Export as CSV
                                </button>
                                <button class="perf-btn perf-btn-primary" id="export-html" style="width: 100%;">
                                    🌐 Export as HTML Report
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(exportDialog);

            // Event handlers
            const closeDialog = () => exportDialog.remove();
            
            exportDialog.querySelector('.perf-settings-overlay').addEventListener('click', closeDialog);
            exportDialog.querySelector('.perf-settings-close').addEventListener('click', closeDialog);
            
            document.getElementById('export-json').addEventListener('click', () => {
                this.dataExporter.exportAsJSON();
                closeDialog();
            });
            
            document.getElementById('export-csv').addEventListener('click', () => {
                this.dataExporter.exportAsCSV();
                closeDialog();
            });
            
            document.getElementById('export-html').addEventListener('click', () => {
                this.dataExporter.exportAsHTML();
                closeDialog();
            });
        }

        async runBenchmark() {
            if (this.benchmark.isRunning) {
                this.alertSystem.showAlert('info', 'Benchmark already running');
                return;
            }

            // Show progress
            const progressDialog = document.createElement('div');
            progressDialog.className = 'perf-settings-dialog';
            progressDialog.innerHTML = `
                <div class="perf-settings-overlay"></div>
                <div class="perf-settings-content" style="width: 500px;">
                    <div class="perf-settings-header">
                        <h3>Running Performance Benchmark</h3>
                    </div>
                    <div class="perf-settings-body">
                        <div class="perf-metric-section">
                            <div class="perf-metric-title">Benchmark Progress</div>
                            <div class="perf-progress-bar">
                                <div class="perf-progress-fill perf-progress-good" id="benchmark-progress" style="width: 0%"></div>
                            </div>
                            <div id="benchmark-status" style="margin-top: 10px; text-align: center;">Initializing...</div>
                        </div>
                        <div id="benchmark-results" style="margin-top: 20px;"></div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(progressDialog);
            
            // Update progress
            const updateProgress = (percent, status) => {
                document.getElementById('benchmark-progress').style.width = `${percent}%`;
                document.getElementById('benchmark-status').textContent = status;
            };
            
            try {
                updateProgress(25, 'Testing database performance...');
                const results = await this.benchmark.runBenchmark();
                
                if (results) {
                    updateProgress(100, 'Benchmark complete!');
                    
                    // Display results
                    const resultsDiv = document.getElementById('benchmark-results');
                    resultsDiv.innerHTML = `
                        <div class="perf-metric-section">
                            <div class="perf-metric-title">Benchmark Results</div>
                            <div class="perf-score-container">
                                <div class="perf-score-value">${results.overall}</div>
                                <div class="perf-score-label">Overall Score</div>
                            </div>
                            <div class="perf-metric-grid" style="margin-top: 20px;">
                                <div class="perf-metric-item">
                                    <span class="perf-metric-label">Database</span>
                                    <span class="perf-metric-value">${results.tests.database?.score || '--'}/100</span>
                                </div>
                                <div class="perf-metric-item">
                                    <span class="perf-metric-label">API</span>
                                    <span class="perf-metric-value">${results.tests.api?.score || '--'}/100</span>
                                </div>
                                <div class="perf-metric-item">
                                    <span class="perf-metric-label">UI</span>
                                    <span class="perf-metric-value">${results.tests.ui?.score || '--'}/100</span>
                                </div>
                                <div class="perf-metric-item">
                                    <span class="perf-metric-label">File System</span>
                                    <span class="perf-metric-value">${results.tests.filesystem?.score || '--'}/100</span>
                                </div>
                            </div>
                            <button class="perf-btn perf-btn-primary" style="width: 100%; margin-top: 20px;" onclick="this.parentElement.parentElement.parentElement.parentElement.remove()">
                                Close
                            </button>
                        </div>
                    `;
                    
                    // Show alert
                    this.alertSystem.showAlert('success', `Benchmark complete! Score: ${results.overall}/100`);
                }
            } catch (error) {
                console.error('Benchmark error:', error);
                this.alertSystem.showAlert('error', 'Benchmark failed: ' + error.message);
                progressDialog.remove();
            }
        }
    }

    // ===== BENCHMARKING SYSTEM =====
    class PerformanceBenchmark {
        constructor(graphqlClient, metricsCollector) {
            this.graphql = graphqlClient;
            this.metricsCollector = metricsCollector;
            this.benchmarkResults = [];
            this.isRunning = false;
        }

        async runBenchmark() {
            if (this.isRunning) {
                console.warn('Benchmark already running');
                return null;
            }

            this.isRunning = true;
            const results = {
                timestamp: Date.now(),
                tests: {},
                overall: 0
            };

            try {
                // Test 1: Database query performance
                results.tests.database = await this.testDatabasePerformance();
                
                // Test 2: GraphQL API responsiveness
                results.tests.api = await this.testAPIPerformance();
                
                // Test 3: UI rendering performance
                results.tests.ui = await this.testUIPerformance();
                
                // Test 4: File system operations (via API)
                results.tests.filesystem = await this.testFileSystemPerformance();
                
                // Calculate overall score
                results.overall = this.calculateOverallScore(results.tests);
                
                // Store results
                this.benchmarkResults.push(results);
                if (this.benchmarkResults.length > 10) {
                    this.benchmarkResults = this.benchmarkResults.slice(-10);
                }
                
            } catch (error) {
                console.error('Benchmark error:', error);
            } finally {
                this.isRunning = false;
            }

            return results;
        }

        async testDatabasePerformance() {
            const tests = [];
            const queries = [
                { name: 'Stats Query', query: GRAPHQL_QUERIES.STATS },
                { name: 'System Status', query: GRAPHQL_QUERIES.SYSTEM_STATUS },
                { name: 'Job Queue', query: GRAPHQL_QUERIES.JOB_STATUS }
            ];

            for (const test of queries) {
                const startTime = performance.now();
                try {
                    await this.graphql.query(test.query);
                    const duration = performance.now() - startTime;
                    tests.push({
                        name: test.name,
                        duration,
                        success: true
                    });
                } catch (error) {
                    tests.push({
                        name: test.name,
                        duration: performance.now() - startTime,
                        success: false,
                        error: error.message
                    });
                }
            }

            const avgDuration = tests.reduce((sum, t) => sum + t.duration, 0) / tests.length;
            return {
                tests,
                avgDuration,
                score: this.calculateDatabaseScore(avgDuration)
            };
        }

        async testAPIPerformance() {
            const endpoints = [
                '/graphql',
                '/api/v1/stats'
            ];
            const tests = [];

            for (const endpoint of endpoints) {
                const startTime = performance.now();
                try {
                    await fetch(endpoint, { method: 'GET' });
                    const duration = performance.now() - startTime;
                    tests.push({
                        endpoint,
                        duration,
                        success: true
                    });
                } catch (error) {
                    tests.push({
                        endpoint,
                        duration: performance.now() - startTime,
                        success: false
                    });
                }
            }

            const avgDuration = tests.reduce((sum, t) => sum + t.duration, 0) / tests.length;
            return {
                tests,
                avgDuration,
                score: this.calculateAPIScore(avgDuration)
            };
        }

        async testUIPerformance() {
            const startTime = performance.now();
            
            // Force a render by creating and removing elements
            const testContainer = document.createElement('div');
            testContainer.style.display = 'none';
            document.body.appendChild(testContainer);
            
            // Add 100 test elements
            for (let i = 0; i < 100; i++) {
                const elem = document.createElement('div');
                elem.textContent = `Test ${i}`;
                testContainer.appendChild(elem);
            }
            
            // Force reflow
            testContainer.offsetHeight;
            
            // Remove elements
            while (testContainer.firstChild) {
                testContainer.removeChild(testContainer.firstChild);
            }
            
            document.body.removeChild(testContainer);
            
            const duration = performance.now() - startTime;
            const fps = this.metricsCollector.currentFPS;
            
            return {
                renderTime: duration,
                fps,
                score: this.calculateUIScore(duration, fps)
            };
        }

        async testFileSystemPerformance() {
            // Test file system operations via GraphQL
            const startTime = performance.now();
            
            try {
                // Try to get scan status which involves file system checks
                const jobs = await this.graphql.getJobStatus();
                const duration = performance.now() - startTime;
                
                return {
                    duration,
                    success: true,
                    score: this.calculateFileSystemScore(duration)
                };
            } catch (error) {
                return {
                    duration: performance.now() - startTime,
                    success: false,
                    score: 0
                };
            }
        }

        calculateDatabaseScore(avgDuration) {
            if (avgDuration < 50) return 100;
            if (avgDuration < 100) return 90;
            if (avgDuration < 200) return 80;
            if (avgDuration < 500) return 70;
            if (avgDuration < 1000) return 60;
            return 50;
        }

        calculateAPIScore(avgDuration) {
            if (avgDuration < 100) return 100;
            if (avgDuration < 200) return 90;
            if (avgDuration < 400) return 80;
            if (avgDuration < 800) return 70;
            if (avgDuration < 1500) return 60;
            return 50;
        }

        calculateUIScore(renderTime, fps) {
            let score = 100;
            
            // Deduct for slow render
            if (renderTime > 100) score -= 20;
            else if (renderTime > 50) score -= 10;
            
            // Deduct for low FPS
            if (fps < 30) score -= 30;
            else if (fps < 50) score -= 10;
            
            return Math.max(50, score);
        }

        calculateFileSystemScore(duration) {
            if (duration < 200) return 100;
            if (duration < 500) return 90;
            if (duration < 1000) return 80;
            if (duration < 2000) return 70;
            return 60;
        }

        calculateOverallScore(tests) {
            const scores = Object.values(tests).map(t => t.score || 0);
            return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
        }

        getLatestBenchmark() {
            return this.benchmarkResults[this.benchmarkResults.length - 1] || null;
        }

        compareBenchmarks(current, baseline) {
            if (!current || !baseline) return null;

            const comparison = {
                overall: {
                    current: current.overall,
                    baseline: baseline.overall,
                    difference: current.overall - baseline.overall,
                    improved: current.overall > baseline.overall
                },
                categories: {}
            };

            for (const key in current.tests) {
                if (baseline.tests[key]) {
                    comparison.categories[key] = {
                        current: current.tests[key].score,
                        baseline: baseline.tests[key].score,
                        difference: current.tests[key].score - baseline.tests[key].score,
                        improved: current.tests[key].score > baseline.tests[key].score
                    };
                }
            }

            return comparison;
        }
    }

    // ===== ALERT SYSTEM =====
    class AlertSystem {
        constructor() {
            this.activeAlerts = new Map();
            this.alertHistory = [];
            this.notificationPermission = false;
            this.checkNotificationPermission();
        }

        async checkNotificationPermission() {
            if ('Notification' in window) {
                if (Notification.permission === 'granted') {
                    this.notificationPermission = true;
                } else if (Notification.permission !== 'denied') {
                    const permission = await Notification.requestPermission();
                    this.notificationPermission = permission === 'granted';
                }
            }
        }

        createAlert(type, severity, message, details = {}) {
            const alert = {
                id: Date.now() + Math.random(),
                type,
                severity,
                message,
                details,
                timestamp: Date.now(),
                resolved: false
            };

            this.activeAlerts.set(alert.id, alert);
            this.alertHistory.push(alert);

            // Keep only last 100 alerts in history
            if (this.alertHistory.length > 100) {
                this.alertHistory = this.alertHistory.slice(-100);
            }

            // Send notification if enabled
            if (getConfig(CONFIG.ENABLE_ALERTS) && severity === 'critical') {
                this.sendNotification(alert);
            }

            return alert;
        }

        resolveAlert(alertId) {
            const alert = this.activeAlerts.get(alertId);
            if (alert) {
                alert.resolved = true;
                alert.resolvedAt = Date.now();
                this.activeAlerts.delete(alertId);
            }
        }

        sendNotification(alert) {
            if (this.notificationPermission) {
                const notification = new Notification('Stash Performance Alert', {
                    body: alert.message,
                    icon: '📊',
                    badge: '🚨',
                    requireInteraction: alert.severity === 'critical'
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };
            }
        }

        showAlert(type, message) {
            // Map simple types to severity
            const severityMap = {
                'success': 'info',
                'info': 'info',
                'warning': 'warning',
                'error': 'critical',
                'critical': 'critical'
            };
            
            const severity = severityMap[type] || 'info';
            const alert = this.createAlert(type, severity, message);
            
            // Send browser notification
            if (getConfig(CONFIG.ENABLE_ALERTS)) {
                this.sendNotification(alert);
            }
            
            // Also show in UI if available
            const alertsDiv = document.getElementById('perf-alerts');
            if (alertsDiv) {
                const alertElement = document.createElement('div');
                alertElement.className = `perf-alert perf-alert-${severity}`;
                alertElement.innerHTML = `
                    <div class="perf-alert-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</div>
                    <div class="perf-alert-message">${message}</div>
                    <button class="perf-alert-close" onclick="this.parentElement.remove()">×</button>
                `;
                alertsDiv.appendChild(alertElement);
                
                // Auto-remove after 5 seconds for non-critical alerts
                if (severity !== 'critical') {
                    setTimeout(() => alertElement.remove(), 5000);
                }
            }
            
            return alert;
        }

        getActiveAlerts(severity = null) {
            const alerts = Array.from(this.activeAlerts.values());
            if (severity) {
                return alerts.filter(a => a.severity === severity);
            }
            return alerts;
        }

        getRecentAlerts(count = 10) {
            return this.alertHistory.slice(-count);
        }

        checkThresholds(metrics) {
            const alerts = [];

            // Check memory threshold
            if (metrics?.system?.memory?.usage) {
                const usage = metrics.system.memory.usage;
                if (usage >= getConfig(CONFIG.MEMORY_CRITICAL)) {
                    alerts.push(this.createAlert(
                        'memory',
                        'critical',
                        `Critical memory usage: ${usage.toFixed(1)}%`,
                        { usage, threshold: getConfig(CONFIG.MEMORY_CRITICAL) }
                    ));
                } else if (usage >= getConfig(CONFIG.MEMORY_WARNING)) {
                    alerts.push(this.createAlert(
                        'memory',
                        'warning',
                        `High memory usage: ${usage.toFixed(1)}%`,
                        { usage, threshold: getConfig(CONFIG.MEMORY_WARNING) }
                    ));
                }
            }

            // Check query performance
            if (metrics?.database?.avgQueryTime) {
                const avgTime = metrics.database.avgQueryTime;
                const threshold = getConfig(CONFIG.QUERY_SLOW_THRESHOLD);
                if (avgTime > threshold * 2) {
                    alerts.push(this.createAlert(
                        'database',
                        'critical',
                        `Very slow database queries: ${Math.round(avgTime)}ms average`,
                        { avgTime, threshold }
                    ));
                } else if (avgTime > threshold) {
                    alerts.push(this.createAlert(
                        'database',
                        'warning',
                        `Slow database queries: ${Math.round(avgTime)}ms average`,
                        { avgTime, threshold }
                    ));
                }
            }

            return alerts;
        }
    }

    // ===== DATA EXPORT =====
    class DataExporter {
        constructor(metricsCollector, dbAnalyzer, scanTracker) {
            this.metricsCollector = metricsCollector;
            this.dbAnalyzer = dbAnalyzer;
            this.scanTracker = scanTracker;
        }

        exportMetrics(format = 'json', duration = 3600000) {
            const data = {
                exportDate: new Date().toISOString(),
                duration: duration,
                metrics: this.metricsCollector.getMetricsHistory(duration),
                analysis: this.dbAnalyzer.getLatestAnalysis(),
                scanHistory: this.scanTracker.getScanHistory()
            };

            switch (format) {
                case 'json':
                    return this.exportJSON(data);
                case 'csv':
                    return this.exportCSV(data);
                case 'html':
                    return this.exportHTML(data);
                default:
                    return this.exportJSON(data);
            }
        }

        exportJSON(data) {
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });
            this.downloadFile(blob, `stash-performance-${Date.now()}.json`);
        }

        exportCSV(data) {
            let csv = 'Timestamp,Memory Usage %,FPS,Avg Query Time,Active Jobs,Scene Count\n';
            
            data.metrics.forEach(metric => {
                csv += [
                    new Date(metric.timestamp).toISOString(),
                    metric.system?.memory?.usage || 0,
                    metric.performance?.fps || 0,
                    metric.database?.avgQueryTime || 0,
                    metric.stash?.activeJobs || 0,
                    metric.stash?.stats?.scene_count || 0
                ].join(',') + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            this.downloadFile(blob, `stash-performance-${Date.now()}.csv`);
        }

        exportHTML(data) {
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Stash Performance Report - ${new Date().toLocaleDateString()}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1, h2 { color: #3498db; }
                        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background: #3498db; color: white; }
                        .metric { margin: 20px 0; }
                        .warning { color: #f39c12; }
                        .critical { color: #e74c3c; }
                    </style>
                </head>
                <body>
                    <h1>Stash Performance Report</h1>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                    
                    <h2>Summary</h2>
                    <div class="metric">
                        <strong>Monitoring Duration:</strong> ${formatDuration(data.duration / 1000)}
                    </div>
                    <div class="metric">
                        <strong>Total Samples:</strong> ${data.metrics.length}
                    </div>
                    
                    ${this.generateHTMLAnalysis(data)}
                    ${this.generateHTMLMetricsTable(data)}
                </body>
                </html>
            `;

            const blob = new Blob([html], { type: 'text/html' });
            this.downloadFile(blob, `stash-performance-${Date.now()}.html`);
        }

        generateHTMLAnalysis(data) {
            if (!data.analysis) return '';

            return `
                <h2>Performance Analysis</h2>
                <div class="metric">
                    <strong>Overall Score:</strong> ${data.analysis.score}/100
                </div>
                <div class="metric">
                    <strong>Database Performance:</strong> 
                    <span class="${data.analysis.queryPerformance.performanceRating}">${data.analysis.queryPerformance.performanceRating}</span>
                </div>
            `;
        }

        generateHTMLMetricsTable(data) {
            const rows = data.metrics.slice(-20).map(metric => `
                <tr>
                    <td>${new Date(metric.timestamp).toLocaleTimeString()}</td>
                    <td>${metric.system?.memory?.usage?.toFixed(1) || '--'}%</td>
                    <td>${metric.performance?.fps || '--'}</td>
                    <td>${metric.database?.avgQueryTime?.toFixed(0) || '--'}ms</td>
                    <td>${metric.stash?.activeJobs || 0}</td>
                </tr>
            `).join('');

            return `
                <h2>Recent Metrics</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Memory Usage</th>
                            <th>FPS</th>
                            <th>Avg Query Time</th>
                            <th>Active Jobs</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;
        }

        downloadFile(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    // ===== INITIALIZATION =====
    function initialize() {
        console.log('📊 Performance Monitor: Waiting for page to load...');

        // Wait for Stash to fully load
        const checkInterval = setInterval(() => {
            if (document.querySelector('.main') || document.querySelector('[data-rb-event-key]')) {
                clearInterval(checkInterval);
                console.log('✅ Performance Monitor: Page loaded, initializing components...');

                // Initialize components
                const graphqlClient = new GraphQLClient();
                const metricsCollector = new PerformanceMetricsCollector(graphqlClient);
                const dbAnalyzer = new DatabasePerformanceAnalyzer(metricsCollector);
                const resourceMonitor = new ResourceMonitor(metricsCollector);
                const scanTracker = new ScanProgressTracker(graphqlClient, metricsCollector);
                const optimizationEngine = new OptimizationEngine(dbAnalyzer, resourceMonitor, scanTracker);
                const alertSystem = new AlertSystem();
                const dataExporter = new DataExporter(metricsCollector, dbAnalyzer, scanTracker);
                const benchmark = new PerformanceBenchmark(graphqlClient, metricsCollector);

                // Start monitoring
                metricsCollector.startCollection();

                // Create UI (always create it so toggle button works)
                const dashboardUI = new PerformanceDashboardUI(
                    metricsCollector,
                    dbAnalyzer,
                    resourceMonitor,
                    scanTracker,
                    optimizationEngine
                );
                
                // Add additional components to UI
                dashboardUI.alertSystem = alertSystem;
                dashboardUI.dataExporter = dataExporter;
                dashboardUI.benchmark = benchmark;

                // Hook into GraphQL to track query performance
                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    if (args[0] && args[0].toString().includes('/graphql')) {
                        const startTime = performance.now();
                        const response = await originalFetch.apply(this, args);
                        const duration = performance.now() - startTime;
                        
                        // Track query timing
                        const body = args[1]?.body;
                        if (body) {
                            try {
                                const query = JSON.parse(body).query;
                                metricsCollector.trackQueryTiming(query, duration);
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }
                        
                        return response;
                    }
                    return originalFetch.apply(this, args);
                };

                console.log('✅ Performance Monitor: Ready!');
            }
        }, 1000);
    }

    // Start initialization
    initialize();
})();