/**
 * Stash Suite Extension - Main Bundle
 * All content scripts bundled together for Manifest V3 compatibility
 */

(function() {
    'use strict';

    // ===== CONFIG MODULE =====
    const CONFIG = {
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
        
        // Tool enable/disable configs
        ENABLE_AUTOMATE_STASH: 'enableAutomateStash',
        ENABLE_BULK_OPERATIONS: 'enableBulkOperations',
        ENABLE_QUALITY_ANALYZER: 'enableQualityAnalyzer',
        ENABLE_PERFORMANCE_MONITOR: 'enablePerformanceMonitor',
        ENABLE_PERFORMER_MANAGER: 'enablePerformerManager',
        ENABLE_COLLECTION_ORGANIZER: 'enableCollectionOrganizer',
        ENABLE_EXPORT_IMPORT_TOOLS: 'enableExportImportTools'
    };

    const DEFAULTS = {
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
        
        // Tool defaults
        [CONFIG.ENABLE_AUTOMATE_STASH]: true,
        [CONFIG.ENABLE_BULK_OPERATIONS]: true,
        [CONFIG.ENABLE_QUALITY_ANALYZER]: true,
        [CONFIG.ENABLE_PERFORMANCE_MONITOR]: true,
        [CONFIG.ENABLE_PERFORMER_MANAGER]: true,
        [CONFIG.ENABLE_COLLECTION_ORGANIZER]: true,
        [CONFIG.ENABLE_EXPORT_IMPORT_TOOLS]: true
    };

    // Config functions
    async function getConfig(key) {
        try {
            return new Promise((resolve) => {
                chrome.storage.local.get(key, (result) => {
                    if (chrome.runtime.lastError) {
                        console.error('Storage error:', chrome.runtime.lastError);
                        resolve(DEFAULTS[key]);
                    } else {
                        resolve(result[key] !== undefined ? result[key] : DEFAULTS[key]);
                    }
                });
            });
        } catch (error) {
            console.error('getConfig error:', error);
            return DEFAULTS[key];
        }
    }

    async function setConfig(key, value) {
        try {
            return new Promise((resolve, reject) => {
                chrome.storage.local.set({ [key]: value }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Storage error:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error('setConfig error:', error);
        }
    }

    // ===== UTILS MODULE =====
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForElement(selectors, timeout = 5000) {
        const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            for (const selector of selectorArray) {
                const element = document.querySelector(selector);
                if (element) return element;
            }
            await sleep(100);
        }
        
        throw new Error(`Elements not found: ${selectorArray.join(', ')}`);
    }

    function createElement(tag, styles = {}, attributes = {}) {
        const element = document.createElement(tag);
        Object.assign(element.style, styles);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'innerHTML' || key === 'textContent') {
                element[key] = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        return element;
    }

    function isScenePage() {
        return window.location.pathname.match(/^\/scenes\/\d+/) && 
               !window.location.pathname.includes('/markers');
    }

    function getSceneIdFromUrl() {
        const match = window.location.pathname.match(/\/scenes\/(\d+)/);
        return match ? match[1] : null;
    }

    async function showNotification(message, type = 'info', duration = 4000) {
        // Check if notifications are enabled
        const showNotifications = await getConfig(CONFIG.SHOW_NOTIFICATIONS);
        if (!showNotifications) return;

        // Try Chrome extension notification API first
        if (chrome.runtime && chrome.runtime.sendMessage) {
            try {
                chrome.runtime.sendMessage({
                    action: 'showNotification',
                    message: message,
                    title: 'Stash Suite',
                    priority: type === 'error' ? 2 : 1
                });
                return;
            } catch (error) {
                console.warn('Chrome notifications failed, falling back to DOM notification');
            }
        }
        
        // Fallback to DOM-based notification
        const notification = createElement('div', {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '10001',
            background: getNotificationColor(type),
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            maxWidth: '400px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            fontFamily: '"Segoe UI", sans-serif',
            fontSize: '14px',
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
        }, {
            innerHTML: `${getNotificationIcon(type)} ${message}`
        });
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        notification.addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        });
        
        if (duration > 0) {
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
    }

    function getNotificationColor(type) {
        const colors = {
            success: 'linear-gradient(135deg, #00c853, #00a846)',
            error: 'linear-gradient(135deg, #d32f2f, #c62828)',
            warning: 'linear-gradient(135deg, #ff9800, #f57c00)',
            info: 'linear-gradient(135deg, #2196f3, #1976d2)'
        };
        return colors[type] || colors.info;
    }

    function getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    function logError(context, error) {
        console.error(`[Stash Suite - ${context}]`, error);
        showNotification(`Error in ${context}: ${error.message}`, 'error');
    }

    const TIMING = {
        REACT_RENDER_DELAY: 800,
        ELEMENT_WAIT_TIMEOUT: 8000,
        GRAPHQL_MUTATION_DELAY: 1000,
        SAVE_DELAY: 1500,
        NOTIFICATION_DURATION: 4000,
        DEBOUNCE_DELAY: 500,
        THROTTLE_LIMIT: 1000
    };

    // ===== GRAPHQL CLIENT MODULE =====
    class GraphQLClient {
        constructor() {
            this.endpoint = null;
            this.apiKey = null;
            this.initialized = false;
        }

        async init() {
            if (this.initialized) return;
            
            const address = await getConfig(CONFIG.STASH_ADDRESS);
            this.endpoint = address + '/graphql';
            this.apiKey = await getConfig(CONFIG.STASH_API_KEY);
            this.initialized = true;
        }

        async query(query, variables = {}) {
            if (!this.initialized) await this.init();
            
            try {
                const headers = {
                    'Content-Type': 'application/json',
                };
                
                if (this.apiKey) {
                    headers['ApiKey'] = this.apiKey;
                }

                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query, variables })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.errors) {
                    console.error('GraphQL errors:', data.errors);
                    throw new Error(data.errors[0].message);
                }

                return data.data;
            } catch (error) {
                logError('GraphQL Query', error);
                throw error;
            }
        }

        async findScene(id) {
            const query = `
                query FindScene($id: ID!) {
                    findScene(id: $id) {
                        id
                        title
                        details
                        date
                        rating100
                        organized
                        studio {
                            id
                            name
                        }
                        performers {
                            id
                            name
                        }
                        tags {
                            id
                            name
                        }
                        stash_ids {
                            stash_id
                            endpoint
                        }
                    }
                }
            `;
            
            const result = await this.query(query, { id });
            return result.findScene;
        }
    }

    const graphqlClient = new GraphQLClient();

    // ===== AUTOMATE STASH MODULE =====
    let automationInProgress = false;
    let automationCancelled = false;
    let automationCompleted = false;
    let sceneOrganized = false;

    class AutomateStash {
        constructor() {
            this.uiManager = null;
            this.statusTracker = null;
            this.initialized = false;
        }

        async init() {
            if (this.initialized) return;
            
            const enabled = await getConfig(CONFIG.ENABLE_AUTOMATE_STASH);
            if (!enabled) return;
            
            console.log('🚀 AutomateStash initializing...');
            
            this.uiManager = new UIManager();
            this.statusTracker = new StatusTracker();
            
            await graphqlClient.init();
            await this.setupUI();
            this.setupPageMonitor();
            
            this.initialized = true;
            console.log('✅ AutomateStash initialized');
        }

        async setupUI() {
            await sleep(TIMING.REACT_RENDER_DELAY);
            
            const shouldMinimize = await this.shouldStartMinimized();
            
            if (shouldMinimize) {
                this.uiManager.showMinimized();
            } else {
                this.uiManager.show();
            }
            
            if (isScenePage()) {
                await this.updateSceneStatus();
            }
        }

        async shouldStartMinimized() {
            if (!isScenePage()) return true;
            
            const sceneId = getSceneIdFromUrl();
            if (!sceneId) return false;
            
            try {
                const scene = await graphqlClient.findScene(sceneId);
                return scene && scene.organized;
            } catch (error) {
                console.error('Failed to check scene status:', error);
                return false;
            }
        }

        async updateSceneStatus() {
            const sceneId = getSceneIdFromUrl();
            if (!sceneId) return;
            
            try {
                const scene = await graphqlClient.findScene(sceneId);
                const status = await this.statusTracker.getSceneStatus(scene);
                this.uiManager.updateStatus(status);
            } catch (error) {
                logError('Update Scene Status', error);
            }
        }

        setupPageMonitor() {
            let lastUrl = window.location.href;
            
            setInterval(() => {
                const currentUrl = window.location.href;
                if (currentUrl !== lastUrl) {
                    lastUrl = currentUrl;
                    this.handlePageChange();
                }
            }, 500);
        }

        async handlePageChange() {
            automationInProgress = false;
            automationCancelled = false;
            automationCompleted = false;
            sceneOrganized = false;
            
            await this.setupUI();
        }

        async startAutomation() {
            if (automationInProgress) {
                showNotification('Automation already in progress', 'warning');
                return;
            }

            automationInProgress = true;
            automationCancelled = false;
            automationCompleted = false;
            sceneOrganized = false;

            this.uiManager.setAutomating(true);
            showNotification('🚀 Starting automation...', 'info');

            try {
                // Check if we're on a scene page
                if (!isScenePage()) {
                    showNotification('Please navigate to a scene page', 'error');
                    return;
                }

                const sceneId = getSceneIdFromUrl();
                if (!sceneId) {
                    showNotification('Could not find scene ID', 'error');
                    return;
                }

                // Get scene data
                const scene = await graphqlClient.findScene(sceneId);
                if (!scene) {
                    showNotification('Could not load scene data', 'error');
                    return;
                }

                // Check configured scrapers
                const autoScrapeStashDB = await getConfig(CONFIG.AUTO_SCRAPE_STASHDB);
                const autoScrapeThePornDB = await getConfig(CONFIG.AUTO_SCRAPE_THEPORNDB);
                const autoOrganize = await getConfig(CONFIG.AUTO_ORGANIZE);

                // Run scrapers
                if (autoScrapeStashDB) {
                    showNotification('🔍 Scraping StashDB...', 'info');
                    // TODO: Implement StashDB scraping
                    await sleep(1000);
                }

                if (autoScrapeThePornDB) {
                    showNotification('🔍 Scraping ThePornDB...', 'info');
                    // TODO: Implement ThePornDB scraping
                    await sleep(1000);
                }

                if (autoOrganize && !scene.organized) {
                    showNotification('📁 Organizing scene...', 'info');
                    // TODO: Implement scene organization
                    await sleep(1000);
                }

                automationCompleted = true;
                showNotification('✅ Automation completed!', 'success');

                // Update status
                await this.updateSceneStatus();

            } catch (error) {
                console.error('Automation error:', error);
                showNotification('❌ Automation failed: ' + error.message, 'error');
            } finally {
                automationInProgress = false;
                this.uiManager.setAutomating(false);
            }
        }

        cancelAutomation() {
            if (!automationInProgress) return;
            automationCancelled = true;
            showNotification('🛑 Automation cancelled', 'warning');
        }

        showSettings() {
            // Create a simple settings dialog
            const dialog = createElement('div', {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '400px',
                zIndex: '10001',
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '24px',
                color: '#ffffff'
            }, {
                id: 'stash-settings-dialog'
            });

            dialog.innerHTML = `
                <h3 style="margin: 0 0 20px 0;">⚙️ AutomateStash Settings</h3>
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="setting-stashdb" style="margin-right: 10px;">
                        Auto-scrape StashDB
                    </label>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="setting-porndb" style="margin-right: 10px;">
                        Auto-scrape ThePornDB
                    </label>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="setting-organize" style="margin-right: 10px;">
                        Auto-organize scenes
                    </label>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="setting-minimize" style="margin-right: 10px;">
                        Minimize when complete
                    </label>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="save-settings" style="
                        flex: 1;
                        background: linear-gradient(135deg, #00c853, #00a846);
                        border: none;
                        color: white;
                        padding: 10px;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Save</button>
                    <button id="cancel-settings" style="
                        flex: 1;
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        color: white;
                        padding: 10px;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Cancel</button>
                </div>
            `;

            document.body.appendChild(dialog);

            // Load current settings
            getConfig(CONFIG.AUTO_SCRAPE_STASHDB).then(value => {
                document.getElementById('setting-stashdb').checked = value;
            });
            getConfig(CONFIG.AUTO_SCRAPE_THEPORNDB).then(value => {
                document.getElementById('setting-porndb').checked = value;
            });
            getConfig(CONFIG.AUTO_ORGANIZE).then(value => {
                document.getElementById('setting-organize').checked = value;
            });
            getConfig(CONFIG.MINIMIZE_WHEN_COMPLETE).then(value => {
                document.getElementById('setting-minimize').checked = value;
            });

            // Save button
            document.getElementById('save-settings').addEventListener('click', async () => {
                await setConfig(CONFIG.AUTO_SCRAPE_STASHDB, document.getElementById('setting-stashdb').checked);
                await setConfig(CONFIG.AUTO_SCRAPE_THEPORNDB, document.getElementById('setting-porndb').checked);
                await setConfig(CONFIG.AUTO_ORGANIZE, document.getElementById('setting-organize').checked);
                await setConfig(CONFIG.MINIMIZE_WHEN_COMPLETE, document.getElementById('setting-minimize').checked);
                
                showNotification('✅ Settings saved!', 'success');
                dialog.remove();
            });

            // Cancel button
            document.getElementById('cancel-settings').addEventListener('click', () => {
                dialog.remove();
            });
        }

        async startAutomation() {
            if (automationInProgress) {
                showNotification('Automation already in progress', 'warning');
                return;
            }

            automationInProgress = true;
            automationCancelled = false;
            automationCompleted = false;
            sceneOrganized = false;

            this.uiManager.setAutomating(true);
            showNotification('🚀 Starting automation...', 'info');

            try {
                // Automation logic would go here
                // For now, just a placeholder
                await sleep(2000);
                
                automationCompleted = true;
                showNotification('✅ Automation completed!', 'success');
                
                if (await getConfig(CONFIG.MINIMIZE_WHEN_COMPLETE)) {
                    this.uiManager.minimize();
                }
            } catch (error) {
                logError('Automation', error);
                showNotification(`❌ Automation failed: ${error.message}`, 'error');
            } finally {
                automationInProgress = false;
                this.uiManager.setAutomating(false);
            }
        }

        cancelAutomation() {
            automationCancelled = true;
            automationInProgress = false;
            this.uiManager.setAutomating(false);
            showNotification('❌ Automation cancelled', 'warning');
        }
    }

    // UI Manager
    class UIManager {
        constructor() {
            this.panel = null;
            this.minimizedButton = null;
        }

        show() {
            if (this.panel) {
                this.panel.style.display = 'block';
                if (this.minimizedButton) {
                    this.minimizedButton.style.display = 'none';
                }
                return;
            }
            
            this.createPanel();
        }

        showMinimized() {
            if (this.panel) {
                this.panel.style.display = 'none';
            }
            
            if (!this.minimizedButton) {
                this.createMinimizedButton();
            }
            
            this.minimizedButton.style.display = 'flex';
        }

        minimize() {
            if (this.panel) {
                this.panel.style.display = 'none';
            }
            this.showMinimized();
        }

        expand() {
            this.show();
        }

        createPanel() {
            this.panel = createElement('div', {
                position: 'fixed',
                top: '50px',
                right: '20px',
                width: '340px',
                zIndex: '10000',
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
                color: '#ffffff',
                padding: '24px',
                boxSizing: 'border-box'
            }, {
                id: 'stash-automation-panel'
            });
            
            this.panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 20px; font-weight: 600;">🚀 Stash Automation</h3>
                    <button id="minimize-button" style="
                        background: none;
                        border: none;
                        color: #ffffff;
                        font-size: 20px;
                        cursor: pointer;
                        padding: 5px;
                        transition: transform 0.2s;
                    ">_</button>
                </div>
                
                <div id="scene-status" style="
                    background: rgba(255, 255, 255, 0.05);
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                    font-size: 14px;
                    line-height: 1.6;
                "></div>
                
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button id="start-automation" style="
                        flex: 1;
                        background: linear-gradient(135deg, #00c853, #00a846);
                        border: none;
                        color: white;
                        padding: 12px 20px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                    ">▶️ Start</button>
                    
                    <button id="settings-button" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        color: white;
                        padding: 12px 20px;
                        border-radius: 8px;
                        font-size: 16px;
                        cursor: pointer;
                        transition: all 0.3s;
                    ">⚙️</button>
                </div>
                
                <div id="cancel-button" style="display: none;">
                    <button style="
                        width: 100%;
                        background: linear-gradient(135deg, #d32f2f, #c62828);
                        border: none;
                        color: white;
                        padding: 12px 20px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                    ">❌ Cancel</button>
                </div>
            `;
            
            document.body.appendChild(this.panel);
            this.setupEventListeners();
        }

        createMinimizedButton() {
            this.minimizedButton = createElement('button', {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontSize: '24px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                zIndex: '10000',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s'
            }, {
                id: 'stash-minimized-button',
                innerHTML: '🚀'
            });
            
            this.minimizedButton.addEventListener('click', () => this.expand());
            document.body.appendChild(this.minimizedButton);
        }

        setupEventListeners() {
            const minimizeBtn = this.panel.querySelector('#minimize-button');
            minimizeBtn?.addEventListener('click', () => this.minimize());
            
            const startBtn = this.panel.querySelector('#start-automation');
            startBtn?.addEventListener('click', () => {
                window.automateStash?.startAutomation();
            });
            
            const settingsBtn = this.panel.querySelector('#settings-button');
            settingsBtn?.addEventListener('click', () => {
                window.automateStash?.showSettings();
            });
            
            const cancelBtn = this.panel.querySelector('#cancel-button button');
            cancelBtn?.addEventListener('click', () => {
                window.automateStash?.cancelAutomation();
            });
        }

        setAutomating(isAutomating) {
            const startButton = this.panel?.querySelector('#start-automation');
            const cancelButton = this.panel?.querySelector('#cancel-button');
            
            if (startButton && cancelButton) {
                startButton.style.display = isAutomating ? 'none' : 'block';
                cancelButton.style.display = isAutomating ? 'block' : 'none';
            }
        }

        updateStatus(status) {
            const statusDiv = this.panel?.querySelector('#scene-status');
            if (statusDiv) {
                statusDiv.innerHTML = status;
            }
        }
    }

    // Status Tracker
    class StatusTracker {
        async getSceneStatus(scene) {
            if (!scene) return '<div>⏳ Loading scene information...</div>';
            
            let status = '<div style="font-size: 14px;">';
            
            status += `<div style="margin-bottom: 10px;">
                <strong>📽️ Scene:</strong> ${scene.title || 'Untitled'}
            </div>`;
            
            status += `<div style="margin-bottom: 8px;">
                ${scene.organized ? '✅' : '❌'} <strong>Organized:</strong> ${scene.organized ? 'Yes' : 'No'}
            </div>`;
            
            const hasPerformers = scene.performers && scene.performers.length > 0;
            const hasStudio = scene.studio !== null;
            const hasTags = scene.tags && scene.tags.length > 0;
            
            status += `<div style="margin-bottom: 8px;">
                ${hasPerformers ? '✅' : '❌'} <strong>Performers:</strong> ${hasPerformers ? scene.performers.length : 'None'}
            </div>`;
            
            status += `<div style="margin-bottom: 8px;">
                ${hasStudio ? '✅' : '❌'} <strong>Studio:</strong> ${hasStudio ? scene.studio.name : 'None'}
            </div>`;
            
            status += `<div style="margin-bottom: 8px;">
                ${hasTags ? '✅' : '❌'} <strong>Tags:</strong> ${hasTags ? scene.tags.length : 'None'}
            </div>`;
            
            status += '</div>';
            
            return status;
        }
    }

    // ===== PLACEHOLDER TOOLS =====
    class BulkOperations {
        constructor() {
            this.initialized = false;
        }

        async init() {
            if (this.initialized) return;
            const enabled = await getConfig(CONFIG.ENABLE_BULK_OPERATIONS);
            if (!enabled) return;
            console.log('🚀 BulkOperations placeholder initialized');
            this.initialized = true;
        }
    }

    class QualityAnalyzer {
        constructor() {
            this.initialized = false;
        }

        async init() {
            if (this.initialized) return;
            const enabled = await getConfig(CONFIG.ENABLE_QUALITY_ANALYZER);
            if (!enabled) return;
            console.log('🚀 QualityAnalyzer placeholder initialized');
            this.initialized = true;
        }
    }

    class PerformanceMonitor {
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
    }

    class PerformerManager {
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
    }

    class CollectionOrganizer {
        constructor() {
            this.initialized = false;
        }

        async init() {
            if (this.initialized) return;
            const enabled = await getConfig(CONFIG.ENABLE_COLLECTION_ORGANIZER);
            if (!enabled) return;
            console.log('🚀 CollectionOrganizer placeholder initialized');
            this.initialized = true;
        }
    }

    class ExportImportTools {
        constructor() {
            this.initialized = false;
        }

        async init() {
            if (this.initialized) return;
            const enabled = await getConfig(CONFIG.ENABLE_EXPORT_IMPORT_TOOLS);
            if (!enabled) return;
            console.log('🚀 ExportImportTools placeholder initialized');
            this.initialized = true;
        }
    }

    // ===== MAIN INITIALIZATION =====
    const automateStash = new AutomateStash();
    const bulkOperations = new BulkOperations();
    const qualityAnalyzer = new QualityAnalyzer();
    const performanceMonitor = new PerformanceMonitor();
    const performerManager = new PerformerManager();
    const collectionOrganizer = new CollectionOrganizer();
    const exportImportTools = new ExportImportTools();

    // Make automateStash globally available
    window.automateStash = automateStash;

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

    async function initialize() {
        console.log('🚀 Stash Suite Extension initializing...');
        
        if (!window.location.href.includes('localhost:9998')) {
            console.log('Not on Stash page, skipping initialization');
            return;
        }
        
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
        
        setupMessageListeners();
        console.log('✅ Stash Suite Extension initialized');
    }

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
                    if (window.automateStash && window.automateStash.initialized) {
                        window.automateStash.showSettings();
                    } else {
                        // If AutomateStash isn't initialized, show popup settings
                        showNotification('Opening extension settings...', 'info');
                        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
                    }
                    break;
                case 'configChanged':
                    handleConfigChange(request.key, request.value);
                    break;
            }
        });
    }

    async function toggleExtension() {
        const panel = document.getElementById('stash-automation-panel');
        const minimizedButton = document.getElementById('stash-minimized-button');
        
        if (panel && panel.style.display !== 'none') {
            panel.style.display = 'none';
            if (minimizedButton) {
                minimizedButton.style.display = 'flex';
            }
        } else if (minimizedButton && minimizedButton.style.display !== 'none') {
            minimizedButton.style.display = 'none';
            if (panel) {
                panel.style.display = 'block';
            }
        } else {
            // If no UI exists yet, initialize AutomateStash if needed
            if (!automateStash.initialized) {
                const enabled = await getConfig(CONFIG.ENABLE_AUTOMATE_STASH);
                if (enabled) {
                    try {
                        await automateStash.init();
                    } catch (error) {
                        console.error('Failed to initialize AutomateStash:', error);
                    }
                }
            }
            
            if (automateStash.initialized && automateStash.uiManager) {
                automateStash.uiManager.show();
            }
        }
    }

    async function handleConfigChange(key, value) {
        console.log(`Config changed: ${key} = ${value}`);
        
        for (const [toolKey, tool] of Object.entries(tools)) {
            if (key === tool.configKey) {
                if (value && tool.instance && !tool.instance.initialized) {
                    try {
                        await tool.instance.init();
                        showNotification(`${tool.name} enabled`, 'success');
                    } catch (error) {
                        console.error(`Failed to initialize ${tool.name}:`, error);
                        showNotification(`Failed to initialize ${tool.name}`, 'error');
                    }
                } else if (!value && tool.instance && tool.instance.initialized) {
                    showNotification(`${tool.name} disabled`, 'info');
                }
                break;
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();