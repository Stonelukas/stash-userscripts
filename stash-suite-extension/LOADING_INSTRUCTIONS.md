# How to Load the Stash Suite Extension

## Quick Start

1. **Open Chrome/Edge Extension Management**
   - Navigate to `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
   - Enable "Developer mode" toggle in the top right

2. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to and select the `stash-suite-extension` folder
   - Click "Select Folder"

3. **Verify Installation**
   - You should see "Stash Suite" in your extensions list
   - The extension icon should appear in your toolbar
   - No errors should be displayed

4. **Test the Extension**
   - Navigate to your Stash instance: http://localhost:9998
   - Click the Stash Suite icon in your toolbar
   - You should see the popup with tool toggles

## Troubleshooting

### "Could not load manifest" Error
✅ **Fixed**: Icon files are now properly created

### Extension Not Appearing
- Make sure Developer mode is enabled
- Check that you selected the correct folder (contains manifest.json)
- Look for any error messages in the extension card

### Tools Not Working
- Ensure Stash is running on http://localhost:9998
- Check the browser console for errors (F12)
- Try refreshing the Stash page

## Next Steps

Once loaded successfully:
1. Enable the tools you want to use via the popup
2. Configure settings as needed
3. The AutomateStash tool is fully functional
4. Other tools are placeholders ready for conversion