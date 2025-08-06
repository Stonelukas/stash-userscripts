/**
 * AutomateStash Plugin for Stash - Compact Version
 * Version: 4.4.0
 * Description: Automated metadata scraping and scene organization for Stash
 * 
 * This is a more compact version suitable for Stash plugin system
 */

(function () {
    'use strict';

    console.log('🚀 AutomateStash Plugin v4.4.0 - Native Stash plugin');

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
        SKIP_ALREADY_SCRAPED: 'skipAlreadyScraped'
    };

    const DEFAULTS = {
        [CONFIG.AUTO_SCRAPE_STASHDB]: true,
        [CONFIG.AUTO_SCRAPE_THEPORNDB]: true,
        [CONFIG.AUTO_ORGANIZE]: true,
        [CONFIG.AUTO_CREATE_PERFORMERS]: true,
        [CONFIG.SHOW_NOTIFICATIONS]: true,
        [CONFIG.MINIMIZE_WHEN_COMPLETE]: true,
        [CONFIG.AUTO_APPLY_CHANGES]: false,
        [CONFIG.SKIP_ALREADY_SCRAPED]: true
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
            this.initialized = false;
        }

        init() {
            if (this.initialized) return;
            
            this.createPanel();
            this.createMinimizedButton();
            
            // Check if we're on an already organized scene
            const isOnScenePage = window.location.pathname.match(/^\/scenes\/\d+/) && !window.location.pathname.includes('/markers');
            const shouldStartMinimized = isOnScenePage && this.checkIfOrganized();
            
            if (shouldStartMinimized) {
                this.minimize();
            } else {
                this.show();
            }
            
            this.initialized = true;
        }

        checkIfOrganized() {
            // Check for organized button state
            const organizedButton = document.querySelector('button[title="Organized"]');
            if (organizedButton) {
                return organizedButton.classList.contains('organized') || 
                       organizedButton.getAttribute('aria-pressed') === 'true';
            }
            return false;
        }

        createPanel() {
            this.panel = document.createElement('div');
            this.panel.id = 'stash-automation-panel';
            this.panel.style.cssText = `
                position: fixed;
                top: 50px;
                right: 20px;
                width: 320px;
                background: linear-gradient(145deg, #2d3748, #1a202c);
                color: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                font-family: 'Segoe UI', sans-serif;
                z-index: 10000;
                backdrop-filter: blur(10px);
                display: none;
            `;

            const isOnScenePage = window.location.pathname.match(/^\/scenes\/\d+/) && !window.location.pathname.includes('/markers');
            
            this.panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">🚀 AutomateStash</h3>
                    <button id="minimize-button" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 30px; height: 30px;">_</button>
                </div>
                ${isOnScenePage ? `
                <div id="automation-content">
                    <p style="margin: 10px 0; font-size: 14px; opacity: 0.9;">Automate scene metadata scraping and organization.</p>
                    
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                        <p style="margin: 0; font-size: 12px; opacity: 0.8;">
                            ℹ️ Configure automation settings by clicking the gear icon below.
                        </p>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button id="start-automation" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                            Start Automation
                        </button>
                        <button id="settings-button" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; transition: all 0.3s; width: 44px;">
                            ⚙️
                        </button>
                    </div>
                    
                    <div id="automation-status" style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; display: none;">
                        <p style="margin: 0; font-size: 14px;">Status: <span id="status-text">Ready</span></p>
                    </div>
                </div>
                ` : `
                <div style="text-align: center; padding: 20px;">
                    <p style="margin: 0 0 15px 0; font-size: 14px; opacity: 0.8;">
                        Navigate to a scene page to use automation features.
                    </p>
                    <button id="settings-button-non-scene" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; transition: all 0.3s;">
                        ⚙️ Settings
                    </button>
                </div>
                `}
            `;

            document.body.appendChild(this.panel);

            // Event listeners
            const minimizeBtn = this.panel.querySelector('#minimize-button');
            if (minimizeBtn) {
                minimizeBtn.addEventListener('click', () => this.minimize());
            }

            const startBtn = this.panel.querySelector('#start-automation');
            if (startBtn) {
                startBtn.addEventListener('click', () => startAutomation());
            }

            const settingsBtn = this.panel.querySelector('#settings-button, #settings-button-non-scene');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', () => this.showSettings());
            }
        }

        createMinimizedButton() {
            this.minimizedButton = document.createElement('button');
            this.minimizedButton.id = 'stash-minimized-button';
            this.minimizedButton.style.cssText = `
                position: fixed;
                top: 50px;
                right: 20px;
                background: linear-gradient(145deg, #3b82f6, #2563eb);
                color: white;
                border: none;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
                z-index: 10000;
                display: none;
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

        show() {
            if (this.panel) {
                this.panel.style.display = 'block';
                this.minimizedButton.style.display = 'none';
                this.isMinimized = false;
            }
        }

        hide() {
            if (this.panel) {
                this.panel.style.display = 'none';
                this.minimizedButton.style.display = 'none';
            }
        }

        minimize() {
            if (this.panel) {
                this.panel.style.display = 'none';
                this.minimizedButton.style.display = 'block';
                this.isMinimized = true;
            }
        }

        expand() {
            this.show();
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
                background: #1a202c;
                color: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            `;

            dialog.innerHTML = `
                <h2 style="margin: 0 0 20px 0;">⚙️ AutomateStash Settings</h2>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="config-auto-stashdb" ${getConfig(CONFIG.AUTO_SCRAPE_STASHDB) ? 'checked' : ''} style="margin-right: 10px;">
                        Auto-scrape StashDB
                    </label>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="config-auto-theporndb" ${getConfig(CONFIG.AUTO_SCRAPE_THEPORNDB) ? 'checked' : ''} style="margin-right: 10px;">
                        Auto-scrape ThePornDB
                    </label>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="config-auto-performers" ${getConfig(CONFIG.AUTO_CREATE_PERFORMERS) ? 'checked' : ''} style="margin-right: 10px;">
                        Auto-create new performers/studios/tags
                    </label>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="config-auto-organize" ${getConfig(CONFIG.AUTO_ORGANIZE) ? 'checked' : ''} style="margin-right: 10px;">
                        Auto-organize scenes
                    </label>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="config-notifications" ${getConfig(CONFIG.SHOW_NOTIFICATIONS) ? 'checked' : ''} style="margin-right: 10px;">
                        Show notifications
                    </label>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="config-minimize" ${getConfig(CONFIG.MINIMIZE_WHEN_COMPLETE) ? 'checked' : ''} style="margin-right: 10px;">
                        Minimize when complete
                    </label>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="config-auto-apply" ${getConfig(CONFIG.AUTO_APPLY_CHANGES) ? 'checked' : ''} style="margin-right: 10px;">
                        Auto-apply changes (no confirmation)
                    </label>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="config-skip-scraped" ${getConfig(CONFIG.SKIP_ALREADY_SCRAPED) ? 'checked' : ''} style="margin-right: 10px;">
                        Skip already scraped sources
                    </label>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="save-settings" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        Save
                    </button>
                    <button id="cancel-settings" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            `;

            modal.appendChild(dialog);
            document.body.appendChild(modal);

            // Event handlers
            dialog.querySelector('#save-settings').addEventListener('click', () => {
                setConfig(CONFIG.AUTO_SCRAPE_STASHDB, dialog.querySelector('#config-auto-stashdb').checked);
                setConfig(CONFIG.AUTO_SCRAPE_THEPORNDB, dialog.querySelector('#config-auto-theporndb').checked);
                setConfig(CONFIG.AUTO_CREATE_PERFORMERS, dialog.querySelector('#config-auto-performers').checked);
                setConfig(CONFIG.AUTO_ORGANIZE, dialog.querySelector('#config-auto-organize').checked);
                setConfig(CONFIG.SHOW_NOTIFICATIONS, dialog.querySelector('#config-notifications').checked);
                setConfig(CONFIG.MINIMIZE_WHEN_COMPLETE, dialog.querySelector('#config-minimize').checked);
                setConfig(CONFIG.AUTO_APPLY_CHANGES, dialog.querySelector('#config-auto-apply').checked);
                setConfig(CONFIG.SKIP_ALREADY_SCRAPED, dialog.querySelector('#config-skip-scraped').checked);
                
                notifications.show('Settings saved successfully!', 'success');
                modal.remove();
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

        updateStatus(message, type = 'info') {
            const statusDiv = this.panel.querySelector('#automation-status');
            const statusText = this.panel.querySelector('#status-text');
            
            if (statusDiv && statusText) {
                statusDiv.style.display = 'block';
                statusText.textContent = message;
                
                const colors = {
                    info: 'rgba(23, 162, 184, 0.2)',
                    success: 'rgba(40, 167, 69, 0.2)',
                    warning: 'rgba(255, 193, 7, 0.2)',
                    error: 'rgba(220, 53, 69, 0.2)'
                };
                
                statusDiv.style.background = colors[type] || colors.info;
            }
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
            startBtn.textContent = 'Cancel';
            startBtn.style.background = '#dc3545';
            startBtn.removeEventListener('click', startAutomation);
            startBtn.addEventListener('click', cancelAutomation);
        }

        try {
            notifications.show('Starting automation...', 'info');
            uiManager.updateStatus('Opening edit panel...', 'info');
            
            // Step 1: Open edit panel
            try {
                await openEditPanel();
            } catch (error) {
                console.error('Failed to open edit panel:', error);
                // Log current page state for debugging
                console.log('Current URL:', window.location.href);
                console.log('Page contains edit form elements:', {
                    titleInput: !!document.querySelector('input[name="title"], input[placeholder*="Title"]'),
                    detailsTextarea: !!document.querySelector('textarea[name="details"]'),
                    scrapeButton: !!document.querySelector('button[title*="Scrape"]'),
                    saveButton: !!document.querySelector('button[title*="Save"]')
                });
                throw error;
            }
            if (automationCancelled) return;
            
            // Step 2: Scrape StashDB if enabled
            if (getConfig(CONFIG.AUTO_SCRAPE_STASHDB)) {
                if (getConfig(CONFIG.SKIP_ALREADY_SCRAPED) && await checkAlreadyScraped('stashdb')) {
                    notifications.show('StashDB already scraped - skipping', 'info');
                } else {
                    uiManager.updateStatus('Scraping StashDB...', 'info');
                    await scrapeStashDB();
                    if (automationCancelled) return;
                }
            }
            
            // Step 3: Scrape ThePornDB if enabled
            if (getConfig(CONFIG.AUTO_SCRAPE_THEPORNDB)) {
                if (getConfig(CONFIG.SKIP_ALREADY_SCRAPED) && await checkAlreadyScraped('theporndb')) {
                    notifications.show('ThePornDB already scraped - skipping', 'info');
                } else {
                    uiManager.updateStatus('Scraping ThePornDB...', 'info');
                    await scrapeThePornDB();
                    if (automationCancelled) return;
                }
            }
            
            // Step 4: Create new performers/studios/tags if enabled
            if (getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
                uiManager.updateStatus('Creating new entities...', 'info');
                await createNewPerformers();
                if (automationCancelled) return;
            }
            
            // Step 5: Apply scraped data
            uiManager.updateStatus('Applying scraped data...', 'info');
            await applyScrapedData();
            if (automationCancelled) return;
            
            // Step 6: Save scene
            uiManager.updateStatus('Saving scene...', 'info');
            await saveScene();
            if (automationCancelled) return;
            
            // Step 7: Organize scene if enabled
            if (getConfig(CONFIG.AUTO_ORGANIZE)) {
                uiManager.updateStatus('Organizing scene...', 'info');
                await organizeScene();
            }
            
            // Complete!
            notifications.show('Automation completed successfully!', 'success');
            uiManager.updateStatus('Automation completed!', 'success');
            
            if (getConfig(CONFIG.MINIMIZE_WHEN_COMPLETE)) {
                setTimeout(() => uiManager.minimize(), 2000);
            }
            
        } catch (error) {
            console.error('Automation error:', error);
            notifications.show(`Automation failed: ${error.message}`, 'error');
            uiManager.updateStatus(`Error: ${error.message}`, 'error');
        } finally {
            automationInProgress = false;
            
            if (startBtn) {
                startBtn.textContent = 'Start Automation';
                startBtn.style.background = '#3b82f6';
                startBtn.removeEventListener('click', cancelAutomation);
                startBtn.addEventListener('click', startAutomation);
            }
        }
    }

    function cancelAutomation() {
        if (automationInProgress) {
            automationCancelled = true;
            notifications.show('Cancelling automation...', 'warning');
            uiManager.updateStatus('Automation cancelled', 'warning');
        }
    }

    async function openEditPanel() {
        console.log('Checking for edit panel...');
        
        // Enhanced debugging - log what we find
        console.log('Page URL:', window.location.href);
        console.log('Looking for edit panel indicators...');
        
        // Strategy 1: Check for any form elements that indicate edit mode
        const formIndicators = [
            'input[name="title"]',
            'input[placeholder*="Title"]',
            'input[placeholder*="title"]',
            'textarea[name="details"]',
            'textarea[placeholder*="Details"]',
            'textarea[placeholder*="details"]',
            'input[name="date"]',
            'input[type="date"]',
            'input[name="url"]',
            'input[placeholder*="URL"]'
        ];
        
        for (const selector of formIndicators) {
            const element = document.querySelector(selector);
            if (element) {
                console.log('✅ Edit panel detected via form field:', selector);
                console.log('  Field details:', {
                    name: element.name,
                    type: element.type,
                    placeholder: element.placeholder,
                    visible: element.offsetParent !== null
                });
                return true;
            }
        }
        
        // Strategy 2: Check for edit-specific buttons
        const editButtons = document.querySelectorAll('button');
        const editButtonTexts = ['save', 'cancel', 'apply', 'scrape'];
        let foundEditButtons = 0;
        
        for (const btn of editButtons) {
            const btnText = btn.textContent.toLowerCase();
            if (editButtonTexts.some(text => btnText.includes(text))) {
                foundEditButtons++;
            }
        }
        
        if (foundEditButtons >= 2) {
            console.log('✅ Edit panel detected via edit buttons (found', foundEditButtons, 'edit-related buttons)');
            return true;
        }
        
        // Strategy 3: Check for known panel containers
        const panelSelectors = [
            '.entity-edit-panel',
            '.scene-edit-form',
            '.scene-form',
            'form',
            '[class*="edit"]',
            '[class*="Edit"]',
            '.edit-buttons',
            '#scene-edit-details',
            'div[data-testid*="edit"]',
            '.modal-body form',
            '.tab-content form'
        ];
        
        for (const selector of panelSelectors) {
            const existingPanel = document.querySelector(selector);
            if (existingPanel) {
                // Additional check - does it contain form fields?
                const hasInputs = existingPanel.querySelector('input, textarea, select');
                if (hasInputs) {
                    console.log('✅ Edit panel detected via container:', selector);
                    return true;
                }
            }
        }
        
        // Strategy 4: Check if we're already on an edit page URL
        if (window.location.pathname.includes('/edit')) {
            console.log('✅ Edit panel detected via URL pattern');
            return true;
        }
        
        console.log('❌ Edit panel not found, attempting to open...');
        
        // Log available buttons for debugging
        const allButtons = document.querySelectorAll('button, a');
        console.log('Available clickable elements:');
        allButtons.forEach(elem => {
            const text = elem.textContent.trim();
            if (text && (text.toLowerCase().includes('edit') || elem.title?.toLowerCase().includes('edit'))) {
                console.log(' -', elem.tagName, ':', text, elem.title ? `(title: ${elem.title})` : '');
            }
        });
        
        // Try to find and click edit button
        const editSelectors = [
            'a[data-rb-event-key="scene-edit-panel"]',
            'button[title="Edit"]',
            'button[title="edit"]',
            'a[title="Edit"]',
            'a[title="edit"]',
            '.scene-toolbar a[href*="edit"]',
            '.scene-toolbar button:has-text("Edit")',
            'a[href*="/edit"]',
            'button.btn-primary'
        ];
        
        for (const selector of editSelectors) {
            try {
                let editBtn;
                
                // Handle the :has-text pseudo-selector
                if (selector.includes(':has-text')) {
                    const [baseSelector, text] = selector.split(':has-text("');
                    const searchText = text.replace('")', '');
                    const elements = document.querySelectorAll(baseSelector);
                    for (const elem of elements) {
                        if (elem.textContent.includes(searchText)) {
                            editBtn = elem;
                            break;
                        }
                    }
                } else {
                    editBtn = document.querySelector(selector);
                }
                
                if (editBtn) {
                    // Additional validation for generic selectors
                    if (selector === 'button.btn-primary') {
                        const btnText = editBtn.textContent.toLowerCase();
                        if (!btnText.includes('edit')) {
                            continue;
                        }
                    }
                    
                    console.log('Clicking edit button:', selector);
                    editBtn.click();
                    await sleep(STASH_CONFIG.REACT_RENDER_DELAY);
                    
                    // Check if edit panel appeared
                    for (const indicator of formIndicators) {
                        const element = await waitForElement(indicator, 1000);
                        if (element) {
                            console.log('✅ Edit panel opened successfully');
                            return true;
                        }
                    }
                }
            } catch (e) {
                console.warn('Error checking selector:', selector, e);
            }
        }
        
        // Final check after all attempts
        await sleep(500);
        for (const selector of formIndicators) {
            const element = document.querySelector(selector);
            if (element) {
                console.log('✅ Edit panel found on final check');
                return true;
            }
        }
        
        throw new Error('Could not open edit panel - please ensure you are on a scene page and try opening the edit panel manually before running automation');
    }

    async function scrapeStashDB() {
        // Implementation for StashDB scraping
        console.log('Scraping StashDB...');
        
        // Find scrape button - look for buttons with "Scrape" in text
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
        
        // Look for StashDB in dropdown
        const dropdownItems = document.querySelectorAll('.dropdown-item, a.dropdown-item');
        for (const item of dropdownItems) {
            if (item.textContent.toLowerCase().includes('stashdb') || 
                item.textContent.toLowerCase().includes('stash-box')) {
                console.log('✅ Found StashDB option');
                item.click();
                notifications.show('Searching StashDB...', 'info');
                
                // Simple wait like the original userscript
                await sleep(3000);
                
                // Now check if we need to create new entities
                await checkAndCreateNewEntities();
                
                // Apply first result if found
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
                } else {
                    console.log('No StashDB results to apply');
                }
                break;
            }
        }
    }

    async function scrapeThePornDB() {
        // Implementation for ThePornDB scraping
        console.log('Scraping ThePornDB...');
        
        // Find scrape button - look for buttons with "Scrape" in text
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
        
        // Look for ThePornDB in dropdown
        const dropdownItems = document.querySelectorAll('.dropdown-item, a.dropdown-item');
        for (const item of dropdownItems) {
            if (item.textContent.toLowerCase().includes('theporndb') || 
                item.textContent.toLowerCase().includes('tpdb') ||
                item.textContent.toLowerCase().includes('metadataapi')) {
                console.log('✅ Found ThePornDB option');
                item.click();
                notifications.show('Searching ThePornDB...', 'info');
                
                // Wait longer for ThePornDB as it's typically slower
                await sleep(5000);
                
                // Now check if we need to create new entities
                await checkAndCreateNewEntities();
                
                // Apply result if found
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
        
        // Look for + buttons, matching the original userscript selectors
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
        
        // Also check for simple + buttons
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            if (btn.textContent.trim() === '+' && !btn.disabled) {
                // Verify it's near a performer/studio/tag field
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
        
        // Remove duplicates
        plusButtons = [...new Set(plusButtons)];
        
        if (plusButtons.length > 0) {
            console.log(`Found ${plusButtons.length} new entities to create`);
            notifications.show(`Creating ${plusButtons.length} new entities...`, 'info');
            
            for (let i = 0; i < plusButtons.length; i++) {
                if (automationCancelled) return;
                
                try {
                    console.log(`Creating entity ${i + 1}/${plusButtons.length}...`);
                    plusButtons[i].click();
                    
                    // Wait longer between clicks, especially for the last one
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
        // This function is called after scraping, just delegate to the new function
        await checkAndCreateNewEntities();
    }

    async function applyScrapedData() {
        console.log('Applying scraped data...');
        
        // Look for apply/confirm buttons
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
        
        // Look for save button
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
        
        // Look for organize button
        const organizeBtn = await waitForElement('button[title="Organized"]', 3000);
        if (organizeBtn && !organizeBtn.classList.contains('organized')) {
            organizeBtn.click();
            await sleep(STASH_CONFIG.ORGANIZATION_DELAY);
            notifications.show('Scene marked as organized', 'success');
        }
    }

    async function checkAlreadyScraped(source) {
        // Simple check for existing data
        const fields = document.querySelectorAll('input[type="text"], textarea');
        
        for (const field of fields) {
            const value = field.value.toLowerCase();
            if (source === 'stashdb' && value.includes('stashdb')) {
                return true;
            }
            if (source === 'theporndb' && (value.includes('theporndb') || value.includes('metadataapi'))) {
                return true;
            }
        }
        
        return false;
    }

    // ===== INITIALIZATION =====
    function init() {
        console.log('Initializing AutomateStash plugin...');
        
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
                        uiManager.hide();
                        uiManager = new UIManager();
                        uiManager.init();
                    }
                }, 500);
            }
        }).observe(document, { subtree: true, childList: true });
    }

    // Start the plugin
    init();

})();