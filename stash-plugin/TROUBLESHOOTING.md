# AutomateStash Plugin Troubleshooting Guide

## Edit Panel Detection Issues

### Problem: "Could not open edit panel" error when panel is already open

This is the most common issue and happens when the plugin can't detect your specific Stash version's HTML structure.

### Solution 1: Run Enhanced Debug Script

1. **Open the edit panel manually** in Stash
2. **Open browser console** (F12)
3. **Run the debug script**:
   ```javascript
   // Copy and paste the contents of debug-edit-panel-enhanced.js
   ```
4. **Look for "SUGGESTED SELECTORS"** section at the bottom
5. **Update the plugin** with these selectors:
   - Edit `automate-stash-compact.js`
   - Find the `formIndicators` array (around line 620)
   - Add your suggested selectors

Example output might suggest:
```javascript
'input[name="scene_title"]',
'form.scene-edit-form',
'.edit-scene-panel',
```

### Solution 2: Use Bypass Version (Quick Fix)

1. Replace `automate-stash-compact.js` with `automate-stash-compact-bypass.js`
2. This version skips edit panel detection
3. **Important**: You must manually open the edit panel before starting automation

### Solution 3: Manual Selector Update

If the debug script doesn't help, manually check for these common patterns:

```javascript
// Common form field selectors
'input[name="title"]',
'input[data-field="title"]',
'textarea[name="details"]',
'textarea[data-field="details"]',

// Common container selectors
'.scene-edit-container',
'.edit-scene-panel',
'form[name="editScene"]',
```

## Other Common Issues

### Widget Not Appearing

1. **Check file locations**:
   ```
   ~/.stash/plugins/AutomateStash/
   ├── automate-stash.yml
   ├── automate-stash-compact.js
   └── automate-stash.css
   ```

2. **Reload plugins**: Settings → Plugins → Reload Plugins

3. **Check browser console** for loading errors

### Scraper Detection Issues

If scrapers aren't being found:

1. Check that scraper names match exactly
2. Some Stash versions use different dropdown structures
3. Try running the automation with console open to see which selectors fail

### Scraper Timing Issues

If ThePornDB or other scrapers are timing out too early:

1. **The plugin has been updated to use simpler timing**:
   - Waits 3 seconds after clicking StashDB (matching original userscript)
   - Waits 5 seconds after clicking ThePornDB (as it's typically slower)
   - No complex detection logic that might fail prematurely

2. **Entity creation is now integrated into the scraping flow**:
   - After waiting for results, the plugin checks for + buttons
   - Creates new performers/studios/tags automatically
   - Then applies the scraped data

3. **If you still have timing issues**, you can manually adjust the waits:
   ```javascript
   // In scrapeStashDB function, change:
   await sleep(3000);  // to a higher value like 5000
   
   // In scrapeThePornDB function, change:
   await sleep(5000);  // to a higher value like 8000
   ```

4. **The plugin now matches the original userscript behavior**:
   - Simple fixed waits instead of complex detection
   - More reliable for different Stash versions
   - Less likely to skip or timeout prematurely

### Performance Issues

If automation is slow:

1. Increase timing delays in `STASH_CONFIG`
2. Check browser console for timeout errors
3. Ensure Stash server isn't overloaded

## Debug Information to Collect

When reporting issues, please provide:

1. **Stash version**: Check Settings → About
2. **Browser**: Chrome/Firefox/Safari version
3. **Console errors**: Full error messages from F12 console
4. **Debug output**: Results from running debug scripts
5. **URL pattern**: Example scene URL (anonymized)

## Advanced Debugging

### Enable Verbose Logging

Add this to the beginning of `startAutomation()`:
```javascript
window.DEBUG_AUTOMATE = true;
```

### Check Element Visibility

Run this to check if elements are actually visible:
```javascript
document.querySelectorAll('input, textarea, button').forEach(el => {
    if (el.offsetParent !== null) {
        console.log(el.tagName, el.name || el.placeholder || el.textContent);
    }
});
```

### Monitor Network Requests

Watch for GraphQL mutations in Network tab to ensure save operations work.

## Plugin Conflicts

If you have other Stash plugins:

1. Try disabling other plugins temporarily
2. Check for JavaScript conflicts in console
3. Ensure no CSS conflicts with other plugins

## Reverting Changes

If the plugin causes issues:

1. Remove the plugin folder
2. Reload plugins
3. Clear browser cache
4. Restart Stash if needed