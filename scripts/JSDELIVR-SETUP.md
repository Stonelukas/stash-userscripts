# jsDelivr CDN Setup for AutomateStash Enhanced

## Overview
This guide explains how to use jsDelivr CDN to load performance enhancement libraries for AutomateStash.

## How jsDelivr Works

jsDelivr is a free, fast, and reliable CDN for open source projects. It works with GitHub repositories (even private ones that become public) and provides:

- **Automatic caching** - Files are cached globally for fast delivery
- **Version control** - Pin to specific versions or use latest
- **Minification** - Optional automatic minification
- **High availability** - Multiple CDN providers with failover

## URL Format

```
https://cdn.jsdelivr.net/gh/{username}/{repo}@{version}/{file}
```

### Examples:

**Latest version from main branch:**
```javascript
// @require https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/cache-manager.js
```

**Specific version/tag:**
```javascript
// @require https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@v1.0.0/scripts/lib/cache-manager.js
```

**Specific commit:**
```javascript
// @require https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@7d865e8/scripts/lib/cache-manager.js
```

**Minified version (add .min):**
```javascript
// @require https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/cache-manager.min.js
```

## Setup Steps

### 1. Make Repository Public

jsDelivr requires the repository to be public. To make your repo public:

1. Go to your repository on GitHub
2. Click **Settings** → **General**
3. Scroll to **Danger Zone**
4. Click **Change repository visibility**
5. Select **Public**
6. Confirm the change

### 2. Wait for CDN Propagation

After making the repo public:
- New files are available immediately
- Updates to existing files may take up to 24 hours to propagate
- Use version tags or commit hashes for immediate updates

### 3. Test the URLs

Test that your files are accessible:

```bash
# Test a library file
curl https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/cache-manager.js

# Check CDN status
curl -I https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/cache-manager.js
```

### 4. Install the Userscript

1. Open Tampermonkey/Greasemonkey
2. Create new script or update existing
3. Copy `AutomateStash-Final-CDN.user.js`
4. The script will automatically load libraries from jsDelivr

## Advantages of jsDelivr

1. **No Authentication** - Works without tokens or authentication
2. **Global CDN** - Faster loading from edge locations worldwide
3. **Reliability** - 99.9% uptime with multiple CDN providers
4. **Version Control** - Easy to pin or update versions
5. **Free** - No cost for open source projects

## Purging Cache (Force Update)

If you need to force an update:

```bash
# Purge specific file
curl https://purge.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/cache-manager.js

# Then access the file normally
curl https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/cache-manager.js
```

## Alternative: Keep Repo Private

If you want to keep your repo private, you can:

1. **Use GitHub Gists** - Create public gists for library files
2. **Use unpkg.com** - Publish libraries as npm packages
3. **Self-host** - Host files on your own server
4. **Use local files** - Use file:// protocol for personal use

## Current Library URLs

All performance libraries are loaded from:

```javascript
// Configuration
https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/config/performance-config.js
https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/config/ui-config.js

// Libraries
https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/cache-manager.js
https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/performance-enhancer.js
https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/ui-theme-manager.js
https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/animation-controller.js
https://cdn.jsdelivr.net/gh/Stonelukas/stash-userscripts@main/scripts/lib/keyboard-shortcuts.js
```

## Troubleshooting

### Libraries not loading?

1. **Check repo visibility** - Must be public
2. **Check file paths** - Paths are case-sensitive
3. **Check browser console** - Look for 404 errors
4. **Try purging cache** - Use purge URL above
5. **Test direct access** - Open CDN URL in browser

### Performance issues?

1. **Use specific versions** - Avoid @main for production
2. **Enable browser caching** - Don't disable cache in DevTools
3. **Check CDN status** - https://www.jsdelivr.com/network

### Version mismatch?

1. **Use commit hash** - Most reliable for testing
2. **Use tags** - Create releases for stable versions
3. **Purge cache** - Force update after changes

## Best Practices

1. **Version your releases** - Use semantic versioning
2. **Test before deploying** - Verify CDN URLs work
3. **Document dependencies** - List all required libraries
4. **Monitor performance** - Check load times
5. **Have fallbacks** - Consider local copies for critical use

## Support

- jsDelivr Documentation: https://www.jsdelivr.com/documentation
- jsDelivr Status: https://status.jsdelivr.com/
- GitHub: https://github.com/jsdelivr/jsdelivr