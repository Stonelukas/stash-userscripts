# Debugging the Extension

## Fixed Issues

1. **Checkmarks resetting**: Changed from `toggleTool` to `setConfig` for proper state management
2. **Status stuck on "Checking..."**: Removed unnecessary message passing, directly check tabs
3. **Buttons not working**: Added proper error handling and async/await

## To Test

1. **Reload the extension**:
   - Go to `chrome://extensions`
   - Click refresh icon on Stash Suite
   
2. **Check Developer Console**:
   - Right-click extension icon → "Inspect popup"
   - Look for any errors in console

3. **Test each feature**:
   - Toggle a tool checkbox - should persist
   - Status should show "Connected to Stash" or "Stash not open"
   - "Open Stash" button should open/focus Stash tab
   - "Settings" button should open Stash and show settings (once loaded)

## Common Issues

If still having problems:

1. **Storage permissions**: Extension needs storage permission (already in manifest)
2. **Background script errors**: Check service worker console
3. **Content script not loading**: Check if main-bundle.js loads on Stash pages

## Console Commands to Debug

In popup console:
```javascript
// Check storage
chrome.storage.local.get(null, console.log)

// Check tabs
chrome.tabs.query({ url: 'http://localhost:9998/*' }, console.log)

// Test message passing
chrome.runtime.sendMessage({ action: 'getConfig', key: null }, console.log)
```