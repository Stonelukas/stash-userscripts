// ==UserScript==
// @name         Widget Sub-Managers for Enhanced Widget System
// @namespace    https://github.com/Stonelukas/stash-userscripts
// @version      1.0.0
// @description  Sub-manager classes for widget system: ZIndex, Focus, State, Theme, Keyboard, Animation
// @author       AutomateStash Team
// ==/UserScript==

(function () {
    'use strict';

    /**
     * ZIndexManager - Manages widget z-index layering and focus order
     */
    class ZIndexManager {
        constructor(widgetManager) {
            this.widgetManager = widgetManager;
            this.baseZIndex = 10000;
            this.zIndexStack = [];
            this.maxZIndex = 10100;
            this.currentMaxZIndex = this.baseZIndex;
            this.focusedWidget = null;
        }

        addWidget(widget) {
            if (!widget) return;

            // Assign initial z-index
            widget.state.zIndex = this.getNextZIndex();
            widget.element.style.zIndex = widget.state.zIndex;

            // Add to stack
            this.zIndexStack.push(widget);

            // Set as focused if it's the only widget
            if (this.zIndexStack.length === 1) {
                this.setFocused(widget);
            }
        }

        removeWidget(widget) {
            const index = this.zIndexStack.indexOf(widget);
            if (index > -1) {
                this.zIndexStack.splice(index, 1);
            }

            // Rebalance if needed
            if (this.currentMaxZIndex > this.maxZIndex - 10) {
                this.rebalanceZIndices();
            }
        }

        bringToFront(widget) {
            if (!widget) return;

            // Remove from current position
            const index = this.zIndexStack.indexOf(widget);
            if (index > -1) {
                this.zIndexStack.splice(index, 1);
            }

            // Add to top of stack
            this.zIndexStack.push(widget);

            // Assign new z-index
            widget.state.zIndex = this.getNextZIndex();
            widget.element.style.zIndex = widget.state.zIndex;

            // Apply focus styling
            this.setFocused(widget);

            // Rebalance if approaching max
            if (this.currentMaxZIndex > this.maxZIndex - 10) {
                this.rebalanceZIndices();
            }
        }

        getNextZIndex() {
            this.currentMaxZIndex++;
            return this.currentMaxZIndex;
        }

        rebalanceZIndices() {
            // Redistribute z-indices to prevent overflow
            const step = Math.floor((this.maxZIndex - this.baseZIndex) / (this.zIndexStack.length + 1));

            this.zIndexStack.forEach((widget, index) => {
                const newZIndex = this.baseZIndex + (index + 1) * step;
                widget.state.zIndex = newZIndex;
                widget.element.style.zIndex = newZIndex;
            });

            this.currentMaxZIndex = this.baseZIndex + this.zIndexStack.length * step;
        }

        setFocused(widget) {
            // Remove focus from previous widget
            if (this.focusedWidget && this.focusedWidget !== widget) {
                this.focusedWidget.element.classList.remove('widget-focused');
                this.focusedWidget.state.isFocused = false;
            }

            // Set new focused widget
            this.focusedWidget = widget;
            widget.element.classList.add('widget-focused');
            widget.state.isFocused = true;

            // Apply focus indicator styles
            this.applyFocusIndicator(widget);
        }

        applyFocusIndicator(widget) {
            // Add enhanced shadow for focused widget
            widget.element.style.boxShadow = '0 0 20px rgba(52, 152, 219, 0.5), 0 10px 40px rgba(0, 0, 0, 0.3)';

            // Slightly dim other widgets
            this.zIndexStack.forEach(w => {
                if (w !== widget) {
                    w.element.style.opacity = '0.95';
                } else {
                    w.element.style.opacity = '1';
                }
            });
        }

        getSortedWidgets() {
            return [...this.zIndexStack].sort((a, b) => b.state.zIndex - a.state.zIndex);
        }
    }

    /**
     * FocusManager - Manages widget focus state and visual indicators
     */
    class FocusManager {
        constructor(widgetManager) {
            this.widgetManager = widgetManager;
            this.focusedWidget = null;
            this.focusHistory = [];
            this.maxHistorySize = 10;
        }

        attachToWidget(widget) {
            if (!widget || !widget.element) return;

            // Add click handler for focus
            widget.element.addEventListener('mousedown', (e) => {
                this.setFocus(widget);
            });

            // Add keyboard navigation support
            widget.element.setAttribute('tabindex', '0');
            widget.element.addEventListener('focus', () => {
                this.setFocus(widget);
            });
        }

        setFocus(widget) {
            if (this.focusedWidget === widget) return;

            // Blur previous widget
            if (this.focusedWidget) {
                this.blurWidget(this.focusedWidget);
            }

            // Focus new widget
            this.focusedWidget = widget;
            widget.state.isFocused = true;
            widget.element.classList.add('widget-focused');

            // Add to history
            this.addToHistory(widget);

            // Update visual indicators
            this.updateFocusIndicators();
        }

        blurWidget(widget) {
            if (!widget) return;

            widget.state.isFocused = false;
            widget.element.classList.remove('widget-focused');
        }

        addToHistory(widget) {
            // Remove if already in history
            const index = this.focusHistory.indexOf(widget);
            if (index > -1) {
                this.focusHistory.splice(index, 1);
            }

            // Add to beginning
            this.focusHistory.unshift(widget);

            // Trim history
            if (this.focusHistory.length > this.maxHistorySize) {
                this.focusHistory.pop();
            }
        }

        updateFocusIndicators() {
            // Apply visual focus indicators based on manager config
            const config = this.widgetManager.config;

            if (config.focusIndicatorStyle === 'shadow') {
                this.applyShadowIndicator();
            } else if (config.focusIndicatorStyle === 'border') {
                this.applyBorderIndicator();
            } else if (config.focusIndicatorStyle === 'opacity') {
                this.applyOpacityIndicator();
            }
        }

        applyShadowIndicator() {
            if (this.focusedWidget) {
                this.focusedWidget.element.style.boxShadow = '0 0 20px rgba(52, 152, 219, 0.5)';
            }
        }

        applyBorderIndicator() {
            if (this.focusedWidget) {
                this.focusedWidget.element.style.border = '2px solid #3498db';
            }
        }

        applyOpacityIndicator() {
            this.widgetManager.getAllWidgets().forEach(widget => {
                if (widget === this.focusedWidget) {
                    widget.element.style.opacity = '1';
                } else {
                    widget.element.style.opacity = '0.9';
                }
            });
        }

        getFocusHistory() {
            return [...this.focusHistory];
        }
    }

    /**
     * WidgetStateManager - Manages widget state persistence
     */
    class WidgetStateManager {
        constructor(widgetManager) {
            this.widgetManager = widgetManager;
            this.storagePrefix = 'widget_state_';
            this.autoSaveInterval = 5000; // Auto-save every 5 seconds
            this.autoSaveTimer = null;
            this.dirtyWidgets = new Set();
        }

        saveState(widgetId, state) {
            try {
                const key = `${this.storagePrefix}${widgetId}`;
                const stateToSave = {
                    ...state,
                    timestamp: Date.now(),
                    version: '1.0.0'
                };

                if (typeof GM_setValue !== 'undefined') {
                    GM_setValue(key, JSON.stringify(stateToSave));
                } else {
                    localStorage.setItem(key, JSON.stringify(stateToSave));
                }

                // Remove from dirty set
                this.dirtyWidgets.delete(widgetId);

                console.log(`[StateManager] Saved state for widget: ${widgetId}`);
            } catch (error) {
                console.error(`[StateManager] Failed to save state for ${widgetId}:`, error);
            }
        }

        loadState(widgetId) {
            try {
                const key = `${this.storagePrefix}${widgetId}`;
                let savedState = null;

                if (typeof GM_getValue !== 'undefined') {
                    const stored = GM_getValue(key, null);
                    if (stored) {
                        savedState = JSON.parse(stored);
                    }
                } else {
                    const stored = localStorage.getItem(key);
                    if (stored) {
                        savedState = JSON.parse(stored);
                    }
                }

                if (savedState) {
                    // Apply saved state to widget
                    const widget = this.widgetManager.getWidget(widgetId);
                    if (widget) {
                        this.applyState(widget, savedState);
                    }

                    console.log(`[StateManager] Loaded state for widget: ${widgetId}`);
                    return savedState;
                }
            } catch (error) {
                console.error(`[StateManager] Failed to load state for ${widgetId}:`, error);
            }

            return null;
        }

        applyState(widget, savedState) {
            // Apply position
            if (savedState.position) {
                widget.state.position = savedState.position;
                widget.element.style.left = `${savedState.position.x}px`;
                widget.element.style.top = `${savedState.position.y}px`;
            }

            // Apply dimensions
            if (savedState.dimensions) {
                widget.state.dimensions = savedState.dimensions;
                widget.element.style.width = `${savedState.dimensions.width}px`;
                widget.element.style.height = `${savedState.dimensions.height}px`;
            }

            // Apply visibility
            if (savedState.isMinimized) {
                widget.state.isMinimized = true;
                widget.element.style.display = 'none';
            }
        }

        markDirty(widgetId) {
            this.dirtyWidgets.add(widgetId);
            this.scheduleAutoSave();
        }

        scheduleAutoSave() {
            if (this.autoSaveTimer) {
                clearTimeout(this.autoSaveTimer);
            }

            this.autoSaveTimer = setTimeout(() => {
                this.saveAllDirty();
            }, this.autoSaveInterval);
        }

        saveAllDirty() {
            this.dirtyWidgets.forEach(widgetId => {
                const widget = this.widgetManager.getWidget(widgetId);
                if (widget) {
                    this.saveState(widgetId, widget.state);
                }
            });

            this.dirtyWidgets.clear();
        }

        clearState(widgetId) {
            try {
                const key = `${this.storagePrefix}${widgetId}`;

                if (typeof GM_deleteValue !== 'undefined') {
                    GM_deleteValue(key);
                } else {
                    localStorage.removeItem(key);
                }

                console.log(`[StateManager] Cleared state for widget: ${widgetId}`);
            } catch (error) {
                console.error(`[StateManager] Failed to clear state for ${widgetId}:`, error);
            }
        }
    }

    /**
     * ThemeApplicationManager - Bridge between ui-theme-manager.js and widget system
     * Uses the existing ThemeManager from ui-theme-manager.js
     */
    class ThemeApplicationManager {
        constructor(widgetManager) {
            this.widgetManager = widgetManager;
            this.themeManager = null;
            this.initialized = false;

            // Wait for the global ThemeManager to be available
            this.initializeThemeManager();
        }

        initializeThemeManager() {
            // Check if ThemeManager is already available
            if (window.themeManager) {
                this.themeManager = window.themeManager;
                this.setupIntegration();
            } else if (window.ThemeManager) {
                // Create instance if class is available but instance isn't
                this.themeManager = new window.ThemeManager();
                window.themeManager = this.themeManager;
                this.setupIntegration();
            } else {
                // Wait for ThemeManager to be loaded
                const checkInterval = setInterval(() => {
                    if (window.themeManager || window.ThemeManager) {
                        clearInterval(checkInterval);
                        this.themeManager = window.themeManager || new window.ThemeManager();
                        if (!window.themeManager) {
                            window.themeManager = this.themeManager;
                        }
                        this.setupIntegration();
                    }
                }, 100);

                // Give up after 5 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!this.themeManager) {
                        console.warn('[ThemeApplicationManager] ThemeManager not found, themes will not work');
                    }
                }, 5000);
            }
        }

        setupIntegration() {
            if (!this.themeManager) return;

            this.initialized = true;

            // Register callback for theme changes
            this.themeManager.onThemeChange((themeName, theme) => {
                this.applyThemeToAllWidgets();
            });

            // Apply current theme to existing widgets
            this.applyThemeToAllWidgets();

            console.log('[ThemeApplicationManager] Integrated with ThemeManager');
        }

        async applyTheme(themeName) {
            if (!this.themeManager) {
                console.warn('[ThemeApplicationManager] ThemeManager not available');
                return;
            }

            // Use the existing ThemeManager to apply theme
            this.themeManager.applyTheme(themeName);

            // Apply to all widgets
            this.applyThemeToAllWidgets();
        }

        applyThemeToAllWidgets() {
            if (!this.widgetManager) return;

            this.widgetManager.getAllWidgets().forEach(widget => {
                this.applyToWidget(widget);
            });
        }

        applyToWidget(widget) {
            if (!widget || !widget.element || !this.themeManager) return;

            const currentTheme = this.themeManager.getCurrentTheme();
            const themeName = this.themeManager.currentTheme;

            // Apply theme classes
            widget.element.classList.remove('as-themed-panel', 'as-themed-surface');
            widget.element.classList.add('as-themed-panel');

            // Apply specific widget styles based on current theme
            if (currentTheme) {
                // Apply background and text colors
                widget.element.style.background = `linear-gradient(135deg, ${currentTheme.primary}22, ${currentTheme.secondary}22)`;
                widget.element.style.backdropFilter = 'blur(10px)';
                widget.element.style.color = currentTheme.text;
                widget.element.style.borderColor = currentTheme.border;
                widget.element.style.boxShadow = `0 10px 40px ${currentTheme.shadow}`;

                // Apply to widget header if it exists
                const header = widget.element.querySelector('.widget-header, .widget-drag-handle, [data-drag-handle]');
                if (header) {
                    header.style.background = `linear-gradient(135deg, ${currentTheme.primary}33, ${currentTheme.secondary}33)`;
                    header.style.borderBottom = `1px solid ${currentTheme.border}`;
                }

                // Apply to buttons within widget
                const buttons = widget.element.querySelectorAll('button');
                buttons.forEach(button => {
                    button.style.background = currentTheme.primary;
                    button.style.color = currentTheme.text;
                    button.style.border = `1px solid ${currentTheme.border}`;
                });
            }
        }

        registerObserver(callback) {
            if (this.themeManager) {
                this.themeManager.onThemeChange(callback);
            }
        }

        unregisterObserver(callback) {
            if (this.themeManager) {
                this.themeManager.removeCallback(callback);
            }
        }

        getActiveTheme() {
            if (this.themeManager) {
                return this.themeManager.currentTheme;
            }
            return null;
        }

        getAvailableThemes() {
            if (this.themeManager) {
                return Object.keys(this.themeManager.getAllThemes());
            }
            return [];
        }
    }

    /**
     * KeyboardManager - Manages keyboard shortcuts and context
     */
    class KeyboardManager {
        constructor(widgetManager) {
            this.widgetManager = widgetManager;
            this.contexts = new Map([
                ['global', new Map()],
                ['widget', new Map()],
                ['automation', new Map()]
            ]);
            this.activeContext = 'global';
            this.enabled = true;

            // Set up global keyboard listener
            this.setupGlobalListener();
        }

        setupGlobalListener() {
            document.addEventListener('keydown', (event) => {
                if (!this.enabled) return;

                this.handleKeyPress(event);
            }, true);
        }

        registerShortcut(context, keys, callback) {
            if (!this.contexts.has(context)) {
                this.contexts.set(context, new Map());
            }

            const normalizedKeys = this.normalizeKeys(keys);
            this.contexts.get(context).set(normalizedKeys, callback);

            console.log(`[KeyboardManager] Registered shortcut: ${keys} in context: ${context}`);
        }

        unregisterShortcut(context, keys) {
            if (!this.contexts.has(context)) return;

            const normalizedKeys = this.normalizeKeys(keys);
            this.contexts.get(context).delete(normalizedKeys);
        }

        handleKeyPress(event) {
            const key = this.getKeyString(event);

            // Check current context first
            const contextMap = this.contexts.get(this.activeContext);
            if (contextMap && contextMap.has(key)) {
                event.preventDefault();
                event.stopPropagation();

                const callback = contextMap.get(key);
                try {
                    callback(event);
                } catch (error) {
                    console.error('[KeyboardManager] Shortcut handler error:', error);
                }
                return;
            }

            // Check global context if not in global
            if (this.activeContext !== 'global') {
                const globalMap = this.contexts.get('global');
                if (globalMap && globalMap.has(key)) {
                    event.preventDefault();
                    event.stopPropagation();

                    const callback = globalMap.get(key);
                    try {
                        callback(event);
                    } catch (error) {
                        console.error('[KeyboardManager] Global shortcut handler error:', error);
                    }
                }
            }
        }

        normalizeKeys(keys) {
            return keys.toLowerCase()
                .replace(/\s+/g, '')
                .replace('ctrl', 'control')
                .replace('cmd', 'meta')
                .replace('command', 'meta');
        }

        getKeyString(event) {
            const parts = [];

            if (event.ctrlKey) parts.push('control');
            if (event.altKey) parts.push('alt');
            if (event.shiftKey) parts.push('shift');
            if (event.metaKey) parts.push('meta');

            // Get the actual key
            let key = event.key.toLowerCase();
            if (key === ' ') key = 'space';
            if (key === 'escape') key = 'escape';

            parts.push(key);

            return parts.join('+');
        }

        setContext(context) {
            if (this.contexts.has(context)) {
                this.activeContext = context;
                console.log(`[KeyboardManager] Switched to context: ${context}`);
            }
        }

        disable() {
            this.enabled = false;
        }

        enable() {
            this.enabled = true;
        }
    }

    /**
     * AnimationAnchorManager - Manages animation positioning for widgets
     */
    class AnimationAnchorManager {
        constructor(widgetManager) {
            this.widgetManager = widgetManager;
            this.widgetPositions = new WeakMap();
            this.animationDuration = 300;
        }

        calculateAnimationOrigin(widget) {
            const rect = widget.element.getBoundingClientRect();
            const center = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            // Store for later use
            this.widgetPositions.set(widget, center);

            return center;
        }

        applyAnimation(widget, animationType) {
            const origin = this.calculateAnimationOrigin(widget);

            // Set transform origin based on widget position
            widget.element.style.transformOrigin = `${origin.x}px ${origin.y}px`;

            // Apply animation class
            widget.element.classList.add(`widget-animation-${animationType}`);

            // Remove class after animation
            setTimeout(() => {
                widget.element.classList.remove(`widget-animation-${animationType}`);
            }, this.animationDuration);
        }

        animateOpen(widget) {
            const origin = this.calculateAnimationOrigin(widget);

            // Start from widget's actual position, not bottom-right
            widget.element.style.transform = 'scale(0)';
            widget.element.style.transformOrigin = '50% 50%';
            widget.element.style.opacity = '0';

            // Force reflow
            widget.element.offsetHeight;

            // Animate to full size
            widget.element.style.transition = `transform ${this.animationDuration}ms ease-out, opacity ${this.animationDuration}ms ease-out`;
            widget.element.style.transform = 'scale(1)';
            widget.element.style.opacity = '1';

            // Clean up after animation
            setTimeout(() => {
                widget.element.style.transition = '';
                widget.element.style.transform = '';
                widget.element.style.transformOrigin = '';
            }, this.animationDuration);
        }

        animateClose(widget, callback) {
            widget.element.style.transformOrigin = '50% 50%';
            widget.element.style.transition = `transform ${this.animationDuration}ms ease-in, opacity ${this.animationDuration}ms ease-in`;
            widget.element.style.transform = 'scale(0)';
            widget.element.style.opacity = '0';

            setTimeout(() => {
                if (callback) callback();
            }, this.animationDuration);
        }

        animateMinimize(widget) {
            const rect = widget.element.getBoundingClientRect();

            // Animate to bottom of screen
            widget.element.style.transition = `transform ${this.animationDuration}ms ease-in-out`;
            widget.element.style.transform = `translateY(${window.innerHeight - rect.top}px) scale(0.1)`;

            setTimeout(() => {
                widget.element.style.display = 'none';
                widget.element.style.transition = '';
                widget.element.style.transform = '';
            }, this.animationDuration);
        }

        animateRestore(widget) {
            widget.element.style.display = '';
            widget.element.style.transform = 'scale(0.1)';
            widget.element.style.opacity = '0';

            // Force reflow
            widget.element.offsetHeight;

            widget.element.style.transition = `transform ${this.animationDuration}ms ease-out, opacity ${this.animationDuration}ms ease-out`;
            widget.element.style.transform = 'scale(1)';
            widget.element.style.opacity = '1';

            setTimeout(() => {
                widget.element.style.transition = '';
                widget.element.style.transform = '';
            }, this.animationDuration);
        }

        updateTransformOrigin(widget) {
            const position = this.widgetPositions.get(widget) || this.calculateAnimationOrigin(widget);
            widget.element.style.transformOrigin = `${position.x}px ${position.y}px`;
        }
    }

    /**
     * WidgetEventBus - Central event system for widget communication
     */
    class WidgetEventBus {
        constructor() {
            this.events = new Map();
        }

        emit(eventName, data) {
            const handlers = this.events.get(eventName) || [];
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`[EventBus] Error in handler for ${eventName}:`, error);
                }
            });
        }

        on(eventName, handler) {
            if (!this.events.has(eventName)) {
                this.events.set(eventName, []);
            }
            this.events.get(eventName).push(handler);
        }

        off(eventName, handler) {
            const handlers = this.events.get(eventName) || [];
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    // Export all sub-managers
    if (typeof window !== 'undefined') {
        window.ZIndexManager = ZIndexManager;
        window.FocusManager = FocusManager;
        window.WidgetStateManager = WidgetStateManager;
        window.ThemeApplicationManager = ThemeApplicationManager;
        window.KeyboardManager = KeyboardManager;
        window.AnimationAnchorManager = AnimationAnchorManager;
        window.WidgetEventBus = WidgetEventBus;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            ZIndexManager,
            FocusManager,
            WidgetStateManager,
            ThemeApplicationManager,
            KeyboardManager,
            AnimationAnchorManager,
            WidgetEventBus
        };
    }
})(); 