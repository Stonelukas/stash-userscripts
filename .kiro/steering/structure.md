# Project Structure

## File Organization
```
AutomateStash-Suite/
├── AutomateStash.js              # Core automation userscript (3300+ lines)
├── StashBulkOperations.js        # Bulk editing and batch operations
├── StashQualityAnalyzer.js       # Video quality analysis and duplicate detection
├── StashPerformanceMonitor.js    # Database and system performance monitoring
├── StashPerformerManager.js      # Advanced performer management and statistics
├── StashCollectionOrganizer.js   # Smart organization and metadata analysis
├── StashExportImportTools.js     # Data portability and backup solutions
├── shared/
│   ├── utils.js                  # Shared utility functions
│   ├── stash-api.js             # Common Stash API integration
│   └── ui-components.js         # Reusable UI components
├── .github/
│   └── copilot-instructions.md   # Development guide and architecture docs
├── .git/                         # Git repository
└── .kiro/                        # Kiro IDE configuration
    ├── specs/                    # Feature specifications and implementation plans
    └── steering/                 # AI assistant steering rules
```

## Code Architecture Patterns

### Configuration System (Shared Across Tools)
- `CONFIG_KEYS`: Enumeration of all configuration options per tool
- `DEFAULT_CONFIG`: Default values with type information and validation
- `getConfig()` / `setConfig()`: Type-safe configuration access with migration support
- `ConfigManager`: Centralized configuration management with cross-tool coordination

### Core Classes (Common Architecture)
- `NotificationManager`: In-browser notification system with persistence and priority handling
- `UIManager`: Multi-state UI management (full panel, minimized, modal, embedded)
- `ProgressTracker`: Progress monitoring for long-running operations
- `ErrorHandler`: Centralized error handling with user-friendly messaging
- `DataManager`: Data persistence and caching with IndexedDB integration

### Tool-Specific Classes
- **AutomateStash**: `AutomationEngine`, `ScraperManager`, `MetadataProcessor`
- **Bulk Operations**: `BulkProcessor`, `SelectionManager`, `BatchValidator`
- **Quality Analyzer**: `QualityMetrics`, `DuplicateDetector`, `ReportGenerator`
- **Performance Monitor**: `PerformanceCollector`, `DatabaseAnalyzer`, `AlertManager`
- **Performer Manager**: `PerformerSearch`, `RelationshipMapper`, `StatisticsEngine`
- **Collection Organizer**: `OrganizationEngine`, `NamingStandardizer`, `HealthAnalyzer`
- **Export/Import**: `DataExporter`, `ImportProcessor`, `BackupManager`

### Global State Management
```javascript
// Shared state across tools
window.StashToolsState = {
  activeTools: new Set(),
  sharedConfig: {},
  notifications: [],
  performanceMetrics: {},
  bulkSelections: new Map()
};

// Tool-specific state
let automationCompleted = false;
let uiMinimized = false; 
let automationInProgress = false;
let automationCancelled = false;
let bulkOperationActive = false;
let qualityAnalysisRunning = false;
```

### Key Function Categories

#### Core Automation (AutomateStash)
- **Automation Control**: `startAutomation()`, `stopAutomation()`, `completeAutomation()`
- **Element Interaction**: `clickElementOptimized()`, `waitForElementAdvanced()`
- **Scraper Integration**: StashDB and ThePornDB specific logic
- **UI Management**: Panel creation, minimization, configuration dialogs

#### Bulk Operations
- **Selection Management**: `selectScenes()`, `bulkSelect()`, `clearSelection()`
- **Batch Processing**: `processBatch()`, `validateBatch()`, `rollbackBatch()`
- **Progress Tracking**: `updateProgress()`, `showBatchStatus()`, `logBatchResults()`

#### Quality Analysis
- **Metrics Collection**: `analyzeVideoQuality()`, `extractMetadata()`, `calculateScores()`
- **Duplicate Detection**: `generateFingerprints()`, `findDuplicates()`, `rankDuplicates()`
- **Reporting**: `generateQualityReport()`, `exportAnalysis()`, `scheduleAnalysis()`

#### Performance Monitoring
- **Data Collection**: `collectMetrics()`, `monitorDatabase()`, `trackResources()`
- **Analysis**: `analyzePerformance()`, `identifyBottlenecks()`, `generateRecommendations()`
- **Alerting**: `checkThresholds()`, `sendAlerts()`, `manageNotifications()`

### Stash Integration Constants
- `STASH_CONFIG`: React SPA timing and selector configurations
- `API_ENDPOINTS`: GraphQL endpoints and mutation definitions
- `UI_SELECTORS`: Bootstrap component selectors with fallbacks
- `TIMING_CONSTANTS`: Delays for React lifecycle and async operations

## Development Conventions

### Naming Patterns
- **Classes**: PascalCase (`NotificationManager`, `QualityAnalyzer`)
- **Constants**: SCREAMING_SNAKE_CASE (`CONFIG_KEYS`, `STASH_CONFIG`, `API_ENDPOINTS`)
- **Functions**: camelCase with descriptive names (`clickElementOptimized`, `analyzeVideoQuality`)
- **Global State**: camelCase with clear scope (`automationInProgress`, `bulkOperationActive`)
- **Tool Prefixes**: Tool-specific functions prefixed (`bulk_`, `quality_`, `perf_`)

### Error Handling Strategy
- Multiple fallback selectors for element detection across UI updates
- Timeout protection on all async operations with configurable limits
- Graceful degradation when external services fail
- User cancellation checks throughout long-running workflows
- Comprehensive error logging with context and recovery suggestions
- Cross-tool error coordination to prevent conflicts

### Async Patterns
- Consistent use of async/await with proper error handling
- Configurable delays for React lifecycle compatibility
- Element waiting with timeout protection and retry logic
- Mutation observation with debouncing and performance optimization
- Background processing for heavy operations with progress reporting
- Batch processing with memory management and interruption support

### Data Management Patterns
- **Validation**: Runtime type checking with schema validation
- **Caching**: Multi-layer caching with TTL and invalidation strategies
- **Persistence**: IndexedDB for large datasets, localStorage for configuration
- **Migration**: Version-aware data migration between tool updates
- **Backup**: Automated backup creation with integrity verification

## File Conventions
- **Modular Architecture**: Separate files per tool with shared utilities
- **Single File Deployment**: Each tool as self-contained userscript for easy installation
- **Shared Dependencies**: Common utilities imported or embedded as needed
- **Inline Documentation**: Extensive JSDoc comments explaining Stash integration points
- **Version Headers**: Greasemonkey metadata blocks with dependency tracking
- **Debug Logging**: Emoji-prefixed console logs with tool identification
- **Configuration Sections**: Clearly marked configuration blocks for user customization

## Cross-Tool Integration
- **Shared State**: Global state object for cross-tool communication
- **Event System**: Custom events for tool coordination and data sharing
- **UI Consistency**: Shared UI components and styling patterns
- **Configuration Sync**: Centralized configuration management with tool-specific overrides
- **Performance Coordination**: Shared performance monitoring to prevent resource conflicts