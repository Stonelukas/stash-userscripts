# AGENTS.md - Stash Userscripts Development Guide

## Build/Lint/Test Commands
- **No build process** - Direct userscript development, edit JS files and reload in browser
- **Install**: Load scripts in Greasemonkey/Tampermonkey extension
- **Test**: Manual testing against Stash instance at http://localhost:9998
- **Debug**: Use built-in debug functions: `debugElementsInArea()`, `debugListAllButtons()`

## Code Style Guidelines
- **Naming**: PascalCase for classes (`UIManager`), camelCase for functions/variables, SCREAMING_SNAKE_CASE for constants
- **Async patterns**: Use `async/await` with proper error handling and cancellation checks
- **Element detection**: Multiple fallback selectors with `waitForElementAdvanced()` pattern
- **State management**: Global flags for automation state (`automationInProgress`, `automationCancelled`)
- **Configuration**: Use `GM_setValue`/`GM_getValue` with `getConfig()`/`setConfig()` helpers
- **Error handling**: Strategy pattern with fallbacks, timeout protection, graceful degradation
- **Logging**: Use emoji prefixes for phases (🚀 start, ✅ success, ❌ error, 🔍 debug)
- **React integration**: Respect timing delays (`REACT_RENDER_DELAY: 800ms`, `GRAPHQL_MUTATION_DELAY: 1000ms`)
- **GraphQL**: Use Stash API at `/graphql` endpoint with proper error handling
- **UI patterns**: Dark theme with gradients, blur effects, smooth animations
- **Comments**: Minimal comments, self-documenting code preferred
- **Imports**: No ES6 modules - userscripts use IIFE pattern with direct script inclusion

## Important Notes
- Follow existing patterns in CLAUDE.md and .github/copilot-instructions.md
- Update ROADMAP.md after completing tasks
- Test against live Stash instance for React component interactions