// ==UserScript==
// @name         Drag Manager for Enhanced Widget System
// @namespace    https://github.com/Stonelukas/stash-userscripts
// @version      1.0.0
// @description  Comprehensive drag functionality for widget system with smooth movement and boundary constraints
// @author       AutomateStash Team
// ==/UserScript==

(function() {
    'use strict';

    /**
     * DragManager - Handles widget dragging with smooth performance and boundary constraints
     * Implements pointer capture for smooth dragging and proper event handling
     */
    class DragManager {
        constructor(widgetManager) {
            this.widgetManager = widgetManager;
            
            // Drag state
            this.isDragging = false;
            this.draggedWidget = null;
            this.dragOffset = { x: 0, y: 0 };
            this.dragStartPosition = { x: 0, y: 0 };
            this.lastValidPosition = { x: 0, y: 0 };
            
            // Configuration
            this.config = {
                dragThreshold: 3, // Pixels before drag starts
                boundaryPadding: 50, // Minimum pixels visible
                useCSSTransform: true, // Use transform for performance
                throttleDelay: 0, // No throttling for smooth drag
                snapToGrid: false,
                gridSize: 10,
                constrainToViewport: true,
                animateDrop: true,
                dropAnimationDuration: 200
            };
            
            // Performance tracking
            this.dragMetrics = {
                totalDrags: 0,
                lastDragDuration: 0,
                averageFPS: 60
            };
            
            // Bound event handlers
            this.handlePointerDown = this.handlePointerDown.bind(this);
            this.handlePointerMove = this.handlePointerMove.bind(this);
            this.handlePointerUp = this.handlePointerUp.bind(this);
            this.handleKeyDown = this.handleKeyDown.bind(this);
            this.handleDragStart = this.handleDragStart.bind(this);
            
            // Animation frame tracking
            this.animationFrameId = null;
            this.pendingMove = null;
        }
        
        /**
         * Attach drag functionality to a widget
         * @param {Object} widget - Widget object to make draggable
         */
        attachToWidget(widget) {
            if (!widget || !widget.element) {
                console.error('[DragManager] Invalid widget provided');
                return;
            }
            
            // Find or create drag handle
            const dragHandle = this.findOrCreateDragHandle(widget);
            if (!dragHandle) {
                console.error('[DragManager] Could not create drag handle for widget');
                return;
            }
            
            // Store reference to widget on handle
            dragHandle.dataset.widgetId = widget.id;
            
            // Add drag cursor
            dragHandle.style.cursor = 'move';
            
            // Prevent default drag behavior
            dragHandle.draggable = false;
            dragHandle.addEventListener('dragstart', this.handleDragStart);
            
            // Add pointer events for modern dragging
            dragHandle.addEventListener('pointerdown', this.handlePointerDown);
            
            // Add touch support
            dragHandle.style.touchAction = 'none';
            
            // Store drag handle reference
            widget.dragHandle = dragHandle;
            
            console.log(`[DragManager] Attached to widget: ${widget.id}`);
        }
        
        /**
         * Detach drag functionality from a widget
         * @param {Object} widget - Widget to detach from
         */
        detachFromWidget(widget) {
            if (!widget || !widget.dragHandle) return;
            
            const dragHandle = widget.dragHandle;
            
            // Remove event listeners
            dragHandle.removeEventListener('pointerdown', this.handlePointerDown);
            dragHandle.removeEventListener('dragstart', this.handleDragStart);
            
            // Clean up references
            delete dragHandle.dataset.widgetId;
            delete widget.dragHandle;
            
            // Cancel any ongoing drag
            if (this.draggedWidget === widget) {
                this.cancelDrag();
            }
            
            console.log(`[DragManager] Detached from widget: ${widget.id}`);
        }
        
        /**
         * Find or create a drag handle for the widget
         * @private
         */
        findOrCreateDragHandle(widget) {
            // Look for existing drag handle
            let dragHandle = widget.element.querySelector('.widget-header, .drag-handle, [data-drag-handle]');
            
            // If not found, look for header-like elements
            if (!dragHandle) {
                dragHandle = widget.element.querySelector('h1, h2, h3, h4, .title, .header');
            }
            
            // If still not found, create one
            if (!dragHandle) {
                // Check if widget has a header area we can use
                const firstChild = widget.element.firstElementChild;
                if (firstChild && (firstChild.tagName === 'DIV' || firstChild.tagName === 'HEADER')) {
                    dragHandle = firstChild;
                } else {
                    // Create a drag handle bar
                    dragHandle = document.createElement('div');
                    dragHandle.className = 'widget-drag-handle';
                    dragHandle.style.cssText = `
                        height: 30px;
                        background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(155, 89, 182, 0.1));
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                        display: flex;
                        align-items: center;
                        padding: 0 10px;
                        user-select: none;
                    `;
                    dragHandle.innerHTML = '<span style="font-size: 12px; opacity: 0.7;">Drag to move</span>';
                    widget.element.insertBefore(dragHandle, widget.element.firstChild);
                }
            }
            
            // Mark as drag handle
            dragHandle.classList.add('widget-drag-handle');
            dragHandle.dataset.dragHandle = 'true';
            
            return dragHandle;
        }
        
        /**
         * Handle pointer down event (start of drag)
         * @private
         */
        handlePointerDown(event) {
            // Only handle left click
            if (event.button !== 0) return;
            
            // Get widget from handle
            const widgetId = event.currentTarget.dataset.widgetId;
            const widget = this.widgetManager.getWidget(widgetId);
            if (!widget) return;
            
            // Store initial state
            this.draggedWidget = widget;
            this.dragStartPosition = {
                x: event.clientX,
                y: event.clientY
            };
            
            // Get current widget position
            const rect = widget.element.getBoundingClientRect();
            this.dragOffset = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            
            // Store last valid position
            this.lastValidPosition = {
                x: rect.left,
                y: rect.top
            };
            
            // Set pointer capture for smooth dragging
            event.currentTarget.setPointerCapture(event.pointerId);
            
            // Add document-level event listeners
            document.addEventListener('pointermove', this.handlePointerMove);
            document.addEventListener('pointerup', this.handlePointerUp);
            document.addEventListener('keydown', this.handleKeyDown);
            
            // Prevent text selection during drag
            event.preventDefault();
            document.body.style.userSelect = 'none';
            
            // Mark widget as potential drag target
            widget.element.style.willChange = 'transform';
            
            console.log(`[DragManager] Pointer down on widget: ${widgetId}`);
        }
        
        /**
         * Handle pointer move event (during drag)
         * @private
         */
        handlePointerMove(event) {
            if (!this.draggedWidget) return;
            
            const deltaX = event.clientX - this.dragStartPosition.x;
            const deltaY = event.clientY - this.dragStartPosition.y;
            
            // Check if we've moved enough to start dragging
            if (!this.isDragging) {
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                if (distance < this.config.dragThreshold) {
                    return;
                }
                
                // Start dragging
                this.startDrag();
            }
            
            // Calculate new position
            let newX = event.clientX - this.dragOffset.x;
            let newY = event.clientY - this.dragOffset.y;
            
            // Apply grid snapping if enabled
            if (this.config.snapToGrid) {
                newX = Math.round(newX / this.config.gridSize) * this.config.gridSize;
                newY = Math.round(newY / this.config.gridSize) * this.config.gridSize;
            }
            
            // Apply boundary constraints
            if (this.config.constrainToViewport) {
                const boundaries = this.calculateBoundaries(this.draggedWidget);
                newX = Math.max(boundaries.minX, Math.min(newX, boundaries.maxX));
                newY = Math.max(boundaries.minY, Math.min(newY, boundaries.maxY));
            }
            
            // Store pending move for animation frame
            this.pendingMove = { x: newX, y: newY };
            
            // Use animation frame for smooth movement
            if (!this.animationFrameId) {
                this.animationFrameId = requestAnimationFrame(() => {
                    this.applyMove();
                });
            }
        }
        
        /**
         * Apply the pending move in animation frame
         * @private
         */
        applyMove() {
            if (!this.pendingMove || !this.draggedWidget) {
                this.animationFrameId = null;
                return;
            }
            
            const { x, y } = this.pendingMove;
            
            // Apply position using transform for better performance
            if (this.config.useCSSTransform) {
                // Reset position styles and use transform
                this.draggedWidget.element.style.transform = `translate(${x}px, ${y}px)`;
                
                // Store position in widget state (accounting for transform)
                this.draggedWidget.state.position = { x, y };
            } else {
                // Use traditional left/top positioning
                this.draggedWidget.element.style.left = `${x}px`;
                this.draggedWidget.element.style.top = `${y}px`;
                
                // Store position in widget state
                this.draggedWidget.state.position = { x, y };
            }
            
            // Store last valid position
            this.lastValidPosition = { x, y };
            
            // Emit move event
            if (this.widgetManager.eventBus) {
                this.widgetManager.eventBus.emit('widget:moved', {
                    widgetId: this.draggedWidget.id,
                    widget: this.draggedWidget,
                    position: { x, y }
                });
            }
            
            // Clear pending move
            this.pendingMove = null;
            this.animationFrameId = null;
        }
        
        /**
         * Start the drag operation
         * @private
         */
        startDrag() {
            if (!this.draggedWidget) return;
            
            this.isDragging = true;
            
            // Add dragging class for visual feedback
            this.draggedWidget.element.classList.add('widget-dragging');
            
            // Bring widget to front
            if (this.widgetManager) {
                this.widgetManager.bringToFront(this.draggedWidget.id);
            }
            
            // Update widget state
            this.draggedWidget.state.isDragging = true;
            
            // Track metrics
            this.dragMetrics.totalDrags++;
            this.dragStartTime = performance.now();
            
            // Emit drag start event
            if (this.widgetManager.eventBus) {
                this.widgetManager.eventBus.emit('widget:dragStart', {
                    widgetId: this.draggedWidget.id,
                    widget: this.draggedWidget
                });
            }
            
            console.log(`[DragManager] Started dragging widget: ${this.draggedWidget.id}`);
        }
        
        /**
         * Handle pointer up event (end of drag)
         * @private
         */
        handlePointerUp(event) {
            if (!this.draggedWidget) return;
            
            // Release pointer capture
            if (this.draggedWidget.dragHandle) {
                this.draggedWidget.dragHandle.releasePointerCapture(event.pointerId);
            }
            
            // End drag
            this.endDrag();
        }
        
        /**
         * End the drag operation
         * @private
         */
        endDrag() {
            if (!this.draggedWidget) return;
            
            // Apply any pending move
            if (this.pendingMove) {
                this.applyMove();
            }
            
            // Cancel animation frame if pending
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            
            // Remove dragging class
            this.draggedWidget.element.classList.remove('widget-dragging');
            
            // Animate drop if enabled
            if (this.config.animateDrop && this.isDragging) {
                this.animateDrop(this.draggedWidget);
            }
            
            // Clean up transform if using CSS transform
            if (this.config.useCSSTransform) {
                // Apply final position using left/top
                const finalPosition = this.draggedWidget.state.position || this.lastValidPosition;
                this.draggedWidget.element.style.left = `${finalPosition.x}px`;
                this.draggedWidget.element.style.top = `${finalPosition.y}px`;
                this.draggedWidget.element.style.transform = '';
            }
            
            // Update widget state
            if (this.draggedWidget) {
                this.draggedWidget.state.isDragging = false;
                this.draggedWidget.element.style.willChange = 'auto';
            }
            
            // Save position if state manager exists
            if (this.isDragging && this.widgetManager.stateManager) {
                this.widgetManager.stateManager.saveState(
                    this.draggedWidget.id,
                    this.draggedWidget.state
                );
            }
            
            // Track metrics
            if (this.isDragging) {
                this.dragMetrics.lastDragDuration = performance.now() - this.dragStartTime;
                
                // Emit drag end event
                if (this.widgetManager.eventBus) {
                    this.widgetManager.eventBus.emit('widget:dragEnd', {
                        widgetId: this.draggedWidget.id,
                        widget: this.draggedWidget,
                        duration: this.dragMetrics.lastDragDuration
                    });
                }
                
                console.log(`[DragManager] Ended dragging widget: ${this.draggedWidget.id}`);
            }
            
            // Remove document event listeners
            document.removeEventListener('pointermove', this.handlePointerMove);
            document.removeEventListener('pointerup', this.handlePointerUp);
            document.removeEventListener('keydown', this.handleKeyDown);
            
            // Restore text selection
            document.body.style.userSelect = '';
            
            // Reset state
            this.isDragging = false;
            this.draggedWidget = null;
            this.dragOffset = { x: 0, y: 0 };
            this.pendingMove = null;
        }
        
        /**
         * Handle key down event (ESC to cancel drag)
         * @private
         */
        handleKeyDown(event) {
            if (event.key === 'Escape' && this.isDragging) {
                this.cancelDrag();
            }
        }
        
        /**
         * Cancel the current drag operation
         */
        cancelDrag() {
            if (!this.draggedWidget) return;
            
            console.log(`[DragManager] Canceling drag for widget: ${this.draggedWidget.id}`);
            
            // Restore original position
            if (this.config.useCSSTransform) {
                this.draggedWidget.element.style.transform = `translate(${this.lastValidPosition.x}px, ${this.lastValidPosition.y}px)`;
            } else {
                this.draggedWidget.element.style.left = `${this.lastValidPosition.x}px`;
                this.draggedWidget.element.style.top = `${this.lastValidPosition.y}px`;
            }
            
            // End drag without saving
            this.endDrag();
        }
        
        /**
         * Prevent default drag behavior
         * @private
         */
        handleDragStart(event) {
            event.preventDefault();
            return false;
        }
        
        /**
         * Calculate boundaries for widget movement
         * @private
         */
        calculateBoundaries(widget) {
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };
            
            const widgetRect = widget.element.getBoundingClientRect();
            const padding = this.config.boundaryPadding;
            
            return {
                minX: -widgetRect.width + padding,
                maxX: viewport.width - padding,
                minY: 0,
                maxY: viewport.height - padding
            };
        }
        
        /**
         * Animate the drop effect
         * @private
         */
        animateDrop(widget) {
            widget.element.style.transition = `transform ${this.config.dropAnimationDuration}ms ease-out`;
            
            setTimeout(() => {
                widget.element.style.transition = '';
            }, this.config.dropAnimationDuration);
        }
        
        /**
         * Update boundaries for a widget (e.g., after window resize)
         */
        updateBoundaries(widget) {
            if (!widget || !widget.state.position) return;
            
            const boundaries = this.calculateBoundaries(widget);
            const currentPos = widget.state.position;
            
            // Constrain to new boundaries
            const constrainedX = Math.max(boundaries.minX, Math.min(currentPos.x, boundaries.maxX));
            const constrainedY = Math.max(boundaries.minY, Math.min(currentPos.y, boundaries.maxY));
            
            if (constrainedX !== currentPos.x || constrainedY !== currentPos.y) {
                widget.state.position = { x: constrainedX, y: constrainedY };
                widget.element.style.left = `${constrainedX}px`;
                widget.element.style.top = `${constrainedY}px`;
            }
        }
        
        /**
         * Validate and correct widget position
         */
        validatePosition(widget) {
            if (!widget || !widget.state.position) return;
            
            this.updateBoundaries(widget);
        }
        
        /**
         * Update drag configuration
         */
        updateConfiguration(config) {
            this.config = { ...this.config, ...config };
        }
        
        /**
         * Get drag metrics
         */
        getMetrics() {
            return { ...this.dragMetrics };
        }
    }
    
    // Export for use in other modules
    if (typeof window !== 'undefined') {
        window.DragManager = DragManager;
    }
    
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { DragManager };
    }
})();