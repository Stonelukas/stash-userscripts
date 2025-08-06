# AutomateStash Plugin Installation Guide

## Quick Install

1. **Find your Stash plugins directory:**
   - Windows: `C:\Users\[YourUsername]\.stash\plugins\`
   - Linux/Mac: `~/.stash/plugins/`
   - Or check where your Stash `config.yml` file is located

2. **Create the plugin folder:**
   ```bash
   cd ~/.stash/plugins/  # or your plugins directory
   mkdir AutomateStash
   cd AutomateStash
   ```

3. **Copy these files into the AutomateStash folder:**
   - `automate-stash.yml`
   - `automate-stash-compact.js`
   - `automate-stash.css`

4. **In Stash:**
   - Go to **Settings** → **Plugins**
   - Click **Reload Plugins**
   - You should see "AutomateStash" in the installed plugins list

## Verify Installation

1. Navigate to any scene page in Stash
2. Look for the AutomateStash widget in the top-right corner
3. If you don't see it, check the browser console (F12) for errors

## Troubleshooting

### Widget Not Appearing
- Make sure all 3 files are in the plugins/AutomateStash directory
- Check that file names match exactly (case-sensitive on Linux/Mac)
- Try hard refresh (Ctrl+F5 or Cmd+Shift+R)

### JavaScript Errors
- Open browser console (F12)
- Look for any red error messages
- Common issue: "Failed to execute 'querySelector'" - This has been fixed in the latest version

### Plugin Not Listed
- Ensure the YAML file is valid (no syntax errors)
- Check Stash logs for plugin loading errors
- Try restarting Stash

## Updating from Browser Extension

If you were using the browser extension version:

1. You can disable/remove the browser extension
2. The plugin uses localStorage, so settings won't transfer automatically
3. You'll need to reconfigure your preferences in the plugin settings

## File Structure

Your plugins directory should look like this:
```
.stash/
└── plugins/
    └── AutomateStash/
        ├── automate-stash.yml
        ├── automate-stash-compact.js
        └── automate-stash.css
```

## Next Steps

Once installed, see the main README.md for usage instructions.