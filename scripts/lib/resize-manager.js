// ==UserScript==
// @name         Resize Manager
// @namespace    https://github.com/Stonelukas/stash-userscripts
// @version      1.0.0
// @description  Widget resize management system with handle generation and constraint enforcement
// @author       AutomateStash Team
// ==/UserScript==

(function() {
    'use strict';

    /**
     * ResizeManager - Handles widget resizing functionality
     * Implements REQ-1.1, REQ-1.2, REQ-1.3 from the requirements document
     */
    class ResizeManager {
        constructor(widgetManager) {
            this.widgetManager = widgetManager;
            
            // Resize handle positions: n, ne, e, se, s, sw, w, nw
            this.resizeHandles = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
            
            // Size constraints (REQ-1.2)
            this.minDimensions = { width: 200, height: 150 };
            this.maxDimensions = { width: 0.9, height: 0.9 }; // Percentage of viewport
            
            // Active resize state
            this.activeResize = null;
            this.resizeStartData = null;
            
            // Performance optimization
            this.resizeThrottle = 16; // 60 FPS
            this.lastResizeTime = 0;
            
            // Handle styles
            this.handleSize = {
                corner: 8,
                edge: 4
            };
            
            // Cache for performance
            this.handleElements = new WeakMap();
            this.resizeObservers = new WeakMap();
            
            // Bind event handlers
            this.handleMouseDown = this.handleMouseDown.bind(this);
            this.handleMouseMove = this.handleMouseMove.bind(this);
            this.handleMouseUp = this.handleMouseUp.bind(this);
            this.handleTouchStart = this.handleTouchStart.bind(this);
            this.handleTouchMove = this.handleTouchMove.bind(this);
            this.handleTouchEnd = this.handleTouchEnd.bind(this);
        }
        
        /**
         * Attach resize functionality to a widget
         * @param {Object} widget - Widget object from EnhancedWidgetManager
         */
        attachToWidget(widget) {
            if (!widget || !widget.element) {
                console.error('[ResizeManager] Invalid widget provided');
                return;
            }
            
            try {
                // Ensure widget has proper positioning
                this.ensureWidgetPositioning(widget);
                
                // Create resize handles
                this.createResizeHandles(widget);
                
                // Attach resize listeners
                this.attachResizeListeners(widget);
                
                // Set up ResizeObserver for external size changes
                this.setupResizeObserver(widget);
                
                // Apply initial size if specified
                if (widget.options && widget.options.defaultSize) {
                    this.applySize(widget, widget.options.defaultSize);
                }
                
                console.log(`[ResizeManager] Attached to widget ${widget.id}`);
            } catch (error) {
                console.error(`[ResizeManager] Failed to attach to widget ${widget.id}:`, error);
            }
        }
        
        /**
         * Create resize handles for a widget (REQ-1.1)
         * @param {Object} widget - Widget object
         */
        createResizeHandles(widget) {
            const handleContainer = document.createElement('div');
            handleContainer.className = 'widget-resize-handles';
            handleContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                z-index: 10;
            `;
            
            const handles = {};
            
            this.resizeHandles.forEach(position => {
                const handle = document.createElement('div');
                handle.className = `resize-handle resize-handle-${position}`;
                handle.dataset.resizeHandle = position;
                handle.dataset.widgetId = widget.id;
                
                // Apply handle-specific styles
                const styles = this.getHandleStyles(position);
                handle.style.cssText = styles;
                
                handleContainer.appendChild(handle);
                handles[position] = handle;
            });
            
            // Add to widget element
            widget.element.appendChild(handleContainer);
            
            // Store handles reference
            this.handleElements.set(widget.element, handles);
            
            // Add hover effects
            this.addHandleHoverEffects(handleContainer);
        }
        
        /**
         * Get styles for a specific handle position
         * @param {string} position - Handle position
         * @returns {string} CSS style string
         */
        getHandleStyles(position) {
            const cornerSize = this.handleSize.corner;
            const edgeSize = this.handleSize.edge;
            
            const baseStyles = `
                position: absolute;
                background: rgba(100, 150, 255, 0.3);
                border: 1px solid rgba(100, 150, 255, 0.8);
                pointer-events: auto;
                transition: background 0.2s, opacity 0.2s;
                opacity: 0;
            `;
            
            const positionStyles = {
                n: `
                    top: -${edgeSize}px;
                    left: ${cornerSize}px;
                    right: ${cornerSize}px;
                    height: ${edgeSize * 2}px;
                    cursor: ns-resize;
                `,
                ne: `
                    top: -${cornerSize}px;
                    right: -${cornerSize}px;
                    width: ${cornerSize * 2}px;
                    height: ${cornerSize * 2}px;
                    cursor: nesw-resize;
                    border-radius: 0 4px 0 0;
                `,
                e: `
                    top: ${cornerSize}px;
                    right: -${edgeSize}px;
                    bottom: ${cornerSize}px;
                    width: ${edgeSize * 2}px;
                    cursor: ew-resize;
                `,
                se: `
                    bottom: -${cornerSize}px;
                    right: -${cornerSize}px;
                    width: ${cornerSize * 2}px;
                    height: ${cornerSize * 2}px;
                    cursor: nwse-resize;
                    border-radius: 0 0 4px 0;
                `,
                s: `
                    bottom: -${edgeSize}px;
                    left: ${cornerSize}px;
                    right: ${cornerSize}px;
                    height: ${edgeSize * 2}px;
                    cursor: ns-resize;
                `,
                sw: `
                    bottom: -${cornerSize}px;
                    left: -${cornerSize}px;
                    width: ${cornerSize * 2}px;
                    height: ${cornerSize * 2}px;
                    cursor: nesw-resize;
                    border-radius: 0 0 0 4px;
                `,
                w: `
                    top: ${cornerSize}px;
                    left: -${edgeSize}px;
                    bottom: ${cornerSize}px;
                    width: ${edgeSize * 2}px;
                    cursor: ew-resize;
                `,
                nw: `
                    top: -${cornerSize}px;
                    left: -${cornerSize}px;
                    width: ${cornerSize * 2}px;
                    height: ${cornerSize * 2}px;
                    cursor: nwse-resize;
                    border-radius: 4px 0 0 0;
                `
            };
            
            return baseStyles + positionStyles[position];
        }
        
        /**
         * Add hover effects to resize handles
         * @param {HTMLElement} handleContainer - Container element for handles
         */
        addHandleHoverEffects(handleContainer) {
            // Show handles on widget hover
            const widget = handleContainer.parentElement;
            
            widget.addEventListener('mouseenter', () => {
                handleContainer.querySelectorAll('.resize-handle').forEach(handle => {
                    handle.style.opacity = '0.5';
                });
            });
            
            widget.addEventListener('mouseleave', () => {
                if (!this.activeResize) {
                    handleContainer.querySelectorAll('.resize-handle').forEach(handle => {
                        handle.style.opacity = '0';
                    });
                }
            });
            
            // Enhance visibility on handle hover
            handleContainer.querySelectorAll('.resize-handle').forEach(handle => {
                handle.addEventListener('mouseenter', () => {
                    handle.style.background = 'rgba(100, 150, 255, 0.5)';
                    handle.style.opacity = '1';
                });
                
                handle.addEventListener('mouseleave', () => {
                    if (!this.activeResize) {
                        handle.style.background = 'rgba(100, 150, 255, 0.3)';
                        handle.style.opacity = '0.5';
                    }
                });
            });
        }
        
        /**
         * Attach resize event listeners to widget
         * @param {Object} widget - Widget object
         */
        attachResizeListeners(widget) {
            const handles = this.handleElements.get(widget.element);
            if (!handles) return;
            
            Object.values(handles).forEach(handle => {
                // Mouse events
                handle.addEventListener('mousedown', this.handleMouseDown);
                
                // Touch events for mobile support
                handle.addEventListener('touchstart', this.handleTouchStart, { passive: false });
            });
        }
        
        /**
         * Handle mouse down on resize handle
         * @param {MouseEvent} event - Mouse event
         */
        handleMouseDown(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const handle = event.target;
            const position = handle.dataset.resizeHandle;
            const widgetId = handle.dataset.widgetId;
            const widget = this.widgetManager.widgets.get(widgetId);
            
            if (!widget) return;
            
            this.startResize(widget, position, event.clientX, event.clientY);
            
            // Add document-level listeners
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
            
            // Prevent text selection during resize
            document.body.style.userSelect = 'none';
        }
        
        /**
         * Handle mouse move during resize
         * @param {MouseEvent} event - Mouse event
         */
        handleMouseMove(event) {
            if (!this.activeResize) return;
            
            // Throttle for performance
            const now = Date.now();
            if (now - this.lastResizeTime < this.resizeThrottle) return;
            this.lastResizeTime = now;
            
            const deltaX = event.clientX - this.resizeStartData.startX;
            const deltaY = event.clientY - this.resizeStartData.startY;
            
            this.performResize(deltaX, deltaY);
        }
        
        /**
         * Handle mouse up to end resize
         * @param {MouseEvent} event - Mouse event
         */
        handleMouseUp(event) {
            if (!this.activeResize) return;
            
            this.endResize();
            
            // Remove document-level listeners
            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('mouseup', this.handleMouseUp);
            
            // Restore text selection
            document.body.style.userSelect = '';
        }
        
        /**
         * Handle touch start on resize handle
         * @param {TouchEvent} event - Touch event
         */
        handleTouchStart(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const touch = event.touches[0];
            const handle = event.target;
            const position = handle.dataset.resizeHandle;
            const widgetId = handle.dataset.widgetId;
            const widget = this.widgetManager.widgets.get(widgetId);
            
            if (!widget) return;
            
            this.startResize(widget, position, touch.clientX, touch.clientY);
            
            // Add document-level listeners
            document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            document.addEventListener('touchend', this.handleTouchEnd);
        }
        
        /**
         * Handle touch move during resize
         * @param {TouchEvent} event - Touch event
         */
        handleTouchMove(event) {
            if (!this.activeResize) return;
            
            event.preventDefault();
            const touch = event.touches[0];
            
            // Throttle for performance
            const now = Date.now();
            if (now - this.lastResizeTime < this.resizeThrottle) return;
            this.lastResizeTime = now;
            
            const deltaX = touch.clientX - this.resizeStartData.startX;
            const deltaY = touch.clientY - this.resizeStartData.startY;
            
            this.performResize(deltaX, deltaY);
        }
        
        /**
         * Handle touch end to end resize
         * @param {TouchEvent} event - Touch event
         */
        handleTouchEnd(event) {
            if (!this.activeResize) return;
            
            this.endResize();
            
            // Remove document-level listeners
            document.removeEventListener('touchmove', this.handleTouchMove);
            document.removeEventListener('touchend', this.handleTouchEnd);
        }
        
        /**
         * Start resize operation
         * @param {Object} widget - Widget being resized
         * @param {string} position - Handle position
         * @param {number} startX - Starting X coordinate
         * @param {number} startY - Starting Y coordinate
         */
        startResize(widget, position, startX, startY) {
            const rect = widget.element.getBoundingClientRect();
            
            this.activeResize = widget;
            this.resizeStartData = {
                position: position,
                startX: startX,
                startY: startY,
                originalWidth: rect.width,
                originalHeight: rect.height,
                originalLeft: rect.left,
                originalTop: rect.top
            };
            
            // Update widget state
            widget.state.isResizing = true;
            
            // Add resizing class for visual feedback
            widget.element.classList.add('widget-resizing');
            
            // Emit resize start event
            if (this.widgetManager.eventBus) {
                this.widgetManager.eventBus.emit('widget:resize:start', {
                    widget: widget,
                    position: position
                });
            }
        }
        
        /**
         * Perform resize based on mouse/touch movement (REQ-1.2)
         * @param {number} deltaX - Change in X coordinate
         * @param {number} deltaY - Change in Y coordinate
         */
        performResize(deltaX, deltaY) {
            if (!this.activeResize || !this.resizeStartData) return;
            
            const widget = this.activeResize;
            const data = this.resizeStartData;
            const position = data.position;
            
            let newWidth = data.originalWidth;
            let newHeight = data.originalHeight;
            let newLeft = data.originalLeft;
            let newTop = data.originalTop;
            
            // Calculate new dimensions based on handle position
            switch (position) {
                case 'n':
                    newHeight = data.originalHeight - deltaY;
                    newTop = data.originalTop + deltaY;
                    break;
                case 'ne':
                    newWidth = data.originalWidth + deltaX;
                    newHeight = data.originalHeight - deltaY;
                    newTop = data.originalTop + deltaY;
                    break;
                case 'e':
                    newWidth = data.originalWidth + deltaX;
                    break;
                case 'se':
                    newWidth = data.originalWidth + deltaX;
                    newHeight = data.originalHeight + deltaY;
                    break;
                case 's':
                    newHeight = data.originalHeight + deltaY;
                    break;
                case 'sw':
                    newWidth = data.originalWidth - deltaX;
                    newHeight = data.originalHeight + deltaY;
                    newLeft = data.originalLeft + deltaX;
                    break;
                case 'w':
                    newWidth = data.originalWidth - deltaX;
                    newLeft = data.originalLeft + deltaX;
                    break;
                case 'nw':
                    newWidth = data.originalWidth - deltaX;
                    newHeight = data.originalHeight - deltaY;
                    newLeft = data.originalLeft + deltaX;
                    newTop = data.originalTop + deltaY;
                    break;
            }
            
            // Apply constraints
            const constrained = this.applyConstraints(newWidth, newHeight, widget);
            newWidth = constrained.width;
            newHeight = constrained.height;
            
            // Adjust position if size was constrained (for handles that affect position)
            if (position.includes('w') && newWidth !== data.originalWidth - deltaX) {
                newLeft = data.originalLeft + data.originalWidth - newWidth;
            }
            if (position.includes('n') && newHeight !== data.originalHeight - deltaY) {
                newTop = data.originalTop + data.originalHeight - newHeight;
            }
            
            // Apply new dimensions and position
            widget.element.style.width = `${newWidth}px`;
            widget.element.style.height = `${newHeight}px`;
            
            // Update position if it changed
            if (position.includes('n') || position.includes('w')) {
                widget.element.style.left = `${newLeft}px`;
                widget.element.style.top = `${newTop}px`;
            }
            
            // Update widget state
            widget.state.dimensions = { width: newWidth, height: newHeight };
            if (position.includes('n') || position.includes('w')) {
                widget.state.position = { x: newLeft, y: newTop };
            }
            
            // Emit resize event
            if (this.widgetManager.eventBus) {
                this.widgetManager.eventBus.emit('widget:resize', {
                    widget: widget,
                    dimensions: { width: newWidth, height: newHeight }
                });
            }
        }
        
        /**
         * Apply size constraints (REQ-1.2)
         * @param {number} width - Requested width
         * @param {number} height - Requested height
         * @param {Object} widget - Widget object
         * @returns {Object} Constrained dimensions
         */
        applyConstraints(width, height, widget) {
            // Get viewport dimensions for max size calculation
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };
            
            // Get min/max dimensions
            const minWidth = widget.options?.minSize?.width || this.minDimensions.width;
            const minHeight = widget.options?.minSize?.height || this.minDimensions.height;
            
            const maxWidth = widget.options?.maxSize?.width || 
                           (viewport.width * this.maxDimensions.width);
            const maxHeight = widget.options?.maxSize?.height || 
                            (viewport.height * this.maxDimensions.height);
            
            // Apply constraints
            width = Math.max(minWidth, Math.min(width, maxWidth));
            height = Math.max(minHeight, Math.min(height, maxHeight));
            
            return { width, height };
        }
        
        /**
         * End resize operation
         */
        endResize() {
            if (!this.activeResize) return;
            
            const widget = this.activeResize;
            
            // Update widget state
            widget.state.isResizing = false;
            
            // Remove resizing class
            widget.element.classList.remove('widget-resizing');
            
            // Persist size (REQ-1.3)
            if (this.widgetManager.config.persistState && this.widgetManager.stateManager) {
                this.widgetManager.stateManager.saveState(widget.id, widget.state);
            }
            
            // Emit resize end event
            if (this.widgetManager.eventBus) {
                this.widgetManager.eventBus.emit('widget:resize:end', {
                    widget: widget,
                    dimensions: widget.state.dimensions
                });
            }
            
            // Update metrics
            if (this.widgetManager.performanceMetrics) {
                this.widgetManager.performanceMetrics.resizeOperations++;
            }
            
            // Clear active resize
            this.activeResize = null;
            this.resizeStartData = null;
        }
        
        /**
         * Ensure widget has proper positioning for resize
         * @param {Object} widget - Widget object
         */
        ensureWidgetPositioning(widget) {
            const element = widget.element;
            const computedStyle = window.getComputedStyle(element);
            
            // Ensure position is not static
            if (computedStyle.position === 'static') {
                element.style.position = 'absolute';
            }
            
            // Ensure widget has explicit dimensions if not already set
            if (!element.style.width) {
                element.style.width = `${element.offsetWidth}px`;
            }
            if (!element.style.height) {
                element.style.height = `${element.offsetHeight}px`;
            }
        }
        
        /**
         * Set up ResizeObserver for external size changes
         * @param {Object} widget - Widget object
         */
        setupResizeObserver(widget) {
            if (!window.ResizeObserver) {
                console.warn('[ResizeManager] ResizeObserver not supported');
                return;
            }
            
            const observer = new ResizeObserver(entries => {
                for (const entry of entries) {
                    if (entry.target === widget.element && !widget.state.isResizing) {
                        // External resize detected, update state
                        const { width, height } = entry.contentRect;
                        widget.state.dimensions = { width, height };
                        
                        // Emit external resize event
                        if (this.widgetManager.eventBus) {
                            this.widgetManager.eventBus.emit('widget:resize:external', {
                                widget: widget,
                                dimensions: { width, height }
                            });
                        }
                    }
                }
            });
            
            observer.observe(widget.element);
            this.resizeObservers.set(widget.element, observer);
        }
        
        /**
         * Apply size to a widget
         * @param {Object} widget - Widget object
         * @param {Object} size - Size object with width and height
         */
        applySize(widget, size) {
            if (!widget || !size) return;
            
            const constrained = this.applyConstraints(size.width, size.height, widget);
            
            widget.element.style.width = `${constrained.width}px`;
            widget.element.style.height = `${constrained.height}px`;
            
            widget.state.dimensions = constrained;
        }
        
        /**
         * Remove resize functionality from a widget
         * @param {Object} widget - Widget object
         */
        detachFromWidget(widget) {
            if (!widget || !widget.element) return;
            
            // Remove resize handles
            const handleContainer = widget.element.querySelector('.widget-resize-handles');
            if (handleContainer) {
                handleContainer.remove();
            }
            
            // Clear cached handles
            this.handleElements.delete(widget.element);
            
            // Disconnect ResizeObserver
            const observer = this.resizeObservers.get(widget.element);
            if (observer) {
                observer.disconnect();
                this.resizeObservers.delete(widget.element);
            }
            
            console.log(`[ResizeManager] Detached from widget ${widget.id}`);
        }
        
        /**
         * Update constraints for all widgets
         * @param {Object} newConstraints - New constraint values
         */
        updateConstraints(newConstraints) {
            if (newConstraints.minDimensions) {
                this.minDimensions = { ...this.minDimensions, ...newConstraints.minDimensions };
            }
            if (newConstraints.maxDimensions) {
                this.maxDimensions = { ...this.maxDimensions, ...newConstraints.maxDimensions };
            }
            
            console.log('[ResizeManager] Constraints updated:', {
                min: this.minDimensions,
                max: this.maxDimensions
            });
        }
        
        /**
         * Get current resize state
         * @returns {Object} Current resize state
         */
        getState() {
            return {
                isResizing: !!this.activeResize,
                activeWidget: this.activeResize?.id || null,
                handlePosition: this.resizeStartData?.position || null
            };
        }
    }
    
    // Export for use in other modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ResizeManager;
    } else {
        window.ResizeManager = ResizeManager;
    }
})();