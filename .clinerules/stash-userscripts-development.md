## Brief overview
Project-specific guidelines for developing and maintaining the AutomateStash suite - a comprehensive collection of userscripts, plugins, and browser extensions for automating and enhancing Stash (self-hosted adult content management system).

## Communication style
- Use clear, technical language when discussing Stash integration patterns
- Reference specific selectors and GraphQL queries when discussing UI automation
- Provide concrete examples using existing code patterns from the project
- Keep explanations focused on practical implementation rather than theory

## Development workflow
- Always check existing implementations in scripts/ folder before creating new features
- Test against running Stash instance on localhost:9998
- Update ROADMAP.md after completing each task or feature
- Follow spec-driven development using .kiro/specs/ format when adding major features
- Maintain backward compatibility across all three deployment modes (userscripts, plugin, extension)

## Coding best practices
- Use descriptive camelCase for functions (e.g., `waitForElementAdvanced`, `checkAlreadyScraped`)
- Use PascalCase for classes (e.g., `UIManager`, `NotificationManager`)
- Use SCREAMING_SNAKE_CASE for constants (e.g., `STASH_CONFIG`, `CONFIG_KEYS`)
- Implement multiple fallback selectors for DOM element detection to handle Stash UI updates
- Use debounced MutationObservers for React SPA navigation (1-2 second delays)
- Always include error recovery and user cancellation checks in async workflows

## Project context
- Target application runs at http://localhost:9998 with GraphQL endpoint at /graphql
- Three deployment modes: Greasemonkey/Tampermonkey userscripts, native Stash plugin, browser extension
- Uses GM_* APIs for userscripts, chrome.storage for extension, avoid mixing these contexts
- React timing constants: REACT_RENDER_DELAY (800ms), GRAPHQL_MUTATION_DELAY (1000ms)
- Bootstrap UI patterns and React Router navigation must be considered for selectors

## UI/UX guidelines
- Maintain gradient backgrounds with blur effects for consistency
- Use emoji prefixes for logging and status messages
- Preserve minimized button behavior across all UI states
- Keep configuration dialogs modal with dark theme styling
- Status indicators should use consistent color coding

## Testing strategies
- Manual testing against live Stash instances required
- Test cancellation and error recovery scenarios
- Verify React component interactions and SPA navigation
- Use debug tools: debugElementsInArea(), debugListAllButtons(), debugListAllFormElements()
- Cross-browser compatibility testing (Chrome, Firefox, Edge)

## Documentation requirements
- Keep CLAUDE.md updated with architecture changes
- Document breaking changes in CHANGELOG.md
- Include version numbers in userscript headers
- Comment complex selector strategies and timing workarounds
- Maintain compatibility notes for different Stash versions

## Other guidelines
- Respect existing global state flags: automationInProgress, automationCancelled, automationCompleted
- Use existing GraphQLClient class for API communication
- Implement confidence scoring (0.0-1.0) for scraper detection
- Keep element wait timeouts at 8000ms standard
- Follow existing button detection patterns with title attributes as primary selectors
