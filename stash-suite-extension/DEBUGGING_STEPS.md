# Debugging Steps for Stash Suite Extension

## 1. Check Service Worker Console

1. Go to `chrome://extensions`
2. Find "Stash Suite"
3. Click on "service worker" link
4. Check for any errors in the console

## 2. Check Popup Console

1. Right-click the extension icon
2. Select "Inspect popup"
3. Look at the Console tab
4. You should see:
   - "Popup initializing..."
   - "Loading configuration..."
   - "getActiveTools response: ..."
   - Any errors

## 3. Use Test Page

1. Open the test page as an extension page:
   - Go to `chrome://extensions`
   - Open the extension details
   - Click "Extension options" or navigate to:
   - `chrome-extension://[EXTENSION_ID]/test.html`

2. Test each function:
   - **Get All Storage** - Shows what's stored
   - **Initialize Defaults** - Sets up default values
   - **Test getConfig** - Tests message passing
   - **Test setConfig** - Tests saving values

## 4. Check Content Script

1. Open http://localhost:9998
2. Open DevTools (F12)
3. Look for console messages starting with "🚀 Stash Suite Extension initializing..."
4. Check for any errors

## 5. Common Issues

### Checkboxes Not Saving
- Check if storage.local.get is returning values
- Check if setConfig messages are being sent/received
- Look for any permission errors

### Buttons Not Working
- Check if tabs.query is returning Stash tabs
- Check for any promise rejection errors
- Verify chrome.tabs API is accessible

### AutomateStash Not Working
- Check if content script loaded (console messages)
- Check if DOM elements are being created
- Look for any initialization errors

## 6. Manual Storage Test

In popup console, run:
```javascript
// Check what's stored
chrome.storage.local.get(null, console.log);

// Set a test value
chrome.storage.local.set({ enableAutomateStash: true }, () => {
    console.log('Set complete');
});

// Get specific value
chrome.storage.local.get('enableAutomateStash', console.log);
```