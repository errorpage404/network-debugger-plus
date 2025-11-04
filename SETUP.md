# Quick Setup Guide

## Getting Started in 3 Steps

### 1. Load the Extension

1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle switch in top-right)
4. Click **Load unpacked** button
5. Select the `network-inspector-extension` folder
6. Done! ✅

### 2. Open DevTools

1. Visit any website (e.g., https://example.com)
2. Open Chrome DevTools:
   - Press `F12`, or
   - Right-click → **Inspect**, or
   - Menu → More Tools → Developer Tools
3. Look for the **"Network Debugger Plus"** tab in DevTools
4. Click on it to open the extension

**Note**: Chrome should remember which DevTools panel you were on and reopen to it. If you click on Network Debugger Plus once, Chrome will typically default to it next time you open DevTools (per window).

### 3. Start Inspecting

- The extension will automatically start capturing network requests
- Use the filter box to search for specific requests
- Click on any request to view its details
- **Refresh the page** to clear requests and start fresh

## First Time Use

When you first load the extension:

1. You'll see a warning about the debugger - this is normal
2. Click "Allow" or "OK" when Chrome asks to attach the debugger
3. Refresh the page you're inspecting to see requests

## Adding Icons (Optional)

Icons are optional for development, but if you want them:

1. Create three PNG images:
   - 16x16 pixels → save as `icons/icon16.png`
   - 48x48 pixels → save as `icons/icon48.png`
   - 128x128 pixels → save as `icons/icon128.png`

2. Or use an online icon generator:
   - Visit https://www.favicon-generator.org/
   - Upload any image
   - Download the generated icons
   - Rename and place in the `icons/` folder

3. Uncomment the icons section in `manifest.json`:
```json
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
```

## Testing the Extension

1. **Test Basic Capture**:
   - Navigate to https://jsonplaceholder.typicode.com/
   - You should see API requests appear

2. **Test Filtering**:
   - Type "json" in the filter box
   - Only requests with "json" in URL should show
   - Close DevTools and reopen - filter text should still be there!

3. **Test Details View**:
   - Click on any request
   - View Headers, Payload, and Response tabs
   - JSON responses should display as a tree
   - Form data (POST requests) should display as key-value table
   - Click on "Payload" tab, then click another request - should open to Payload tab!
   - Try dragging the divider between panels to resize the details panel

4. **Test Recording Toggle**:
   - Click "⏺ Recording" button to pause
   - Navigate to new pages - no requests captured
   - Click "⏸ Paused" to resume recording

5. **Test Auto-Clear on Refresh**:
   - Capture some requests
   - Press F5 to refresh the page
   - Request list should automatically clear
   - New requests from the page load appear

6. **Test Dark Mode**:
   - Click the 🌙 button in the header
   - Extension switches to dark theme
   - Click ☀️ to switch back
   - Preference is saved automatically!

## Common Issues

**Q: Extension doesn't appear in DevTools**
- Reload the extension in chrome://extensions/
- Close and reopen DevTools

**Q: No requests showing**
- Check recording is enabled (green button)
- Refresh the webpage
- Check browser console for errors

**Q: "Cannot attach debugger" error**
- Only one debugger can attach at a time
- Close other debugging sessions
- Reload the extension

**Q: Details panel is blank**
- Wait a moment for the response to load
- Some requests may not have payloads
- Check the console for JavaScript errors

## Next Steps

- Read the full [README.md](README.md) for complete documentation
- Customize the extension to your needs
- Add new features as required

## Need Help?

Check the browser console:
1. Right-click on the extension panel
2. Select "Inspect"
3. Look for error messages in the console

