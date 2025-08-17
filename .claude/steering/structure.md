# Structure Steering Rules

## Directory Organization
Navigate the codebase using this structure:
```
stash-userscripts/
├── scripts/                      # All userscripts and libraries
│   ├── AutomateStash-Final-GitHub.user.js  # Core automation script (main)
│   ├── Stash*.js                 # Feature-specific tools
│   ├── lib/                      # Reusable performance libraries
│   │   ├── cache-manager.js     # LRU caching system
│   │   ├── performance-enhancer.js # Performance monitoring
│   │   └── ui-theme-manager.js  # Theme management
│   └── config/                   # Configuration modules
├── stash-plugin/                 # Native Stash plugin version
│   ├── automate-stash.yml        # Plugin manifest
│   └── automate-stash-enhanced.js # Main plugin script
├── stash-suite-extension/        # Browser extension version
│   ├── manifest.json             # Extension manifest V3
│   └── src/                      # Extension source code
├── docs/                         # Documentation
└── .claude/                      # AI assistant guidance
```

## File Naming Patterns
Use these naming conventions:
- **Userscripts**: `Stash{Feature}.js` (e.g., StashBulkOperations.js)
- **Enhanced versions**: `{name}-Enhanced.js` or `{name}-CDN.user.js`
- **Libraries**: Lowercase with hyphens in `lib/` (e.g., cache-manager.js)
- **Config files**: `{purpose}-config.js` in `config/`
- **Debug scripts**: `debug-{component}.js`

## Component Architecture
Organize code using these patterns:

### Class Structure
```javascript
// Each major feature is a class
class UIManager { }           // UI management
class GraphQLClient { }        // API communication
class NotificationManager { }  // User notifications
class ConfigurationDialog { }  // Settings management
class StatusTracker { }        // State tracking
```

### Module Organization
- **Core Automation**: `AutomateStash-Final.js` contains main workflow
- **Feature Tools**: Each `Stash*.js` file is standalone with its own classes
- **Shared Libraries**: `lib/` folder contains reusable utilities
- **Configuration**: `config/` folder for settings and constants

## Key File Locations
Find important files here:
- **Main script**: `scripts/AutomateStash-Final.js` - Core automation logic
- **GraphQL client**: Look for `GraphQLClient` class in main scripts
- **UI components**: `UIManager` class handles all UI creation
- **Configuration**: `CONFIG` and `DEFAULTS` objects at top of scripts
- **Performance libs**: `scripts/lib/performance-enhancer.js` for monitoring
- **Cache system**: `scripts/lib/cache-manager.js` for LRU caching
- **Documentation**: `CLAUDE.md` for AI guidance, `README.md` for users

## Import Patterns
Include dependencies this way:
```javascript
// Userscripts use @require headers
// @require https://cdn.jsdelivr.net/gh/user/repo@main/scripts/lib/file.js

// No ES6 imports - everything is global or wrapped in IIFE
(function() {
    'use strict';
    // Code here
})();
```

## Configuration Storage
Access configuration using these patterns:
```javascript
// Read config
const value = getConfig(CONFIG.AUTO_SCRAPE_STASHDB);

// Write config  
setConfig(CONFIG.AUTO_SCRAPE_STASHDB, true);

// Config keys are in CONFIG object
// Defaults are in DEFAULTS object
```

## State Management
Track state using these globals:
```javascript
let automationInProgress = false;  // Main automation running
let automationCancelled = false;   // User cancelled
let automationCompleted = false;   // Automation finished
let uiManager = null;              // UI instance
let statusTracker = null;          // Status tracking instance
```