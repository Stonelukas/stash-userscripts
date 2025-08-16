// ==UserScript==
// @name         UI Configuration for AutomateStash
// @version      1.0.0
// @description  General UI configuration settings that coordinate with theme, animation, and keyboard managers
// @author       AutomateStash Team
// ==/UserScript==

(function() {
    'use strict';

    /**
     * UIConfig - General UI configuration that works with existing managers
     * Coordinates settings between ThemeManager, AnimationController, and KeyboardShortcuts
     */
    class UIConfig {
        constructor() {
            // UI Layout and behavior settings (not theme-specific)
            this.defaults = {
                // Panel Configuration
                panel: {
                    position: 'right', // left, right, top, bottom
                    size: 'medium', // small, medium, large
                    opacity: 0.95,
                    autoHide: false,
                    autoHideDelay: 5000,
                    rememberPosition: true,
                    draggable: true,
                    resizable: false,
                    startMinimized: false,
                    showOnPageLoad: true,
                    zIndex: 10000
                },
                
                // Notification Settings
                notifications: {
                    enabled: true,
                    position: 'top-right', // top-left, top-right, bottom-left, bottom-right, center
                    duration: 4000,
                    stackNotifications: true,
                    maxStack: 5,
                    playSound: false,
                    soundVolume: 0.5,
                    groupSimilar: true,
                    showTimestamp: false,
                    persistErrors: true,
                    animateIn: true,
                    animateOut: true
                },
                
                // Status Display
                status: {
                    showProgressBar: true,
                    showPercentage: true,
                    showTimeRemaining: true,
                    showCurrentStep: true,
                    showSourceIcons: true,
                    compactMode: false,
                    autoExpandOnError: true,
                    historyLimit: 10
                },
                
                // Automation Behavior
                automation: {
                    confirmBeforeStart: false,
                    showSummaryOnComplete: true,
                    minimizeOnComplete: true,
                    soundOnComplete: false,
                    autoCloseOnSuccess: false,
                    autoCloseDelay: 10000,
                    pauseBetweenSteps: 100,
                    showDebugInfo: false,
                    logToConsole: true
                },
                
                // Button Configuration
                buttons: {
                    size: 'medium', // small, medium, large
                    showLabels: true,
                    showIcons: true,
                    enableTooltips: true,
                    tooltipDelay: 500,
                    hoverEffect: true,
                    clickFeedback: true,
                    rippleEffect: false
                },
                
                // Dialog Settings
                dialogs: {
                    showBackdrop: true,
                    closeOnEscape: true,
                    closeOnBackdropClick: true,
                    centerVertically: true,
                    animateIn: true,
                    animateOut: true,
                    blurBackground: true,
                    rememberSize: false
                },
                
                // Performance Settings
                performance: {
                    enableAnimations: true,
                    animationSpeed: 1.0, // 0.5 = slower, 2.0 = faster
                    enableTransitions: true,
                    reducedMotion: 'auto', // auto, always, never
                    lazyLoadImages: true,
                    virtualScrolling: false,
                    debounceDelay: 300,
                    throttleDelay: 100
                },
                
                // Accessibility
                accessibility: {
                    enableKeyboardNav: true,
                    showFocusIndicators: true,
                    announceActions: true,
                    highContrastMode: false,
                    largeClickTargets: false,
                    descriptiveLabels: true,
                    skipToContent: true,
                    readableErrors: true
                },
                
                // Advanced Settings
                advanced: {
                    debugMode: false,
                    verboseLogging: false,
                    experimentalFeatures: false,
                    customCSS: '',
                    customSelectors: {},
                    enableMetrics: true,
                    metricsInterval: 5000,
                    cacheUIState: true,
                    syncAcrossTabs: false
                },
                
                // Integration Settings
                integration: {
                    themeFollowsSystem: true,
                    keyboardShortcutsEnabled: true,
                    animationsEnabled: true,
                    performanceMonitoring: true,
                    autoSaveSettings: true,
                    settingsVersion: '1.0.0'
                }
            };
            
            // Load saved configuration
            this.config = this.loadConfig();
            
            // Change listeners
            this.listeners = new Map();
            
            // Initialize
            this.initialize();
        }

        /**
         * Initialize UI configuration
         */
        initialize() {
            // Apply initial configuration
            this.applyConfiguration();
            
            // Setup integration with other managers
            this.setupIntegrations();
            
            // Watch for system preferences
            this.watchSystemPreferences();
            
            console.log('🎨 UI Configuration initialized');
        }

        /**
         * Load configuration from storage
         */
        loadConfig() {
            if (typeof GM_getValue !== 'undefined') {
                const stored = GM_getValue('ui_general_config', null);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        return this.mergeConfigs(this.defaults, parsed);
                    } catch (e) {
                        console.error('Failed to parse UI config:', e);
                    }
                }
            }
            return JSON.parse(JSON.stringify(this.defaults));
        }

        /**
         * Save configuration to storage
         */
        saveConfig() {
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue('ui_general_config', JSON.stringify(this.config));
            }
        }

        /**
         * Get configuration value
         */
        get(path, defaultValue = undefined) {
            const keys = path.split('.');
            let value = this.config;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return defaultValue;
                }
            }
            
            return value;
        }

        /**
         * Set configuration value
         */
        set(path, value) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = this.config;
            
            for (const key of keys) {
                if (!(key in target) || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                target = target[key];
            }
            
            const oldValue = target[lastKey];
            target[lastKey] = value;
            
            // Apply changes
            this.applyConfigChange(path, value, oldValue);
            
            // Notify listeners
            this.notifyListeners(path, value, oldValue);
            
            // Save
            this.saveConfig();
        }

        /**
         * Apply configuration changes
         */
        applyConfiguration() {
            // Apply panel settings
            this.applyPanelConfig();
            
            // Apply notification settings
            this.applyNotificationConfig();
            
            // Apply performance settings
            this.applyPerformanceConfig();
            
            // Apply accessibility settings
            this.applyAccessibilityConfig();
        }

        /**
         * Apply specific configuration change
         */
        applyConfigChange(path, value, oldValue) {
            // Route changes to appropriate handlers
            if (path.startsWith('panel.')) {
                this.applyPanelConfig();
            } else if (path.startsWith('notifications.')) {
                this.applyNotificationConfig();
            } else if (path.startsWith('performance.')) {
                this.applyPerformanceConfig();
            } else if (path.startsWith('accessibility.')) {
                this.applyAccessibilityConfig();
            } else if (path.startsWith('integration.')) {
                this.updateIntegrations(path, value);
            }
        }

        /**
         * Apply panel configuration
         */
        applyPanelConfig() {
            const panel = document.querySelector('#stash-automation-panel');
            if (!panel) return;
            
            const position = this.get('panel.position');
            const size = this.get('panel.size');
            const opacity = this.get('panel.opacity');
            
            // Position styles
            const positions = {
                right: { top: '50px', right: '20px', left: 'auto', bottom: 'auto' },
                left: { top: '50px', left: '20px', right: 'auto', bottom: 'auto' },
                top: { top: '20px', left: '50%', transform: 'translateX(-50%)', right: 'auto', bottom: 'auto' },
                bottom: { bottom: '20px', left: '50%', transform: 'translateX(-50%)', top: 'auto', right: 'auto' }
            };
            
            // Size styles
            const sizes = {
                small: { width: '280px', fontSize: '13px' },
                medium: { width: '320px', fontSize: '14px' },
                large: { width: '400px', fontSize: '15px' }
            };
            
            if (positions[position]) {
                Object.assign(panel.style, positions[position]);
            }
            
            if (sizes[size]) {
                Object.assign(panel.style, sizes[size]);
            }
            
            panel.style.opacity = opacity;
        }

        /**
         * Apply notification configuration
         */
        applyNotificationConfig() {
            // This would be used by NotificationManager
            const position = this.get('notifications.position');
            const duration = this.get('notifications.duration');
            
            // Store for NotificationManager to use
            if (window.notificationConfig) {
                window.notificationConfig.position = position;
                window.notificationConfig.duration = duration;
            }
        }

        /**
         * Apply performance configuration
         */
        applyPerformanceConfig() {
            const animationSpeed = this.get('performance.animationSpeed');
            const enableAnimations = this.get('performance.enableAnimations');
            
            // Update animation controller
            if (window.animationController) {
                window.animationController.setEnabled(enableAnimations);
                window.animationController.setSpeed(animationSpeed);
            }
            
            // Update CSS variable
            document.documentElement.style.setProperty('--animation-speed', animationSpeed);
        }

        /**
         * Apply accessibility configuration
         */
        applyAccessibilityConfig() {
            const keyboardNav = this.get('accessibility.enableKeyboardNav');
            const focusIndicators = this.get('accessibility.showFocusIndicators');
            const largeTargets = this.get('accessibility.largeClickTargets');
            
            // Update body classes
            document.body.classList.toggle('as-keyboard-nav', keyboardNav);
            document.body.classList.toggle('as-focus-indicators', focusIndicators);
            document.body.classList.toggle('as-large-targets', largeTargets);
            
            // Update keyboard shortcuts
            if (window.keyboardShortcuts) {
                window.keyboardShortcuts.setEnabled(keyboardNav);
            }
        }

        /**
         * Setup integrations with other managers
         */
        setupIntegrations() {
            // Coordinate with ThemeManager
            if (window.themeManager && this.get('integration.themeFollowsSystem')) {
                window.themeManager.detectSystemPreference();
            }
            
            // Coordinate with AnimationController
            if (window.animationController && this.get('integration.animationsEnabled')) {
                window.animationController.setEnabled(true);
            }
            
            // Coordinate with KeyboardShortcuts
            if (window.keyboardShortcuts && this.get('integration.keyboardShortcutsEnabled')) {
                window.keyboardShortcuts.setEnabled(true);
            }
            
            // Coordinate with PerformanceEnhancer
            if (window.PerformanceEnhancer && this.get('integration.performanceMonitoring')) {
                window.PerformanceEnhancer.setEnabled(true);
            }
        }

        /**
         * Update integrations based on config changes
         */
        updateIntegrations(path, value) {
            if (path === 'integration.themeFollowsSystem' && window.themeManager) {
                if (value) {
                    window.themeManager.applyTheme('system');
                }
            } else if (path === 'integration.keyboardShortcutsEnabled' && window.keyboardShortcuts) {
                window.keyboardShortcuts.setEnabled(value);
            } else if (path === 'integration.animationsEnabled' && window.animationController) {
                window.animationController.setEnabled(value);
            } else if (path === 'integration.performanceMonitoring' && window.PerformanceEnhancer) {
                window.PerformanceEnhancer.setEnabled(value);
            }
        }

        /**
         * Watch system preferences
         */
        watchSystemPreferences() {
            if (!window.matchMedia) return;
            
            // Watch reduced motion preference
            const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            reducedMotionQuery.addEventListener('change', (e) => {
                if (this.get('performance.reducedMotion') === 'auto') {
                    this.set('performance.enableAnimations', !e.matches);
                }
            });
            
            // Watch contrast preference
            const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
            highContrastQuery.addEventListener('change', (e) => {
                if (this.get('accessibility.highContrastMode') === 'auto') {
                    this.set('accessibility.highContrastMode', e.matches);
                }
            });
        }

        /**
         * Register change listener
         */
        onChange(path, callback) {
            if (!this.listeners.has(path)) {
                this.listeners.set(path, []);
            }
            this.listeners.get(path).push(callback);
        }

        /**
         * Remove change listener
         */
        offChange(path, callback) {
            const listeners = this.listeners.get(path);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        }

        /**
         * Notify listeners of changes
         */
        notifyListeners(path, newValue, oldValue) {
            // Specific path listeners
            const pathListeners = this.listeners.get(path) || [];
            pathListeners.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error('Error in UI config listener:', error);
                }
            });
            
            // Wildcard listeners
            const wildcardListeners = this.listeners.get('*') || [];
            wildcardListeners.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error('Error in UI config wildcard listener:', error);
                }
            });
        }

        /**
         * Reset to defaults
         */
        reset(path = null) {
            if (path) {
                const defaultValue = this.getDefault(path);
                this.set(path, defaultValue);
            } else {
                this.config = JSON.parse(JSON.stringify(this.defaults));
                this.saveConfig();
                this.applyConfiguration();
                this.notifyListeners('*', this.config, null);
            }
        }

        /**
         * Get default value
         */
        getDefault(path) {
            const keys = path.split('.');
            let value = this.defaults;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return undefined;
                }
            }
            
            return value;
        }

        /**
         * Merge configurations
         */
        mergeConfigs(defaults, custom) {
            const merged = JSON.parse(JSON.stringify(defaults));
            
            const merge = (target, source) => {
                for (const key in source) {
                    if (source.hasOwnProperty(key)) {
                        if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
                            if (!target[key]) target[key] = {};
                            merge(target[key], source[key]);
                        } else {
                            target[key] = source[key];
                        }
                    }
                }
            };
            
            merge(merged, custom);
            return merged;
        }

        /**
         * Export configuration
         */
        export() {
            return JSON.stringify(this.config, null, 2);
        }

        /**
         * Import configuration
         */
        import(configString) {
            try {
                const imported = JSON.parse(configString);
                this.config = this.mergeConfigs(this.defaults, imported);
                this.saveConfig();
                this.applyConfiguration();
                this.notifyListeners('*', this.config, null);
                return true;
            } catch (error) {
                console.error('Failed to import UI config:', error);
                return false;
            }
        }

        /**
         * Get statistics about current configuration
         */
        getStats() {
            return {
                totalSettings: this.countSettings(this.config),
                modifiedSettings: this.countModified(),
                integrationStatus: {
                    theme: !!window.themeManager,
                    animations: !!window.animationController,
                    keyboard: !!window.keyboardShortcuts,
                    performance: !!window.PerformanceEnhancer
                }
            };
        }

        /**
         * Count total settings
         */
        countSettings(obj) {
            let count = 0;
            for (const key in obj) {
                if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null) {
                    count += this.countSettings(obj[key]);
                } else {
                    count++;
                }
            }
            return count;
        }

        /**
         * Count modified settings
         */
        countModified() {
            let count = 0;
            const compare = (current, defaults, path = '') => {
                for (const key in current) {
                    const newPath = path ? `${path}.${key}` : key;
                    if (typeof current[key] === 'object' && !Array.isArray(current[key]) && current[key] !== null) {
                        compare(current[key], defaults[key] || {}, newPath);
                    } else if (current[key] !== (defaults[key] !== undefined ? defaults[key] : current[key])) {
                        count++;
                    }
                }
            };
            compare(this.config, this.defaults);
            return count;
        }
    }

    // Export for use in AutomateStash
    if (typeof window !== 'undefined') {
        window.UIConfig = UIConfig;
        window.uiConfig = new UIConfig();
        
        // Convenience functions
        window.getUIConfig = (path, defaultValue) => window.uiConfig.get(path, defaultValue);
        window.setUIConfig = (path, value) => window.uiConfig.set(path, value);
        window.resetUIConfig = (path) => window.uiConfig.reset(path);
    }

})();