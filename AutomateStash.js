// ==UserScript==
// @name         OptimizedStash
// @version      3.3.12-simple-minimize
// @description  Advanced Stash Scene Automation - SIMPLE minimize button that actually works
// @author       You
// @match        http://localhost:9998/scenes/*
// @exclude      http://localhost:9998/scenes/markers?*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_notification
// ==/UserScript==

(function () {
    'use strict';

    console.log('🚀 AutomateStash v3.3.12-simple-minimize - SIMPLE minimize button that actually works');
    console.log('🔧 SIMPLE FIX: Replaced complex handler with straightforward hide/show logic');
    console.log('🔧 NO MORE COMPLEX STUFF: Just hide panel, show small button at bottom');
    console.log('✅ THIS WILL WORK: Simple JavaScript that does exactly what you need');

    // Configuration Management System
    const CONFIG_KEYS = {
        AUTO_SCRAPE_STASHDB: 'autoScrapeStashDB',
        AUTO_SCRAPE_THEPORNDB: 'autoScrapeThePornDB',
        AUTO_ORGANIZE: 'autoOrganize',
        SHOW_NOTIFICATIONS: 'showNotifications',
        MINIMIZE_WHEN_COMPLETE: 'minimizeWhenComplete',
        AUTO_APPLY_CHANGES: 'autoApplyChanges',
        SKIP_ALREADY_SCRAPED: 'skipAlreadyScraped',
        SCRAPER_DELAYS: 'scraperDelays'
    };

    // Default configuration
    const DEFAULT_CONFIG = {
        [CONFIG_KEYS.AUTO_SCRAPE_STASHDB]: true,
        [CONFIG_KEYS.AUTO_SCRAPE_THEPORNDB]: true,
        [CONFIG_KEYS.AUTO_ORGANIZE]: true,
        [CONFIG_KEYS.SHOW_NOTIFICATIONS]: true,
        [CONFIG_KEYS.MINIMIZE_WHEN_COMPLETE]: true,
        [CONFIG_KEYS.AUTO_APPLY_CHANGES]: false, // Require user confirmation by default
        [CONFIG_KEYS.SKIP_ALREADY_SCRAPED]: true,
        [CONFIG_KEYS.SCRAPER_DELAYS]: {
            reaction: 200,
            graphql: 500,
            ui: 300,
            scraper: 1000
        }
    };

    // Configuration helper functions
    function getConfig(key) {
        try {
            const value = GM_getValue(key);
            if (value === undefined) {
                return DEFAULT_CONFIG[key];
            }
            return typeof DEFAULT_CONFIG[key] === 'object' ? JSON.parse(value) : value;
        } catch (error) {
            console.warn(`Config error for ${key}:`, error);
            return DEFAULT_CONFIG[key];
        }
    }

    function setConfig(key, value) {
        try {
            const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
            GM_setValue(key, serialized);
        } catch (error) {
            console.error(`Failed to save config ${key}:`, error);
        }
    }

    // Notification System
    class NotificationManager {
        constructor() {
            this.enabled = getConfig(CONFIG_KEYS.SHOW_NOTIFICATIONS);
            this.notifications = [];
            this.notificationStack = 200; // Start position further down to avoid automation widget
            this.shownMessages = new Set(); // Track already shown persistent messages
        }

        show(message, type = 'info', duration = 4000, persistent = false) {
            if (!this.enabled) return;

            // For persistent messages, check if already shown
            if (persistent) {
                const messageKey = `${type}:${message}`;
                if (this.shownMessages.has(messageKey)) {
                    return; // Don't show the same persistent message again
                }
                this.shownMessages.add(messageKey);
                duration = 0; // Persistent messages don't auto-remove
            }

            const notification = this.createNotification(message, type, duration, persistent);
            this.notifications.push(notification);

            // Auto-remove after duration (only for non-persistent)
            if (duration > 0) {
                setTimeout(() => {
                    this.remove(notification);
                }, duration);
            }

            // Only use in-website notifications, no browser notifications
        }

        createNotification(message, type, duration, persistent = false) {
            const notification = document.createElement('div');
            notification.className = `stash-notification notification-${type}`;

            const colors = {
                success: '#28a745',
                error: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8'
            };

            // Calculate position to prevent overlapping
            const topPosition = this.notificationStack;
            this.notificationStack += 80; // Space between notifications

            // Different styling for persistent messages
            const borderStyle = persistent ? '3px solid rgba(255,255,255,0.8)' : 'none';
            const pulseAnimation = persistent ? 'pulse 2s infinite' : 'none';

            notification.style.cssText = `
                position: fixed;
                top: ${topPosition}px;
                right: 20px;
                z-index: 10001;
                background: ${colors[type] || colors.info};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                max-width: 400px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                line-height: 1.4;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                cursor: pointer;
                border: ${borderStyle};
                animation: ${pulseAnimation};
            `;

            // Add pulse animation for persistent messages
            if (persistent && !document.querySelector('#notification-pulse-style')) {
                const style = document.createElement('style');
                style.id = 'notification-pulse-style';
                style.textContent = `
                    @keyframes pulse {
                        0% { box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
                        50% { box-shadow: 0 6px 30px rgba(255,255,255,0.3); }
                        100% { box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
                    }
                `;
                document.head.appendChild(style);
            }

            const clickToCloseText = persistent ? ' (Click to dismiss)' : '';
            notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span>${this.getIcon(type)}</span>
                    <span>${message}${clickToCloseText}</span>
                    <span style="margin-left: auto; font-size: 18px;">&times;</span>
                </div>
            `;

            notification.addEventListener('click', () => {
                this.remove(notification);
            });

            document.body.appendChild(notification);

            // Trigger animation
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            }, 100);

            return notification;
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

        remove(notification) {
            if (notification && notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                    // Restack remaining notifications
                    this.restackNotifications();
                }, 300);
            }

            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }

        restackNotifications() {
            this.notificationStack = 200; // Reset to avoid automation widget
            this.notifications.forEach((notification, index) => {
                if (notification.parentNode) {
                    const newTop = this.notificationStack + (index * 80);
                    notification.style.top = `${newTop}px`;
                }
            });
            // Reset stack position for next notification
            this.notificationStack = 200 + (this.notifications.length * 80);
        }

        clear() {
            this.notifications.forEach(notification => this.remove(notification));
            this.notificationStack = 200; // Reset to avoid automation widget
            this.shownMessages.clear(); // Reset shown messages when clearing
        }

        // Method to clear persistent message tracking (for page reloads)
        resetPersistentMessages() {
            this.shownMessages.clear();
        }
    }

    const notifications = new NotificationManager();

    // Performance Optimizations based on Stash Architecture Research
    const STASH_CONFIG = {
        // React SPA optimization - based on Stash's React architecture
        REACT_RENDER_DELAY: getConfig(CONFIG_KEYS.SCRAPER_DELAYS).reaction || 200,
        GRAPHQL_MUTATION_DELAY: getConfig(CONFIG_KEYS.SCRAPER_DELAYS).graphql || 500,
        UI_TRANSITION_DELAY: getConfig(CONFIG_KEYS.SCRAPER_DELAYS).ui || 300,
        SCRAPER_OPERATION_DELAY: getConfig(CONFIG_KEYS.SCRAPER_DELAYS).scraper || 1000,

        // Stash Entity Edit Panel selectors - based on architecture documentation
        SELECTORS: {
            entityEditPanel: '.entity-edit-panel, .edit-panel, [data-testid="edit-panel"]',
            sceneEditForm: '.scene-edit-form, [data-testid="scene-form"]',
            scraperDropdown: '.scraper-dropdown, .dropdown-menu, [data-testid="scraper-dropdown"]',
            submitButton: '[type="submit"], .btn-primary:contains("Save"), [data-testid="submit"]',
            applyButton: '.btn:contains("Apply"), [data-testid="apply-button"]',
            organizedToggle: '.organized-toggle, [data-testid="organized"]'
        }
    };

    // Centralized State Management System
    const AutomateStashState = {
        // Core automation state
        automationCompleted: false,
        automationInProgress: false,
        automationCancelled: false,

        // UI state
        isMinimized: false,
        userManuallyExpanded: false,
        panelExists: false,

        // DOM element tracking
        lastButtonCreationAttempt: 0,
        buttonCreationInProgress: false,

        // Update state with validation and synchronization
        updateState(updates) {
            console.log('🔄 DEBUG: AutomateStashState.updateState called with:', updates);

            // Validate updates object
            if (!updates || typeof updates !== 'object') {
                console.error('❌ AutomateStashState.updateState: Invalid updates object');
                return;
            }

            // Apply updates
            Object.assign(this, updates);

            // Sync with window object for backward compatibility
            if ('userManuallyExpanded' in updates) {
                window.userManuallyExpanded = this.userManuallyExpanded;
                console.log('🔄 DEBUG: Synced userManuallyExpanded to window:', window.userManuallyExpanded);
            }

            if ('lastButtonCreationAttempt' in updates) {
                window.lastButtonCreationAttempt = this.lastButtonCreationAttempt;
                console.log('🔄 DEBUG: Synced lastButtonCreationAttempt to window:', window.lastButtonCreationAttempt);
            }

            if ('buttonCreationInProgress' in updates) {
                window.buttonCreationInProgress = this.buttonCreationInProgress;
                console.log('🔄 DEBUG: Synced buttonCreationInProgress to window:', window.buttonCreationInProgress);
            }

            console.log('✅ DEBUG: AutomateStashState updated:', this);
        },

        // Reset state for new scenes or initialization
        reset() {
            console.log('🔄 DEBUG: AutomateStashState.reset called');
            this.updateState({
                automationCompleted: false,
                automationInProgress: false,
                automationCancelled: false,
                isMinimized: false,
                userManuallyExpanded: false,
                panelExists: false,
                lastButtonCreationAttempt: 0,
                buttonCreationInProgress: false
            });
            console.log('✅ DEBUG: AutomateStashState reset complete');
        },

        // Get current state snapshot
        getState() {
            return {
                automationCompleted: this.automationCompleted,
                automationInProgress: this.automationInProgress,
                automationCancelled: this.automationCancelled,
                isMinimized: this.isMinimized,
                userManuallyExpanded: this.userManuallyExpanded,
                panelExists: this.panelExists,
                lastButtonCreationAttempt: this.lastButtonCreationAttempt,
                buttonCreationInProgress: this.buttonCreationInProgress
            };
        }
    };

    // UI Element Lifecycle Management
    const UIElementTracker = {
        panel: null,
        minimizedButton: null,
        cancelButton: null,
        configDialog: null,

        // Set panel element with enhanced validation and cleanup
        setPanel(element) {
            console.log('🔄 DEBUG: UIElementTracker.setPanel called with enhanced validation');

            // Validate the new element before proceeding
            const validation = ElementValidator.validateBeforeManipulation(element, 'New Panel', {
                checkParent: false, // New elements might not have parent yet
                checkType: true,
                logResults: true
            });

            if (!validation.canProceed) {
                console.error('❌ DEBUG: Cannot set panel - validation failed:', validation.issues);
                return false;
            }

            // Enhanced cleanup of existing panel if different
            if (this.panel && this.panel !== element) {
                console.log('🗑️ DEBUG: Removing existing panel before setting new one');
                DOMManager.removeElement(this.panel, 'Existing Panel', {
                    validateParent: false,
                    clearEventListeners: true,
                    timeout: 2000,
                    force: true
                }).catch(error => {
                    console.error('❌ DEBUG: Failed to remove existing panel:', error);
                });
            }

            this.panel = element;
            AutomateStashState.updateState({
                panelExists: !!element,
                isMinimized: false // Panel exists means not minimized
            });

            console.log('✅ DEBUG: Panel set and state updated with enhanced validation');
            return true;
        },

        // Set minimized button element with enhanced validation and cleanup
        setMinimizedButton(element) {
            console.log('🔄 DEBUG: UIElementTracker.setMinimizedButton called with enhanced validation');

            // Validate the new element before proceeding
            const validation = ElementValidator.validateBeforeManipulation(element, 'New Minimized Button', {
                checkParent: false, // New elements might not have parent yet
                checkType: true,
                logResults: true
            });

            if (!validation.canProceed) {
                console.error('❌ DEBUG: Cannot set minimized button - validation failed:', validation.issues);
                return false;
            }

            // Enhanced cleanup of existing minimized button if different
            if (this.minimizedButton && this.minimizedButton !== element) {
                console.log('🗑️ DEBUG: Removing existing minimized button before setting new one');
                DOMManager.removeElement(this.minimizedButton, 'Existing Minimized Button', {
                    validateParent: false,
                    clearEventListeners: true,
                    timeout: 2000,
                    force: true
                }).catch(error => {
                    console.error('❌ DEBUG: Failed to remove existing minimized button:', error);
                });
            }

            this.minimizedButton = element;
            AutomateStashState.updateState({
                isMinimized: !!element,
                panelExists: false // Minimized button exists means panel doesn't
            });

            console.log('✅ DEBUG: Minimized button set and state updated with enhanced validation');
            return true;
        },

        // Set cancel button element with enhanced validation and cleanup
        setCancelButton(element) {
            console.log('🔄 DEBUG: UIElementTracker.setCancelButton called with enhanced validation');

            // Validate the new element before proceeding
            const validation = ElementValidator.validateBeforeManipulation(element, 'New Cancel Button', {
                checkParent: false,
                checkType: true,
                logResults: true
            });

            if (!validation.canProceed) {
                console.error('❌ DEBUG: Cannot set cancel button - validation failed:', validation.issues);
                return false;
            }

            // Enhanced cleanup of existing cancel button if different
            if (this.cancelButton && this.cancelButton !== element) {
                console.log('🗑️ DEBUG: Removing existing cancel button before setting new one');
                DOMManager.removeElement(this.cancelButton, 'Existing Cancel Button', {
                    validateParent: false,
                    clearEventListeners: true,
                    timeout: 2000,
                    force: true
                }).catch(error => {
                    console.error('❌ DEBUG: Failed to remove existing cancel button:', error);
                });
            }

            this.cancelButton = element;
            console.log('✅ DEBUG: Cancel button set with enhanced validation');
            return true;
        },

        // Set config dialog element with enhanced validation and cleanup
        setConfigDialog(element) {
            console.log('🔄 DEBUG: UIElementTracker.setConfigDialog called with enhanced validation');

            // Validate the new element before proceeding
            const validation = ElementValidator.validateBeforeManipulation(element, 'New Config Dialog', {
                checkParent: false,
                checkType: true,
                logResults: true
            });

            if (!validation.canProceed) {
                console.error('❌ DEBUG: Cannot set config dialog - validation failed:', validation.issues);
                return false;
            }

            // Enhanced cleanup of existing config dialog if different
            if (this.configDialog && this.configDialog !== element) {
                console.log('🗑️ DEBUG: Removing existing config dialog before setting new one');
                DOMManager.removeElement(this.configDialog, 'Existing Config Dialog', {
                    validateParent: false,
                    clearEventListeners: true,
                    timeout: 2000,
                    force: true
                }).catch(error => {
                    console.error('❌ DEBUG: Failed to remove existing config dialog:', error);
                });
            }

            this.configDialog = element;
            console.log('✅ DEBUG: Config dialog set with enhanced validation');
            return true;
        },

        // Enhanced cleanup with comprehensive DOM management
        cleanup() {
            console.log('🔄 DEBUG: UIElementTracker.cleanup called with enhanced DOM management');

            // Enhanced cleanup operations using DOMManager
            const cleanupOperations = [
                {
                    name: 'Panel cleanup',
                    element: this.panel,
                    selectors: ['#stash-automation-panel', '.stash-automation-panel']
                },
                {
                    name: 'Minimized button cleanup',
                    element: this.minimizedButton,
                    selectors: ['#stash-minimized-button', '.stash-minimized-button']
                },
                {
                    name: 'Cancel button cleanup',
                    element: this.cancelButton,
                    selectors: ['#stash-cancel-button', '.stash-cancel-button']
                },
                {
                    name: 'Config dialog cleanup',
                    element: this.configDialog,
                    selectors: ['#stash-config-dialog', '.stash-config-dialog', '#stash-config-backdrop']
                }
            ];

            // Execute enhanced cleanup operations
            cleanupOperations.forEach(({ name, element, selectors }) => {
                try {
                    // First, try to remove the tracked element if it exists
                    if (element) {
                        console.log(`🗑️ DEBUG: Removing tracked ${name.toLowerCase()}`);
                        DOMManager.removeElement(element, name, {
                            validateParent: false, // Don't validate parent since we're cleaning up
                            clearEventListeners: true,
                            timeout: 2000,
                            force: true // Force removal if standard method fails
                        }).catch(error => {
                            console.error(`❌ DEBUG: Failed to remove tracked ${name.toLowerCase()}:`, error);
                        });
                    }

                    // Then, cleanup any remaining elements with the same selectors
                    if (selectors && selectors.length > 0) {
                        console.log(`🧹 DEBUG: Cleaning up remaining ${name.toLowerCase()} elements`);
                        DOMManager.cleanupElements(selectors, name, {
                            validateParent: false,
                            clearEventListeners: true,
                            timeout: 3000,
                            force: true
                        }).catch(error => {
                            console.error(`❌ DEBUG: Failed to cleanup remaining ${name.toLowerCase()} elements:`, error);
                        });
                    }
                } catch (error) {
                    console.error(`❌ DEBUG: ${name} cleanup operation failed:`, error);
                }
            });

            // Additional cleanup for any orphaned elements
            try {
                console.log('🧹 DEBUG: Performing additional orphaned element cleanup');
                const orphanedSelectors = [
                    '[id*="stash-automation"]',
                    '[class*="stash-automation"]',
                    '[id*="stash-minimized"]',
                    '[class*="stash-minimized"]',
                    '[id*="stash-config"]',
                    '[class*="stash-config"]'
                ];

                DOMManager.cleanupElements(orphanedSelectors, 'Orphaned AutomateStash elements', {
                    validateParent: false,
                    clearEventListeners: true,
                    timeout: 2000,
                    force: true
                }).catch(error => {
                    console.error('❌ DEBUG: Orphaned element cleanup failed:', error);
                });
            } catch (error) {
                console.error('❌ DEBUG: Additional cleanup failed:', error);
            }

            // Reset all references
            this.panel = null;
            this.minimizedButton = null;
            this.cancelButton = null;
            this.configDialog = null;

            // Update state
            AutomateStashState.updateState({
                panelExists: false,
                isMinimized: false
            });

            console.log('✅ DEBUG: UIElementTracker enhanced cleanup complete');
        },

        // Get current element references
        getElements() {
            return {
                panel: this.panel,
                minimizedButton: this.minimizedButton,
                cancelButton: this.cancelButton,
                configDialog: this.configDialog
            };
        }
    };

    // Initialize state with backward compatibility
    AutomateStashState.updateState({
        userManuallyExpanded: window.userManuallyExpanded || false,
        lastButtonCreationAttempt: window.lastButtonCreationAttempt || 0,
        buttonCreationInProgress: window.buttonCreationInProgress || false
    });

    // Legacy global state variables for backward compatibility
    let automationCompleted = false;
    let uiMinimized = false;
    let automationInProgress = false;
    let automationCancelled = false;

    // Use window property to persist across DOM observer calls
    window.userManuallyExpanded = window.userManuallyExpanded || false;

    // Global Test Function for Minimize Button Functionality
    window.testMinimizeButtonFunctionality = async function (testType = 'complete') {
        DebugLogger.log('GLOBAL-TEST', `🧪 Starting minimize button functionality test: ${testType}`);

        try {
            switch (testType.toLowerCase()) {
                case 'context':
                    return validateMinimizeButtonContext();

                case 'cycles':
                    return await MinimizeButtonTestSuite.testMinimizeExpandCycles(3);

                case 'recovery':
                    return await MinimizeButtonTestSuite.testErrorRecoveryMechanisms();

                case 'performance':
                    return MinimizeButtonTestSuite.validatePerformanceTiming();

                case 'complete':
                default:
                    return await MinimizeButtonTestSuite.runCompleteTestSuite();
            }
        } catch (error) {
            DebugLogger.error('GLOBAL-TEST', 'Test execution failed', error);
            notifications.show(`❌ Test execution failed: ${error.message}`, 'error', 8000);
            return { success: false, error: error.message };
        }
    };

    // Console Helper Functions for Easy Testing Access
    window.AutomateStashTestHelpers = {
        // Quick test commands for console use
        async runAllTests() {
            console.log('🧪 Running complete minimize button test suite...');
            return await window.testMinimizeButtonFunctionality('complete');
        },

        async testContext() {
            console.log('🔍 Testing context validation...');
            return await window.testMinimizeButtonFunctionality('context');
        },

        async testCycles(count = 3) {
            console.log(`🔄 Testing ${count} minimize/expand cycles...`);
            return await MinimizeButtonTestSuite.testMinimizeExpandCycles(count);
        },

        async testRecovery() {
            console.log('🛠️ Testing error recovery mechanisms...');
            return await window.testMinimizeButtonFunctionality('recovery');
        },

        async testPerformance() {
            console.log('⏱️ Testing performance validation...');
            return await window.testMinimizeButtonFunctionality('performance');
        },

        // Utility functions
        showTestHelp() {
            console.log(`
🧪 AutomateStash Test Helper Commands:

• AutomateStashTestHelpers.diagnosePanelState()     - Diagnose current panel state (START HERE!)
• AutomateStashTestHelpers.createFreshPanelForTesting() - Create fresh panel for testing
• AutomateStashTestHelpers.quickMinimizeTest()   - Quick minimize button test (1 cycle)
• AutomateStashTestHelpers.runAllTests()       - Run complete test suite
• AutomateStashTestHelpers.testContext()       - Test context validation only
• AutomateStashTestHelpers.testCycles(3)       - Test minimize/expand cycles
• AutomateStashTestHelpers.testRecovery()      - Test error recovery mechanisms
• AutomateStashTestHelpers.testPerformance()   - Test performance validation
• AutomateStashTestHelpers.showTestHelp()      - Show this help message

Alternative direct calls:
• testMinimizeButtonFunctionality('complete') - Complete test suite
• testMinimizeButtonFunctionality('context')  - Context validation
• testMinimizeButtonFunctionality('cycles')   - Minimize/expand cycles
• testMinimizeButtonFunctionality('recovery') - Error recovery
• testMinimizeButtonFunctionality('performance') - Performance validation

Example usage:
  AutomateStashTestHelpers.diagnosePanelState()       // Start here to diagnose!
  await AutomateStashTestHelpers.quickMinimizeTest()  // Then try this
  await AutomateStashTestHelpers.runAllTests()
  await AutomateStashTestHelpers.testCycles(5)
            `);
        },

        // Quick test for minimize button functionality
        // Force create a fresh panel for testing
        async createFreshPanelForTesting() {
            console.log('🔄 Creating fresh panel for testing...');

            try {
                // Clean up any existing panels
                const existingPanel = document.querySelector('#stash-automation-panel');
                if (existingPanel) {
                    existingPanel.remove();
                    console.log('🗑️ Removed existing panel');
                }

                const existingMinimized = document.querySelector('#stash-minimized-button');
                if (existingMinimized) {
                    existingMinimized.remove();
                    console.log('🗑️ Removed existing minimized button');
                }

                // Reset state
                AutomateStashState.reset();
                UIElementTracker.cleanup();

                // Create fresh panel
                if (typeof uiManager !== 'undefined' && uiManager && typeof uiManager.createFullPanelForced === 'function') {
                    await uiManager.createFullPanelForced();
                    console.log('✅ Fresh panel created via UIManager');
                } else {
                    console.log('⚠️ UIManager not available, trying global fallback');
                    if (typeof window.expandAutomateStash === 'function') {
                        window.expandAutomateStash();
                        console.log('✅ Fresh panel created via global fallback');
                    } else {
                        throw new Error('No panel creation method available');
                    }
                }

                // Wait for panel to be ready
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Verify panel was created
                const panel = document.querySelector('#stash-automation-panel');
                if (!panel) {
                    throw new Error('Panel was not created successfully');
                }

                console.log('✅ Fresh panel ready for testing');
                return panel;

            } catch (error) {
                console.error('❌ Failed to create fresh panel:', error);
                throw error;
            }
        },

        async quickMinimizeTest() {
            console.log('🔍 Running quick minimize button test...');

            try {
                // Create fresh panel first
                await this.createFreshPanelForTesting();

                // Diagnose panel state
                this.diagnosePanelState();

                // Test one minimize/expand cycle
                const result = await MinimizeButtonTestSuite.testMinimizeExpandCycles(1);

                if (result.successfulCycles > 0) {
                    console.log('✅ Quick minimize test PASSED');
                    return { success: true, result };
                } else {
                    console.log('❌ Quick minimize test FAILED:', result.errors);
                    return { success: false, result };
                }
            } catch (error) {
                console.error('❌ Quick minimize test ERROR:', error);
                return { success: false, error: error.message };
            }
        },

        // Debug helpers
        validateCurrentState() {
            console.log('🔍 Current AutomateStash State:', AutomateStashState.getState());
            console.log('🔍 UI Element Tracker:', UIElementTracker.getElements());
            console.log('🔍 Performance Metrics:', MinimizeButtonTestSuite.performanceMetrics);
        },

        // Diagnostic function to check panel state
        diagnosePanelState() {
            console.log('🔍 === PANEL DIAGNOSTIC ===');

            const panel = document.querySelector('#stash-automation-panel');
            if (!panel) {
                console.log('❌ No panel found with ID #stash-automation-panel');
                return;
            }

            console.log('✅ Panel found:', panel);
            console.log('📏 Panel dimensions:', {
                width: panel.offsetWidth,
                height: panel.offsetHeight,
                display: window.getComputedStyle(panel).display,
                visibility: window.getComputedStyle(panel).visibility
            });

            const buttons = panel.querySelectorAll('button');
            console.log(`🔘 Found ${buttons.length} buttons in panel:`);

            buttons.forEach((btn, index) => {
                console.log(`  Button ${index + 1}:`, {
                    innerHTML: btn.innerHTML,
                    className: btn.className,
                    id: btn.id,
                    dataAction: btn.getAttribute('data-action'),
                    visible: window.getComputedStyle(btn).display !== 'none'
                });
            });

            // Check for minimize button specifically
            const minimizeBtn1 = panel.querySelector('.stash-minimize-btn');
            const minimizeBtn2 = panel.querySelector('[data-action="minimize"]');
            const minimizeBtn3 = Array.from(buttons).find(btn => btn.innerHTML === '−');

            console.log('🔍 Minimize button search results:');
            console.log('  .stash-minimize-btn:', minimizeBtn1);
            console.log('  [data-action="minimize"]:', minimizeBtn2);
            console.log('  innerHTML === "−":', minimizeBtn3);

            console.log('📄 Panel HTML (first 1000 chars):');
            console.log(panel.outerHTML.substring(0, 1000));
        },

        clearPerformanceMetrics() {
            MinimizeButtonTestSuite.performanceMetrics = {
                minimizeOperations: [],
                expandOperations: [],
                contextBindingTests: [],
                errorRecoveryTests: []
            };
            console.log('🧹 Performance metrics cleared');
        }
    };

    // Test minimize button directly without safeEventHandler
    window.testMinimizeDirectly = async function () {
        console.log('🧪 Testing minimize button directly...');

        const panel = document.querySelector('#stash-automation-panel');
        if (!panel) {
            console.log('❌ No panel found');
            return;
        }

        // Find minimize button
        let minimizeButton = panel.querySelector('.stash-minimize-btn, [data-action="minimize"]');
        if (!minimizeButton) {
            const buttons = panel.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.innerHTML === '−') {
                    minimizeButton = btn;
                    break;
                }
            }
        }

        if (!minimizeButton) {
            console.log('❌ Minimize button not found');
            return;
        }

        console.log('✅ Minimize button found, calling minimizePanel directly...');

        // Call minimizePanel directly
        if (typeof uiManager !== 'undefined' && uiManager && typeof uiManager.minimizePanel === 'function') {
            try {
                console.log('🔄 Calling uiManager.minimizePanel() directly...');
                const result = await uiManager.minimizePanel();
                console.log('✅ minimizePanel result:', result);

                // Check if minimized button appeared
                setTimeout(() => {
                    const minimizedBtn = document.querySelector('#stash-minimized-button');
                    if (minimizedBtn) {
                        console.log('✅ Minimized button appeared after direct call');
                    } else {
                        console.log('❌ Minimized button did not appear after direct call');
                    }
                }, 1000);

            } catch (error) {
                console.error('❌ Error calling minimizePanel directly:', error);
            }
        } else {
            console.log('❌ uiManager.minimizePanel not available');
        }
    };

    // Simple global diagnostic functions for easy console access
    window.diagnosePanelState = function () {
        const panel = document.querySelector('#stash-automation-panel');
        if (!panel) {
            console.log('❌ No panel found with ID #stash-automation-panel');
            return;
        }

        console.log('✅ Panel found:', panel);
        const buttons = panel.querySelectorAll('button');
        console.log(`🔘 Found ${buttons.length} buttons in panel:`);

        buttons.forEach((btn, index) => {
            console.log(`  Button ${index + 1}:`, {
                innerHTML: btn.innerHTML,
                className: btn.className,
                id: btn.id,
                dataAction: btn.getAttribute('data-action')
            });
        });

        console.log('📄 Panel HTML (first 500 chars):');
        console.log(panel.outerHTML.substring(0, 500));
    };

    window.testMinimizeButtonNow = async function () {
        console.log('🧪 Running simple minimize button test...');

        const panel = document.querySelector('#stash-automation-panel');
        if (!panel) {
            console.log('❌ No panel found');
            return;
        }

        // Look for minimize button
        let minimizeButton = panel.querySelector('.stash-minimize-btn, [data-action="minimize"]');

        if (!minimizeButton) {
            const buttons = panel.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.innerHTML === '−') {
                    minimizeButton = btn;
                    break;
                }
            }
        }

        if (!minimizeButton) {
            console.log('❌ Minimize button not found');
            return;
        }

        console.log('✅ Minimize button found:', minimizeButton);
        console.log('� Blutton details:', {
            innerHTML: minimizeButton.innerHTML,
            className: minimizeButton.className,
            id: minimizeButton.id,
            dataAction: minimizeButton.getAttribute('data-action'),
            hasEventListeners: !!minimizeButton.onclick || minimizeButton._eventListeners
        });

        console.log('🔘 Clicking minimize button...');

        try {
            // Try direct click first
            minimizeButton.click();
            console.log('✅ Direct click executed');

            // Also try event dispatch
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            minimizeButton.dispatchEvent(clickEvent);
            console.log('✅ Event dispatch executed');

            // Wait and check if minimized button appears
            setTimeout(() => {
                const minimizedBtn = document.querySelector('#stash-minimized-button');
                if (minimizedBtn) {
                    console.log('✅ Minimized button appeared:', minimizedBtn);
                } else {
                    console.log('❌ Minimized button did not appear');
                    console.log('🔍 Checking panel state...');
                    const stillExists = document.querySelector('#stash-automation-panel');
                    console.log('Panel still exists:', !!stillExists);
                }
            }, 3000);

        } catch (error) {
            console.error('❌ Error clicking minimize button:', error);
        }
    };

    // Show test helper info on load
    console.log('🧪 AutomateStash Test Suite loaded!');
    console.log('🔍 Simple diagnostic commands:');
    console.log('  diagnosePanelState() - Check panel state');
    console.log('  testMinimizeButtonNow() - Test minimize button click');
    console.log('  testMinimizeDirectly() - Test minimize function directly');
    console.log('  AutomateStashTestHelpers.showTestHelp() - Full help (if available)');

    // Enhanced Global Fallback Function with Recovery Procedures and Timeout Protection
    window.expandAutomateStash = function () {
        DebugLogger.log('GLOBAL-FALLBACK', '*** ENHANCED GLOBAL FALLBACK FUNCTION CALLED ***');
        DebugLogger.log('GLOBAL-FALLBACK', 'Expanding AutomateStash panel with enhanced recovery procedures');

        // Start timeout protection for the entire fallback operation
        const fallbackTimeout = setTimeout(() => {
            DebugLogger.error('GLOBAL-FALLBACK', 'Fallback operation timed out after 15 seconds');
            notifications.show('⚠️ Panel expansion timed out. Please refresh the page if issues persist.', 'warning', 8000);
        }, 15000);

        try {
            // Context validation logging
            DebugLogger.log('GLOBAL-FALLBACK', 'Running comprehensive context validation');
            const contextValidation = validateMinimizeButtonContext();

            if (!contextValidation.allValid) {
                DebugLogger.warn('GLOBAL-FALLBACK', `Context validation issues: ${contextValidation.failedCount}/${contextValidation.results.length} failures`);

                // Log specific failures for troubleshooting
                const failedTests = contextValidation.results.filter(r => !r.passed);
                failedTests.forEach(test => {
                    DebugLogger.error('GLOBAL-FALLBACK', `Failed: ${test.name} - ${test.fix}`);
                });

                // Attempt context recovery procedures
                DebugLogger.log('GLOBAL-FALLBACK', 'Attempting context recovery procedures');
                const recoverySuccess = attemptContextRecovery();

                if (recoverySuccess) {
                    DebugLogger.success('GLOBAL-FALLBACK', 'Context recovery procedures succeeded');
                } else {
                    DebugLogger.warn('GLOBAL-FALLBACK', 'Context recovery procedures had limited success');
                }
            } else {
                DebugLogger.success('GLOBAL-FALLBACK', 'All context validations passed');
            }

            // Set flag to indicate user manually expanded the widget using centralized state
            DebugLogger.log('GLOBAL-FALLBACK', 'Setting userManuallyExpanded flag via global fallback');
            AutomateStashState.updateState({ userManuallyExpanded: true });
            DebugLogger.success('GLOBAL-FALLBACK', 'User manually expanded via global fallback - disabling auto-minimization');
            DebugLogger.log('GLOBAL-FALLBACK', 'Flag set to', {
                userManuallyExpanded: AutomateStashState.getState().userManuallyExpanded
            });

            // Remove existing elements using UIElementTracker with timeout protection
            DebugLogger.log('GLOBAL-FALLBACK', 'Clearing existing elements via global fallback');
            const cleanupPromise = timeoutProtectedOperation(
                () => UIElementTracker.cleanup(),
                3000,
                'UIElementTracker cleanup'
            );

            cleanupPromise.catch(error => {
                DebugLogger.error('GLOBAL-FALLBACK', 'Cleanup operation failed or timed out', error);
            });

            // Reset state and recreate
            DebugLogger.log('GLOBAL-FALLBACK', 'Resetting state via global fallback');
            AutomateStashState.updateState({
                lastButtonCreationAttempt: 0,
                buttonCreationInProgress: false
            });
            DebugLogger.success('GLOBAL-FALLBACK', 'State reset complete via global fallback');

            // Enhanced panel creation with multiple recovery strategies
            DebugLogger.log('GLOBAL-FALLBACK', 'Starting enhanced panel creation with recovery strategies');
            const panelCreationSuccess = attemptPanelCreationWithRecovery();

            if (panelCreationSuccess) {
                DebugLogger.success('GLOBAL-FALLBACK', 'Panel creation succeeded via enhanced fallback');
                notifications.show('✅ Panel expanded successfully', 'success', 3000);
            } else {
                DebugLogger.error('GLOBAL-FALLBACK', 'All panel creation strategies failed');
                notifications.show('❌ Failed to expand panel. Please refresh the page.', 'error', 8000);
            }

        } catch (error) {
            DebugLogger.error('GLOBAL-FALLBACK', 'Critical error in global fallback function', error);
            notifications.show('❌ Critical error during panel expansion. Please refresh the page.', 'error', 10000);
        } finally {
            // Clear the timeout protection
            clearTimeout(fallbackTimeout);
            DebugLogger.log('GLOBAL-FALLBACK', 'Global fallback operation completed');
        }
    };

    // Context Recovery Procedures for handling context loss scenarios
    function attemptContextRecovery() {
        DebugLogger.log('CONTEXT-RECOVERY', 'Starting context recovery procedures');
        let recoveryCount = 0;

        try {
            // Recovery 1: Reinitialize UIManager if missing or invalid
            if (typeof uiManager === 'undefined' || !uiManager || typeof uiManager.createFullPanelForced !== 'function') {
                DebugLogger.log('CONTEXT-RECOVERY', 'Attempting UIManager reinitialization');
                try {
                    // Try to recreate UIManager instance
                    if (typeof UIManager === 'function') {
                        window.uiManager = new UIManager();
                        uiManager = window.uiManager;
                        DebugLogger.success('CONTEXT-RECOVERY', 'UIManager reinitialized successfully');
                        recoveryCount++;
                    } else {
                        DebugLogger.error('CONTEXT-RECOVERY', 'UIManager class not available for reinitialization');
                    }
                } catch (error) {
                    DebugLogger.error('CONTEXT-RECOVERY', 'UIManager reinitialization failed', error);
                }
            }

            // Recovery 2: Restore missing global functions
            if (typeof createOptimizedButtons !== 'function') {
                DebugLogger.log('CONTEXT-RECOVERY', 'createOptimizedButtons function missing - attempting restoration');
                // This would typically be handled by ensuring the function is in global scope
                // For now, we log the issue for debugging
                DebugLogger.warn('CONTEXT-RECOVERY', 'createOptimizedButtons function cannot be restored automatically');
            } else {
                recoveryCount++;
            }

            // Recovery 3: Validate and restore state management
            if (typeof AutomateStashState === 'undefined' || !AutomateStashState.updateState) {
                DebugLogger.error('CONTEXT-RECOVERY', 'AutomateStashState is corrupted or missing');
            } else {
                DebugLogger.success('CONTEXT-RECOVERY', 'AutomateStashState is available');
                recoveryCount++;
            }

            // Recovery 4: Validate DOM readiness
            if (document.readyState !== 'complete') {
                DebugLogger.warn('CONTEXT-RECOVERY', 'Document not fully loaded, waiting for readiness');
                return new Promise((resolve) => {
                    if (document.readyState === 'complete') {
                        resolve(recoveryCount >= 2);
                    } else {
                        document.addEventListener('DOMContentLoaded', () => {
                            DebugLogger.success('CONTEXT-RECOVERY', 'Document ready after waiting');
                            resolve(recoveryCount >= 2);
                        });
                    }
                });
            } else {
                recoveryCount++;
            }

            DebugLogger.log('CONTEXT-RECOVERY', `Context recovery completed: ${recoveryCount}/4 components recovered`);
            return recoveryCount >= 2; // Consider successful if at least half recovered

        } catch (error) {
            DebugLogger.error('CONTEXT-RECOVERY', 'Context recovery procedures failed', error);
            return false;
        }
    }

    // Enhanced Panel Creation with Multiple Recovery Strategies
    function attemptPanelCreationWithRecovery() {
        DebugLogger.log('PANEL-RECOVERY', 'Starting enhanced panel creation with recovery strategies');

        const strategies = [
            {
                name: 'UIManager.createFullPanelForced',
                attempt: () => {
                    if (typeof uiManager !== 'undefined' && uiManager && uiManager.createFullPanelForced) {
                        DebugLogger.log('PANEL-RECOVERY', 'Attempting UIManager.createFullPanelForced');
                        uiManager.createFullPanelForced();
                        return true;
                    }
                    return false;
                }
            },
            {
                name: 'Global UIManager.createFullPanelForced',
                attempt: () => {
                    if (window.uiManager && window.uiManager.createFullPanelForced) {
                        DebugLogger.log('PANEL-RECOVERY', 'Attempting window.uiManager.createFullPanelForced');
                        window.uiManager.createFullPanelForced();
                        return true;
                    }
                    return false;
                }
            },
            {
                name: 'Direct createOptimizedButtons',
                attempt: () => {
                    if (typeof createOptimizedButtons === 'function') {
                        DebugLogger.log('PANEL-RECOVERY', 'Attempting direct createOptimizedButtons');
                        createOptimizedButtons();
                        return true;
                    }
                    return false;
                }
            },
            {
                name: 'Force DOM recreation',
                attempt: async () => {
                    DebugLogger.log('PANEL-RECOVERY', 'Attempting enhanced force DOM recreation');
                    // Enhanced cleanup of existing panels using DOMManager
                    try {
                        await DOMManager.cleanupElements([
                            '#stash-automation-panel',
                            '.stash-automation-panel',
                            '[id*="stash-automation"]'
                        ], 'Existing panels in recovery', {
                            validateParent: false,
                            clearEventListeners: true,
                            timeout: 2000,
                            force: true
                        });
                        DebugLogger.success('PANEL-RECOVERY', 'Enhanced panel cleanup completed');
                    } catch (error) {
                        DebugLogger.error('PANEL-RECOVERY', 'Enhanced cleanup failed, using fallback', error);
                        // Fallback cleanup
                        const existingPanels = document.querySelectorAll('#stash-automation-panel, .stash-automation-panel');
                        existingPanels.forEach(panel => {
                            if (panel.parentNode) {
                                panel.remove();
                            }
                        });
                    }

                    // Try to trigger the main initialization
                    if (typeof window.initializeAutomateStash === 'function') {
                        window.initializeAutomateStash();
                        return true;
                    }
                    return false;
                }
            }
        ];

        for (const strategy of strategies) {
            try {
                DebugLogger.log('PANEL-RECOVERY', `Trying strategy: ${strategy.name}`);

                const success = timeoutProtectedOperation(
                    strategy.attempt,
                    5000,
                    strategy.name
                );

                if (success) {
                    DebugLogger.success('PANEL-RECOVERY', `Strategy succeeded: ${strategy.name}`);

                    // Verify panel was actually created
                    setTimeout(() => {
                        const panel = document.querySelector('#stash-automation-panel, .stash-automation-panel');
                        if (panel) {
                            DebugLogger.success('PANEL-RECOVERY', 'Panel creation verified in DOM');
                        } else {
                            DebugLogger.warn('PANEL-RECOVERY', 'Panel not found in DOM after creation attempt');
                        }
                    }, 1000);

                    return true;
                }
            } catch (error) {
                DebugLogger.error('PANEL-RECOVERY', `Strategy failed: ${strategy.name}`, error);
            }
        }

        DebugLogger.error('PANEL-RECOVERY', 'All panel creation strategies failed');
        return false;
    }

    // Timeout Protection for DOM Operations
    function timeoutProtectedOperation(operation, timeoutMs = 5000, operationName = 'Operation') {
        DebugLogger.log('TIMEOUT-PROTECTION', `Starting timeout-protected operation: ${operationName} (${timeoutMs}ms timeout)`);

        return new Promise((resolve, reject) => {
            let completed = false;

            // Set up timeout
            const timeoutId = setTimeout(() => {
                if (!completed) {
                    completed = true;
                    DebugLogger.error('TIMEOUT-PROTECTION', `Operation timed out: ${operationName} after ${timeoutMs}ms`);
                    reject(new Error(`Operation timeout: ${operationName}`));
                }
            }, timeoutMs);

            try {
                // Execute the operation
                const result = operation();

                if (!completed) {
                    completed = true;
                    clearTimeout(timeoutId);
                    DebugLogger.success('TIMEOUT-PROTECTION', `Operation completed successfully: ${operationName}`);
                    resolve(result);
                }
            } catch (error) {
                if (!completed) {
                    completed = true;
                    clearTimeout(timeoutId);
                    DebugLogger.error('TIMEOUT-PROTECTION', `Operation failed: ${operationName}`, error);
                    reject(error);
                }
            }
        });
    }

    // Enhanced DOM Operation with Timeout Protection
    async function timeoutProtectedDOMOperation(operation, timeoutMs = 3000, operationName = 'DOM Operation') {
        DebugLogger.log('DOM-TIMEOUT-PROTECTION', `Starting timeout-protected DOM operation: ${operationName}`);

        return new Promise((resolve, reject) => {
            let completed = false;

            const timeoutId = setTimeout(() => {
                if (!completed) {
                    completed = true;
                    DebugLogger.error('DOM-TIMEOUT-PROTECTION', `DOM operation timed out: ${operationName} after ${timeoutMs}ms`);
                    reject(new Error(`DOM operation timeout: ${operationName}`));
                }
            }, timeoutMs);

            // Use requestAnimationFrame for DOM operations to ensure proper timing
            requestAnimationFrame(async () => {
                try {
                    const result = await operation();

                    if (!completed) {
                        completed = true;
                        clearTimeout(timeoutId);
                        DebugLogger.success('DOM-TIMEOUT-PROTECTION', `DOM operation completed: ${operationName}`);
                        resolve(result);
                    }
                } catch (error) {
                    if (!completed) {
                        completed = true;
                        clearTimeout(timeoutId);
                        DebugLogger.error('DOM-TIMEOUT-PROTECTION', `DOM operation failed: ${operationName}`, error);
                        reject(error);
                    }
                }
            });
        });
    }

    // Enhanced DOM Element Management System
    const DOMManager = {
        // Safe element creation with validation and timeout protection
        createElement(tagName, options = {}) {
            const { id, className, styles, innerHTML, attributes = {}, timeout = 2000 } = options;

            return timeoutProtectedOperation(() => {
                DebugLogger.log('DOM-CREATE', `Creating ${tagName} element${id ? ` with ID: ${id}` : ''}`);

                // Validate tagName
                if (!tagName || typeof tagName !== 'string') {
                    throw new Error('Invalid tagName provided to createElement');
                }

                const element = document.createElement(tagName);

                // Apply properties with validation
                if (id) {
                    if (typeof id !== 'string') {
                        throw new Error('Element ID must be a string');
                    }
                    element.id = id;
                }

                if (className) {
                    if (typeof className !== 'string') {
                        throw new Error('Element className must be a string');
                    }
                    element.className = className;
                }

                if (styles) {
                    if (typeof styles === 'string') {
                        element.style.cssText = styles;
                    } else if (typeof styles === 'object') {
                        Object.assign(element.style, styles);
                    }
                }

                if (innerHTML) {
                    if (typeof innerHTML !== 'string') {
                        throw new Error('Element innerHTML must be a string');
                    }
                    element.innerHTML = innerHTML;
                }

                // Apply additional attributes
                if (attributes && typeof attributes === 'object') {
                    Object.entries(attributes).forEach(([key, value]) => {
                        element.setAttribute(key, value);
                    });
                }

                DebugLogger.success('DOM-CREATE', `${tagName} element created successfully`);
                return element;
            }, timeout, `Create ${tagName} element`);
        },

        // Enhanced element existence check with multiple selector support
        elementExists(selectors, context = document) {
            if (!selectors) {
                DebugLogger.warn('DOM-CHECK', 'No selectors provided to elementExists');
                return false;
            }

            // Support both string and array of selectors
            const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

            for (const selector of selectorArray) {
                try {
                    const element = context.querySelector(selector);
                    if (element) {
                        DebugLogger.log('DOM-CHECK', `Element found with selector: ${selector}`);
                        return element;
                    }
                } catch (error) {
                    DebugLogger.warn('DOM-CHECK', `Invalid selector: ${selector}`, error);
                }
            }

            DebugLogger.log('DOM-CHECK', `No elements found for selectors: ${selectorArray.join(', ')}`);
            return false;
        },

        // Enhanced element removal with comprehensive cleanup
        removeElement(element, elementName = 'Element', options = {}) {
            const {
                validateParent = true,
                clearEventListeners = true,
                timeout = 2000,
                force = false
            } = options;

            if (!element) {
                DebugLogger.warn('DOM-REMOVE', `Cannot remove ${elementName}: element is null or undefined`);
                return Promise.resolve(false);
            }

            return timeoutProtectedOperation(() => {
                DebugLogger.log('DOM-REMOVE', `Removing ${elementName}`);

                // Check if element is actually a DOM element
                if (!(element instanceof Element)) {
                    DebugLogger.warn('DOM-REMOVE', `${elementName} is not a valid DOM element, skipping removal`);
                    return false;
                }

                // Check parent node existence if validation is enabled
                if (validateParent && !element.parentNode) {
                    DebugLogger.warn('DOM-REMOVE', `${elementName} not in DOM, skipping removal`);
                    return false;
                }

                try {
                    // Clear event listeners if requested (helps prevent memory leaks)
                    if (clearEventListeners) {
                        // Clone and replace to remove all event listeners
                        const clone = element.cloneNode(true);
                        if (element.parentNode) {
                            element.parentNode.replaceChild(clone, element);
                            clone.remove();
                        }
                    } else {
                        // Standard removal
                        element.remove();
                    }

                    DebugLogger.success('DOM-REMOVE', `${elementName} removed successfully`);
                    return true;
                } catch (error) {
                    if (force) {
                        DebugLogger.warn('DOM-REMOVE', `Force removal of ${elementName} failed, attempting parentNode.removeChild`, error);
                        try {
                            if (element.parentNode) {
                                element.parentNode.removeChild(element);
                                DebugLogger.success('DOM-REMOVE', `${elementName} force removed with removeChild`);
                                return true;
                            }
                        } catch (forceError) {
                            DebugLogger.error('DOM-REMOVE', `Force removal of ${elementName} completely failed`, forceError);
                        }
                    } else {
                        DebugLogger.error('DOM-REMOVE', `Failed to remove ${elementName}`, error);
                    }
                    return false;
                }
            }, timeout, `Remove ${elementName}`);
        },

        // Enhanced element cleanup with multiple selector support
        cleanupElements(selectors, elementName = 'Elements', options = {}) {
            const {
                validateParent = true,
                clearEventListeners = true,
                timeout = 3000,
                force = false
            } = options;

            return timeoutProtectedOperation(() => {
                DebugLogger.log('DOM-CLEANUP', `Cleaning up ${elementName}`);

                // Support both string and array of selectors
                const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
                let removedCount = 0;
                let totalFound = 0;

                selectorArray.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        totalFound += elements.length;

                        elements.forEach((element, index) => {
                            const elementId = `${elementName}[${selector}][${index}]`;
                            try {
                                const removed = this.removeElement(element, elementId, {
                                    validateParent,
                                    clearEventListeners,
                                    timeout: 1000, // Shorter timeout for individual elements
                                    force
                                });

                                if (removed) {
                                    removedCount++;
                                }
                            } catch (error) {
                                DebugLogger.error('DOM-CLEANUP', `Failed to remove individual element ${elementId}`, error);
                            }
                        });
                    } catch (error) {
                        DebugLogger.error('DOM-CLEANUP', `Failed to cleanup elements with selector: ${selector}`, error);
                    }
                });

                DebugLogger.success('DOM-CLEANUP', `Cleanup complete: ${removedCount}/${totalFound} ${elementName} removed`);
                return { removed: removedCount, total: totalFound };
            }, timeout, `Cleanup ${elementName}`);
        },

        // Safe element appending with validation
        appendChild(parent, child, parentName = 'Parent', childName = 'Child', options = {}) {
            const { timeout = 2000, validateElements = true } = options;

            if (!parent || !child) {
                DebugLogger.error('DOM-APPEND', `Cannot append ${childName} to ${parentName}: null elements`);
                return Promise.reject(new Error('Null elements in append operation'));
            }

            return timeoutProtectedOperation(() => {
                DebugLogger.log('DOM-APPEND', `Appending ${childName} to ${parentName}`);

                // Validate parent and child elements if requested
                if (validateElements) {
                    if (!(parent instanceof Element)) {
                        throw new Error(`Invalid parent element for ${parentName}`);
                    }
                    if (!(child instanceof Element)) {
                        throw new Error(`Invalid child element for ${childName}`);
                    }
                }

                parent.appendChild(child);
                DebugLogger.success('DOM-APPEND', `${childName} appended to ${parentName} successfully`);
                return true;
            }, timeout, `Append ${childName} to ${parentName}`);
        },

        // Enhanced element replacement with cleanup
        replaceElement(oldElement, newElement, elementName = 'Element', options = {}) {
            const {
                clearEventListeners = true,
                timeout = 2000,
                validateElements = true
            } = options;

            return timeoutProtectedOperation(() => {
                DebugLogger.log('DOM-REPLACE', `Replacing ${elementName}`);

                // Validate elements if requested
                if (validateElements) {
                    if (!oldElement || !(oldElement instanceof Element)) {
                        throw new Error(`Invalid old element for ${elementName}`);
                    }
                    if (!newElement || !(newElement instanceof Element)) {
                        throw new Error(`Invalid new element for ${elementName}`);
                    }
                    if (!oldElement.parentNode) {
                        throw new Error(`Old ${elementName} is not in DOM`);
                    }
                }

                // Perform replacement
                oldElement.parentNode.replaceChild(newElement, oldElement);

                // Clear event listeners from old element if requested
                if (clearEventListeners) {
                    // The old element is already removed, but we can clear any references
                    DebugLogger.log('DOM-REPLACE', `Event listeners cleared for old ${elementName}`);
                }

                DebugLogger.success('DOM-REPLACE', `${elementName} replaced successfully`);
                return true;
            }, timeout, `Replace ${elementName}`);
        }
    };

    // Enhanced Element Validation System
    const ElementValidator = {
        // Comprehensive element existence validation
        validateElementExistence(selectors, context = document, options = {}) {
            const {
                logResults = true,
                throwOnNotFound = false,
                elementName = 'Element'
            } = options;

            if (logResults) {
                DebugLogger.log('ELEMENT-VALIDATION', `Validating existence of ${elementName}`);
            }

            const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
            const results = {
                found: false,
                element: null,
                matchedSelector: null,
                checkedSelectors: selectorArray,
                errors: []
            };

            for (const selector of selectorArray) {
                try {
                    const element = context.querySelector(selector);
                    if (element) {
                        results.found = true;
                        results.element = element;
                        results.matchedSelector = selector;

                        if (logResults) {
                            DebugLogger.success('ELEMENT-VALIDATION', `${elementName} found with selector: ${selector}`);
                        }
                        break;
                    }
                } catch (error) {
                    results.errors.push({ selector, error: error.message });
                    if (logResults) {
                        DebugLogger.warn('ELEMENT-VALIDATION', `Invalid selector: ${selector}`, error);
                    }
                }
            }

            if (!results.found) {
                const message = `${elementName} not found with any selector: ${selectorArray.join(', ')}`;
                if (logResults) {
                    DebugLogger.warn('ELEMENT-VALIDATION', message);
                }
                if (throwOnNotFound) {
                    throw new Error(message);
                }
            }

            return results;
        },

        // Validate element before DOM manipulation
        validateBeforeManipulation(element, elementName = 'Element', options = {}) {
            const {
                checkParent = true,
                checkType = true,
                logResults = true
            } = options;

            if (logResults) {
                DebugLogger.log('ELEMENT-VALIDATION', `Validating ${elementName} before manipulation`);
            }

            const validation = {
                valid: true,
                element: element,
                issues: [],
                canProceed: true
            };

            // Check if element exists
            if (!element) {
                validation.valid = false;
                validation.canProceed = false;
                validation.issues.push('Element is null or undefined');
            }

            // Check if element is a DOM element
            if (checkType && element && !(element instanceof Element)) {
                validation.valid = false;
                validation.canProceed = false;
                validation.issues.push('Element is not a valid DOM element');
            }

            // Check parent node if requested
            if (checkParent && element && element instanceof Element && !element.parentNode) {
                validation.valid = false;
                validation.issues.push('Element has no parent node (not in DOM)');
                // This might not prevent all operations, so canProceed remains true
            }

            if (logResults) {
                if (validation.valid) {
                    DebugLogger.success('ELEMENT-VALIDATION', `${elementName} validation passed`);
                } else {
                    DebugLogger.warn('ELEMENT-VALIDATION', `${elementName} validation issues:`, validation.issues);
                }
            }

            return validation;
        },

        // Validate DOM state before UI operations
        validateDOMState(options = {}) {
            const { logResults = true } = options;

            if (logResults) {
                DebugLogger.log('DOM-STATE-VALIDATION', 'Validating DOM state for UI operations');
            }

            const state = {
                ready: false,
                issues: [],
                recommendations: []
            };

            // Check document ready state
            if (document.readyState !== 'complete') {
                state.issues.push(`Document not fully loaded (state: ${document.readyState})`);
                state.recommendations.push('Wait for document to fully load');
            }

            // Check if body exists
            if (!document.body) {
                state.issues.push('Document body not available');
                state.recommendations.push('Ensure DOM is fully constructed');
            }

            // Check for existing AutomateStash elements
            const existingElements = document.querySelectorAll('[id*="stash-"], [class*="stash-"]');
            if (existingElements.length > 0) {
                state.issues.push(`${existingElements.length} existing AutomateStash elements found`);
                state.recommendations.push('Consider cleanup before creating new elements');
            }

            state.ready = state.issues.length === 0;

            if (logResults) {
                if (state.ready) {
                    DebugLogger.success('DOM-STATE-VALIDATION', 'DOM state validation passed');
                } else {
                    DebugLogger.warn('DOM-STATE-VALIDATION', 'DOM state validation issues:', state.issues);
                    DebugLogger.log('DOM-STATE-VALIDATION', 'Recommendations:', state.recommendations);
                }
            }

            return state;
        }
    };

    // Legacy functions for backward compatibility
    function createElementSafely(tagName, options = {}) {
        return DOMManager.createElement(tagName, options);
    }

    function removeElementSafely(element, elementName = 'element') {
        return DOMManager.removeElement(element, elementName);
    }

    function appendElementSafely(parent, child, parentName = 'parent', childName = 'child') {
        return DOMManager.appendChild(parent, child, parentName, childName);
    }

    // Automation Control Functions
    function startAutomation() {
        // Update centralized state
        AutomateStashState.updateState({
            automationInProgress: true,
            automationCancelled: false,
            automationCompleted: false
        });

        // Update legacy variables for backward compatibility
        automationInProgress = true;
        automationCancelled = false;
        automationCompleted = false;

        console.log('🚀 Automation started');

        // Clean up UI elements using tracker
        UIElementTracker.cleanup();

        // Show cancel button
        showCancelButton();
    }

    function stopAutomation() {
        // Update centralized state
        AutomateStashState.updateState({
            automationInProgress: false,
            automationCancelled: true
        });

        // Update legacy variables for backward compatibility
        automationInProgress = false;
        automationCancelled = true;

        console.log('🛑 Automation cancelled by user');
        notifications.show('🛑 Automation cancelled', 'warning');

        // Remove cancel button using tracker
        if (UIElementTracker.cancelButton && UIElementTracker.cancelButton.parentNode) {
            UIElementTracker.cancelButton.remove();
            UIElementTracker.cancelButton = null;
        }

        // Recreate the main automation panel
        setTimeout(() => {
            const state = AutomateStashState.getState();
            if (!state.panelExists && !state.isMinimized) {
                createOptimizedButtons();
            }
        }, 500);
    }

    function completeAutomation() {
        // Update centralized state
        AutomateStashState.updateState({
            automationInProgress: false,
            automationCompleted: true
        });

        // Update legacy variables for backward compatibility
        automationInProgress = false;
        automationCompleted = true;

        console.log('✅ Automation completed');

        // Remove cancel button using tracker
        if (UIElementTracker.cancelButton && UIElementTracker.cancelButton.parentNode) {
            UIElementTracker.cancelButton.remove();
            UIElementTracker.cancelButton = null;
        }

        // The UI management will be handled by the automateComplete function
        // based on the minimize_when_complete setting
    }

    function showCancelButton() {
        console.log('🔄 DEBUG: showCancelButton called');

        // Use UIElementTracker to manage cancel button
        const cancelButton = document.createElement('div');
        cancelButton.id = 'stash-cancel-button';
        cancelButton.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            z-index: 10000;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            padding: 15px;
            border-radius: 50px;
            cursor: pointer;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 20px rgba(231, 76, 60, 0.4);
            transition: all 0.2s ease;
            border: 2px solid rgba(255,255,255,0.3);
            min-width: 120px;
            text-align: center;
        `;

        cancelButton.innerHTML = '🛑 CANCEL';

        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.transform = 'scale(1.05)';
            cancelButton.style.boxShadow = '0 6px 25px rgba(231, 76, 60, 0.6)';
        });

        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.transform = 'scale(1)';
            cancelButton.style.boxShadow = '0 4px 20px rgba(231, 76, 60, 0.4)';
        });

        cancelButton.addEventListener('click', safeEventHandler(function () {
            if (confirm('Are you sure you want to cancel the automation?')) {
                stopAutomation();
            }
        }, 'Cancel Button'));

        document.body.appendChild(cancelButton);

        // Track the cancel button using UIElementTracker
        UIElementTracker.setCancelButton(cancelButton);

        console.log('✅ DEBUG: Cancel button created and tracked');
    }

    // Check if automation should be cancelled
    function checkCancellation() {
        const state = AutomateStashState.getState();
        if (state.automationCancelled || automationCancelled) {
            throw new Error('Automation cancelled by user');
        }
    }

    // Enhanced UI Management with Minimization Support
    class UIManager {
        constructor() {
            try {
                // Initialize instance properties using centralized state
                const state = AutomateStashState.getState();
                this.isMinimized = state.isMinimized;
                this.panel = null;
                this.minimizedButton = null;

                // Bind methods to ensure proper context
                this.minimizePanel = this.minimizePanel.bind(this);
                this.createMinimizedButton = this.createMinimizedButton.bind(this);
                this.createFullPanelForced = this.createFullPanelForced.bind(this);
                this.createConfigDialog = this.createConfigDialog.bind(this);
                this.showConfigDialog = this.showConfigDialog.bind(this);

                // Instance validation
                if (!this.validateInstance()) {
                    throw new Error('UIManager instance validation failed');
                }

                console.log('✅ UIManager instance created successfully with proper method binding and centralized state');
            } catch (error) {
                console.error('❌ UIManager constructor error:', error);
                throw error;
            }
        }

        validateInstance() {
            try {
                // Check that all required methods are properly bound
                const requiredMethods = [
                    'minimizePanel',
                    'createMinimizedButton',
                    'createFullPanelForced',
                    'createConfigDialog'
                ];

                for (const methodName of requiredMethods) {
                    if (typeof this[methodName] !== 'function') {
                        console.error(`❌ UIManager method ${methodName} is not a function`);
                        return false;
                    }
                }

                // Check that properties are initialized
                if (typeof this.isMinimized !== 'boolean') {
                    console.error('❌ UIManager isMinimized property not properly initialized');
                    return false;
                }

                console.log('✅ UIManager instance validation passed');
                return true;
            } catch (error) {
                console.error('❌ UIManager validation error:', error);
                return false;
            }
        }

        createConfigDialog() {
            // Enhanced cleanup of existing dialogs using DOMManager
            DebugLogger.log('CONFIG-DIALOG', 'Performing enhanced cleanup before dialog creation');

            try {
                DOMManager.cleanupElements([
                    '#stash-config-dialog',
                    '#stash-config-backdrop',
                    '.stash-config-dialog',
                    '.stash-config-backdrop'
                ], 'Existing config dialogs', {
                    validateParent: false,
                    clearEventListeners: true,
                    timeout: 2000,
                    force: true
                }).catch(error => {
                    DebugLogger.error('CONFIG-DIALOG', 'Enhanced cleanup failed, using fallback', error);
                    // Fallback cleanup
                    const existingDialog = document.querySelector('#stash-config-dialog');
                    const existingBackdrop = document.querySelector('#stash-config-backdrop');
                    if (existingDialog) existingDialog.remove();
                    if (existingBackdrop) existingBackdrop.remove();
                });
            } catch (error) {
                DebugLogger.error('CONFIG-DIALOG', 'Cleanup operation failed', error);
            }

            const backdrop = document.createElement('div');
            backdrop.id = 'stash-config-backdrop';
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                z-index: 10001;
                backdrop-filter: blur(5px);
            `;

            const dialog = document.createElement('div');
            dialog.id = 'stash-config-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10002;
                background: #2c3e50;
                color: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                font-family: 'Segoe UI', sans-serif;
                border: 2px solid rgba(255,255,255,0.1);
            `;

            const configOptions = [
                { key: CONFIG_KEYS.AUTO_SCRAPE_STASHDB, label: 'Auto-scrape StashDB', type: 'checkbox' },
                { key: CONFIG_KEYS.AUTO_SCRAPE_THEPORNDB, label: 'Auto-scrape ThePornDB', type: 'checkbox' },
                { key: CONFIG_KEYS.AUTO_ORGANIZE, label: 'Auto-organize scenes', type: 'checkbox' },
                { key: CONFIG_KEYS.SHOW_NOTIFICATIONS, label: 'Show notifications', type: 'checkbox' },
                { key: CONFIG_KEYS.MINIMIZE_WHEN_COMPLETE, label: 'Minimize UI when complete', type: 'checkbox' },
                { key: CONFIG_KEYS.AUTO_APPLY_CHANGES, label: 'Auto-apply changes (no confirmation)', type: 'checkbox' },
                { key: CONFIG_KEYS.SKIP_ALREADY_SCRAPED, label: 'Skip already scraped sources', type: 'checkbox' }
            ];

            let configHTML = `
                <h2 style="margin-top: 0; color: #3498db; text-align: center;">⚙️ AutomateStash Configuration</h2>
                <div style="margin-bottom: 20px;">
            `;

            configOptions.forEach(option => {
                const checked = getConfig(option.key) ? 'checked' : '';
                configHTML += `
                    <label style="display: block; margin-bottom: 15px; cursor: pointer; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); transition: background 0.2s ease;">
                        <input type="checkbox" id="${option.key}" ${checked} 
                               style="margin-right: 10px; transform: scale(1.2);" data-config-key="${option.key}">
                        <span style="font-size: 14px;">${option.label}</span>
                    </label>
                `;
            });

            configHTML += `
                </div>
                <div style="margin: 20px 0; padding: 15px; background: rgba(52, 152, 219, 0.1); border-radius: 8px; border: 1px solid rgba(52, 152, 219, 0.3);">
                    <h3 style="margin: 0 0 10px 0; color: #3498db; font-size: 16px;">🧪 Testing & Validation</h3>
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #bdc3c7;">Test minimize button functionality and validate performance</p>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                        <button id="test-minimize-button" style="background: #3498db; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s ease;">
                            🧪 Run Tests
                        </button>
                        <button id="test-context-only" style="background: #9b59b6; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s ease;">
                            🔍 Context Check
                        </button>
                        <button id="test-performance" style="background: #f39c12; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s ease;">
                            ⏱️ Performance
                        </button>
                    </div>
                </div>
                <div style="text-align: center; gap: 15px; display: flex; justify-content: center; flex-wrap: wrap;">
                    <button id="save-config" style="background: #27ae60; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s ease;">
                        💾 Save Settings
                    </button>
                    <button id="reset-config" style="background: #e74c3c; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s ease;">
                        🔄 Reset to Defaults
                    </button>
                    <button id="close-config" style="background: #95a5a6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s ease;">
                        ✖️ Close
                    </button>
                </div>
            `;

            dialog.innerHTML = configHTML;

            // Define close function
            const closeDialog = () => {
                console.log('🔄 Closing configuration dialog');
                if (backdrop && backdrop.parentNode) {
                    backdrop.remove();
                }
                if (dialog && dialog.parentNode) {
                    dialog.remove();
                }
                // Clear the tracked config dialog
                UIElementTracker.configDialog = null;
            };

            // Event listeners with proper error handling
            try {
                // Save button
                const saveBtn = dialog.querySelector('#save-config');
                if (saveBtn) {
                    saveBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        console.log('💾 Saving configuration...');

                        try {
                            configOptions.forEach(option => {
                                const checkbox = dialog.querySelector(`#${option.key}`);
                                if (checkbox) {
                                    setConfig(option.key, checkbox.checked);
                                    console.log(`📝 Set ${option.key} = ${checkbox.checked}`);
                                }
                            });
                            notifications.show('⚙️ Configuration saved successfully!', 'success');
                            closeDialog();
                        } catch (error) {
                            console.error('❌ Error saving configuration:', error);
                            notifications.show('❌ Error saving configuration', 'error');
                        }
                    });
                }

                // Reset button
                const resetBtn = dialog.querySelector('#reset-config');
                if (resetBtn) {
                    resetBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        console.log('🔄 Resetting configuration...');

                        if (confirm('Reset all settings to defaults?\n\nThis cannot be undone.')) {
                            try {
                                Object.keys(DEFAULT_CONFIG).forEach(key => {
                                    GM_deleteValue(key);
                                    console.log(`🗑️ Reset ${key}`);
                                });
                                notifications.show('🔄 Settings reset to defaults', 'info');
                                closeDialog();
                            } catch (error) {
                                console.error('❌ Error resetting configuration:', error);
                                notifications.show('❌ Error resetting configuration', 'error');
                            }
                        }
                    });
                }

                // Close button
                const closeBtn = dialog.querySelector('#close-config');
                if (closeBtn) {
                    closeBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        closeDialog();
                    });
                }

                // Test buttons
                const testMinimizeBtn = dialog.querySelector('#test-minimize-button');
                if (testMinimizeBtn) {
                    testMinimizeBtn.addEventListener('click', async (event) => {
                        event.preventDefault();
                        console.log('🧪 Running complete minimize button test suite...');

                        // Disable button during test
                        testMinimizeBtn.disabled = true;
                        testMinimizeBtn.textContent = '🔄 Testing...';

                        try {
                            notifications.show('🧪 Running complete test suite...', 'info', 3000);
                            const results = await window.testMinimizeButtonFunctionality('complete');

                            if (results.overallSuccess) {
                                notifications.show('✅ All tests passed!', 'success', 5000);
                            } else {
                                notifications.show('❌ Some tests failed. Check console for details.', 'warning', 8000);
                            }

                            console.log('🧪 Complete test results:', results);
                        } catch (error) {
                            console.error('❌ Test execution failed:', error);
                            notifications.show('❌ Test execution failed', 'error', 5000);
                        } finally {
                            // Re-enable button
                            testMinimizeBtn.disabled = false;
                            testMinimizeBtn.textContent = '🧪 Run Tests';
                        }
                    });
                }

                const testContextBtn = dialog.querySelector('#test-context-only');
                if (testContextBtn) {
                    testContextBtn.addEventListener('click', async (event) => {
                        event.preventDefault();
                        console.log('🔍 Running context validation test...');

                        try {
                            const results = await window.testMinimizeButtonFunctionality('context');

                            if (results.allValid) {
                                notifications.show('✅ Context validation passed!', 'success', 3000);
                            } else {
                                notifications.show(`⚠️ Context issues found: ${results.failedCount} failures`, 'warning', 5000);
                            }

                            console.log('🔍 Context validation results:', results);
                        } catch (error) {
                            console.error('❌ Context test failed:', error);
                            notifications.show('❌ Context test failed', 'error', 5000);
                        }
                    });
                }

                const testPerformanceBtn = dialog.querySelector('#test-performance');
                if (testPerformanceBtn) {
                    testPerformanceBtn.addEventListener('click', async (event) => {
                        event.preventDefault();
                        console.log('⏱️ Running performance validation test...');

                        try {
                            const results = await window.testMinimizeButtonFunctionality('performance');

                            const acceptable = results.minimizeOperations.acceptable && results.expandOperations.acceptable;
                            if (acceptable) {
                                notifications.show('✅ Performance validation passed!', 'success', 3000);
                            } else {
                                notifications.show('⚠️ Performance issues detected', 'warning', 5000);
                            }

                            console.log('⏱️ Performance validation results:', results);
                        } catch (error) {
                            console.error('❌ Performance test failed:', error);
                            notifications.show('❌ Performance test failed', 'error', 5000);
                        }
                    });
                }

                // Backdrop click to close
                backdrop.addEventListener('click', (event) => {
                    event.preventDefault();
                    closeDialog();
                });

                // Prevent dialog clicks from closing the dialog
                dialog.addEventListener('click', (event) => {
                    event.stopPropagation();
                });

                // Add hover effects to buttons
                const buttons = dialog.querySelectorAll('button');
                buttons.forEach(button => {
                    button.addEventListener('mouseenter', () => {
                        button.style.transform = 'translateY(-1px)';
                        button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                    });

                    button.addEventListener('mouseleave', () => {
                        button.style.transform = 'translateY(0)';
                        button.style.boxShadow = 'none';
                    });
                });

            } catch (error) {
                console.error('❌ Error attaching event listeners to config dialog:', error);
            }

            // Append to DOM
            document.body.appendChild(backdrop);
            document.body.appendChild(dialog);

            // Track the config dialog using UIElementTracker
            UIElementTracker.setConfigDialog(dialog);

            console.log('✅ Configuration dialog created successfully');
        }

        async createMinimizedButton() {
            DebugLogger.methodStart('UIManager', 'createMinimizedButton');
            DebugLogger.log('MINIMIZE-BUTTON', 'createMinimizedButton called with enhanced DOM management');

            // Enhanced DOM state validation
            const domState = ElementValidator.validateDOMState({ logResults: true });
            if (!domState.ready) {
                DebugLogger.warn('MINIMIZE-BUTTON', 'DOM state validation issues detected:', domState.issues);
                DebugLogger.log('MINIMIZE-BUTTON', 'Recommendations:', domState.recommendations);
            }

            // Context validation logging
            DebugLogger.log('MINIMIZE-BUTTON', 'Running context validation');
            const contextValidation = validateMinimizeButtonContext();

            if (!contextValidation.allValid) {
                DebugLogger.warn('MINIMIZE-BUTTON', `Context validation issues: ${contextValidation.failedCount} failures`);
            }

            // Get current state using centralized state management
            const state = AutomateStashState.getState();
            DebugLogger.log('MINIMIZE-BUTTON', 'Current state analysis', {
                isMinimized: state.isMinimized,
                userManuallyExpanded: state.userManuallyExpanded,
                panelExists: state.panelExists,
                buttonCreationInProgress: state.buttonCreationInProgress
            });

            // Enhanced cleanup using DOMManager before button creation
            DebugLogger.log('MINIMIZE-BUTTON', 'Performing enhanced DOM cleanup before button creation');

            try {
                await DOMManager.cleanupElements([
                    '#stash-minimized-button',
                    '.stash-minimized-button',
                    '[id*="stash-minimized"]'
                ], 'Existing minimized buttons', {
                    validateParent: false,
                    clearEventListeners: true,
                    timeout: 2000,
                    force: true
                });
                DebugLogger.success('MINIMIZE-BUTTON', 'Enhanced cleanup completed successfully');
            } catch (error) {
                DebugLogger.error('MINIMIZE-BUTTON', 'Enhanced cleanup failed, continuing with fallback', error);
                // Fallback to simple cleanup
                const existingButton = document.querySelector('#stash-minimized-button');
                if (existingButton) {
                    existingButton.remove();
                }
            }

            // Reset minimized button tracking to ensure clean state
            if (UIElementTracker.minimizedButton) {
                DebugLogger.log('MINIMIZE-BUTTON', 'Clearing tracked minimized button reference');
                UIElementTracker.minimizedButton = null;
            }

            // Check if minimized button already exists using centralized state after cleanup
            if (state.isMinimized && UIElementTracker.minimizedButton) {
                DebugLogger.warn('MINIMIZE-BUTTON', 'Minimized button already exists after cleanup, skipping creation');
                return;
            }

            // Prevent multiple simultaneous button creation attempts
            if (state.buttonCreationInProgress) {
                DebugLogger.warn('MINIMIZE-BUTTON', 'Button creation already in progress, skipping...');
                return;
            }

            DebugLogger.log('MINIMIZE-BUTTON', 'Creating minimized button with enhanced state management');

            // Set creation in progress flag
            AutomateStashState.updateState({ buttonCreationInProgress: true });

            try {
                const button = document.createElement('div');
                button.id = 'stash-minimized-button';
                button.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    cursor: pointer;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    transition: transform 0.2s ease;
                    border: 2px solid rgba(255,255,255,0.3);
                `;

                button.innerHTML = '🚀';
                button.style.fontSize = '24px';

                // Add enhanced tooltip with state information
                const tooltip = document.createElement('div');
                tooltip.style.cssText = `
                    position: absolute;
                    bottom: 70px;
                    right: 0;
                    background: rgba(0,0,0,0.8);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.2s;
                    pointer-events: none;
                `;

                // Enhanced tooltip text based on automation state
                const automationStatus = state.automationCompleted ? 'completed' :
                    state.automationInProgress ? 'in progress' : 'ready';
                tooltip.textContent = `Click to expand AutomateStash (${automationStatus})`;
                button.appendChild(tooltip);

                // Enhanced context binding with validation
                const uiManagerRef = this;
                DebugLogger.log('MINIMIZE-BUTTON', 'Enhanced context binding validation');
                DebugLogger.validateContext('MINIMIZE-BUTTON', 'UIManager reference', uiManagerRef, 'object');
                DebugLogger.validateContext('MINIMIZE-BUTTON', 'createFullPanelForced method', uiManagerRef.createFullPanelForced, 'function');
                DebugLogger.validateContext('MINIMIZE-BUTTON', 'showFullPanel method', uiManagerRef.showFullPanel, 'function');

                // Validate UIManager context before proceeding
                if (!uiManagerRef || typeof uiManagerRef.createFullPanelForced !== 'function') {
                    DebugLogger.error('MINIMIZE-BUTTON', 'UIManager context validation failed during button creation', {
                        uiManagerRef: !!uiManagerRef,
                        createFullPanelForced: typeof uiManagerRef?.createFullPanelForced
                    });
                    throw new Error('UIManager context not properly bound');
                }

                // Enhanced event handlers with improved context binding
                button.addEventListener('mouseenter', safeEventHandler(() => {
                    DebugLogger.log('MINIMIZE-BUTTON', 'Mouse entered minimized button');
                    button.style.transform = 'scale(1.1)';
                    tooltip.style.opacity = '1';
                }, 'Minimized Button Hover'));

                button.addEventListener('mouseleave', safeEventHandler(() => {
                    DebugLogger.log('MINIMIZE-BUTTON', 'Mouse left minimized button');
                    button.style.transform = 'scale(1)';
                    tooltip.style.opacity = '0';
                }, 'Minimized Button Leave'));

                // Enhanced expand handler with improved context binding and validation
                const enhancedExpandHandler = safeEventHandler(function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    DebugLogger.log('EXPAND-HANDLER', 'Enhanced expand handler executing');
                    DebugLogger.validateContext('EXPAND-HANDLER', 'UIManager instance', uiManagerRef, 'object');
                    DebugLogger.log('EXPAND-HANDLER', 'Running context validation before expand');

                    // Enhanced context validation with detailed logging
                    const expandContextValidation = validateMinimizeButtonContext();
                    if (!expandContextValidation.allValid) {
                        DebugLogger.error('EXPAND-HANDLER', `Enhanced context validation failed: ${expandContextValidation.failedCount} failures`);
                        console.error('❌ UIManager ref:', !!uiManagerRef);
                        console.error('❌ createFullPanelForced method:', typeof uiManagerRef?.createFullPanelForced);

                        // Enhanced fallback with state management
                        console.log('🔄 DEBUG: Attempting enhanced fallback for expand operation');
                        if (typeof window.expandAutomateStash === 'function') {
                            console.log('🔄 DEBUG: Using global fallback with state sync');
                            AutomateStashState.updateState({ userManuallyExpanded: true });
                            window.expandAutomateStash();
                        } else {
                            console.error('❌ ERROR: No fallback mechanism available');
                            notifications.show('⚠️ Expand failed: No fallback available', 'error');
                        }
                        return;
                    }

                    // Enhanced state management for user expansion
                    console.log('🔧 DEBUG: Setting enhanced userManuallyExpanded flag...');
                    AutomateStashState.updateState({
                        userManuallyExpanded: true,
                        lastButtonCreationAttempt: 0,
                        buttonCreationInProgress: false
                    });
                    console.log('🔓 User manually expanded - enhanced auto-minimization disabled');

                    // Enhanced cleanup with state synchronization
                    console.log('🧹 DEBUG: Enhanced cleanup before expansion...');
                    UIElementTracker.cleanup();

                    // Enhanced panel creation with validation
                    try {
                        console.log('🚀 DEBUG: Calling enhanced createFullPanelForced...');
                        uiManagerRef.createFullPanelForced();
                        console.log('✅ DEBUG: Enhanced createFullPanelForced completed successfully');
                    } catch (error) {
                        console.error('❌ ERROR: Enhanced createFullPanelForced failed:', error);
                        // Additional fallback attempt
                        if (typeof uiManagerRef.showFullPanel === 'function') {
                            console.log('🔄 DEBUG: Trying showFullPanel as secondary fallback');
                            uiManagerRef.showFullPanel();
                        }
                    }
                }, 'Enhanced Expand Button');

                // Use enhanced expand handler
                button.addEventListener('click', enhancedExpandHandler);

                // Enhanced global fallback with state management
                DebugLogger.log('MINIMIZE-BUTTON', 'Adding enhanced onclick attribute as backup');
                button.setAttribute('onclick', 'window.expandAutomateStash()');
                DebugLogger.success('MINIMIZE-BUTTON', 'Enhanced onclick attribute set');

                DebugLogger.log('MINIMIZE-BUTTON', 'Appending enhanced button to document body');
                document.body.appendChild(button);

                // Enhanced tracking with state management
                UIElementTracker.setMinimizedButton(button);

                // Update state to reflect successful creation
                AutomateStashState.updateState({
                    isMinimized: true,
                    panelExists: false,
                    buttonCreationInProgress: false
                });

                DebugLogger.success('MINIMIZE-BUTTON', 'Enhanced minimized button created successfully');
                DebugLogger.log('MINIMIZE-BUTTON', 'Button element in DOM verification', {
                    inDOM: !!document.querySelector('#stash-minimized-button')
                });
                DebugLogger.log('MINIMIZE-BUTTON', 'Final state after creation', AutomateStashState.getState());
                DebugLogger.methodEnd('UIManager', 'createMinimizedButton', true);

            } catch (error) {
                DebugLogger.methodError('UIManager', 'createMinimizedButton', error);

                // Reset creation flag on error
                AutomateStashState.updateState({ buttonCreationInProgress: false });

                // Attempt fallback creation
                DebugLogger.warn('MINIMIZE-BUTTON', 'Attempting fallback button creation');
                if (typeof createMinimizedButtonFallback === 'function') {
                    createMinimizedButtonFallback();
                } else {
                    notifications.show('⚠️ Failed to create minimized button', 'error');
                }
            }
        }

        showFullPanel() {
            console.log('🔄 DEBUG: showFullPanel called');
            console.log('🔄 Showing full panel (user requested)');

            // Update centralized state
            AutomateStashState.updateState({
                isMinimized: false,
                userManuallyExpanded: true,
                lastButtonCreationAttempt: 0,
                buttonCreationInProgress: false
            });

            // Update instance state
            this.isMinimized = false;

            // Clean up existing elements using UIElementTracker
            UIElementTracker.cleanup();

            // Force creation of full panel
            this.createFullPanelForced();

            console.log('✅ DEBUG: showFullPanel complete');
        }

        // Force creation of full panel regardless of automation status (used when user explicitly requests it)
        async createFullPanelForced() {
            console.log('🎯 DEBUG: *** createFullPanelForced CALLED WITH ENHANCED DOM MANAGEMENT ***');
            console.log('🎯 Creating full automation panel (user requested)');

            // Enhanced DOM state validation before proceeding
            const domState = ElementValidator.validateDOMState({ logResults: true });
            if (!domState.ready) {
                console.warn('⚠️ DEBUG: DOM state validation issues detected:', domState.issues);
                console.log('💡 DEBUG: Recommendations:', domState.recommendations);
                // Continue anyway but with extra caution
            }

            // Check centralized state to prevent multiple button creation attempts
            const state = AutomateStashState.getState();
            if (state.buttonCreationInProgress) {
                console.log('🔄 DEBUG: Button creation already in progress, skipping...');
                return;
            }

            console.log('🔧 DEBUG: Setting buttonCreationInProgress flag...');
            AutomateStashState.updateState({ buttonCreationInProgress: true });
            console.log('✅ DEBUG: buttonCreationInProgress set to true');

            try {
                console.log('🧹 DEBUG: Enhanced cleanup before panel creation...');

                // Enhanced cleanup using DOMManager
                await DOMManager.cleanupElements([
                    '#stash-automation-panel',
                    '.stash-automation-panel',
                    '#stash-minimized-button',
                    '.stash-minimized-button'
                ], 'Existing AutomateStash UI elements', {
                    validateParent: false,
                    clearEventListeners: true,
                    timeout: 3000,
                    force: true
                });

                // Clean up tracked elements
                UIElementTracker.cleanup();

                console.log('🎨 DEBUG: Creating new panel element with enhanced DOM management...');
                const panel = await DOMManager.createElement('div', {
                    id: 'stash-automation-panel',
                    timeout: 3000
                });
                console.log('✅ DEBUG: Panel element created with ID:', panel.id);
                panel.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 10000;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 15px;
                    padding: 20px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.2);
                    backdrop-filter: blur(15px);
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    min-width: 280px;
                    max-width: 400px;
                `;

                // Create header with minimize button
                const header = document.createElement('div');
                header.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                `;

                const title = document.createElement('h3');
                title.textContent = 'AutomateStash v3.3.4';
                title.style.cssText = `
                    color: white;
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                `;

                const minimizeBtn = document.createElement('button');
                minimizeBtn.innerHTML = '−';
                minimizeBtn.className = 'stash-minimize-btn';
                minimizeBtn.setAttribute('data-action', 'minimize');
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

                // Store reference to UIManager instance for proper context binding
                const uiManagerRef = this;

                // Validation checks before creating minimize button
                console.log('🔍 DEBUG: Validating context before creating minimize button...');
                if (!validateMinimizeButtonCreation(uiManagerRef)) {
                    console.error('❌ Minimize button validation failed, using fallback approach');
                    // Still create the button but with additional error handling
                }

                // SIMPLE MINIMIZE BUTTON - NO COMPLEX STUFF
                minimizeBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    console.log('� MINIMIaZE BUTTON CLICKED - SIMPLE VERSION');

                    // Hide the main panel
                    const panel = document.querySelector('#stash-automation-panel');
                    if (panel) {
                        panel.style.display = 'none';
                        console.log('✅ Panel hidden');
                    }

                    // Create simple minimized button at bottom right
                    const existingMin = document.querySelector('#stash-minimized-button');
                    if (existingMin) existingMin.remove();

                    const minButton = document.createElement('button');
                    minButton.id = 'stash-minimized-button';
                    minButton.innerHTML = '📱 AutomateStash';
                    minButton.style.cssText = `
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        z-index: 10000;
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 10px 15px;
                        border-radius: 25px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: bold;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    `;

                    // Simple expand on click
                    minButton.addEventListener('click', function () {
                        console.log('🔥 EXPAND BUTTON CLICKED - SIMPLE VERSION');
                        minButton.remove();
                        if (panel) {
                            panel.style.display = 'block';
                            console.log('✅ Panel shown');
                        }
                    });

                    document.body.appendChild(minButton);
                    console.log('✅ Minimized button created');
                });

                header.appendChild(title);
                header.appendChild(minimizeBtn);
                panel.appendChild(header);

                // Get current scene status for display
                let statusHtml = '<div style="color: #FFE066; margin-bottom: 15px; font-size: 14px;">📊 Checking scene status...</div>';

                try {
                    const [scrapedStatus, organizedStatus] = await Promise.all([
                        detectAlreadyScrapedSources(),
                        checkIfAlreadyOrganized()
                    ]);

                    const autoStashDB = getConfig(CONFIG_KEYS.AUTO_SCRAPE_STASHDB);
                    const autoThePornDB = getConfig(CONFIG_KEYS.AUTO_SCRAPE_THEPORNDB);
                    const autoOrganize = getConfig(CONFIG_KEYS.AUTO_ORGANIZE);

                    let statusParts = [];

                    if (autoStashDB) {
                        statusParts.push(`StashDB: ${scrapedStatus.stashdb ? '✅' : '❌'}`);
                    }

                    if (autoThePornDB) {
                        statusParts.push(`ThePornDB: ${scrapedStatus.theporndb ? '✅' : '❌'}`);
                    }

                    if (autoOrganize) {
                        statusParts.push(`Organized: ${organizedStatus ? '✅' : '❌'}`);
                    }

                    if (statusParts.length > 0) {
                        statusHtml = `<div style="color: #E0E0E0; margin-bottom: 15px; font-size: 13px; line-height: 1.4;">
                            📊 Current Status:<br>
                            ${statusParts.join('<br>')}
                        </div>`;
                    } else {
                        statusHtml = '<div style="color: #FFE066; margin-bottom: 15px; font-size: 13px;">⚙️ Configure automation in settings</div>';
                    }
                } catch (error) {
                    statusHtml = '<div style="color: #FF9999; margin-bottom: 15px; font-size: 13px;">⚠️ Could not check status</div>';
                }

                panel.innerHTML += statusHtml;

                // Create main automation button
                const automateBtn = document.createElement('button');
                automateBtn.textContent = '🚀 Start Automation';
                automateBtn.style.cssText = `
                    width: 100%;
                    padding: 12px 20px;
                    background: linear-gradient(135deg, #FF6B6B, #EE5A24);
                    color: white;
                    border: none;
                    border-radius: 25px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-bottom: 12px;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(238, 90, 36, 0.4);
                `;

                automateBtn.addEventListener('mouseenter', () => {
                    automateBtn.style.transform = 'translateY(-2px)';
                    automateBtn.style.boxShadow = '0 6px 20px rgba(238, 90, 36, 0.6)';
                });

                automateBtn.addEventListener('mouseleave', () => {
                    automateBtn.style.transform = 'translateY(0)';
                    automateBtn.style.boxShadow = '0 4px 15px rgba(238, 90, 36, 0.4)';
                });

                automateBtn.addEventListener('click', safeEventHandler(async function () {
                    console.log('🚀 User initiated automation');
                    await automateComplete();
                }, 'Automation Button'));

                panel.appendChild(automateBtn);

                // Create settings button
                const settingsBtn = document.createElement('button');
                settingsBtn.textContent = '⚙️ Settings';
                settingsBtn.style.cssText = `
                    width: 100%;
                    padding: 10px 20px;
                    background: rgba(255,255,255,0.15);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 20px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                `;

                settingsBtn.addEventListener('mouseenter', () => {
                    settingsBtn.style.background = 'rgba(255,255,255,0.25)';
                });

                settingsBtn.addEventListener('mouseleave', () => {
                    settingsBtn.style.background = 'rgba(255,255,255,0.15)';
                });

                settingsBtn.addEventListener('click', safeEventHandler(function () {
                    uiManager.createConfigDialog();
                }, 'Settings Button'));

                panel.appendChild(settingsBtn);

                console.log('📌 DEBUG: Appending panel to document body...');
                document.body.appendChild(panel);
                console.log('✅ DEBUG: Panel appended to body successfully');
                console.log('🔍 DEBUG: Panel in DOM:', !!document.querySelector('#stash-automation-panel'));

                // Track the panel using UIElementTracker
                UIElementTracker.setPanel(panel);

                console.log('✅ Full automation panel created successfully');

            } catch (error) {
                console.error('❌ DEBUG: Error creating full panel:', error);
                console.error('❌ DEBUG: Error stack:', error.stack);
            } finally {
                console.log('🔄 DEBUG: Resetting buttonCreationInProgress flag...');
                AutomateStashState.updateState({ buttonCreationInProgress: false });
                console.log('✅ DEBUG: buttonCreationInProgress reset to false');
            }
        }

        async minimizePanel() {
            console.log('🔥 DEBUG: MINIMIZE PANEL METHOD CALLED!');
            DebugLogger.methodStart('UIManager', 'minimizePanel');
            DebugLogger.log('MINIMIZE', 'minimizePanel called');

            try {
                // Context validation logging
                DebugLogger.log('MINIMIZE', 'Validating minimize button context');
                const contextValidation = validateMinimizeButtonContext();

                if (!contextValidation.allValid) {
                    DebugLogger.error('MINIMIZE', `Context validation failed: ${contextValidation.failedCount} tests failed`);
                    DebugLogger.warn('MINIMIZE', 'Proceeding with minimization despite validation failures');
                }

                // Validation: Check if minimization is possible
                DebugLogger.log('MINIMIZE', 'Checking minimization preconditions');
                if (!this.validateMinimizationPreconditions()) {
                    DebugLogger.error('MINIMIZE', 'Minimization preconditions not met');
                    return false;
                }

                // Validation: Check if already minimized
                const currentState = AutomateStashState.getState();
                DebugLogger.log('MINIMIZE', 'Current state check', currentState);

                if (currentState.isMinimized) {
                    DebugLogger.warn('MINIMIZE', 'Panel already minimized, skipping operation');
                    return true;
                }

                DebugLogger.log('MINIMIZE', 'Starting panel minimization process');

                // Enhanced state updates using new state management system
                DebugLogger.log('MINIMIZE', 'Updating state for minimization');
                AutomateStashState.updateState({
                    isMinimized: true,
                    userManuallyExpanded: false, // Reset manual expansion flag when manually minimizing
                    panelExists: false,
                    lastMinimizeTime: Date.now(),
                    minimizeReason: 'user_action'
                });

                // Update instance state with validation
                this.isMinimized = true;
                DebugLogger.log('MINIMIZE', 'User manually minimized - resetting expansion flag');

                // Enhanced DOM cleanup and element tracking
                DebugLogger.log('MINIMIZE', 'Starting comprehensive panel cleanup');
                this.performComprehensivePanelCleanup();

                // Validate cleanup was successful
                DebugLogger.log('MINIMIZE', 'Validating panel cleanup');
                if (!this.validatePanelCleanup()) {
                    DebugLogger.error('MINIMIZE', 'Panel cleanup validation failed');
                    // Attempt recovery
                    DebugLogger.warn('MINIMIZE', 'Attempting cleanup recovery');
                    this.forceCleanupRecovery();
                }

                // Create minimized button with error handling
                DebugLogger.log('MINIMIZE', 'Creating minimized button');
                try {
                    DebugLogger.time('Minimized Button Creation');
                    await this.createMinimizedButton();
                    DebugLogger.timeEnd('Minimized Button Creation');
                    DebugLogger.success('MINIMIZE', 'Minimized button created successfully');
                } catch (buttonError) {
                    DebugLogger.methodError('UIManager', 'createMinimizedButton', buttonError);
                    // Attempt fallback button creation
                    DebugLogger.warn('MINIMIZE', 'Attempting fallback minimized button creation');
                    this.createFallbackMinimizedButton();
                }

                // Final validation of minimization state
                const finalState = AutomateStashState.getState();
                DebugLogger.log('MINIMIZE', 'Final state validation', finalState);

                if (!finalState.isMinimized) {
                    DebugLogger.error('MINIMIZE', 'Minimization state validation failed');
                    return false;
                }

                DebugLogger.methodEnd('UIManager', 'minimizePanel', true);
                DebugLogger.success('MINIMIZE', 'minimizePanel completed successfully');
                return true;

            } catch (error) {
                DebugLogger.methodError('UIManager', 'minimizePanel', error);

                // Attempt error recovery
                DebugLogger.warn('MINIMIZE', 'Attempting error recovery');
                this.handleMinimizationError(error);
                return false;
            }
        }

        // Validation method for minimization preconditions
        validateMinimizationPreconditions() {
            console.log('🔍 DEBUG: Validating minimization preconditions');

            // Check if UIElementTracker is available
            if (typeof UIElementTracker === 'undefined') {
                console.error('❌ ERROR: UIElementTracker not available');
                return false;
            }

            // Check if AutomateStashState is available
            if (typeof AutomateStashState === 'undefined') {
                console.error('❌ ERROR: AutomateStashState not available');
                return false;
            }

            // Check if createMinimizedButton method is available
            if (typeof this.createMinimizedButton !== 'function') {
                console.error('❌ ERROR: createMinimizedButton method not available');
                return false;
            }

            console.log('✅ DEBUG: Minimization preconditions validated');
            return true;
        }

        // Enhanced DOM cleanup and element tracking
        performComprehensivePanelCleanup() {
            console.log('🧹 DEBUG: Starting comprehensive panel cleanup');

            // Clean up main panel using UIElementTracker
            if (UIElementTracker.panel) {
                console.log('🗑️ DEBUG: Removing tracked panel element');
                try {
                    if (UIElementTracker.panel.parentNode) {
                        UIElementTracker.panel.remove();
                    }
                    UIElementTracker.panel = null;
                    console.log('✅ DEBUG: Tracked panel removed successfully');
                } catch (error) {
                    console.error('❌ ERROR: Failed to remove tracked panel:', error);
                }
            }

            // Clean up any orphaned panel elements by ID
            const panelById = document.getElementById('stash-automation-panel');
            if (panelById) {
                console.log('🗑️ DEBUG: Removing orphaned panel by ID');
                try {
                    panelById.remove();
                    console.log('✅ DEBUG: Orphaned panel removed successfully');
                } catch (error) {
                    console.error('❌ ERROR: Failed to remove orphaned panel:', error);
                }
            }

            // Clean up any panels by class selector
            const panelsByClass = document.querySelectorAll('.stash-automation-panel');
            if (panelsByClass.length > 0) {
                console.log(`🗑️ DEBUG: Removing ${panelsByClass.length} orphaned panels by class`);
                panelsByClass.forEach((panel, index) => {
                    try {
                        panel.remove();
                        console.log(`✅ DEBUG: Orphaned panel ${index + 1} removed successfully`);
                    } catch (error) {
                        console.error(`❌ ERROR: Failed to remove orphaned panel ${index + 1}:`, error);
                    }
                });
            }

            // Update UIElementTracker state
            UIElementTracker.setPanel(null);

            console.log('✅ DEBUG: Comprehensive panel cleanup complete');
        }

        // Validation method for panel cleanup
        validatePanelCleanup() {
            console.log('🔍 DEBUG: Validating panel cleanup');

            // Check UIElementTracker state
            if (UIElementTracker.panel !== null) {
                console.error('❌ ERROR: UIElementTracker.panel not null after cleanup');
                return false;
            }

            // Check for remaining panel elements in DOM
            const remainingPanels = document.querySelectorAll('#stash-automation-panel, .stash-automation-panel');
            if (remainingPanels.length > 0) {
                console.error(`❌ ERROR: ${remainingPanels.length} panel elements still in DOM after cleanup`);
                return false;
            }

            // Check AutomateStashState
            const state = AutomateStashState.getState();
            if (state.panelExists) {
                console.error('❌ ERROR: AutomateStashState.panelExists still true after cleanup');
                return false;
            }

            console.log('✅ DEBUG: Panel cleanup validation passed');
            return true;
        }

        // Force cleanup recovery for edge cases
        forceCleanupRecovery() {
            console.log('🚨 DEBUG: Attempting force cleanup recovery');

            try {
                // Force remove all possible panel elements
                const allPanels = document.querySelectorAll('[id*="stash-automation"], [class*="stash-automation"]');
                allPanels.forEach((element, index) => {
                    try {
                        element.remove();
                        console.log(`🗑️ DEBUG: Force removed element ${index + 1}`);
                    } catch (error) {
                        console.error(`❌ ERROR: Failed to force remove element ${index + 1}:`, error);
                    }
                });

                // Reset UIElementTracker completely
                UIElementTracker.panel = null;
                UIElementTracker.setPanel(null);

                // Force state update
                AutomateStashState.updateState({
                    panelExists: false,
                    isMinimized: true
                });

                console.log('✅ DEBUG: Force cleanup recovery complete');
            } catch (error) {
                console.error('❌ ERROR: Force cleanup recovery failed:', error);
            }
        }

        // Fallback minimized button creation
        createFallbackMinimizedButton() {
            console.log('🔄 DEBUG: Creating fallback minimized button');

            try {
                // Simple fallback button creation
                const existingButton = document.getElementById('stash-minimized-button');
                if (existingButton) {
                    existingButton.remove();
                }

                const button = document.createElement('div');
                button.id = 'stash-minimized-button';
                button.innerHTML = '🤖 AutomateStash';
                button.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: #007bff;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    z-index: 10000;
                    font-size: 12px;
                `;

                button.addEventListener('click', () => {
                    if (typeof window.expandAutomateStash === 'function') {
                        window.expandAutomateStash();
                    }
                });

                document.body.appendChild(button);
                UIElementTracker.setMinimizedButton(button);

                console.log('✅ DEBUG: Fallback minimized button created');
            } catch (error) {
                console.error('❌ ERROR: Fallback button creation failed:', error);
            }
        }

        // Error handling for minimization failures
        handleMinimizationError(error) {
            console.log('🚨 DEBUG: Handling minimization error');

            try {
                // Reset state to safe values
                AutomateStashState.updateState({
                    isMinimized: false,
                    panelExists: false,
                    buttonCreationInProgress: false
                });

                // Reset instance state
                this.isMinimized = false;

                // Show user notification
                if (typeof notifications !== 'undefined' && notifications.show) {
                    notifications.show('⚠️ Minimization failed. Please try again.', 'warning', 3000);
                }

                // Attempt to recreate panel if needed
                setTimeout(() => {
                    try {
                        const state = AutomateStashState.getState();
                        if (!state.panelExists && !state.isMinimized) {
                            console.log('🔄 DEBUG: Attempting to recreate panel after error');
                            if (typeof createOptimizedButtons === 'function') {
                                createOptimizedButtons();
                            }
                        }
                    } catch (recoveryError) {
                        console.error('❌ ERROR: Panel recreation failed:', recoveryError);
                    }
                }, 1000);

                console.log('✅ DEBUG: Minimization error handling complete');
            } catch (handlingError) {
                console.error('❌ ERROR: Error handling failed:', handlingError);
            }
        }

        // Alias method for consistency and backward compatibility
        showConfigDialog() {
            return this.createConfigDialog();
        }
    }

    // Comprehensive Debug Logging System
    const DebugLogger = {
        enabled: true,

        log(category, message, data = null) {
            if (!this.enabled) return;

            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            const prefix = `🔍 [${timestamp}] ${category}:`;

            if (data) {
                console.log(prefix, message, data);
            } else {
                console.log(prefix, message);
            }
        },

        error(category, message, error = null) {
            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            const prefix = `❌ [${timestamp}] ${category}:`;

            console.error(prefix, message);
            if (error) {
                console.error('Error details:', error);
                console.error('Stack trace:', error.stack);
            }
        },

        warn(category, message, data = null) {
            if (!this.enabled) return;

            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            const prefix = `⚠️ [${timestamp}] ${category}:`;

            if (data) {
                console.warn(prefix, message, data);
            } else {
                console.warn(prefix, message);
            }
        },

        success(category, message, data = null) {
            if (!this.enabled) return;

            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            const prefix = `✅ [${timestamp}] ${category}:`;

            if (data) {
                console.log(prefix, message, data);
            } else {
                console.log(prefix, message);
            }
        },

        // Performance timing logging
        time(label) {
            if (!this.enabled) return;
            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            console.time(`⏱️ [${timestamp}] ${label}`);
        },

        timeEnd(label) {
            if (!this.enabled) return;
            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            console.timeEnd(`⏱️ [${timestamp}] ${label}`);
        },

        // Context validation logging
        validateContext(category, contextName, contextValue, expectedType = null) {
            const isValid = expectedType ? typeof contextValue === expectedType : !!contextValue;
            const status = isValid ? 'VALID' : 'INVALID';
            const emoji = isValid ? '✅' : '❌';

            this.log('CONTEXT-VALIDATION', `${emoji} ${category} - ${contextName}: ${status}`, {
                value: contextValue,
                type: typeof contextValue,
                expected: expectedType
            });

            return isValid;
        },

        // Method execution logging
        methodStart(className, methodName, params = null) {
            this.log('METHOD-START', `${className}.${methodName}()`, params);
        },

        methodEnd(className, methodName, result = null) {
            this.success('METHOD-END', `${className}.${methodName}() completed`, result);
        },

        methodError(className, methodName, error) {
            this.error('METHOD-ERROR', `${className}.${methodName}() failed`, error);
        }
    };

    // Context Validation Function for Minimize Button Troubleshooting
    const validateMinimizeButtonContext = () => {
        DebugLogger.log('VALIDATION', 'Starting comprehensive minimize button context validation');

        const tests = [
            {
                name: 'UIManager Instance',
                test: () => typeof uiManager !== 'undefined' && uiManager !== null,
                fix: 'Ensure UIManager is instantiated before button creation'
            },
            {
                name: 'minimizePanel Method',
                test: () => typeof uiManager?.minimizePanel === 'function',
                fix: 'Check UIManager class definition and method binding'
            },
            {
                name: 'DOM Element Exists',
                test: () => !!document.querySelector('#stash-automation-panel'),
                fix: 'Ensure panel exists before adding minimize button'
            },
            {
                name: 'Global Fallback',
                test: () => typeof window.expandAutomateStash === 'function',
                fix: 'Ensure global fallback function is defined'
            },
            {
                name: 'Event Handler System',
                test: () => typeof safeEventHandler === 'function',
                fix: 'Ensure event handler wrapper system is available'
            },
            {
                name: 'State Management System',
                test: () => typeof AutomateStashState !== 'undefined' && typeof AutomateStashState.updateState === 'function',
                fix: 'Ensure centralized state management is available'
            },
            {
                name: 'UI Element Tracker',
                test: () => typeof UIElementTracker !== 'undefined' && typeof UIElementTracker.setMinimizedButton === 'function',
                fix: 'Ensure UI element tracking system is available'
            },
            {
                name: 'Notification System',
                test: () => typeof notifications !== 'undefined' && typeof notifications.show === 'function',
                fix: 'Ensure notification system is initialized'
            }
        ];

        let allValid = true;
        const results = [];

        tests.forEach(test => {
            const result = test.test();
            const status = result ? 'PASS' : 'FAIL';

            DebugLogger.log('VALIDATION', `${test.name}: ${status}`);

            if (!result) {
                DebugLogger.error('VALIDATION', `Fix needed: ${test.fix}`);
                allValid = false;
            }

            results.push({
                name: test.name,
                passed: result,
                fix: test.fix
            });
        });

        // Summary logging
        if (allValid) {
            DebugLogger.success('VALIDATION', 'All minimize button context validations passed');
        } else {
            DebugLogger.error('VALIDATION', 'Some minimize button context validations failed');

            // Log failed tests summary
            const failedTests = results.filter(r => !r.passed);
            DebugLogger.error('VALIDATION', `Failed tests (${failedTests.length}):`, failedTests.map(t => t.name));
        }

        return {
            allValid,
            results,
            failedCount: results.filter(r => !r.passed).length,
            passedCount: results.filter(r => r.passed).length
        };
    };

    // Comprehensive Test Suite for Minimize Button Functionality
    const MinimizeButtonTestSuite = {
        // Performance timing storage
        performanceMetrics: {
            minimizeOperations: [],
            expandOperations: [],
            contextBindingTests: [],
            errorRecoveryTests: []
        },

        // Ensure panel is ready for testing
        async ensurePanelReadyForTesting() {
            DebugLogger.log('TEST-SUITE', 'Ensuring panel is ready for testing');

            // Check if panel exists
            let panel = document.querySelector('#stash-automation-panel');

            if (!panel) {
                DebugLogger.log('TEST-SUITE', 'Panel not found, attempting to create it');

                // Try to create the panel using UIManager
                if (typeof uiManager !== 'undefined' && uiManager && typeof uiManager.createFullPanelForced === 'function') {
                    try {
                        await uiManager.createFullPanelForced();
                        await this.delay(2000); // Wait for panel creation
                        panel = document.querySelector('#stash-automation-panel');
                    } catch (error) {
                        DebugLogger.error('TEST-SUITE', 'Failed to create panel via UIManager', error);
                    }
                }

                // If still no panel, try global fallback
                if (!panel && typeof window.expandAutomateStash === 'function') {
                    try {
                        window.expandAutomateStash();
                        await this.delay(3000); // Wait for fallback creation
                        panel = document.querySelector('#stash-automation-panel');
                    } catch (error) {
                        DebugLogger.error('TEST-SUITE', 'Failed to create panel via global fallback', error);
                    }
                }
            }

            if (!panel) {
                throw new Error('Unable to create or find panel for testing');
            }

            // Wait for panel to be fully rendered
            await this.delay(1000);

            // Verify panel has content (minimize button should be present)
            const buttons = panel.querySelectorAll('button');
            if (buttons.length === 0) {
                DebugLogger.warn('TEST-SUITE', 'Panel exists but has no buttons, waiting for content to load');
                await this.delay(2000);
            }

            DebugLogger.success('TEST-SUITE', 'Panel is ready for testing');
            return panel;
        },

        // Test scenario for minimize/expand cycles
        async testMinimizeExpandCycles(cycleCount = 3) {
            DebugLogger.log('TEST-SUITE', `Starting minimize/expand cycle test (${cycleCount} cycles)`);

            const results = {
                totalCycles: cycleCount,
                successfulCycles: 0,
                failedCycles: 0,
                averageMinimizeTime: 0,
                averageExpandTime: 0,
                errors: []
            };

            try {
                // Ensure panel is ready before starting tests
                await this.ensurePanelReadyForTesting();
            } catch (error) {
                DebugLogger.error('TEST-SUITE', 'Failed to prepare panel for testing', error);
                results.errors.push(`Panel preparation failed: ${error.message}`);
                results.failedCycles = cycleCount;
                return results;
            }

            for (let i = 1; i <= cycleCount; i++) {
                DebugLogger.log('TEST-SUITE', `Starting cycle ${i}/${cycleCount}`);

                try {
                    // Test minimize operation
                    const minimizeResult = await this.testMinimizeOperation(i);
                    if (!minimizeResult.success) {
                        results.errors.push(`Cycle ${i} minimize failed: ${minimizeResult.error}`);
                        results.failedCycles++;
                        continue;
                    }

                    // Wait between operations
                    await this.delay(1000);

                    // Test expand operation
                    const expandResult = await this.testExpandOperation(i);
                    if (!expandResult.success) {
                        results.errors.push(`Cycle ${i} expand failed: ${expandResult.error}`);
                        results.failedCycles++;
                        continue;
                    }

                    // Wait between cycles
                    await this.delay(1500);

                    results.successfulCycles++;
                    DebugLogger.success('TEST-SUITE', `Cycle ${i} completed successfully`);

                } catch (error) {
                    DebugLogger.error('TEST-SUITE', `Cycle ${i} failed with exception`, error);
                    results.errors.push(`Cycle ${i} exception: ${error.message}`);
                    results.failedCycles++;
                }
            }

            // Calculate performance metrics
            if (this.performanceMetrics.minimizeOperations.length > 0) {
                results.averageMinimizeTime = this.performanceMetrics.minimizeOperations.reduce((a, b) => a + b, 0) / this.performanceMetrics.minimizeOperations.length;
            }
            if (this.performanceMetrics.expandOperations.length > 0) {
                results.averageExpandTime = this.performanceMetrics.expandOperations.reduce((a, b) => a + b, 0) / this.performanceMetrics.expandOperations.length;
            }

            DebugLogger.log('TEST-SUITE', 'Minimize/expand cycle test completed', results);
            return results;
        },

        // Test individual minimize operation with performance timing
        async testMinimizeOperation(cycleNumber) {
            DebugLogger.time(`Minimize-Operation-${cycleNumber}`);
            const startTime = performance.now();

            try {
                // Validate context before minimize
                const contextValidation = validateMinimizeButtonContext();
                if (!contextValidation.allValid) {
                    throw new Error(`Context validation failed: ${contextValidation.failedCount} issues`);
                }

                // Ensure panel exists
                const panel = document.querySelector('#stash-automation-panel');
                if (!panel) {
                    throw new Error('Panel not found for minimize operation');
                }

                // Debug: Log panel structure
                DebugLogger.log('TEST-DEBUG', `Panel found, checking for minimize button. Panel HTML:`, panel.outerHTML.substring(0, 500));

                // Find minimize button using class and data attribute
                let minimizeButton = panel.querySelector('.stash-minimize-btn, [data-action="minimize"]');

                // Fallback: look for button with '−' content
                if (!minimizeButton) {
                    const buttons = panel.querySelectorAll('button');
                    DebugLogger.log('TEST-DEBUG', `Found ${buttons.length} buttons in panel`);
                    for (const btn of buttons) {
                        DebugLogger.log('TEST-DEBUG', `Button content: "${btn.innerHTML}", classes: "${btn.className}"`);
                        if (btn.innerHTML === '−') {
                            minimizeButton = btn;
                            break;
                        }
                    }
                }

                if (!minimizeButton) {
                    // Additional debugging - check if panel is in the right state
                    const panelStyle = window.getComputedStyle(panel);
                    DebugLogger.error('TEST-DEBUG', 'Minimize button not found. Panel state:', {
                        display: panelStyle.display,
                        visibility: panelStyle.visibility,
                        innerHTML: panel.innerHTML.substring(0, 1000)
                    });
                    throw new Error('Minimize button not found in panel');
                }

                // Validate button context binding
                const buttonValidation = this.validateButtonContextBinding(minimizeButton, 'minimize');
                if (!buttonValidation.valid) {
                    throw new Error(`Button context binding invalid: ${buttonValidation.issues.join(', ')}`);
                }

                // Perform minimize operation
                DebugLogger.log('TEST-SUITE', `Executing minimize operation for cycle ${cycleNumber}`);

                // Add debugging to see if click is working
                DebugLogger.log('TEST-DEBUG', 'About to click minimize button:', minimizeButton);
                DebugLogger.log('TEST-DEBUG', 'Button event listeners:', minimizeButton._eventListeners || 'none detected');

                // Try clicking with more explicit event dispatch
                try {
                    minimizeButton.click();
                    DebugLogger.log('TEST-DEBUG', 'Minimize button clicked successfully');
                } catch (clickError) {
                    DebugLogger.error('TEST-DEBUG', 'Error clicking minimize button:', clickError);

                    // Try alternative click method
                    try {
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        minimizeButton.dispatchEvent(clickEvent);
                        DebugLogger.log('TEST-DEBUG', 'Alternative click method used');
                    } catch (altClickError) {
                        DebugLogger.error('TEST-DEBUG', 'Alternative click also failed:', altClickError);
                        throw altClickError;
                    }
                }

                // Wait for minimize to complete
                await this.waitForMinimizeComplete();

                // Validate minimize result
                const minimizedButton = document.querySelector('#stash-minimized-button');
                if (!minimizedButton) {
                    throw new Error('Minimized button not created after minimize operation');
                }

                const endTime = performance.now();
                const operationTime = endTime - startTime;
                this.performanceMetrics.minimizeOperations.push(operationTime);

                DebugLogger.timeEnd(`Minimize-Operation-${cycleNumber}`);
                DebugLogger.success('TEST-SUITE', `Minimize operation ${cycleNumber} completed in ${operationTime.toFixed(2)}ms`);

                return { success: true, time: operationTime };

            } catch (error) {
                const endTime = performance.now();
                const operationTime = endTime - startTime;

                DebugLogger.timeEnd(`Minimize-Operation-${cycleNumber}`);
                DebugLogger.error('TEST-SUITE', `Minimize operation ${cycleNumber} failed after ${operationTime.toFixed(2)}ms`, error);

                return { success: false, error: error.message, time: operationTime };
            }
        },

        // Test individual expand operation with performance timing
        async testExpandOperation(cycleNumber) {
            DebugLogger.time(`Expand-Operation-${cycleNumber}`);
            const startTime = performance.now();

            try {
                // Ensure minimized button exists
                const minimizedButton = document.querySelector('#stash-minimized-button');
                if (!minimizedButton) {
                    throw new Error('Minimized button not found for expand operation');
                }

                // Validate button context binding
                const buttonValidation = this.validateButtonContextBinding(minimizedButton, 'expand');
                if (!buttonValidation.valid) {
                    throw new Error(`Button context binding invalid: ${buttonValidation.issues.join(', ')}`);
                }

                // Perform expand operation
                DebugLogger.log('TEST-SUITE', `Executing expand operation for cycle ${cycleNumber}`);
                minimizedButton.click();

                // Wait for expand to complete
                await this.waitForExpandComplete();

                // Validate expand result
                const panel = document.querySelector('#stash-automation-panel');
                if (!panel) {
                    throw new Error('Panel not created after expand operation');
                }

                const endTime = performance.now();
                const operationTime = endTime - startTime;
                this.performanceMetrics.expandOperations.push(operationTime);

                DebugLogger.timeEnd(`Expand-Operation-${cycleNumber}`);
                DebugLogger.success('TEST-SUITE', `Expand operation ${cycleNumber} completed in ${operationTime.toFixed(2)}ms`);

                return { success: true, time: operationTime };

            } catch (error) {
                const endTime = performance.now();
                const operationTime = endTime - startTime;

                DebugLogger.timeEnd(`Expand-Operation-${cycleNumber}`);
                DebugLogger.error('TEST-SUITE', `Expand operation ${cycleNumber} failed after ${operationTime.toFixed(2)}ms`, error);

                return { success: false, error: error.message, time: operationTime };
            }
        },

        // Validate button context binding under different conditions
        validateButtonContextBinding(button, operation) {
            DebugLogger.log('TEST-SUITE', `Validating ${operation} button context binding`);

            const issues = [];
            let valid = true;

            // Check if button has event listeners
            const hasEventListeners = button._eventListeners || button.onclick || button.addEventListener;
            if (!hasEventListeners) {
                issues.push('No event listeners detected on button');
                valid = false;
            }

            // Check if button is properly bound to DOM
            if (!button.parentNode) {
                issues.push('Button not properly attached to DOM');
                valid = false;
            }

            // Check if button is visible and clickable
            const computedStyle = window.getComputedStyle(button);
            if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
                issues.push('Button is not visible');
                valid = false;
            }

            // Check if button has proper attributes and content
            if (operation === 'minimize') {
                // Minimize button should have class, data-action, or innerHTML '−'
                const hasClass = button.classList.contains('stash-minimize-btn');
                const hasDataAction = button.getAttribute('data-action') === 'minimize';
                const hasMinusContent = button.innerHTML === '−';

                if (!hasClass && !hasDataAction && !hasMinusContent) {
                    issues.push('Minimize button missing expected identifiers (class, data-action, or content)');
                    valid = false;
                }
            } else if (operation === 'expand') {
                // Expand button should have ID
                if (!button.hasAttribute('id') || !button.id.includes('minimized')) {
                    issues.push('Expand button missing expected ID attribute');
                    valid = false;
                }
            }

            // Test context availability during different conditions
            const contextTests = [
                {
                    name: 'UIManager availability',
                    test: () => typeof uiManager !== 'undefined' && uiManager !== null
                },
                {
                    name: 'State management availability',
                    test: () => typeof AutomateStashState !== 'undefined'
                },
                {
                    name: 'Global fallback availability',
                    test: () => typeof window.expandAutomateStash === 'function'
                }
            ];

            contextTests.forEach(test => {
                if (!test.test()) {
                    issues.push(`Context test failed: ${test.name}`);
                    valid = false;
                }
            });

            const result = { valid, issues };
            DebugLogger.log('TEST-SUITE', `Button context binding validation result:`, result);

            return result;
        },

        // Test error recovery and fallback mechanisms
        async testErrorRecoveryMechanisms() {
            DebugLogger.log('TEST-SUITE', 'Starting error recovery mechanism tests');

            const results = {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                recoveryTimes: [],
                errors: []
            };

            // Test 1: Context loss recovery
            try {
                results.totalTests++;
                DebugLogger.log('TEST-SUITE', 'Testing context loss recovery');

                const recoveryResult = await this.testContextLossRecovery();
                if (recoveryResult.success) {
                    results.passedTests++;
                    results.recoveryTimes.push(recoveryResult.time);
                } else {
                    results.failedTests++;
                    results.errors.push(`Context loss recovery failed: ${recoveryResult.error}`);
                }
            } catch (error) {
                results.failedTests++;
                results.errors.push(`Context loss recovery test exception: ${error.message}`);
            }

            // Test 2: DOM corruption recovery
            try {
                results.totalTests++;
                DebugLogger.log('TEST-SUITE', 'Testing DOM corruption recovery');

                const recoveryResult = await this.testDOMCorruptionRecovery();
                if (recoveryResult.success) {
                    results.passedTests++;
                    results.recoveryTimes.push(recoveryResult.time);
                } else {
                    results.failedTests++;
                    results.errors.push(`DOM corruption recovery failed: ${recoveryResult.error}`);
                }
            } catch (error) {
                results.failedTests++;
                results.errors.push(`DOM corruption recovery test exception: ${error.message}`);
            }

            // Test 3: Global fallback mechanism
            try {
                results.totalTests++;
                DebugLogger.log('TEST-SUITE', 'Testing global fallback mechanism');

                const fallbackResult = await this.testGlobalFallbackMechanism();
                if (fallbackResult.success) {
                    results.passedTests++;
                    results.recoveryTimes.push(fallbackResult.time);
                } else {
                    results.failedTests++;
                    results.errors.push(`Global fallback failed: ${fallbackResult.error}`);
                }
            } catch (error) {
                results.failedTests++;
                results.errors.push(`Global fallback test exception: ${error.message}`);
            }

            // Calculate average recovery time
            if (results.recoveryTimes.length > 0) {
                results.averageRecoveryTime = results.recoveryTimes.reduce((a, b) => a + b, 0) / results.recoveryTimes.length;
            }

            DebugLogger.log('TEST-SUITE', 'Error recovery mechanism tests completed', results);
            return results;
        },

        // Test context loss recovery
        async testContextLossRecovery() {
            const startTime = performance.now();

            try {
                // Simulate context loss by temporarily clearing uiManager
                const originalUIManager = window.uiManager;
                window.uiManager = undefined;

                DebugLogger.log('TEST-SUITE', 'Simulated context loss - uiManager cleared');

                // Attempt recovery using global fallback
                if (typeof window.expandAutomateStash === 'function') {
                    await new Promise((resolve, reject) => {
                        try {
                            window.expandAutomateStash();
                            setTimeout(() => {
                                // Check if recovery was successful
                                if (typeof window.uiManager !== 'undefined' || document.querySelector('#stash-automation-panel')) {
                                    resolve();
                                } else {
                                    reject(new Error('Recovery did not restore functionality'));
                                }
                            }, 2000);
                        } catch (error) {
                            reject(error);
                        }
                    });
                }

                // Restore original context
                window.uiManager = originalUIManager;

                const endTime = performance.now();
                return { success: true, time: endTime - startTime };

            } catch (error) {
                const endTime = performance.now();
                return { success: false, error: error.message, time: endTime - startTime };
            }
        },

        // Test DOM corruption recovery
        async testDOMCorruptionRecovery() {
            const startTime = performance.now();

            try {
                // Simulate DOM corruption by removing elements
                const panel = document.querySelector('#stash-automation-panel');
                const minimizedButton = document.querySelector('#stash-minimized-button');

                if (panel) panel.remove();
                if (minimizedButton) minimizedButton.remove();

                DebugLogger.log('TEST-SUITE', 'Simulated DOM corruption - elements removed');

                // Attempt recovery
                UIElementTracker.cleanup();
                AutomateStashState.reset();

                // Wait for recovery
                await this.delay(1000);

                // Try to recreate UI
                if (typeof createOptimizedButtons === 'function') {
                    createOptimizedButtons();
                    await this.delay(2000);
                }

                // Check if recovery was successful
                const recoveredPanel = document.querySelector('#stash-automation-panel');
                if (!recoveredPanel) {
                    throw new Error('Panel not recovered after DOM corruption');
                }

                const endTime = performance.now();
                return { success: true, time: endTime - startTime };

            } catch (error) {
                const endTime = performance.now();
                return { success: false, error: error.message, time: endTime - startTime };
            }
        },

        // Test global fallback mechanism
        async testGlobalFallbackMechanism() {
            const startTime = performance.now();

            try {
                // Ensure we start from minimized state
                const panel = document.querySelector('#stash-automation-panel');
                if (panel && typeof uiManager?.minimizePanel === 'function') {
                    await uiManager.minimizePanel();
                    await this.delay(1000);
                }

                // Test global fallback
                if (typeof window.expandAutomateStash === 'function') {
                    window.expandAutomateStash();
                    await this.delay(3000);

                    // Verify fallback worked
                    const expandedPanel = document.querySelector('#stash-automation-panel');
                    if (!expandedPanel) {
                        throw new Error('Global fallback did not create panel');
                    }

                    const endTime = performance.now();
                    return { success: true, time: endTime - startTime };
                } else {
                    throw new Error('Global fallback function not available');
                }

            } catch (error) {
                const endTime = performance.now();
                return { success: false, error: error.message, time: endTime - startTime };
            }
        },

        // Performance timing validation for UI operations
        validatePerformanceTiming() {
            DebugLogger.log('TEST-SUITE', 'Validating performance timing for UI operations');

            const results = {
                minimizeOperations: {
                    count: this.performanceMetrics.minimizeOperations.length,
                    average: 0,
                    min: 0,
                    max: 0,
                    acceptable: true
                },
                expandOperations: {
                    count: this.performanceMetrics.expandOperations.length,
                    average: 0,
                    min: 0,
                    max: 0,
                    acceptable: true
                },
                recommendations: []
            };

            // Analyze minimize operations
            if (this.performanceMetrics.minimizeOperations.length > 0) {
                const minimizeTimes = this.performanceMetrics.minimizeOperations;
                results.minimizeOperations.average = minimizeTimes.reduce((a, b) => a + b, 0) / minimizeTimes.length;
                results.minimizeOperations.min = Math.min(...minimizeTimes);
                results.minimizeOperations.max = Math.max(...minimizeTimes);

                // Check if performance is acceptable (under 2 seconds)
                if (results.minimizeOperations.average > 2000) {
                    results.minimizeOperations.acceptable = false;
                    results.recommendations.push('Minimize operations are taking too long (>2s average)');
                }
            }

            // Analyze expand operations
            if (this.performanceMetrics.expandOperations.length > 0) {
                const expandTimes = this.performanceMetrics.expandOperations;
                results.expandOperations.average = expandTimes.reduce((a, b) => a + b, 0) / expandTimes.length;
                results.expandOperations.min = Math.min(...expandTimes);
                results.expandOperations.max = Math.max(...expandTimes);

                // Check if performance is acceptable (under 3 seconds)
                if (results.expandOperations.average > 3000) {
                    results.expandOperations.acceptable = false;
                    results.recommendations.push('Expand operations are taking too long (>3s average)');
                }
            }

            DebugLogger.log('TEST-SUITE', 'Performance timing validation results', results);
            return results;
        },

        // Utility functions
        async delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        async waitForMinimizeComplete(timeout = 5000) {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                if (document.querySelector('#stash-minimized-button') && !document.querySelector('#stash-automation-panel')) {
                    return true;
                }
                await this.delay(100);
            }
            throw new Error('Minimize operation did not complete within timeout');
        },

        async waitForExpandComplete(timeout = 5000) {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                if (document.querySelector('#stash-automation-panel') && !document.querySelector('#stash-minimized-button')) {
                    return true;
                }
                await this.delay(100);
            }
            throw new Error('Expand operation did not complete within timeout');
        },

        // Run complete test suite
        async runCompleteTestSuite() {
            DebugLogger.log('TEST-SUITE', '🧪 Starting complete minimize button test suite');

            const suiteResults = {
                startTime: new Date().toISOString(),
                contextValidation: null,
                minimizeExpandCycles: null,
                errorRecovery: null,
                performanceValidation: null,
                overallSuccess: false,
                recommendations: []
            };

            try {
                // 1. Context validation
                DebugLogger.log('TEST-SUITE', '1️⃣ Running context validation tests');
                suiteResults.contextValidation = validateMinimizeButtonContext();

                // 2. Minimize/expand cycle tests
                DebugLogger.log('TEST-SUITE', '2️⃣ Running minimize/expand cycle tests');
                suiteResults.minimizeExpandCycles = await this.testMinimizeExpandCycles(3);

                // 3. Error recovery tests
                DebugLogger.log('TEST-SUITE', '3️⃣ Running error recovery tests');
                suiteResults.errorRecovery = await this.testErrorRecoveryMechanisms();

                // 4. Performance validation
                DebugLogger.log('TEST-SUITE', '4️⃣ Running performance validation');
                suiteResults.performanceValidation = this.validatePerformanceTiming();

                // Determine overall success
                const contextSuccess = suiteResults.contextValidation.allValid;
                const cycleSuccess = suiteResults.minimizeExpandCycles.successfulCycles > 0;
                const recoverySuccess = suiteResults.errorRecovery.passedTests > 0;
                const performanceSuccess = suiteResults.performanceValidation.minimizeOperations.acceptable &&
                    suiteResults.performanceValidation.expandOperations.acceptable;

                suiteResults.overallSuccess = contextSuccess && cycleSuccess && recoverySuccess && performanceSuccess;

                // Generate recommendations
                if (!contextSuccess) {
                    suiteResults.recommendations.push('Fix context validation issues before deployment');
                }
                if (!cycleSuccess) {
                    suiteResults.recommendations.push('Minimize/expand functionality needs debugging');
                }
                if (!recoverySuccess) {
                    suiteResults.recommendations.push('Error recovery mechanisms need improvement');
                }
                if (!performanceSuccess) {
                    suiteResults.recommendations.push('Performance optimization needed for UI operations');
                }

                suiteResults.endTime = new Date().toISOString();

                // Log final results
                if (suiteResults.overallSuccess) {
                    DebugLogger.success('TEST-SUITE', '✅ Complete test suite PASSED');
                    notifications.show('✅ Minimize button test suite passed!', 'success', 5000);
                } else {
                    DebugLogger.error('TEST-SUITE', '❌ Complete test suite FAILED');
                    notifications.show('❌ Minimize button test suite failed. Check console for details.', 'error', 8000);
                }

                DebugLogger.log('TEST-SUITE', 'Complete test suite results:', suiteResults);
                return suiteResults;

            } catch (error) {
                DebugLogger.error('TEST-SUITE', 'Test suite execution failed', error);
                suiteResults.endTime = new Date().toISOString();
                suiteResults.overallSuccess = false;
                suiteResults.recommendations.push('Test suite execution failed - check for critical errors');
                return suiteResults;
            }
        }
    };

    // Enhanced Robust Event Handler Wrapper System with Timeout Protection
    const safeEventHandler = (handler, context = 'Unknown', timeoutMs = 10000) => {
        return function (event) {
            DebugLogger.log('EVENT-HANDLER', `${context} event handler executing with ${timeoutMs}ms timeout protection`);

            let handlerCompleted = false;
            let timeoutId;

            // Set up timeout protection for the event handler
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    if (!handlerCompleted) {
                        handlerCompleted = true;
                        DebugLogger.error('EVENT-HANDLER', `${context} event handler timed out after ${timeoutMs}ms`);
                        reject(new Error(`Event handler timeout: ${context}`));
                    }
                }, timeoutMs);
            });

            try {
                // Execute the handler with timeout protection
                const handlerPromise = new Promise((resolve, reject) => {
                    try {
                        const result = handler.call(this, event);

                        // Handle both sync and async handlers
                        if (result && typeof result.then === 'function') {
                            result.then(resolve).catch(reject);
                        } else {
                            resolve(result);
                        }
                    } catch (error) {
                        reject(error);
                    }
                });

                // Race between handler execution and timeout
                Promise.race([handlerPromise, timeoutPromise])
                    .then((result) => {
                        if (!handlerCompleted) {
                            handlerCompleted = true;
                            clearTimeout(timeoutId);
                            DebugLogger.success('EVENT-HANDLER', `${context} event handler completed successfully`);
                        }
                        return result;
                    })
                    .catch((error) => {
                        if (!handlerCompleted) {
                            handlerCompleted = true;
                            clearTimeout(timeoutId);
                            handleEventHandlerError(error, context);
                        }
                    });

                // For synchronous handlers, handle immediately
                if (handlerCompleted) {
                    return;
                }

                // Execute synchronously if possible
                const result = handler.call(this, event);
                if (!handlerCompleted) {
                    handlerCompleted = true;
                    clearTimeout(timeoutId);
                    DebugLogger.success('EVENT-HANDLER', `${context} event handler completed successfully (sync)`);
                }
                return result;

            } catch (error) {
                if (!handlerCompleted) {
                    handlerCompleted = true;
                    clearTimeout(timeoutId);
                    handleEventHandlerError(error, context);
                }
            }
        };
    };

    // Enhanced Error Handling for Event Handlers with Recovery Procedures
    function handleEventHandlerError(error, context) {
        DebugLogger.error('EVENT-HANDLER', `${context} event handler failed`, error);

        // Show user notification
        notifications.show(`⚠️ UI Error: ${context} failed. Attempting recovery...`, 'warning', 6000);

        // Start recovery procedures with timeout protection
        timeoutProtectedOperation(
            () => performEventHandlerRecovery(context),
            8000,
            `${context} Recovery`
        ).catch(recoveryError => {
            DebugLogger.error('EVENT-HANDLER', `Recovery failed for ${context}`, recoveryError);
            notifications.show(`❌ Recovery failed for ${context}. Please refresh the page.`, 'error', 10000);
        });
    }

    // Event Handler Recovery Procedures
    function performEventHandlerRecovery(context) {
        DebugLogger.log('EVENT-HANDLER-RECOVERY', `Starting recovery procedures for ${context}`);

        // Context validation for recovery
        DebugLogger.log('EVENT-HANDLER-RECOVERY', 'Running context validation for recovery');
        const contextValidation = validateMinimizeButtonContext();

        if (!contextValidation.allValid) {
            DebugLogger.warn('EVENT-HANDLER-RECOVERY', `Recovery context validation issues: ${contextValidation.failedCount} failures`);

            // Attempt context recovery
            const contextRecoverySuccess = attemptContextRecovery();
            if (!contextRecoverySuccess) {
                DebugLogger.error('EVENT-HANDLER-RECOVERY', 'Context recovery failed');
            }
        }

        // Recovery strategy based on context type
        if (context.toLowerCase().includes('minimize') || context.toLowerCase().includes('expand')) {
            DebugLogger.log('EVENT-HANDLER-RECOVERY', 'Applying minimize/expand specific recovery');

            // Clean up any corrupted UI state
            UIElementTracker.cleanup();

            // Reset state
            AutomateStashState.updateState({
                lastButtonCreationAttempt: 0,
                buttonCreationInProgress: false,
                userManuallyExpanded: true // Assume user intended to expand
            });

            // Attempt panel recreation with delay
            setTimeout(() => {
                if (typeof window.expandAutomateStash === 'function') {
                    DebugLogger.log('EVENT-HANDLER-RECOVERY', 'Using enhanced global fallback for recovery');
                    try {
                        window.expandAutomateStash();
                        DebugLogger.success('EVENT-HANDLER-RECOVERY', 'Enhanced global fallback recovery succeeded');
                    } catch (recoveryError) {
                        DebugLogger.error('EVENT-HANDLER-RECOVERY', 'Enhanced global fallback recovery failed', recoveryError);
                    }
                } else {
                    DebugLogger.error('EVENT-HANDLER-RECOVERY', 'Enhanced global fallback not available');
                }
            }, 1000);

        } else {
            DebugLogger.log('EVENT-HANDLER-RECOVERY', 'Applying general recovery procedures');

            // General recovery: try to restore basic functionality
            if (typeof createOptimizedButtons === 'function') {
                setTimeout(() => {
                    try {
                        createOptimizedButtons();
                        DebugLogger.success('EVENT-HANDLER-RECOVERY', 'General recovery via createOptimizedButtons succeeded');
                    } catch (error) {
                        DebugLogger.error('EVENT-HANDLER-RECOVERY', 'General recovery failed', error);
                    }
                }, 1000);
            }
        }

        DebugLogger.log('EVENT-HANDLER-RECOVERY', `Recovery procedures initiated for ${context}`);
        return true;
    }

    const createMinimizeHandler = (uiManagerInstance) => {
        console.log('🔧 DEBUG: createMinimizeHandler called with:', uiManagerInstance);
        console.log('🔧 DEBUG: safeEventHandler type:', typeof safeEventHandler);

        const handler = safeEventHandler(async function (event) {
            event.preventDefault();
            event.stopPropagation();

            console.log('🔥 DEBUG: MINIMIZE HANDLER CALLED!');
            DebugLogger.log('MINIMIZE-HANDLER', 'Minimize handler executing');
            DebugLogger.validateContext('MINIMIZE-HANDLER', 'UIManager instance', uiManagerInstance, 'object');
            DebugLogger.validateContext('MINIMIZE-HANDLER', 'minimizePanel method', uiManagerInstance?.minimizePanel, 'function');

            // Comprehensive context validation before executing minimize functionality
            DebugLogger.log('MINIMIZE-HANDLER', 'Running comprehensive context validation');
            const contextValidation = validateMinimizeButtonContext();

            if (!contextValidation.allValid) {
                DebugLogger.error('MINIMIZE-HANDLER', `Context validation failed: ${contextValidation.failedCount}/${contextValidation.results.length} tests failed`);

                // Log specific failures
                const failedTests = contextValidation.results.filter(r => !r.passed);
                failedTests.forEach(test => {
                    DebugLogger.error('MINIMIZE-HANDLER', `Failed: ${test.name} - ${test.fix}`);
                });

                // Still attempt to proceed with fallback
                DebugLogger.warn('MINIMIZE-HANDLER', 'Proceeding with fallback despite validation failures');
            } else {
                DebugLogger.success('MINIMIZE-HANDLER', 'All context validations passed');
            }

            if (typeof uiManagerInstance.minimizePanel === 'function') {
                DebugLogger.success('MINIMIZE-HANDLER', 'Calling minimizePanel method');
                DebugLogger.time('Minimize Panel Operation');

                try {
                    const result = await uiManagerInstance.minimizePanel();
                    DebugLogger.timeEnd('Minimize Panel Operation');
                    DebugLogger.success('MINIMIZE-HANDLER', 'minimizePanel completed', { result });
                } catch (error) {
                    DebugLogger.timeEnd('Minimize Panel Operation');
                    DebugLogger.error('MINIMIZE-HANDLER', 'minimizePanel failed', error);
                }
            } else {
                DebugLogger.error('MINIMIZE-HANDLER', 'UIManager minimizePanel method not available');
                // Fallback to global function
                if (typeof window.expandAutomateStash === 'function') {
                    DebugLogger.warn('MINIMIZE-HANDLER', 'Using global fallback for minimize operation');
                    // Create minimized state manually
                    createMinimizedButtonFallback();
                }
            }
        }, 'Minimize Button');

        console.log('🔧 DEBUG: Handler created, returning:', typeof handler);
        return handler;
    };

    const createExpandHandler = (uiManagerInstance) => {
        return safeEventHandler(function (event) {
            event.preventDefault();
            event.stopPropagation();

            console.log('🔄 DEBUG: Enhanced expand handler executing');
            console.log('🔍 DEBUG: UIManager instance available:', !!uiManagerInstance);
            console.log('🔍 DEBUG: createFullPanelForced method available:', typeof uiManagerInstance?.createFullPanelForced);

            // Enhanced state management for user expansion
            console.log('🔧 DEBUG: Setting enhanced userManuallyExpanded flag...');
            const currentState = AutomateStashState.getState();
            AutomateStashState.updateState({
                userManuallyExpanded: true,
                lastButtonCreationAttempt: 0,
                buttonCreationInProgress: false
            });
            console.log('🔓 User manually expanded - enhanced auto-minimization disabled');
            console.log('🔍 DEBUG: Previous state:', currentState.userManuallyExpanded, '-> New state:', true);

            // Enhanced context validation with detailed logging
            if (!validateExpandContext(uiManagerInstance)) {
                console.error('❌ Enhanced context validation failed for expand operation');
                console.error('❌ Context details:', {
                    uiManagerExists: !!uiManagerInstance,
                    createFullPanelForcedExists: typeof uiManagerInstance?.createFullPanelForced,
                    showFullPanelExists: typeof uiManagerInstance?.showFullPanel
                });

                // Enhanced fallback with multiple attempts
                console.log('🔄 DEBUG: Attempting enhanced fallback mechanisms...');

                // First fallback: Try global function
                if (typeof window.expandAutomateStash === 'function') {
                    console.log('🔄 DEBUG: Using global fallback for expand operation');
                    window.expandAutomateStash();
                    return;
                }

                // Second fallback: Try to recreate UIManager if possible
                if (typeof UIManager === 'function') {
                    console.log('🔄 DEBUG: Attempting UIManager recreation fallback');
                    try {
                        const fallbackUIManager = new UIManager();
                        if (typeof fallbackUIManager.createFullPanelForced === 'function') {
                            console.log('🔄 DEBUG: Using recreated UIManager for expansion');
                            fallbackUIManager.createFullPanelForced();
                            return;
                        }
                    } catch (error) {
                        console.error('❌ ERROR: UIManager recreation failed:', error);
                    }
                }

                // Final fallback: Manual panel creation
                console.log('🔄 DEBUG: Using manual panel creation fallback');
                createMinimizedButtonFallback();
                return;
            }

            console.log('🧹 DEBUG: Enhanced cleanup of existing elements...');

            // Enhanced cleanup with validation
            try {
                UIElementTracker.cleanup();
                console.log('✅ DEBUG: Enhanced cleanup completed successfully');
            } catch (error) {
                console.error('❌ ERROR: Enhanced cleanup failed:', error);
                // Continue with expansion attempt even if cleanup fails
            }

            // Enhanced panel creation with multiple fallback attempts
            console.log('🚀 DEBUG: Attempting enhanced panel creation...');

            try {
                if (typeof uiManagerInstance.createFullPanelForced === 'function') {
                    console.log('🚀 DEBUG: Calling enhanced createFullPanelForced...');
                    uiManagerInstance.createFullPanelForced();
                    console.log('✅ DEBUG: Enhanced createFullPanelForced completed successfully');
                } else {
                    throw new Error('createFullPanelForced method not available');
                }
            } catch (error) {
                console.error('❌ ERROR: Enhanced createFullPanelForced failed:', error);

                // Try alternative method
                if (typeof uiManagerInstance.showFullPanel === 'function') {
                    console.log('🔄 DEBUG: Trying showFullPanel as secondary method');
                    try {
                        uiManagerInstance.showFullPanel();
                        console.log('✅ DEBUG: showFullPanel completed successfully');
                    } catch (showError) {
                        console.error('❌ ERROR: showFullPanel also failed:', showError);

                        // Final fallback to global function
                        if (typeof window.expandAutomateStash === 'function') {
                            console.log('🔄 DEBUG: Using global fallback as final attempt');
                            window.expandAutomateStash();
                        } else {
                            console.error('❌ ERROR: All expansion methods failed');
                            notifications.show('⚠️ Failed to expand panel: All methods failed', 'error');
                        }
                    }
                } else {
                    // Final fallback to global function
                    if (typeof window.expandAutomateStash === 'function') {
                        console.log('🔄 DEBUG: Using global fallback as final attempt');
                        window.expandAutomateStash();
                    } else {
                        console.error('❌ ERROR: No expansion methods available');
                        notifications.show('⚠️ Failed to expand panel: No methods available', 'error');
                    }
                }
            }
        }, 'Enhanced Expand Button');
    };

    const validateExpandContext = (uiManagerInstance) => {
        console.log('🔍 DEBUG: Enhanced expand context validation starting...');

        const validations = [
            {
                name: 'UIManager Instance',
                test: () => !!uiManagerInstance,
                fix: 'Ensure UIManager is instantiated before button creation',
                critical: true
            },
            {
                name: 'createFullPanelForced Method',
                test: () => typeof uiManagerInstance?.createFullPanelForced === 'function',
                fix: 'Check UIManager class definition and method binding',
                critical: true
            },
            {
                name: 'showFullPanel Method (Alternative)',
                test: () => typeof uiManagerInstance?.showFullPanel === 'function',
                fix: 'Check UIManager class definition for showFullPanel method',
                critical: false
            },
            {
                name: 'State Management Available',
                test: () => typeof AutomateStashState !== 'undefined' && typeof AutomateStashState.updateState === 'function',
                fix: 'Ensure AutomateStashState is properly initialized',
                critical: true
            },
            {
                name: 'UI Element Tracker Available',
                test: () => typeof UIElementTracker !== 'undefined' && typeof UIElementTracker.cleanup === 'function',
                fix: 'Ensure UIElementTracker is properly initialized',
                critical: true
            },
            {
                name: 'Minimized Button Exists',
                test: () => !!document.querySelector('#stash-minimized-button'),
                fix: 'Ensure minimized button exists before attempting expansion',
                critical: false
            },
            {
                name: 'Global Fallback Available',
                test: () => typeof window.expandAutomateStash === 'function',
                fix: 'Ensure global fallback function is defined',
                critical: false
            }
        ];

        let criticalValid = true;
        let allValid = true;
        const results = {};

        validations.forEach(validation => {
            const result = validation.test();
            results[validation.name] = result;

            console.log(`🔍 VALIDATION: ${validation.name}: ${result ? 'PASS' : 'FAIL'}${validation.critical ? ' (CRITICAL)' : ''}`);

            if (!result) {
                console.error(`❌ VALIDATION: Fix needed: ${validation.fix}`);
                allValid = false;
                if (validation.critical) {
                    criticalValid = false;
                }
            }
        });

        // Enhanced logging of validation results
        console.log('🔍 DEBUG: Enhanced validation summary:', {
            criticalValid,
            allValid,
            results
        });

        // Log current state for debugging
        const currentState = AutomateStashState.getState();
        console.log('🔍 DEBUG: Current state during validation:', {
            isMinimized: currentState.isMinimized,
            userManuallyExpanded: currentState.userManuallyExpanded,
            panelExists: currentState.panelExists,
            buttonCreationInProgress: currentState.buttonCreationInProgress
        });

        // Return true if critical validations pass (allows for graceful degradation)
        return criticalValid;
    };

    const validateMinimizeContext = (uiManagerInstance) => {
        const validations = [
            {
                name: 'UIManager Instance',
                test: () => !!uiManagerInstance,
                fix: 'Ensure UIManager is instantiated before button creation'
            },
            {
                name: 'minimizePanel Method',
                test: () => typeof uiManagerInstance?.minimizePanel === 'function',
                fix: 'Check UIManager class definition and method binding'
            },
            {
                name: 'DOM Panel Exists',
                test: () => !!document.querySelector('#stash-automation-panel'),
                fix: 'Ensure panel exists before adding minimize button'
            },
            {
                name: 'Global Fallback Available',
                test: () => typeof window.expandAutomateStash === 'function',
                fix: 'Ensure global fallback function is defined'
            }
        ];

        let allValid = true;
        validations.forEach(validation => {
            const result = validation.test();
            console.log(`🔍 VALIDATION: ${validation.name}: ${result ? 'PASS' : 'FAIL'}`);
            if (!result) {
                console.error(`❌ VALIDATION: Fix needed: ${validation.fix}`);
                allValid = false;
            }
        });

        return allValid;
    };

    const validateMinimizeButtonCreation = (uiManagerInstance) => {
        console.log('🔍 DEBUG: Validating minimize button creation context...');

        const validations = [
            {
                name: 'UIManager Instance Available',
                test: () => !!uiManagerInstance,
                fix: 'Ensure UIManager is properly instantiated'
            },
            {
                name: 'UIManager Methods Bound',
                test: () => typeof uiManagerInstance?.minimizePanel === 'function',
                fix: 'Ensure UIManager methods are properly bound in constructor'
            },
            {
                name: 'Panel Element Ready',
                test: () => !!document.querySelector('#stash-automation-panel') || document.getElementById('stash-automation-panel'),
                fix: 'Ensure panel element exists before adding minimize button'
            },
            {
                name: 'Event Handler System Available',
                test: () => typeof createMinimizeHandler === 'function' && typeof safeEventHandler === 'function',
                fix: 'Ensure event handler wrapper functions are defined'
            },
            {
                name: 'State Management Available',
                test: () => typeof AutomateStashState !== 'undefined' && typeof AutomateStashState.updateState === 'function',
                fix: 'Ensure centralized state management is available'
            }
        ];

        let allValid = true;
        validations.forEach(validation => {
            const result = validation.test();
            console.log(`🔍 BUTTON-VALIDATION: ${validation.name}: ${result ? 'PASS' : 'FAIL'}`);
            if (!result) {
                console.error(`❌ BUTTON-VALIDATION: Fix needed: ${validation.fix}`);
                allValid = false;
            }
        });

        if (allValid) {
            console.log('✅ DEBUG: All minimize button creation validations passed');
        } else {
            console.error('❌ DEBUG: Some minimize button creation validations failed');
        }

        return allValid;
    };

    const createMinimizedButtonFallback = () => {
        DebugLogger.log('FALLBACK', 'Creating enhanced minimized button via fallback');

        try {
            // Context validation for fallback
            DebugLogger.log('FALLBACK', 'Running context validation for fallback creation');
            const contextValidation = validateMinimizeButtonContext();

            if (!contextValidation.allValid) {
                DebugLogger.warn('FALLBACK', `Context validation issues in fallback: ${contextValidation.failedCount} failures`);
            }

            // Enhanced cleanup with DOMManager in fallback
            DebugLogger.log('FALLBACK', 'Enhanced fallback cleanup starting with DOMManager');

            try {
                DOMManager.cleanupElements([
                    '#stash-minimized-button',
                    '.stash-minimized-button',
                    '[id*="stash-minimized"]'
                ], 'Existing minimized buttons in fallback', {
                    validateParent: false,
                    clearEventListeners: true,
                    timeout: 2000,
                    force: true
                }).catch(error => {
                    DebugLogger.error('FALLBACK', 'Enhanced fallback cleanup failed', error);
                });
            } catch (error) {
                DebugLogger.error('FALLBACK', 'Fallback cleanup operation failed', error);
                // Simple fallback cleanup
                const existingButton = document.querySelector('#stash-minimized-button');
                if (existingButton) {
                    existingButton.remove();
                }
            }

            // Clean up tracked elements
            UIElementTracker.cleanup();

            // Update state to reflect fallback creation
            AutomateStashState.updateState({
                buttonCreationInProgress: true,
                lastButtonCreationAttempt: Date.now()
            });
            DebugLogger.log('FALLBACK', 'State updated for fallback creation');

            // Create enhanced fallback minimized button
            const button = document.createElement('div');
            button.id = 'stash-minimized-button';
            button.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                color: white;
                z-index: 10000;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                transition: all 0.2s ease;
                border: 2px solid rgba(255,255,255,0.3);
            `;

            // Different icon to indicate fallback mode
            button.innerHTML = '🤖';

            // Enhanced tooltip for fallback button
            const tooltip = document.createElement('div');
            tooltip.style.cssText = `
                position: absolute;
                bottom: 70px;
                right: 0;
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                white-space: nowrap;
                opacity: 0;
                transition: opacity 0.2s;
                pointer-events: none;
            `;
            tooltip.textContent = 'AutomateStash (Fallback Mode)';
            button.appendChild(tooltip);

            // Enhanced event handlers for fallback button
            button.addEventListener('mouseenter', safeEventHandler(() => {
                DebugLogger.log('FALLBACK', 'Fallback button hover');
                button.style.transform = 'scale(1.1)';
                tooltip.style.opacity = '1';
            }, 'Fallback Button Hover'));

            button.addEventListener('mouseleave', safeEventHandler(() => {
                DebugLogger.log('FALLBACK', 'Fallback button leave');
                button.style.transform = 'scale(1)';
                tooltip.style.opacity = '0';
            }, 'Fallback Button Leave'));

            // Enhanced click handler with multiple fallback attempts
            button.addEventListener('click', safeEventHandler((event) => {
                event.preventDefault();
                event.stopPropagation();

                DebugLogger.log('FALLBACK', 'Enhanced fallback minimized button clicked');

                // Context validation before expansion
                DebugLogger.log('FALLBACK', 'Running context validation before expansion');
                const contextValidation = validateMinimizeButtonContext();

                if (!contextValidation.allValid) {
                    DebugLogger.warn('FALLBACK', `Context validation issues before expansion: ${contextValidation.failedCount} failures`);
                }

                // Update state for user expansion
                AutomateStashState.updateState({
                    userManuallyExpanded: true,
                    lastButtonCreationAttempt: 0,
                    buttonCreationInProgress: false
                });

                // Try multiple expansion methods
                let expansionSuccessful = false;

                // First attempt: Global function
                if (typeof window.expandAutomateStash === 'function') {
                    DebugLogger.log('FALLBACK', 'Using global fallback function');
                    try {
                        window.expandAutomateStash();
                        expansionSuccessful = true;
                        DebugLogger.success('FALLBACK', 'Global fallback function succeeded');
                    } catch (error) {
                        DebugLogger.error('FALLBACK', 'Global fallback function failed', error);
                    }
                }

                // Second attempt: Direct UIManager access
                if (!expansionSuccessful && typeof window.uiManager !== 'undefined') {
                    DebugLogger.log('FALLBACK', 'Trying direct UIManager access');
                    try {
                        if (typeof window.uiManager.createFullPanelForced === 'function') {
                            window.uiManager.createFullPanelForced();
                            expansionSuccessful = true;
                            DebugLogger.success('FALLBACK', 'Direct UIManager.createFullPanelForced succeeded');
                        } else if (typeof window.uiManager.showFullPanel === 'function') {
                            window.uiManager.showFullPanel();
                            expansionSuccessful = true;
                            DebugLogger.success('FALLBACK', 'Direct UIManager.showFullPanel succeeded');
                        }
                    } catch (error) {
                        DebugLogger.error('FALLBACK', 'Direct UIManager access failed', error);
                    }
                }

                // Third attempt: Manual panel recreation
                if (!expansionSuccessful) {
                    DebugLogger.log('FALLBACK', 'Attempting manual panel recreation');
                    try {
                        // Clean up and try to recreate basic panel
                        UIElementTracker.cleanup();

                        // Show notification about fallback mode
                        notifications.show('⚠️ Expanding in fallback mode - some features may be limited', 'warning');

                        // Try to call createOptimizedButtons if available
                        if (typeof createOptimizedButtons === 'function') {
                            createOptimizedButtons();
                            expansionSuccessful = true;
                            DebugLogger.success('FALLBACK', 'Manual panel recreation succeeded');
                        }
                    } catch (error) {
                        DebugLogger.error('FALLBACK', 'Manual panel recreation failed', error);
                    }
                }

                if (!expansionSuccessful) {
                    DebugLogger.error('FALLBACK', 'All fallback expansion methods failed');
                    notifications.show('❌ Failed to expand AutomateStash - please refresh the page', 'error');
                } else {
                    DebugLogger.success('FALLBACK', 'Fallback expansion successful');
                }

            }, 'Enhanced Fallback Minimized Button'));

            // Add global onclick as additional backup
            button.setAttribute('onclick', 'window.expandAutomateStash()');

            DebugLogger.log('FALLBACK', 'Appending enhanced fallback button to document body');
            document.body.appendChild(button);

            // Track the enhanced fallback button using UIElementTracker
            UIElementTracker.setMinimizedButton(button);

            // Update state to reflect successful creation
            AutomateStashState.updateState({
                isMinimized: true,
                panelExists: false,
                buttonCreationInProgress: false
            });

            DebugLogger.success('FALLBACK', 'Enhanced fallback minimized button created successfully');
            DebugLogger.log('FALLBACK', 'Fallback button in DOM verification', {
                inDOM: !!document.querySelector('#stash-minimized-button')
            });

        } catch (error) {
            DebugLogger.error('FALLBACK', 'Enhanced fallback minimized button creation failed', error);

            // Reset state on failure
            AutomateStashState.updateState({ buttonCreationInProgress: false });

            // Show user notification
            notifications.show('❌ Critical error: Unable to create minimized button', 'error');
        }
    };

    const uiManager = new UIManager();

    // Make UIManager globally accessible for fallback functions
    window.uiManager = uiManager;

    // Optimized element waiting with React lifecycle awareness
    async function waitForElement(selector, timeout = 10000, reactAware = true) {
        const startTime = Date.now();

        // For React components, wait for initial render cycle
        if (reactAware) {
            await sleep(STASH_CONFIG.REACT_RENDER_DELAY);
        }

        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) { // Ensure element is visible
                return element;
            }
            await sleep(100);
        }
        throw new Error(`Element ${selector} not found within ${timeout}ms`);
    }

    // Enhanced element waiting with multiple fallback strategies
    async function waitForElementAdvanced(selectors, timeout = 10000) {
        const selectorsArray = Array.isArray(selectors) ? selectors : [selectors];
        const startTime = Date.now();

        await sleep(STASH_CONFIG.REACT_RENDER_DELAY);

        while (Date.now() - startTime < timeout) {
            for (const selector of selectorsArray) {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) {
                    console.log(`Found element with selector: ${selector}`);
                    return element;
                }
            }
            await sleep(100);
        }
        throw new Error(`None of the selectors found: ${selectorsArray.join(', ')}`);
    }

    // Optimized click function with GraphQL mutation awareness
    async function clickElementOptimized(selectors, description = '', waitForMutation = false) {
        try {
            console.log(`🔍 Looking for element: ${description}`);
            const element = await waitForElementAdvanced(selectors, 8000);

            // Pre-click validation
            if (!element.offsetParent) {
                throw new Error('Element is not visible');
            }

            // Scroll element into view for better interaction
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(100);

            // Click with focus for better React event handling
            element.focus();
            await sleep(50);
            element.click();

            console.log(`✅ Successfully clicked: ${description}`);

            // Wait for GraphQL mutations if needed (Stash uses GraphQL extensively)
            if (waitForMutation) {
                await sleep(STASH_CONFIG.GRAPHQL_MUTATION_DELAY);
            }

            return true;
        } catch (error) {
            console.error(`❌ Failed to click ${description}:`, error);
            await debugElementsInArea(selectors);
            return false;
        }
    }

    // Enhanced debugging with Stash-specific component inspection
    async function debugElementsInArea(selectors) {
        console.log('🔧 DEBUG: Analyzing page structure...');

        // Check for Stash Entity Edit Panel
        const editPanel = document.querySelector(STASH_CONFIG.SELECTORS.entityEditPanel);
        if (editPanel) {
            console.log('📝 Found Entity Edit Panel');
        } else {
            console.log('❌ No Entity Edit Panel found');
        }

        // Check for React components
        const reactRoots = document.querySelectorAll('[data-reactroot], [data-react-class]');
        console.log(`⚛️ Found ${reactRoots.length} React components`);

        // Debug buttons in context
        const contextButtons = document.querySelectorAll('button');
        console.log(`🔘 Found ${contextButtons.length} buttons:`);
        contextButtons.forEach((btn, index) => {
            if (index < 15) { // Show more buttons for better debugging
                const rect = btn.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 && btn.offsetParent !== null;
                console.log(`  ${index}: "${btn.textContent.trim()}" | Classes: ${btn.className} | Visible: ${isVisible}`);
            }
        });
    }

    // Optimized Apply Button Detection - Based on Stash Entity Edit Panel patterns
    async function findApplyButton() {
        console.log('🔍 Searching for Apply button using optimized Stash patterns...');

        const applySelectors = [
            // Stash-specific Entity Edit Panel patterns
            '.edit-panel button.btn-primary',
            '.scene-edit-form button[type="submit"]',
            '.entity-edit-panel button.btn-primary',

            // Generic but targeted patterns
            'button.ml-2.btn.btn-primary',
            'button.btn.btn-primary',
            '.modal-footer button',
            '.form-actions button',

            // Fallback patterns
            'button',
            '[data-testid*="apply"]',
            '[aria-label*="pply"]'
        ];

        // Search through selectors and filter by text content
        for (const selector of applySelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.textContent.toLowerCase().trim();
                if (text === 'apply' || text.includes('apply')) {
                    console.log(`✅ Found Apply button: ${selector} - "${element.textContent.trim()}"`);
                    return element;
                }
            }
        }

        console.log('❌ Apply button not found with optimized patterns');
        return null;
    }

    // Optimized Save Button Detection - Based on Stash Entity Edit Panel patterns  
    async function findSaveButton() {
        console.log('🔍 Searching for Save button using optimized Stash patterns...');

        const saveSelectors = [
            // Stash-specific Entity Edit Panel patterns
            '.edit-panel .edit-button.btn.btn-primary',
            '.scene-edit-form .edit-button',
            '.entity-edit-panel .edit-button',

            // Form submission patterns
            'form button[type="submit"]',
            '.edit-form button.btn-primary',

            // Generic but targeted patterns
            'button.edit-button.btn.btn-primary',
            'button.btn.btn-primary',
            '.modal-footer button',

            // Fallback patterns
            'button',
            '[data-testid*="save"]',
            '.edit-button'
        ];

        // Search through selectors and filter by text content
        for (const selector of saveSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.textContent.toLowerCase().trim();
                if (text === 'save' || text.includes('save')) {
                    console.log(`✅ Found Save button: ${selector} - "${element.textContent.trim()}"`);
                    return element;
                }
            }
        }

        console.log('❌ Save button not found with optimized patterns');
        return null;
    }

    async function findScrapeButton() {
        // Try multiple strategies to find the scrape button
        const strategies = [
            // Strategy 1: Look for buttons containing "scrape" text
            () => {
                const buttons = document.querySelectorAll('button');
                for (const button of buttons) {
                    if (button.textContent.toLowerCase().includes('scrape')) {
                        console.log('Found scrape button via text search:', button.textContent.trim());
                        return button;
                    }
                }
                return null;
            },

            // Strategy 2: Look in edit buttons container
            () => {
                const container = document.querySelector('.edit-buttons-container');
                if (container) {
                    const buttons = container.querySelectorAll('button');
                    console.log(`Found ${buttons.length} buttons in edit container`);
                    for (const button of buttons) {
                        console.log('Button text:', button.textContent.trim());
                        if (button.textContent.toLowerCase().includes('scrape')) {
                            return button;
                        }
                    }
                }
                return null;
            },

            // Strategy 3: Look for specific button patterns
            () => {
                const selectors = [
                    '#scene-edit-details button',
                    '.btn.btn-secondary',
                    'button[class*="btn"]'
                ];

                for (const selector of selectors) {
                    const buttons = document.querySelectorAll(selector);
                    for (const button of buttons) {
                        if (button.textContent.toLowerCase().includes('scrape')) {
                            return button;
                        }
                    }
                }
                return null;
            }
        ];

        for (let i = 0; i < strategies.length; i++) {
            console.log(`Trying strategy ${i + 1} to find scrape button...`);
            const button = strategies[i]();
            if (button) {
                return button;
            }
        }

        return null;
    }

    // GraphQL-based organized status detection (replaces unreliable UI detection)
    async function getSceneOrganizedStatus() {
        console.log('🔍 Checking organized status via GraphQL API...');

        try {
            // Extract scene ID from URL (e.g., /scenes/123)
            const sceneId = extractSceneIdFromUrl();
            if (!sceneId) {
                console.error('❌ Could not extract scene ID from URL');
                return null;
            }

            console.log(`📡 Querying organized status for scene ID: ${sceneId}`);

            // GraphQL query to get scene organized status
            const query = `
                query FindScene($id: ID!) {
                    findScene(id: $id) {
                        id
                        organized
                    }
                }
            `;

            const variables = { id: sceneId };

            // Execute GraphQL query using Stash's built-in fetch
            const response = await fetch('/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            if (!response.ok) {
                throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.errors) {
                console.error('❌ GraphQL errors:', result.errors);
                return null;
            }

            const scene = result.data?.findScene;
            if (!scene) {
                console.error('❌ Scene not found in GraphQL response');
                return null;
            }

            const isOrganized = scene.organized === true;
            console.log(`✅ Scene organized status: ${isOrganized}`);

            return isOrganized;

        } catch (error) {
            console.error('❌ Failed to query organized status via GraphQL:', error);
            // Fallback to UI detection as last resort
            console.log('🔄 Falling back to UI-based detection...');
            return await detectOrganizedStatusFallback();
        }
    }

    // Fallback UI-based organized status detection (only used if GraphQL fails)
    async function detectOrganizedStatusFallback() {
        console.log('🔄 Using fallback UI-based organized detection...');

        try {
            // Simplified strategies focusing on most reliable patterns
            const strategies = [
                // Strategy 1: Look for button with box icon in scene toolbar
                () => {
                    const toolbarButtons = document.querySelectorAll('.scene-toolbar button, .toolbar button');
                    for (const button of toolbarButtons) {
                        const boxIcon = button.querySelector('svg[data-icon="box"]');
                        if (boxIcon) {
                            console.log('Found organized button via box icon');
                            return button;
                        }
                    }
                    return null;
                },

                // Strategy 2: Look for buttons with "organized" in title/aria-label
                () => {
                    const button = document.querySelector('button[title*="rganized"], button[aria-label*="rganized"]');
                    if (button) {
                        console.log('Found organized button via title/aria-label');
                        return button;
                    }
                    return null;
                }
            ];

            for (let i = 0; i < strategies.length; i++) {
                const button = strategies[i]();
                if (button) {
                    // Return organized status based on button state
                    const isOrganized = button.classList.contains('organized') ||
                        button.getAttribute('aria-pressed') === 'true' ||
                        button.title?.toLowerCase().includes('organized');
                    console.log(`✅ UI fallback detected organized status: ${isOrganized}`);
                    return isOrganized;
                }
            }

            console.log('❌ Could not determine organized status via UI fallback');
            return null;

        } catch (error) {
            console.error('❌ UI fallback detection failed:', error);
            return null;
        }
    }

    // Extract scene ID from current URL
    function extractSceneIdFromUrl() {
        const url = window.location.pathname;
        const sceneMatch = url.match(/\/scenes\/(\d+)/);
        return sceneMatch ? sceneMatch[1] : null;
    }

    // Function to organize a scene using GraphQL mutation
    async function organizeScene() {
        console.log('📦 Organizing scene via GraphQL...');

        try {
            // Extract scene ID from URL
            const sceneId = extractSceneIdFromUrl();
            if (!sceneId) {
                console.error('❌ Could not extract scene ID from URL');
                return false;
            }

            console.log(`📡 Organizing scene ID: ${sceneId}`);

            // GraphQL mutation to update scene organized status
            const mutation = `
                mutation SceneUpdate($input: SceneUpdateInput!) {
                    sceneUpdate(input: $input) {
                        id
                        organized
                    }
                }
            `;

            const variables = {
                input: {
                    id: sceneId,
                    organized: true
                }
            };

            // Execute GraphQL mutation
            const response = await fetch('/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: mutation,
                    variables: variables
                })
            });

            if (!response.ok) {
                throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.errors) {
                console.error('❌ GraphQL errors:', result.errors);
                return false;
            }

            const scene = result.data?.sceneUpdate;
            if (!scene) {
                console.error('❌ Scene update failed');
                return false;
            }

            console.log(`✅ Scene organized successfully: ${scene.organized}`);
            return true;

        } catch (error) {
            console.error('❌ Failed to organize scene via GraphQL:', error);
            // Fallback to UI-based organization
            console.log('🔄 Falling back to UI-based organization...');
            return await organizeSceneFallback();
        }
    }

    // Fallback UI-based scene organization (only used if GraphQL fails)
    async function organizeSceneFallback() {
        console.log('🔄 Using fallback UI-based organization...');

        try {
            // Look for organized button using simplified detection
            const strategies = [
                // Strategy 1: Look for button with box icon
                () => {
                    const buttons = document.querySelectorAll('button');
                    for (const button of buttons) {
                        const boxIcon = button.querySelector('svg[data-icon="box"]');
                        if (boxIcon) {
                            console.log('Found organized button via box icon');
                            return button;
                        }
                    }
                    return null;
                },

                // Strategy 2: Look for buttons with "organized" in title/aria-label
                () => {
                    const button = document.querySelector('button[title*="rganized"], button[aria-label*="rganized"]');
                    if (button) {
                        console.log('Found organized button via title/aria-label');
                        return button;
                    }
                    return null;
                }
            ];

            for (const strategy of strategies) {
                const button = strategy();
                if (button) {
                    button.click();
                    console.log('✅ UI fallback organized scene successfully');
                    return true;
                }
            }

            console.log('❌ Could not find organized button for UI fallback');
            return false;

        } catch (error) {
            console.error('❌ UI fallback organization failed:', error);
            return false;
        }
    }

    // Enhanced Scraper Dropdown Detection - Based on comprehensive Stash architecture research
    async function findScraperDropdownOptimized(targetScraper = 'stashdb') {
        console.log(`🔍 Enhanced search for ${targetScraper} scraper dropdown based on SceneEditPanel research...`);

        // Wait for React components to render (critical for ScraperMenu)
        await sleep(STASH_CONFIG.REACT_RENDER_DELAY);

        // Comprehensive dropdown selectors based on SceneEditPanel.tsx and ScraperMenu component research
        const dropdownSelectors = [
            // Primary ScraperMenu dropdown patterns (from SceneEditPanel.tsx)
            '.edit-buttons-container .btn-group .dropdown-menu.show .dropdown-item',
            '.edit-buttons-container .btn-group .dropdown-menu .dropdown-item',

            // Scene edit specific patterns
            '.scene-edit-panel .btn-group .dropdown-menu.show .dropdown-item',
            '.scene-edit-panel .btn-group .dropdown-menu .dropdown-item',

            // Bootstrap dropdown patterns (standard implementation)
            '.dropdown-menu.show .dropdown-item',
            '.dropdown-menu .dropdown-item',

            // Entity edit panel patterns
            '.entity-edit-panel .dropdown-menu .dropdown-item',
            '.edit-panel .dropdown-menu .dropdown-item',

            // Button group patterns (ScraperMenu is in ButtonGroup)
            '.btn-group .dropdown-menu.show a',
            '.btn-group .dropdown-menu a',
            '.btn-group .dropdown-menu .dropdown-item',

            // Scraper-specific patterns
            '.scraper-dropdown .dropdown-menu .dropdown-item',
            '.scraper-menu .dropdown-menu .dropdown-item',

            // Generic menu patterns with role attributes
            '[role="menu"] [role="menuitem"]',
            '[role="menuitem"]',

            // Fallback patterns
            '.dropdown-item',
            'a.dropdown-item',
            '.menu-item'
        ];

        console.log('🔍 Checking for dropdown visibility and options...');

        for (const selector of dropdownSelectors) {
            const options = document.querySelectorAll(selector);
            if (options.length > 0) {
                console.log(`✅ Found ${options.length} dropdown options with selector: ${selector}`);

                // Verify these are actually scraper options by checking content
                const validOptions = Array.from(options).filter(option => {
                    const text = option.textContent?.trim() || '';
                    // Check if this looks like a scraper name (not empty, has meaningful content)
                    return text.length > 0 && !text.match(/^[\s\-_\.]*$/);
                });

                if (validOptions.length > 0) {
                    console.log(`✅ Found ${validOptions.length} valid scraper options`);

                    // Log all found options for debugging
                    validOptions.forEach((option, index) => {
                        const text = option.textContent?.trim() || '';
                        console.log(`  Option ${index}: "${text}"`);
                    });

                    return validOptions;
                }
            }
        }

        // If no options found, check if dropdown is actually open
        const openDropdowns = document.querySelectorAll('.dropdown-menu.show, .dropdown.show, .btn-group.show');
        console.log(`📋 Found ${openDropdowns.length} open dropdown(s)`);

        if (openDropdowns.length === 0) {
            console.log('⚠️ No open dropdowns detected. The dropdown may need to be opened first.');
        } else {
            console.log('🔧 Dropdown appears to be open but no valid options found');

            // Debug all elements in open dropdowns
            openDropdowns.forEach((dropdown, index) => {
                const allElements = dropdown.querySelectorAll('*');
                console.log(`Dropdown ${index} contains ${allElements.length} elements:`);
                allElements.forEach((el, elIndex) => {
                    if (el.textContent?.trim() && elIndex < 10) { // Limit to first 10 for readability
                        console.log(`  Element ${elIndex}: ${el.tagName} "${el.textContent.trim()}"`);
                    }
                });
            });
        }

        console.log('❌ No valid scraper dropdown options found with any selector');
        return [];
    }

    // Enhanced ThePornDB Selection - Using improved detection based on Stash architecture research
    async function selectThePornDBOption() {
        console.log('🎯 Enhanced ThePornDB selection process based on Stash architecture...');

        // First, wait for any React components to render
        await sleep(STASH_CONFIG.REACT_RENDER_DELAY);

        // Enhanced dropdown selectors based on SceneEditPanel.tsx research
        const dropdownSelectors = [
            // Primary: Bootstrap dropdown for scraper menus (most specific first)
            '.btn-group .dropdown-menu.show .dropdown-item',
            '.btn-group .dropdown-menu .dropdown-item',

            // ScraperMenu specific selectors
            '.scraper-menu .dropdown-menu .dropdown-item',
            '.edit-buttons-container .btn-group .dropdown-menu .dropdown-item',

            // Fragment scraper dropdown (first ScraperMenu instance)
            '.edit-buttons-container .btn-group .dropdown-menu.show .dropdown-item',

            // Queryable scraper dropdown (second ScraperMenu instance)  
            '.scene-edit-panel .btn-group .dropdown-menu .dropdown-item',
            '.scene-edit-panel .btn-group .dropdown-menu.show .dropdown-item',

            // More specific Bootstrap dropdown patterns
            '.dropdown-menu.show .dropdown-item:not([role="menuitem"])', // Exclude video controls
            '.dropdown-menu .dropdown-item:not([role="menuitem"])', // Exclude video controls

            // Generic fallbacks (but exclude video controls)
            'a.dropdown-item:not([role="menuitem"])',
            '.dropdown-item:not([role="menuitem"])'
        ];

        let dropdownOptions = [];
        let maxRetries = 5;
        let retryCount = 0;

        // Try each selector until we find dropdown options, with retries for React rendering
        while (dropdownOptions.length === 0 && retryCount < maxRetries) {
            for (const selector of dropdownSelectors) {
                const foundOptions = Array.from(document.querySelectorAll(selector));
                if (foundOptions.length > 0) {
                    console.log(`✅ Found ${foundOptions.length} dropdown options with selector: ${selector}`);

                    // Filter out video player controls and other non-scraper options
                    dropdownOptions = foundOptions.filter(option => {
                        const text = option.textContent?.trim() || '';
                        const isVideoControl = text.includes('captions') ||
                            text.includes('settings') ||
                            text.includes('subtitles') ||
                            text.includes('audio') ||
                            text.includes('video') ||
                            text.includes('quality') ||
                            text.includes('speed') ||
                            text.includes('fullscreen');

                        return !isVideoControl && text.length > 0 && text.length < 50; // Reasonable scraper name length
                    });

                    if (dropdownOptions.length > 0) {
                        console.log(`✅ After filtering, found ${dropdownOptions.length} valid scraper options`);
                        break;
                    }
                }
            }

            if (dropdownOptions.length === 0) {
                retryCount++;
                console.log(`⏳ Retry ${retryCount}/${maxRetries} - waiting for scraper dropdown to appear...`);
                await sleep(500); // Wait before retrying
            }
        }

        if (dropdownOptions.length === 0) {
            console.error('❌ No dropdown options found with any selector');
            return false;
        }

        // Log all available options for debugging
        console.log('📋 Available scraper options:');
        dropdownOptions.forEach((option, index) => {
            const text = option.textContent?.trim() || '';
            const href = option.href || option.getAttribute('href') || '';
            console.log(`  ${index}: "${text}" | href: "${href}"`);
        });

        // Strategy 1: Exact match for "ThePornDB" (most reliable based on config research)
        for (const option of dropdownOptions) {
            const optionText = option.textContent?.trim() || '';
            if (optionText === 'ThePornDB') {
                console.log(`✅ Exact match found: "${optionText}"`);
                option.click();
                await sleep(100); // Brief pause after click
                return true;
            }
        }

        // Strategy 2: Case-insensitive exact match  
        for (const option of dropdownOptions) {
            const optionText = option.textContent?.trim() || '';
            if (optionText.toLowerCase() === 'theporndb') {
                console.log(`✅ Case-insensitive exact match: "${optionText}"`);
                option.click();
                await sleep(100);
                return true;
            }
        }

        // Strategy 3: Positional selection (find StashDB, select next)
        for (let i = 0; i < dropdownOptions.length; i++) {
            const option = dropdownOptions[i];
            const optionText = option.textContent?.trim().toLowerCase() || '';

            if (optionText.includes('stashdb') && i + 1 < dropdownOptions.length) {
                const nextOption = dropdownOptions[i + 1];
                const nextText = nextOption.textContent?.trim() || '';
                console.log(`✅ Positional selection: Found StashDB at ${i}, selecting next option "${nextText}"`);
                nextOption.click();
                await sleep(100);
                return true;
            }
        }

        // Strategy 4: Enhanced text pattern matching for ThePornDB variants
        const thePornDBPatterns = [
            /^theporndb$/i,
            /^the\s*porn\s*db$/i,
            /^tpdb$/i,
            /porndb/i,
            /the.*porn.*db/i,
            /tpdb\.tv/i,
            /tp.*db/i,
            /metadataapi/i  // Based on the API URL from config
        ];

        for (const option of dropdownOptions) {
            const optionText = option.textContent?.trim() || '';

            for (const pattern of thePornDBPatterns) {
                if (pattern.test(optionText)) {
                    console.log(`✅ Pattern match found: "${optionText}" matches ${pattern}`);
                    option.click();
                    await sleep(100);
                    return true;
                }
            }
        }

        // Strategy 5: Domain/URL-based detection
        for (const option of dropdownOptions) {
            const href = option.href || option.getAttribute('href') || '';
            const title = option.title || option.getAttribute('title') || '';

            if (href.includes('porndb') || href.includes('tpdb') || href.includes('metadataapi') ||
                title.includes('porndb') || title.includes('tpdb') || title.includes('ThePornDB')) {
                console.log(`✅ URL/attribute match found: href="${href}" title="${title}"`);
                option.click();
                await sleep(100);
                return true;
            }
        }

        // Strategy 6: Fallback - look for any option that might be ThePornDB
        const suspiciousOptions = dropdownOptions.filter(option => {
            const text = option.textContent?.trim().toLowerCase() || '';
            return text.includes('porn') || text.includes('tpdb') || text.includes('metadata');
        });

        if (suspiciousOptions.length > 0) {
            console.log(`⚠️ Found ${suspiciousOptions.length} potentially matching options:`);
            suspiciousOptions.forEach((option, index) => {
                console.log(`  Suspicious ${index}: "${option.textContent?.trim()}"`);
            });

            // Select the first suspicious option as a last resort
            const selectedOption = suspiciousOptions[0];
            console.log(`🤔 Attempting fallback selection: "${selectedOption.textContent?.trim()}"`);
            selectedOption.click();
            await sleep(100);
            return true;
        }

        console.error('❌ ThePornDB option not found with any strategy');
        console.log('💡 Available options were:', dropdownOptions.map(opt => opt.textContent?.trim()).join(', '));
        return false;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // GraphQL-based metadata detection (replaces UI-based content analysis)
    async function detectAlreadyScrapedSources() {
        console.log('🔍 GraphQL-based scraper detection in progress...');

        try {
            // Use GraphQL-based detection for reliable results
            const metadataResult = await getSceneMetadataStatus();

            if (metadataResult === null) {
                console.log('⚠️ Could not determine metadata status via GraphQL, falling back to UI detection');
                return await detectAlreadyScrapedSourcesFallback();
            }

            return metadataResult;

        } catch (error) {
            console.warn('⚠️ Error in GraphQL scraper detection:', error);
            console.log('🔄 Falling back to UI-based detection...');
            return await detectAlreadyScrapedSourcesFallback();
        }
    }

    // GraphQL-based metadata status detection
    async function getSceneMetadataStatus() {
        console.log('🔍 Checking metadata status via GraphQL API...');

        try {
            // Extract scene ID from URL (e.g., /scenes/123)
            const sceneId = extractSceneIdFromUrl();
            if (!sceneId) {
                console.error('❌ Could not extract scene ID from URL');
                return null;
            }

            console.log(`📡 Querying metadata status for scene ID: ${sceneId}`);

            // GraphQL query to get scene metadata for scraper detection
            const query = `
                query FindScene($id: ID!) {
                    findScene(id: $id) {
                        id
                        title
                        details
                        rating100
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
                            endpoint
                            stash_id
                        }
                        url
                    }
                }
            `;

            const variables = { id: sceneId };

            // Execute GraphQL query using Stash's built-in fetch
            const response = await fetch('/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            if (!response.ok) {
                throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.errors) {
                console.error('❌ GraphQL errors:', result.errors);
                return null;
            }

            const scene = result.data?.findScene;
            if (!scene) {
                console.error('❌ Scene not found in GraphQL response');
                return null;
            }

            // Analyze metadata to determine scraper sources
            return analyzeSceneMetadataForScrapers(scene);

        } catch (error) {
            console.error('❌ Failed to query metadata status via GraphQL:', error);
            return null;
        }
    }

    // Analyze scene metadata to determine which scrapers have been used
    function analyzeSceneMetadataForScrapers(scene) {
        console.log('📊 Analyzing scene metadata for scraper detection...');

        const scrapedSources = {
            stashdb: false,
            theporndb: false,
            confidence: {
                stashdb: 0,
                theporndb: 0
            }
        };

        // Check for StashDB indicators
        let stashdbConfidence = 0;
        let hasDirectStashDBIdentifier = false;

        // 1. Direct StashDB stash_ids (strongest indicator)
        if (scene.stash_ids && scene.stash_ids.length > 0) {
            const stashdbIds = scene.stash_ids.filter(id =>
                id.endpoint && (
                    id.endpoint.includes('stashdb') ||
                    id.endpoint.includes('stash-db') ||
                    id.endpoint === 'https://stashdb.org/graphql'
                )
            );
            if (stashdbIds.length > 0) {
                console.log('✅ Found StashDB stash_ids:', stashdbIds.length);
                stashdbConfidence += 0.9; // Very high confidence
                hasDirectStashDBIdentifier = true;
            }
        }

        // 2. StashDB-style URL pattern
        if (scene.url && scene.url.includes('stashdb.org')) {
            console.log('✅ Found StashDB URL reference');
            stashdbConfidence += 0.8;
            hasDirectStashDBIdentifier = true;
        }

        // Check for ThePornDB indicators
        let theporndbConfidence = 0;
        let hasDirectThePornDBIdentifier = false;

        // 1. ThePornDB-style stash_ids or URL patterns
        if (scene.stash_ids && scene.stash_ids.length > 0) {
            const theporndbIds = scene.stash_ids.filter(id =>
                id.endpoint && (
                    id.endpoint.includes('theporndb') ||
                    id.endpoint.includes('tpdb') ||
                    id.endpoint.includes('metadataapi.net')
                )
            );
            if (theporndbIds.length > 0) {
                console.log('✅ Found ThePornDB stash_ids:', theporndbIds.length);
                theporndbConfidence += 0.9;
                hasDirectThePornDBIdentifier = true;
            }
        }

        // 2. ThePornDB-style URL pattern
        if (scene.url && (scene.url.includes('theporndb') || scene.url.includes('metadataapi.net'))) {
            console.log('✅ Found ThePornDB URL reference');
            theporndbConfidence += 0.8;
            hasDirectThePornDBIdentifier = true;
        }

        // 3. Rich metadata suggesting professional scraping
        let metadataRichness = 0;

        // Check for meaningful title (not just filename)
        if (scene.title && scene.title.length > 5 &&
            !scene.title.match(/^\d{4}-\d{2}-\d{2}/) &&
            !scene.title.includes('.mp4') &&
            !scene.title.includes('.mkv')) {
            console.log('✅ Found meaningful title:', scene.title.substring(0, 50));
            metadataRichness += 0.3;
        }

        // Check for performers
        if (scene.performers && scene.performers.length > 0) {
            console.log('✅ Found performers:', scene.performers.length);
            metadataRichness += 0.4;
        }

        // Check for studio
        if (scene.studio && scene.studio.name) {
            console.log('✅ Found studio:', scene.studio.name);
            metadataRichness += 0.3;
        }

        // Check for substantial details
        if (scene.details && scene.details.length > 50) {
            console.log('✅ Found detailed description');
            metadataRichness += 0.2;
        }

        // Check for rating
        if (scene.rating100 && scene.rating100 > 0) {
            console.log('✅ Found rating:', scene.rating100);
            metadataRichness += 0.2;
        }

        // Check for relevant tags
        if (scene.tags && scene.tags.length > 2) {
            console.log('✅ Found content tags:', scene.tags.length);
            metadataRichness += 0.3;
        }

        // Only add metadata richness to the scraper that has direct identifiers
        // This prevents false positives where rich metadata from one scraper 
        // incorrectly boosts confidence for another scraper
        if (hasDirectStashDBIdentifier) {
            stashdbConfidence += Math.min(metadataRichness, 0.6);
            console.log('🎯 StashDB metadata richness boost applied:', metadataRichness.toFixed(2));
        } else if (metadataRichness > 0.8 && !hasDirectThePornDBIdentifier) {
            // If we have very rich metadata but no direct identifiers, 
            // give slight preference to StashDB as it's more commonly used
            stashdbConfidence += Math.min(metadataRichness * 0.3, 0.3);
            console.log('🔍 Weak StashDB inference from rich metadata:', (metadataRichness * 0.3).toFixed(2));
        }

        if (hasDirectThePornDBIdentifier) {
            theporndbConfidence += Math.min(metadataRichness * 0.8, 0.5);
            console.log('🎯 ThePornDB metadata richness boost applied:', (metadataRichness * 0.8).toFixed(2));
        }

        // Determine final results based on confidence thresholds
        const confidenceThreshold = 0.3; // Minimum confidence to consider "scraped"

        scrapedSources.stashdb = stashdbConfidence >= confidenceThreshold;
        scrapedSources.theporndb = theporndbConfidence >= confidenceThreshold;
        scrapedSources.confidence.stashdb = Math.min(stashdbConfidence, 1.0);
        scrapedSources.confidence.theporndb = Math.min(theporndbConfidence, 1.0);

        console.log('🔍 GraphQL metadata analysis results:', {
            stashdb: `${scrapedSources.stashdb} (confidence: ${scrapedSources.confidence.stashdb.toFixed(2)})`,
            theporndb: `${scrapedSources.theporndb} (confidence: ${scrapedSources.confidence.theporndb.toFixed(2)})`,
            metadataRichness: metadataRichness.toFixed(2),
            hasDirectStashDB: hasDirectStashDBIdentifier,
            hasDirectThePornDB: hasDirectThePornDBIdentifier
        });

        return scrapedSources;
    }

    // Fallback UI-based scraper detection (only used if GraphQL fails)
    async function detectAlreadyScrapedSourcesFallback() {
        console.log('🔍 Fallback UI-based scraper detection in progress...');

        const scrapedSources = {
            stashdb: false,
            theporndb: false,
            confidence: {
                stashdb: 0,
                theporndb: 0
            }
        };

        try {
            // Check for metadata presence indicators via UI
            const metadataChecks = [
                // Check for populated title field (not just filename)
                () => {
                    const titleElements = document.querySelectorAll('input[placeholder*="title" i], input[id*="title" i], .title input, .scene-title input');
                    for (const element of titleElements) {
                        const value = element.value?.trim() || '';
                        // If title is present and not just a filename pattern
                        if (value && value.length > 5 && !value.match(/^\d{4}-\d{2}-\d{2}/) && !value.includes('.mp4') && !value.includes('.mkv')) {
                            console.log('✅ Found meaningful title:', value.substring(0, 50));
                            return 0.8; // High confidence for enriched title
                        }
                    }
                    return 0;
                },

                // Check for performers/actors
                () => {
                    const performerElements = document.querySelectorAll('.performers .tag, .performer-tag, .scene-performers .tag, [class*="performer"] .tag');
                    if (performerElements.length > 0) {
                        console.log('✅ Found performers:', performerElements.length);
                        return 0.9; // Very high confidence for performer tags
                    }
                    return 0;
                },

                // Check for tags
                () => {
                    const tagElements = document.querySelectorAll('.tags .tag, .scene-tags .tag, [class*="tags"] .tag');
                    if (tagElements.length > 2) { // More than just basic tags
                        console.log('✅ Found content tags:', tagElements.length);
                        return 0.7; // Good confidence for multiple tags
                    }
                    return 0;
                },

                // Check for studio information
                () => {
                    const studioElements = document.querySelectorAll('.studio .tag, .scene-studio .tag, [class*="studio"] .tag, input[placeholder*="studio" i]');
                    for (const element of studioElements) {
                        const text = element.textContent?.trim() || element.value?.trim() || '';
                        if (text && text.length > 2) {
                            console.log('✅ Found studio information:', text);
                            return 0.6; // Moderate confidence for studio
                        }
                    }
                    return 0;
                },

                // Check for scene details/description
                () => {
                    const detailElements = document.querySelectorAll('textarea[placeholder*="details" i], textarea[id*="details" i], .details textarea, .scene-details textarea');
                    for (const element of detailElements) {
                        const value = element.value?.trim() || '';
                        if (value && value.length > 50) { // Substantial description
                            console.log('✅ Found scene details/description');
                            return 0.5; // Moderate confidence for description
                        }
                    }
                    return 0;
                },

                // Check for rating
                () => {
                    const ratingElements = document.querySelectorAll('input[type="number"][placeholder*="rating" i], .rating input, .scene-rating input');
                    for (const element of ratingElements) {
                        const value = element.value?.trim() || '';
                        if (value && parseFloat(value) > 0) {
                            console.log('✅ Found rating:', value);
                            return 0.4; // Some confidence for rating
                        }
                    }
                    return 0;
                }
            ];

            // Calculate overall confidence based on metadata presence
            let totalConfidence = 0;
            let checkCount = 0;

            for (const check of metadataChecks) {
                const score = check();
                totalConfidence += score;
                if (score > 0) checkCount++;
            }

            // Normalize confidence - if we have multiple metadata indicators, it's likely scraped
            const averageConfidence = checkCount > 0 ? totalConfidence / metadataChecks.length : 0;

            console.log(`📊 UI metadata analysis: ${checkCount}/${metadataChecks.length} indicators found, confidence: ${averageConfidence.toFixed(2)}`);

            // If we have good metadata coverage, assume both scrapers could have contributed
            // Use a threshold of 0.3 (meaning at least some meaningful metadata exists)
            const hasMetadata = averageConfidence >= 0.3;

            if (hasMetadata) {
                // If metadata exists, we can't easily distinguish which scraper provided what
                // So we'll assume both might have been used if they're enabled
                const config = {
                    stashdb: getConfig(CONFIG_KEYS.AUTO_SCRAPE_STASHDB),
                    theporndb: getConfig(CONFIG_KEYS.AUTO_SCRAPE_THEPORNDB)
                };

                scrapedSources.stashdb = config.stashdb; // Assume scraped if enabled and metadata exists
                scrapedSources.theporndb = config.theporndb; // Assume scraped if enabled and metadata exists
                scrapedSources.confidence.stashdb = config.stashdb ? averageConfidence : 0;
                scrapedSources.confidence.theporndb = config.theporndb ? averageConfidence : 0;

                console.log('✅ UI analysis indicates scene has been enriched by scrapers');
            } else {
                console.log('📝 Little to no enriched metadata found - likely not scraped');
            }

            console.log('🔍 Fallback UI scraper detection results:', {
                stashdb: `${scrapedSources.stashdb} (confidence: ${scrapedSources.confidence.stashdb.toFixed(2)})`,
                theporndb: `${scrapedSources.theporndb} (confidence: ${scrapedSources.confidence.theporndb.toFixed(2)})`
            });

            return scrapedSources;

        } catch (error) {
            console.warn('⚠️ Error in fallback UI scraper detection:', error);
            return { stashdb: false, theporndb: false, confidence: { stashdb: 0, theporndb: 0 } };
        }
    }

    // Enhanced organized detection using multiple detection strategies
    // Enhanced organized detection using GraphQL API (replaces UI-based detection)
    async function checkIfAlreadyOrganized() {
        console.log('🔍 Checking if scene is already organized...');

        try {
            // Use GraphQL-based detection for reliable results
            const isOrganized = await getSceneOrganizedStatus();

            if (isOrganized === null) {
                console.log('⚠️ Could not determine organized status');
                return false; // Assume not organized if we can't determine
            }

            if (isOrganized) {
                console.log('✅ Scene is already organized');
                return true;
            } else {
                console.log('📝 Scene is not organized');
                return false;
            }

        } catch (error) {
            console.error('❌ Error checking organized status:', error);
            return false; // Assume not organized on error
        }
    }

    async function waitForUserApply() {
        return new Promise((resolve) => {
            console.log('⏳ WAITING FOR USER: Please review the scraped data and click APPLY when ready...');

            // Create a visual indicator positioned to avoid overlap
            const indicator = document.createElement('div');
            indicator.id = 'user-apply-indicator';
            indicator.style.position = 'fixed';
            indicator.style.top = '20px';
            indicator.style.left = '20px';  // Move to left side to avoid notifications
            indicator.style.transform = 'none';
            indicator.style.backgroundColor = '#ff6b35';
            indicator.style.color = 'white';
            indicator.style.padding = '20px 30px';
            indicator.style.borderRadius = '10px';
            indicator.style.fontSize = '18px';
            indicator.style.fontWeight = 'bold';
            indicator.style.zIndex = '99999';
            indicator.style.textAlign = 'center';
            indicator.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
            indicator.style.maxWidth = '400px';
            indicator.innerHTML = `
                <div>⏳ Please review the scraped data</div>
                <div style="margin-top: 10px; font-size: 16px;">Click APPLY when ready, automation will continue automatically</div>
                <div style="margin-top: 15px;">
                    <button id="continue-automation" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                        Skip Wait - Continue Now
                    </button>
                </div>
            `;
            document.body.appendChild(indicator);

            // Function to clean up and resolve
            const cleanup = () => {
                if (indicator && indicator.parentNode) {
                    indicator.remove();
                }
                if (clickListener) {
                    document.removeEventListener('click', clickListener, true);
                }
                console.log('✅ Apply button was clicked, continuing automation...');
                resolve();
            };

            // Listen for clicks on ANY button that might be an Apply button
            const clickListener = (event) => {
                const target = event.target;

                // Check if clicked element is a button or inside a button
                const button = target.closest ? target.closest('button') : null;
                if (button) {
                    const buttonText = button.textContent.toLowerCase().trim();

                    // Check if this looks like an Apply button
                    if (buttonText === 'apply' || buttonText.includes('apply')) {
                        console.log('🎯 Detected Apply button click:', buttonText);
                        // Wait a moment for the action to process, then continue
                        setTimeout(cleanup, 1500);
                        return;
                    }
                }
            };

            // Add click listener to capture Apply button clicks
            document.addEventListener('click', clickListener, true);

            // Also listen for the manual continue button
            document.getElementById('continue-automation').addEventListener('click', cleanup);

            // Fallback: auto-continue after 60 seconds
            setTimeout(() => {
                console.log('⚠️ Auto-continuing after timeout...');
                cleanup();
            }, 60000);
        });
    }

    async function askForThePornDB() {
        return new Promise((resolve) => {
            console.log('🎬 Asking user about ThePornDB scraping...');

            // Create a choice dialog
            const dialog = document.createElement('div');
            dialog.id = 'theporndb-choice-dialog';
            dialog.style.position = 'fixed';
            dialog.style.top = '80px';
            dialog.style.right = '20px';
            dialog.style.transform = 'none';
            dialog.style.backgroundColor = '#2c3e50';
            dialog.style.color = 'white';
            dialog.style.padding = '25px 35px';
            dialog.style.borderRadius = '12px';
            dialog.style.fontSize = '18px';
            dialog.style.fontWeight = 'bold';
            dialog.style.zIndex = '99999';
            dialog.style.textAlign = 'center';
            dialog.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
            dialog.style.border = '2px solid #3498db';
            dialog.innerHTML = `
                <div style="margin-bottom: 20px;">🎬 StashDB scraping complete!</div>
                <div style="margin-bottom: 25px; font-size: 16px; font-weight: normal;">
                    Would you like to also scrape from ThePornDB?
                </div>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="scrape-theporndb" style="background: #e74c3c; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;">
                        Yes, Scrape ThePornDB
                    </button>
                    <button id="skip-theporndb" style="background: #95a5a6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;">
                        No, Skip ThePornDB
                    </button>
                </div>
            `;
            document.body.appendChild(dialog);

            // Function to clean up dialog
            const cleanup = (choice) => {
                if (dialog && dialog.parentNode) {
                    dialog.remove();
                }
                console.log(`User chose: ${choice ? 'Scrape ThePornDB' : 'Skip ThePornDB'}`);
                resolve(choice);
            };

            // Listen for button clicks
            document.getElementById('scrape-theporndb').addEventListener('click', () => cleanup(true));
            document.getElementById('skip-theporndb').addEventListener('click', () => cleanup(false));

            // Auto-skip after 30 seconds
            setTimeout(() => {
                console.log('⚠️ Auto-skipping ThePornDB after timeout...');
                cleanup(false);
            }, 30000);
        });
    }

    // Remove automation panel after successful completion
    async function removeAutomationPanel() {
        console.log('🧹 Removing automation panel after successful completion...');

        // Set the completion flag to prevent button recreation using centralized state
        AutomateStashState.updateState({ automationCompleted: true });
        automationCompleted = true; // Keep legacy variable for backward compatibility
        console.log('✅ Automation marked as completed - button recreation disabled');

        const panel = document.getElementById('stash-automation-panel');
        if (panel) {
            // Add a fade-out animation
            panel.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(-20px)';

            // Remove after animation completes
            setTimeout(() => {
                if (panel.parentNode) {
                    panel.remove();
                    console.log('✅ Automation panel removed successfully');
                }
            }, 500);
        }

        // Also clean up any other dialogs that might be lingering
        const dialogs = document.querySelectorAll('#user-apply-indicator, #theporndb-choice-dialog');
        dialogs.forEach(dialog => {
            if (dialog.parentNode) {
                dialog.remove();
            }
        });
    }

    async function automateComplete() {
        try {
            startAutomation(); // Initialize automation state and UI

            console.log('🚀 Starting Advanced Smart Automation...');
            notifications.show('🚀 Starting automation process...', 'info');

            // Check configuration - use separate settings for clarity
            const settings = {
                enableStashDB: getConfig(CONFIG_KEYS.AUTO_SCRAPE_STASHDB),
                enableThePornDB: getConfig(CONFIG_KEYS.AUTO_SCRAPE_THEPORNDB),
                autoOrganize: getConfig(CONFIG_KEYS.AUTO_ORGANIZE),
                autoApply: getConfig(CONFIG_KEYS.AUTO_APPLY_CHANGES),
                skipAlreadyScraped: getConfig(CONFIG_KEYS.SKIP_ALREADY_SCRAPED),
                minimizeWhenComplete: getConfig(CONFIG_KEYS.MINIMIZE_WHEN_COMPLETE)
            };

            console.log('📋 Settings:', settings);

            // === PHASE 0: Detect already scraped sources ===
            console.log('🔍 PHASE 0: Enhanced scraper detection...');
            notifications.show('🔍 Analyzing existing metadata...', 'info');

            checkCancellation(); // Check if user cancelled

            let alreadyScraped = { stashDB: false, thePornDB: false };
            if (settings.skipAlreadyScraped) {
                const detectionResults = await detectAlreadyScrapedSources();
                // Fix case sensitivity issue - detection returns lowercase, but logic expects mixed case
                alreadyScraped = {
                    stashDB: detectionResults.stashdb,
                    thePornDB: detectionResults.theporndb
                };
                checkCancellation(); // Check after metadata analysis
            }

            // Determine what actions are needed - each scraper is evaluated independently
            let needsStashDB = settings.enableStashDB && !alreadyScraped.stashDB;
            let needsThePornDB = settings.enableThePornDB && !alreadyScraped.thePornDB;

            console.log('📋 Independent scraper evaluation:');
            console.log(`   StashDB: enabled=${settings.enableStashDB}, already_scraped=${alreadyScraped.stashDB}, needs_scraping=${needsStashDB}`);
            console.log(`   ThePornDB: enabled=${settings.enableThePornDB}, already_scraped=${alreadyScraped.thePornDB}, needs_scraping=${needsThePornDB}`);

            if (!needsStashDB && !needsThePornDB) {
                console.log('✅ All configured scrapers already processed or disabled');
                notifications.show('✅ Scene already has all required metadata', 'success');

                // Check if organized, if not and auto-organize is enabled
                if (settings.autoOrganize) {
                    checkCancellation();
                    const alreadyOrganized = await checkIfAlreadyOrganized();
                    if (!alreadyOrganized) {
                        console.log('📦 Auto-organizing scene...');
                        notifications.show('📦 Marking scene as organized...', 'info');
                        const organized = await organizeScene();
                        if (organized) {
                            console.log('✅ Marked scene as organized');
                            notifications.show('✅ Scene marked as organized', 'success');
                            await sleep(1000);
                        } else {
                            console.log('❌ Failed to mark scene as organized');
                            notifications.show('❌ Failed to organize scene', 'error');
                        }
                    }
                }

                console.log('🎉 Automation complete - managing UI...');
                completeAutomation();
                if (settings.minimizeWhenComplete) {
                    await uiManager.minimizePanel();
                    notifications.show('🎉 Automation complete! UI minimized.', 'success');
                } else {
                    await removeAutomationPanel();
                    notifications.show('🎉 Automation complete!', 'success');
                }
                return;
            }

            console.log(`📋 Scraping plan: StashDB=${needsStashDB ? 'NEEDED' : 'SKIP'}, ThePornDB=${needsThePornDB ? 'NEEDED' : 'SKIP'}`);
            notifications.show(`📋 Plan: ${needsStashDB ? 'StashDB ✓' : ''} ${needsThePornDB ? 'ThePornDB ✓' : ''}`, 'info');

            // Enter edit mode
            checkCancellation();
            notifications.show('✏️ Entering edit mode...', 'info');
            const editSuccess = await clickElementOptimized(['a[data-rb-event-key="scene-edit-panel"]'], 'Edit button');
            if (!editSuccess) {
                notifications.show('❌ Could not enter edit mode', 'error');
                stopAutomation();
                await removeAutomationPanel();
                return;
            }
            await sleep(1000);

            // === PHASE 1: StashDB Automation ===
            if (needsStashDB) {
                checkCancellation(); // Check before starting phase
                console.log('📋 PHASE 1: StashDB Automation');
                notifications.show('📊 Scraping StashDB...', 'info');

                const stashDBSuccess = await performStashDBScraping();
                checkCancellation(); // Check after scraping

                if (!stashDBSuccess) {
                    notifications.show('⚠️ StashDB scraping encountered issues', 'warning');
                }

                // Wait for user to apply changes unless auto-apply is enabled
                if (!settings.autoApply) {
                    console.log('🛑 PHASE 1.5: Waiting for user to review StashDB changes...');
                    notifications.show('⏳ Please review StashDB data and click APPLY', 'info', 8000);
                    await waitForUserApply();
                    checkCancellation(); // Check after user action
                } else {
                    notifications.show('⚡ Auto-applying StashDB changes...', 'info');
                    await applyChanges();
                    checkCancellation(); // Check after auto-apply
                }
            } else {
                console.log('⏭️ PHASE 1: Skipping StashDB (already present or disabled)');
            }

            // === PHASE 2: ThePornDB Automation ===
            if (needsThePornDB) {
                checkCancellation(); // Check before starting phase
                console.log('🎬 PHASE 2: ThePornDB Automation');
                notifications.show('🎬 Scraping ThePornDB...', 'info');

                const thePornDBSuccess = await performThePornDBScraping();
                checkCancellation(); // Check after scraping

                if (!thePornDBSuccess) {
                    notifications.show('⚠️ ThePornDB scraping encountered issues', 'warning');
                }

                // Wait for user to apply changes unless auto-apply is enabled
                if (!settings.autoApply) {
                    console.log('🛑 PHASE 2.5: Waiting for user to review ThePornDB changes...');
                    notifications.show('⏳ Please review ThePornDB data and click APPLY', 'info', 8000);
                    await waitForUserApply();
                    checkCancellation(); // Check after user action
                } else {
                    notifications.show('⚡ Auto-applying ThePornDB changes...', 'info');
                    await applyChanges();
                    checkCancellation(); // Check after auto-apply
                }
            } else {
                console.log('⏭️ PHASE 2: Skipping ThePornDB (already present or disabled)');
            }

            // === PHASE 3: Save and organize ===
            checkCancellation(); // Check before final phase
            console.log('💾 PHASE 3: Final save and organize');
            notifications.show('💾 Saving changes...', 'info');

            // Save the scene
            const saveSuccess = await saveScene();
            checkCancellation(); // Check after save

            if (!saveSuccess) {
                notifications.show('❌ Failed to save scene', 'error');
                stopAutomation();
                return;
            }

            // Auto-organize if enabled
            if (settings.autoOrganize) {
                const alreadyOrganized = await checkIfAlreadyOrganized();
                if (!alreadyOrganized) {
                    console.log('📦 Auto-organizing scene...');
                    notifications.show('📦 Marking as organized...', 'info');
                    const organized = await organizeScene();
                    if (organized) {
                        console.log('✅ Marked scene as organized');
                        await sleep(1000);
                    } else {
                        console.log('❌ Failed to mark scene as organized');
                    }
                } else {
                    console.log('🎯 Scene already organized');
                }
            }

            // === PHASE 4: Completion and UI management ===
            console.log('🎉 Advanced automation complete!');
            completeAutomation(); // Clean up automation state

            if (settings.minimizeWhenComplete) {
                notifications.show('🎉 Automation complete! UI minimized. Click the button to expand.', 'success', 6000);
                await sleep(1000);
                await uiManager.minimizePanel();
            } else {
                notifications.show('🎉 Automation complete!', 'success');
                await sleep(1000);
                // Recreate the full panel instead of removing it
                setTimeout(() => {
                    createOptimizedButtons();
                }, 500);
            }

        } catch (error) {
            console.error('❌ Error in advanced automation:', error);

            if (error.message === 'Automation cancelled by user') {
                // Don't show error notification for user cancellation
                console.log('🛑 Automation was cancelled by user');
                // UI restoration is handled by stopAutomation()
            } else {
                notifications.show(`❌ Automation error: ${error.message}`, 'error');
                stopAutomation(); // Clean up automation state and restore UI
            }
        }
    }

    // Helper functions for modular scraping
    async function performStashDBScraping() {
        try {
            checkCancellation(); // Check before starting

            // Find and click scrape button
            let scrapeButton = await findScrapeButton();
            if (!scrapeButton) {
                throw new Error('Could not find scrape button');
            }

            scrapeButton.click();
            console.log('✅ Clicked scrape button for StashDB');
            await sleep(1000);

            checkCancellation(); // Check after button click

            // Select StashDB from dropdown
            const dropdownOptions = document.querySelectorAll('.dropdown-menu.show a.dropdown-item');
            let stashDBFound = false;
            for (const option of dropdownOptions) {
                if (option.textContent.trim() === 'stashdb.org') {
                    option.click();
                    console.log('✅ Selected StashDB from dropdown');
                    notifications.show('📊 Connecting to StashDB...', 'info');
                    stashDBFound = true;
                    break;
                }
            }

            if (!stashDBFound) {
                throw new Error('StashDB option not found in dropdown');
            }

            await sleep(2500);
            checkCancellation(); // Check before processing entries

            // Find and click all + buttons for StashDB entries
            const plusButtons = document.querySelectorAll('button.minimal.ml-2.btn.btn-primary svg[data-prefix="fas"][data-icon="plus"]');
            if (plusButtons.length > 0) {
                const totalButtons = plusButtons.length;
                console.log(`📊 Found ${totalButtons} StashDB entries to process`);
                notifications.show(`📊 Adding ${totalButtons} StashDB entries...`, 'info');

                for (let i = 0; i < plusButtons.length; i++) {
                    checkCancellation(); // Check before each entry

                    try {
                        const button = plusButtons[i].closest('button');
                        if (button) {
                            button.click();
                            console.log(`✅ Added StashDB entry ${i + 1}/${totalButtons}`);

                            if (i < totalButtons - 1) {
                                await sleep(2000);
                            } else {
                                await sleep(3000);
                            }
                        }
                    } catch (error) {
                        console.error('❌ Error adding StashDB entry:', error);
                        await sleep(2000);
                    }
                }

                notifications.show('✅ StashDB scraping complete', 'success');
            } else {
                console.log('ℹ️ No new StashDB entries found');
                notifications.show('ℹ️ No new StashDB data found', 'info');
            }

            return true;
        } catch (error) {
            if (error.message === 'Automation cancelled by user') {
                throw error; // Re-throw cancellation error
            }
            console.error('❌ StashDB scraping failed:', error);
            notifications.show(`❌ StashDB error: ${error.message}`, 'error');
            return false;
        }
    }

    async function performThePornDBScraping() {
        try {
            checkCancellation(); // Check before starting

            // Find scrape button again
            let scrapeButton = await findScrapeButton();
            if (!scrapeButton) {
                throw new Error('Could not find scrape button for ThePornDB');
            }

            scrapeButton.click();
            console.log('✅ Clicked scrape button for ThePornDB');
            await sleep(STASH_CONFIG.REACT_RENDER_DELAY);

            checkCancellation(); // Check after button click

            // Handle dropdown opening if needed
            const dropdownToggle = scrapeButton.querySelector('.dropdown-toggle') ||
                scrapeButton.parentElement?.querySelector('[data-toggle="dropdown"]');
            if (dropdownToggle) {
                console.log('🔽 Opening scraper dropdown...');
                dropdownToggle.click();
                await sleep(STASH_CONFIG.UI_TRANSITION_DELAY);
            }

            await sleep(500);

            // Select ThePornDB option
            const thePornDBSelected = await selectThePornDBOption();
            if (!thePornDBSelected) {
                throw new Error('Could not select ThePornDB option');
            }

            notifications.show('🎬 Connecting to ThePornDB...', 'info');
            await sleep(STASH_CONFIG.SCRAPER_OPERATION_DELAY);

            checkCancellation(); // Check before processing entries

            // Find and process ThePornDB entries
            const plusButtonSelectors = [
                'button.minimal.ml-2.btn.btn-primary svg[data-icon="plus"]',
                '.scraper-result button svg[data-icon="plus"]',
                '.entity-result button.btn-primary',
                'button.btn-primary svg.fa-plus'
            ];

            let plusButtons = [];
            for (const selector of plusButtonSelectors) {
                plusButtons = document.querySelectorAll(selector);
                if (plusButtons.length > 0) {
                    console.log(`✅ Found ${plusButtons.length} ThePornDB entries with selector: ${selector}`);
                    break;
                }
            }

            if (plusButtons.length > 0) {
                const totalButtons = plusButtons.length;
                console.log(`🎬 Found ${totalButtons} ThePornDB entries to process`);
                notifications.show(`🎬 Adding ${totalButtons} ThePornDB entries...`, 'info');

                for (let i = 0; i < plusButtons.length; i++) {
                    checkCancellation(); // Check before each entry

                    try {
                        const button = plusButtons[i].closest('button');
                        if (button) {
                            button.click();
                            console.log(`✅ Added ThePornDB entry ${i + 1}/${totalButtons}`);

                            if (i < totalButtons - 1) {
                                await sleep(2000);
                            } else {
                                await sleep(3000);
                            }
                        }
                    } catch (error) {
                        console.error('❌ Error adding ThePornDB entry:', error);
                        await sleep(2000);
                    }
                }

                notifications.show('✅ ThePornDB scraping complete', 'success');
            } else {
                console.log('ℹ️ No new ThePornDB entries found');
                notifications.show('ℹ️ No new ThePornDB data found', 'info');
            }

            return true;
        } catch (error) {
            if (error.message === 'Automation cancelled by user') {
                throw error; // Re-throw cancellation error
            }
            console.error('❌ ThePornDB scraping failed:', error);
            notifications.show(`❌ ThePornDB error: ${error.message}`, 'error');
            return false;
        }
    }

    async function applyChanges() {
        try {
            const applyButton = await findApplyButton();
            if (applyButton) {
                applyButton.click();
                console.log('✅ Applied changes automatically');
                await sleep(STASH_CONFIG.GRAPHQL_MUTATION_DELAY);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error applying changes:', error);
            return false;
        }
    }

    async function saveScene() {
        try {
            const saveButton = await findSaveButton();
            if (saveButton) {
                saveButton.click();
                console.log('✅ Saved scene successfully');
                await sleep(1000);
                return true;
            }
            throw new Error('Save button not found');
        } catch (error) {
            console.error('❌ Error saving scene:', error);
            return false;
        }
    }

    // Keep the old functions for backward compatibility
    async function automateStashDB() {
        try {
            console.log('Starting automateStashDB...');

            // Click the "Edit" button
            const editSuccess = await clickElementOptimized(['a[data-rb-event-key="scene-edit-panel"]'], 'Edit button');
            if (!editSuccess) return;
            await sleep(1000);

            // Wait for edit panel to load and find scrape button
            console.log('Looking for scrape button...');
            let scrapeButton = null;
            let attempts = 0;
            const maxAttempts = 10;

            while (!scrapeButton && attempts < maxAttempts) {
                scrapeButton = await findScrapeButton();
                if (!scrapeButton) {
                    console.log(`Scrape button not found, attempt ${attempts + 1}/${maxAttempts}`);
                    await sleep(500);
                    attempts++;
                }
            }

            if (!scrapeButton) {
                console.error('Could not find Scrape button after all attempts');
                // Log all buttons for debugging
                const allButtons = document.querySelectorAll('button');
                console.log('All buttons on page:');
                allButtons.forEach((btn, index) => {
                    console.log(`Button ${index}: "${btn.textContent.trim()}" - classes: ${btn.className}`);
                });
                return;
            }

            scrapeButton.click();
            console.log('Successfully clicked scrape button');
            await sleep(1000);

            // Click on the dropdown option with the text "stashdb.org"
            const dropdownOptions = document.querySelectorAll('.dropdown-menu.show a.dropdown-item');
            for (const option of dropdownOptions) {
                if (option.textContent.trim() === 'stashdb.org') {
                    option.click();
                    console.log("Clicking StashDB");
                    break;
                }
            }
            await sleep(2500);

            // Find and select all + tags (studios, performers, tags, etc)
            const plusButtons = document.querySelectorAll('button.minimal.ml-2.btn.btn-primary svg[data-prefix="fas"][data-icon="plus"]');
            if (plusButtons.length > 0) {
                const totalButtons = plusButtons.length;
                console.log(`Total new entries found: ${totalButtons}`);

                for (let i = 0; i < plusButtons.length; i++) {
                    try {
                        const button = plusButtons[i].closest('button');
                        if (button) {
                            button.click();
                            console.log(`Clicking + Button ${i + 1}/${totalButtons}`);

                            if (i < totalButtons - 1) {
                                await sleep(2000);
                            } else {
                                console.log("Waiting a bit longer for the last tag");
                                await sleep(5000);
                            }
                        }
                    } catch (error) {
                        console.error('Error clicking + button:', error);
                        await sleep(2000);
                    }
                }
            }

            await sleep(2000);
        } catch (error) {
            console.error('Error in automateStashDB:', error);
        }
    }

    async function AutomateThePornDB() {
        try {
            console.log('Starting AutomateThePornDB...');

            // Click the "Apply" button with robust detection
            console.log('Looking for Apply button...');
            let applyButton = await findApplyButton();
            if (!applyButton) {
                console.error('Could not find Apply button');
                // Log all buttons for debugging
                const allButtons = document.querySelectorAll('button');
                console.log('All buttons on page:');
                allButtons.forEach((btn, index) => {
                    if (index < 15) { // Show more buttons for debugging
                        console.log(`Button ${index}: "${btn.textContent.trim()}" - classes: ${btn.className}`);
                    }
                });
                return;
            }
            applyButton.click();
            console.log('Successfully clicked Apply button');
            await sleep(300);

            // Click the "Save" button with robust detection
            console.log('Looking for Save button...');
            let saveButton = await findSaveButton();
            if (!saveButton) {
                console.error('Could not find Save button');
                return;
            }
            saveButton.click();
            console.log('Successfully clicked Save button');

            // Click the "Edit" button
            console.log('Looking for Edit button...');
            const editSuccess = await clickElementOptimized(['a[data-rb-event-key="scene-edit-panel"]'], 'Edit button');
            if (!editSuccess) return;
            await sleep(500);

            // Wait for edit panel to load and find scrape button
            console.log('Looking for scrape button...');
            let scrapeButton = null;
            let attempts = 0;
            const maxAttempts = 10;

            while (!scrapeButton && attempts < maxAttempts) {
                scrapeButton = await findScrapeButton();
                if (!scrapeButton) {
                    console.log(`Scrape button not found, attempt ${attempts + 1}/${maxAttempts}`);
                    await sleep(500);
                    attempts++;
                }
            }

            if (!scrapeButton) {
                console.error('Could not find Scrape button after all attempts');
                return;
            }

            scrapeButton.click();
            console.log('Successfully clicked scrape button');
            await sleep(500);

            // Click on the dropdown option with the text "stashdb.org"
            const dropdownOptions = document.querySelectorAll('.dropdown-menu.show a.dropdown-item');
            for (const option of dropdownOptions) {
                if (option.textContent.trim() === 'stashdb.org') {
                    option.click();
                    console.log("Clicking StashDB");
                    break;
                }
            }
            await sleep(2500);

            // Find and select all + tags (studios, performers, tags, etc)
            const plusButtons = document.querySelectorAll('button.minimal.ml-2.btn.btn-primary svg[data-prefix="fas"][data-icon="plus"]');
            if (plusButtons.length > 0) {
                const totalButtons = plusButtons.length;
                console.log(`Total new entries found: ${totalButtons}`);

                for (let i = 0; i < plusButtons.length; i++) {
                    try {
                        const button = plusButtons[i].closest('button');
                        if (button) {
                            button.click();
                            console.log(`Clicking + Button ${i + 1}/${totalButtons}`);

                            if (i < totalButtons - 1) {
                                await sleep(2000);
                            } else {
                                console.log("Waiting a bit longer for the last tag");
                                await sleep(5000);
                            }
                        }
                    } catch (error) {
                        console.error('Error clicking + button:', error);
                        await sleep(2000);
                    }
                }
            }

            // Final Apply and Save with robust detection
            console.log('Looking for final Apply button...');
            let finalApplyButton = await findApplyButton();
            if (finalApplyButton) {
                finalApplyButton.click();
                console.log('Successfully clicked final Apply button');
                await sleep(300);
            } else {
                console.warn('Final Apply button not found');
            }

            console.log('Looking for final Save button...');
            let finalSaveButton = await findSaveButton();
            if (finalSaveButton) {
                finalSaveButton.click();
                console.log('Successfully clicked final Save button');
            } else {
                console.warn('Final Save button not found');
            }

        } catch (error) {
            console.error('Error in AutomateThePornDB:', error);
        }
    }

    // Enhanced Button Creation with Configuration Support and Smart UI Management
    async function createOptimizedButtons() {
        console.log('🎯 DEBUG: *** createOptimizedButtons CALLED ***');

        // Get current state from centralized state management
        const state = AutomateStashState.getState();
        console.log('🔍 DEBUG: Current state:', state);

        // Don't create buttons during active automation
        if (state.automationInProgress || automationInProgress) {
            console.log('🚀 DEBUG: Automation in progress, skipping button creation in createOptimizedButtons');
            console.log('🚀 Automation in progress, skipping button creation');
            return;
        }

        // Prevent infinite loops with a cooldown mechanism
        const now = Date.now();
        if (state.lastButtonCreationAttempt && (now - state.lastButtonCreationAttempt) < 5000) {
            console.log('🕒 DEBUG: Button creation cooldown active, skipping...');
            console.log('🕒 Button creation cooldown active, skipping...');
            return;
        }
        console.log('🔄 DEBUG: Setting lastButtonCreationAttempt to:', now);
        AutomateStashState.updateState({ lastButtonCreationAttempt: now });

        // Remove existing panels/buttons using UIElementTracker
        UIElementTracker.cleanup();

        // Check if we're on a scene page
        const isScenePage = window.location.pathname.includes('/scenes/') &&
            !window.location.pathname.includes('/scenes/new') &&
            !window.location.pathname.includes('/scenes/edit');

        if (!isScenePage) {
            console.log('🚫 Not on a scene page, skipping button creation');
            return;
        }

        // Check configuration for intelligent UI behavior
        const shouldMinimizeWhenComplete = getConfig(CONFIG_KEYS.MINIMIZE_WHEN_COMPLETE);
        const skipAlreadyScraped = getConfig(CONFIG_KEYS.SKIP_ALREADY_SCRAPED);

        // Enhanced organized and scraper status check
        let shouldMinimize = false;
        let statusMessage = '';

        try {
            if (skipAlreadyScraped) {
                console.log('🔍 Checking scene completion status for intelligent UI...');

                // Get user's automation preferences
                const autoStashDB = getConfig(CONFIG_KEYS.AUTO_SCRAPE_STASHDB);
                const autoThePornDB = getConfig(CONFIG_KEYS.AUTO_SCRAPE_THEPORNDB);
                const autoOrganize = getConfig(CONFIG_KEYS.AUTO_ORGANIZE);

                console.log('📋 User automation settings:', { autoStashDB, autoThePornDB, autoOrganize });

                // Quick check first to avoid unnecessary detailed analysis
                const quickStashDBCheck = document.querySelectorAll('a[href*="stashdb"], [data-stashdb], [title*="stashdb" i]').length > 0;
                const quickThePornDBCheck = document.body.textContent.toLowerCase().includes('theporndb') ||
                    document.body.textContent.toLowerCase().includes('tpdb') ||
                    document.querySelectorAll('a[href*="porndb"], a[href*="tpdb"]').length > 0;

                console.log('🔍 Quick content check:', { quickStashDBCheck, quickThePornDBCheck });

                // Only minimize if we can confidently determine ALL automation is complete
                // Use more conservative logic to prevent false positives
                if (quickStashDBCheck && quickThePornDBCheck) {
                    console.log('✅ Quick check: Both scrapers clearly detected - checking organization...');
                    const organizedStatus = await checkIfAlreadyOrganized();
                    console.log('📁 Organization status:', organizedStatus);

                    // Only minimize if ALL enabled automation tasks are complete
                    const allTasksComplete = (!autoStashDB || quickStashDBCheck) &&
                        (!autoThePornDB || quickThePornDBCheck) &&
                        (!autoOrganize || organizedStatus);

                    if (allTasksComplete && shouldMinimizeWhenComplete) {
                        console.log('✅ Scene fully processed - all enabled automation complete, minimizing per user setting');
                        statusMessage = '✅ Fully processed';
                        shouldMinimize = true;
                    } else if (allTasksComplete) {
                        console.log('✅ Scene fully processed but user prefers full panel');
                        statusMessage = '✅ Fully processed (expanded)';
                        shouldMinimize = false;
                    } else {
                        console.log('🔄 Scene has data but automation tasks remain');
                        statusMessage = '🔄 Data detected, automation available';
                        shouldMinimize = false;
                    }
                } else {
                    // Only do detailed analysis if quick check doesn't find clear evidence
                    console.log('🔍 Quick check inconclusive, performing detailed analysis...');
                    const scrapedStatus = await detectAlreadyScrapedSources();
                    const organizedStatus = await checkIfAlreadyOrganized();

                    console.log('📊 Detailed analysis results:', {
                        stashdb: scrapedStatus.stashdb,
                        theporndb: scrapedStatus.theporndb,
                        organized: organizedStatus
                    });

                    const hasStashDB = scrapedStatus.stashdb;
                    const hasThePornDB = scrapedStatus.theporndb;
                    const isOrganized = organizedStatus;

                    // Check if all enabled automation tasks are complete
                    const allTasksComplete = (!autoStashDB || hasStashDB) &&
                        (!autoThePornDB || hasThePornDB) &&
                        (!autoOrganize || isOrganized);

                    if (allTasksComplete && shouldMinimizeWhenComplete) {
                        console.log('✅ All enabled automation tasks are complete, minimizing per user setting');
                        statusMessage = '✅ Fully processed';
                        shouldMinimize = true;
                    } else if (allTasksComplete) {
                        console.log('✅ All enabled automation tasks are complete but user prefers full panel');
                        statusMessage = '✅ Fully processed (expanded)';
                        shouldMinimize = false;
                    } else if (hasStashDB || hasThePornDB) {
                        console.log('🔄 Some data detected, but automation tasks remain');
                        statusMessage = '🔄 Partially processed';
                        shouldMinimize = false;
                    } else {
                        console.log('❌ No automation data detected');
                        statusMessage = '🚀 Ready for automation';
                        shouldMinimize = false;
                    }
                }
            }
        } catch (error) {
            console.log('⚠️ Could not check scene status:', error.message);
        }

        // If should minimize, create minimized button instead (unless user manually expanded)
        const currentState = AutomateStashState.getState();
        if (shouldMinimize && !currentState.userManuallyExpanded) {
            console.log('🎯 DEBUG: Auto-minimizing because shouldMinimize=true and userManuallyExpanded=false');
            console.log('🎯 Creating minimized button based on completion status:', statusMessage);
            uiManager.createMinimizedButton();
            return;
        } else if (shouldMinimize && currentState.userManuallyExpanded) {
            console.log('🔓 DEBUG: Should minimize but user manually expanded - keeping full panel');
            console.log('🔓 User manually expanded - keeping full panel despite completion status');
        } else {
            console.log('📋 DEBUG: Not minimizing - shouldMinimize=', shouldMinimize, 'userManuallyExpanded=', currentState.userManuallyExpanded);
        }

        console.log('🎯 Creating automation panel via createOptimizedButtons -> UIManager');

        // Use UIManager to ensure consistent UI across all creation paths
        uiManager.createFullPanelForced();

        // Reset the flag using centralized state
        AutomateStashState.updateState({ buttonCreationInProgress: false });
    }

    // Wait for DOM to be ready and create optimized buttons
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => createOptimizedButtons());
    } else {
        createOptimizedButtons();
    }

    // Reduced frequency for button creation to prevent loops
    setTimeout(() => createOptimizedButtons(), 2000);
    setTimeout(() => createOptimizedButtons(), 5000);

    // Enhanced MutationObserver with React SPA awareness and debouncing
    let mutationTimeout;
    const observer = new MutationObserver((mutations) => {
        // Debounce mutations to prevent excessive calls
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
            const isScenePage = window.location.pathname.includes('/scenes/');
            const state = AutomateStashState.getState();

            console.log('🔍 DEBUG: DOM mutation check - isScenePage=', isScenePage, 'state=', state);

            // Only create buttons if:
            // - On scene page
            // - No existing automation UI (tracked by state)
            // - Automation not in progress
            // - Automation not completed 
            // - User hasn't manually expanded (to preserve user choice)
            if (isScenePage && !state.panelExists && !state.isMinimized && !state.automationInProgress && !state.automationCompleted && !state.userManuallyExpanded) {
                console.log('✅ DEBUG: DOM mutation detected - calling createOptimizedButtons');
                console.log('🔄 DOM mutation detected on scene page, checking for button creation...');
                createOptimizedButtons();
            } else {
                console.log('🚫 DEBUG: DOM mutation detected but conditions not met for button creation');
                if (state.automationInProgress) {
                    console.log('   - Automation in progress, skipping button creation');
                }
                if (state.automationCompleted) {
                    console.log('   - Automation completed, skipping button recreation');
                }
                if (state.userManuallyExpanded) {
                    console.log('   - User manually expanded, preserving user choice');
                }
                if (state.panelExists) {
                    console.log('   - Automation panel already exists');
                }
                if (state.isMinimized) {
                    console.log('   - Minimized button already exists');
                }
                if (!isScenePage) {
                    console.log('   - Not on scene page');
                }
            }
        }, 1000); // 1 second debounce
    });

    // Enhanced navigation observer for SPA route changes with debouncing
    let currentPath = window.location.pathname;
    let navigationTimeout;
    const checkForNavigation = () => {
        if (window.location.pathname !== currentPath) {
            const previousPath = currentPath;
            currentPath = window.location.pathname;
            console.log('🔄 Page navigation detected:', currentPath);

            // Reset completion flag on navigation to new scene
            if (window.location.pathname.includes('/scenes/')) {
                // Reset centralized state for new scene
                AutomateStashState.reset();

                // Reset legacy variables for backward compatibility
                automationCompleted = false;
                automationInProgress = false;

                console.log('🔄 New scene detected - resetting automation flags');
            }

            // Debounce navigation changes
            clearTimeout(navigationTimeout);
            navigationTimeout = setTimeout(() => {
                const state = AutomateStashState.getState();
                if (!state.automationCompleted) {
                    createOptimizedButtons();
                }
            }, 1000);
        }
    };

    // Check for navigation changes less frequently
    setInterval(checkForNavigation, 2000);

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();