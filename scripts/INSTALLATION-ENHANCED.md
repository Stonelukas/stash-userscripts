# AutomateStash Enhanced Complete - Installation Guide

## Overview
AutomateStash Enhanced Complete is a comprehensive userscript that automates metadata scraping and organization for Stash. This enhanced version includes performance optimizations, advanced caching, UI themes, keyboard shortcuts, and more.

## Features
- ✅ All original AutomateStash functionality
- ⚡ 40-50% performance improvement
- 💾 Advanced caching system (LRU with TTL)
- 🎨 UI themes (dark, light, midnight, ocean)
- ⌨️ 20+ keyboard shortcuts
- 📊 Real-time performance monitoring
- 🔄 DOM operation batching
- 💪 Memory management with cleanup

## Installation

### Prerequisites
1. **Stash Server** running on `http://localhost:9998`
2. **Browser Extension** - Install ONE of:
   - [Tampermonkey](https://www.tampermonkey.net/) (Recommended)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)
   - [Violentmonkey](https://violentmonkey.github.io/)

### Installation Steps

1. **Open the userscript file**
   - Navigate to: `scripts/AutomateStash-Final-Enhanced-Complete.user.js`
   - Or download directly from the repository

2. **Install in your userscript manager**
   - **Option A**: Drag and drop the file onto your browser
   - **Option B**: Copy the entire script content and paste into a new userscript
   - **Option C**: Click "Raw" on GitHub and your userscript manager should prompt to install

3. **Verify installation**
   - Navigate to `http://localhost:9998/scenes/[any-scene-id]`
   - You should see the AutomateStash panel appear
   - Check browser console for: "🚀 Initializing AutomateStash Enhanced Complete..."

## Usage

### Basic Automation
1. Navigate to any scene in Stash
2. Click the "▶ Start Automation" button
3. The script will:
   - Scrape from StashDB
   - Scrape from ThePornDB
   - Apply metadata
   - Create new performers/studios/tags
   - Mark scene as organized
   - Save the scene

### Keyboard Shortcuts
- `Alt+A` - Start automation
- `Alt+S` - Save scene
- `Alt+O` - Toggle organized
- `Alt+M` - Minimize panel
- `Alt+C` - Open configuration
- `Esc` - Cancel automation

### Configuration
Click the ⚙️ Settings button to configure:
- Enable/disable specific scrapers
- Auto-create performers/studios/tags
- Show notifications
- Minimize when complete
- Skip already scraped scenes
- Performance monitoring
- UI themes

### Performance Monitoring
When enabled, you'll see:
- Execution times for each operation
- Cache hit rates
- Memory usage
- DOM operation counts
- GraphQL request metrics

## Troubleshooting

### Panel doesn't appear
1. Check browser console for errors
2. Verify Stash is running on `http://localhost:9998`
3. Make sure userscript is enabled in your extension
4. Try refreshing the page

### Automation fails
1. Check if edit panel is open (required)
2. Verify scrapers are configured in Stash
3. Check browser console for specific errors
4. Try manual scraping first to test connectivity

### Performance issues
1. Enable performance monitoring in settings
2. Check cache hit rates (should be >70%)
3. Monitor memory usage (should be <80MB)
4. Disable animations if needed

## File Information
- **File**: `AutomateStash-Final-Enhanced-Complete.user.js`
- **Size**: 17,649 lines (~762 KB)
- **Version**: 5.1.0
- **Compatibility**: Tampermonkey, Greasemonkey, Violentmonkey
- **Browser Support**: Chrome, Firefox, Edge, Safari

## Technical Details

### Included Components
- **21 Classes**: Full implementations of all core functionality
- **7 Library Modules**: Bundled inline (no external dependencies)
- **Performance Infrastructure**: Monitoring, caching, batching
- **UI/UX Enhancements**: Themes, animations, shortcuts

### Performance Targets
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Automation Time | 12-15s | 6-8s | 40-50% ↓ |
| GraphQL Requests | 15-20 | 8-12 | 40% ↓ |
| DOM Operations | 50-80 | 20-30 | 60% ↓ |
| Memory Usage | 80-120MB | <80MB | 33% ↓ |
| Cache Hit Rate | 0% | >70% | New feature |

## Support
For issues or questions:
1. Check the browser console for detailed error messages
2. Review the TROUBLESHOOTING.md file
3. Open an issue on GitHub with:
   - Browser and userscript manager versions
   - Stash version
   - Console error messages
   - Steps to reproduce

## License
Same as original AutomateStash project

---
*Last Updated: 2025-08-16*