// ==UserScript==
// @name         Widget Manager Integration
// @namespace    https://github.com/Stonelukas/stash-userscripts
// @version      1.0.0
// @description  Integration layer between UIManager and EnhancedWidgetManager
// @author       AutomateStash Team
// ==/UserScript==

(function() {
    'use strict';

    /**
     * WidgetManagerIntegration - Bridge between existing UIManager and EnhancedWidgetManager
     * This class provides seamless integration without breaking existing functionality
     */
    class WidgetManagerIntegration {
        constructor(uiManager) {
            this.uiManager = uiManager;
            this.enhancedManager = null;
            this.initialized = false;
            this.widgetMap = new Map(); // Maps UIManager widget names to EnhancedWidgetManager IDs
            
            // Integration settings
            this.config = {
                enableEnhancements: true,
                preserveLegacyBehavior: true,
                autoMigrate: true,
                debugMode: false
            };
            
            // Initialize the integration
            this.init();
        }
        
        /**
         * Initialize the integration layer
         */
        async init() {
            try {
                // Check if EnhancedWidgetManager is available
                if (typeof window.EnhancedWidgetManager === 'undefined') {
                    console.warn('[WidgetIntegration] EnhancedWidgetManager not found, skipping enhancements');
                    return;
                }
                
                // Create and initialize EnhancedWidgetManager instance
                this.enhancedManager = new window.EnhancedWidgetManager();
                
                // Store reference in UIManager for direct access if needed
                this.uiManager.enhancedWidgetManager = this.enhancedManager;
                
                // Hook into existing UIManager methods
                this.hookUIManagerMethods();
                
                // Migrate existing widgets if any
                if (this.config.autoMigrate) {
                    this.migrateExistingWidgets();
                }
                
                // Set up event listeners for enhanced features
                this.setupEventListeners();
                
                this.initialized = true;
                console.log('[WidgetIntegration] Successfully integrated UIManager with EnhancedWidgetManager');
                
            } catch (error) {
                console.error('[WidgetIntegration] Failed to initialize:', error);
                // Fall back to legacy behavior
                this.config.enableEnhancements = false;
            }
        }
        
        /**
         * Hook into existing UIManager methods to add enhanced functionality
         */
        hookUIManagerMethods() {
            // Store original methods
            const originalRegisterWidget = this.uiManager.registerWidget.bind(this.uiManager);
            const originalMakeDraggable = this.uiManager.makeDraggable.bind(this.uiManager);
            const originalBringToFront = this.uiManager.bringToFront.bind(this.uiManager);
            
            // Override registerWidget to also register with EnhancedWidgetManager
            this.uiManager.registerWidget = (widgetElement, name) => {
                // Call original method
                originalRegisterWidget(widgetElement, name);
                
                // Add enhanced features if available
                if (this.config.enableEnhancements && this.enhancedManager) {
                    try {
                        // Register with EnhancedWidgetManager
                        const widgetId = this.enhancedManager.registerWidget({
                            id: name,
                            element: widgetElement,
                            options: {
                                resizable: true,
                                draggable: true,
                                animations: true,
                                minSize: { width: 200, height: 150 },
                                defaultPosition: this.getWidgetPosition(widgetElement)
                            }
                        });
                        
                        // Store mapping
                        this.widgetMap.set(name, widgetId);
                        
                        // Add resize handles if not present
                        if (!widgetElement.querySelector('.resize-handle')) {
                            this.addResizeHandles(widgetElement);
                        }
                        
                        if (this.config.debugMode) {
                            console.log(`[WidgetIntegration] Enhanced widget registered: ${name} -> ${widgetId}`);
                        }
                        
                    } catch (error) {
                        console.error(`[WidgetIntegration] Failed to enhance widget ${name}:`, error);
                    }
                }
            };
            
            // Override makeDraggable to use enhanced drag manager if available
            this.uiManager.makeDraggable = (dragHandle, elementToDrag, saveKey) => {
                if (this.config.enableEnhancements && this.enhancedManager && this.enhancedManager.dragManager) {
                    try {
                        // Find widget ID from element
                        const widgetId = this.findWidgetId(elementToDrag);
                        if (widgetId) {
                            const widget = this.enhancedManager.getWidget(widgetId);
                            if (widget) {
                                // Use enhanced drag manager
                                this.enhancedManager.dragManager.attachToWidget(widget);
                                
                                // Still save position with legacy key for compatibility
                                if (saveKey) {
                                    this.setupPositionSaving(widget, saveKey);
                                }
                                
                                if (this.config.debugMode) {
                                    console.log(`[WidgetIntegration] Enhanced dragging enabled for ${widgetId}`);
                                }
                                return;
                            }
                        }
                    } catch (error) {
                        console.error('[WidgetIntegration] Failed to apply enhanced dragging:', error);
                    }
                }
                
                // Fall back to original method
                originalMakeDraggable(dragHandle, elementToDrag, saveKey);
            };
            
            // Override bringToFront to use enhanced z-index manager
            this.uiManager.bringToFront = (widgetElement) => {
                if (this.config.enableEnhancements && this.enhancedManager) {
                    try {
                        const widgetId = this.findWidgetId(widgetElement);
                        if (widgetId) {
                            this.enhancedManager.bringToFront(widgetId);
                            
                            if (this.config.debugMode) {
                                console.log(`[WidgetIntegration] Enhanced focus for ${widgetId}`);
                            }
                            return;
                        }
                    } catch (error) {
                        console.error('[WidgetIntegration] Failed to apply enhanced focus:', error);
                    }
                }
                
                // Fall back to original method
                originalBringToFront(widgetElement);
            };
            
            // Add new enhanced methods to UIManager
            this.addEnhancedMethods();
        }
        
        /**
         * Add new enhanced methods to UIManager
         */
        addEnhancedMethods() {
            // Add minimize method
            this.uiManager.minimizeWidget = (widgetName) => {
                if (!this.enhancedManager) return;
                
                const widgetId = this.widgetMap.get(widgetName);
                if (widgetId) {
                    this.enhancedManager.minimize(widgetId);
                }
            };
            
            // Add restore method
            this.uiManager.restoreWidget = (widgetName) => {
                if (!this.enhancedManager) return;
                
                const widgetId = this.widgetMap.get(widgetName);
                if (widgetId) {
                    this.enhancedManager.restore(widgetId);
                }
            };
            
            // Add resize method
            this.uiManager.resizeWidget = (widgetName, width, height) => {
                if (!this.enhancedManager || !this.enhancedManager.resizeManager) return;
                
                const widgetId = this.widgetMap.get(widgetName);
                if (widgetId) {
                    const widget = this.enhancedManager.getWidget(widgetId);
                    if (widget) {
                        this.enhancedManager.resizeManager.resizeWidget(widget, width, height);
                    }
                }
            };
            
            // Add theme application method
            this.uiManager.applyThemeToWidgets = (themeName) => {
                if (!this.enhancedManager || !this.enhancedManager.themeManager) return;
                
                this.enhancedManager.themeManager.applyTheme(themeName);
            };
            
            // Add keyboard shortcut registration
            this.uiManager.registerWidgetShortcut = (keys, callback, context = 'widget') => {
                if (!this.enhancedManager || !this.enhancedManager.keyboardManager) return;
                
                this.enhancedManager.keyboardManager.registerShortcut(context, keys, callback);
            };
        }
        
        /**
         * Migrate existing widgets to enhanced system
         */
        migrateExistingWidgets() {
            if (!this.uiManager.widgets || this.uiManager.widgets.size === 0) return;
            
            this.uiManager.widgets.forEach((widgetElement, name) => {
                try {
                    // Skip if already migrated
                    if (this.widgetMap.has(name)) return;
                    
                    // Register with enhanced manager
                    const widgetId = this.enhancedManager.registerWidget({
                        id: name,
                        element: widgetElement,
                        options: {
                            resizable: true,
                            draggable: true,
                            animations: true,
                            minSize: { width: 200, height: 150 },
                            defaultPosition: this.getWidgetPosition(widgetElement)
                        }
                    });
                    
                    // Store mapping
                    this.widgetMap.set(name, widgetId);
                    
                    // Add resize handles
                    this.addResizeHandles(widgetElement);
                    
                    console.log(`[WidgetIntegration] Migrated widget: ${name}`);
                    
                } catch (error) {
                    console.error(`[WidgetIntegration] Failed to migrate widget ${name}:`, error);
                }
            });
        }
        
        /**
         * Set up event listeners for enhanced features
         */
        setupEventListeners() {
            if (!this.enhancedManager || !this.enhancedManager.eventBus) return;
            
            const eventBus = this.enhancedManager.eventBus;
            
            // Listen for widget events
            eventBus.on('widget:focused', (data) => {
                if (this.config.debugMode) {
                    console.log('[WidgetIntegration] Widget focused:', data.widgetId);
                }
            });
            
            eventBus.on('widget:resized', (data) => {
                // Save size to GM storage for persistence
                const { widgetId, dimensions } = data;
                GM_setValue(`widget_size_${widgetId}`, dimensions);
            });
            
            eventBus.on('widget:moved', (data) => {
                // Save position to GM storage for persistence
                const { widgetId, position } = data;
                GM_setValue(`widget_position_${widgetId}`, position);
            });
            
            // Set up ESC key handler
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.enhancedManager) {
                    this.handleEscapeKey();
                }
            });
        }
        
        /**
         * Handle ESC key press with context awareness
         */
        handleEscapeKey() {
            // Priority 1: Close any open modal/dialog
            const modals = document.querySelectorAll('[role="dialog"], .modal, .dialog');
            for (const modal of modals) {
                if (modal.offsetParent !== null) { // Check if visible
                    modal.remove();
                    return;
                }
            }
            
            // Priority 2: Cancel automation if in progress
            if (this.uiManager.automationInProgress && !this.uiManager.automationCancelled) {
                if (this.uiManager.cancelButton) {
                    this.uiManager.cancelButton.click();
                    return;
                }
            }
            
            // Priority 3: Close topmost widget
            if (this.enhancedManager && this.enhancedManager.zIndexManager) {
                const sortedWidgets = this.enhancedManager.zIndexManager.getSortedWidgets();
                if (sortedWidgets && sortedWidgets.length > 0) {
                    this.enhancedManager.close(sortedWidgets[0].id);
                }
            }
        }
        
        /**
         * Add resize handles to a widget element
         */
        addResizeHandles(widgetElement) {
            const handles = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
            
            handles.forEach(handle => {
                const handleElement = document.createElement('div');
                handleElement.className = `resize-handle resize-handle-${handle}`;
                handleElement.style.cssText = this.getResizeHandleStyles(handle);
                widgetElement.appendChild(handleElement);
            });
        }
        
        /**
         * Get styles for resize handles
         */
        getResizeHandleStyles(handle) {
            const baseStyles = `
                position: absolute;
                background: rgba(52, 152, 219, 0.5);
                transition: background 0.2s;
                z-index: 10;
            `;
            
            const handleStyles = {
                'n': 'top: 0; left: 10%; right: 10%; height: 4px; cursor: ns-resize;',
                'ne': 'top: 0; right: 0; width: 8px; height: 8px; cursor: nesw-resize;',
                'e': 'top: 10%; right: 0; bottom: 10%; width: 4px; cursor: ew-resize;',
                'se': 'bottom: 0; right: 0; width: 8px; height: 8px; cursor: nwse-resize;',
                's': 'bottom: 0; left: 10%; right: 10%; height: 4px; cursor: ns-resize;',
                'sw': 'bottom: 0; left: 0; width: 8px; height: 8px; cursor: nesw-resize;',
                'w': 'top: 10%; left: 0; bottom: 10%; width: 4px; cursor: ew-resize;',
                'nw': 'top: 0; left: 0; width: 8px; height: 8px; cursor: nwse-resize;'
            };
            
            return baseStyles + handleStyles[handle];
        }
        
        /**
         * Get current position of a widget element
         */
        getWidgetPosition(widgetElement) {
            const rect = widgetElement.getBoundingClientRect();
            return {
                x: rect.left,
                y: rect.top
            };
        }
        
        /**
         * Find widget ID from element
         */
        findWidgetId(element) {
            // Check data attribute first
            if (element.dataset && element.dataset.widgetId) {
                return element.dataset.widgetId;
            }
            
            // Search through widget map
            for (const [name, id] of this.widgetMap.entries()) {
                const widget = this.enhancedManager.getWidget(id);
                if (widget && widget.element === element) {
                    return id;
                }
            }
            
            return null;
        }
        
        /**
         * Set up position saving for legacy compatibility
         */
        setupPositionSaving(widget, saveKey) {
            if (!this.enhancedManager || !this.enhancedManager.eventBus) return;
            
            this.enhancedManager.eventBus.on('widget:moved', (data) => {
                if (data.widget === widget) {
                    const position = {
                        top: data.position.y,
                        right: window.innerWidth - data.position.x - widget.element.offsetWidth
                    };
                    GM_setValue(`${saveKey}_position`, position);
                }
            });
        }
        
        /**
         * Enable or disable enhancements
         */
        setEnhancementsEnabled(enabled) {
            this.config.enableEnhancements = enabled;
            
            if (enabled && !this.enhancedManager) {
                // Try to initialize again
                this.init();
            }
        }
        
        /**
         * Get integration status
         */
        getStatus() {
            return {
                initialized: this.initialized,
                enhancementsEnabled: this.config.enableEnhancements,
                widgetCount: this.widgetMap.size,
                enhancedManagerAvailable: !!this.enhancedManager
            };
        }
    }
    
    // Export for use in userscripts
    if (typeof window !== 'undefined') {
        window.WidgetManagerIntegration = WidgetManagerIntegration;
    }
    
    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { WidgetManagerIntegration };
    }
})();