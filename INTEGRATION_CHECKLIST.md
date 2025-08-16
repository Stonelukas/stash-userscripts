# Integration Checklist - AutomateStash Enhanced v5.0.0

## Current Status

### ✅ Completed Library Files
1. **performance-enhancer.js** - Exports: `window.PerformanceEnhancer`, `window.domBatch`, `window.performanceConfig`
2. **cache-manager.js** - Exports: `window.CacheManager`
3. **ui-theme-manager.js** - Exports: `window.ThemeManager`, `window.themeManager` (instance)
4. **keyboard-shortcuts.js** - Exports: `window.KeyboardShortcutsManager`
5. **animation-controller.js** - Exports: `window.AnimationController`, `window.animationController` (instance)
6. **performance-config.js** - Included in performance-enhancer.js
7. **ui-config.js** - Exports: `window.UIConfig`, `window.uiConfig` (instance)

### ✅ Core Automation Logic Integration Complete

All critical methods from AutomateStash-Final.js have been integrated with performance monitoring:

#### Integrated Methods:
1. ✅ **`waitForElement(selectors, opts)`** - Element detection with MutationObserver
2. ✅ **`waitForVisibleElement(selectors, opts)`** - Visibility detection
3. ✅ **`clickFast(selectorsOrElement, opts)`** - Fast click with focus
4. ✅ **`detectScraperOutcome(timeoutMs)`** - Scraper result detection
5. ✅ **`checkAlreadyScraped()`** - Enhanced with GraphQL detection
6. ✅ **`scrapeStashDB()`** - StashDB scraping with dropdown handling
7. ✅ **`scrapeThePornDB()`** - ThePornDB scraping with dropdown handling
8. ✅ **`findScrapeButton()`** - Multiple selector fallbacks
9. ✅ **`findApplyButton()`** - Modal and panel button detection
10. ✅ **`openEditPanel()`** - Edit panel navigation
11. ✅ **`applyScrapedData()`** - Apply scraped metadata
12. ✅ **`createNewPerformers()`** - Create new performers/studios/tags
13. ✅ **`organizeScene()`** - Mark scene as organized
14. ✅ **`saveScene()`** - Save with multiple selectors

#### Supporting Methods Needed:
- `waitForSceneRerender()` - Wait for UI updates
- `debugElementsInArea()` - Debug helper
- `debugListAllButtons()` - Debug helper
- `debugListAllFormElements()` - Debug helper
- `showCancelButton()` - Cancel UI element
- `hideCancelButton()` - Hide cancel UI

## Compatibility Issues to Fix

### 1. @require Statements
The current @require statements use `file://` protocol which won't work for most users:
```javascript
// Current (incorrect):
// @require      file:///home/stonelukas/tools/privat/stash-userscripts/scripts/lib/performance-enhancer.js

// Should be (for Tampermonkey/Greasemonkey):
// Include the code directly or use a CDN/hosted version
```

### 2. Library Loading Order
Correct loading order should be:
1. cache-manager.js (standalone)
2. performance-enhancer.js (uses CacheManager)
3. ui-theme-manager.js (standalone)
4. animation-controller.js (standalone)
5. keyboard-shortcuts.js (uses other managers)
6. ui-config.js (coordinates all managers)

### 3. Missing Class Implementations
The stub classes need full implementation:
- `SourceDetector` - Needs actual detection logic
- `StatusTracker` - Needs status tracking implementation
- `HistoryManager` - Needs history persistence
- `AutomationSummaryWidget` - Needs UI widget creation
- `SchemaWatcher` - Needs GraphQL schema monitoring

## Integration Steps

### Step 1: Fix Library Inclusion
Instead of @require with file:// protocol, either:
- A) Concatenate all libraries into the main script
- B) Host libraries on a CDN (GitHub Pages, jsDelivr)
- C) Use a build process to bundle everything

### Step 2: Add Missing Core Methods
Copy and adapt the following methods from AutomateStash-Final.js with performance monitoring:
```javascript
async waitForElement(selectors, opts = {}) {
    return await window.PerformanceEnhancer.measure('WaitForElement', async () => {
        // Original implementation here
    });
}
```

### Step 3: Wrap Existing Methods
All automation methods should be wrapped with performance monitoring:
```javascript
async scrapeStashDB() {
    return await window.PerformanceEnhancer.measure('ScrapeStashDB', async () => {
        // Original scraping logic
    });
}
```

### Step 4: Initialize All Managers
Ensure proper initialization sequence:
```javascript
async function initialize() {
    // 1. Performance systems
    initializePerformance();
    
    // 2. UI systems
    if (window.ThemeManager) {
        window.themeManager = new ThemeManager();
    }
    if (window.AnimationController) {
        window.animationController = new AnimationController();
    }
    
    // 3. Configuration
    if (window.UIConfig) {
        window.uiConfig = new UIConfig();
    }
    
    // 4. Input systems
    if (window.KeyboardShortcutsManager) {
        window.keyboardShortcuts = new KeyboardShortcutsManager({
            shortcuts: getConfig(CONFIG.SHORTCUT_MAP)
        });
    }
    
    // 5. Main UI
    const uiManager = new UIManager();
    await uiManager.initialize();
}
```

## Testing Checklist

### Unit Testing
- [ ] Test each library file loads independently
- [ ] Test window exports are accessible
- [ ] Test configuration persistence with GM_setValue/GM_getValue
- [ ] Test performance monitoring captures metrics
- [ ] Test cache manager stores and retrieves data
- [ ] Test theme switching works
- [ ] Test keyboard shortcuts trigger actions
- [ ] Test animations run smoothly

### Integration Testing
- [ ] Test full automation workflow with all enhancements
- [ ] Test performance metrics are collected during automation
- [ ] Test UI theme persists across sessions
- [ ] Test keyboard shortcuts work with automation
- [ ] Test cache improves GraphQL response times
- [ ] Test DOM batching reduces reflows
- [ ] Test memory cleanup runs periodically

### Performance Testing
- [ ] Measure automation time before/after enhancements
- [ ] Verify 40-50% reduction in automation time
- [ ] Verify 40% reduction in GraphQL requests via caching
- [ ] Verify 60% reduction in DOM operations via batching
- [ ] Verify memory usage stays under 80MB

## Deployment Options

### Option 1: Single File Bundle (Recommended)
Concatenate all files in order:
1. cache-manager.js
2. performance-enhancer.js
3. ui-theme-manager.js
4. animation-controller.js
5. keyboard-shortcuts.js
6. ui-config.js
7. AutomateStash-Final-Enhanced.js (with full implementation)

### Option 2: Multi-File with CDN
Host library files on GitHub Pages or jsDelivr:
```javascript
// @require https://cdn.jsdelivr.net/gh/username/repo@version/cache-manager.js
// @require https://cdn.jsdelivr.net/gh/username/repo@version/performance-enhancer.js
// etc...
```

### Option 3: Build Process
Use webpack/rollup to create optimized bundle:
```javascript
// webpack.config.js
module.exports = {
    entry: './scripts/AutomateStash-Final-Enhanced.js',
    output: {
        filename: 'AutomateStash-Enhanced-Bundle.user.js'
    }
};
```

## Next Actions

1. **Immediate**: Copy missing methods from AutomateStash-Final.js
2. **High Priority**: Fix @require statements for proper loading
3. **Medium Priority**: Implement full classes (not stubs)
4. **Low Priority**: Add build process for easier deployment

## Success Criteria

- [ ] All automation features work as in original
- [ ] Performance monitoring shows metrics
- [ ] UI enhancements are visible and functional
- [ ] Keyboard shortcuts work
- [ ] Caching reduces API calls
- [ ] Theme persists between sessions
- [ ] No console errors during operation
- [ ] Memory usage is optimized
- [ ] Animation performance is smooth (60fps)

---

*Last Updated: 2025-01-16*
*Status: 70% Complete - Core automation logic integration pending*