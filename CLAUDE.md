# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Stash userscript development repository containing **OptimizedStash** (v3.3.12), a sophisticated Greasemonkey/Tampermonkey userscript that automates metadata scraping and scene organization for Stash (a self-hosted adult content management system).

The single main file is `AutomateStash.js` (~7000 lines) - a comprehensive userscript that operates within Stash's React SPA environment.

## Core Architecture

### Configuration System
- Uses Greasemonkey persistent storage (`GM_setValue`/`GM_getValue`) 
- Configuration keys defined in `CONFIG_KEYS` object with defaults in `DEFAULT_CONFIG`
- Runtime configuration changes via `getConfig(key)` and `setConfig(key, value)`
- Key settings: auto-scraping toggles, delays, notification preferences

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

### Core Automation Functions
- `automateComplete()` - Main automation orchestrator
- `automateStashDB()` - StashDB scraper automation
- Similar functions for ThePornDB integration and organization workflows

## UI Architecture

**Multi-State Interface:**
- Full automation panel (`#stash-automation-panel`) with progress display
- Minimized floating button (`#stash-minimized-button`) for completed states  
- Cancel button overlay during active automation
- Modal configuration dialog for user settings

**Element Detection Patterns:**
Uses multiple fallback selectors for robustness across Stash UI updates:
```javascript
const applySelectors = [
  '.edit-panel button.btn-primary',           // Stash-specific
  'button.ml-2.btn.btn-primary',             // Bootstrap patterns  
  'button[data-testid*="apply"]'             // Test-id fallbacks
];
```

## Stash-Specific Integration

**Target URLs:** `http://localhost:9998/scenes/*` (excludes markers and edit pages)

**Key UI Patterns:**
- Entity edit panels: `.entity-edit-panel`, `.scene-edit-form`
- React Router navigation: `a[data-rb-event-key="scene-edit-panel"]`
- Bootstrap dropdowns for scraper selection
- GraphQL mutation handling with configured delays

## Development Workflow

**No Build Process:** Direct userscript development - edit `AutomateStash.js` and reload in browser

**Testing Approach:**
- Install in Greasemonkey/Tampermonkey
- Test against running Stash instance on localhost:9998
- Verify React component interactions and SPA navigation
- Test cancellation and error recovery scenarios

**Debugging Tools:**
- Built-in `debugElementsInArea()` for DOM inspection
- Confidence scoring system for scraper detection (0.0-1.0)
- Phase logging with emoji prefixes for automation progress tracking

## Integration Dependencies

- **Stash Server:** Requires running Stash instance on localhost:9998
- **Userscript Manager:** Greasemonkey or Tampermonkey for GM APIs
- **External Services:** StashDB (stashdb.org) and ThePornDB (metadataapi.net) scrapers

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