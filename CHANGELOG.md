# Changelog

All notable changes to the AutomateStash Suite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.19.1] - 2025-02-07

### Changed
- Made script production-ready by removing all debug functionality
- Removed 266 console.log statements for cleaner production code
- Removed debugDOMStructure function and test button handlers
- Cleaned up development artifacts from settings widget

### Removed
- ScrapingQueueManager class (Task 1: Background/Parallel Scene Scraping)
- All background processing functionality
- Debug buttons and testing utilities from configuration dialog

## [4.19.0] - 2025-02-07

### Added
- ScrapingQueueManager for cross-tab coordination (later removed)
- Background processing configuration options (later removed)
- Page Visibility API integration (later removed)

### Note
This version was immediately superseded by 4.19.1 with feature removal

## [4.18.0] - 2025-02-06

### Added
- Re-scrape functionality with dynamic UI
- Selective source re-scraping (StashDB/ThePornDB)
- Force re-scrape checkbox selections
- Auto-detection of already scraped sources
- State management for re-scrape options

## [4.17.1] - 2025-02-06

### Added
- Thumbnail resolution comparison feature
- Smart thumbnail updates based on resolution
- UI feedback showing improvement percentage
- PREFER_HIGHER_RES_THUMBNAILS configuration option

### Changed
- Only updates thumbnails if scraped version has higher resolution
- Conditional checks only when sources already scraped

## [4.17.0] - 2025-02-05

### Added
- Native Stash plugin implementation in `stash-plugin/` directory
- Browser extension with Manifest V3 in `stash-suite-extension/`
- GitHub Actions workflows for PR assistance and code review
- Enhanced documentation with installation and troubleshooting guides

## [4.16.0] - 2025-01-30

### Added
- StashExportImportTools.js v1.0.0 - Data portability solution
- Multi-format export (JSON, CSV, XML)
- External format import support (Plex, Jellyfin, Kodi)
- Backup and restore functionality
- Privacy controls and data anonymization

## [4.15.0] - 2025-01-29

### Added
- StashCollectionOrganizer.js v1.0.2
- Pattern analysis engine for organization detection
- Metadata completeness analyzer
- Organization plan preview with validation
- Naming convention standardization
- Collection health monitoring

## [4.14.0] - 2025-01-28

### Added
- StashPerformerManager.js v1.1.2
- Enhanced performer search with fuzzy matching
- Relationship mapping and collaboration analysis
- Bulk image upload system
- Performer detail widget with tabs
- Data quality validation

## [4.13.0] - 2025-01-27

### Added
- StashPerformanceMonitor.js v1.0.8
- Real-time performance metrics collection
- Database query performance tracking
- System resource monitoring
- Scan operation progress tracking
- Optimization recommendations with prioritization

## [4.12.0] - 2025-01-26

### Added
- StashQualityAnalyzer.js v1.0.1
- Multi-factor video quality scoring
- Duplicate detection with fingerprinting
- Quality badges on scene cards
- Comprehensive quality reports
- Configurable quality thresholds

## [4.11.0] - 2025-01-25

### Added
- StashBulkOperations.js v1.3.1
- Scene selection management with checkboxes
- Bulk tag management (Add/Remove/Clear)
- Bulk performer management
- Bulk studio assignment
- Bulk metadata editing
- View Details functionality

### Fixed
- Back button navigation in bulk operations
- Selection count updates in toolbar

## [4.4.0] - 2025-01-24

### Added
- Global widget availability throughout Stash application
- Widget persistence across navigation
- Enhanced status tracking v4.3.3

### Changed
- Widget no longer limited to scene pages
- Improved GraphQL integration for status detection

## [4.3.3] - 2025-01-23

### Added
- Enhanced status tracking with GraphQL integration
- Comprehensive scene status summary
- Source detection indicators (StashDB/ThePornDB)
- Persistent automation history
- Real-time status updates in widget

## [4.3.0] - 2025-01-20

### Added
- Status tracking system foundation
- Basic source detection
- Initial widget implementation

## [4.2.0] - 2025-01-15

### Changed
- Simplified organize button detection
- Fixed settings button functionality
- Improved error handling

### Fixed
- Organize button using `button[title="Organized"]` selector
- Settings dialog widget reference error

## [4.1.0] - 2025-01-10

### Added
- Automatic performer/studio/tag creation
- Improved timing for React lifecycle
- Consolidated settings location

## [4.0.0] - 2025-01-01

### Added
- Complete rewrite with clean architecture
- UIManager class for UI handling
- NotificationManager for user feedback
- GraphQLClient for API communication
- StatusTracker for scene status

### Changed
- Modular class-based architecture
- Improved error handling
- Better separation of concerns

### Removed
- Legacy monolithic code structure
- Inline styles (moved to classes)

## [3.0.0] - 2024-12-15

### Added
- Multi-source scraping support
- Skip logic for already scraped sources
- Configuration persistence
- Minimize/expand UI functionality

## [2.0.0] - 2024-11-01

### Added
- ThePornDB scraper support
- Settings dialog
- Notification system

### Changed
- Improved element detection
- Better error recovery

## [1.0.0] - 2024-10-01

### Added
- Initial release
- Basic StashDB scraping
- Auto-organization functionality
- Simple UI panel

## Future Roadmap

### Planned Features
- [ ] WebSocket support for real-time updates
- [ ] Worker threads for heavy processing
- [ ] IndexedDB for better local storage
- [ ] Automated testing framework
- [ ] Cloud sync capabilities

### Under Consideration
- [ ] Multi-language support
- [ ] Theme customization
- [ ] Plugin marketplace
- [ ] Mobile app companion
- [ ] Batch processing queue

## Version Compatibility Matrix

| Script Version | Stash Version | Browser Support |
|---------------|--------------|-----------------|
| 4.19.x | 0.17.0+ | Chrome 90+, Firefox 88+, Edge 90+ |
| 4.0.x - 4.18.x | 0.16.0+ | Chrome 88+, Firefox 85+, Edge 88+ |
| 3.x.x | 0.15.0+ | Chrome 85+, Firefox 80+, Edge 85+ |
| 2.x.x | 0.14.0+ | Chrome 80+, Firefox 75+, Edge 80+ |
| 1.x.x | 0.13.0+ | Chrome 75+, Firefox 70+, Edge 75+ |

## Migration Guides

### From 3.x to 4.x
1. Backup your settings (exported via settings dialog)
2. Uninstall old version
3. Install new version
4. Import settings
5. Verify scrapers are configured

### From 2.x to 3.x
- Settings format changed - manual reconfiguration required
- New skip logic requires no action
- UI changes are automatic

### From 1.x to 2.x
- Complete reinstall required
- Manual settings migration
- New scraper configuration needed

## Known Issues

### Current Issues (4.19.1)
- None reported

### Resolved Issues
- ✅ Settings button not working (Fixed in 4.2.0)
- ✅ Organize button detection (Fixed in 4.2.0)
- ✅ Selection count not updating (Fixed in 4.11.0)
- ✅ Background processing tab focus (Removed in 4.19.1)

---

For detailed documentation, see [README.md](README.md)
For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md)