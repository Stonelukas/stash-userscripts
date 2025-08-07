# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a comprehensive Stash enhancement repository containing userscripts, a native Stash plugin, and a browser extension that automate and enhance Stash (a self-hosted adult content management system).

### Deployment Options (Updated: 2025-02-06)

#### 1. Userscripts (Greasemonkey/Tampermonkey)
- **AutomateStash Final v4.18.0**: `AutomateStash-Final.js` (1150+ lines) - Production-ready automation script with re-scrape functionality
- **Bulk Operations Manager v1.3.1**: `StashBulkOperations.js` (2800+ lines) - Advanced bulk scene management
- **Quality Analyzer v1.0.1**: `StashQualityAnalyzer.js` (1600+ lines) - Video quality assessment and duplicate detection
- **Performance Monitor v1.0.8**: `StashPerformanceMonitor.js` (2800+ lines) - Real-time performance monitoring and optimization
- **Performer Manager Pro v1.1.2**: `StashPerformerManager.js` (3600+ lines) - Enhanced performer search and relationship mapping
- **Collection Organizer v1.0.2**: `StashCollectionOrganizer.js` (2800+ lines) - Smart organization and metadata analysis
- **Export/Import Tools v1.0.0**: `StashExportImportTools.js` (2100+ lines) - Data portability and backup solutions
- **Legacy Version**: `AutomateStash.js` (4500+ lines) - Original complex implementation (reference only)

#### 2. Stash Plugin (Native Integration)
- **AutomateStash Plugin v4.5.0**: `stash-plugin/` - Native Stash plugin implementation
- Direct integration with Stash's plugin system
- No browser extension required
- Enhanced debugging capabilities with dedicated panel detection scripts

#### 3. Browser Extension (Chrome/Edge/Firefox)
- **Stash Suite Extension v1.0.0**: `stash-suite-extension/` - Full-featured browser extension
- Manifest V3 compatible
- Service worker architecture for background processing
- Comprehensive settings and popup UI

## Core Architecture

### Configuration System
- Uses Greasemonkey persistent storage (`GM_setValue`/`GM_getValue`) 
- Configuration keys defined in `CONFIG` object with defaults in `DEFAULTS`
- Runtime configuration changes via `getConfig(key)` and `setConfig(key, value)`
- **8 Configuration Options**:
  - Auto-scrape StashDB
  - Auto-scrape ThePornDB  
  - Auto-create new performers/studios/tags
  - Auto-organize scenes
  - Show notifications
  - Minimize UI when complete
  - Auto-apply changes (no confirmation)
  - Skip already scraped sources

### React SPA Integration 
- Designed for Stash's localhost:9998 React application
- Uses timing constants for React lifecycle: render delays, GraphQL mutation delays
- Multi-strategy element detection with fallback selectors for robustness
- DOM mutation observers with debouncing for SPA navigation handling

### Automation State Management
Global flags prevent race conditions:
```javascript
let automationInProgress = false;
let automationCancelled = false; 
let automationCompleted = false;
```

### Core Classes
- **UIManager**: Handles multi-state UI (full panel, minimized button, modals)
- **NotificationManager**: In-browser notifications with animations and persistence
- **ConfigurationDialog**: Advanced settings with validation and testing tools

### Core Automation Functions  
- `startAutomation()` - Main automation orchestrator
- `scrapeStashDB()` - StashDB scraper automation
- `scrapeThePornDB()` - ThePornDB scraper automation
- `createNewPerformers()` - Creates new performers/studios/tags from scraped data
- `applyScrapedData()` - Metadata application
- `organizeScene()` - Marks scenes as organized using button detection
- `saveScene()` - Scene saving with multiple button detection strategies
- `checkAlreadyScraped()` - Intelligent skip logic to avoid duplicate work
- `waitForPageRerender()` - Waits for UI updates after changes (reserved for future use)

## UI Architecture

**Multi-State Interface:**
- Full automation panel (`#stash-automation-panel`) with gradient styling and backdrop blur
- Minimized floating button (`#stash-minimized-button`) for completed states  
- Cancel button overlay during active automation
- Modal configuration dialog for user settings
- Status summary display (planned enhancement)

**Element Detection Patterns:**
Uses multiple fallback selectors for robustness across Stash UI updates:
```javascript
const applySelectors = [
  '.edit-panel button.btn-primary',           // Stash-specific
  'button.ml-2.btn.btn-primary',             // Bootstrap patterns  
  'button[data-testid*="apply"]'             // Test-id fallbacks
];
```

**Visual Design:**
- Gradient backgrounds with blur effects
- Smooth animations for all transitions
- Status indicators with color coding
- Emoji prefixes for clear status communication

## Stash-Specific Integration

**Target URLs:** `http://localhost:9998/scenes/*` (excludes markers and edit pages)

**Key UI Patterns:**
- Entity edit panels: `.entity-edit-panel`, `.scene-edit-form`
- React Router navigation: `a[data-rb-event-key="scene-edit-panel"]`
- Bootstrap dropdowns for scraper selection
- GraphQL mutation handling with configured delays

**Timing Constants:**
```javascript
const STASH_CONFIG = {
    REACT_RENDER_DELAY: 800,
    ELEMENT_WAIT_TIMEOUT: 8000,
    GRAPHQL_MUTATION_DELAY: 1000,
    SAVE_DELAY: 1500
};
```

## Installation & Deployment

### Option 1: Userscripts (Simplest)
1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/)
2. Open desired script (e.g., `AutomateStash-Final.js`)
3. Click "Install" when prompted
4. Navigate to Stash at `http://localhost:9998`

### Option 2: Stash Plugin (Native Integration)
1. Copy `stash-plugin/` folder to your Stash plugins directory
2. Restart Stash server
3. Enable "AutomateStash" in Settings → Plugins
4. No browser extension required

### Option 3: Browser Extension (Full Features)
1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `stash-suite-extension/` folder
5. Extension icon will appear in toolbar

## Development Workflow

### Userscript Development
**No Build Process:** Direct userscript development - edit JavaScript files and reload in browser

```bash
# No build commands - direct editing
# Install userscript in Greasemonkey/Tampermonkey
# Reload page to test changes
```

### Plugin Development
```bash
# Copy to Stash plugins directory
cp -r stash-plugin/ ~/.stash/plugins/

# Restart Stash to load plugin
# Check plugin UI at http://localhost:9998
```

### Extension Development
```bash
# Load unpacked extension in Chrome
# Make changes to source files
# Click "Reload" in chrome://extensions/
# Test at http://localhost:9998
```

**Testing Approach:**
- Test against running Stash instance on localhost:9998
- Verify React component interactions and SPA navigation
- Test cancellation and error recovery scenarios
- Use debug buttons in configuration dialog:
  - "🔄 Test Minimize" - Test minimize/expand cycle
  - "🔍 Check Context" - Validate UIManager context
  - "📋 Analyze Forms" - Debug form element detection

**Debugging Tools:**
- Built-in `debugElementsInArea()` for DOM inspection
- `debugListAllButtons()` for button detection analysis
- `debugListAllFormElements()` for comprehensive form analysis
- Confidence scoring system for scraper detection (0.0-1.0)
- Phase logging with emoji prefixes for automation progress tracking
- Plugin debug panel: `debug-edit-panel-enhanced.js`
- Extension DevTools: Service worker logs in browser console

## Integration Dependencies

- **Stash Server:** Requires running Stash instance on localhost:9998
- **Userscript Manager:** Greasemonkey or Tampermonkey for GM APIs
- **External Services:** StashDB (stashdb.org) and ThePornDB (metadataapi.net) scrapers

## Project Structure

```
/
├── AutomateStash.js              # Original complex implementation (4500+ lines)
├── AutomateStash-Clean.js        # Clean rewrite with working minimize button
├── AutomateStash-Final.js        # Current production version v4.4.0 (1150+ lines)
├── StashBulkOperations.js       # Bulk operations manager v1.3.1 (2800+ lines) ✅ COMPLETED
├── StashQualityAnalyzer.js      # Quality analyzer v1.0.1 (1600+ lines) ✅ COMPLETED
├── StashPerformanceMonitor.js   # Performance monitor v1.0.8 (2800+ lines) ✅ COMPLETED
├── StashPerformerManager.js     # Performer manager v1.1.2 (3600+ lines) ✅ COMPLETED
├── StashCollectionOrganizer.js  # Collection organizer v1.0.2 (2800+ lines) ✅ COMPLETED
├── StashExportImportTools.js    # Export/Import tools v1.0.0 (2100+ lines) ✅ COMPLETED
├── CLAUDE.md                     # This file
├── ROADMAP.md                    # Development roadmap and progress tracking
├── AGENTS.md                     # Agent architecture documentation
├── AUTOMATESTASH_DEVELOPMENT_PLAN.md # Comprehensive development plan
├── stash-plugin/                 # Native Stash plugin implementation
│   ├── automate-stash.yml        # Plugin manifest
│   ├── automate-stash.css        # Plugin styles
│   ├── automate-stash-enhanced.js # Main plugin script
│   ├── automate-stash-compact.js # Compact version
│   ├── debug-edit-panel.js      # Debug utilities
│   ├── INSTALLATION.md           # Plugin installation guide
│   ├── TROUBLESHOOTING.md        # Plugin troubleshooting
│   └── README.md                 # Plugin documentation
├── stash-suite-extension/        # Browser extension implementation
│   ├── manifest.json             # Extension manifest (V3)
│   ├── src/                      # Extension source code
│   │   ├── background/           # Service worker
│   │   ├── content/              # Content scripts
│   │   ├── common/               # Shared utilities
│   │   ├── popup/                # Extension popup
│   │   └── options/              # Settings page
│   ├── assets/                   # Styles and images
│   ├── icons/                    # Extension icons
│   └── README.md                 # Extension documentation
├── .github/                      # GitHub workflows
│   ├── workflows/
│   │   ├── claude.yml            # Claude PR Assistant
│   │   └── claude-code-review.yml # Code review workflow
│   └── copilot-instructions.md  # GitHub Copilot guide
└── .kiro/specs/                  # Feature specifications
    ├── fix-minimize-button/      # ✅ COMPLETED
    ├── enhanced-status-tracking/ # ✅ COMPLETED
    ├── stash-bulk-operations/    # ✅ COMPLETED
    ├── stash-quality-analyzer/   # ✅ COMPLETED
    ├── stash-performance-monitor/# ✅ COMPLETED
    ├── stash-performer-manager/  # ✅ COMPLETED
    ├── stash-collection-organizer/# ✅ COMPLETED
    └── stash-export-import-tools/# ✅ COMPLETED
```

## Critical Development Patterns

**Async Element Interaction:**
```javascript
async function clickElementOptimized(selectors, description, waitForMutation = false) {
  const element = await waitForElementAdvanced(selectors, 8000);
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.focus();
  element.click();
  if (waitForMutation) await sleep(STASH_CONFIG.GRAPHQL_MUTATION_DELAY);
}
```

**Error Resilience:**
- Strategy pattern with multiple fallback approaches
- Timeout protection on all element waiting
- Graceful degradation when scrapers fail
- User cancellation checks throughout async workflows

**Performance Optimizations:**
- Debounced DOM observers (1-2 second delays)
- React lifecycle awareness before element interaction
- Intelligent caching of scraper detection results

## Bulk Operations Manager (StashBulkOperations.js)

### Overview
A comprehensive bulk scene management tool that adds advanced batch processing capabilities to Stash.

### Core Architecture
- **SelectionManager**: Tracks selected scenes across page navigation
- **BulkUIManager**: Handles UI rendering, dialogs, and user interactions
- **BulkOperationsEngine**: Executes GraphQL mutations for bulk updates
- **GraphQLClient**: Handles all API communication with Stash server
- **ProgressTracker**: Visual progress monitoring for long operations

### Key Features
- **Scene Selection**: Checkboxes on scene cards with visual selection indicators
- **Bulk Tags**: Add/Remove/Clear modes with existing tag display
- **Bulk Performers**: Add/Remove/Clear modes with search functionality
- **Bulk Studios**: Single-select assignment with existing studio management
- **Bulk Metadata**: Rating, date, organized status, and details editing
- **View Details**: Inspect which scenes have specific tags/performers/studios
- **Navigation**: Back button support between different bulk operation dialogs

### Recent Bug Fixes (v1.3.1)
- Fixed back button navigation with proper dialog cleanup
- Fixed selection count not updating in toolbar
- Added proper method name resolution in callbacks

## Performance Monitor (StashPerformanceMonitor.js)

### Overview
A comprehensive performance monitoring tool that tracks database performance, system resources, scan progress, and provides optimization recommendations.

### Core Architecture
- **PerformanceMetricsCollector**: Real-time metrics collection from multiple sources
- **DatabasePerformanceAnalyzer**: Query performance tracking and optimization
- **ResourceMonitor**: System resource usage monitoring (CPU, memory, disk, network)
- **ScanProgressTracker**: Scan operation monitoring and performance analysis
- **OptimizationEngine**: Intelligent recommendations with prioritization
- **PerformanceDashboardUI**: Interactive dashboard with draggable interface

### Key Features
- **Real-time Metrics**: GraphQL query interception, browser performance API integration
- **Database Analysis**: Query timing, slow query detection, index usage analysis
- **Resource Monitoring**: CPU/memory/disk tracking, correlation with Stash operations
- **Scan Tracking**: Progress monitoring, throughput analysis, bottleneck detection
- **Optimization**: Prioritized recommendations, implementation guides, impact estimates
- **Historical Data**: Trend analysis, performance baselines, predictive modeling
- **Benchmarking**: Performance tests, baseline comparison, improvement tracking
- **Alerts**: Configurable thresholds, real-time notifications, context-aware warnings

### Implementation Details
- Uses browser Performance API for accurate timing measurements
- Intercepts XMLHttpRequest to monitor GraphQL queries
- Tracks resource usage with configurable sampling intervals
- Stores historical data in GM storage for trend analysis
- Provides draggable UI with real-time chart updates

## Common Issues and Solutions

### Organize Button Detection (AutomateStash)
**Problem:** Enhanced detection strategies cannot find organize checkbox
**Current Status:** Resolved - uses `button[title="Organized"]` selector
**Solution:** Simplified detection to match actual Stash HTML structure

### Save/Apply Button Issues (AutomateStash)
**Problem:** Buttons sometimes not found or disabled
**Solution:** Multiple fallback selectors with retry logic
**Debug:** Use `debugListAllButtons()` to analyze available buttons

### Selection Count Not Updating (Bulk Operations)
**Problem:** Toolbar count doesn't update when selecting/deselecting scenes
**Solution:** Added `updateToolbar()` call in selection change handler

## Development Guidelines

### Spec-Driven Development
- All features start with requirements in EARS format (see `.kiro/specs/`)
- Design documents specify architecture before implementation
- Task lists break features into coding activities
- Each task references specific requirements

### Code Style
- **Classes:** PascalCase (`UIManager`, `NotificationManager`)
- **Constants:** SCREAMING_SNAKE_CASE (`CONFIG_KEYS`, `STASH_CONFIG`)
- **Functions:** camelCase with descriptive names (`waitForElementAdvanced`)
- **Global State:** camelCase (`automationInProgress`)
- **Emoji Logging:** Use consistent emoji prefixes for different operations

### Testing Strategy
- Manual testing against live Stash instances
- Cross-browser compatibility (Chrome, Firefox, Edge)
- Error recovery and cancellation scenarios
- Large dataset performance testing

## Planned Enhancements

### Development Best Practices
- After every new Task completed update the ROADMAP.md file

### Recently Completed Enhancements

#### Bulk Operations Manager v1.3.1 ✅ COMPLETED
- Scene selection management with checkboxes
- Bulk tag management (Add/Remove/Clear modes)
- Bulk performer management (Add/Remove/Clear modes)
- Bulk studio assignment with search
- Bulk metadata editing (rating, date, organized, details)
- View Details functionality for tags/performers/studios
- Back button navigation between dialogs
- Fixed selection count updates in toolbar

#### Enhanced Status Tracking v4.3.3 ✅ COMPLETED
- Comprehensive scene status summary
- Source detection indicators (StashDB/ThePornDB)
- Persistent automation history
- GraphQL API integration
- Real-time status updates

## Quality Analyzer (StashQualityAnalyzer.js)

### Overview
A comprehensive video quality assessment tool that analyzes scenes for quality issues and detects duplicates.

### Core Architecture
- **QualityAnalyzer**: Main analysis engine with weighted scoring algorithm
- **DuplicateDetector**: Fingerprint-based duplicate detection system
- **QualityReportGenerator**: Creates detailed quality reports with export options
- **QualityUIManager**: Interactive UI with quality badges and filtering

### Key Features
- **Quality Scoring**: Multi-factor analysis (resolution, bitrate, codec, audio)
- **Duplicate Detection**: Composite fingerprinting with phash comparison
- **Quality Badges**: Visual indicators on scene cards
- **Bulk Analysis**: Process entire library with progress tracking
- **Quality Reports**: Comprehensive reports with export functionality
- **Configurable Thresholds**: Customizable quality standards

## Performer Manager Pro (StashPerformerManager.js)

### Overview
An advanced performer management tool with enhanced search, relationship mapping, and bulk operations.

### Core Architecture
- **PerformerSearchEngine**: Fuzzy search with relevance scoring
- **RelationshipMapper**: Collaboration analysis and visualization
- **BulkImageUploader**: Queue-based image upload system
- **PerformerDetailWidget**: Comprehensive performer view with tabs
- **DataValidator**: Quality assessment for performer data

### Key Features
- **Advanced Search**: Fuzzy matching with multi-criteria filtering
- **Duplicate Detection**: Levenshtein distance algorithm
- **Relationship Mapping**: Collaboration network visualization
- **Bulk Operations**: Image uploads, data exports
- **Detailed Analytics**: Scene statistics, career analysis
- **Data Quality**: Completeness scoring and validation

## Collection Organizer (StashCollectionOrganizer.js)

### Overview
Smart organization tool that analyzes and reorganizes your collection based on patterns and preferences.

### Core Architecture
- **PatternAnalysisEngine**: Detects organization patterns
- **FileOrganizationSystem**: Executes reorganization plans
- **NamingConventionEngine**: Standardizes file naming
- **MetadataCompletenessAnalyzer**: Gap detection and reporting
- **OrganizationPreferencesDetector**: Infers user preferences

### Key Features
- **Pattern Detection**: Identifies existing organization schemes
- **Metadata Analysis**: Completeness scoring and gap identification
- **Organization Plans**: Before/after previews with validation
- **Naming Standardization**: Template-based file renaming
- **Safe Execution**: Rollback support and progress tracking
- **Health Monitoring**: Collection health metrics and trends

## Export/Import Tools (StashExportImportTools.js)

### Overview
Comprehensive data portability solution for backing up, migrating, and synchronizing Stash data.

### Core Architecture
- **ExportEngine**: Multi-format export with privacy controls
- **ImportEngine**: Schema mapping for external formats
- **BackupManager**: Compression and encryption support
- **FormatAdapters**: Pluggable adapters for JSON, CSV, XML
- **MigrationController**: Instance-to-instance transfers (future)

### Key Features
- **Multi-Format Export**: JSON, CSV, XML with field selection
- **External Import**: Support for Plex, Jellyfin, Kodi formats
- **Backup/Restore**: Complete backups with selective restore
- **Privacy Controls**: Data anonymization and exclusion
- **Progress Tracking**: Real-time operation monitoring
- **Data Validation**: Import preview and conflict resolution

## Recent Updates (2025-02-06)

### AutomateStash v4.18.0 - Re-scrape Functionality
- ✅ **Re-scrape UI** - Dynamic interface shows when sources already scraped
- ✅ **Force Re-scrape** - Bypass skip logic with checkbox selections
- ✅ **Selective Scraping** - Choose specific sources (StashDB/ThePornDB) to re-scrape
- ✅ **Auto Detection** - Automatically detects which sources have been scraped
- ✅ **State Management** - Re-scrape options reset after automation completes

### AutomateStash v4.17.1 - Thumbnail Resolution Comparison
- ✅ **Resolution Detection** - Compares current vs scraped thumbnail resolutions
- ✅ **Smart Updates** - Only updates if scraped thumbnail has higher resolution
- ✅ **UI Feedback** - Shows improvement percentage in confirmation dialog
- ✅ **Conditional Check** - Only compares when sources already scraped
- ✅ **Configuration Option** - PREFER_HIGHER_RES_THUMBNAILS setting

### Major Additions
- ✅ **Stash Plugin Implementation** - Native plugin with direct Stash integration
- ✅ **Browser Extension** - Full-featured Manifest V3 extension with service worker
- ✅ **GitHub Actions** - Automated PR assistance and code review workflows
- ✅ **Enhanced Documentation** - Comprehensive installation and troubleshooting guides

### Plugin Features (stash-plugin/)
- Direct integration with Stash's plugin system
- Multiple script variants (enhanced, compact, bypass)
- Dedicated debugging utilities for edit panel detection
- CSS styling integration for improved UI
- YAML manifest configuration

### Extension Features (stash-suite-extension/)
- Manifest V3 compatible with service worker architecture
- Modular content scripts for all automation tools
- GraphQL client with intelligent request handling
- Settings sync across browser instances
- Popup interface for quick access to features
- Options page for comprehensive configuration

### Previous Updates (2025-01-30)
- ✅ **All 6 Advanced Management Tools** completed and tested
- ✅ **Enhanced Status Tracking** (v4.3.3) - GraphQL integration for accurate source detection
- ✅ **Global Widget Availability** (v4.4.0) - Widget accessible throughout entire Stash application
- ✅ **Performance Monitor** enhanced to v1.0.8 with full feature implementation
- ✅ **Performer Manager** enhanced to v1.1.2 with detail widget and relationship mapping
- ✅ **Collection Organizer** v1.0.2 with metadata completeness analysis
- ✅ **Export/Import Tools** v1.0.0 newly implemented with comprehensive data portability

### Key Improvements
- Fixed organize button detection using simplified `button[title="Organized"]` selector
- Implemented automatic performer/studio/tag creation with proper timing
- Consolidated UI/UX with single settings location
- Added comprehensive spec-driven development process
- All tools now follow consistent architecture patterns
- Added three deployment options: userscripts, plugin, and extension

### Breaking Changes
- None - all updates maintain backward compatibility
- Plugin and extension are optional alternatives to userscripts

## Development Best Practices

### New Guidelines
- **Spec-Driven Development**: All features now start with `.kiro/specs/` requirements
- **ROADMAP Updates**: Update ROADMAP.md after completing each task
- **GraphQL Compatibility**: Always check Stash GraphQL schema for field names
- **Error Handling**: Implement comprehensive error recovery in all tools
- **Performance**: Use chunked processing for large datasets
- **UI Consistency**: Follow established gradient/dark theme patterns