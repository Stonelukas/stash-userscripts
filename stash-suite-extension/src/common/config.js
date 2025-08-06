/**
 * Configuration management for Stash Suite Extension
 * Replaces GM_getValue/GM_setValue with chrome.storage API
 */

// Configuration keys
export const CONFIG = {
    // AutomateStash configs
    AUTO_SCRAPE_STASHDB: 'autoScrapeStashDB',
    AUTO_SCRAPE_THEPORNDB: 'autoScrapeThePornDB',
    AUTO_ORGANIZE: 'autoOrganize',
    AUTO_CREATE_PERFORMERS: 'autoCreatePerformers',
    SHOW_NOTIFICATIONS: 'showNotifications',
    MINIMIZE_WHEN_COMPLETE: 'minimizeWhenComplete',
    AUTO_APPLY_CHANGES: 'autoApplyChanges',
    SKIP_ALREADY_SCRAPED: 'skipAlreadyScraped',
    ENABLE_CROSS_SCENE_INTELLIGENCE: 'enableCrossSceneIntelligence',
    STASH_ADDRESS: 'stashAddress',
    STASH_API_KEY: 'stashApiKey',
    
    // Bulk Operations configs
    ENABLE_BULK_TAGS: 'enableBulkTags',
    ENABLE_BULK_PERFORMERS: 'enableBulkPerformers',
    ENABLE_BULK_STUDIOS: 'enableBulkStudios',
    ENABLE_BULK_METADATA: 'enableBulkMetadata',
    SHOW_PROGRESS: 'showProgress',
    AUTO_REFRESH: 'autoRefresh',
    MAX_CONCURRENT_OPERATIONS: 'maxConcurrentOperations',
    
    // Tool enable/disable configs
    ENABLE_AUTOMATE_STASH: 'enableAutomateStash',
    ENABLE_BULK_OPERATIONS: 'enableBulkOperations',
    ENABLE_QUALITY_ANALYZER: 'enableQualityAnalyzer',
    ENABLE_PERFORMANCE_MONITOR: 'enablePerformanceMonitor',
    ENABLE_PERFORMER_MANAGER: 'enablePerformerManager',
    ENABLE_COLLECTION_ORGANIZER: 'enableCollectionOrganizer',
    ENABLE_EXPORT_IMPORT_TOOLS: 'enableExportImportTools'
};

// Default values
export const DEFAULTS = {
    // AutomateStash defaults
    [CONFIG.AUTO_SCRAPE_STASHDB]: true,
    [CONFIG.AUTO_SCRAPE_THEPORNDB]: true,
    [CONFIG.AUTO_ORGANIZE]: true,
    [CONFIG.AUTO_CREATE_PERFORMERS]: true,
    [CONFIG.SHOW_NOTIFICATIONS]: true,
    [CONFIG.MINIMIZE_WHEN_COMPLETE]: true,
    [CONFIG.AUTO_APPLY_CHANGES]: false,
    [CONFIG.SKIP_ALREADY_SCRAPED]: true,
    [CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE]: true,
    [CONFIG.STASH_ADDRESS]: 'http://localhost:9998',
    [CONFIG.STASH_API_KEY]: '',
    
    // Bulk Operations defaults
    [CONFIG.ENABLE_BULK_TAGS]: true,
    [CONFIG.ENABLE_BULK_PERFORMERS]: true,
    [CONFIG.ENABLE_BULK_STUDIOS]: true,
    [CONFIG.ENABLE_BULK_METADATA]: true,
    [CONFIG.SHOW_PROGRESS]: true,
    [CONFIG.AUTO_REFRESH]: true,
    [CONFIG.MAX_CONCURRENT_OPERATIONS]: 5,
    
    // Tool enable/disable defaults
    [CONFIG.ENABLE_AUTOMATE_STASH]: true,
    [CONFIG.ENABLE_BULK_OPERATIONS]: true,
    [CONFIG.ENABLE_QUALITY_ANALYZER]: true,
    [CONFIG.ENABLE_PERFORMANCE_MONITOR]: true,
    [CONFIG.ENABLE_PERFORMER_MANAGER]: true,
    [CONFIG.ENABLE_COLLECTION_ORGANIZER]: true,
    [CONFIG.ENABLE_EXPORT_IMPORT_TOOLS]: true
};

// Storage abstraction layer
class ConfigManager {
    constructor() {
        this.cache = new Map();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        try {
            const stored = await chrome.storage.local.get(null);
            Object.entries(stored).forEach(([key, value]) => {
                this.cache.set(key, value);
            });
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize config:', error);
            // Fallback to defaults
            Object.entries(DEFAULTS).forEach(([key, value]) => {
                this.cache.set(key, value);
            });
        }
    }

    async get(key) {
        if (!this.initialized) await this.init();
        
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        
        return DEFAULTS[key];
    }

    async set(key, value) {
        if (!this.initialized) await this.init();
        
        this.cache.set(key, value);
        
        try {
            await chrome.storage.local.set({ [key]: value });
        } catch (error) {
            console.error(`Failed to save config ${key}:`, error);
        }
    }

    async getAll() {
        if (!this.initialized) await this.init();
        
        const result = {};
        for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
            result[key] = await this.get(key);
        }
        return result;
    }

    async reset() {
        try {
            await chrome.storage.local.clear();
            this.cache.clear();
            this.initialized = false;
            await this.init();
        } catch (error) {
            console.error('Failed to reset config:', error);
        }
    }
}

// Create singleton instance
export const configManager = new ConfigManager();

// Backward compatibility functions
export async function getConfig(key) {
    return await configManager.get(key);
}

export async function setConfig(key, value) {
    await configManager.set(key, value);
}

// Initialize on load
configManager.init().catch(console.error);