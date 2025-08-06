/**
 * Performance Monitor Content Script (Placeholder)
 * TODO: Convert from StashPerformanceMonitor.js
 */

import { getConfig, CONFIG } from '../common/config.js';
import { showNotification, logError } from '../common/utils.js';

export class PerformanceMonitor {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        const enabled = await getConfig(CONFIG.ENABLE_PERFORMANCE_MONITOR);
        if (!enabled) return;
        
        console.log('🚀 PerformanceMonitor placeholder initialized');
        this.initialized = true;
    }

    cleanup() {
        this.initialized = false;
    }
}

export const performanceMonitor = new PerformanceMonitor();