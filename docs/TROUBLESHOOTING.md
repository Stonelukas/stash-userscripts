# AutomateStash Suite - Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the AutomateStash Suite.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Script-Specific Issues](#script-specific-issues)
4. [Performance Issues](#performance-issues)
5. [API & Network Issues](#api--network-issues)
6. [UI & Display Issues](#ui--display-issues)
7. [Data & Configuration Issues](#data--configuration-issues)
8. [Advanced Debugging](#advanced-debugging)
9. [FAQ](#frequently-asked-questions)
10. [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check Script

Run this in your browser console while on a Stash page:

```javascript
// AutomateStash Health Check
console.log('=== AutomateStash Health Check ===');

// Check if script is loaded
if (typeof GM_info !== 'undefined') {
  console.log('✅ Userscript manager detected:', GM_info.scriptHandler);
  console.log('✅ Script version:', GM_info.script.version);
} else {
  console.log('❌ No userscript manager detected');
}

// Check Stash connection
fetch('http://localhost:9998/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '{ systemStatus { databaseSchema } }' })
})
.then(r => r.json())
.then(d => console.log('✅ Stash API accessible'))
.catch(e => console.log('❌ Stash API error:', e));

// Check DOM elements
console.log('Scene edit form:', document.querySelector('.scene-edit-form') ? '✅' : '❌');
console.log('React root:', document.querySelector('#root') ? '✅' : '❌');

// Check storage
if (typeof GM_getValue !== 'undefined') {
  console.log('✅ Storage accessible');
  console.log('Stored configs:', Object.keys(GM_getValue('config', {})));
} else {
  console.log('❌ Storage not accessible');
}
```

### Common Symptoms Checklist

| Symptom | Likely Cause | Quick Fix |
|---------|-------------|-----------|
| Script not appearing | Not installed/enabled | Reinstall script |
| Buttons not working | Cache issue | Hard refresh (Ctrl+Shift+R) |
| Automation stuck | Element not found | Check Stash version |
| Settings not saving | Storage permission | Check userscript permissions |
| Scrapers not working | API configuration | Verify scraper setup |

## Installation Issues

### Userscript Not Loading

**Problem**: The AutomateStash button doesn't appear

**Solutions**:

1. **Verify Installation**
   ```javascript
   // Check in Tampermonkey dashboard
   // Script should show as "Enabled"
   // Version should be 4.19.1 or higher
   ```

2. **Check URL Match**
   - Script only runs on `http://localhost:9998/*`
   - Verify your Stash URL matches
   - Update @match in script header if using different port

3. **Clear Cache**
   ```bash
   # Force reinstall
   1. Delete script from Tampermonkey
   2. Clear browser cache
   3. Reinstall script
   4. Restart browser
   ```

### Plugin Not Working

**Problem**: Native plugin doesn't appear in Stash

**Solutions**:

1. **Verify Plugin Directory**
   ```bash
   # Check plugin location
   ls ~/.stash/plugins/
   # Should contain automate-stash folder
   ```

2. **Check YAML Manifest**
   ```yaml
   # automate-stash.yml should contain:
   name: AutomateStash
   description: Automation suite for Stash
   version: 4.5.0
   ui:
     javascript:
       - automate-stash-enhanced.js
   ```

3. **Restart Stash**
   ```bash
   # Restart Stash server
   systemctl restart stash
   # Or manually stop and start
   ```

### Extension Not Loading

**Problem**: Browser extension doesn't work

**Solutions**:

1. **Check Manifest Version**
   - Must be Manifest V3 compatible browser
   - Chrome 88+, Edge 88+, Firefox 109+

2. **Verify Permissions**
   ```json
   // Required permissions in manifest.json
   "permissions": [
     "storage",
     "activeTab",
     "scripting"
   ],
   "host_permissions": [
     "http://localhost:9998/*"
   ]
   ```

3. **Check Service Worker**
   ```javascript
   // In browser console (extension page)
   chrome.runtime.getManifest()
   // Should show version and permissions
   ```

## Script-Specific Issues

### AutomateStash-Final.js

#### Settings Button Not Working

**Problem**: Clicking settings button does nothing

**Solution**:
```javascript
// Emergency settings reset
GM_deleteValue('auto_scrape_stashdb');
GM_deleteValue('auto_scrape_theporndb');
// Reload page
location.reload();
```

#### Automation Gets Stuck

**Problem**: Automation stops mid-process

**Debugging Steps**:
1. Open browser console (F12)
2. Look for error messages
3. Check which phase failed
4. Common stuck points:
   - Waiting for scraper dropdown
   - Waiting for apply button
   - Waiting for save confirmation

**Solution**:
```javascript
// Reset automation state
automationInProgress = false;
automationCancelled = true;
// Click cancel button if visible
document.querySelector('#cancel-automation')?.click();
```

#### Re-scrape Not Working

**Problem**: Re-scrape options don't appear

**Solution**:
- Ensure sources were previously scraped
- Check GraphQL connectivity
- Verify scene has stash_ids or urls

### StashBulkOperations.js

#### Selection Not Working

**Problem**: Can't select scenes

**Solution**:
```javascript
// Reset selection state
GM_deleteValue('bulk_selected_scenes');
location.reload();
```

#### Bulk Operations Fail

**Problem**: Bulk updates don't apply

**Debugging**:
```javascript
// Check GraphQL mutations
const testMutation = `
  mutation {
    sceneUpdate(input: { id: "1", title: "Test" }) {
      id
    }
  }
`;
// Test in GraphQL playground
```

### StashPerformanceMonitor.js

#### Metrics Not Showing

**Problem**: Performance data missing

**Solution**:
```javascript
// Enable performance API
if (!window.performance) {
  console.error('Performance API not available');
}
// Check sampling interval
GM_setValue('perf_sample_interval', 1000);
```

## Performance Issues

### High Memory Usage

**Symptoms**:
- Browser becomes slow
- Page freezes
- High RAM usage

**Solutions**:

1. **Reduce Cache Size**
   ```javascript
   // Clear automation history
   GM_deleteValue('automation_history');
   // Limit history size
   const MAX_HISTORY = 100;
   ```

2. **Disable Unused Scripts**
   - Only enable needed management tools
   - Disable performance monitor if not needed

3. **Optimize Settings**
   ```javascript
   // Reduce delays for faster systems
   STASH_CONFIG.REACT_RENDER_DELAY = 500; // Default: 800
   STASH_CONFIG.ELEMENT_WAIT_TIMEOUT = 5000; // Default: 8000
   ```

### Slow Automation

**Problem**: Automation takes too long

**Optimizations**:

1. **Skip Already Scraped**
   - Enable `SKIP_ALREADY_SCRAPED` setting
   - Reduces redundant API calls

2. **Reduce Delays**
   ```javascript
   // For fast systems only
   TIMING.GRAPHQL_MUTATION_DELAY = 500; // Default: 1000
   TIMING.SAVE_DELAY = 1000; // Default: 1500
   ```

3. **Disable Notifications**
   - Turn off `SHOW_NOTIFICATIONS`
   - Reduces DOM updates

## API & Network Issues

### GraphQL Connection Failed

**Problem**: Can't connect to Stash API

**Diagnostics**:
```bash
# Test GraphQL endpoint
curl -X POST http://localhost:9998/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ systemStatus { databaseSchema } }"}'
```

**Solutions**:

1. **Check Stash Address**
   ```javascript
   // Verify configuration
   GM_getValue('stash_address', 'http://localhost:9998')
   // Update if needed
   GM_setValue('stash_address', 'http://your-server:port')
   ```

2. **API Key Issues**
   ```javascript
   // Test with API key
   fetch('/graphql', {
     headers: {
       'ApiKey': 'your-api-key'
     }
   })
   ```

### Scraper API Errors

**StashDB Issues**:
```javascript
// Check StashDB connectivity
fetch('https://stashdb.org/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'ApiKey': 'your-stashdb-key'
  },
  body: JSON.stringify({ query: '{ __typename }' })
})
```

**ThePornDB Issues**:
```javascript
// Check ThePornDB connectivity
fetch('https://metadataapi.net/api/scenes', {
  headers: {
    'Authorization': 'Bearer your-token'
  }
})
```

## UI & Display Issues

### Widget Not Visible

**Problem**: Automation panel doesn't appear

**CSS Fixes**:
```css
/* Force visibility */
#stash-automation-panel {
  display: block !important;
  z-index: 99999 !important;
}

#stash-automation-widget {
  display: block !important;
  opacity: 1 !important;
}
```

### Styling Conflicts

**Problem**: UI looks broken

**Solution**:
```javascript
// Reset styles
const panel = document.querySelector('#stash-automation-panel');
if (panel) {
  panel.style.cssText = ''; // Clear inline styles
  panel.className = 'stash-automation-panel'; // Reset classes
}
```

### Dark Mode Issues

**Problem**: Text not visible in dark mode

**Fix**:
```css
/* High contrast fix */
.stash-automation-panel {
  color: #ffffff !important;
  background: rgba(0, 0, 0, 0.9) !important;
}
```

## Data & Configuration Issues

### Settings Not Persisting

**Problem**: Configuration resets

**Solutions**:

1. **Check Storage Permissions**
   ```javascript
   // Test storage
   try {
     GM_setValue('test', 'value');
     console.log('Storage works:', GM_getValue('test'));
   } catch (e) {
     console.error('Storage error:', e);
   }
   ```

2. **Export/Import Settings**
   ```javascript
   // Export current settings
   const settings = {};
   Object.keys(CONFIG).forEach(key => {
     settings[key] = GM_getValue(CONFIG[key]);
   });
   console.log('Settings:', JSON.stringify(settings));
   
   // Import settings
   Object.entries(settings).forEach(([key, value]) => {
     GM_setValue(key, value);
   });
   ```

### Corrupted Configuration

**Problem**: Script behaves erratically

**Nuclear Reset**:
```javascript
// Complete configuration reset
const configs = GM_listValues();
configs.forEach(key => GM_deleteValue(key));
console.log('All settings cleared');
location.reload();
```

## Advanced Debugging

### Enable Debug Mode

```javascript
// Add to script header
const DEBUG = true;

// Debug function
function debug(...args) {
  if (DEBUG) {
    console.log('[AutomateStash Debug]', ...args);
  }
}

// Use throughout code
debug('Element found:', element);
debug('Config loaded:', config);
```

### Performance Profiling

```javascript
// Profile automation
console.profile('Automation');
await startAutomation();
console.profileEnd('Automation');

// Measure specific operations
performance.mark('scrape-start');
await scrapeStashDB();
performance.mark('scrape-end');
performance.measure('scrape-duration', 'scrape-start', 'scrape-end');

const measures = performance.getEntriesByType('measure');
console.table(measures);
```

### DOM Inspection

```javascript
// Analyze page structure
function inspectDOM() {
  const report = {
    forms: document.querySelectorAll('form').length,
    buttons: document.querySelectorAll('button').length,
    inputs: document.querySelectorAll('input').length,
    selects: document.querySelectorAll('select').length,
    react: !!document.querySelector('[data-reactroot]'),
    panels: document.querySelectorAll('.edit-panel').length
  };
  console.table(report);
  return report;
}

inspectDOM();
```

### Network Monitoring

```javascript
// Intercept GraphQL requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('Fetch:', args[0], args[1]);
  return originalFetch.apply(this, args)
    .then(response => {
      console.log('Response:', response.status);
      return response;
    });
};
```

## Frequently Asked Questions

### Q: Why doesn't the script work on my Stash instance?

**A**: Check these common issues:
1. URL mismatch (not localhost:9998)
2. Stash version incompatibility (<0.17.0)
3. Userscript manager not installed
4. Script disabled in manager

### Q: Can I use multiple scripts simultaneously?

**A**: Yes, but be aware:
- May increase memory usage
- UI elements might overlap
- Use different keyboard shortcuts
- Disable unused scripts for performance

### Q: How do I backup my settings?

**A**: Use this script:
```javascript
// Backup all GM storage
const backup = {};
GM_listValues().forEach(key => {
  backup[key] = GM_getValue(key);
});
copy(JSON.stringify(backup)); // Copies to clipboard
console.log('Settings copied to clipboard');
```

### Q: Why do scrapers fail randomly?

**A**: Common causes:
- Rate limiting from external APIs
- Network connectivity issues
- API key expiration
- Scraper configuration changes

### Q: How do I update to a new version?

**A**: Steps:
1. Export current settings
2. Note any customizations
3. Update/reinstall script
4. Import settings
5. Test functionality

### Q: Can I modify the script safely?

**A**: Yes, but:
- Keep backups of original
- Test changes thoroughly
- Follow coding standards
- Document modifications
- Share improvements with community

## Getting Help

### Before Asking for Help

1. **Check Documentation**
   - README.md for features
   - CHANGELOG.md for recent changes
   - This troubleshooting guide

2. **Gather Information**
   ```javascript
   // System info for bug reports
   const info = {
     script: GM_info.script.version,
     browser: navigator.userAgent,
     stash: 'Check Settings > About',
     errors: 'Check browser console'
   };
   console.log(info);
   ```

3. **Try Basic Fixes**
   - Reload page (F5)
   - Hard refresh (Ctrl+Shift+R)
   - Restart browser
   - Reinstall script

### Where to Get Help

1. **GitHub Issues**
   - Search existing issues first
   - Provide complete information
   - Include console errors
   - Add screenshots if helpful

2. **Discord Community**
   - Stash Discord server
   - #support channel
   - Be patient and respectful

3. **Script Comments**
   - Greasyfork/OpenUserJS comments
   - Check for similar issues
   - Leave detailed feedback

### Reporting Bugs

**Required Information**:
```markdown
## Bug Report

**Script Version**: 4.19.1
**Browser**: Chrome 120.0.0
**Stash Version**: 0.17.0
**Operating System**: Windows 11

**Steps to Reproduce**:
1. Navigate to scene
2. Click automation button
3. Select StashDB scraper
4. Error occurs

**Expected Behavior**:
Scraping should complete

**Actual Behavior**:
Scraping fails with error

**Console Error**:
```
Error message here
```

**Screenshots**:
[If applicable]

**Additional Context**:
Any other relevant information
```

---

Remember: Most issues have simple solutions. Stay calm, be systematic, and the community is here to help!