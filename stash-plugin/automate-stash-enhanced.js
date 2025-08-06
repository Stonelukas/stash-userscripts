/**
 * AutomateStash Plugin for Stash - Enhanced Version with GraphQL
 * Version: 4.4.0
 * Description: Automated metadata scraping and scene organization for Stash
 * 
 * This enhanced version includes GraphQL API integration and the original UI
 */

(function () {
    'use strict';

    console.log('🚀 AutomateStash Plugin v4.4.0 - Enhanced with GraphQL');

    // ===== STORAGE HELPER FUNCTIONS =====
    const storage = {
        getValue: function(key, defaultValue) {
            try {
                const value = localStorage.getItem(`automateStash_${key}`);
                if (value === null) return defaultValue;
                return JSON.parse(value);
            } catch (e) {
                return defaultValue;
            }
        },
        setValue: function(key, value) {
            try {
                localStorage.setItem(`automateStash_${key}`, JSON.stringify(value));
            } catch (e) {
                console.error('Failed to save to localStorage:', e);
            }
        }
    };

    // ===== CONFIGURATION SYSTEM =====
    const CONFIG = {
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
        STASH_API_KEY: 'stashApiKey'
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
        [CONFIG.STASH_API_KEY]: ''
    };

    function getConfig(key) {
        const value = storage.getValue(key);
        return value !== undefined ? value : DEFAULTS[key];
    }

    function setConfig(key, value) {
        storage.setValue(key, value);
    }

    // ===== GLOBAL STATE =====
    let automationInProgress = false;
    let automationCancelled = false;
    let uiManager = null;
    let graphqlClient = null;
    let statusTracker = null;

    // ===== TIMING CONSTANTS =====
    const STASH_CONFIG = {
        REACT_RENDER_DELAY: 800,
        ELEMENT_WAIT_TIMEOUT: 8000,
        GRAPHQL_MUTATION_DELAY: 1000,
        SAVE_DELAY: 1500,
        ORGANIZATION_DELAY: 2000,
        SCRAPER_DROPDOWN_DELAY: 500,
        SCRAPER_SEARCH_DELAY: 3000,
        SCRAPER_APPLY_DELAY: 1500,
        CREATE_ENTITIES_DELAY: 1000
    };

    // ===== UTILITY FUNCTIONS =====
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForElement(selector, timeout = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) return element;
            await sleep(100);
        }
        return null;
    }

    // ===== GRAPHQL CLIENT =====
    class GraphQLClient {
        constructor() {
            this.baseUrl = getConfig(CONFIG.STASH_ADDRESS);
            this.apiKey = getConfig(CONFIG.STASH_API_KEY);
            this.endpoint = `${this.baseUrl}/graphql`;
        }

        async query(query, variables = {}) {
            try {
                const headers = {
                    'Content-Type': 'application/json'
                };

                // Add API key if configured
                if (this.apiKey && this.apiKey.length > 0) {
                    headers['ApiKey'] = this.apiKey;
                }

                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ query, variables })
                });

                if (!response.ok) {
                    throw new Error(`GraphQL request failed: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.errors) {
                    console.error('❌ GraphQL errors:', result.errors);
                    throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
                }

                return result.data;
            } catch (error) {
                console.error('❌ GraphQL query failed:', error);
                throw error;
            }
        }

        getCurrentSceneId() {
            const urlMatch = window.location.href.match(/\/scenes\/(\d+)/);
            return urlMatch ? urlMatch[1] : null;
        }

        async getSceneDetails(sceneId) {
            const query = `
                query GetScene($id: ID!) {
                    findScene(id: $id) {
                        id
                        title
                        details
                        organized
                        stash_ids {
                            endpoint
                            stash_id
                        }
                        performers {
                            id
                            name
                        }
                        studio {
                            id
                            name
                        }
                        tags {
                            id
                            name
                        }
                        updated_at
                    }
                }
            `;
            const result = await this.query(query, { id: sceneId });
            return result.findScene;
        }
    }

    // ===== STATUS TRACKER =====
    class StatusTracker {
        constructor() {
            this.currentStatus = {
                sceneId: null,
                sceneName: '',
                stashdb: { scraped: false, confidence: 0 },
                theporndb: { scraped: false, confidence: 0 },
                organized: false,
                lastUpdate: null
            };
            this.statusUpdateCallbacks = [];
        }

        async detectCurrentStatus() {
            console.log('📊 Detecting current scene status...');
            
            try {
                this.currentStatus.sceneId = this.extractSceneId();
                
                if (getConfig(CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE) && graphqlClient) {
                    // Try GraphQL first
                    try {
                        const sceneDetails = await graphqlClient.getSceneDetails(this.currentStatus.sceneId);
                        if (sceneDetails) {
                            this.currentStatus.sceneName = sceneDetails.title || 'Unknown Scene';
                            this.currentStatus.organized = sceneDetails.organized || false;
                            
                            // Check for StashDB ID
                            const stashdbId = sceneDetails.stash_ids?.find(id => 
                                id.endpoint.toLowerCase().includes('stashdb')
                            );
                            this.currentStatus.stashdb.scraped = !!stashdbId;
                            this.currentStatus.stashdb.confidence = stashdbId ? 100 : 0;
                        }
                    } catch (error) {
                        console.warn('GraphQL status detection failed, falling back to DOM:', error);
                    }
                }
                
                // DOM-based detection as fallback
                this.detectFromDOM();
                
                this.currentStatus.lastUpdate = new Date();
                this.notifyStatusUpdate();
                
                return this.currentStatus;
            } catch (error) {
                console.error('❌ Error detecting scene status:', error);
                return this.currentStatus;
            }
        }

        detectFromDOM() {
            // Check scene name from title input
            const titleInput = document.querySelector('input[name="title"], input[placeholder*="Title"]');
            if (titleInput && titleInput.value) {
                this.currentStatus.sceneName = titleInput.value;
            }

            // Check organized button
            const organizedButton = document.querySelector('button[title="Organized"]');
            if (organizedButton) {
                this.currentStatus.organized = organizedButton.classList.contains('organized') || 
                                               organizedButton.getAttribute('aria-pressed') === 'true';
            }

            // Check for scraper data in inputs
            const inputs = document.querySelectorAll('input[type="text"], textarea');
            for (const input of inputs) {
                const value = input.value || '';
                if (value.toLowerCase().includes('stashdb')) {
                    this.currentStatus.stashdb.scraped = true;
                    this.currentStatus.stashdb.confidence = 80;
                }
                if (value.toLowerCase().includes('theporndb') || value.toLowerCase().includes('metadataapi')) {
                    this.currentStatus.theporndb.scraped = true;
                    this.currentStatus.theporndb.confidence = 80;
                }
            }
        }

        extractSceneId() {
            const urlMatch = window.location.href.match(/\/scenes\/(\d+)/);
            return urlMatch ? urlMatch[1] : null;
        }

        getStatusSummary() {
            return {
                scene: {
                    id: this.currentStatus.sceneId,
                    name: this.currentStatus.sceneName || 'Unknown Scene'
                },
                sources: {
                    stashdb: {
                        status: this.currentStatus.stashdb.scraped ? 'Scraped' : 'Not scraped',
                        confidence: this.currentStatus.stashdb.confidence,
                        icon: this.currentStatus.stashdb.scraped ? '✅' : '❌'
                    },
                    theporndb: {
                        status: this.currentStatus.theporndb.scraped ? 'Scraped' : 'Not scraped',
                        confidence: this.currentStatus.theporndb.confidence,
                        icon: this.currentStatus.theporndb.scraped ? '✅' : '❌'
                    }
                },
                organized: {
                    status: this.currentStatus.organized ? 'Organized' : 'Not organized',
                    icon: this.currentStatus.organized ? '✅' : '⚠️'
                }
            };
        }

        getCompletionStatus() {
            let completedItems = 0;
            const totalItems = 3;
            
            if (this.currentStatus.stashdb.scraped) completedItems++;
            if (this.currentStatus.theporndb.scraped) completedItems++;
            if (this.currentStatus.organized) completedItems++;
            
            const percentage = Math.round((completedItems / totalItems) * 100);
            
            return {
                percentage,
                completedItems,
                totalItems,
                status: percentage === 100 ? 'Complete' : `${completedItems}/${totalItems} completed`
            };
        }

        onStatusUpdate(callback) {
            this.statusUpdateCallbacks.push(callback);
        }

        notifyStatusUpdate() {
            const summary = this.getStatusSummary();
            this.statusUpdateCallbacks.forEach(callback => {
                try {
                    callback(summary);
                } catch (error) {
                    console.error('Error in status update callback:', error);
                }
            });
        }

        updateStatus(source, data) {
            switch (source) {
                case 'stashdb':
                    this.currentStatus.stashdb = { ...this.currentStatus.stashdb, ...data };
                    break;
                case 'theporndb':
                    this.currentStatus.theporndb = { ...this.currentStatus.theporndb, ...data };
                    break;
                case 'organized':
                    this.currentStatus.organized = data.organized || false;
                    break;
            }
            this.currentStatus.lastUpdate = new Date();
            this.notifyStatusUpdate();
        }
    }

    // ===== NOTIFICATION SYSTEM =====
    class NotificationManager {
        show(message, type = 'info', duration = 4000) {
            if (!getConfig(CONFIG.SHOW_NOTIFICATIONS)) return;

            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10001;
                background: ${this.getColor(type)};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                max-width: 400px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                cursor: pointer;
            `;

            notification.innerHTML = `${this.getIcon(type)} ${message}`;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            }, 100);

            if (duration > 0) {
                setTimeout(() => {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => notification.remove(), 300);
                }, duration);
            }

            notification.addEventListener('click', () => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            });
        }

        getColor(type) {
            const colors = {
                success: '#28a745',
                error: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8'
            };
            return colors[type] || colors.info;
        }

        getIcon(type) {
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };
            return icons[type] || icons.info;
        }
    }

    const notifications = new NotificationManager();

    // ===== UI MANAGER =====
    class UIManager {
        constructor() {
            this.panel = null;
            this.minimizedButton = null;
            this.isMinimized = false;
            this.statusElement = null;
            this.statusSummaryElement = null;
        }

        init() {
            // Initialize GraphQL client
            graphqlClient = new GraphQLClient();
            statusTracker = new StatusTracker();

            // Check if we're on a scene page
            const isOnScenePage = window.location.pathname.match(/^\/scenes\/\d+/) && !window.location.pathname.includes('/markers');
            
            if (isOnScenePage) {
                this.createPanel();
                this.initializeStatusTracking();
            } else {
                this.createMinimizedButton();
                this.isMinimized = true;
            }
        }

        createPanel() {
            console.log('📱 Creating AutomateStash panel');
            
            this.panel = document.createElement('div');
            this.panel.id = 'stash-automation-panel';
            this.panel.style.cssText = `
                position: fixed;
                top: 50px;
                right: 10px;
                z-index: 10000;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 15px;
                padding: 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.2);
                backdrop-filter: blur(15px);
                font-family: 'Segoe UI', sans-serif;
                min-width: 320px;
                max-width: 450px;
                color: white;
            `;

            const header = this.createHeader();
            const content = this.createContent();
            const buttons = this.createButtons();

            this.panel.appendChild(header);
            this.panel.appendChild(content);
            this.panel.appendChild(buttons);

            document.body.appendChild(this.panel);
            this.isMinimized = false;
        }

        createHeader() {
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            `;

            const title = document.createElement('h3');
            title.textContent = 'AutomateStash v4.4.0';
            title.style.cssText = `
                color: white;
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            `;

            const minimizeBtn = document.createElement('button');
            minimizeBtn.innerHTML = '−';
            minimizeBtn.style.cssText = `
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            `;

            minimizeBtn.addEventListener('mouseenter', () => {
                minimizeBtn.style.background = 'rgba(255,255,255,0.3)';
            });
            minimizeBtn.addEventListener('mouseleave', () => {
                minimizeBtn.style.background = 'rgba(255,255,255,0.2)';
            });
            minimizeBtn.addEventListener('click', () => this.minimize());

            header.appendChild(title);
            header.appendChild(minimizeBtn);

            return header;
        }

        createContent() {
            const content = document.createElement('div');

            // Status display
            this.statusElement = document.createElement('div');
            this.statusElement.style.cssText = `
                background: rgba(255,255,255,0.1);
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 15px;
                font-size: 13px;
                text-align: center;
                min-height: 20px;
            `;
            this.statusElement.textContent = '⚡ Ready to automate';

            // Info section
            const infoSection = document.createElement('div');
            infoSection.style.cssText = `
                background: rgba(255,255,255,0.05);
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 15px;
                text-align: center;
            `;

            const infoText = document.createElement('div');
            infoText.innerHTML = `
                <div style="font-size: 13px; margin-bottom: 8px; opacity: 0.9;">
                    🎯 Automated scene metadata scraping & organization
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                    Use ⚙️ Settings to configure automation options
                </div>
            `;
            infoSection.appendChild(infoText);

            content.appendChild(this.statusElement);
            content.appendChild(infoSection);

            return content;
        }

        createButtons() {
            const buttons = document.createElement('div');
            buttons.style.cssText = `
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                justify-content: center;
            `;

            // Start/Cancel button
            const startButton = document.createElement('button');
            startButton.id = 'start-automation';
            startButton.textContent = '🚀 Start Automation';
            startButton.style.cssText = `
                background: #e74c3c;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                flex: 1;
                min-width: 150px;
            `;

            startButton.addEventListener('click', () => {
                if (automationInProgress) {
                    cancelAutomation();
                } else {
                    startAutomation();
                }
            });

            // Settings button
            const settingsButton = document.createElement('button');
            settingsButton.textContent = '⚙️ Settings';
            settingsButton.style.cssText = `
                background: rgba(255,255,255,0.2);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            `;

            settingsButton.addEventListener('click', () => this.showSettings());

            buttons.appendChild(startButton);
            buttons.appendChild(settingsButton);

            return buttons;
        }

        async initializeStatusTracking() {
            console.log('🔄 Initializing enhanced status tracking...');
            
            try {
                // Set up status update callback
                statusTracker.onStatusUpdate(this.updateStatusDisplay.bind(this));
                
                // Detect current scene status
                await statusTracker.detectCurrentStatus();
                
                // Create status summary display
                this.createStatusSummary();
                
                console.log('✅ Status tracking initialized successfully');
            } catch (error) {
                console.error('❌ Error initializing status tracking:', error);
            }
        }

        createStatusSummary() {
            if (!this.panel) return;
            
            // Remove existing status summary if it exists
            const existing = this.panel.querySelector('#status-summary');
            if (existing) existing.remove();
            
            const statusSummary = document.createElement('div');
            statusSummary.id = 'status-summary';
            statusSummary.style.cssText = `
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 15px;
                border: 1px solid rgba(255,255,255,0.2);
            `;
            
            this.updateStatusSummaryContent(statusSummary);
            
            // Insert after header
            const header = this.panel.querySelector('h3').closest('div');
            header.parentNode.insertBefore(statusSummary, header.nextSibling);
            
            this.statusSummaryElement = statusSummary;
        }

        updateStatusSummaryContent(summaryElement) {
            const summary = statusTracker.getStatusSummary();
            const completion = statusTracker.getCompletionStatus();
            
            summaryElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="font-weight: 600; font-size: 13px;">${summary.scene.name}</div>
                    <div style="font-size: 12px; opacity: 0.8;">${completion.status}</div>
                </div>
                
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <div style="flex: 1; background: rgba(255,255,255,0.05); padding: 6px 8px; border-radius: 4px; font-size: 11px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>${summary.sources.stashdb.icon}</span>
                            <span>StashDB</span>
                        </div>
                        <div style="opacity: 0.7; margin-top: 2px;">${summary.sources.stashdb.status}</div>
                    </div>
                    
                    <div style="flex: 1; background: rgba(255,255,255,0.05); padding: 6px 8px; border-radius: 4px; font-size: 11px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>${summary.sources.theporndb.icon}</span>
                            <span>ThePornDB</span>
                        </div>
                        <div style="opacity: 0.7; margin-top: 2px;">${summary.sources.theporndb.status}</div>
                    </div>
                    
                    <div style="flex: 1; background: rgba(255,255,255,0.05); padding: 6px 8px; border-radius: 4px; font-size: 11px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>${summary.organized.icon}</span>
                            <span>Organized</span>
                        </div>
                        <div style="opacity: 0.7; margin-top: 2px;">${summary.organized.status}</div>
                    </div>
                </div>
                
                <div style="background: rgba(255,255,255,0.1); height: 4px; border-radius: 2px; overflow: hidden;">
                    <div style="background: ${completion.percentage === 100 ? '#28a745' : '#ffc107'}; height: 100%; width: ${completion.percentage}%; transition: width 0.3s ease;"></div>
                </div>
            `;
        }

        updateStatusDisplay() {
            if (this.statusSummaryElement) {
                this.updateStatusSummaryContent(this.statusSummaryElement);
            }
        }

        updateSceneStatus(status) {
            if (this.statusElement) {
                this.statusElement.textContent = status;
            }
        }

        createMinimizedButton() {
            this.minimizedButton = document.createElement('button');
            this.minimizedButton.id = 'stash-minimized-button';
            this.minimizedButton.style.cssText = `
                position: fixed;
                top: 50px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
                z-index: 10000;
                display: block;
                transition: all 0.3s;
            `;
            this.minimizedButton.innerHTML = '🚀';
            this.minimizedButton.title = 'AutomateStash';

            this.minimizedButton.addEventListener('click', () => this.expand());
            this.minimizedButton.addEventListener('mouseenter', () => {
                this.minimizedButton.style.transform = 'scale(1.1)';
            });
            this.minimizedButton.addEventListener('mouseleave', () => {
                this.minimizedButton.style.transform = 'scale(1)';
            });

            document.body.appendChild(this.minimizedButton);
        }

        minimize() {
            if (this.panel) {
                this.panel.style.display = 'none';
                if (!this.minimizedButton) {
                    this.createMinimizedButton();
                } else {
                    this.minimizedButton.style.display = 'block';
                }
                this.isMinimized = true;
            }
        }

        expand() {
            if (this.minimizedButton) {
                this.minimizedButton.style.display = 'none';
            }
            if (this.panel) {
                this.panel.style.display = 'block';
            } else {
                this.createPanel();
                this.initializeStatusTracking();
            }
            this.isMinimized = false;
        }

        showSettings() {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10002;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: #2c3e50;
                color: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                border: 2px solid rgba(255,255,255,0.1);
            `;

            const configOptions = [
                { key: CONFIG.AUTO_SCRAPE_STASHDB, label: 'Auto-scrape StashDB' },
                { key: CONFIG.AUTO_SCRAPE_THEPORNDB, label: 'Auto-scrape ThePornDB' },
                { key: CONFIG.AUTO_CREATE_PERFORMERS, label: 'Auto-create new performers/studios/tags' },
                { key: CONFIG.AUTO_ORGANIZE, label: 'Auto-organize scenes' },
                { key: CONFIG.SHOW_NOTIFICATIONS, label: 'Show notifications' },
                { key: CONFIG.MINIMIZE_WHEN_COMPLETE, label: 'Minimize UI when complete' },
                { key: CONFIG.AUTO_APPLY_CHANGES, label: 'Auto-apply changes (no confirmation)' },
                { key: CONFIG.SKIP_ALREADY_SCRAPED, label: 'Skip already scraped sources' },
                { key: CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE, label: '🧠 Enable GraphQL API (for accurate status)' }
            ];

            dialog.innerHTML = `
                <h2 style="margin: 0 0 20px 0; text-align: center; color: #3498db;">⚙️ AutomateStash Settings</h2>
                
                <div style="margin-bottom: 20px;">
                    ${configOptions.map(option => `
                        <label style="display: block; margin-bottom: 15px; cursor: pointer; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); transition: background 0.2s;">
                            <input type="checkbox" id="config-${option.key}" ${getConfig(option.key) ? 'checked' : ''} style="margin-right: 10px;">
                            ${option.label}
                        </label>
                    `).join('')}
                </div>
                
                <div style="margin: 20px 0; padding: 15px; background: rgba(52, 152, 219, 0.1); border-radius: 8px; border: 1px solid rgba(52, 152, 219, 0.3);">
                    <h3 style="margin: 0 0 10px 0; color: #3498db; font-size: 16px;">🔗 GraphQL API Configuration</h3>
                    
                    <label style="display: block; margin-bottom: 5px; font-size: 14px;">
                        Stash Server Address:
                        <input type="text" id="config-stash-address" value="${getConfig(CONFIG.STASH_ADDRESS)}" 
                               placeholder="http://localhost:9998"
                               style="width: 100%; padding: 8px; margin-top: 5px; border-radius: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white;">
                    </label>
                    
                    <label style="display: block; margin-top: 10px; font-size: 14px;">
                        API Key (if required):
                        <input type="password" id="config-api-key" value="${getConfig(CONFIG.STASH_API_KEY)}" 
                               placeholder="Enter API key"
                               style="width: 100%; padding: 8px; margin-top: 5px; border-radius: 4px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white;">
                    </label>
                    
                    <button id="test-connection" style="margin-top: 10px; background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                        🔌 Test Connection
                    </button>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="save-settings" style="background: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        Save
                    </button>
                    <button id="cancel-settings" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            `;

            modal.appendChild(dialog);
            document.body.appendChild(modal);

            // Test connection handler
            dialog.querySelector('#test-connection').addEventListener('click', async () => {
                const testBtn = dialog.querySelector('#test-connection');
                testBtn.textContent = '🔄 Testing...';
                testBtn.disabled = true;
                
                try {
                    const tempClient = new GraphQLClient();
                    tempClient.baseUrl = dialog.querySelector('#config-stash-address').value;
                    tempClient.apiKey = dialog.querySelector('#config-api-key').value;
                    tempClient.endpoint = `${tempClient.baseUrl}/graphql`;
                    
                    const sceneId = tempClient.getCurrentSceneId();
                    if (sceneId) {
                        await tempClient.getSceneDetails(sceneId);
                        testBtn.textContent = '✅ Connected';
                        testBtn.style.background = '#27ae60';
                        notifications.show('GraphQL connection successful!', 'success');
                    } else {
                        testBtn.textContent = '⚠️ No Scene';
                        testBtn.style.background = '#f39c12';
                        notifications.show('Connection works, but not on a scene page', 'warning');
                    }
                } catch (error) {
                    testBtn.textContent = '❌ Failed';
                    testBtn.style.background = '#e74c3c';
                    notifications.show(`Connection failed: ${error.message}`, 'error');
                } finally {
                    setTimeout(() => {
                        testBtn.textContent = '🔌 Test Connection';
                        testBtn.style.background = '#3498db';
                        testBtn.disabled = false;
                    }, 3000);
                }
            });

            // Save handler
            dialog.querySelector('#save-settings').addEventListener('click', () => {
                configOptions.forEach(option => {
                    setConfig(option.key, dialog.querySelector(`#config-${option.key}`).checked);
                });
                
                setConfig(CONFIG.STASH_ADDRESS, dialog.querySelector('#config-stash-address').value);
                setConfig(CONFIG.STASH_API_KEY, dialog.querySelector('#config-api-key').value);
                
                // Reinitialize GraphQL client with new settings
                graphqlClient = new GraphQLClient();
                
                notifications.show('Settings saved successfully!', 'success');
                modal.remove();
                
                // Refresh status if on scene page
                if (statusTracker) {
                    statusTracker.detectCurrentStatus();
                }
            });

            dialog.querySelector('#cancel-settings').addEventListener('click', () => {
                modal.remove();
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
    }

    // ===== MAIN AUTOMATION FUNCTIONS =====
    
    async function startAutomation() {
        if (automationInProgress) {
            notifications.show('Automation already in progress!', 'warning');
            return;
        }

        automationInProgress = true;
        automationCancelled = false;
        
        const startBtn = document.querySelector('#start-automation');
        if (startBtn) {
            startBtn.textContent = '🛑 Cancel';
            startBtn.style.background = '#95a5a6';
        }

        try {
            notifications.show('Starting automation...', 'info');
            uiManager.updateSceneStatus('Opening edit panel...');
            
            // Step 1: Open edit panel
            await openEditPanel();
            if (automationCancelled) return;
            
            // Refresh status after opening edit panel
            await statusTracker.detectCurrentStatus();
            
            // Step 2: Scrape StashDB if enabled
            if (getConfig(CONFIG.AUTO_SCRAPE_STASHDB)) {
                if (getConfig(CONFIG.SKIP_ALREADY_SCRAPED) && statusTracker.currentStatus.stashdb.scraped) {
                    notifications.show('StashDB already scraped - skipping', 'info');
                } else {
                    uiManager.updateSceneStatus('Scraping StashDB...');
                    await scrapeStashDB();
                    if (automationCancelled) return;
                }
            }
            
            // Step 3: Scrape ThePornDB if enabled
            if (getConfig(CONFIG.AUTO_SCRAPE_THEPORNDB)) {
                if (getConfig(CONFIG.SKIP_ALREADY_SCRAPED) && statusTracker.currentStatus.theporndb.scraped) {
                    notifications.show('ThePornDB already scraped - skipping', 'info');
                } else {
                    uiManager.updateSceneStatus('Scraping ThePornDB...');
                    await scrapeThePornDB();
                    if (automationCancelled) return;
                }
            }
            
            // Step 4: Create new performers/studios/tags if enabled
            if (getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
                uiManager.updateSceneStatus('Creating new entities...');
                await createNewPerformers();
                if (automationCancelled) return;
            }
            
            // Step 5: Apply scraped data
            uiManager.updateSceneStatus('Applying scraped data...');
            await applyScrapedData();
            if (automationCancelled) return;
            
            // Step 6: Save scene
            uiManager.updateSceneStatus('Saving scene...');
            await saveScene();
            if (automationCancelled) return;
            
            // Step 7: Organize scene if enabled
            if (getConfig(CONFIG.AUTO_ORGANIZE)) {
                uiManager.updateSceneStatus('Organizing scene...');
                await organizeScene();
            }
            
            // Complete!
            notifications.show('Automation completed successfully!', 'success');
            uiManager.updateSceneStatus('✅ Automation completed!');
            
            // Refresh status
            await statusTracker.detectCurrentStatus();
            
            if (getConfig(CONFIG.MINIMIZE_WHEN_COMPLETE)) {
                setTimeout(() => uiManager.minimize(), 2000);
            }
            
        } catch (error) {
            console.error('Automation error:', error);
            notifications.show(`Automation failed: ${error.message}`, 'error');
            uiManager.updateSceneStatus(`Error: ${error.message}`);
        } finally {
            automationInProgress = false;
            
            if (startBtn) {
                startBtn.textContent = '🚀 Start Automation';
                startBtn.style.background = '#e74c3c';
            }
        }
    }

    function cancelAutomation() {
        if (automationInProgress) {
            automationCancelled = true;
            notifications.show('Cancelling automation...', 'warning');
            uiManager.updateSceneStatus('Automation cancelled');
        }
    }

    async function openEditPanel() {
        console.log('Checking for edit panel...');
        
        // Enhanced detection using multiple strategies
        const formIndicators = [
            'input[name="title"]',
            'input[placeholder*="Title"]',
            'textarea[name="details"]',
            'input[type="date"]',
            '.entity-edit-panel',
            '.scene-edit-form',
            'form'
        ];
        
        for (const selector of formIndicators) {
            const element = document.querySelector(selector);
            if (element) {
                console.log('✅ Edit panel already open');
                return true;
            }
        }
        
        console.log('Edit panel not found, attempting to open...');
        
        // Find and click edit button
        const editSelectors = [
            'a[data-rb-event-key="scene-edit-panel"]',
            'button[title="Edit"]',
            'a[href*="/edit"]',
            'button.btn-primary'
        ];
        
        for (const selector of editSelectors) {
            const editBtn = await waitForElement(selector, 2000);
            if (editBtn) {
                const btnText = editBtn.textContent.toLowerCase();
                if (selector === 'button.btn-primary' && !btnText.includes('edit')) {
                    continue;
                }
                
                console.log('Clicking edit button:', selector);
                editBtn.click();
                await sleep(STASH_CONFIG.REACT_RENDER_DELAY);
                
                // Wait for edit panel to appear
                for (const indicator of formIndicators) {
                    const element = await waitForElement(indicator, 1000);
                    if (element) {
                        console.log('✅ Edit panel opened successfully');
                        return true;
                    }
                }
            }
        }
        
        throw new Error('Could not open edit panel');
    }

    async function scrapeStashDB() {
        console.log('Scraping StashDB...');
        
        const buttons = document.querySelectorAll('button');
        let scrapeBtn = null;
        
        for (const btn of buttons) {
            if (btn.textContent.includes('Scrape') || btn.title?.includes('Scrape')) {
                scrapeBtn = btn;
                break;
            }
        }
        
        if (!scrapeBtn) {
            console.warn('Scrape button not found');
            return;
        }
        
        scrapeBtn.click();
        await sleep(STASH_CONFIG.SCRAPER_DROPDOWN_DELAY);
        
        const dropdownItems = document.querySelectorAll('.dropdown-item, a.dropdown-item');
        for (const item of dropdownItems) {
            if (item.textContent.toLowerCase().includes('stashdb') || 
                item.textContent.toLowerCase().includes('stash-box')) {
                console.log('✅ Found StashDB option');
                item.click();
                notifications.show('Searching StashDB...', 'info');
                
                await sleep(3000);
                await checkAndCreateNewEntities();
                
                const applyButtons = document.querySelectorAll('button');
                let applyBtn = null;
                for (const btn of applyButtons) {
                    if (btn.textContent.includes('Apply') && !btn.disabled) {
                        applyBtn = btn;
                        break;
                    }
                }
                if (applyBtn) {
                    console.log('Applying StashDB result');
                    applyBtn.click();
                    await sleep(STASH_CONFIG.SCRAPER_APPLY_DELAY);
                    notifications.show('StashDB data applied', 'success');
                    statusTracker.updateStatus('stashdb', { scraped: true, confidence: 100 });
                } else {
                    console.log('No StashDB results to apply');
                }
                break;
            }
        }
    }

    async function scrapeThePornDB() {
        console.log('Scraping ThePornDB...');
        
        const buttons = document.querySelectorAll('button');
        let scrapeBtn = null;
        
        for (const btn of buttons) {
            if (btn.textContent.includes('Scrape') || btn.title?.includes('Scrape')) {
                scrapeBtn = btn;
                break;
            }
        }
        
        if (!scrapeBtn) {
            console.warn('Scrape button not found');
            return;
        }
        
        scrapeBtn.click();
        await sleep(STASH_CONFIG.SCRAPER_DROPDOWN_DELAY);
        
        const dropdownItems = document.querySelectorAll('.dropdown-item, a.dropdown-item');
        for (const item of dropdownItems) {
            if (item.textContent.toLowerCase().includes('theporndb') || 
                item.textContent.toLowerCase().includes('tpdb') ||
                item.textContent.toLowerCase().includes('metadataapi')) {
                console.log('✅ Found ThePornDB option');
                item.click();
                notifications.show('Searching ThePornDB...', 'info');
                
                await sleep(5000);
                await checkAndCreateNewEntities();
                
                const applyButtons = document.querySelectorAll('button');
                let applyBtn = null;
                for (const btn of applyButtons) {
                    if (btn.textContent.includes('Apply') && !btn.disabled) {
                        applyBtn = btn;
                        break;
                    }
                }
                if (applyBtn) {
                    console.log('Applying ThePornDB result');
                    applyBtn.click();
                    await sleep(STASH_CONFIG.SCRAPER_APPLY_DELAY);
                    notifications.show('ThePornDB data applied', 'success');
                    statusTracker.updateStatus('theporndb', { scraped: true, confidence: 100 });
                } else {
                    console.log('No ThePornDB results to apply');
                }
                break;
            }
        }
    }

    async function checkAndCreateNewEntities() {
        if (!getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
            console.log('Auto-create performers disabled, skipping...');
            return;
        }
        
        console.log('Checking for new entities to create...');
        
        const plusButtonSelectors = [
            'button.minimal.ml-2.btn.btn-primary svg[data-icon="plus"]',
            'button.minimal.ml-2.btn.btn-primary svg.fa-plus',
            '.scraper-result button svg[data-icon="plus"]',
            'button.btn-primary svg.fa-plus',
            'button[title*="Create"]'
        ];
        
        let plusButtons = [];
        for (const selector of plusButtonSelectors) {
            const svgElements = document.querySelectorAll(selector);
            for (const svg of svgElements) {
                const button = svg.closest('button');
                if (button && !button.disabled) {
                    plusButtons.push(button);
                }
            }
        }
        
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            if (btn.textContent.trim() === '+' && !btn.disabled) {
                const parentElement = btn.closest('.input-group, .form-group, .row');
                if (parentElement && (
                    parentElement.textContent.toLowerCase().includes('performer') ||
                    parentElement.textContent.toLowerCase().includes('studio') ||
                    parentElement.textContent.toLowerCase().includes('tag')
                )) {
                    plusButtons.push(btn);
                }
            }
        }
        
        plusButtons = [...new Set(plusButtons)];
        
        if (plusButtons.length > 0) {
            console.log(`Found ${plusButtons.length} new entities to create`);
            notifications.show(`Creating ${plusButtons.length} new entities...`, 'info');
            
            for (let i = 0; i < plusButtons.length; i++) {
                if (automationCancelled) return;
                
                try {
                    console.log(`Creating entity ${i + 1}/${plusButtons.length}...`);
                    plusButtons[i].click();
                    
                    if (i < plusButtons.length - 1) {
                        await sleep(2000);
                    } else {
                        await sleep(3000);
                    }
                } catch (error) {
                    console.error('Error creating new entity:', error);
                }
            }
            
            console.log('✅ Finished creating new entities');
        } else {
            console.log('No new entities to create');
        }
    }
    
    async function createNewPerformers() {
        await checkAndCreateNewEntities();
    }

    async function applyScrapedData() {
        console.log('Applying scraped data...');
        
        const buttons = document.querySelectorAll('button:not(:disabled)');
        
        for (const btn of buttons) {
            const btnText = btn.textContent.toLowerCase();
            if (btnText.includes('apply') || btnText.includes('confirm')) {
                btn.click();
                await sleep(STASH_CONFIG.GRAPHQL_MUTATION_DELAY);
                break;
            }
        }
    }

    async function saveScene() {
        console.log('Saving scene...');
        
        const buttons = document.querySelectorAll('button:not(:disabled)');
        
        for (const btn of buttons) {
            const btnText = btn.textContent.toLowerCase();
            if (btnText.includes('save') || (btn.type === 'submit' && btn.classList.contains('btn-primary'))) {
                btn.click();
                await sleep(STASH_CONFIG.SAVE_DELAY);
                break;
            }
        }
    }

    async function organizeScene() {
        console.log('Organizing scene...');
        
        const organizeBtn = await waitForElement('button[title="Organized"]', 3000);
        if (organizeBtn && !organizeBtn.classList.contains('organized')) {
            organizeBtn.click();
            await sleep(STASH_CONFIG.ORGANIZATION_DELAY);
            notifications.show('Scene marked as organized', 'success');
            statusTracker.updateStatus('organized', { organized: true });
        }
    }

    // ===== INITIALIZATION =====
    function init() {
        console.log('Initializing AutomateStash enhanced plugin...');
        
        // Create UI manager
        uiManager = new UIManager();
        
        // Wait for page to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => uiManager.init(), 500);
            });
        } else {
            setTimeout(() => uiManager.init(), 500);
        }
        
        // Handle navigation changes
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                setTimeout(() => {
                    if (uiManager) {
                        const isOnScenePage = url.match(/^\/scenes\/\d+/) && !url.includes('/markers');
                        if (isOnScenePage) {
                            uiManager.expand();
                            if (statusTracker) {
                                statusTracker.detectCurrentStatus();
                            }
                        } else {
                            uiManager.minimize();
                        }
                    }
                }, 500);
            }
        }).observe(document, { subtree: true, childList: true });
    }

    // Start the plugin
    init();

})();