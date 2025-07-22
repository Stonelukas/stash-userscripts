# AutomateStash Userscript Development Guide

## Project Architecture

**AutomateStash** is a sophisticated Greasemonkey/Tampermonkey userscript that automates metadata scraping and organization for Stash (a self-hosted adult content management system). The script operates within Stash's React SPA environment, providing automated workflows for scene metadata enrichment.

### Core Components & Patterns

**Configuration System** (`CONFIG_KEYS`, `DEFAULT_CONFIG`)
- Persistent storage using Greasemonkey APIs (`GM_setValue`/`GM_getValue`)
- Type-safe configuration with fallbacks to defaults
- Runtime config changes propagate immediately to automation behavior

**React SPA Integration** (`STASH_CONFIG`)
- Timing constants tuned for React component lifecycle: `REACT_RENDER_DELAY`, `GRAPHQL_MUTATION_DELAY`
- Element detection with React-aware waiting strategies
- DOM mutation observers with debouncing for SPA navigation

**State Management** (Global flags)
```javascript
let automationInProgress = false;
let automationCancelled = false; 
let automationCompleted = false;
```
These flags prevent race conditions and UI recreation loops during automation phases.

### Critical Automation Phases

1. **Phase 0**: Metadata detection using intelligent content analysis
2. **Phase 1**: StashDB scraping with dropdown interaction  
3. **Phase 2**: ThePornDB scraping with pattern matching
4. **Phase 3**: Save operations and organized status toggle

Each phase includes cancellation checks and error recovery mechanisms.

### UI Architecture Patterns

**Multi-State UI System**:
- Full automation panel (`#stash-automation-panel`) with status display
- Minimized floating button (`#stash-minimized-button`) for completed states
- Cancel button overlay during active automation
- Modal configuration dialog for settings

**Element Detection Strategies**:
```javascript
// Multiple fallback selectors for robustness
const applySelectors = [
  '.edit-panel button.btn-primary',           // Stash-specific
  'button.ml-2.btn.btn-primary',             // Bootstrap patterns  
  'button[data-testid*="apply"]'             // Test-id fallbacks
];
```

### Stash-Specific Integration Points

**GraphQL Mutation Handling**:
- Uses `waitForMutation` flag with configured delays
- Handles Stash's asynchronous backend operations

**Entity Edit Panel Interaction**:
- Selector patterns: `.entity-edit-panel`, `.scene-edit-form`
- React Router navigation: `a[data-rb-event-key="scene-edit-panel"]`

**Scraper Dropdown Navigation**:
- Bootstrap dropdown patterns in ScraperMenu components
- Multi-strategy selection for StashDB/ThePornDB options
- Handles dynamic loading of scraper configurations

## Development Conventions

### Error Handling & Resilience
- **Strategy Pattern**: Multiple fallback approaches for UI element detection
- **Timeout Protection**: All element waiting has configurable timeouts
- **Graceful Degradation**: Automation continues even if individual scrapers fail
- **User Cancellation**: `checkCancellation()` calls throughout async workflows

### Performance Optimizations
- **Debounced Observers**: DOM mutations and navigation changes use 1-2 second debouncing
- **React Lifecycle Awareness**: Waits for component render cycles before element interaction
- **Intelligent Caching**: Scraper detection results cached during automation session

### Async Patterns
```javascript
// Standard pattern for robust element interaction
async function clickElementOptimized(selectors, description, waitForMutation = false) {
  const element = await waitForElementAdvanced(selectors, 8000);
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.focus();
  element.click();
  if (waitForMutation) await sleep(STASH_CONFIG.GRAPHQL_MUTATION_DELAY);
}
```

### Configuration Management
- **Persistent Settings**: Use `getConfig(key)` and `setConfig(key, value)` for user preferences
- **Runtime Updates**: Configuration changes take effect immediately without restart
- **Default Fallbacks**: Always provide sensible defaults for new configuration keys

## Debugging & Troubleshooting

### Debug Tooling
- **Element Analysis**: `debugElementsInArea()` provides detailed DOM structure inspection
- **Confidence Scoring**: Scraper detection uses weighted confidence metrics (0.0-1.0)
- **Phase Logging**: Each automation phase logs detailed progress with emoji prefixes

### Common Integration Points
- **URL Patterns**: `http://localhost:9998/scenes/*` (excludes markers and edit pages)
- **React Components**: Look for `[data-reactroot]`, `[data-react-class]` for component detection
- **Bootstrap UI**: Extensive use of `.btn-group`, `.dropdown-menu`, `.btn-primary` patterns

### Testing Considerations
- **SPA Navigation**: Test across scene transitions, automation state should reset appropriately  
- **Concurrent Users**: Automation state is per-browser-tab, multiple tabs should work independently
- **Error Recovery**: Test cancellation and error states, UI should always be recoverable

## Integration Dependencies

- **Stash Server**: Requires running Stash instance on localhost:9998
- **Greasemonkey/Tampermonkey**: Uses GM APIs for persistent storage and notifications
- **External Scrapers**: StashDB (stashdb.org) and ThePornDB (metadataapi.net) integration

Always test changes against actual Stash scenes to verify React component interaction patterns remain valid.[byterover-mcp]

# important 
always use byterover-retrive-knowledge tool to get the related context before any tasks 
always use byterover-store-knowledge to store all the critical informations after sucessful tasks