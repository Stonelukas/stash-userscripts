// Debug Helper Script for Stash Suite Extension

const TOOLS = [
    { key: 'enableAutomateStash', name: 'AutomateStash' },
    { key: 'enableBulkOperations', name: 'Bulk Operations' },
    { key: 'enableQualityAnalyzer', name: 'Quality Analyzer' },
    { key: 'enablePerformanceMonitor', name: 'Performance Monitor' },
    { key: 'enablePerformerManager', name: 'Performer Manager' },
    { key: 'enableCollectionOrganizer', name: 'Collection Organizer' },
    { key: 'enableExportImportTools', name: 'Export/Import Tools' }
];

const OTHER_SETTINGS = [
    { key: 'showNotifications', name: 'Show Notifications' },
    { key: 'autoRefresh', name: 'Auto Refresh' },
    { key: 'autoScrapeStashDB', name: 'Auto Scrape StashDB' },
    { key: 'autoScrapeThePornDB', name: 'Auto Scrape ThePornDB' },
    { key: 'autoOrganize', name: 'Auto Organize' },
    { key: 'autoCreatePerformers', name: 'Auto Create Performers' },
    { key: 'minimizeWhenComplete', name: 'Minimize When Complete' },
    { key: 'autoApplyChanges', name: 'Auto Apply Changes' },
    { key: 'skipAlreadyScraped', name: 'Skip Already Scraped' }
];

let liveMonitorInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkExtensionStatus();
    createToolCheckboxes();
    viewStorage();
});

async function checkExtensionStatus() {
    const statusDiv = document.getElementById('extension-status');
    
    try {
        // Check if extension APIs are available
        if (!chrome.runtime || !chrome.storage) {
            statusDiv.innerHTML = '<div class="status error">❌ Extension APIs not available. Make sure this page is opened from the extension.</div>';
            return;
        }
        
        // Get extension info
        const manifest = chrome.runtime.getManifest();
        const tabs = await chrome.tabs.query({ url: 'http://localhost:9998/*' });
        
        let html = '<div class="status success">✅ Extension loaded successfully</div>';
        html += `<p><strong>Name:</strong> ${manifest.name}</p>`;
        html += `<p><strong>Version:</strong> ${manifest.version}</p>`;
        html += `<p><strong>Stash Tabs Open:</strong> ${tabs.length}</p>`;
        
        if (tabs.length > 0) {
            html += '<div class="status info">ℹ️ Stash is running - content scripts should be active</div>';
        } else {
            html += '<div class="status info">ℹ️ No Stash tabs open - open Stash to test content scripts</div>';
        }
        
        statusDiv.innerHTML = html;
    } catch (error) {
        statusDiv.innerHTML = `<div class="status error">❌ Error: ${error.message}</div>`;
    }
}

async function viewStorage() {
    const output = document.getElementById('storage-output');
    
    try {
        const data = await chrome.storage.local.get(null);
        const formatted = JSON.stringify(data, null, 2);
        output.innerHTML = `<h3>Current Storage:</h3><pre>${formatted}</pre>`;
    } catch (error) {
        output.innerHTML = `<div class="status error">❌ Error reading storage: ${error.message}</div>`;
    }
}

async function initializeDefaults() {
    const defaults = {
        // Tool enables
        enableAutomateStash: true,
        enableBulkOperations: true,
        enableQualityAnalyzer: true,
        enablePerformanceMonitor: true,
        enablePerformerManager: true,
        enableCollectionOrganizer: true,
        enableExportImportTools: true,
        
        // AutomateStash settings
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
        
        // Other settings
        autoRefresh: true
    };
    
    try {
        await chrome.storage.local.set(defaults);
        showMessage('✅ Defaults initialized successfully', 'success');
        viewStorage();
        updateCheckboxes();
    } catch (error) {
        showMessage(`❌ Error: ${error.message}`, 'error');
    }
}

async function clearStorage() {
    if (confirm('Are you sure you want to clear all storage? This cannot be undone.')) {
        try {
            await chrome.storage.local.clear();
            showMessage('✅ Storage cleared', 'success');
            viewStorage();
            updateCheckboxes();
        } catch (error) {
            showMessage(`❌ Error: ${error.message}`, 'error');
        }
    }
}

function createToolCheckboxes() {
    const container = document.getElementById('tool-checkboxes');
    let html = '';
    
    // Add tool checkboxes
    TOOLS.forEach(tool => {
        html += `
            <div class="checkbox-item">
                <input type="checkbox" id="${tool.key}" data-key="${tool.key}">
                <label for="${tool.key}">${tool.name}</label>
            </div>
        `;
    });
    
    // Add other setting checkboxes
    html += '<div style="grid-column: 1 / -1;"><h3>Other Settings:</h3></div>';
    OTHER_SETTINGS.forEach(setting => {
        html += `
            <div class="checkbox-item">
                <input type="checkbox" id="${setting.key}" data-key="${setting.key}">
                <label for="${setting.key}">${setting.name}</label>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Load current values
    updateCheckboxes();
}

async function updateCheckboxes() {
    try {
        const allKeys = [...TOOLS, ...OTHER_SETTINGS].map(item => item.key);
        const data = await chrome.storage.local.get(allKeys);
        
        allKeys.forEach(key => {
            const checkbox = document.getElementById(key);
            if (checkbox) {
                checkbox.checked = data[key] !== false;
            }
        });
    } catch (error) {
        console.error('Error updating checkboxes:', error);
    }
}

async function saveAllTools() {
    const updates = {};
    
    document.querySelectorAll('#tool-checkboxes input[type="checkbox"]').forEach(checkbox => {
        updates[checkbox.dataset.key] = checkbox.checked;
    });
    
    try {
        await chrome.storage.local.set(updates);
        showMessage('✅ All settings saved', 'success');
        viewStorage();
    } catch (error) {
        showMessage(`❌ Error: ${error.message}`, 'error');
    }
}

async function enableAllTools() {
    const checkboxes = document.querySelectorAll('#tool-checkboxes input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    await saveAllTools();
}

async function disableAllTools() {
    const checkboxes = document.querySelectorAll('#tool-checkboxes input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    await saveAllTools();
}

function toggleLiveMonitor() {
    const enabled = document.getElementById('live-monitor').checked;
    const output = document.getElementById('live-storage');
    
    if (enabled) {
        updateLiveStorage();
        liveMonitorInterval = setInterval(updateLiveStorage, 1000);
    } else {
        clearInterval(liveMonitorInterval);
        output.textContent = 'Live monitoring disabled';
    }
}

async function updateLiveStorage() {
    const output = document.getElementById('live-storage');
    try {
        const data = await chrome.storage.local.get(null);
        output.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        output.textContent = `Error: ${error.message}`;
    }
}

async function testNotification() {
    try {
        await chrome.runtime.sendMessage({
            action: 'showNotification',
            title: 'Test Notification',
            message: 'This is a test notification from the debug helper!'
        });
        showMessage('✅ Notification sent', 'success');
    } catch (error) {
        showMessage(`❌ Error: ${error.message}`, 'error');
    }
}

async function testMessagePassing() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getExtensionInfo' });
        showMessage(`✅ Message passing works! Extension: ${response.name} v${response.version}`, 'success');
    } catch (error) {
        showMessage(`❌ Message passing failed: ${error.message}`, 'error');
    }
}

async function testContentScript() {
    try {
        const tabs = await chrome.tabs.query({ url: 'http://localhost:9998/*' });
        if (tabs.length === 0) {
            showMessage('❌ No Stash tabs open. Open Stash first.', 'error');
            return;
        }
        
        const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' });
        if (response && response.status === 'alive') {
            showMessage('✅ Content script is responding!', 'success');
        } else {
            showMessage('❌ Content script did not respond correctly', 'error');
        }
    } catch (error) {
        showMessage(`❌ Content script test failed: ${error.message}`, 'error');
    }
}

async function exportStorage() {
    try {
        const data = await chrome.storage.local.get(null);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stash-suite-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showMessage('✅ Settings exported', 'success');
    } catch (error) {
        showMessage(`❌ Export failed: ${error.message}`, 'error');
    }
}

async function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            await chrome.storage.local.set(data);
            showMessage('✅ Settings imported successfully', 'success');
            viewStorage();
            updateCheckboxes();
        } catch (error) {
            showMessage(`❌ Import failed: ${error.message}`, 'error');
        }
    };
    input.click();
}

async function openStashTab() {
    try {
        await chrome.tabs.create({ url: 'http://localhost:9998/' });
    } catch (error) {
        showMessage(`❌ Error: ${error.message}`, 'error');
    }
}

async function reloadExtension() {
    if (confirm('This will reload the extension. The page will close. Continue?')) {
        chrome.runtime.reload();
    }
}

function showMessage(message, type = 'info') {
    const output = document.getElementById('test-output');
    const div = document.createElement('div');
    div.className = `status ${type}`;
    div.textContent = message;
    output.innerHTML = '';
    output.appendChild(div);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (output.contains(div)) {
            div.remove();
        }
    }, 5000);
}