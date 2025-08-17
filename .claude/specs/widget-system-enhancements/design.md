# Widget System Enhancements - Design Document

## Architecture Overview

The widget system enhancement will be implemented through a modular architecture that extends the existing widget infrastructure while maintaining backward compatibility. The solution involves creating new manager classes and enhancing existing ones.

## Component Architecture

### 1. Core Widget Manager Enhancement

```javascript
class EnhancedWidgetManager {
    constructor() {
        this.widgets = new Map();
        this.zIndexManager = new ZIndexManager();
        this.resizeManager = new ResizeManager();
        this.dragManager = new DragManager();
        this.focusManager = new FocusManager();
        this.stateManager = new WidgetStateManager();
    }
}
```

### 2. Resize System Architecture

#### ResizeManager Class
```javascript
class ResizeManager {
    constructor() {
        this.resizeHandles = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
        this.minDimensions = { width: 200, height: 150 };
        this.maxDimensions = { width: 0.9, height: 0.9 }; // Percentage of viewport
        this.activeResize = null;
    }
    
    attachToWidget(widget) {
        this.createResizeHandles(widget);
        this.attachResizeListeners(widget);
    }
    
    createResizeHandles(widget) {
        // Create 8 resize handles (corners and edges)
        // Position them absolutely within widget
    }
    
    handleResize(widget, handle, deltaX, deltaY) {
        // Calculate new dimensions based on handle position
        // Enforce min/max constraints
        // Update widget dimensions
        // Persist to storage
    }
}
```

#### Resize Handle Positioning
- **Corners**: 8x8px handles at each corner (nw, ne, sw, se)
- **Edges**: 4px wide handles along each edge (n, e, s, w)
- **Visual**: Semi-transparent with hover effect
- **Cursor**: Appropriate resize cursors (ns-resize, ew-resize, etc.)

### 3. Drag System Fix

#### Enhanced DragManager
```javascript
class DragManager {
    constructor() {
        this.isDragging = false;
        this.draggedWidget = null;
        this.dragOffset = { x: 0, y: 0 };
        this.boundaries = this.calculateBoundaries();
    }
    
    initializeDrag(widget, event) {
        // Capture initial mouse position
        // Calculate offset from widget position
        // Set dragging state
        // Add document-level listeners
    }
    
    handleDrag(event) {
        // Calculate new position
        // Apply boundary constraints
        // Update widget position
        // Use transform for performance
    }
    
    calculateBoundaries() {
        // Ensure 50px of header remains visible
        // Constrain to viewport
    }
}
```

### 4. Theme Application System

#### Theme Application Flow
```javascript
class ThemeApplicationManager {
    constructor() {
        this.activeTheme = null;
        this.themeObservers = new Set();
    }
    
    applyTheme(themeName) {
        // Load theme from ui-theme-manager
        // Apply CSS custom properties to :root
        // Notify all widget observers
        // Update all widget-specific styles
    }
    
    registerWidget(widget) {
        // Add widget to observers
        // Apply current theme to widget
    }
    
    injectThemeVariables(widget, theme) {
        // Set CSS custom properties on widget root
        // Apply theme-specific classes
        // Force style recalculation
    }
}
```

### 5. Keyboard System Architecture

#### Context-Aware Keyboard Manager
```javascript
class KeyboardManager {
    constructor() {
        this.contexts = new Map([
            ['global', new Map()],
            ['widget', new Map()],
            ['automation', new Map()]
        ]);
        this.activeContext = 'global';
        this.escapeHandler = new EscapeKeyHandler();
    }
    
    registerShortcut(context, keys, callback) {
        // Parse key combination
        // Register in appropriate context
        // Check for conflicts
    }
    
    handleKeyPress(event) {
        // Determine active context
        // Check for matching shortcuts
        // Execute callback with proper scope
        // Handle ESC key specially
    }
}
```

#### Escape Key Handler
```javascript
class EscapeKeyHandler {
    handleEscape() {
        // Priority order:
        // 1. Close topmost modal/dialog
        // 2. Close topmost widget
        // 3. Cancel automation (with confirmation if critical)
        // 4. Clear selections
    }
    
    getActionForContext() {
        // Analyze current UI state
        // Return appropriate action
    }
}
```

### 6. Animation Positioning System

#### Animation Anchor Manager
```javascript
class AnimationAnchorManager {
    constructor() {
        this.widgetPositions = new WeakMap();
    }
    
    calculateAnimationOrigin(widget) {
        const rect = widget.getBoundingClientRect();
        const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        return center;
    }
    
    applyAnimation(widget, animationType) {
        const origin = this.calculateAnimationOrigin(widget);
        // Set transform-origin based on widget position
        // Apply animation with correct positioning
    }
    
    updateTransformOrigin(widget) {
        const position = this.getWidgetPosition(widget);
        widget.style.transformOrigin = `${position.x}px ${position.y}px`;
    }
}
```

### 7. Configuration UI Integration

#### Configuration Panel Architecture
```javascript
class ConfigurationUIPanel {
    constructor(uiConfig) {
        this.config = uiConfig;
        this.sections = this.organizeSections();
        this.validators = new ConfigValidators();
    }
    
    organizeSections() {
        return {
            general: ['position', 'size', 'opacity', 'behavior'],
            notifications: ['position', 'duration', 'stacking'],
            performance: ['animations', 'debouncing', 'caching'],
            accessibility: ['keyboard', 'focus', 'announcements']
        };
    }
    
    renderConfigSection(sectionName) {
        // Create form controls for each option
        // Add validation listeners
        // Bind to real-time updates
    }
    
    applyConfigChange(key, value) {
        // Validate value
        // Update configuration
        // Trigger immediate UI update
        // Persist to storage
    }
}
```

### 8. Z-Index Management System

#### Z-Index Stack Manager
```javascript
class ZIndexManager {
    constructor() {
        this.baseZIndex = 10000;
        this.zIndexStack = [];
        this.maxZIndex = 10100;
        this.focusedWidget = null;
    }
    
    bringToFront(widget) {
        // Remove from current position in stack
        // Add to top of stack
        // Reassign z-indices to maintain order
        // Apply focus styling
        this.rebalanceZIndices();
    }
    
    rebalanceZIndices() {
        // Prevent z-index inflation
        // Redistribute z-indices when approaching max
        // Maintain relative ordering
    }
    
    applyFocusIndicator(widget) {
        // Add focus class
        // Enhance shadow/border
        // Slightly dim other widgets
    }
}
```

## Data Models

### Widget State Model
```javascript
interface WidgetState {
    id: string;
    position: { x: number, y: number };
    dimensions: { width: number, height: number };
    zIndex: number;
    isMinimized: boolean;
    isVisible: boolean;
    theme: string;
    customStyles: object;
}
```

### Configuration Model
```javascript
interface UIConfiguration {
    general: {
        defaultPosition: string;
        defaultSize: { width: number, height: number };
        opacity: number;
        autoSave: boolean;
    };
    performance: {
        enableAnimations: boolean;
        animationSpeed: number;
        reducedMotion: boolean;
        debounceDelay: number;
    };
    accessibility: {
        keyboardNavigation: boolean;
        focusIndicators: boolean;
        announcements: boolean;
    };
}
```

## Integration Points

### 1. Existing Widget Classes
- Extend UIManager with resize/drag capabilities
- Enhance NotificationManager with proper positioning
- Update ConfigurationDialog with new options

### 2. Storage Integration
```javascript
class WidgetStateManager {
    saveState(widgetId, state) {
        const states = GM_getValue('widgetStates', {});
        states[widgetId] = state;
        GM_setValue('widgetStates', states);
    }
    
    loadState(widgetId) {
        const states = GM_getValue('widgetStates', {});
        return states[widgetId] || this.getDefaultState();
    }
}
```

### 3. Event System
```javascript
class WidgetEventBus {
    constructor() {
        this.events = new Map();
    }
    
    emit(eventName, data) {
        // Notify all listeners
        // Theme changes, focus changes, resize events
    }
    
    on(eventName, callback) {
        // Register event listener
    }
}
```

## Performance Considerations

### 1. Resize Performance
- Use `transform` instead of changing width/height during drag
- Throttle resize events to 16ms (60 FPS)
- Use `will-change: transform` for resize handles

### 2. Drag Performance
- Use `transform: translate()` for movement
- Implement pointer capture for smooth dragging
- Debounce position persistence

### 3. Animation Performance
- Use CSS transforms exclusively
- Implement `will-change` hints
- Respect `prefers-reduced-motion`

### 4. Z-Index Optimization
- Limit z-index range to prevent overflow
- Batch z-index updates
- Use CSS classes for focus states

## Error Handling

### 1. Graceful Degradation
- Fallback to non-resizable if ResizeObserver unavailable
- Fallback to basic dragging if pointer events unsupported
- Disable animations if performance is poor

### 2. State Recovery
- Validate stored states before applying
- Reset to defaults if state is corrupted
- Implement state versioning for migrations

### 3. Conflict Resolution
- Keyboard shortcut conflict detection
- Theme variable conflict resolution
- Position boundary violation handling


## Migration Path

### Phase 1: Core Infrastructure
1. Implement EnhancedWidgetManager
2. Add ResizeManager and DragManager
3. Fix existing drag issues

### Phase 2: Keyboard and Focus
1. Implement KeyboardManager
2. Add EscapeKeyHandler
3. Implement ZIndexManager

### Phase 3: Visual Enhancements
1. Fix animation positioning
2. Implement theme application fixes
3. Add focus indicators

### Phase 4: Configuration
1. Integrate ui-config.js options
2. Build configuration UI
3. Implement real-time updates

## API Design

### Public API for Widget Registration
```javascript
// Register a widget with the enhanced system
widgetManager.registerWidget({
    id: 'settings-widget',
    element: widgetElement,
    options: {
        resizable: true,
        draggable: true,
        minSize: { width: 300, height: 200 },
        defaultPosition: 'center',
        animations: true
    }
});

// Programmatic control
widgetManager.bringToFront('settings-widget');
widgetManager.minimize('settings-widget');
widgetManager.restore('settings-widget');
widgetManager.close('settings-widget');
```

## Backward Compatibility

- All enhancements are opt-in via configuration
- Existing widget behavior preserved by default
- Progressive enhancement approach
- Feature detection for browser capabilities