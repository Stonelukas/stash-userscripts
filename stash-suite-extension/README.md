# Stash Suite Extension

A comprehensive browser extension combining all Stash userscripts into a single, robust solution with improved error handling and debugging capabilities.

## Features

- **Unified Management**: All tools accessible from a single extension
- **Better Error Handling**: Centralized error reporting and debugging
- **Persistent Storage**: Uses Chrome storage API instead of GM_setValue
- **Background Service Worker**: Handles cross-tab communication
- **Popup Control Panel**: Quick toggle for tools and settings
- **Enhanced Security**: Proper permissions and content security

## Tools Included

1. **AutomateStash** - Automated metadata scraping and scene organization
2. **Bulk Operations** - Batch editing for multiple scenes
3. **Quality Analyzer** - Video quality assessment and duplicate detection
4. **Performance Monitor** - Real-time performance metrics
5. **Performer Manager** - Enhanced performer search and relationships
6. **Collection Organizer** - Smart organization and metadata analysis
7. **Export/Import Tools** - Data portability and backup solutions

## Installation

### Development Mode

1. Open Chrome/Edge and navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `stash-suite-extension` directory
5. The extension will be installed and ready to use

### Building for Production

```bash
# Install dependencies (if any)
npm install

# Build the extension
npm run build

# The built extension will be in the 'dist' directory
```

## Usage

1. Click the Stash Suite icon in your browser toolbar
2. Toggle individual tools on/off as needed
3. Configure settings through the popup or main UI
4. Navigate to your Stash instance (http://localhost:9998)
5. The enabled tools will automatically initialize

## Configuration

The extension stores all configuration in Chrome's sync storage, allowing settings to persist across devices when signed into Chrome.

### Available Settings

- **Tool Enable/Disable**: Toggle each tool individually
- **AutomateStash Settings**:
  - Auto-scrape StashDB
  - Auto-scrape ThePornDB
  - Auto-create performers/studios/tags
  - Auto-organize scenes
  - Show notifications
  - Minimize when complete
- **Global Settings**:
  - Show notifications
  - Auto-refresh after operations

## Architecture

```
stash-suite-extension/
├── manifest.json          # Extension manifest
├── src/
│   ├── background/       # Service worker
│   ├── content/          # Content scripts (converted userscripts)
│   ├── popup/           # Extension popup UI
│   └── common/          # Shared utilities
├── assets/              # CSS and other assets
└── icons/              # Extension icons
```

## Troubleshooting

### Quick Fixes

1. **Reload the extension**: Go to `chrome://extensions/` and click the refresh icon
2. **Check storage**: Right-click extension icon → "Inspect popup" → Console → Look for "Storage contents:"
3. **Use Debug Helper**: Open `chrome-extension://[YOUR_EXTENSION_ID]/debug-helper.html`

### Common Issues

**Checkboxes don't save:**
- The extension now uses direct Chrome storage operations
- Check popup console for errors
- Try the debug helper to initialize defaults

**AutomateStash widget not appearing:**
- Make sure you're on a scene page
- Check that AutomateStash is enabled in the popup
- Look for initialization messages in the page console

**Buttons don't work:**
- Make sure you have at least one Stash tab open
- Check popup console for error messages

## Debug Tools

### Debug Helper Page
Access at: `chrome-extension://[YOUR_EXTENSION_ID]/debug-helper.html`

Features:
- View and manage all storage
- Test all extension features
- Export/import settings
- Live storage monitoring
- One-click fixes

### Console Commands

**Popup Console:**
```javascript
// View all storage
chrome.storage.local.get(null).then(console.log)

// Reset specific tool
chrome.storage.local.set({ enableAutomateStash: true })
```

**Content Script Console (on Stash page):**
```javascript
// Check if loaded
console.log(window.automateStash)

// Manually show UI
document.getElementById('stash-automation-panel').style.display = 'block'
```

### Console Logging

All tools use structured logging with prefixes:
- `🚀` - Initialization
- `✅` - Success
- `❌` - Error
- `⚠️` - Warning
- `ℹ️` - Info

### Background Script Debugging

1. Go to `chrome://extensions`
2. Find Stash Suite
3. Click "Service Worker" link
4. Opens DevTools for background script

### Content Script Debugging

1. Open DevTools on any Stash page
2. Look for console messages prefixed with "Stash Suite"

## Migration from Userscripts

If you're migrating from the original userscripts:

1. Disable all Stash userscripts in Tampermonkey/Greasemonkey
2. Install the extension
3. Your settings will need to be reconfigured (one-time process)
4. All functionality remains the same, with improved reliability

## Development

### Adding New Tools

1. Create content script in `src/content/`
2. Add to manifest.json content scripts
3. Add configuration keys to `src/common/config.js`
4. Add UI toggle in popup
5. Update main.js to initialize the tool

### Testing

- Test in development mode before building
- Check all tools initialize properly
- Verify cross-tab communication
- Test error scenarios

## Troubleshooting

### AutomateStash Panel Closes Without Doing Anything

If clicking "Start" causes the panel to close without performing any actions:

1. **Check Console for Errors**:
   - Open Chrome DevTools (F12) on the Stash page
   - Look in the Console tab for error messages
   - Look for messages like:
     - "🚀 startAutomation called"
     - "Edit button not found"
     - "Failed to open edit panel"

2. **Run Debug Script**:
   ```javascript
   // Copy and paste debug-automation.js contents into console
   // Or manually check:
   console.log('AutomateStash initialized:', window.automateStash?.initialized);
   console.log('On scene page:', window.location.pathname.match(/^\/scenes\/\d+/));
   
   // Try to find edit button manually:
   document.querySelectorAll('button, a').forEach(el => {
       if (el.textContent?.toLowerCase().includes('edit')) {
           console.log('Edit element:', el, el.textContent);
       }
   });
   ```

3. **Common Causes**:
   - **Wrong Page**: Ensure you're on a scene page (`/scenes/[id]`)
   - **Edit Button Not Found**: The edit button selector might not match your Stash version
   - **Edit Panel Already Open**: Close any open edit panels and try again
   - **Permissions Issue**: Check that the extension has access to `http://localhost:9998/*`

4. **Manual Workaround**:
   - Open the edit panel manually first
   - Then click the Start button
   - This bypasses the edit button detection issue

5. **Report the Issue**:
   - Note your Stash version
   - Copy any error messages from the console
   - Note what the Edit button looks like (text, location, etc.)

### Extension Not Working

1. Check if Stash is running on http://localhost:9998
2. Verify extension is enabled in chrome://extensions
3. Check console for error messages
4. Try reloading the extension

### Tools Not Appearing

1. Check if tools are enabled in popup
2. Refresh the Stash page
3. Check for JavaScript errors in console

## License

Same as original Stash userscripts project

## Credits

Based on the AutomateStash userscript suite.