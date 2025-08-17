# Technical Steering Rules

## Tech Stack
Use these technologies and respect their patterns:
- **Frontend**: Vanilla JavaScript ES6+ (no framework dependencies)
- **UI Injection**: Direct DOM manipulation with React SPA awareness
- **Storage**: Greasemonkey APIs (GM_setValue, GM_getValue) for persistence
- **API**: GraphQL for Stash communication (endpoint: /graphql)
- **Styling**: Inline CSS with gradient backgrounds and blur effects
- **Extensions**: Manifest V3 for browser extensions, service workers for background tasks

## Dependencies & Libraries
Reference these external resources correctly:
- **CDN Libraries**: Use jsDelivr for performance libraries (cache-manager.js, performance-enhancer.js, etc.)
- **Userscript APIs**: Leverage GM_* functions for cross-domain requests and notifications
- **Browser APIs**: Use Performance API for timing, MutationObserver for DOM watching
- **No npm/node_modules**: Scripts are standalone without build process

## Common Commands
Use these commands for development:
```bash
# No build process - direct file editing
# Install in Tampermonkey and reload page to test

# For plugin deployment:
cp -r stash-plugin/ ~/.stash/plugins/automate-stash/

# For extension:
# Load unpacked in chrome://extensions/


```

## Project Conventions
Follow these patterns consistently:
- **Timing Constants**: Use STASH_CONFIG object for all delays (REACT_RENDER_DELAY: 800ms)
- **Element Detection**: Always provide multiple fallback selectors in arrays
- **Error Handling**: Wrap all async operations in try-catch with graceful fallbacks
- **State Management**: Use global flags (automationInProgress, automationCancelled)
- **GraphQL Queries**: Cache responses with LRU cache (TTL: 5 minutes default)
- **DOM Operations**: Batch with requestAnimationFrame for performance
- **Logging**: Use emoji prefixes for different operation types (🔍, ⚡, ✅, ❌)

## API Patterns
Implement GraphQL operations this way:
```javascript
// Always use the GraphQLClient class
const client = new GraphQLClient();
const result = await client.query(SCENE_DETAILS_QUERY, { id });

// Instrument fetch for mutation detection
if (isGraphQL && isMutation) {
    window.dispatchEvent(new CustomEvent('stash:graphql-mutation'));
}

// Wait after mutations
await sleep(STASH_CONFIG.GRAPHQL_MUTATION_DELAY);
```

## Element Interaction Patterns
Use these patterns for DOM manipulation:
```javascript
// Multi-strategy element detection
const selectors = [
    '.edit-panel button.btn-primary',
    'button.ml-2.btn.btn-primary', 
    'button[data-testid*="apply"]'
];
const element = await waitForElementAdvanced(selectors, 8000);

// React-aware interactions
element.scrollIntoView({ behavior: 'smooth', block: 'center' });
element.focus();
element.click();
```

## Performance Optimization
Apply these optimizations:
- Use debouncing for DOM observers (1-2 second delays)
- Implement LRU caching for GraphQL responses
- Batch DOM operations with DOMBatchProcessor
- Use lazy loading for optional components
- Monitor performance with PerformanceMonitor class
- Keep memory usage under 80MB with cleanup routines