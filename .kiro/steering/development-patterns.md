# Development Patterns and Best Practices

## Spec-Driven Development Workflow

### Requirements Format (EARS)
All requirements follow the Easy Approach to Requirements Syntax:
- **WHEN** [event/condition] **THEN** [system] **SHALL** [response]
- **IF** [precondition] **THEN** [system] **SHALL** [response]
- Each requirement includes user stories: "As a [role], I want [feature], so that [benefit]"
- Requirements are hierarchically numbered with acceptance criteria

### Design Document Structure
- **Overview**: High-level feature description and goals
- **Architecture**: System design and component relationships
- **Components and Interfaces**: Detailed component specifications
- **Data Models**: Data structures and validation requirements
- **Error Handling**: Exception scenarios and recovery strategies
- **Testing Strategy**: Validation approach and test requirements

### Implementation Planning
- Tasks focus exclusively on coding activities (writing, modifying, testing code)
- Each task references specific requirements from the requirements document
- Tasks build incrementally with no orphaned code
- Test-driven development approach prioritized
- Maximum two levels of hierarchy (main tasks and sub-tasks)

## Common Feature Patterns

### User Interface Patterns
- **Multi-state UI**: Full panel, minimized button, modal dialogs
- **Progress Tracking**: Real-time progress bars with estimated completion times
- **Bulk Selection**: Checkbox-based selection with "Select All" functionality
- **Configuration Dialogs**: Modal interfaces for settings with validation
- **Notification System**: In-browser notifications with persistence tracking
- **Responsive Design**: Bootstrap-compatible styling with mobile considerations

### Data Processing Patterns
- **Batch Operations**: Process multiple items with progress tracking and error handling
- **Background Processing**: Long-running operations with user cancellation support
- **Caching Strategies**: Multi-layer caching with TTL and intelligent invalidation
- **Data Validation**: Runtime type checking with schema validation
- **Export/Import**: Multiple format support (JSON, CSV, XML) with field selection

### Integration Patterns
- **React SPA Awareness**: Timing constants for component lifecycle compatibility
- **GraphQL Integration**: Mutation handling with retry logic and error recovery
- **External API Integration**: Rate limiting, caching, and fallback strategies
- **DOM Manipulation**: Robust element detection with multiple fallback selectors
- **Event Handling**: Debounced observers and mutation detection

## Quality and Performance Standards

### Error Handling Requirements
- Graceful degradation when external services fail
- Timeout protection on all async operations
- User cancellation checks throughout workflows
- Comprehensive error logging with context
- Multiple fallback strategies for critical operations

### Performance Optimization
- Debounced DOM observers (1-2 second intervals)
- Intelligent caching with memory management
- Background processing for heavy operations
- Configurable delays for system load adaptation
- Memory-efficient batch processing

### Testing Approach
- Manual testing against live Stash instances
- Cross-browser compatibility (Chrome, Firefox, Edge)
- Multi-tab operation testing
- Error recovery and cancellation scenarios
- Performance testing with large datasets

## Code Organization Standards

### Naming Conventions
- **Classes**: PascalCase with descriptive names
- **Constants**: SCREAMING_SNAKE_CASE for configuration and API definitions
- **Functions**: camelCase with action-oriented names
- **Variables**: camelCase with clear scope indication
- **Tool Prefixes**: Consistent prefixes for tool-specific functions

### Documentation Requirements
- JSDoc comments for all public functions and classes
- Inline comments explaining Stash-specific integration points
- Configuration sections clearly marked for user customization
- Version headers with dependency tracking
- Debug logging with emoji prefixes for easy identification

### Architecture Principles
- **Single Responsibility**: Each class and function has a clear, focused purpose
- **Dependency Injection**: Configurable dependencies for testing and flexibility
- **Event-Driven**: Custom events for cross-component communication
- **State Management**: Centralized state with clear ownership boundaries
- **Modular Design**: Reusable components with well-defined interfaces

## Stash-Specific Considerations

### React SPA Integration
- Wait for component render cycles before DOM manipulation
- Use mutation observers for dynamic content detection
- Respect React's virtual DOM with non-intrusive modifications
- Handle route changes and component unmounting gracefully

### Bootstrap UI Compatibility
- Use existing Bootstrap classes for consistent styling
- Respect existing layout patterns and spacing
- Provide fallback selectors for UI component detection
- Maintain accessibility standards with proper ARIA attributes

### GraphQL API Usage
- Batch mutations when possible to reduce API calls
- Handle asynchronous operations with proper error recovery
- Implement retry logic for network failures
- Cache query results to minimize server load

### Performance Considerations
- Monitor memory usage during bulk operations
- Implement progressive loading for large datasets
- Use background processing to maintain UI responsiveness
- Provide user feedback for long-running operations

## Security and Privacy

### Data Handling
- Validate all user inputs and external data
- Sanitize data before DOM insertion
- Respect user privacy in export/backup operations
- Implement secure storage for sensitive configuration

### External Integrations
- Validate external API responses
- Implement rate limiting to respect service limits
- Handle authentication securely without exposing credentials
- Provide user control over external data sharing

## Deployment and Distribution

### Userscript Standards
- Self-contained files for easy installation
- Clear installation instructions and requirements
- Version tracking with automatic update notifications
- Compatibility information for different Stash versions

### Configuration Management
- Persistent storage using Greasemonkey APIs
- Migration support for configuration updates
- User-friendly configuration interfaces
- Backup and restore capabilities for settings