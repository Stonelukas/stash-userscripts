// ==UserScript==
// @name         Keyboard Shortcuts for AutomateStash
// @version      1.0.0
// @description  Comprehensive keyboard navigation system with customizable shortcuts
// @author       AutomateStash Team
// ==/UserScript==

(function() {
    'use strict';

    /**
     * KeyboardShortcutsManager - Advanced keyboard navigation system
     * Provides customizable shortcuts, context-aware actions, and accessibility features
     */
    class KeyboardShortcutsManager {
        constructor(config = {}) {
            this.shortcuts = new Map();
            this.contexts = new Map();
            this.activeContext = 'global';
            this.enabled = true;
            this.modifierKeys = {
                ctrl: false,
                alt: false,
                shift: false,
                meta: false
            };
            
            this.defaultShortcuts = {
                // Global shortcuts
                'Alt+r': { action: 'startAutomation', description: 'Start automation', context: 'global' },
                'Alt+Shift+r': { action: 'startAutomationSilent', description: 'Start silent automation', context: 'global' },
                'Alt+m': { action: 'toggleMinimize', description: 'Toggle minimize panel', context: 'global' },
                'Alt+c': { action: 'openConfig', description: 'Open configuration', context: 'global' },
                'Alt+h': { action: 'showHelp', description: 'Show help', context: 'global' },
                'Escape': { action: 'cancelAutomation', description: 'Cancel automation', context: 'automation' },
                
                // Edit panel shortcuts
                'Alt+a': { action: 'applyScrapedData', description: 'Apply scraped data', context: 'edit' },
                'Alt+s': { action: 'saveScene', description: 'Save scene', context: 'edit' },
                'Alt+o': { action: 'organizeScene', description: 'Mark as organized', context: 'edit' },
                'Alt+1': { action: 'scrapeStashDB', description: 'Scrape StashDB', context: 'edit' },
                'Alt+2': { action: 'scrapeThePornDB', description: 'Scrape ThePornDB', context: 'edit' },
                
                // Navigation shortcuts
                'Alt+Left': { action: 'previousScene', description: 'Previous scene', context: 'global' },
                'Alt+Right': { action: 'nextScene', description: 'Next scene', context: 'global' },
                'Alt+e': { action: 'openEditPanel', description: 'Open edit panel', context: 'global' },
                'Alt+q': { action: 'closeEditPanel', description: 'Close edit panel', context: 'edit' },
                
                // Performance shortcuts
                'Alt+p': { action: 'togglePerformanceMonitor', description: 'Toggle performance monitor', context: 'global' },
                'Alt+d': { action: 'toggleDebugMode', description: 'Toggle debug mode', context: 'global' },
                'Alt+t': { action: 'toggleTheme', description: 'Toggle theme', context: 'global' }
            };
            
            // Callbacks for actions
            this.actionCallbacks = new Map();
            
            // Visual feedback element
            this.feedbackElement = null;
            
            // Initialize
            this.initialize(config);
        }

        /**
         * Initialize keyboard shortcuts system
         */
        initialize(config) {
            // Load custom shortcuts from config
            const customShortcuts = config.shortcuts || {};
            
            // Merge with defaults
            Object.entries(this.defaultShortcuts).forEach(([key, value]) => {
                this.registerShortcut(key, value.action, value.description, value.context);
            });
            
            // Apply custom shortcuts
            Object.entries(customShortcuts).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    this.registerShortcut(key, value);
                } else {
                    this.registerShortcut(key, value.action, value.description, value.context);
                }
            });
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Create feedback element
            this.createFeedbackElement();
            
            console.log('🎹 Keyboard shortcuts initialized with', this.shortcuts.size, 'shortcuts');
        }

        /**
         * Setup event listeners
         */
        setupEventListeners() {
            // Main keydown handler
            document.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
            document.addEventListener('keyup', (e) => this.handleKeyUp(e), true);
            
            // Track modifier keys
            window.addEventListener('blur', () => this.resetModifiers());
            
            // Context detection
            this.setupContextDetection();
        }

        /**
         * Setup automatic context detection
         */
        setupContextDetection() {
            // Use MutationObserver to detect context changes
            const observer = new MutationObserver(() => {
                this.detectContext();
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'data-context']
            });
            
            // Initial context detection
            this.detectContext();
        }

        /**
         * Detect current context based on page state
         */
        detectContext() {
            const editPanel = document.querySelector('.edit-panel, .entity-edit-panel, .scene-edit-details');
            const automationPanel = document.querySelector('#stash-automation-panel');
            const modal = document.querySelector('.modal.show');
            
            if (modal) {
                this.activeContext = 'modal';
            } else if (editPanel) {
                this.activeContext = 'edit';
            } else if (automationPanel && window.stashUIManager?.automationInProgress) {
                this.activeContext = 'automation';
            } else {
                this.activeContext = 'global';
            }
        }

        /**
         * Handle keydown events
         */
        handleKeyDown(e) {
            if (!this.enabled) return;
            
            // Update modifier state
            this.updateModifiers(e);
            
            // Ignore if typing in input/textarea
            if (this.isTyping(e)) return;
            
            // Build shortcut string
            const shortcut = this.buildShortcutString(e);
            
            // Check if shortcut exists
            const shortcutInfo = this.shortcuts.get(shortcut);
            if (!shortcutInfo) return;
            
            // Check if shortcut is valid for current context
            if (!this.isShortcutValidForContext(shortcutInfo)) return;
            
            // Prevent default behavior
            e.preventDefault();
            e.stopPropagation();
            
            // Execute action
            this.executeAction(shortcutInfo.action, e);
            
            // Show visual feedback
            this.showFeedback(shortcutInfo);
        }

        /**
         * Handle keyup events
         */
        handleKeyUp(e) {
            this.updateModifiers(e);
        }

        /**
         * Update modifier keys state
         */
        updateModifiers(e) {
            this.modifierKeys.ctrl = e.ctrlKey;
            this.modifierKeys.alt = e.altKey;
            this.modifierKeys.shift = e.shiftKey;
            this.modifierKeys.meta = e.metaKey;
        }

        /**
         * Reset modifier keys
         */
        resetModifiers() {
            this.modifierKeys = {
                ctrl: false,
                alt: false,
                shift: false,
                meta: false
            };
        }

        /**
         * Check if user is typing in an input field
         */
        isTyping(e) {
            const target = e.target;
            const tagName = target.tagName.toLowerCase();
            
            // Check if target is an input element
            if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
                return true;
            }
            
            // Check if target has contenteditable
            if (target.contentEditable === 'true') {
                return true;
            }
            
            // Check if target is inside a code editor
            if (target.closest('.CodeMirror, .ace_editor, .monaco-editor')) {
                return true;
            }
            
            return false;
        }

        /**
         * Build shortcut string from event
         */
        buildShortcutString(e) {
            const parts = [];
            
            if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');
            
            // Get key name
            let key = e.key;
            
            // Normalize key names
            const keyMap = {
                'ArrowLeft': 'Left',
                'ArrowRight': 'Right',
                'ArrowUp': 'Up',
                'ArrowDown': 'Down',
                ' ': 'Space',
                'Enter': 'Enter',
                'Escape': 'Escape',
                'Tab': 'Tab',
                'Backspace': 'Backspace',
                'Delete': 'Delete'
            };
            
            key = keyMap[key] || key;
            
            // Handle letter keys
            if (key.length === 1) {
                key = key.toLowerCase();
            }
            
            parts.push(key);
            
            return parts.join('+');
        }

        /**
         * Check if shortcut is valid for current context
         */
        isShortcutValidForContext(shortcutInfo) {
            if (!shortcutInfo.context) return true;
            
            if (shortcutInfo.context === 'global') return true;
            
            if (Array.isArray(shortcutInfo.context)) {
                return shortcutInfo.context.includes(this.activeContext);
            }
            
            return shortcutInfo.context === this.activeContext;
        }

        /**
         * Execute action for shortcut
         */
        executeAction(action, event) {
            // Check if callback exists
            const callback = this.actionCallbacks.get(action);
            
            if (callback) {
                try {
                    callback(event);
                } catch (error) {
                    console.error('Error executing shortcut action:', action, error);
                }
            } else {
                // Try to find default action handler
                this.executeDefaultAction(action, event);
            }
        }

        /**
         * Execute default actions
         */
        executeDefaultAction(action, event) {
            switch (action) {
                case 'startAutomation':
                    if (window.stashUIManager) {
                        window.stashUIManager.startAutomation();
                    }
                    break;
                    
                case 'startAutomationSilent':
                    if (window.stashUIManager) {
                        window.stashUIManager.startAutomation(true);
                    }
                    break;
                    
                case 'toggleMinimize':
                    if (window.stashUIManager) {
                        if (window.stashUIManager.isMinimized) {
                            window.stashUIManager.expand();
                        } else {
                            window.stashUIManager.minimize();
                        }
                    }
                    break;
                    
                case 'cancelAutomation':
                    if (window.stashUIManager) {
                        window.stashUIManager.cancelAutomation();
                    }
                    break;
                    
                case 'openConfig':
                    if (window.stashUIManager) {
                        window.stashUIManager.openConfigDialog();
                    }
                    break;
                    
                case 'showHelp':
                    this.showHelpDialog();
                    break;
                    
                case 'toggleTheme':
                    if (window.themeManager) {
                        window.themeManager.toggle();
                    }
                    break;
                    
                case 'togglePerformanceMonitor':
                    if (window.performanceMonitor) {
                        window.performanceMonitor.toggle();
                    }
                    break;
                    
                case 'toggleDebugMode':
                    const currentDebug = GM_getValue('debugMode', false);
                    GM_setValue('debugMode', !currentDebug);
                    console.log('Debug mode:', !currentDebug ? 'ON' : 'OFF');
                    break;
                    
                default:
                    console.log('No handler for action:', action);
            }
        }

        /**
         * Register a keyboard shortcut
         */
        registerShortcut(key, action, description = '', context = 'global') {
            this.shortcuts.set(key, {
                key,
                action,
                description,
                context
            });
        }

        /**
         * Unregister a keyboard shortcut
         */
        unregisterShortcut(key) {
            this.shortcuts.delete(key);
        }

        /**
         * Register action callback
         */
        onAction(action, callback) {
            this.actionCallbacks.set(action, callback);
        }

        /**
         * Remove action callback
         */
        offAction(action) {
            this.actionCallbacks.delete(action);
        }

        /**
         * Create visual feedback element
         */
        createFeedbackElement() {
            this.feedbackElement = document.createElement('div');
            this.feedbackElement.id = 'keyboard-shortcut-feedback';
            this.feedbackElement.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                z-index: 100000;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
                backdrop-filter: blur(10px);
            `;
            document.body.appendChild(this.feedbackElement);
        }

        /**
         * Show visual feedback for shortcut activation
         */
        showFeedback(shortcutInfo) {
            if (!this.feedbackElement) return;
            
            // Clear existing timeout
            if (this.feedbackTimeout) {
                clearTimeout(this.feedbackTimeout);
            }
            
            // Update content
            this.feedbackElement.innerHTML = `
                <span style="color: #667eea; font-weight: bold;">${shortcutInfo.key}</span>
                ${shortcutInfo.description ? ` → ${shortcutInfo.description}` : ''}
            `;
            
            // Show element
            this.feedbackElement.style.opacity = '1';
            
            // Hide after delay
            this.feedbackTimeout = setTimeout(() => {
                this.feedbackElement.style.opacity = '0';
            }, 1500);
        }

        /**
         * Show help dialog with all shortcuts
         */
        showHelpDialog() {
            // Group shortcuts by context
            const shortcutsByContext = new Map();
            
            this.shortcuts.forEach((info) => {
                const context = info.context || 'global';
                if (!shortcutsByContext.has(context)) {
                    shortcutsByContext.set(context, []);
                }
                shortcutsByContext.get(context).push(info);
            });
            
            // Build help content
            let helpContent = '<div style="max-height: 400px; overflow-y: auto;">';
            
            shortcutsByContext.forEach((shortcuts, context) => {
                helpContent += `
                    <h4 style="color: #667eea; margin-top: 15px; text-transform: capitalize;">
                        ${context} Shortcuts
                    </h4>
                    <table style="width: 100%; font-size: 13px;">
                `;
                
                shortcuts.sort((a, b) => a.key.localeCompare(b.key)).forEach(info => {
                    helpContent += `
                        <tr>
                            <td style="padding: 4px; color: #764ba2; font-family: monospace;">
                                ${info.key}
                            </td>
                            <td style="padding: 4px;">
                                ${info.description || info.action}
                            </td>
                        </tr>
                    `;
                });
                
                helpContent += '</table>';
            });
            
            helpContent += '</div>';
            
            // Create modal
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                color: #333;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                z-index: 100001;
                max-width: 500px;
                width: 90%;
            `;
            
            modal.innerHTML = `
                <h3 style="margin-top: 0; color: #667eea;">
                    Keyboard Shortcuts
                </h3>
                ${helpContent}
                <button id="close-help" style="
                    margin-top: 15px;
                    padding: 8px 16px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                ">Close</button>
            `;
            
            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 100000;
            `;
            
            document.body.appendChild(backdrop);
            document.body.appendChild(modal);
            
            // Close handlers
            const closeHelp = () => {
                modal.remove();
                backdrop.remove();
            };
            
            modal.querySelector('#close-help').addEventListener('click', closeHelp);
            backdrop.addEventListener('click', closeHelp);
            
            // Close on Escape
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    closeHelp();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        }

        /**
         * Enable/disable keyboard shortcuts
         */
        setEnabled(enabled) {
            this.enabled = enabled;
            console.log('Keyboard shortcuts:', enabled ? 'enabled' : 'disabled');
        }

        /**
         * Get all registered shortcuts
         */
        getShortcuts() {
            return Array.from(this.shortcuts.values());
        }

        /**
         * Export shortcuts configuration
         */
        exportConfig() {
            const config = {};
            this.shortcuts.forEach((info, key) => {
                config[key] = {
                    action: info.action,
                    description: info.description,
                    context: info.context
                };
            });
            return config;
        }

        /**
         * Import shortcuts configuration
         */
        importConfig(config) {
            // Clear existing shortcuts
            this.shortcuts.clear();
            
            // Import new shortcuts
            Object.entries(config).forEach(([key, value]) => {
                this.registerShortcut(key, value.action, value.description, value.context);
            });
            
            console.log('Imported', this.shortcuts.size, 'shortcuts');
        }
    }

    // Export for use in AutomateStash
    if (typeof window !== 'undefined') {
        window.KeyboardShortcutsManager = KeyboardShortcutsManager;
        
        // Auto-initialize if config is available
        if (window.keyboardShortcutsConfig) {
            window.keyboardShortcuts = new KeyboardShortcutsManager(window.keyboardShortcutsConfig);
        }
    }

})();