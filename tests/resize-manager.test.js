/**
 * Unit Tests for ResizeManager
 * Tests all functionality including handle generation, constraint enforcement, and state persistence
 */

describe('ResizeManager', () => {
    let resizeManager;
    let mockWidgetManager;
    let mockWidget;
    let mockElement;
    
    beforeEach(() => {
        // Create mock DOM element
        mockElement = document.createElement('div');
        mockElement.style.width = '400px';
        mockElement.style.height = '300px';
        mockElement.style.position = 'absolute';
        mockElement.style.left = '100px';
        mockElement.style.top = '100px';
        document.body.appendChild(mockElement);
        
        // Create mock widget manager with event bus
        mockWidgetManager = {
            widgets: new Map(),
            config: {
                persistState: true
            },
            eventBus: {
                emit: jest.fn()
            },
            stateManager: {
                saveState: jest.fn()
            },
            performanceMetrics: {
                resizeOperations: 0
            }
        };
        
        // Create mock widget
        mockWidget = {
            id: 'test-widget-1',
            element: mockElement,
            options: {
                minSize: { width: 200, height: 150 },
                maxSize: { width: 800, height: 600 },
                defaultSize: { width: 400, height: 300 }
            },
            state: {
                position: { x: 100, y: 100 },
                dimensions: { width: 400, height: 300 },
                isResizing: false
            }
        };
        
        // Add widget to manager
        mockWidgetManager.widgets.set(mockWidget.id, mockWidget);
        
        // Create ResizeManager instance
        resizeManager = new ResizeManager(mockWidgetManager);
    });
    
    afterEach(() => {
        // Clean up DOM
        document.body.removeChild(mockElement);
        jest.clearAllMocks();
    });
    
    describe('Constructor', () => {
        test('should initialize with correct default values', () => {
            expect(resizeManager.resizeHandles).toEqual(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']);
            expect(resizeManager.minDimensions).toEqual({ width: 200, height: 150 });
            expect(resizeManager.maxDimensions).toEqual({ width: 0.9, height: 0.9 });
            expect(resizeManager.activeResize).toBeNull();
            expect(resizeManager.resizeStartData).toBeNull();
            expect(resizeManager.resizeThrottle).toBe(16);
        });
        
        test('should bind event handlers correctly', () => {
            expect(resizeManager.handleMouseDown).toBeDefined();
            expect(resizeManager.handleMouseMove).toBeDefined();
            expect(resizeManager.handleMouseUp).toBeDefined();
            expect(resizeManager.handleTouchStart).toBeDefined();
            expect(resizeManager.handleTouchMove).toBeDefined();
            expect(resizeManager.handleTouchEnd).toBeDefined();
        });
    });
    
    describe('attachToWidget', () => {
        test('should attach resize functionality to a valid widget', () => {
            const createHandlesSpy = jest.spyOn(resizeManager, 'createResizeHandles');
            const attachListenersSpy = jest.spyOn(resizeManager, 'attachResizeListeners');
            const setupObserverSpy = jest.spyOn(resizeManager, 'setupResizeObserver');
            
            resizeManager.attachToWidget(mockWidget);
            
            expect(createHandlesSpy).toHaveBeenCalledWith(mockWidget);
            expect(attachListenersSpy).toHaveBeenCalledWith(mockWidget);
            expect(setupObserverSpy).toHaveBeenCalledWith(mockWidget);
        });
        
        test('should handle invalid widget gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            resizeManager.attachToWidget(null);
            expect(consoleSpy).toHaveBeenCalledWith('[ResizeManager] Invalid widget provided');
            
            resizeManager.attachToWidget({ /* no element */ });
            expect(consoleSpy).toHaveBeenCalledWith('[ResizeManager] Invalid widget provided');
            
            consoleSpy.mockRestore();
        });
        
        test('should apply default size if specified', () => {
            const applySizeSpy = jest.spyOn(resizeManager, 'applySize');
            
            resizeManager.attachToWidget(mockWidget);
            
            expect(applySizeSpy).toHaveBeenCalledWith(mockWidget, mockWidget.options.defaultSize);
        });
    });
    
    describe('createResizeHandles', () => {
        test('should create 8 resize handles', () => {
            resizeManager.createResizeHandles(mockWidget);
            
            const handleContainer = mockElement.querySelector('.widget-resize-handles');
            expect(handleContainer).toBeTruthy();
            
            const handles = handleContainer.querySelectorAll('.resize-handle');
            expect(handles.length).toBe(8);
        });
        
        test('should set correct data attributes on handles', () => {
            resizeManager.createResizeHandles(mockWidget);
            
            const handles = mockElement.querySelectorAll('.resize-handle');
            handles.forEach((handle, index) => {
                const position = resizeManager.resizeHandles[index];
                expect(handle.dataset.resizeHandle).toBe(position);
                expect(handle.dataset.widgetId).toBe(mockWidget.id);
            });
        });
        
        test('should apply correct cursor styles to handles', () => {
            resizeManager.createResizeHandles(mockWidget);
            
            const handleN = mockElement.querySelector('.resize-handle-n');
            expect(handleN.style.cursor).toBe('ns-resize');
            
            const handleE = mockElement.querySelector('.resize-handle-e');
            expect(handleE.style.cursor).toBe('ew-resize');
            
            const handleNE = mockElement.querySelector('.resize-handle-ne');
            expect(handleNE.style.cursor).toBe('nesw-resize');
            
            const handleSE = mockElement.querySelector('.resize-handle-se');
            expect(handleSE.style.cursor).toBe('nwse-resize');
        });
        
        test('should store handle references in WeakMap', () => {
            resizeManager.createResizeHandles(mockWidget);
            
            const handles = resizeManager.handleElements.get(mockElement);
            expect(handles).toBeDefined();
            expect(Object.keys(handles).length).toBe(8);
        });
    });
    
    describe('Handle Events', () => {
        beforeEach(() => {
            resizeManager.attachToWidget(mockWidget);
        });
        
        test('should start resize on mousedown', () => {
            const handle = mockElement.querySelector('.resize-handle-se');
            const startResizeSpy = jest.spyOn(resizeManager, 'startResize');
            
            const event = new MouseEvent('mousedown', {
                clientX: 500,
                clientY: 400,
                bubbles: true
            });
            
            handle.dispatchEvent(event);
            
            expect(startResizeSpy).toHaveBeenCalledWith(
                mockWidget,
                'se',
                500,
                400
            );
        });
        
        test('should prevent default and stop propagation on mousedown', () => {
            const handle = mockElement.querySelector('.resize-handle-se');
            const event = new MouseEvent('mousedown', {
                clientX: 500,
                clientY: 400,
                bubbles: true,
                cancelable: true
            });
            
            const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
            const stopPropagationSpy = jest.spyOn(event, 'stopPropagation');
            
            handle.dispatchEvent(event);
            
            expect(preventDefaultSpy).toHaveBeenCalled();
            expect(stopPropagationSpy).toHaveBeenCalled();
        });
        
        test('should add document listeners on resize start', () => {
            const handle = mockElement.querySelector('.resize-handle-se');
            const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
            
            const event = new MouseEvent('mousedown', {
                clientX: 500,
                clientY: 400,
                bubbles: true
            });
            
            handle.dispatchEvent(event);
            
            expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', resizeManager.handleMouseMove);
            expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', resizeManager.handleMouseUp);
        });
    });
    
    describe('performResize', () => {
        beforeEach(() => {
            resizeManager.attachToWidget(mockWidget);
            // Start a resize operation
            resizeManager.startResize(mockWidget, 'se', 500, 400);
        });
        
        test('should resize southeast handle correctly', () => {
            resizeManager.performResize(100, 50);
            
            expect(mockElement.style.width).toBe('500px');
            expect(mockElement.style.height).toBe('350px');
            expect(mockWidget.state.dimensions).toEqual({ width: 500, height: 350 });
        });
        
        test('should resize northwest handle correctly', () => {
            resizeManager.resizeStartData.position = 'nw';
            resizeManager.performResize(-50, -30);
            
            expect(mockElement.style.width).toBe('450px');
            expect(mockElement.style.height).toBe('330px');
            expect(mockElement.style.left).toBe('50px');
            expect(mockElement.style.top).toBe('70px');
        });
        
        test('should emit resize event', () => {
            resizeManager.performResize(100, 50);
            
            expect(mockWidgetManager.eventBus.emit).toHaveBeenCalledWith('widget:resize', {
                widget: mockWidget,
                dimensions: { width: 500, height: 350 }
            });
        });
    });
    
    describe('applyConstraints', () => {
        test('should enforce minimum dimensions', () => {
            const result = resizeManager.applyConstraints(100, 100, mockWidget);
            
            expect(result.width).toBe(200); // min width
            expect(result.height).toBe(150); // min height
        });
        
        test('should enforce maximum dimensions', () => {
            const result = resizeManager.applyConstraints(1000, 800, mockWidget);
            
            expect(result.width).toBe(800); // max width from widget options
            expect(result.height).toBe(600); // max height from widget options
        });
        
        test('should calculate max from viewport percentage if not specified', () => {
            const widgetNoMax = {
                ...mockWidget,
                options: { minSize: { width: 200, height: 150 } }
            };
            
            // Mock window dimensions
            Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
            Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
            
            const result = resizeManager.applyConstraints(2000, 1200, widgetNoMax);
            
            expect(result.width).toBe(1920 * 0.9); // 90% of viewport width
            expect(result.height).toBe(1080 * 0.9); // 90% of viewport height
        });
        
        test('should allow valid dimensions within constraints', () => {
            const result = resizeManager.applyConstraints(400, 300, mockWidget);
            
            expect(result.width).toBe(400);
            expect(result.height).toBe(300);
        });
    });
    
    describe('endResize', () => {
        beforeEach(() => {
            resizeManager.attachToWidget(mockWidget);
            resizeManager.startResize(mockWidget, 'se', 500, 400);
            resizeManager.performResize(100, 50);
        });
        
        test('should update widget state', () => {
            resizeManager.endResize();
            
            expect(mockWidget.state.isResizing).toBe(false);
            expect(mockElement.classList.contains('widget-resizing')).toBe(false);
        });
        
        test('should persist state when configured', () => {
            resizeManager.endResize();
            
            expect(mockWidgetManager.stateManager.saveState).toHaveBeenCalledWith(
                mockWidget.id,
                mockWidget.state
            );
        });
        
        test('should emit resize:end event', () => {
            resizeManager.endResize();
            
            expect(mockWidgetManager.eventBus.emit).toHaveBeenCalledWith('widget:resize:end', {
                widget: mockWidget,
                dimensions: mockWidget.state.dimensions
            });
        });
        
        test('should update performance metrics', () => {
            const initialCount = mockWidgetManager.performanceMetrics.resizeOperations;
            resizeManager.endResize();
            
            expect(mockWidgetManager.performanceMetrics.resizeOperations).toBe(initialCount + 1);
        });
        
        test('should clear active resize data', () => {
            resizeManager.endResize();
            
            expect(resizeManager.activeResize).toBeNull();
            expect(resizeManager.resizeStartData).toBeNull();
        });
    });
    
    describe('Touch Events', () => {
        beforeEach(() => {
            resizeManager.attachToWidget(mockWidget);
        });
        
        test('should handle touch start', () => {
            const handle = mockElement.querySelector('.resize-handle-se');
            const startResizeSpy = jest.spyOn(resizeManager, 'startResize');
            
            const event = new TouchEvent('touchstart', {
                touches: [{ clientX: 500, clientY: 400 }],
                bubbles: true,
                cancelable: true
            });
            
            handle.dispatchEvent(event);
            
            expect(startResizeSpy).toHaveBeenCalledWith(
                mockWidget,
                'se',
                500,
                400
            );
        });
        
        test('should prevent default on touch events', () => {
            const handle = mockElement.querySelector('.resize-handle-se');
            const event = new TouchEvent('touchstart', {
                touches: [{ clientX: 500, clientY: 400 }],
                bubbles: true,
                cancelable: true
            });
            
            const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
            
            handle.dispatchEvent(event);
            
            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });
    
    describe('ResizeObserver', () => {
        test('should set up ResizeObserver if available', () => {
            const mockObserve = jest.fn();
            const MockResizeObserver = jest.fn(() => ({
                observe: mockObserve,
                disconnect: jest.fn()
            }));
            
            window.ResizeObserver = MockResizeObserver;
            
            resizeManager.setupResizeObserver(mockWidget);
            
            expect(MockResizeObserver).toHaveBeenCalled();
            expect(mockObserve).toHaveBeenCalledWith(mockElement);
        });
        
        test('should handle ResizeObserver not available', () => {
            const originalResizeObserver = window.ResizeObserver;
            delete window.ResizeObserver;
            
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            resizeManager.setupResizeObserver(mockWidget);
            
            expect(consoleSpy).toHaveBeenCalledWith('[ResizeManager] ResizeObserver not supported');
            
            window.ResizeObserver = originalResizeObserver;
            consoleSpy.mockRestore();
        });
    });
    
    describe('detachFromWidget', () => {
        beforeEach(() => {
            resizeManager.attachToWidget(mockWidget);
        });
        
        test('should remove resize handles', () => {
            const handleContainer = mockElement.querySelector('.widget-resize-handles');
            expect(handleContainer).toBeTruthy();
            
            resizeManager.detachFromWidget(mockWidget);
            
            const removedContainer = mockElement.querySelector('.widget-resize-handles');
            expect(removedContainer).toBeFalsy();
        });
        
        test('should clear cached handles', () => {
            expect(resizeManager.handleElements.has(mockElement)).toBe(true);
            
            resizeManager.detachFromWidget(mockWidget);
            
            expect(resizeManager.handleElements.has(mockElement)).toBe(false);
        });
        
        test('should disconnect ResizeObserver', () => {
            const mockDisconnect = jest.fn();
            const mockObserver = { disconnect: mockDisconnect };
            resizeManager.resizeObservers.set(mockElement, mockObserver);
            
            resizeManager.detachFromWidget(mockWidget);
            
            expect(mockDisconnect).toHaveBeenCalled();
            expect(resizeManager.resizeObservers.has(mockElement)).toBe(false);
        });
    });
    
    describe('updateConstraints', () => {
        test('should update minimum dimensions', () => {
            resizeManager.updateConstraints({
                minDimensions: { width: 250, height: 200 }
            });
            
            expect(resizeManager.minDimensions).toEqual({ width: 250, height: 200 });
        });
        
        test('should update maximum dimensions', () => {
            resizeManager.updateConstraints({
                maxDimensions: { width: 0.8, height: 0.8 }
            });
            
            expect(resizeManager.maxDimensions).toEqual({ width: 0.8, height: 0.8 });
        });
        
        test('should merge partial updates', () => {
            resizeManager.updateConstraints({
                minDimensions: { width: 250 }
            });
            
            expect(resizeManager.minDimensions).toEqual({ width: 250, height: 150 });
        });
    });
    
    describe('getState', () => {
        test('should return idle state when not resizing', () => {
            const state = resizeManager.getState();
            
            expect(state).toEqual({
                isResizing: false,
                activeWidget: null,
                handlePosition: null
            });
        });
        
        test('should return active state when resizing', () => {
            resizeManager.attachToWidget(mockWidget);
            resizeManager.startResize(mockWidget, 'se', 500, 400);
            
            const state = resizeManager.getState();
            
            expect(state).toEqual({
                isResizing: true,
                activeWidget: 'test-widget-1',
                handlePosition: 'se'
            });
        });
    });
    
    describe('Hover Effects', () => {
        beforeEach(() => {
            resizeManager.createResizeHandles(mockWidget);
        });
        
        test('should show handles on widget hover', () => {
            const handles = mockElement.querySelectorAll('.resize-handle');
            
            const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
            mockElement.dispatchEvent(mouseEnterEvent);
            
            handles.forEach(handle => {
                expect(handle.style.opacity).toBe('0.5');
            });
        });
        
        test('should hide handles on widget leave when not resizing', () => {
            const handles = mockElement.querySelectorAll('.resize-handle');
            
            // First enter to show handles
            const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
            mockElement.dispatchEvent(mouseEnterEvent);
            
            // Then leave to hide
            const mouseLeaveEvent = new MouseEvent('mouseleave', { bubbles: true });
            mockElement.dispatchEvent(mouseLeaveEvent);
            
            handles.forEach(handle => {
                expect(handle.style.opacity).toBe('0');
            });
        });
        
        test('should enhance handle visibility on handle hover', () => {
            const handle = mockElement.querySelector('.resize-handle-se');
            
            const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
            handle.dispatchEvent(mouseEnterEvent);
            
            expect(handle.style.background).toBe('rgba(100, 150, 255, 0.5)');
            expect(handle.style.opacity).toBe('1');
        });
    });
    
    describe('Performance', () => {
        beforeEach(() => {
            resizeManager.attachToWidget(mockWidget);
            resizeManager.startResize(mockWidget, 'se', 500, 400);
        });
        
        test('should throttle resize operations', () => {
            const performResizeSpy = jest.spyOn(resizeManager, 'performResize');
            
            // Set last resize time to recent
            resizeManager.lastResizeTime = Date.now() - 5;
            
            // Try to resize within throttle window
            resizeManager.handleMouseMove({ clientX: 600, clientY: 450 });
            
            // Should not call performResize due to throttling
            expect(performResizeSpy).not.toHaveBeenCalled();
        });
        
        test('should allow resize after throttle period', () => {
            const performResizeSpy = jest.spyOn(resizeManager, 'performResize');
            
            // Set last resize time to past throttle window
            resizeManager.lastResizeTime = Date.now() - 20;
            
            // Try to resize after throttle window
            resizeManager.handleMouseMove({ clientX: 600, clientY: 450 });
            
            // Should call performResize
            expect(performResizeSpy).toHaveBeenCalled();
        });
    });
});

describe('ResizeManager Integration', () => {
    test('should be available as window.ResizeManager', () => {
        expect(window.ResizeManager).toBeDefined();
        expect(typeof window.ResizeManager).toBe('function');
    });
    
    test('should be instantiable', () => {
        const mockManager = { config: {} };
        const instance = new window.ResizeManager(mockManager);
        
        expect(instance).toBeInstanceOf(window.ResizeManager);
        expect(instance.widgetManager).toBe(mockManager);
    });
});