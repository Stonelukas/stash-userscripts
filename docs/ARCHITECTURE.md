# AutomateStash Suite - Architecture Documentation

## System Overview

The AutomateStash Suite is a multi-layered automation framework for Stash, designed with modularity, extensibility, and performance in mind. The architecture supports three deployment models while maintaining a consistent API and user experience.

## Architecture Principles

### Core Design Principles
- **Separation of Concerns**: Each component has a single, well-defined responsibility
- **Dependency Injection**: Components receive dependencies rather than creating them
- **Event-Driven Architecture**: Loose coupling through event emitters and observers
- **Progressive Enhancement**: Basic functionality works everywhere, advanced features when available
- **Fail-Safe Design**: Graceful degradation when components or services are unavailable

### Performance Principles
- **Lazy Loading**: Components load only when needed
- **Debouncing**: DOM operations and API calls are debounced to prevent flooding
- **Caching**: Aggressive caching of API responses and computed values
- **Batch Processing**: Operations are batched when possible to reduce overhead

## Deployment Architecture

### 1. Userscript Architecture
```
┌─────────────────────────────────────────┐
│           Browser (Tampermonkey)         │
├─────────────────────────────────────────┤
│         AutomateStash-Final.js          │
├──────────┬──────────┬───────────────────┤
│ UIManager│ GraphQL  │ NotificationMgr   │
├──────────┼──────────┼───────────────────┤
│          │   Stash  │                   │
│   DOM    │   API    │  Browser Storage  │
└──────────┴──────────┴───────────────────┘
```

### 2. Plugin Architecture
```
┌─────────────────────────────────────────┐
│            Stash Server                 │
├─────────────────────────────────────────┤
│         Plugin System (YAML)            │
├─────────────────────────────────────────┤
│      automate-stash-enhanced.js        │
├──────────┬──────────┬───────────────────┤
│  Direct  │  Native  │   Plugin          │
│   DOM    │   API    │   Storage         │
└──────────┴──────────┴───────────────────┘
```

### 3. Extension Architecture
```
┌─────────────────────────────────────────┐
│         Browser Extension               │
├─────────────────────────────────────────┤
│         Service Worker (V3)             │
├──────────┬──────────┬───────────────────┤
│  Content │  Popup   │   Options         │
│  Scripts │   UI     │    Page           │
├──────────┼──────────┼───────────────────┤
│   DOM    │ Storage  │   Chrome API      │
└──────────┴──────────┴───────────────────┘
```

## Core Components

### UIManager
Manages all user interface elements and interactions.

```javascript
class UIManager {
    constructor(statusTracker, notifications) {
        this.statusTracker = statusTracker;
        this.notifications = notifications;
        this.panel = null;
        this.minimizedButton = null;
        this.widgetContainer = null;
    }
    
    // Key Methods:
    createPanel()           // Creates main automation panel
    createMinimizedButton() // Creates floating button
    minimize()              // Minimizes to button
    expand()                // Expands from button
    showConfigDialog()      // Shows settings modal
    updateStatusDisplay()   // Updates status indicators
}
```

### GraphQLClient
Handles all communication with Stash's GraphQL API.

```javascript
class GraphQLClient {
    constructor() {
        this.endpoint = `${getConfig(CONFIG.STASH_ADDRESS)}/graphql`;
        this.headers = this.buildHeaders();
    }
    
    // Key Methods:
    query(query, variables)     // Execute GraphQL query
    mutation(mutation, vars)    // Execute GraphQL mutation
    getSceneDetails(id)         // Fetch scene metadata
    updateScene(id, input)      // Update scene data
    findPerformer(name)         // Search for performer
    createPerformer(input)      // Create new performer
}
```

### StatusTracker
Tracks and manages scene processing status.

```javascript
class StatusTracker {
    constructor(graphqlClient) {
        this.client = graphqlClient;
        this.currentStatus = {};
        this.history = [];
    }
    
    // Key Methods:
    detectCurrentStatus()       // Analyze current scene
    updateStatus(field, value)  // Update status field
    saveHistory()               // Persist to storage
    getSourceIndicators()       // Get scraper status
}
```

### NotificationManager
Provides user feedback through notifications.

```javascript
class NotificationManager {
    constructor() {
        this.container = this.createContainer();
        this.notifications = [];
    }
    
    // Key Methods:
    show(message, type)         // Display notification
    clear()                     // Clear all notifications
    clearOldNotifications()     // Auto-cleanup old ones
}
```

## Design Patterns

### 1. Command Pattern
Used for automation workflow execution.

```javascript
class AutomationCommand {
    constructor(receiver) {
        this.receiver = receiver;
    }
    
    async execute() {
        // Implementation specific to command
    }
    
    async undo() {
        // Rollback implementation
    }
}

// Usage
const scrapeCommand = new ScrapeStashDBCommand(scene);
await scrapeCommand.execute();
```

### 2. Observer Pattern
Used for status updates and event handling.

```javascript
class EventEmitter {
    constructor() {
        this.events = {};
    }
    
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }
    
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(listener => listener(data));
        }
    }
}
```

### 3. Strategy Pattern
Used for different scraping strategies.

```javascript
class ScrapingStrategy {
    async scrape(scene) {
        throw new Error('Must implement scrape method');
    }
}

class StashDBStrategy extends ScrapingStrategy {
    async scrape(scene) {
        // StashDB-specific scraping logic
    }
}

class ThePornDBStrategy extends ScrapingStrategy {
    async scrape(scene) {
        // ThePornDB-specific scraping logic
    }
}
```

### 4. Factory Pattern
Used for creating UI components.

```javascript
class UIComponentFactory {
    static createButton(config) {
        const button = document.createElement('button');
        Object.assign(button.style, config.styles);
        button.textContent = config.text;
        button.onclick = config.onClick;
        return button;
    }
    
    static createPanel(config) {
        // Panel creation logic
    }
}
```

### 5. Facade Pattern
Simplifies complex subsystem interactions.

```javascript
class AutomationFacade {
    constructor() {
        this.ui = new UIManager();
        this.graphql = new GraphQLClient();
        this.status = new StatusTracker();
    }
    
    async startAutomation() {
        // Coordinates multiple subsystems
        await this.status.detectCurrentStatus();
        this.ui.updateStatusDisplay();
        // ... more coordination
    }
}
```

## Data Flow

### Automation Workflow
```
User Action → UIManager → AutomationEngine
                ↓              ↓
          StatusTracker → GraphQLClient
                ↓              ↓
          Notifications ← Stash API
                ↓
          UI Update ← Storage
```

### Status Detection Flow
```
Scene Load → GraphQLClient.getSceneDetails()
                ↓
          StatusTracker.detectCurrentStatus()
                ↓
          Parse metadata (urls, stash_ids)
                ↓
          Determine scraped sources
                ↓
          UIManager.updateStatusDisplay()
```

## State Management

### Global State
```javascript
// Automation state flags
let automationInProgress = false;
let automationCancelled = false;
let automationCompleted = false;

// Configuration state
const CONFIG = {
    AUTO_SCRAPE_STASHDB: 'auto_scrape_stashdb',
    AUTO_SCRAPE_THEPORNDB: 'auto_scrape_theporndb',
    // ... more config keys
};

// Runtime state
let currentSceneId = null;
let processingQueue = [];
```

### Persistent State
Uses Greasemonkey's GM_setValue/GM_getValue for persistence:
```javascript
// Save state
GM_setValue('automation_history', JSON.stringify(history));

// Load state
const history = JSON.parse(GM_getValue('automation_history', '[]'));
```

## Performance Architecture

### Timing Constants
```javascript
const TIMING = {
    REACT_RENDER_DELAY: 800,      // Wait for React render
    ELEMENT_WAIT_TIMEOUT: 8000,   // Max wait for elements
    GRAPHQL_MUTATION_DELAY: 1000, // Post-mutation delay
    SAVE_DELAY: 1500,              // Post-save delay
    DEBOUNCE_DELAY: 300            // Input debounce
};
```

### Memory Management
- DOM references are cleaned up in `cleanup()` methods
- Event listeners are removed when components unmount
- Large data structures are paginated
- Circular references are avoided

### Optimization Strategies
1. **Lazy Component Loading**: UI components created on-demand
2. **Virtual Scrolling**: Large lists use virtual scrolling
3. **Request Batching**: Multiple API calls combined
4. **Intelligent Caching**: API responses cached with TTL
5. **Debounced Updates**: UI updates batched and debounced

## Security Architecture

### API Security
- API keys stored in GM storage (encrypted by browser)
- CORS handled by userscript permissions
- XSS prevention through proper DOM manipulation
- No eval() or innerHTML with user data

### Data Privacy
- No external telemetry
- All data stored locally
- Sensitive data can be excluded from exports
- No third-party analytics

## Extension Points

### Custom Scrapers
```javascript
class CustomScraper {
    constructor(name, config) {
        this.name = name;
        this.config = config;
    }
    
    async scrape(scene) {
        // Custom scraping logic
    }
    
    async validate(data) {
        // Validation logic
    }
}

// Register custom scraper
ScraperRegistry.register(new CustomScraper('MyScraper', config));
```

### UI Themes
```javascript
const customTheme = {
    colors: {
        primary: '#custom-color',
        secondary: '#another-color'
    },
    gradients: {
        panel: 'linear-gradient(...)'
    }
};

UIManager.applyTheme(customTheme);
```

### Plugin Hooks
```javascript
// Before automation starts
AutomationHooks.register('beforeStart', async (context) => {
    // Custom logic
});

// After automation completes
AutomationHooks.register('afterComplete', async (results) => {
    // Custom logic
});
```

## Testing Architecture

### Unit Testing Strategy
```javascript
// Component testing
describe('UIManager', () => {
    it('should create panel', () => {
        const ui = new UIManager();
        const panel = ui.createPanel();
        expect(panel).toBeDefined();
        expect(panel.id).toBe('stash-automation-panel');
    });
});
```

### Integration Testing
```javascript
// API integration testing
describe('GraphQLClient', () => {
    it('should fetch scene details', async () => {
        const client = new GraphQLClient();
        const scene = await client.getSceneDetails('123');
        expect(scene).toHaveProperty('title');
    });
});
```

### E2E Testing
```javascript
// Full workflow testing
describe('Automation Workflow', () => {
    it('should complete full automation', async () => {
        // Navigate to scene
        // Start automation
        // Verify results
    });
});
```

## Monitoring & Observability

### Performance Metrics
```javascript
class PerformanceMonitor {
    static measure(name, fn) {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        
        this.metrics.push({
            name,
            duration,
            timestamp: Date.now()
        });
        
        return result;
    }
}
```

### Error Tracking
```javascript
window.addEventListener('error', (event) => {
    ErrorReporter.report({
        message: event.message,
        source: event.filename,
        line: event.lineno,
        stack: event.error?.stack
    });
});
```

### Debug Mode
```javascript
const DEBUG = GM_getValue('debug_mode', false);

function debug(...args) {
    if (DEBUG) {
        console.log('[AutomateStash]', ...args);
    }
}
```

## Migration & Compatibility

### Version Migration
```javascript
class MigrationManager {
    static migrate() {
        const version = GM_getValue('version', '0.0.0');
        
        if (version < '4.0.0') {
            this.migrateV3ToV4();
        }
        
        if (version < '4.19.0') {
            this.migrateV4ToV419();
        }
        
        GM_setValue('version', CURRENT_VERSION);
    }
}
```

### Browser Compatibility
```javascript
// Feature detection
const features = {
    broadcastChannel: 'BroadcastChannel' in window,
    intersectionObserver: 'IntersectionObserver' in window,
    mutationObserver: 'MutationObserver' in window
};

// Polyfills loaded conditionally
if (!features.broadcastChannel) {
    loadPolyfill('broadcast-channel');
}
```

## Future Architecture Considerations

### Planned Enhancements
1. **WebSocket Support**: Real-time updates from Stash
2. **Worker Threads**: Offload heavy processing
3. **IndexedDB**: Better local storage for large datasets
4. **WebAssembly**: Performance-critical operations
5. **Module Federation**: Dynamic plugin loading

### Scalability Considerations
- Microservices architecture for cloud deployment
- Message queue for background processing
- Distributed caching layer
- Horizontal scaling capabilities
- Load balancing strategies

---

This architecture provides a robust foundation for the AutomateStash Suite, enabling reliable automation, easy maintenance, and future extensibility.