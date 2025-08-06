// Test page script for Stash Suite Extension

function showOutput(elementId, content, type = 'info') {
    const output = document.getElementById(elementId);
    output.innerHTML = `<div class="status ${type}"><pre>${JSON.stringify(content, null, 2)}</pre></div>`;
}

// Storage Tests
async function testGetStorage() {
    try {
        const result = await chrome.storage.local.get(null);
        showOutput('storage-output', result, 'success');
    } catch (error) {
        showOutput('storage-output', error.message, 'error');
    }
}

async function testSetStorage() {
    try {
        await chrome.storage.local.set({ 
            testValue: 'Hello from test page!',
            enableAutomateStash: true,
            enableBulkOperations: false 
        });
        showOutput('storage-output', 'Values set successfully', 'success');
    } catch (error) {
        showOutput('storage-output', error.message, 'error');
    }
}

async function testClearStorage() {
    try {
        await chrome.storage.local.clear();
        showOutput('storage-output', 'Storage cleared', 'success');
    } catch (error) {
        showOutput('storage-output', error.message, 'error');
    }
}

async function testInitDefaults() {
    try {
        const defaults = {
            autoScrapeStashDB: true,
            autoScrapeThePornDB: true,
            autoOrganize: true,
            autoCreatePerformers: true,
            showNotifications: true,
            minimizeWhenComplete: true,
            autoApplyChanges: false,
            skipAlreadyScraped: true,
            enableCrossSceneIntelligence: true,
            stashAddress: 'http://localhost:9998',
            stashApiKey: '',
            enableAutomateStash: true,
            enableBulkOperations: true,
            enableQualityAnalyzer: true,
            enablePerformanceMonitor: true,
            enablePerformerManager: true,
            enableCollectionOrganizer: true,
            enableExportImportTools: true
        };
        await chrome.storage.local.set(defaults);
        showOutput('storage-output', 'Defaults initialized', 'success');
    } catch (error) {
        showOutput('storage-output', error.message, 'error');
    }
}

// Message Tests
async function testGetConfig() {
    try {
        const response = await chrome.runtime.sendMessage({ 
            action: 'getConfig', 
            key: 'enableAutomateStash' 
        });
        showOutput('message-output', response, 'success');
    } catch (error) {
        showOutput('message-output', error.message, 'error');
    }
}

async function testSetConfig() {
    try {
        const response = await chrome.runtime.sendMessage({ 
            action: 'setConfig', 
            key: 'enableBulkOperations',
            value: true
        });
        showOutput('message-output', response, 'success');
    } catch (error) {
        showOutput('message-output', error.message, 'error');
    }
}

async function testGetActiveTools() {
    try {
        const response = await chrome.runtime.sendMessage({ 
            action: 'getActiveTools' 
        });
        showOutput('message-output', response, 'success');
    } catch (error) {
        showOutput('message-output', error.message, 'error');
    }
}

// Tab Tests
async function testGetTabs() {
    try {
        const tabs = await chrome.tabs.query({ url: 'http://localhost:9998/*' });
        showOutput('tab-output', tabs, 'success');
    } catch (error) {
        showOutput('tab-output', error.message, 'error');
    }
}

async function testOpenStash() {
    try {
        const tab = await chrome.tabs.create({ url: 'http://localhost:9998/' });
        showOutput('tab-output', tab, 'success');
    } catch (error) {
        showOutput('tab-output', error.message, 'error');
    }
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Storage buttons
    document.getElementById('btn-get-storage').addEventListener('click', testGetStorage);
    document.getElementById('btn-set-storage').addEventListener('click', testSetStorage);
    document.getElementById('btn-clear-storage').addEventListener('click', testClearStorage);
    document.getElementById('btn-init-defaults').addEventListener('click', testInitDefaults);
    
    // Message buttons
    document.getElementById('btn-get-config').addEventListener('click', testGetConfig);
    document.getElementById('btn-set-config').addEventListener('click', testSetConfig);
    document.getElementById('btn-get-active-tools').addEventListener('click', testGetActiveTools);
    
    // Tab buttons
    document.getElementById('btn-get-tabs').addEventListener('click', testGetTabs);
    document.getElementById('btn-open-stash').addEventListener('click', testOpenStash);
});