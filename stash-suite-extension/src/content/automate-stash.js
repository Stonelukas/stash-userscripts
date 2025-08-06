/**
 * AutomateStash Content Script
 * Converted from userscript to extension content script
 */

import { getConfig, setConfig, CONFIG, DEFAULTS } from '../common/config.js';
import { 
    sleep, 
    waitForElement, 
    elementExists, 
    createElement, 
    showNotification,
    isScenePage,
    getSceneIdFromUrl,
    TIMING,
    logError
} from '../common/utils.js';
import { graphqlClient } from '../common/graphql-client.js';

// Global state management
let automationInProgress = false;
let automationCancelled = false;
let automationCompleted = false;
let sceneOrganized = false;

export class AutomateStash {
    constructor() {
        this.uiManager = null;
        this.statusTracker = null;
        this.historyManager = null;
        this.sourceDetector = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        // Check if tool is enabled
        const enabled = await getConfig(CONFIG.ENABLE_AUTOMATE_STASH);
        if (!enabled) {
            console.log('AutomateStash is disabled in settings');
            return;
        }
        
        console.log('🚀 AutomateStash initializing...');
        
        try {
            // Initialize components
            this.uiManager = new UIManager();
            this.statusTracker = new StatusTracker();
            this.historyManager = new HistoryManager();
            this.sourceDetector = new SourceDetector();
            
            console.log('Components initialized');
            
            // Initialize GraphQL client
            await graphqlClient.init();
            console.log('GraphQL client initialized');
            
            // Setup UI
            await this.setupUI();
            console.log('UI setup complete');
            
            // Monitor for page changes
            this.setupPageMonitor();
            
            this.initialized = true;
            console.log('✅ AutomateStash initialized successfully');
        } catch (error) {
            console.error('Failed to initialize AutomateStash:', error);
            logError('AutomateStash Init', error);
        }
    }

    async setupUI() {
        // Wait for page to load
        await sleep(TIMING.REACT_RENDER_DELAY);
        
        // Determine UI state based on page and scene status
        const shouldMinimize = await this.shouldStartMinimized();
        
        if (shouldMinimize) {
            this.uiManager.showMinimized();
        } else {
            this.uiManager.show();
        }
        
        // Update status display
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
        
        // Monitor URL changes
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                this.handlePageChange();
            }
        }, 500);
    }

    async handlePageChange() {
        // Reset state
        automationInProgress = false;
        automationCancelled = false;
        automationCompleted = false;
        sceneOrganized = false;
        
        // Re-setup UI
        await this.setupUI();
    }

    // Main automation function
    async startAutomation() {
        console.log('🚀 startAutomation called');
        
        if (automationInProgress) {
            console.log('Automation already in progress');
            showNotification('Automation already in progress', 'warning');
            return;
        }

        // Check if we're on a scene page
        if (!isScenePage()) {
            console.error('Not on a scene page');
            showNotification('Please navigate to a scene page first', 'error');
            return;
        }

        automationInProgress = true;
        automationCancelled = false;
        automationCompleted = false;
        sceneOrganized = false;

        this.uiManager.setAutomating(true);
        showNotification('🚀 Starting automation...', 'info');

        try {
            console.log('Phase 1: Opening edit panel...');
            
            // Phase 1: Open edit panel
            const editPanelOpened = await this.openEditPanel();
            if (!editPanelOpened) {
                throw new Error('Failed to open edit panel');
            }
            
            console.log('Edit panel opened successfully');

            // Phase 2: Skip check
            if (await getConfig(CONFIG.SKIP_ALREADY_SCRAPED)) {
                const alreadyScraped = await this.checkAlreadyScraped();
                if (alreadyScraped) {
                    showNotification('✅ Scene already has metadata from all sources', 'success');
                    automationCompleted = true;
                    await this.completeAutomation();
                    return;
                }
            }

            // Phase 3: Scrape StashDB
            if (await getConfig(CONFIG.AUTO_SCRAPE_STASHDB)) {
                await this.scrapeStashDB();
                if (automationCancelled) return;
            }

            // Phase 4: Scrape ThePornDB
            if (await getConfig(CONFIG.AUTO_SCRAPE_THEPORNDB)) {
                await this.scrapeThePornDB();
                if (automationCancelled) return;
            }

            // Phase 5: Create new entities
            if (await getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
                await this.createNewPerformers();
                if (automationCancelled) return;
            }

            // Phase 6: Apply scraped data
            await this.applyScrapedData();
            if (automationCancelled) return;

            // Phase 7: Save scene
            await this.saveScene();
            if (automationCancelled) return;

            // Phase 8: Organize scene
            if (await getConfig(CONFIG.AUTO_ORGANIZE) && !sceneOrganized) {
                await this.organizeScene();
            }

            // Complete
            automationCompleted = true;
            await this.completeAutomation();

        } catch (error) {
            logError('Automation', error);
            showNotification(`❌ Automation failed: ${error.message}`, 'error');
        } finally {
            automationInProgress = false;
            this.uiManager.setAutomating(false);
        }
    }

    async openEditPanel() {
        console.log('📝 Opening edit panel...');
        
        try {
            // First, check if edit panel is already open
            const existingPanel = document.querySelector('.entity-edit-panel, .scene-edit-form, form[class*="edit"]');
            if (existingPanel) {
                console.log('Edit panel already open');
                return true;
            }
            
            // Find edit button with multiple selectors
            console.log('Looking for edit button...');
            const editButton = await waitForElement([
                'a[data-rb-event-key="scene-edit-panel"]',
                'button[title="Edit"]',
                '.scene-toolbar a[href*="edit"]',
                'a[href*="/edit"]',
                '.btn:contains("Edit")',  // jQuery-style selector might not work
                'button.btn-secondary'  // Common edit button class
            ], TIMING.ELEMENT_WAIT_TIMEOUT);
            
            if (!editButton) {
                console.error('Edit button not found after waiting');
                // Log all buttons on the page for debugging
                const allButtons = document.querySelectorAll('button, a');
                console.log('Available buttons/links:', allButtons.length);
                allButtons.forEach(btn => {
                    if (btn.textContent && btn.textContent.toLowerCase().includes('edit')) {
                        console.log('Found button with edit text:', btn, btn.textContent);
                    }
                });
                throw new Error('Edit button not found');
            }
            
            console.log('Found edit button:', editButton);
            editButton.click();
            await sleep(TIMING.REACT_RENDER_DELAY);
            
            // Wait for edit panel to appear
            console.log('Waiting for edit panel to appear...');
            const panel = await waitForElement([
                '.entity-edit-panel',
                '.scene-edit-form',
                'form[class*="edit"]',
                '.edit-buttons',  // Alternative selector
                '[data-testid*="edit"]'  // Alternative selector
            ], TIMING.ELEMENT_WAIT_TIMEOUT);
            
            if (panel) {
                console.log('Edit panel appeared successfully');
                return true;
            } else {
                throw new Error('Edit panel did not appear after clicking edit button');
            }
        } catch (error) {
            console.error('Failed to open edit panel:', error);
            throw error;
        }
    }

    async checkAlreadyScraped() {
        const detectedSources = await this.sourceDetector.detectCurrentSources();
        const stashdbScraped = detectedSources.stashdb.detected;
        const theporndbScraped = detectedSources.theporndb.detected;
        
        const shouldScrapeStashDB = await getConfig(CONFIG.AUTO_SCRAPE_STASHDB);
        const shouldScrapeThePornDB = await getConfig(CONFIG.AUTO_SCRAPE_THEPORNDB);
        
        // Check if all enabled sources are already scraped
        const allScraped = (!shouldScrapeStashDB || stashdbScraped) && 
                          (!shouldScrapeThePornDB || theporndbScraped);
        
        return allScraped;
    }

    async scrapeStashDB() {
        console.log('🔍 Scraping StashDB...');
        showNotification('🔍 Scraping StashDB...', 'info');
        
        const scrapeBtn = this.findScrapeButton();
        if (!scrapeBtn) {
            throw new Error('Scrape button not found');
        }
        
        scrapeBtn.click();
        await sleep(1000);
        
        // Look for StashDB option
        const options = document.querySelectorAll('.dropdown-menu .dropdown-item, a.dropdown-item');
        for (const option of options) {
            if (option.textContent.toLowerCase().includes('stashdb') ||
                option.textContent.toLowerCase().includes('stash-box')) {
                console.log('✅ Found StashDB option');
                option.click();
                await sleep(3000);
                return;
            }
        }
        
        console.log('⚠️ No StashDB option found');
    }

    async scrapeThePornDB() {
        console.log('🔍 Scraping ThePornDB...');
        showNotification('🔍 Scraping ThePornDB...', 'info');
        
        const scrapeBtn = this.findScrapeButton();
        if (!scrapeBtn) {
            throw new Error('Scrape button not found');
        }
        
        scrapeBtn.click();
        await sleep(1000);
        
        // Look for ThePornDB option
        const options = document.querySelectorAll('.dropdown-menu .dropdown-item, a.dropdown-item');
        for (const option of options) {
            if (option.textContent.toLowerCase().includes('theporndb') ||
                option.textContent.toLowerCase().includes('tpdb')) {
                console.log('✅ Found ThePornDB option');
                option.click();
                await sleep(3000);
                return;
            }
        }
        
        console.log('⚠️ No ThePornDB option found');
    }

    findScrapeButton() {
        console.log('🔍 Looking for scrape button...');
        
        const buttons = document.querySelectorAll('button');
        for (const button of buttons) {
            const text = button.textContent || '';
            if (text.toLowerCase().includes('scrape') && !button.disabled) {
                console.log('✅ Found scrape button');
                return button;
            }
        }
        
        console.log('⚠️ No scrape button found');
        return null;
    }

    async createNewPerformers() {
        console.log('👥 Creating new performers/studios/tags...');
        showNotification('👥 Creating new performers/studios/tags...', 'info');
        await sleep(2500);
        
        // Find plus buttons for new performers, studios, tags, etc.
        const plusButtonSelectors = [
            'button.minimal.ml-2.btn.btn-primary svg[data-prefix="fas"][data-icon="plus"]',
            'button.minimal.ml-2.btn.btn-primary svg[data-icon="plus"]',
            '.scraper-result button svg[data-icon="plus"]',
            'button.btn-primary svg.fa-plus'
        ];
        
        let plusButtons = [];
        for (const selector of plusButtonSelectors) {
            plusButtons = document.querySelectorAll(selector);
            if (plusButtons.length > 0) {
                break;
            }
        }
        
        if (plusButtons.length > 0) {
            showNotification(`👥 Creating ${plusButtons.length} new entries...`, 'info');
            
            for (let i = 0; i < plusButtons.length; i++) {
                try {
                    const button = plusButtons[i].closest('button');
                    if (button && !button.disabled) {
                        button.click();
                        
                        // Wait between clicks, longer for the last one
                        if (i < plusButtons.length - 1) {
                            await sleep(2000);
                        } else {
                            await sleep(3000);
                        }
                    }
                } catch (error) {
                    console.error('Error creating new entry:', error);
                }
            }
        }
    }

    async applyScrapedData() {
        console.log('📋 Applying scraped data...');
        showNotification('📋 Applying scraped data...', 'info');
        
        await sleep(1000);
        
        // Find Apply button
        const applySelectors = [
            '.edit-panel button.btn-primary',
            'button.ml-2.btn.btn-primary',
            'button[data-testid*="apply"]',
            'button:not([disabled])[type="button"]'
        ];
        
        let applyButton = null;
        for (const selector of applySelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
                const text = button.textContent || '';
                if (text.toLowerCase().includes('apply') && !button.disabled) {
                    applyButton = button;
                    break;
                }
            }
            if (applyButton) break;
        }
        
        if (applyButton) {
            console.log('✅ Found Apply button');
            applyButton.click();
            await sleep(2000);
        } else {
            console.log('⚠️ No Apply button found or button disabled');
        }
    }

    async saveScene() {
        console.log('💾 Saving scene...');
        showNotification('💾 Saving scene...', 'info');
        
        await sleep(1000);
        
        const allButtons = document.querySelectorAll('button, .btn, input[type="button"], input[type="submit"]');
        for (const btn of allButtons) {
            const text = btn.textContent || btn.value || '';
            if (text.toLowerCase().includes('save') && !btn.disabled) {
                btn.click();
                await sleep(TIMING.SAVE_DELAY);
                
                // Update status after save
                await this.updateSceneStatus();
                return;
            }
        }
        
        console.warn('Save button not found');
    }

    async organizeScene() {
        console.log('📁 Organizing scene...');
        showNotification('📁 Organizing scene...', 'info');
        
        await sleep(1000);
        
        // Double-check if already organized before proceeding
        const scene = await graphqlClient.findScene(getSceneIdFromUrl());
        if (scene && scene.organized) {
            console.log('✅ Scene is already organized');
            sceneOrganized = true;
            return;
        }
        
        // Find organize button
        const organizeButton = document.querySelector('button[title="Organized"]');
        if (!organizeButton) {
            console.warn('Organize button not found');
            return;
        }
        
        // Check button state and only click if not already organized
        const isActive = organizeButton.classList.contains('btn-primary') || 
                        organizeButton.getAttribute('aria-pressed') === 'true';
        
        if (!isActive) {
            console.log('📁 Clicking organize button...');
            organizeButton.click();
            sceneOrganized = true;
            await sleep(1500);
            
            // Update status after organize
            await this.updateSceneStatus();
        } else {
            console.log('✅ Scene already organized');
            sceneOrganized = true;
        }
    }

    async completeAutomation() {
        if (await getConfig(CONFIG.MINIMIZE_WHEN_COMPLETE)) {
            this.uiManager.minimize();
        }
        
        await this.historyManager.recordAutomation({
            sceneId: getSceneIdFromUrl(),
            timestamp: Date.now(),
            completed: automationCompleted,
            cancelled: automationCancelled
        });
        
        showNotification('✅ Automation completed!', 'success');
    }

    cancelAutomation() {
        automationCancelled = true;
        automationInProgress = false;
        this.uiManager.setAutomating(false);
        showNotification('❌ Automation cancelled', 'warning');
    }
}

// UI Manager class
class UIManager {
    constructor() {
        this.panel = null;
        this.minimizedButton = null;
        this.settingsDialog = null;
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
        // Create main panel UI
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
        
        // Add panel content
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
            
            <div style="
                margin-top: 20px;
                font-size: 12px;
                text-align: center;
                opacity: 0.7;
            ">
                Click Settings (⚙️) to configure automation options
            </div>
        `;
        
        document.body.appendChild(this.panel);
        
        // Add event listeners
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
        // Minimize button
        const minimizeBtn = this.panel.querySelector('#minimize-button');
        minimizeBtn?.addEventListener('click', () => this.minimize());
        
        // Start automation button
        const startBtn = this.panel.querySelector('#start-automation');
        startBtn?.addEventListener('click', async () => {
            console.log('Start button clicked');
            if (window.automateStash && window.automateStash.startAutomation) {
                try {
                    await window.automateStash.startAutomation();
                } catch (error) {
                    console.error('Error starting automation:', error);
                    showNotification(`Error: ${error.message}`, 'error');
                }
            } else {
                console.error('AutomateStash not initialized properly');
                showNotification('AutomateStash not initialized', 'error');
            }
        });
        
        // Settings button
        const settingsBtn = this.panel.querySelector('#settings-button');
        settingsBtn?.addEventListener('click', () => this.showSettings());
        
        // Cancel button
        const cancelBtn = this.panel.querySelector('#cancel-button button');
        cancelBtn?.addEventListener('click', () => {
            console.log('Cancel button clicked');
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

    async showSettings() {
        // Create settings dialog
        if (this.settingsDialog) {
            this.settingsDialog.remove();
        }
        
        this.settingsDialog = createElement('div', {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            maxHeight: '80vh',
            overflowY: 'auto',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
            color: '#ffffff',
            padding: '24px',
            zIndex: '10002'
        });
        
        // Build settings content
        const settingsHTML = `
            <h3 style="margin: 0 0 20px 0; font-size: 24px;">⚙️ Automation Settings</h3>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px; color: #64b5f6;">Scraping Options</h4>
                ${await this.createToggle('Auto-scrape StashDB', CONFIG.AUTO_SCRAPE_STASHDB)}
                ${await this.createToggle('Auto-scrape ThePornDB', CONFIG.AUTO_SCRAPE_THEPORNDB)}
                ${await this.createToggle('Skip already scraped scenes', CONFIG.SKIP_ALREADY_SCRAPED)}
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px; color: #64b5f6;">Automation Options</h4>
                ${await this.createToggle('Auto-create new performers/studios/tags', CONFIG.AUTO_CREATE_PERFORMERS)}
                ${await this.createToggle('Auto-organize scenes', CONFIG.AUTO_ORGANIZE)}
                ${await this.createToggle('Auto-apply changes (no confirmation)', CONFIG.AUTO_APPLY_CHANGES)}
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px; color: #64b5f6;">UI Options</h4>
                ${await this.createToggle('Show notifications', CONFIG.SHOW_NOTIFICATIONS)}
                ${await this.createToggle('Minimize when complete', CONFIG.MINIMIZE_WHEN_COMPLETE)}
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px; color: #64b5f6;">Advanced Options</h4>
                ${await this.createToggle('Enable cross-scene intelligence (GraphQL)', CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE)}
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-top: 30px;">
                <button id="reset-settings" style="
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s;
                ">🔄 Reset to Defaults</button>
                
                <button id="close-settings" style="
                    background: linear-gradient(135deg, #00c853, #00a846);
                    border: none;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s;
                ">✅ Done</button>
            </div>
        `;
        
        this.settingsDialog.innerHTML = settingsHTML;
        document.body.appendChild(this.settingsDialog);
        
        // Add event listeners
        this.settingsDialog.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                const configKey = e.target.dataset.config;
                await setConfig(configKey, e.target.checked);
                showNotification(`Setting updated: ${e.target.checked ? 'Enabled' : 'Disabled'}`, 'success');
            });
        });
        
        this.settingsDialog.querySelector('#reset-settings').addEventListener('click', async () => {
            if (confirm('Reset all settings to defaults?')) {
                for (const [key, value] of Object.entries(DEFAULTS)) {
                    await setConfig(key, value);
                }
                showNotification('Settings reset to defaults', 'info');
                this.settingsDialog.remove();
                this.showSettings(); // Reload dialog
            }
        });
        
        this.settingsDialog.querySelector('#close-settings').addEventListener('click', () => {
            this.settingsDialog.remove();
            this.settingsDialog = null;
        });
    }
    
    async createToggle(label, configKey) {
        const checked = await getConfig(configKey);
        return `
            <label style="
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                cursor: pointer;
                padding: 8px;
                border-radius: 8px;
                transition: background 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <input type="checkbox" 
                    data-config="${configKey}"
                    ${checked ? 'checked' : ''} 
                    style="
                        width: 20px;
                        height: 20px;
                        margin-right: 12px;
                        cursor: pointer;
                    ">
                <span style="font-size: 14px;">${label}</span>
            </label>
        `;
    }
}

// Status Tracker class
class StatusTracker {
    async getSceneStatus(scene) {
        if (!scene) return '<div>⏳ Loading scene information...</div>';
        
        let status = '<div style="font-size: 14px;">';
        
        // Title
        status += `<div style="margin-bottom: 10px;">
            <strong>📽️ Scene:</strong> ${scene.title || 'Untitled'}
        </div>`;
        
        // Organization status
        status += `<div style="margin-bottom: 8px;">
            ${scene.organized ? '✅' : '❌'} <strong>Organized:</strong> ${scene.organized ? 'Yes' : 'No'}
        </div>`;
        
        // Metadata completeness
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
        
        // Source detection
        const sources = await this.detectSources(scene);
        status += '<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1);">';
        status += '<strong>🔍 Detected Sources:</strong><br>';
        status += `${sources.stashdb ? '✅' : '❌'} StashDB<br>`;
        status += `${sources.theporndb ? '✅' : '❌'} ThePornDB`;
        status += '</div>';
        
        status += '</div>';
        
        return status;
    }

    async detectSources(scene) {
        const sources = {
            stashdb: false,
            theporndb: false
        };
        
        // Check stash_ids
        if (scene.stash_ids && scene.stash_ids.length > 0) {
            scene.stash_ids.forEach(id => {
                if (id.endpoint.includes('stashdb')) {
                    sources.stashdb = true;
                } else if (id.endpoint.includes('theporndb')) {
                    sources.theporndb = true;
                }
            });
        }
        
        return sources;
    }
}

// History Manager class
class HistoryManager {
    async recordAutomation(data) {
        try {
            const history = await this.getHistory();
            history.push(data);
            
            // Keep only last 100 entries
            if (history.length > 100) {
                history.splice(0, history.length - 100);
            }
            
            await chrome.storage.local.set({ automationHistory: history });
        } catch (error) {
            console.error('Failed to record automation history:', error);
        }
    }

    async getHistory() {
        try {
            const result = await chrome.storage.local.get('automationHistory');
            return result.automationHistory || [];
        } catch (error) {
            console.error('Failed to get automation history:', error);
            return [];
        }
    }
}

// Source Detector class
class SourceDetector {
    constructor() {
        this.cache = new Map();
    }

    async detectCurrentSources() {
        const sources = {
            stashdb: { detected: false, confidence: 0 },
            theporndb: { detected: false, confidence: 0 }
        };
        
        // Try GraphQL detection first (most accurate)
        if (await getConfig(CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE)) {
            try {
                const sceneId = getSceneIdFromUrl();
                if (sceneId) {
                    const scene = await graphqlClient.findScene(sceneId);
                    if (scene && scene.stash_ids) {
                        // Check for StashDB IDs
                        const hasStashDB = scene.stash_ids.some(id => 
                            id.endpoint && id.endpoint.includes('stashdb')
                        );
                        if (hasStashDB) {
                            sources.stashdb = { detected: true, confidence: 100 };
                        }
                        
                        // Check for ThePornDB IDs
                        const hasThePornDB = scene.stash_ids.some(id => 
                            id.endpoint && (
                                id.endpoint.includes('theporndb') ||
                                id.endpoint.includes('metadataapi.net') ||
                                id.endpoint.includes('tpdb')
                            )
                        );
                        if (hasThePornDB) {
                            sources.theporndb = { detected: true, confidence: 100 };
                        }
                    }
                }
            } catch (error) {
                console.warn('GraphQL source detection failed:', error);
            }
        }
        
        // Fallback to DOM detection if GraphQL didn't find sources
        if (!sources.stashdb.detected || !sources.theporndb.detected) {
            const domSources = await this.detectFromDOM();
            if (!sources.stashdb.detected && domSources.stashdb) {
                sources.stashdb = { detected: true, confidence: 80 };
            }
            if (!sources.theporndb.detected && domSources.theporndb) {
                sources.theporndb = { detected: true, confidence: 80 };
            }
        }
        
        return sources;
    }
    
    async detectFromDOM() {
        const sources = {
            stashdb: false,
            theporndb: false
        };
        
        // Look for scraped data indicators in the DOM
        const metadataInputs = document.querySelectorAll('input[type="text"], input[type="url"], textarea');
        
        for (const input of metadataInputs) {
            const value = input.value || '';
            if (!value.trim()) continue;
            
            // Check for StashDB patterns
            if (value.includes('stashdb.org') || /stashdb[_-]?id/i.test(value)) {
                sources.stashdb = true;
            }
            
            // Check for ThePornDB patterns
            if (value.includes('theporndb.net') || 
                value.includes('metadataapi.net') ||
                /theporndb[_-]?id/i.test(value) ||
                /tpdb[_-]?id/i.test(value)) {
                sources.theporndb = true;
            }
        }
        
        return sources;
    }
}

// Create and export singleton instance
export const automateStash = new AutomateStash();

// Add cleanup method
automateStash.cleanup = function() {
    if (this.uiManager) {
        if (this.uiManager.panel) {
            this.uiManager.panel.remove();
        }
        if (this.uiManager.minimizedButton) {
            this.uiManager.minimizedButton.remove();
        }
        if (this.uiManager.settingsDialog) {
            this.uiManager.settingsDialog.remove();
        }
    }
    this.initialized = false;
};

// Make it globally available for the UI event handlers
window.automateStash = automateStash;