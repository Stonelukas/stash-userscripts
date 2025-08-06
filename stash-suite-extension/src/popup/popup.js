/**
 * Popup script for Stash Suite Extension
 */

// Tool configuration mapping
const TOOL_CONFIG_MAP = {
    'AutomateStash': 'enableAutomateStash',
    'BulkOperations': 'enableBulkOperations',
    'QualityAnalyzer': 'enableQualityAnalyzer',
    'PerformanceMonitor': 'enablePerformanceMonitor',
    'PerformerManager': 'enablePerformerManager',
    'CollectionOrganizer': 'enableCollectionOrganizer',
    'ExportImportTools': 'enableExportImportTools'
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup initializing...');
    
    // Set version
    const manifest = chrome.runtime.getManifest();
    document.getElementById('version').textContent = `v${manifest.version}`;
    
    // Check extension status
    await checkExtensionStatus();
    
    // Load current configuration
    await loadConfiguration();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('Popup initialized');
});

// Check if extension is working
async function checkExtensionStatus() {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    try {
        // Check if Stash is accessible
        const tabs = await chrome.tabs.query({ url: 'http://localhost:9998/*' });
        
        if (tabs.length > 0) {
            statusDot.className = 'status-dot active';
            statusText.textContent = `Connected to Stash (${tabs.length} tab${tabs.length > 1 ? 's' : ''})`;
        } else {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Stash not open';
        }
    } catch (error) {
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Extension error';
        console.error('Status check error:', error);
    }
}

// Load current configuration
async function loadConfiguration() {
    console.log('Loading configuration...');
    
    try {
        // Get all storage data directly - most reliable method
        const storage = await chrome.storage.local.get(null);
        console.log('Storage contents:', storage);
        
        // Initialize defaults if storage is empty
        if (!storage || Object.keys(storage).length === 0) {
            console.log('Storage empty, initializing defaults...');
            const defaults = {
                enableAutomateStash: true,
                enableBulkOperations: true,
                enableQualityAnalyzer: true,
                enablePerformanceMonitor: true,
                enablePerformerManager: true,
                enableCollectionOrganizer: true,
                enableExportImportTools: true,
                showNotifications: true,
                autoRefresh: true
            };
            await chrome.storage.local.set(defaults);
            console.log('Defaults initialized');
            
            // Reload configuration with defaults
            await loadConfiguration();
            return;
        }
        
        // Update tool toggles from storage
        for (const [tool, configKey] of Object.entries(TOOL_CONFIG_MAP)) {
            const checkbox = document.querySelector(`[data-tool="${tool}"]`);
            if (checkbox) {
                // Default to true if not set
                const isChecked = storage[configKey] !== false;
                console.log(`Setting ${tool} (${configKey}) to ${isChecked}`);
                checkbox.checked = isChecked;
            }
        }
        
        // Update notification setting
        const notificationCheckbox = document.getElementById('setting-notifications');
        if (notificationCheckbox) {
            notificationCheckbox.checked = storage.showNotifications !== false;
        }
        
        // Update auto-refresh setting
        const autoRefreshCheckbox = document.getElementById('setting-autoRefresh');
        if (autoRefreshCheckbox) {
            autoRefreshCheckbox.checked = storage.autoRefresh !== false;
        }
        
    } catch (error) {
        console.error('Failed to load configuration:', error);
        // Show error in UI
        showError('Failed to load settings');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tool toggles
    document.querySelectorAll('.tool-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const tool = e.target.dataset.tool;
            const enabled = e.target.checked;
            
            console.log(`Toggling ${tool} to ${enabled}`);
            try {
                const configKey = TOOL_CONFIG_MAP[tool];
                console.log(`Setting ${configKey} to ${enabled}`);
                
                // Use direct storage operation for reliability
                await chrome.storage.local.set({ [configKey]: enabled });
                console.log(`Successfully set ${configKey} to ${enabled}`);
                
                // Notify content scripts of the change
                try {
                    const tabs = await chrome.tabs.query({ url: 'http://localhost:9998/*' });
                    for (const tab of tabs) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'configChanged',
                            key: configKey,
                            value: enabled
                        }).catch(() => {}); // Ignore errors for inactive tabs
                    }
                } catch (err) {
                    console.log('No Stash tabs to notify');
                }
                
            } catch (error) {
                e.target.checked = !enabled;
                showError('Failed to save setting');
                console.error('Toggle error:', error);
            }
        });
    });
    
    // Settings checkboxes
    document.getElementById('setting-notifications')?.addEventListener('change', async (e) => {
        await updateConfig('showNotifications', e.target.checked);
    });
    
    document.getElementById('setting-autoRefresh')?.addEventListener('change', async (e) => {
        await updateConfig('autoRefresh', e.target.checked);
    });
    
    // Buttons
    document.getElementById('open-stash')?.addEventListener('click', async () => {
        try {
            // Check if Stash is already open
            const tabs = await chrome.tabs.query({ url: 'http://localhost:9998/*' });
            
            if (tabs.length > 0) {
                // Focus existing tab
                await chrome.tabs.update(tabs[0].id, { active: true });
                await chrome.windows.update(tabs[0].windowId, { focused: true });
            } else {
                // Open new tab
                await chrome.tabs.create({ url: 'http://localhost:9998/' });
            }
            
            // Close popup after action completes
            setTimeout(() => window.close(), 100);
        } catch (error) {
            console.error('Failed to open Stash:', error);
            showError('Failed to open Stash');
        }
    });
    
    document.getElementById('open-settings')?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });
    
    // Refresh status periodically
    setInterval(checkExtensionStatus, 5000);
}

// Update configuration
async function updateConfig(key, value) {
    try {
        // Use direct storage operation
        await chrome.storage.local.set({ [key]: value });
        console.log(`Successfully set ${key} to ${value}`);
        
        // Notify content scripts
        try {
            const tabs = await chrome.tabs.query({ url: 'http://localhost:9998/*' });
            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'configChanged',
                    key: key,
                    value: value
                }).catch(() => {});
            }
        } catch (err) {
            console.log('No Stash tabs to notify');
        }
    } catch (error) {
        showError('Failed to update setting');
        console.error('Config update error:', error);
    }
}

// Show error message
function showError(message) {
    // Simple error display - could be enhanced with a toast notification
    console.error(message);
    
    // Temporarily change status to show error
    const statusText = document.getElementById('status-text');
    const originalText = statusText.textContent;
    statusText.textContent = message;
    statusText.style.color = '#dc3545';
    
    setTimeout(() => {
        statusText.textContent = originalText;
        statusText.style.color = '';
    }, 3000);
}