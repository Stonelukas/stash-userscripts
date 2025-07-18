// ==UserScript==
// @name         OptimizedStash
// @version      3.3.8-debug
// @description  Advanced Stash Scene Automation - Fixed minimize button functionality in full panel
// @author       You
// @match        http://localhost:9998/scenes/*
// @exclude      http://localhost:9998/scenes/markers?*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    console.log('🚀 AutomateStash v3.3.8-debug - Fixed minimize button functionality in full panel');
    console.log('🔧 Fixed: Minimize button in full panel now properly bound to UIManager context');
    console.log('🔧 Fixed: Added debugging for minimize button click to identify context issues');

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

    // Global state to prevent button recreation after successful completion
    let automationCompleted = false;
    let uiMinimized = false;
    let automationInProgress = false;
    let automationCancelled = false;
    
    // Use window property to persist across DOM observer calls
    window.userManuallyExpanded = window.userManuallyExpanded || false;

    // Global fallback function for minimized button (define early to ensure availability)
    window.expandAutomateStash = function() {
        console.log('🔄 DEBUG: *** GLOBAL FALLBACK FUNCTION CALLED ***');
        console.log('🔄 Global fallback: Expanding AutomateStash panel');
        
        // Set flag to indicate user manually expanded the widget
        console.log('🔧 DEBUG: Setting userManuallyExpanded flag via global fallback...');
        window.userManuallyExpanded = true;
        console.log('🔓 User manually expanded via global fallback - disabling auto-minimization');
        console.log('🔍 DEBUG: Flag set to:', window.userManuallyExpanded);
        
        // Remove existing elements
        console.log('🧹 DEBUG: Clearing existing elements via global fallback...');
        const existingPanel = document.querySelector('#stash-automation-panel');
        if (existingPanel) {
            console.log('🗑️ DEBUG: Removing existing panel via global fallback');
            existingPanel.remove();
        } else {
            console.log('✅ DEBUG: No existing panel to remove via global fallback');
        }
        
        const existingMinimized = document.querySelector('#stash-minimized-button');
        if (existingMinimized) {
            console.log('🗑️ DEBUG: Removing existing minimized button via global fallback');
            existingMinimized.remove();
        } else {
            console.log('✅ DEBUG: No existing minimized button to remove via global fallback');
        }
        
        // Reset state and recreate
        console.log('🔄 DEBUG: Resetting state via global fallback...');
        window.lastButtonCreationAttempt = 0;
        window.buttonCreationInProgress = false;
        console.log('✅ DEBUG: State reset complete via global fallback');
        
        // Use UIManager method to ensure consistent UI
        console.log('🚀 DEBUG: Calling uiManager.createFullPanelForced via global fallback...');
        console.log('🔍 DEBUG: uiManager exists:', !!window.uiManager || !!uiManager);
        
        if (typeof uiManager !== 'undefined' && uiManager.createFullPanelForced) {
            console.log('✅ DEBUG: uiManager available, calling createFullPanelForced...');
            uiManager.createFullPanelForced();
            console.log('✅ DEBUG: createFullPanelForced called successfully via global fallback');
        } else {
            console.error('❌ DEBUG: uiManager not available in global scope');
            console.log('🔄 DEBUG: Attempting direct panel creation...');
            
            // Last resort: try to create panel directly
            try {
                createOptimizedButtons();
            } catch (error) {
                console.error('❌ DEBUG: Failed to create buttons directly:', error);
            }
        }
    };

    // Automation Control Functions
    function startAutomation() {
        automationInProgress = true;
        automationCancelled = false;
        console.log('🚀 Automation started');
        
        // Remove the main automation panel completely during automation
        const panel = document.querySelector('#stash-automation-panel');
        if (panel) {
            panel.remove();
        }
        
        // Also remove any minimized buttons to prevent conflicts
        const minimizedBtn = document.querySelector('#stash-minimized-button');
        if (minimizedBtn) {
            minimizedBtn.remove();
        }
        
        // Show cancel button
        showCancelButton();
    }

    function stopAutomation() {
        automationInProgress = false;
        automationCancelled = true;
        console.log('🛑 Automation cancelled by user');
        notifications.show('🛑 Automation cancelled', 'warning');
        
        // Remove cancel button
        const cancelBtn = document.querySelector('#stash-cancel-button');
        if (cancelBtn) cancelBtn.remove();
        
        // Recreate the main automation panel
        setTimeout(() => {
            if (!document.querySelector('#stash-automation-panel') && !document.querySelector('#stash-minimized-button')) {
                createOptimizedButtons();
            }
        }, 500);
    }

    function completeAutomation() {
        automationInProgress = false;
        console.log('✅ Automation completed');
        
        // Remove cancel button
        const cancelBtn = document.querySelector('#stash-cancel-button');
        if (cancelBtn) cancelBtn.remove();
        
        // The UI management will be handled by the automateComplete function
        // based on the minimize_when_complete setting
    }

    function showCancelButton() {
        // Remove existing cancel button if any
        const existingBtn = document.querySelector('#stash-cancel-button');
        if (existingBtn) existingBtn.remove();

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

        cancelButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel the automation?')) {
                stopAutomation();
            }
        });

        document.body.appendChild(cancelButton);
    }

    // Check if automation should be cancelled
    function checkCancellation() {
        if (automationCancelled) {
            throw new Error('Automation cancelled by user');
        }
    }

    // Enhanced UI Management with Minimization Support
    class UIManager {
        constructor() {
            this.isMinimized = false;
            this.panel = null;
        }

        createConfigDialog() {
            // Remove any existing dialog first
            const existingDialog = document.querySelector('#stash-config-dialog');
            const existingBackdrop = document.querySelector('#stash-config-backdrop');
            if (existingDialog) existingDialog.remove();
            if (existingBackdrop) existingBackdrop.remove();

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
            
            console.log('✅ Configuration dialog created successfully');
        }

        createMinimizedButton() {
            if (document.querySelector('#stash-minimized-button')) {
                console.log('🔄 Minimized button already exists, skipping creation');
                return;
            }

            console.log('🎯 Creating minimized button');
            console.log('🔍 DEBUG: Current userManuallyExpanded flag:', window.userManuallyExpanded);
            
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

            // Add tooltip first
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
            tooltip.textContent = 'Click to expand AutomateStash';
            button.appendChild(tooltip);

            // Store reference to UIManager instance for proper context binding
            const uiManagerRef = this;
            
            console.log('🔧 DEBUG: UIManager reference stored:', !!uiManagerRef);
            console.log('🔧 DEBUG: UIManager createFullPanelForced method exists:', typeof uiManagerRef.createFullPanelForced);

            // Event handlers with proper context binding
            button.addEventListener('mouseenter', () => {
                console.log('🖱️ DEBUG: Mouse entered minimized button');
                button.style.transform = 'scale(1.1)';
                tooltip.style.opacity = '1';
            });

            button.addEventListener('mouseleave', () => {
                console.log('🖱️ DEBUG: Mouse left minimized button');
                button.style.transform = 'scale(1)';
                tooltip.style.opacity = '0';
            });

            button.addEventListener('click', () => {
                console.log('🔄 DEBUG: *** MINIMIZED BUTTON CLICKED ***');
                console.log('🔍 DEBUG: Event handler executing...');
                console.log('🔍 DEBUG: UIManager reference in click handler:', !!uiManagerRef);
                console.log('🔍 DEBUG: createFullPanelForced available:', typeof uiManagerRef.createFullPanelForced);
                
                // Set flag to indicate user manually expanded the widget
                console.log('🔧 DEBUG: Setting userManuallyExpanded flag...');
                window.userManuallyExpanded = true;
                console.log('🔓 User manually expanded - disabling auto-minimization');
                console.log('🔍 DEBUG: Flag set to:', window.userManuallyExpanded);
                
                try {
                    console.log('🧹 DEBUG: Clearing existing elements...');
                    
                    // Clear existing elements
                    const existingPanel = document.querySelector('#stash-automation-panel');
                    if (existingPanel) {
                        console.log('🗑️ DEBUG: Removing existing panel');
                        existingPanel.remove();
                    } else {
                        console.log('✅ DEBUG: No existing panel to remove');
                    }
                    
                    // Remove the minimized button
                    console.log('🗑️ DEBUG: Removing minimized button');
                    button.remove();
                    console.log('✅ DEBUG: Minimized button removed');
                    
                    // Reset cooldown and state flags to ensure panel creation works
                    console.log('🔄 DEBUG: Resetting state flags...');
                    window.lastButtonCreationAttempt = 0;
                    window.buttonCreationInProgress = false;
                    console.log('✅ DEBUG: State flags reset');
                    
                    // Create full panel - use direct method to avoid context issues
                    console.log('🚀 DEBUG: Calling createFullPanelForced...');
                    uiManagerRef.createFullPanelForced();
                    console.log('✅ DEBUG: createFullPanelForced called successfully');
                    
                } catch (error) {
                    console.error('❌ DEBUG: Error in minimized button click handler:', error);
                    console.error('❌ DEBUG: Error stack:', error.stack);
                    
                    // Fallback: Use global function to ensure it works
                    console.log('🔄 DEBUG: Attempting fallback method...');
                    button.remove();
                    
                    if (typeof window.expandAutomateStash === 'function') {
                        console.log('🔄 DEBUG: Calling global fallback function...');
                        window.expandAutomateStash();
                        console.log('✅ DEBUG: Global fallback called');
                    } else {
                        console.error('❌ DEBUG: Global fallback function not available');
                    }
                }
            });

            // Also add the global function as a backup (in case context is lost)
            console.log('🔧 DEBUG: Adding onclick attribute as backup...');
            button.setAttribute('onclick', 'window.expandAutomateStash()');
            console.log('✅ DEBUG: onclick attribute set');

            console.log('📌 DEBUG: Appending button to document body...');
            document.body.appendChild(button);
            console.log('✅ Minimized button created successfully');
            console.log('🔍 DEBUG: Button element in DOM:', !!document.querySelector('#stash-minimized-button'));
        }

        showFullPanel() {
            console.log('🔄 Showing full panel (user requested)');
            this.isMinimized = false;
            
            // Remove existing elements
            const existingPanel = document.querySelector('#stash-automation-panel');
            if (existingPanel) existingPanel.remove();
            
            const existingMinimized = document.querySelector('#stash-minimized-button');
            if (existingMinimized) existingMinimized.remove();
            
            // Reset the cooldown mechanism and state flags
            window.lastButtonCreationAttempt = 0;
            window.buttonCreationInProgress = false;
            
            // Force creation of full panel
            this.createFullPanelForced();
        }

        // Force creation of full panel regardless of automation status (used when user explicitly requests it)
        async createFullPanelForced() {
            console.log('🎯 DEBUG: *** createFullPanelForced CALLED ***');
            console.log('🎯 Creating full automation panel (user requested)');
            
            // Add a flag to prevent multiple button creation attempts
            if (window.buttonCreationInProgress) {
                console.log('🔄 DEBUG: Button creation already in progress, skipping...');
                console.log('🔄 Button creation already in progress, skipping...');
                return;
            }
            
            console.log('🔧 DEBUG: Setting buttonCreationInProgress flag...');
            window.buttonCreationInProgress = true;
            console.log('✅ DEBUG: buttonCreationInProgress set to true');

            try {
                console.log('🧹 DEBUG: Removing any existing panels/buttons...');
                
                // Remove any existing panels/buttons
                const existingPanel = document.querySelector('#stash-automation-panel');
                if (existingPanel) {
                    console.log('🗑️ DEBUG: Removing existing panel in createFullPanelForced');
                    existingPanel.remove();
                } else {
                    console.log('✅ DEBUG: No existing panel to remove in createFullPanelForced');
                }
                
                const existingMinimized = document.querySelector('#stash-minimized-button');
                if (existingMinimized) {
                    console.log('🗑️ DEBUG: Removing existing minimized button in createFullPanelForced');
                    existingMinimized.remove();
                } else {
                    console.log('✅ DEBUG: No existing minimized button to remove in createFullPanelForced');
                }

                console.log('🎨 DEBUG: Creating new panel element...');
                const panel = document.createElement('div');
                panel.id = 'stash-automation-panel';
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

                minimizeBtn.addEventListener('click', () => {
                    console.log('🔄 DEBUG: Minimize button clicked');
                    console.log('🔍 DEBUG: UIManager context available:', !!uiManagerRef);
                    console.log('🔍 DEBUG: minimizePanel method available:', typeof uiManagerRef.minimizePanel);
                    uiManagerRef.minimizePanel();
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

                automateBtn.addEventListener('click', async () => {
                    console.log('🚀 User initiated automation');
                    try {
                        await automateComplete();
                    } catch (error) {
                        console.error('❌ Automation failed:', error);
                        notifications.show('❌ Automation failed: ' + error.message, 'error');
                    }
                });

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

                settingsBtn.addEventListener('click', () => {
                    uiManager.createConfigDialog();
                });

                panel.appendChild(settingsBtn);
                
                console.log('📌 DEBUG: Appending panel to document body...');
                document.body.appendChild(panel);
                console.log('✅ DEBUG: Panel appended to body successfully');
                console.log('🔍 DEBUG: Panel in DOM:', !!document.querySelector('#stash-automation-panel'));

                console.log('✅ Full automation panel created successfully');

            } catch (error) {
                console.error('❌ DEBUG: Error creating full panel:', error);
                console.error('❌ DEBUG: Error stack:', error.stack);
            } finally {
                console.log('🔄 DEBUG: Resetting buttonCreationInProgress flag...');
                window.buttonCreationInProgress = false;
                console.log('✅ DEBUG: buttonCreationInProgress reset to false');
            }
        }

        minimizePanel() {
            this.isMinimized = true;
            window.userManuallyExpanded = false; // Reset manual expansion flag when manually minimizing
            console.log('📦 User manually minimized - resetting expansion flag');
            const panel = document.querySelector('#stash-automation-panel');
            if (panel) {
                console.log('🗑️ Removing full panel to minimize');
                panel.remove();
            }
            this.createMinimizedButton();
        }

        // Alias method for consistency and backward compatibility
        showConfigDialog() {
            return this.createConfigDialog();
        }
    }

    const uiManager = new UIManager();

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
        
        // Set the completion flag to prevent button recreation
        automationCompleted = true;
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
                    uiManager.minimizePanel();
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
                uiManager.minimizePanel();
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
        console.log('🔍 DEBUG: Current state - automationInProgress:', automationInProgress, 'userManuallyExpanded:', window.userManuallyExpanded);
        
        // Don't create buttons during active automation
        if (automationInProgress) {
            console.log('🚀 DEBUG: Automation in progress, skipping button creation in createOptimizedButtons');
            console.log('🚀 Automation in progress, skipping button creation');
            return;
        }
        
        // Prevent infinite loops with a cooldown mechanism
        const now = Date.now();
        if (window.lastButtonCreationAttempt && (now - window.lastButtonCreationAttempt) < 5000) {
            console.log('🕒 DEBUG: Button creation cooldown active, skipping...');
            console.log('🕒 Button creation cooldown active, skipping...');
            return;
        }
        console.log('🔄 DEBUG: Setting lastButtonCreationAttempt to:', now);
        window.lastButtonCreationAttempt = now;

        // Remove existing panels/buttons if they exist
        const existingPanel = document.querySelector('#stash-automation-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        const existingMinimized = document.querySelector('#stash-minimized-button');
        if (existingMinimized) {
            existingMinimized.remove();
        }

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
        if (shouldMinimize && !window.userManuallyExpanded) {
            console.log('🎯 DEBUG: Auto-minimizing because shouldMinimize=true and userManuallyExpanded=false');
            console.log('🎯 Creating minimized button based on completion status:', statusMessage);
            uiManager.createMinimizedButton();
            return;
        } else if (shouldMinimize && window.userManuallyExpanded) {
            console.log('🔓 DEBUG: Should minimize but user manually expanded - keeping full panel');
            console.log('🔓 User manually expanded - keeping full panel despite completion status');
        } else {
            console.log('📋 DEBUG: Not minimizing - shouldMinimize=', shouldMinimize, 'userManuallyExpanded=', window.userManuallyExpanded);
        }

        console.log('🎯 Creating automation panel via createOptimizedButtons -> UIManager');
        
        // Use UIManager to ensure consistent UI across all creation paths
        uiManager.createFullPanelForced();
        
        // Reset the flag
        window.buttonCreationInProgress = false;
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
            const hasAutomationPanel = document.querySelector('#stash-automation-panel');
            const hasMinimizedButton = document.querySelector('#stash-minimized-button');
            
            console.log('🔍 DEBUG: DOM mutation check - isScenePage=', isScenePage, 'hasAutomationPanel=', !!hasAutomationPanel, 'hasMinimizedButton=', !!hasMinimizedButton, 'automationInProgress=', automationInProgress, 'automationCompleted=', automationCompleted, 'userManuallyExpanded=', window.userManuallyExpanded);
            
            // Only create buttons if:
            // - On scene page
            // - No existing automation UI
            // - Automation not in progress
            // - Automation not completed 
            // - User hasn't manually expanded (to preserve user choice)
            if (isScenePage && !hasAutomationPanel && !hasMinimizedButton && !automationInProgress && !automationCompleted && !window.userManuallyExpanded) {
                console.log('✅ DEBUG: DOM mutation detected - calling createOptimizedButtons');
                console.log('🔄 DOM mutation detected on scene page, checking for button creation...');
                createOptimizedButtons();
            } else {
                console.log('� DEBUG: DOM mutation detected but conditions not met for button creation');
                if (automationInProgress) {
                    console.log('   - Automation in progress, skipping button creation');
                }
                if (automationCompleted) {
                    console.log('   - Automation completed, skipping button recreation');
                }
                if (window.userManuallyExpanded) {
                    console.log('   - User manually expanded, preserving user choice');
                }
                if (hasAutomationPanel) {
                    console.log('   - Automation panel already exists');
                }
                if (hasMinimizedButton) {
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
                automationCompleted = false;
                automationInProgress = false; // Also reset in-progress flag
                window.userManuallyExpanded = false; // Reset manual expansion flag for new scene
                console.log('🔄 New scene detected - resetting automation flags');
            }
            
            // Debounce navigation changes
            clearTimeout(navigationTimeout);
            navigationTimeout = setTimeout(() => {
                if (!automationCompleted) {
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