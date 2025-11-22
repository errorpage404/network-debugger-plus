# Network Debugger Plus Extension

A powerful Chrome DevTools extension for inspecting network requests with advanced filtering and payload visualization capabilities.

## Features

- 🔍 **Advanced Filtering**: Filter network requests by URL, headers, or method
- 📊 **Request Details**: View comprehensive request and response information
- 🌳 **JSON Tree View**: Automatically parse and display JSON payloads in an interactive tree structure
- 📋 **Form Data Parser**: Parse and display form data (URL-encoded/multipart) in clean key-value tables
- ⚡ **Real-time Monitoring**: Capture network activity as it happens
- 🔄 **Auto-Clear on Refresh**: Request list automatically clears when page is refreshed or navigated
- 🎯 **Smart Search**: Find specific requests by keywords in URLs or headers
- 📦 **Payload Viewer**: Inspect request and response payloads with syntax highlighting

## Installation

### Step 1: Prepare Icons (Temporary)

Before loading the extension, you need to create placeholder icons:

1. Open `icons/create-icons.html` in your browser
2. Screenshot the three colored squares (16x16, 48x48, 128x128)
3. Save them as:
   - `icons/icon16.png`
   - `icons/icon48.png`
   - `icons/icon128.png`

**Alternative**: You can create simple PNG images with any image editor or skip this step and comment out the "icons" section in `manifest.json`.

### Step 2: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `network-inspector-extension` folder
5. The extension should now appear in your extensions list

### Step 3: Use the Extension

1. Open Chrome DevTools (F12 or Right-click → Inspect)
2. Look for the **Network Debugger Plus** tab in DevTools
3. Navigate to any website to see network requests being captured
4. Use the filter box to search for specific requests

## Usage Guide

### Filtering Requests

- **Text Filter**: Type keywords in the filter input to search request URLs
- **Real-time Filtering**: Results update as you type
- **Persistent Filter**: Your filter text is saved and restored when you reopen DevTools
- Case-insensitive matching for easier searching

### Viewing Request Details

1. Click on any request in the list - **details show immediately!**
2. View three tabs:
   - **Headers**: General info, request headers, and response headers
   - **Payload**: Request body/form data (JSON displayed as tree)
   - **Response**: Response body (JSON displayed as tree)
3. Data updates in real-time as it loads (no need to click again)
4. Loading indicators show when data is still being fetched
5. **Tab preference remembered** - click Payload tab and all future requests open to Payload!

### JSON Tree View

- JSON payloads are automatically parsed and displayed as an interactive tree
- Click the ▶/▼ arrows to expand/collapse objects and arrays
- Color-coded syntax highlighting for easy reading

## Project Structure

```
network-inspector-extension/
├── manifest.json           # Extension configuration
├── background.js           # Service worker for network capture
├── devtools.html          # DevTools integration entry
├── devtools.js            # DevTools panel creator
├── panel.html             # Main UI layout
├── panel.js               # UI logic and event handling
├── styles/
│   └── panel.css          # Styling for the extension
├── utils/
│   ├── jsonTreeView.js    # JSON tree visualization
│   └── requestManager.js  # Request data management
├── icons/                 # Extension icons
└── README.md              # This file
```

## Technical Details

### Permissions

The extension requires the following permissions:
- `webRequest`: To monitor network requests
- `activeTab`: To access the current tab
- `debugger`: To capture detailed network information via Chrome DevTools Protocol

### Chrome DevTools Protocol

This extension uses the Chrome Debugger API to:
- Attach to the inspected tab
- Enable Network domain monitoring
- Capture detailed request/response data including payloads

## Features Breakdown

### 1. Network Monitoring
- Captures all HTTP/HTTPS requests
- Records request/response headers
- Retrieves request and response bodies
- Tracks request status and timing
- Automatically clears on page navigation/refresh
- Ignores iframe navigations (only clears on main frame navigation)

### 2. Filtering System
- Real-time text-based filtering by URL
- Persistent filter text (saved across DevTools sessions)
- Case-insensitive matching
- Filter applies to full URL path

### 3. Tab Preference Memory
- Remembers your preferred details tab (Headers, Payload, or Response)
- Click Payload tab once → all future requests open to Payload
- Persists across DevTools sessions
- Saves your workflow preference automatically

### 4. Resizable Panels
- Drag the divider between request list and details panel to resize
- Adjust panel width to your preference
- Minimum width: 300px, Maximum: 80% of screen
- Width preference saved automatically
- Visual feedback on hover and drag (green highlight)

### 5. Dark Mode
- Toggle dark mode with 🌙/☀️ button in header
- VS Code-inspired dark theme with proper contrast
- Preference saved automatically
- Dark-optimized JSON syntax highlighting
- Perfect for low-light development sessions

### 6. Request Details View
- **General Information**: URL, method, status, content type, size
- **Request Headers**: All headers sent with the request
- **Response Headers**: All headers received in the response
- **Payload Tab**: View request body (POST data, form data)
- **Response Tab**: View response body

### 7. Smart Payload Viewer
**Form Data Parser:**
- Automatically detects form-encoded data
- Displays as clean key-value table
- Supports application/x-www-form-urlencoded
- Supports multipart/form-data
- **Auto-detects JSON within form values** and renders as tree
- Hover-friendly rows

**JSON Tree Viewer:**
- Automatically detects JSON content (in payloads AND form values)
- Expandable/collapsible tree structure
- Syntax highlighting
- Handles nested objects and arrays
- Works recursively for JSON within form data
- Copy-friendly display

## Development

### Modifying the Extension

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Network Debugger Plus extension
4. Reload DevTools to see changes

### File Responsibilities

- **manifest.json**: Extension metadata and permissions
- **background.js**: Manages debugger attachment and network event forwarding
- **devtools.js**: Creates the DevTools panel
- **panel.html/js**: Main UI and interaction logic
- **requestManager.js**: Handles request storage and filtering
- **jsonTreeView.js**: Renders JSON as interactive tree
- **panel.css**: All styling and layout

## Troubleshooting

### Extension not appearing in DevTools
- Make sure the extension is enabled in `chrome://extensions/`
- Reload the DevTools (close and reopen)

### No requests showing
- Check if recording is enabled (button should show "⏺ Recording")
- Make sure the debugger attached successfully (check console for errors)
- Try refreshing the page you're inspecting

### "Debugger attach failed" error
- Only one debugger can be attached at a time
- Close any other DevTools extensions using the debugger
- Reload the extension

### DevTools opens to Elements instead of Network Debugger Plus
- This is Chrome's default behavior - extensions cannot control which panel opens by default
- Chrome usually remembers the last panel you were on (per window)
- Simply click on the Network Debugger Plus tab once, and Chrome should default to it next time

### No requests showing in Incognito Mode
- **Extensions are disabled in incognito mode by default**
- To enable the extension in incognito mode:
  1. Go to `chrome://extensions/`
  2. Find "Network Debugger Plus"
  3. Click **"Details"**
  4. Enable **"Allow in incognito"**
- After enabling, the extension will work in incognito windows
- Note: The debugger API works the same way in incognito mode once enabled

### Website Detects Extension and Blocks Loading
Some websites can detect when a debugger is attached and may refuse to load or behave differently. This is a limitation of using the Chrome Debugger API.

**Why this happens:**
- Websites can detect debugger attachment through timing analysis, performance API checks, or other fingerprinting techniques
- Some anti-bot/anti-debugging systems block pages when debuggers are detected
- This is a security feature some websites use to prevent automated access

**What we've done to reduce detectability:**
- Removed test commands that execute code in the page context
- The extension only enables Network and Page domains (doesn't modify page behavior)
- No code is injected into the page itself

**Workarounds:**
1. **Temporarily disable the extension** for that specific website:
   - Go to `chrome://extensions/`
   - Click "Details" on Network Debugger Plus
   - Use "Site access" to block the extension for specific sites
   
2. **Use Chrome's built-in Network tab** instead (if the site blocks debugger extensions)

3. **Contact the website owner** - Some sites may whitelist legitimate debugging tools

**Note:** This is a known limitation of debugger-based extensions. The extension is designed to be as non-intrusive as possible, but some websites will still detect it.

## Future Enhancements

Possible features to add:
- Export requests as HAR file
- Request replay functionality
- Custom filter presets
- WebSocket monitoring
- Performance metrics
- Request comparison
- Dark mode

## License

This project is open source and available for modification and distribution.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this extension.

