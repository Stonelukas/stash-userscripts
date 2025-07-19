# Technology Stack

## Core Technologies
- **JavaScript ES6+**: Modern JavaScript with async/await patterns, Promises, and advanced array methods
- **Greasemonkey/Tampermonkey APIs**: For persistent storage, cross-origin requests, and browser integration
- **DOM Manipulation**: Direct DOM interaction with React SPA considerations and virtual DOM awareness
- **CSS-in-JS**: Inline styling for userscript portability with dynamic theming support
- **Web APIs**: Intersection Observer, Mutation Observer, File API, and Blob handling

## Architecture Patterns
- **Configuration Management**: Persistent key-value storage with type-safe defaults and validation
- **State Management**: Global flags for automation phases, UI states, and cross-tool coordination
- **Observer Pattern**: DOM mutation observers for React SPA navigation and content changes
- **Strategy Pattern**: Multiple fallback selectors for robust element detection across UI updates
- **Factory Pattern**: Dynamic UI component creation with consistent styling and behavior
- **Singleton Pattern**: Shared managers for notifications, performance monitoring, and data export
- **Command Pattern**: Bulk operations with undo/redo capabilities and progress tracking

## Integration Points
- **React SPA Integration**: Timing constants tuned for React lifecycle and component mounting
- **GraphQL Mutations**: Handles Stash's asynchronous backend operations with retry logic
- **Bootstrap UI Components**: Extensive use of Bootstrap patterns for consistent UI interaction
- **External APIs**: StashDB, ThePornDB metadata scraping with rate limiting and caching
- **Stash API**: Direct integration with Stash's GraphQL API for bulk operations and data export
- **Browser Storage**: IndexedDB for large datasets, localStorage for configuration persistence

## Performance Optimizations
- **Debounced Observers**: 1-2 second debouncing for DOM mutations with adaptive timing
- **React Lifecycle Awareness**: Waits for component render cycles and state updates
- **Intelligent Caching**: Multi-layer caching for scraper results, quality analysis, and performance metrics
- **Configurable Delays**: Tunable timing for different operation types and system loads
- **Batch Processing**: Efficient bulk operations with progress tracking and memory management
- **Lazy Loading**: On-demand loading of heavy components and data analysis modules
- **Worker Threads**: Background processing for quality analysis and data export operations

## Data Management
- **Schema Validation**: Type-safe data structures with runtime validation
- **Migration Support**: Version-aware configuration and data migration between tool versions
- **Backup Integration**: Automated backup creation with integrity verification
- **Export Formats**: JSON, CSV, XML support with customizable field selection
- **Compression**: Efficient data compression for exports and backups

## Development Environment
- **No Build System**: Direct JavaScript development with modular organization
- **Browser Extension Required**: Greasemonkey or Tampermonkey with specific API requirements
- **Local Stash Instance**: Development against localhost:9998 with production compatibility
- **No Package Manager**: Self-contained userscripts with shared utility functions
- **Development Tools**: Console logging with emoji prefixes, performance profiling, and debug modes

## Testing Approach
- **Manual Testing**: Against live Stash instances with various content types and sizes
- **SPA Navigation Testing**: Across scene transitions, bulk operations, and tool switching
- **Error Recovery Testing**: Cancellation scenarios, network failures, and data corruption
- **Multi-tab Testing**: Independent tool operation per browser tab with shared state management
- **Performance Testing**: Large dataset handling, memory usage monitoring, and optimization validation
- **Cross-browser Testing**: Chrome, Firefox, Edge compatibility with extension differences