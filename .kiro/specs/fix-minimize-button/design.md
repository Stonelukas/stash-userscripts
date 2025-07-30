# Design Document

## Overview

The minimize button functionality in AutomateStash is failing due to context binding issues and inconsistent state management. The current implementation has multiple code paths for creating minimize buttons, inconsistent UIManager reference handling, and potential race conditions between DOM manipulation and event handler binding.

## Architecture

### Current Issues Identified

1. **Context Binding Problems**: The minimize button click handler loses reference to the UIManager instance
2. **Multiple Creation Paths**: Different code paths create minimize buttons with inconsistent event binding
3. **State Management**: Inconsistent handling of `userManuallyExpanded` flag and panel state
4. **DOM Cleanup**: Incomplete cleanup of existing elements before creating new ones
5. **Timing Issues**: Event handlers may be bound before UIManager methods are fully available

### Root Cause Analysis

Based on code analysis, the primary issues are:

1. **Line 1046**: Duplicate UIManager instantiation (`const uiManager = new UIManager();` appears twice)
2. **Context Loss**: The `uiManagerRef` variable in minimize button handlers may become undefined
3. **Global Fallback**: The global fallback function `window.expandAutomateStash` doesn't properly handle all edge cases
4. **Event Handler Binding**: Minimize button event handlers are created before ensuring UIManager context is available

## Components and Interfaces

### UIManager Class Enhancements

```javascript
class UIManager {
    constructor() {
        this.isMinimized = false;
        this.panel = null;
        this.minimizedButton = null;
        // Bind methods to ensure proper context
        this.minimizePanel = this.minimizePanel.bind(this);
        this.createMinimizedButton = this.createMinimizedButton.bind(this);
        this.createFullPanelForced = this.createFullPanelForced.bind(this);
    }
}
```

### Event Handler Context Binding

```javascript
// Ensure proper context binding for minimize button
const createMinimizeHandler = (uiManagerInstance) => {
    return function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (typeof uiManagerInstance.minimizePanel === 'function') {
            uiManagerInstance.minimizePanel();
        } else {
            console.error('UIManager minimizePanel method not available');
            // Fallback to global function
            if (typeof window.expandAutomateStash === 'function') {
                // Create minimized state manually
                createMinimizedButtonFallback();
            }
        }
    };
};
```

### State Management Improvements

```javascript
// Centralized state management
const AutomateStashState = {
    isMinimized: false,
    userManuallyExpanded: false,
    automationInProgress: false,
    panelExists: false,
    
    updateState(updates) {
        Object.assign(this, updates);
        // Sync with window object for backward compatibility
        window.userManuallyExpanded = this.userManuallyExpanded;
    },
    
    reset() {
        this.isMinimized = false;
        this.userManuallyExpanded = false;
        this.panelExists = false;
    }
};
```

## Data Models

### UI Element State Tracking

```javascript
const UIElementTracker = {
    panel: null,
    minimizedButton: null,
    
    setPanel(element) {
        this.panel = element;
        AutomateStashState.updateState({ panelExists: !!element });
    },
    
    setMinimizedButton(element) {
        this.minimizedButton = element;
        AutomateStashState.updateState({ isMinimized: !!element });
    },
    
    cleanup() {
        if (this.panel && this.panel.parentNode) {
            this.panel.remove();
        }
        if (this.minimizedButton && this.minimizedButton.parentNode) {
            this.minimizedButton.remove();
        }
        this.panel = null;
        this.minimizedButton = null;
        AutomateStashState.updateState({ panelExists: false, isMinimized: false });
    }
};
```

## Error Handling

### Robust Event Handler Error Handling

```javascript
const safeEventHandler = (handler, context = 'Unknown') => {
    return function(event) {
        try {
            console.log(`🔄 DEBUG: ${context} event handler executing`);
            return handler.call(this, event);
        } catch (error) {
            console.error(`❌ ERROR: ${context} event handler failed:`, error);
            console.error('❌ ERROR Stack:', error.stack);
            
            // Attempt recovery
            notifications.show(`⚠️ UI Error: ${context} failed. Attempting recovery...`, 'warning');
            
            // Fallback to global recovery
            if (typeof window.expandAutomateStash === 'function') {
                setTimeout(() => window.expandAutomateStash(), 500);
            }
        }
    };
};
```

### UIManager Method Validation

```javascript
const validateUIManagerMethod = (methodName) => {
    if (!uiManager) {
        console.error(`❌ UIManager instance not available for ${methodName}`);
        return false;
    }
    
    if (typeof uiManager[methodName] !== 'function') {
        console.error(`❌ UIManager.${methodName} is not a function`);
        return false;
    }
    
    return true;
};
```

## Testing Strategy

### Debug Logging Enhancement

```javascript
const DebugLogger = {
    enabled: true,
    
    log(category, message, data = null) {
        if (!this.enabled) return;
        
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const prefix = `🔍 [${timestamp}] ${category}:`;
        
        if (data) {
            console.log(prefix, message, data);
        } else {
            console.log(prefix, message);
        }
    },
    
    error(category, message, error = null) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const prefix = `❌ [${timestamp}] ${category}:`;
        
        console.error(prefix, message);
        if (error) {
            console.error('Error details:', error);
            console.error('Stack trace:', error.stack);
        }
    }
};
```

### Context Validation Tests

```javascript
const validateMinimizeButtonContext = () => {
    const tests = [
        {
            name: 'UIManager Instance',
            test: () => typeof uiManager !== 'undefined',
            fix: 'Ensure UIManager is instantiated before button creation'
        },
        {
            name: 'minimizePanel Method',
            test: () => typeof uiManager?.minimizePanel === 'function',
            fix: 'Check UIManager class definition and method binding'
        },
        {
            name: 'DOM Element Exists',
            test: () => !!document.querySelector('#stash-automation-panel'),
            fix: 'Ensure panel exists before adding minimize button'
        },
        {
            name: 'Global Fallback',
            test: () => typeof window.expandAutomateStash === 'function',
            fix: 'Ensure global fallback function is defined'
        }
    ];
    
    tests.forEach(test => {
        const result = test.test();
        DebugLogger.log('VALIDATION', `${test.name}: ${result ? 'PASS' : 'FAIL'}`);
        if (!result) {
            DebugLogger.error('VALIDATION', `Fix needed: ${test.fix}`);
        }
    });
};
```

## Implementation Approach

### Phase 1: Fix Duplicate UIManager Instantiation
- Remove duplicate `const uiManager = new UIManager();` declaration
- Ensure single global UIManager instance

### Phase 2: Improve Context Binding
- Add method binding in UIManager constructor
- Create robust event handler wrapper functions
- Implement context validation before method calls

### Phase 3: Enhance State Management
- Centralize state tracking in AutomateStashState object
- Implement UIElementTracker for DOM element lifecycle
- Add proper cleanup methods

### Phase 4: Add Comprehensive Error Handling
- Wrap all event handlers with error handling
- Add fallback mechanisms for context loss
- Implement recovery procedures

### Phase 5: Improve Debug Logging
- Add structured debug logging with timestamps
- Implement context validation logging
- Add performance timing logs for troubleshooting

## Implementation Status: COMPLETED ✅

### Actual Implementation in AutomateStash-Clean.js

The minimize button functionality has been successfully implemented using a **simplified but effective approach** that addresses all core requirements:

#### ✅ **Clean Architecture Approach**
- **Single UIManager Instance**: Clean constructor with proper property initialization (isMinimized, panel, minimizedButton)
- **Direct Event Binding**: Simplified event handler approach using arrow functions for proper `this` context
- **State Management**: Instance properties provide effective state tracking without complex centralized systems

#### ✅ **Working Minimize/Expand Functionality**
- **Minimize Button**: Properly created in `createHeader()` with working click handler
- **Minimized Button**: Functional `createMinimizedButton()` method with expand capability
- **State Synchronization**: Proper state updates and DOM manipulation throughout minimize/expand cycle

#### ✅ **Error Handling & Recovery**
- **Try-Catch Blocks**: Comprehensive error handling in all async automation methods
- **Element Validation**: Existence checks before DOM manipulation
- **Timeout Protection**: `waitForElement` with timeout parameter for robust element detection

#### ✅ **Debug Logging & Monitoring**
- **Emoji-Prefixed Logging**: Structured console logging throughout (📱, 🔍, 💾, ✅, ❌)
- **Status Updates**: Real-time status updates through `updateSceneStatus()` method
- **Operation Tracking**: Detailed logging for all major operations and state changes

#### ✅ **Additional Features Implemented**
- **Complete Automation Workflow**: `checkAlreadyScraped()`, `applyScrapedData()`, `saveScene()`
- **Skip Logic**: Intelligent detection and skipping of already scraped sources
- **Notification System**: `NotificationManager` with visual feedback and animations
- **Configuration Management**: Persistent settings using GM_setValue/GM_getValue

### Design Decisions Made

1. **Simplified Over Complex**: Chose direct property-based state management over complex centralized systems
2. **Functional Over Theoretical**: Prioritized working functionality over elaborate architectural patterns
3. **Clean Rewrite**: Created new clean implementation rather than patching existing complex codebase
4. **Performance Optimized**: Direct DOM manipulation for better performance and reliability
