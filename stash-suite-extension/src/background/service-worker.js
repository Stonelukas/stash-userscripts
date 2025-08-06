/**
 * Service Worker for Stash Suite Extension
 * Handles background tasks, message passing, and extension lifecycle
 */

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Stash Suite Extension installed:', details);
    
    // Set default configuration on first install or update
    if (details.reason === 'install' || details.reason === 'update') {
        await initializeDefaults();
        console.log('Defaults initialized');
    }
    
    // Create context menu items
    createContextMenus();
});

// Initialize default configuration
async function initializeDefaults() {
    const defaults = {
        // AutomateStash defaults
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
        
        // Tool enable/disable defaults
        enableAutomateStash: true,
        enableBulkOperations: true,
        enableQualityAnalyzer: true,
        enablePerformanceMonitor: true,
        enablePerformerManager: true,
        enableCollectionOrganizer: true,
        enableExportImportTools: true
    };
    
    await chrome.storage.local.set(defaults);
}

// Create context menu items
function createContextMenus() {
    chrome.contextMenus.create({
        id: 'stash-suite-toggle',
        title: 'Toggle Stash Suite',
        contexts: ['page'],
        documentUrlPatterns: ['http://localhost:9998/*']
    });
    
    chrome.contextMenus.create({
        id: 'stash-suite-settings',
        title: 'Stash Suite Settings',
        contexts: ['page'],
        documentUrlPatterns: ['http://localhost:9998/*']
    });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
        case 'stash-suite-toggle':
            chrome.tabs.sendMessage(tab.id, { action: 'toggleExtension' });
            break;
        case 'stash-suite-settings':
            chrome.tabs.sendMessage(tab.id, { action: 'openSettings' });
            break;
    }
});

// Message handler for communication between content scripts and popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Service worker received message:', request);
    
    switch (request.action) {
        case 'getConfig':
            handleGetConfig(request, sendResponse);
            return true; // Will respond asynchronously
            
        case 'setConfig':
            handleSetConfig(request, sendResponse);
            return true;
            
        case 'resetConfig':
            handleResetConfig(sendResponse);
            return true;
            
        case 'getActiveTools':
            handleGetActiveTools(sendResponse);
            return true;
            
        case 'showNotification':
            handleShowNotification(request);
            break;
            
        case 'openOptionsPage':
            chrome.runtime.openOptionsPage();
            sendResponse({ success: true });
            break;
            
        case 'getExtensionInfo':
            sendResponse({
                version: chrome.runtime.getManifest().version,
                name: chrome.runtime.getManifest().name
            });
            break;
    }
});

// Configuration handlers
async function handleGetConfig(request, sendResponse) {
    try {
        const result = await chrome.storage.local.get(request.key || null);
        sendResponse({ success: true, data: request.key ? result[request.key] : result });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

async function handleSetConfig(request, sendResponse) {
    try {
        await chrome.storage.local.set({ [request.key]: request.value });
        sendResponse({ success: true });
        
        // Notify all tabs about config change
        const tabs = await chrome.tabs.query({ url: 'http://localhost:9998/*' });
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'configChanged',
                key: request.key,
                value: request.value
            }).catch(() => {}); // Ignore errors for inactive tabs
        });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

async function handleResetConfig(sendResponse) {
    try {
        await chrome.storage.local.clear();
        await initializeDefaults();
        sendResponse({ success: true });
        
        // Notify all tabs about config reset
        const tabs = await chrome.tabs.query({ url: 'http://localhost:9998/*' });
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: 'configReset' }).catch(() => {});
        });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

async function handleGetActiveTools(sendResponse) {
    try {
        const config = await chrome.storage.local.get([
            'enableAutomateStash',
            'enableBulkOperations',
            'enableQualityAnalyzer',
            'enablePerformanceMonitor',
            'enablePerformerManager',
            'enableCollectionOrganizer',
            'enableExportImportTools'
        ]);
        
        sendResponse({ success: true, data: config });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}


function handleShowNotification(request) {
    const notificationOptions = {
        type: 'basic',
        iconUrl: '/icons/icon-128.png',
        title: request.title || 'Stash Suite',
        message: request.message,
        priority: request.priority || 1
    };
    
    if (request.buttons) {
        notificationOptions.buttons = request.buttons;
    }
    
    chrome.notifications.create(`stash-suite-${Date.now()}`, notificationOptions);
}

// Web navigation listener to inject content scripts if needed
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (details.url.startsWith('http://localhost:9998/')) {
        // Check if content scripts are already injected
        try {
            await chrome.tabs.sendMessage(details.tabId, { action: 'ping' });
        } catch (error) {
            // Content scripts not injected, inject them
            console.log('Injecting content scripts into tab:', details.tabId);
            
            const scripts = [
                'src/content/main-bundle.js'
            ];
            
            for (const script of scripts) {
                await chrome.scripting.executeScript({
                    target: { tabId: details.tabId },
                    files: [script]
                });
            }
            
            await chrome.scripting.insertCSS({
                target: { tabId: details.tabId },
                files: ['assets/styles.css']
            });
        }
    }
}, {
    url: [{ hostEquals: 'localhost', ports: [9998] }]
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    if (tab.url.startsWith('http://localhost:9998/')) {
        // Toggle extension on current tab
        chrome.tabs.sendMessage(tab.id, { action: 'toggleExtension' });
    } else {
        // Open Stash in new tab
        chrome.tabs.create({ url: 'http://localhost:9998/' });
    }
});

// Storage change listener for debugging
chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('Storage changes:', changes, 'in', namespace);
});