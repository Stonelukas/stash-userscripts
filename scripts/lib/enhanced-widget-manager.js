// ==UserScript==
// @name         Enhanced Widget Manager
// @namespace    https://github.com/Stonelukas/stash-userscripts
// @version      1.0.0
// @description  Enhanced widget management system with resize, drag, theme, and focus capabilities
// @author       AutomateStash Team
// ==/UserScript==

(function() {
    'use strict';

    /**
     * Custom error classes for widget management
     */
    class WidgetError extends Error {
        constructor(message, code = 'WIDGET_ERROR', details = {}) {
            super(message);
            this.name = 'WidgetError';
            this.code = code;
            this.details = details;
            this.timestamp = Date.now();
        }
    }
    
    class WidgetValidationError extends WidgetError {
        constructor(message, details = {}) {
            super(message, 'VALIDATION_ERROR', details);
            this.name = 'WidgetValidationError';
        }
    }
    
    class WidgetNotFoundError extends WidgetError {
        constructor(widgetId) {
            super(`Widget not found: ${widgetId}`, 'NOT_FOUND', { widgetId });
            this.name = 'WidgetNotFoundError';
        }
    }
    
    /**
     * Widget validator utility class
     */
    class WidgetValidator {
        static validateElement(element) {
            if (!element) {
                throw new WidgetValidationError('Widget element is required');
            }
            if (!(element instanceof HTMLElement)) {
                throw new WidgetValidationError('Widget element must be an HTMLElement');
            }
            return true;
        }
        
        static validateOptions(options) {
            const errors = [];
            
            // Validate minSize
            if (options.minSize) {
                if (typeof options.minSize.width !== 'number' || options.minSize.width < 50) {
                    errors.push('minSize.width must be a number >= 50');
                }
                if (typeof options.minSize.height !== 'number' || options.minSize.height < 50) {
                    errors.push('minSize.height must be a number >= 50');
                }
            }
            
            // Validate maxSize
            if (options.maxSize) {
                if (typeof options.maxSize.width !== 'number' || options.maxSize.width < 100) {
                    errors.push('maxSize.width must be a number >= 100');
                }
                if (typeof options.maxSize.height !== 'number' || options.maxSize.height < 100) {
                    errors.push('maxSize.height must be a number >= 100');
                }
            }
            
            // Validate position
            if (options.defaultPosition && typeof options.defaultPosition === 'object') {
                if (typeof options.defaultPosition.x !== 'number') {
                    errors.push('defaultPosition.x must be a number');
                }
                if (typeof options.defaultPosition.y !== 'number') {
                    errors.push('defaultPosition.y must be a number');
                }
            }
            
            if (errors.length > 0) {
                throw new WidgetValidationError('Invalid widget options', { errors });
            }
            
            return true;
        }
        
        static validateWidgetId(widgetId) {
            if (!widgetId || typeof widgetId !== 'string') {
                throw new WidgetValidationError('Widget ID must be a non-empty string');
            }
            if (widgetId.length > 100) {
                throw new WidgetValidationError('Widget ID must be less than 100 characters');
            }
            return true;
        }
        
        static validateDimensions(width, height, minSize, maxSize) {
            const errors = [];
            
            if (width < minSize.width) {
                errors.push(`Width ${width} is less than minimum ${minSize.width}`);
            }
            if (height < minSize.height) {
                errors.push(`Height ${height} is less than minimum ${minSize.height}`);
            }
            if (maxSize) {
                if (width > maxSize.width) {
                    errors.push(`Width ${width} exceeds maximum ${maxSize.width}`);
                }
                if (height > maxSize.height) {
                    errors.push(`Height ${height} exceeds maximum ${maxSize.height}`);
                }
            }
            
            if (errors.length > 0) {
                throw new WidgetValidationError('Invalid dimensions', { errors, width, height });
            }
            
            return true;
        }
    }

    /**
     * EnhancedWidgetManager - Core widget management system
     * Implements comprehensive widget lifecycle, registration, and coordination
     */
    class EnhancedWidgetManager {
        constructor() {
            // Widget registry
            this.widgets = new Map();
            this.widgetIdCounter = 0;
            
            // Sub-managers for specific functionality
            this.zIndexManager = null;
            this.resizeManager = null;
            this.dragManager = null;
            this.focusManager = null;
            this.stateManager = null;
            this.themeManager = null;
            this.keyboardManager = null;
            this.animationManager = null;
            this.eventBus = null;
            
            // Configuration
            this.config = {
                enableResize: true,
                enableDrag: true,
                enableTheme: true,
                enableKeyboard: true,
                enableAnimations: true,
                enableFocus: true,
                defaultPosition: 'center',
                defaultSize: { width: 400, height: 300 },
                minSize: { width: 200, height: 150 },
                maxSizeRatio: { width: 0.9, height: 0.9 }, // 90% of viewport
                persistState: true,
                animationSpeed: 300,
                focusIndicatorStyle: 'shadow', // 'shadow', 'border', 'opacity'
                theme: 'dark'
            };
            
            // Widget state tracking
            this.activeWidget = null;
            this.initialized = false;
            
            // Performance monitoring
            this.performanceMetrics = {
                widgetCount: 0,
                resizeOperations: 0,
                dragOperations: 0,
                focusChanges: 0,
                lastUpdate: Date.now()
            };
            
            // Initialize the manager
            this.init();
        }
        
        /**
         * Initialize the widget manager and all sub-managers
         */
        async init() {
            if (this.initialized) {
                console.warn('[EnhancedWidgetManager] Already initialized');
                return;
            }
            
            try {
                // Initialize event bus first for inter-component communication
                this.eventBus = new WidgetEventBus();
                
                // Initialize sub-managers
                this.zIndexManager = new ZIndexManager(this);
                this.resizeManager = new ResizeManager(this);
                this.dragManager = new DragManager(this);
                this.focusManager = new FocusManager(this);
                this.stateManager = new WidgetStateManager(this);
                this.themeManager = new ThemeApplicationManager(this);
                this.keyboardManager = new KeyboardManager(this);
                this.animationManager = new AnimationAnchorManager(this);
                
                // Load saved configuration
                await this.loadConfiguration();
                
                // Set up global event listeners
                this.setupGlobalListeners();
                
                // Apply initial theme
                if (this.config.enableTheme) {
                    await this.themeManager.applyTheme(this.config.theme);
                }
                
                // Register keyboard shortcuts
                if (this.config.enableKeyboard) {
                    this.registerDefaultShortcuts();
                }
                
                this.initialized = true;
                this.eventBus.emit('manager:initialized', { manager: this });
                
                console.log('[EnhancedWidgetManager] Initialization complete');
            } catch (error) {
                console.error('[EnhancedWidgetManager] Initialization failed:', error);
                this.handleInitializationError(error);
            }
        }
        
        /**
         * Register a widget with the enhanced system
         * @param {Object} options - Widget registration options
         * @returns {string} Widget ID
         * @throws {WidgetValidationError} If validation fails
         */
        registerWidget(options) {
            try {
                // Validate element
                WidgetValidator.validateElement(options?.element);
                
                // Generate unique widget ID
                const widgetId = options.id || `widget-${++this.widgetIdCounter}`;
                
                // Validate widget ID
                WidgetValidator.validateWidgetId(widgetId);
                
                // Check for duplicate registration
                if (this.widgets.has(widgetId)) {
                    throw new WidgetValidationError(`Widget with ID ${widgetId} already registered`);
                }
                
                // Validate and sanitize options
                const validatedOptions = this.validateWidgetOptions(options);
                WidgetValidator.validateOptions(validatedOptions);
                
                // Create widget wrapper
                const widget = {
                id: widgetId,
                element: options.element,
                options: validatedOptions,
                state: {
                    position: null,
                    dimensions: null,
                    zIndex: null,
                    isMinimized: false,
                    isVisible: true,
                    isFocused: false,
                    isDragging: false,
                    isResizing: false
                },
                metadata: {
                    createdAt: Date.now(),
                    lastModified: Date.now(),
                    interactionCount: 0
                }
            };
            
            // Store widget
            this.widgets.set(widgetId, widget);
            
            // Initialize widget with sub-managers
            this.initializeWidget(widget);
            
            // Load saved state if available
            if (this.config.persistState) {
                this.stateManager.loadState(widgetId);
            }
            
            // Apply theme
            if (this.config.enableTheme) {
                this.themeManager.applyToWidget(widget);
            }
            
                // Update metrics
                this.performanceMetrics.widgetCount++;
                
                // Emit registration event
                this.eventBus.emit('widget:registered', { widgetId, widget });
                
                console.log(`[EnhancedWidgetManager] Widget registered: ${widgetId}`);
                return widgetId;
            } catch (error) {
                console.error('[EnhancedWidgetManager] Registration failed:', error);
                this.eventBus?.emit('widget:error', { 
                    action: 'register', 
                    error,
                    options 
                });
                throw error;
            }
        }
        
        /**
         * Unregister a widget from the system
         * @param {string} widgetId - Widget ID to unregister
         */
        unregisterWidget(widgetId) {
            const widget = this.widgets.get(widgetId);
            if (!widget) {
                console.warn(`[EnhancedWidgetManager] Widget not found: ${widgetId}`);
                return;
            }
            
            // Clean up sub-manager attachments
            if (this.config.enableResize) {
                this.resizeManager.detachFromWidget(widget);
            }
            if (this.config.enableDrag) {
                this.dragManager.detachFromWidget(widget);
            }
            
            // Save final state
            if (this.config.persistState) {
                this.stateManager.saveState(widgetId, widget.state);
            }
            
            // Remove from z-index management
            this.zIndexManager.removeWidget(widget);
            
            // Remove from registry
            this.widgets.delete(widgetId);
            
            // Update metrics
            this.performanceMetrics.widgetCount--;
            
            // Emit unregistration event
            this.eventBus.emit('widget:unregistered', { widgetId });
            
            console.log(`[EnhancedWidgetManager] Widget unregistered: ${widgetId}`);
        }
        
        /**
         * Get a widget by ID
         * @param {string} widgetId - Widget ID
         * @returns {Object|null} Widget object or null
         */
        getWidget(widgetId) {
            return this.widgets.get(widgetId) || null;
        }
        
        /**
         * Get all registered widgets
         * @returns {Array} Array of widget objects
         */
        getAllWidgets() {
            return Array.from(this.widgets.values());
        }
        
        /**
         * Bring a widget to the front (highest z-index)
         * @param {string} widgetId - Widget ID
         * @throws {WidgetNotFoundError} If widget doesn't exist
         */
        bringToFront(widgetId) {
            try {
                WidgetValidator.validateWidgetId(widgetId);
                
                const widget = this.widgets.get(widgetId);
                if (!widget) {
                    throw new WidgetNotFoundError(widgetId);
                }
                
                // Ensure managers are initialized
                if (!this.zIndexManager || !this.focusManager) {
                    throw new WidgetError('Widget managers not initialized', 'NOT_INITIALIZED');
                }
                
                this.zIndexManager.bringToFront(widget);
                this.focusManager.setFocus(widget);
                this.activeWidget = widget;
                
                // Update interaction count
                widget.metadata.interactionCount++;
                widget.metadata.lastModified = Date.now();
                
                // Track focus change
                this.performanceMetrics.focusChanges++;
                
                this.eventBus.emit('widget:focused', { widgetId, widget });
            } catch (error) {
                console.error('[EnhancedWidgetManager] Failed to bring widget to front:', error);
                this.eventBus?.emit('widget:error', {
                    action: 'bringToFront',
                    widgetId,
                    error
                });
                throw error;
            }
        }
        
        /**
         * Minimize a widget
         * @param {string} widgetId - Widget ID
         */
        minimize(widgetId) {
            const widget = this.widgets.get(widgetId);
            if (!widget) return;
            
            if (widget.state.isMinimized) return;
            
            // Animate minimization if enabled
            if (this.config.enableAnimations) {
                this.animationManager.animateMinimize(widget);
            }
            
            widget.state.isMinimized = true;
            widget.element.style.display = 'none';
            
            // Save state
            if (this.config.persistState) {
                this.stateManager.saveState(widgetId, widget.state);
            }
            
            this.eventBus.emit('widget:minimized', { widgetId, widget });
        }
        
        /**
         * Restore a minimized widget
         * @param {string} widgetId - Widget ID
         */
        restore(widgetId) {
            const widget = this.widgets.get(widgetId);
            if (!widget) return;
            
            if (!widget.state.isMinimized) return;
            
            widget.state.isMinimized = false;
            widget.element.style.display = '';
            
            // Animate restoration if enabled
            if (this.config.enableAnimations) {
                this.animationManager.animateRestore(widget);
            }
            
            // Bring to front on restore
            this.bringToFront(widgetId);
            
            // Save state
            if (this.config.persistState) {
                this.stateManager.saveState(widgetId, widget.state);
            }
            
            this.eventBus.emit('widget:restored', { widgetId, widget });
        }
        
        /**
         * Close/destroy a widget
         * @param {string} widgetId - Widget ID
         */
        close(widgetId) {
            const widget = this.widgets.get(widgetId);
            if (!widget) return;
            
            // Animate closure if enabled
            if (this.config.enableAnimations) {
                this.animationManager.animateClose(widget, () => {
                    this.destroyWidget(widgetId);
                });
            } else {
                this.destroyWidget(widgetId);
            }
        }
        
        /**
         * Update widget configuration
         * @param {Object} newConfig - New configuration options
         */
        updateConfiguration(newConfig) {
            this.config = { ...this.config, ...newConfig };
            
            // Apply configuration changes to existing widgets
            this.widgets.forEach((widget, widgetId) => {
                this.applyConfigurationToWidget(widget);
            });
            
            // Save configuration
            this.saveConfiguration();
            
            this.eventBus.emit('configuration:updated', { config: this.config });
        }
        
        /**
         * Get current configuration
         * @returns {Object} Current configuration
         */
        getConfiguration() {
            return { ...this.config };
        }
        
        /**
         * Get performance metrics
         * @returns {Object} Performance metrics
         */
        getPerformanceMetrics() {
            return {
                ...this.performanceMetrics,
                uptime: Date.now() - this.performanceMetrics.lastUpdate
            };
        }
        
        // ===== PRIVATE METHODS =====
        
        /**
         * Initialize a widget with sub-managers
         * @private
         */
        initializeWidget(widget) {
            // Attach resize functionality
            if (this.config.enableResize && widget.options.resizable !== false) {
                this.resizeManager.attachToWidget(widget);
            }
            
            // Attach drag functionality
            if (this.config.enableDrag && widget.options.draggable !== false) {
                this.dragManager.attachToWidget(widget);
            }
            
            // Set up focus handling
            if (this.config.enableFocus) {
                this.focusManager.attachToWidget(widget);
            }
            
            // Initialize z-index
            this.zIndexManager.addWidget(widget);
            
            // Set initial position and size
            this.setInitialPosition(widget);
            this.setInitialSize(widget);
            
            // Add widget class for styling
            widget.element.classList.add('enhanced-widget');
            widget.element.dataset.widgetId = widget.id;
        }
        
        /**
         * Set initial position for a widget
         * @private
         */
        setInitialPosition(widget) {
            const position = widget.options.defaultPosition || this.config.defaultPosition;
            
            if (position === 'center') {
                const viewport = {
                    width: window.innerWidth,
                    height: window.innerHeight
                };
                const rect = widget.element.getBoundingClientRect();
                
                widget.state.position = {
                    x: (viewport.width - rect.width) / 2,
                    y: (viewport.height - rect.height) / 2
                };
            } else if (typeof position === 'object') {
                widget.state.position = { ...position };
            } else {
                widget.state.position = { x: 50, y: 50 };
            }
            
            // Apply position
            widget.element.style.position = 'fixed';
            widget.element.style.left = `${widget.state.position.x}px`;
            widget.element.style.top = `${widget.state.position.y}px`;
        }
        
        /**
         * Set initial size for a widget
         * @private
         */
        setInitialSize(widget) {
            const size = widget.options.defaultSize || this.config.defaultSize;
            const minSize = widget.options.minSize || this.config.minSize;
            
            widget.state.dimensions = {
                width: Math.max(size.width, minSize.width),
                height: Math.max(size.height, minSize.height)
            };
            
            // Apply size
            widget.element.style.width = `${widget.state.dimensions.width}px`;
            widget.element.style.height = `${widget.state.dimensions.height}px`;
        }
        
        /**
         * Validate widget options
         * @private
         */
        validateWidgetOptions(options) {
            const validated = {
                ...options,
                resizable: options.resizable !== false,
                draggable: options.draggable !== false,
                animations: options.animations !== false,
                minSize: options.minSize || this.config.minSize,
                maxSize: options.maxSize || null,
                defaultPosition: options.defaultPosition || this.config.defaultPosition,
                defaultSize: options.defaultSize || this.config.defaultSize
            };
            
            // Validate min/max sizes
            if (validated.minSize.width < 100) validated.minSize.width = 100;
            if (validated.minSize.height < 100) validated.minSize.height = 100;
            
            return validated;
        }
        
        /**
         * Apply configuration to a widget
         * @private
         */
        applyConfigurationToWidget(widget) {
            // Update resize constraints
            if (this.config.enableResize && this.resizeManager) {
                this.resizeManager.updateConstraints(widget, this.config);
            }
            
            // Update drag boundaries
            if (this.config.enableDrag && this.dragManager) {
                this.dragManager.updateBoundaries(widget);
            }
            
            // Update theme
            if (this.config.enableTheme && this.themeManager) {
                this.themeManager.applyToWidget(widget);
            }
        }
        
        /**
         * Destroy a widget completely
         * @private
         */
        destroyWidget(widgetId) {
            const widget = this.widgets.get(widgetId);
            if (!widget) return;
            
            // Remove element from DOM
            widget.element.remove();
            
            // Unregister widget
            this.unregisterWidget(widgetId);
            
            this.eventBus.emit('widget:destroyed', { widgetId });
        }
        
        /**
         * Set up global event listeners
         * @private
         */
        setupGlobalListeners() {
            // Window resize handler
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    this.handleWindowResize();
                }, 250);
            });
            
            // Visibility change handler
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.handlePageHidden();
                } else {
                    this.handlePageVisible();
                }
            });
            
            // Global click handler for focus management
            document.addEventListener('click', (event) => {
                this.handleGlobalClick(event);
            }, true);
        }
        
        /**
         * Handle window resize
         * @private
         */
        handleWindowResize() {
            // Revalidate widget positions and sizes
            this.widgets.forEach((widget) => {
                if (this.dragManager) {
                    this.dragManager.validatePosition(widget);
                }
                if (this.resizeManager) {
                    this.resizeManager.validateSize(widget);
                }
            });
            
            this.eventBus.emit('window:resized', { 
                width: window.innerWidth, 
                height: window.innerHeight 
            });
        }
        
        /**
         * Handle page becoming hidden
         * @private
         */
        handlePageHidden() {
            // Save all widget states
            if (this.config.persistState) {
                this.widgets.forEach((widget, widgetId) => {
                    this.stateManager.saveState(widgetId, widget.state);
                });
            }
        }
        
        /**
         * Handle page becoming visible
         * @private
         */
        handlePageVisible() {
            // Refresh widget states if needed
            this.widgets.forEach((widget) => {
                widget.metadata.lastModified = Date.now();
            });
        }
        
        /**
         * Handle global click for focus management
         * @private
         */
        handleGlobalClick(event) {
            // Check if click is on a widget
            const widgetElement = event.target.closest('.enhanced-widget');
            if (widgetElement) {
                const widgetId = widgetElement.dataset.widgetId;
                if (widgetId) {
                    this.bringToFront(widgetId);
                }
            }
        }
        
        /**
         * Register default keyboard shortcuts
         * @private
         */
        registerDefaultShortcuts() {
            if (!this.keyboardManager) return;
            
            // ESC key handler
            this.keyboardManager.registerShortcut('global', 'Escape', () => {
                this.handleEscapeKey();
            });
            
            // Alt+W to close active widget
            this.keyboardManager.registerShortcut('global', 'Alt+w', () => {
                if (this.activeWidget) {
                    this.close(this.activeWidget.id);
                }
            });
            
            // Alt+M to minimize active widget
            this.keyboardManager.registerShortcut('global', 'Alt+m', () => {
                if (this.activeWidget) {
                    this.minimize(this.activeWidget.id);
                }
            });
        }
        
        /**
         * Handle ESC key press
         * @private
         */
        handleEscapeKey() {
            // Get widgets sorted by z-index (highest first)
            const sortedWidgets = this.zIndexManager.getSortedWidgets();
            
            // Close topmost widget
            if (sortedWidgets.length > 0) {
                this.close(sortedWidgets[0].id);
            }
        }
        
        /**
         * Load configuration from storage
         * @private
         */
        async loadConfiguration() {
            try {
                if (typeof GM_getValue !== 'undefined') {
                    const savedConfig = GM_getValue('enhancedWidgetConfig', null);
                    if (savedConfig) {
                        this.config = { ...this.config, ...JSON.parse(savedConfig) };
                    }
                }
            } catch (error) {
                console.error('[EnhancedWidgetManager] Failed to load configuration:', error);
            }
        }
        
        /**
         * Save configuration to storage
         * @private
         */
        saveConfiguration() {
            try {
                if (typeof GM_setValue !== 'undefined') {
                    GM_setValue('enhancedWidgetConfig', JSON.stringify(this.config));
                }
            } catch (error) {
                console.error('[EnhancedWidgetManager] Failed to save configuration:', error);
            }
        }
        
        /**
         * Handle initialization errors
         * @private
         */
        handleInitializationError(error) {
            console.error('[EnhancedWidgetManager] Critical initialization error:', error);
            
            // Attempt graceful degradation
            this.initialized = false;
            this.config.enableResize = false;
            this.config.enableDrag = false;
            this.config.enableAnimations = false;
            
            // Notify about degraded mode
            if (this.eventBus) {
                this.eventBus.emit('manager:degraded', { error });
            }
        }
    }
    
    // Note: Sub-manager classes are implemented in separate files:
    // - widget-sub-managers.js: WidgetEventBus, ZIndexManager, FocusManager, WidgetStateManager, 
    //                           ThemeApplicationManager, KeyboardManager, AnimationAnchorManager
    // - drag-manager.js: DragManager  
    // - resize-manager.js: ResizeManager (to be implemented)
    // All sub-manager files must be loaded before EnhancedWidgetManager
    
    // Export for use in userscripts
    if (typeof window !== 'undefined') {
        window.EnhancedWidgetManager = EnhancedWidgetManager;
        window.WidgetError = WidgetError;
        window.WidgetValidationError = WidgetValidationError;
        window.WidgetNotFoundError = WidgetNotFoundError;
        window.WidgetValidator = WidgetValidator;
    }
    
    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { 
            EnhancedWidgetManager, 
            WidgetError,
            WidgetValidationError,
            WidgetNotFoundError,
            WidgetValidator
        };
    }
})();