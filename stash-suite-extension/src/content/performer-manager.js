/**
 * Performer Manager Content Script (Placeholder)
 * TODO: Convert from StashPerformerManager.js
 */

import { getConfig, CONFIG } from '../common/config.js';
import { showNotification, logError } from '../common/utils.js';

export class PerformerManager {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        const enabled = await getConfig(CONFIG.ENABLE_PERFORMER_MANAGER);
        if (!enabled) return;
        
        console.log('🚀 PerformerManager placeholder initialized');
        this.initialized = true;
    }

    cleanup() {
        this.initialized = false;
    }
}

export const performerManager = new PerformerManager();