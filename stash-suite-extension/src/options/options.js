// Options page script

// All available settings
const SETTINGS = [
    // Tools
    'enableAutomateStash',
    'enableBulkOperations',
    'enableQualityAnalyzer',
    'enablePerformanceMonitor',
    'enablePerformerManager',
    'enableCollectionOrganizer',
    'enableExportImportTools',
    
    // AutomateStash settings
    'autoScrapeStashDB',
    'autoScrapeThePornDB',
    'autoOrganize',
    'autoCreatePerformers',
    'minimizeWhenComplete',
    'autoApplyChanges',
    'skipAlreadyScraped',
    
    // General settings
    'showNotifications',
    'autoRefresh',
    
    // Connection settings
    'stashAddress',
    'stashApiKey'
];

// Default values
const DEFAULTS = {
    enableAutomateStash: true,
    enableBulkOperations: true,
    enableQualityAnalyzer: true,
    enablePerformanceMonitor: true,
    enablePerformerManager: true,
    enableCollectionOrganizer: true,
    enableExportImportTools: true,
    autoScrapeStashDB: true,
    autoScrapeThePornDB: true,
    autoOrganize: true,
    autoCreatePerformers: true,
    showNotifications: true,
    minimizeWhenComplete: true,
    autoApplyChanges: false,
    skipAlreadyScraped: true,
    autoRefresh: true,
    stashAddress: 'http://localhost:9998',
    stashApiKey: ''
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Set version
    const manifest = chrome.runtime.getManifest();
    document.getElementById('version').textContent = manifest.version;
    
    // Load current settings
    await loadSettings();
    
    // Setup event listeners
    document.getElementById('save').addEventListener('click', saveSettings);
    document.getElementById('reset').addEventListener('click', resetSettings);
    document.getElementById('export').addEventListener('click', exportSettings);
    document.getElementById('import').addEventListener('click', importSettings);
    
    // Add change listeners to all inputs for real-time saving
    SETTINGS.forEach(setting => {
        const element = document.getElementById(setting);
        if (element) {
            element.addEventListener('change', () => {
                // Auto-save on change
                saveSettings(true);
            });
        }
    });
});

// Load settings from storage
async function loadSettings() {
    try {
        const data = await chrome.storage.local.get(SETTINGS);
        
        SETTINGS.forEach(setting => {
            const element = document.getElementById(setting);
            if (!element) return;
            
            const value = data[setting] !== undefined ? data[setting] : DEFAULTS[setting];
            
            if (element.type === 'checkbox') {
                element.checked = value;
            } else {
                element.value = value;
            }
        });
    } catch (error) {
        console.error('Failed to load settings:', error);
        showStatus('Failed to load settings', 'error');
    }
}

// Save settings to storage
async function saveSettings(silent = false) {
    try {
        const settings = {};
        
        SETTINGS.forEach(setting => {
            const element = document.getElementById(setting);
            if (!element) return;
            
            if (element.type === 'checkbox') {
                settings[setting] = element.checked;
            } else {
                settings[setting] = element.value;
            }
        });
        
        await chrome.storage.local.set(settings);
        
        if (!silent) {
            showStatus('Settings saved successfully!', 'success');
        }
        
        // Notify all tabs about settings change
        const tabs = await chrome.tabs.query({ url: 'http://localhost:9998/*' });
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'settingsUpdated',
                settings: settings
            }).catch(() => {}); // Ignore errors for inactive tabs
        });
        
    } catch (error) {
        console.error('Failed to save settings:', error);
        showStatus('Failed to save settings', 'error');
    }
}

// Reset to default settings
async function resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
        return;
    }
    
    try {
        await chrome.storage.local.set(DEFAULTS);
        await loadSettings();
        showStatus('Settings reset to defaults', 'success');
    } catch (error) {
        console.error('Failed to reset settings:', error);
        showStatus('Failed to reset settings', 'error');
    }
}

// Export settings to file
async function exportSettings() {
    try {
        const data = await chrome.storage.local.get(null);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stash-suite-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showStatus('Settings exported successfully', 'success');
    } catch (error) {
        console.error('Failed to export settings:', error);
        showStatus('Failed to export settings', 'error');
    }
}

// Import settings from file
function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Validate that it contains expected settings
            const hasValidSettings = SETTINGS.some(setting => setting in data);
            if (!hasValidSettings) {
                throw new Error('Invalid settings file');
            }
            
            await chrome.storage.local.set(data);
            await loadSettings();
            showStatus('Settings imported successfully', 'success');
        } catch (error) {
            console.error('Failed to import settings:', error);
            showStatus('Failed to import settings: ' + error.message, 'error');
        }
    };
    input.click();
}

// Show status message
function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        status.className = 'status';
    }, 3000);
}