# Quick Fix for Stash Suite Extension

## Known Issues & Solutions

### Issue 1: Checkboxes Don't Save
**Fixed!** The popup now uses direct Chrome storage operations instead of message passing.

### Issue 2: Extension Status Shows "Checking..."
**Fixed!** The popup directly queries tabs to check if Stash is open.

### Issue 3: Buttons Don't Work
**Fixed!** Buttons now properly handle async operations and tab management.

### Issue 4: AutomateStash Widget Not Working
**Fixed!** The widget initialization is now properly handled in the bundled content script.

## Verification Steps

1. **Reload the Extension**
   - Go to `chrome://extensions`
   - Click the refresh icon on Stash Suite
   - **Important**: Also reload any open Stash tabs!

2. **Check Storage is Working**
   - Right-click extension icon → "Inspect popup"
   - Look for "Storage contents:" in console
   - Should show all your settings

3. **Test Checkboxes**
   - Toggle any checkbox
   - Close and reopen popup
   - Checkbox state should persist

4. **Test AutomateStash Widget**
   - Go to any scene page: `http://localhost:9998/scenes/[id]`
   - Look for the gradient panel or minimized button
   - Check DevTools console for "🚀 AutomateStash initializing..."

## Debug Commands

In the popup console:
```javascript
// Check current storage
chrome.storage.local.get(null).then(console.log)

// Reset all settings
chrome.storage.local.clear()

// Set specific tool
chrome.storage.local.set({ enableAutomateStash: true })
```

## Common Solutions

### If nothing works:
1. Uninstall extension
2. Delete the extension folder
3. Reinstall from the folder
4. This ensures a clean state

### If AutomateStash doesn't appear:
1. Make sure you're on a scene page
2. Check if "AutomateStash" is enabled in popup
3. Look for errors in page console (F12)
4. Try clicking the extension icon while on a Stash page

### If settings don't save:
1. Check popup console for errors
2. Try the test page: `chrome-extension://[YOUR_EXTENSION_ID]/test.html`
3. Use "Initialize Defaults" button

## What's Working Now

✅ **Storage Persistence** - Settings save correctly
✅ **Status Detection** - Shows correct Stash connection status  
✅ **Button Functionality** - Open Stash and Settings buttons work
✅ **AutomateStash Widget** - Initializes on scene pages
✅ **Config Changes** - Real-time updates when toggling tools

## Recent Fixes

1. **Direct Storage Access** - Removed unreliable message passing
2. **Proper Initialization** - AutomateStash initializes when toggled
3. **Error Handling** - Better error messages and recovery
4. **Bundle Completeness** - All required code in main-bundle.js