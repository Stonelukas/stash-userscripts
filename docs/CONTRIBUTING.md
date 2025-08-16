# Contributing to AutomateStash Suite

Thank you for your interest in contributing to the AutomateStash Suite! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Development Process](#development-process)
5. [Coding Standards](#coding-standards)
6. [Testing](#testing)
7. [Pull Request Process](#pull-request-process)
8. [Documentation](#documentation)
9. [Community](#community)

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept responsibility for mistakes
- Prioritize the community's best interests

### Unacceptable Behavior

- Harassment or discrimination of any kind
- Trolling, insulting, or derogatory comments
- Public or private harassment
- Publishing private information without permission
- Any conduct that could be considered inappropriate

## Getting Started

### Prerequisites

- Node.js 16+ (for development tools)
- Git
- A running Stash instance (v0.17.0+)
- Tampermonkey or Greasemonkey browser extension
- Basic knowledge of JavaScript and browser APIs

### Repository Structure

```
stash-userscripts/
├── AutomateStash-Final.js      # Core automation script
├── Stash*.js                   # Additional management tools
├── stash-plugin/               # Native plugin implementation
├── stash-suite-extension/      # Browser extension
├── .kiro/specs/                # Feature specifications
├── docs/                       # Documentation
└── tests/                      # Test files
```

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/yourusername/stash-userscripts.git
cd stash-userscripts

# Add upstream remote
git remote add upstream https://github.com/originalrepo/stash-userscripts.git
```

### 2. Install Development Tools

```bash
# Install development dependencies
npm install

# Install userscript in browser
# Open Tampermonkey dashboard
# Create new script
# Copy contents of desired .js file
```

### 3. Configure Stash

Ensure your Stash instance is configured with:
- StashDB scraper enabled
- ThePornDB scraper (optional)
- API access enabled (if using authentication)

### 4. Development Environment

Recommended IDE setup:
- VS Code with JavaScript/TypeScript extensions
- ESLint for code quality
- Prettier for formatting
- GitLens for version control

## Development Process

### Spec-Driven Development

All new features must start with a specification:

1. **Create Specification**
   ```
   .kiro/specs/[feature-name]/
   ├── requirements.md    # EARS format requirements
   ├── design.md         # Technical design
   └── tasks.md          # Implementation tasks
   ```

2. **EARS Format Requirements**
   ```markdown
   [REQ-001] When the user clicks the automation button, 
   the system shall start the automation workflow.
   
   [REQ-002] If automation fails, the system shall display 
   an error message and provide recovery options.
   ```

3. **Design Document Structure**
   - Problem Statement
   - Proposed Solution
   - Architecture Changes
   - API Changes
   - UI/UX Changes
   - Testing Strategy

### Feature Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Implement Feature**
   - Follow existing patterns
   - Maintain backward compatibility
   - Add necessary documentation

3. **Test Thoroughly**
   - Manual testing with Stash
   - Cross-browser testing
   - Edge case testing

4. **Update Documentation**
   - Update CLAUDE.md if needed
   - Update README.md for new features
   - Add inline code comments

## Coding Standards

### JavaScript Style Guide

#### Naming Conventions

```javascript
// Classes: PascalCase
class UIManager {
  // ...
}

// Constants: SCREAMING_SNAKE_CASE
const CONFIG_KEYS = {
  AUTO_SCRAPE: 'auto_scrape'
};

// Functions: camelCase
function waitForElement(selector) {
  // ...
}

// Private methods: underscore prefix
class Manager {
  _privateMethod() {
    // ...
  }
}
```

#### Code Organization

```javascript
// ==UserScript==
// @name         Script Name
// @version      1.0.0
// @description  Clear description
// ==/UserScript==

(function() {
  'use strict';
  
  // ===== CONFIGURATION =====
  const CONFIG = {
    // Configuration constants
  };
  
  // ===== CLASSES =====
  class MainClass {
    // Class implementation
  }
  
  // ===== UTILITY FUNCTIONS =====
  function utilityFunction() {
    // Utility implementation
  }
  
  // ===== MAIN EXECUTION =====
  function init() {
    // Initialization logic
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

#### Async/Await Usage

```javascript
// Prefer async/await over callbacks
async function fetchData() {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}

// Proper error handling
async function performOperation() {
  try {
    await riskyOperation();
  } catch (error) {
    // Handle specific errors
    if (error.code === 'NETWORK_ERROR') {
      await retryOperation();
    } else {
      throw error;
    }
  }
}
```

#### DOM Manipulation

```javascript
// Use modern DOM APIs
const element = document.querySelector('.selector');
const elements = document.querySelectorAll('.multiple');

// Proper event handling
element.addEventListener('click', handleClick, { once: true });

// Clean up when done
function cleanup() {
  element.removeEventListener('click', handleClick);
  observer.disconnect();
}
```

### CSS Guidelines

```css
/* Component-based styling */
#stash-automation-panel {
  /* Use specific selectors */
  position: fixed;
  z-index: 10000; /* High z-index for overlays */
}

/* Gradient patterns */
.gradient-panel {
  background: linear-gradient(
    135deg,
    rgba(44, 62, 80, 0.95) 0%,
    rgba(52, 73, 94, 0.95) 100%
  );
}

/* Responsive design */
@media (max-width: 768px) {
  .panel {
    width: 100%;
  }
}
```

### Error Handling

```javascript
// Comprehensive error handling
class ErrorHandler {
  static handle(error, context) {
    console.error(`Error in ${context}:`, error);
    
    // User notification
    NotificationManager.show(
      `Error: ${error.message}`,
      'error'
    );
    
    // Recovery attempt
    if (this.canRecover(error)) {
      this.attemptRecovery(error);
    }
  }
  
  static canRecover(error) {
    return error.code === 'TEMPORARY_FAILURE';
  }
  
  static attemptRecovery(error) {
    // Recovery logic
  }
}
```

## Testing

### Manual Testing Checklist

#### Core Functionality
- [ ] Automation starts correctly
- [ ] All scrapers work (StashDB, ThePornDB)
- [ ] Metadata applies correctly
- [ ] Scene organizes properly
- [ ] Settings save and load
- [ ] UI minimizes and expands

#### Error Scenarios
- [ ] Network failure handling
- [ ] Missing elements handling
- [ ] Cancellation works
- [ ] Recovery from errors

#### Browser Compatibility
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Edge
- [ ] Safari (if applicable)

### Automated Testing

```javascript
// Example test structure (future implementation)
describe('UIManager', () => {
  beforeEach(() => {
    // Setup
  });
  
  it('should create panel', () => {
    const ui = new UIManager();
    const panel = ui.createPanel();
    expect(panel).toBeDefined();
    expect(panel.id).toBe('stash-automation-panel');
  });
  
  it('should minimize to button', () => {
    const ui = new UIManager();
    ui.createPanel();
    ui.minimize();
    expect(ui.minimizedButton).toBeDefined();
    expect(ui.panel.style.display).toBe('none');
  });
});
```

### Performance Testing

```javascript
// Performance monitoring
function measurePerformance(operation) {
  const start = performance.now();
  const result = operation();
  const duration = performance.now() - start;
  
  console.log(`Operation took ${duration}ms`);
  
  // Alert if too slow
  if (duration > 1000) {
    console.warn('Operation exceeded 1 second');
  }
  
  return result;
}
```

## Pull Request Process

### Before Submitting

1. **Update your fork**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Run checks**
   - Lint your code
   - Test all functionality
   - Update documentation

3. **Commit messages**
   ```
   feat: Add bulk operations for scenes
   
   - Implement scene selection UI
   - Add bulk tag management
   - Add bulk performer assignment
   
   Fixes #123
   ```

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested error scenarios

## Screenshots
(if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log statements
```

### Review Process

1. **Automated Checks**
   - Code quality checks
   - Documentation checks
   - Conflict detection

2. **Manual Review**
   - Code review by maintainers
   - Functionality testing
   - Documentation review

3. **Feedback Integration**
   - Address review comments
   - Update PR as needed
   - Re-request review

## Documentation

### Code Comments

```javascript
/**
 * Waits for an element to appear in the DOM
 * @param {string|string[]} selectors - CSS selector(s) to wait for
 * @param {number} timeout - Maximum wait time in milliseconds
 * @param {boolean} waitForVisible - Wait for visibility
 * @returns {Promise<Element>} The found element
 * @throws {Error} If element not found within timeout
 */
async function waitForElement(selectors, timeout = 5000, waitForVisible = false) {
  // Implementation
}
```

### README Updates

When adding features, update:
- Feature list
- Installation instructions (if needed)
- Configuration options
- Usage examples

### CHANGELOG Updates

Follow this format:
```markdown
## [4.20.0] - 2025-02-08
### Added
- New feature description

### Changed
- Modified behavior description

### Fixed
- Bug fix description

### Removed
- Removed feature description
```

## Community

### Getting Help

- **Discord**: Join the Stash Discord server
- **GitHub Issues**: Search existing issues or create new ones
- **Documentation**: Check the wiki and docs folder

### Feature Requests

1. Check existing issues/requests
2. Create detailed feature request
3. Include use cases and examples
4. Be open to discussion

### Bug Reports

Include:
- Script version
- Browser and version
- Stash version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)
- Screenshots (if helpful)

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to AutomateStash Suite! Your efforts help make this tool better for everyone in the Stash community.