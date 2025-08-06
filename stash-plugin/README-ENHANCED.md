# AutomateStash Plugin - Enhanced Version

## Version 4.5.0 - GraphQL Integration & Original UI

This enhanced version adds robust GraphQL API integration and recreates the original userscript's UI with the purple gradient panel and status summary cards.

## New Features

### GraphQL API Integration
- **Scene Status Detection**: Uses Stash's GraphQL API to detect scene metadata status
- **API Key Support**: Configure your Stash API key in settings for authenticated requests  
- **Robust Detection**: Falls back to DOM-based detection if API is unavailable
- **Real-time Updates**: Status widget updates automatically as automation progresses

### Original UI Recreation
- **Purple Gradient Panel**: Beautiful gradient background matching the original userscript
- **Status Summary Cards**: Visual cards showing StashDB/ThePornDB/Organized status
- **Progress Bar**: Visual completion percentage with smooth animations
- **Status Icons**: Clear visual indicators for each metadata source

### Enhanced Status Tracking
- **Cross-Scene Intelligence**: Optional setting to use GraphQL for accurate status detection
- **Historical Data**: Tracks which sources have been scraped for skip functionality
- **Visual Progress**: Real-time progress updates with percentage completion
- **Error Handling**: Graceful fallback when API is unavailable

## Configuration

### API Key Setup
1. Open AutomateStash settings (gear icon)
2. Enter your Stash API key in the "API Key" field
3. Click "Test Connection" to verify
4. Enable "Enable Cross-Scene Intelligence" for GraphQL-based detection

### Getting Your API Key
1. In Stash, go to Settings → Security
2. Generate or copy your API key
3. Paste it in the AutomateStash settings

## UI Components

### Status Summary Widget
The status widget shows:
- **StashDB Status**: ✅ Scraped, ❌ Not Scraped, ⏳ Processing
- **ThePornDB Status**: ✅ Scraped, ❌ Not Scraped, ⏳ Processing  
- **Organized Status**: ✅ Organized, ❌ Not Organized

### Progress Bar
- Yellow: Automation in progress
- Green: 100% complete
- Updates in real-time as tasks complete

## Technical Details

### GraphQL Queries
The plugin uses these GraphQL queries:
- `FindScene`: Get scene details including scraped_json
- Scene metadata fields: title, date, performers, studio, tags

### Timing Improvements
- Matches original userscript timing exactly
- 3-second wait for StashDB
- 5-second wait for ThePornDB
- Integrated entity creation in scraping flow

### Storage
- Uses localStorage for settings persistence
- Stores API key securely
- Maintains automation history

## Troubleshooting

### API Connection Issues
- Verify API key is correct
- Check Stash server is running
- Test connection in settings
- Check browser console for errors

### Status Not Updating
- Enable "Cross-Scene Intelligence" in settings
- Ensure API key is configured
- Check network tab for GraphQL requests

## Migration from Compact Version

To use the enhanced version:
1. The plugin YAML has been updated to use `automate-stash-enhanced.js`
2. Your settings will be preserved
3. Configure API key for full functionality
4. Enjoy the improved UI and reliability!

## Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: Untested but should work

## Performance
- Minimal overhead from GraphQL queries
- Efficient DOM updates
- Smart caching of status data
- No impact on Stash server performance