# AutomateStash Plugin for Stash

A native Stash plugin that automates metadata scraping and scene organization.

## Features

- **Automated Metadata Scraping**: Automatically scrape from StashDB and ThePornDB
- **Smart Skip Logic**: Skip already scraped sources to save time
- **Entity Creation**: Auto-create new performers, studios, and tags
- **Scene Organization**: Mark scenes as organized after processing
- **Configurable Settings**: Customize automation behavior
- **Clean UI**: Modern, minimalist interface with dark theme
- **Global Availability**: Widget accessible throughout the entire Stash application

## Installation

1. Navigate to your Stash plugins directory:
   - Windows: `%USERPROFILE%\.stash\plugins\`
   - Linux/Mac: `~/.stash/plugins/`
   - Or wherever your Stash config.yml is located

2. Create a new directory called `AutomateStash`:
   ```bash
   mkdir AutomateStash
   ```

3. Copy the plugin files into the directory:
   - `automate-stash.yml`
   - `automate-stash-compact.js`
   - `automate-stash.css`

4. In Stash, go to **Settings** > **Plugins**

5. Click **Reload Plugins**

6. AutomateStash should now appear in your installed plugins list

## Usage

### Scene Pages
1. Navigate to any scene page in Stash
2. The AutomateStash widget will appear in the top-right corner
3. Click **Start Automation** to begin the automated process
4. The plugin will:
   - Open the edit panel
   - Scrape metadata from configured sources
   - Create any new performers/studios/tags
   - Apply the scraped data
   - Save the scene
   - Mark it as organized (if enabled)

### Non-Scene Pages
- The widget appears as a minimized button on non-scene pages
- Click it to access settings
- Widget automatically minimizes on already organized scenes

### Settings

Click the gear icon (⚙️) to access settings:

- **Auto-scrape StashDB**: Enable/disable StashDB scraping
- **Auto-scrape ThePornDB**: Enable/disable ThePornDB scraping
- **Auto-create new performers/studios/tags**: Automatically create new entities
- **Auto-organize scenes**: Mark scenes as organized after processing
- **Show notifications**: Display progress notifications
- **Minimize when complete**: Auto-minimize widget after completion
- **Auto-apply changes**: Apply changes without confirmation dialogs
- **Skip already scraped sources**: Skip sources that already have data

## Advantages Over Browser Extension

1. **Native Integration**: Direct access to Stash UI without browser extension overhead
2. **Simple Installation**: Just copy files to plugins directory
3. **Cross-Browser**: Works in any browser without extension support
4. **No Permissions**: No browser permissions to manage
5. **Automatic Updates**: Can be updated through Stash's plugin system

## Troubleshooting

### Widget Not Appearing
- Make sure you've reloaded plugins in Stash settings
- Check browser console for any JavaScript errors
- Verify all three files are in the plugin directory

### Automation Not Working
- Ensure you're on a scene page
- Check that edit buttons are visible and accessible
- Look for any error notifications
- Check browser console for detailed error messages

### Settings Not Saving
- Settings are stored in browser localStorage
- Try clearing browser cache if settings won't persist
- Check browser console for storage errors

## Technical Details

This plugin is converted from the original AutomateStash userscript to use Stash's native plugin system. Key changes:

- Replaced `GM_getValue/GM_setValue` with localStorage
- Removed userscript headers and grants
- Adapted for direct JavaScript injection
- Maintained all core functionality

## Version History

- **4.4.0**: Initial plugin version, converted from userscript
  - Full automation workflow
  - Configurable settings
  - Global widget availability
  - Smart minimization for organized scenes

## Credits

Based on the original AutomateStash userscript suite.