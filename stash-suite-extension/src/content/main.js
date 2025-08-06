/**
 * Main content script entry point
 * Initializes all Stash Suite tools based on configuration
 */

import { getConfig, CONFIG } from '../common/config.js';
import { showNotification } from '../common/utils.js';
import { automateStash } from './automate-stash.js';
import { bulkOperations } from './bulk-operations.js';
import { qualityAnalyzer } from './quality-analyzer.js';
import { performanceMonitor } from './performance-monitor.js';
import { performerManager } from './performer-manager.js';
import { collectionOrganizer } from './collection-organizer.js';
import { exportImportTools } from './export-import-tools.js';

// Tool registry
const tools = {
    automateStash: {
        instance: automateStash,
        configKey: CONFIG.ENABLE_AUTOMATE_STASH,
        name: 'AutomateStash'
    },
    bulkOperations: {
        instance: bulkOperations,
        configKey: CONFIG.ENABLE_BULK_OPERATIONS,
        name: 'Bulk Operations'
    },
    qualityAnalyzer: {
        instance: qualityAnalyzer,
        configKey: CONFIG.ENABLE_QUALITY_ANALYZER,
        name: 'Quality Analyzer'
    },
    performanceMonitor: {
        instance: performanceMonitor,
        configKey: CONFIG.ENABLE_PERFORMANCE_MONITOR,
        name: 'Performance Monitor'
    },
    performerManager: {
        instance: performerManager,
        configKey: CONFIG.ENABLE_PERFORMER_MANAGER,
        name: 'Performer Manager'
    },
    collectionOrganizer: {
        instance: collectionOrganizer,
        configKey: CONFIG.ENABLE_COLLECTION_ORGANIZER,
        name: 'Collection Organizer'
    },
    exportImportTools: {
        instance: exportImportTools,
        configKey: CONFIG.ENABLE_EXPORT_IMPORT_TOOLS,
        name: 'Export/Import Tools'
    }
};

// Initialize function
async function initialize() {
    console.log('🚀 Stash Suite Extension initializing...');
    
    // Check if we're on a Stash page
    if (!window.location.href.includes('localhost:9998')) {
        console.log('Not on Stash page, skipping initialization');
        return;
    }
    
    // Initialize enabled tools
    for (const [key, tool] of Object.entries(tools)) {
        try {
            const enabled = await getConfig(tool.configKey);
            if (enabled && tool.instance) {
                console.log(`Initializing ${tool.name}...`);
                await tool.instance.init();
                console.log(`✅ ${tool.name} initialized`);
            }
        } catch (error) {
            console.error(`Failed to initialize ${tool.name}:`, error);
            showNotification(`Failed to initialize ${tool.name}`, 'error');
        }
    }
    
    // Setup message listeners
    setupMessageListeners();
    
    console.log('✅ Stash Suite Extension initialized');
}

// Message listener for communication with background script
function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Content script received message:', request);
        
        switch (request.action) {
            case 'ping':
                sendResponse({ status: 'alive' });
                break;
                
            case 'toggleExtension':
                toggleExtension();
                break;
                
            case 'openSettings':
                openSettings();
                break;
                
            case 'configChanged':
                handleConfigChange(request.key, request.value);
                break;
                
            case 'configReset':
                handleConfigReset();
                break;
                
            case 'toolToggled':
                handleToolToggle(request.tool, request.enabled);
                break;
        }
    });
}

// Toggle extension visibility
async function toggleExtension() {
    const panel = document.getElementById('stash-automation-panel');
    const minimizedButton = document.getElementById('stash-minimized-button');
    
    if (panel && panel.style.display !== 'none') {
        // Hide panel, show minimized button
        panel.style.display = 'none';
        if (minimizedButton) {
            minimizedButton.style.display = 'flex';
        }
    } else if (minimizedButton && minimizedButton.style.display !== 'none') {
        // Hide minimized button, show panel
        minimizedButton.style.display = 'none';
        if (panel) {
            panel.style.display = 'block';
        }
    } else {
        // Nothing visible, show panel
        if (panel) {
            panel.style.display = 'block';
        } else if (automateStash.initialized) {
            automateStash.uiManager.show();
        }
    }
}

// Open settings
function openSettings() {
    // Try to open settings in AutomateStash first
    if (automateStash.initialized && automateStash.uiManager) {
        automateStash.uiManager.showSettings();
    } else {
        showNotification('Settings not available', 'warning');
    }
}

// Handle configuration changes
async function handleConfigChange(key, value) {
    console.log(`Config changed: ${key} = ${value}`);
    
    // Check if it's a tool enable/disable change
    for (const [toolKey, tool] of Object.entries(tools)) {
        if (key === tool.configKey) {
            if (value && tool.instance && !tool.instance.initialized) {
                // Tool was enabled, initialize it
                try {
                    await tool.instance.init();
                    showNotification(`${tool.name} enabled`, 'success');
                } catch (error) {
                    console.error(`Failed to initialize ${tool.name}:`, error);
                    showNotification(`Failed to initialize ${tool.name}`, 'error');
                }
            } else if (!value && tool.instance && tool.instance.initialized) {
                // Tool was disabled, clean up if possible
                if (tool.instance.cleanup) {
                    tool.instance.cleanup();
                }
                showNotification(`${tool.name} disabled`, 'info');
            }
            break;
        }
    }
}

// Handle configuration reset
async function handleConfigReset() {
    console.log('Configuration reset, reinitializing...');
    
    // Cleanup all tools
    for (const tool of Object.values(tools)) {
        if (tool.instance && tool.instance.cleanup) {
            tool.instance.cleanup();
        }
    }
    
    // Reinitialize
    await initialize();
    showNotification('Configuration reset to defaults', 'info');
}

// Handle tool toggle
async function handleToolToggle(toolName, enabled) {
    const tool = tools[toolName.charAt(0).toLowerCase() + toolName.slice(1)];
    if (!tool) return;
    
    if (enabled && tool.instance && !tool.instance.initialized) {
        try {
            await tool.instance.init();
            showNotification(`${tool.name} enabled`, 'success');
        } catch (error) {
            console.error(`Failed to initialize ${tool.name}:`, error);
            showNotification(`Failed to initialize ${tool.name}`, 'error');
        }
    } else if (!enabled && tool.instance && tool.instance.initialized) {
        if (tool.instance.cleanup) {
            tool.instance.cleanup();
        }
        showNotification(`${tool.name} disabled`, 'info');
    }
}

// Error handling
window.addEventListener('error', (event) => {
    console.error('Stash Suite Extension error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Stash Suite Extension unhandled rejection:', event.reason);
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}