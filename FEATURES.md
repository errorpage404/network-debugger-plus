# Feature Reference

## Core Features

### 🔍 Smart Filtering

**URL Search**
- Type any keyword in the filter input
- Searches only in request URLs
- Case-insensitive matching
- Real-time filtering as you type
- **Filter persists** when DevTools is closed and reopened

**Examples**:
- `api` - Find all requests with "api" in URL
- `json` - Find all JSON-related endpoints
- `user` - Find user-related endpoints
- `auth` - Find authentication requests
- `/v2/` - Find all v2 API endpoints

### 📊 Request List View

**Columns**:
1. **Method** - HTTP method with color coding:
   - 🔵 GET (blue)
   - 🟢 POST (green)
   - 🟠 PUT (orange)
   - 🔴 DELETE (red)
   - 🟣 PATCH (purple)

2. **Name** - Endpoint name (last part of URL path)
   - Example: `https://api.example.com/users/123` → `123`
   - Example: `https://www.kbb.com/pixall/v2/event` → `event`
   - Hover to see the complete URL

3. **Status** - HTTP status code:
   - ✅ 2xx (green) - Success
   - 🟡 3xx (orange) - Redirect
   - ❌ 4xx/5xx (red) - Error
   - ⏳ Pending - Still loading

4. **Type** - Content type (json, html, javascript, css, image, etc.)

5. **Size** - Response size in B, KB, or MB

### 📋 Request Details Panel

Click any request to view detailed information **immediately** in three tabs:

**Real-time Updates:**
- Details panel opens instantly when you click a request
- Shows available information right away (URL, method, request headers)
- Loading indicators (⏳) show for data still being fetched
- Automatically updates as response data arrives
- No need to click again or wait for page to finish loading!

**Tab Preference:**
- Remembers which tab you prefer (Headers, Payload, or Response)
- Click on Payload tab → next request automatically opens to Payload tab
- Preference persists across DevTools sessions

**Resizable Panel:**
- Drag the divider to resize the details panel
- Smooth dragging experience with visual feedback
- Green highlight on hover and during drag
- Width constrained between 300px and 80% of screen
- Size preference saved automatically

#### 1. Headers Tab
- **General Info**:
  - Request URL
  - Request Method
  - Status Code
  - Content Type
  - Response Size

- **Request Headers**: All headers sent with the request
- **Response Headers**: All headers received from server

#### 2. Payload Tab
Shows the request body (POST data, form data, etc.) with automatic parsing:
- **Form data** (application/x-www-form-urlencoded) → Parsed into clean key-value table
- **JSON payloads** (application/json) → Interactive tree view with expand/collapse
- **JSON within form data** → Automatically detected and rendered as tree view
- **Multipart form data** → Parsed and displayed as key-value pairs
- **Plain text** → Displayed as-is with syntax preservation
- **Binary data** → Base64 encoded display

**Smart Detection**: 
- Automatically detects content type and displays in the best format
- Detects JSON strings within form values and renders them as interactive trees
- Example: If a form field contains `{"user":"john"}`, it shows as an expandable tree!

#### 3. Response Tab
Shows the response body:
- **JSON responses** → Interactive tree view with expand/collapse
- **HTML** → Raw HTML display
- **Plain text** → Formatted text
- **Images** → Base64 encoded (future: inline preview)

### 🌳 JSON Tree View

**Features**:
- ▶/▼ Toggle to expand/collapse objects and arrays
- Color-coded syntax:
  - 🟣 Keys (purple)
  - 🔴 Strings (red)
  - 🔵 Numbers (blue)
  - 🟢 Booleans (blue/green)
  - ⚫ Null (gray)
- Shows array lengths: `[5]` means 5 items
- Deep nesting support
- Works in both payloads AND form data values
- Easy to scan and navigate

**Smart JSON Detection**:
- Automatically detects JSON in request/response bodies
- Also detects JSON strings within form field values
- Renders nested JSON beautifully no matter where it appears

**Tree Interaction**:
- Click any ▶ to expand that level
- Click ▼ to collapse
- Nested objects can be independently expanded/collapsed

### 🎛️ Controls

**Recording Button**
- 🟢 "⏺ Recording" (green) - Actively capturing requests
- 🔴 "⏸ Paused" (red) - Paused, not capturing new requests
- Click to toggle recording state

**Clear Button**
- Clears all captured requests
- Resets the request list
- Closes the details panel

**Automatic Clear**
- 🔄 Request list automatically clears when you refresh the page or navigate to a new URL
- Only main frame navigation triggers clear (iframes are ignored)
- Provides a clean slate for each page load

**Close Details Button** (✕)
- Closes the request details panel
- Returns focus to request list

## Advanced Usage

### Filtering Strategies

**Find API calls**:
```
Filter: api
Result: Shows all URLs containing "api"
```

**Find specific endpoints**:
```
Filter: /users
Result: Shows all user-related endpoints
```

**Find by version**:
```
Filter: /v2/
Result: Shows all v2 API endpoints
```

**Find specific resources**:
```
Filter: event
Result: Shows URLs like /pixall/v2/event
```

**Find by domain**:
```
Filter: kbb.com
Result: Shows all requests to kbb.com
```

### Debugging Workflows

**1. Debug Failed Requests**
- Look for red status codes in the list
- Click to view error details
- Check response body for error messages

**2. Inspect API Payloads**
- Filter for your API endpoint
- Click on POST/PUT requests
- View Payload tab to see what's being sent
- View Response tab to see server's response

**3. Check Authentication**
- Filter: `auth` or `token`
- Check Headers tab
- Look for Authorization, Cookie headers

**4. Monitor Specific Resources**
- Use filter to isolate specific files
- Watch for caching (304 status)
- Check response sizes

**5. Analyze JSON APIs**
- Filter for `.json` or `api`
- Click on responses
- Use tree view to explore data structure
- Verify payload format

## Technical Details

### Request Capture
- Uses Chrome Debugger API
- Captures all HTTP/HTTPS requests
- Records timing information
- Retrieves request/response bodies
- Supports all modern web protocols

### Performance
- Efficient event handling
- Minimal memory footprint
- Real-time filtering (no lag)
- Handles hundreds of requests
- Automatic cleanup on clear

### Limitations
- One debugger per tab (Chrome restriction)
- WebSocket monitoring (future feature)
- Binary data shown as base64
- Very large responses may be truncated by Chrome

## Keyboard Shortcuts (Future)

Planned keyboard shortcuts:
- `Ctrl+F` - Focus filter input
- `Escape` - Clear filter / Close details
- `Up/Down` - Navigate request list
- `Enter` - Open selected request
- `Ctrl+R` - Toggle recording

## Tips & Tricks

1. **Instant Details**: Click any request immediately - don't wait for the page to finish loading! You'll see what's available right away.

2. **Dark Mode**: Toggle dark mode with the 🌙/☀️ button - perfect for low-light environments!

3. **Resizable Panels**: Drag the divider between panels to adjust the details panel size to your liking!

4. **Tab Memory**: Click on Payload or Response tab once, and all future requests will open to that tab automatically!

5. **Persistent Filter**: Your filter text is automatically saved - close and reopen DevTools and it's still there!

6. **Filter as You Type**: The filter works in real-time as new requests come in

7. **Details Stay Open**: Navigate to other requests while details panel is open

8. **Full URL on Hover**: Hover over any endpoint name to see the complete URL in a tooltip

9. **Partial Matching**: Type part of a URL path to find matches (e.g., "user" finds "/api/users")

10. **Status Colors**: Quickly spot errors by scanning for red status codes

11. **Size Analysis**: Sort mentally by size to find large responses

12. **Reload for Fresh Start**: Requests automatically clear on page refresh for a clean slate

13. **Focus on Current Page**: Each navigation gives you a fresh view of that page's requests

## Common Use Cases

✅ Debugging AJAX calls
✅ Inspecting REST API requests
✅ Checking authentication tokens
✅ Analyzing GraphQL queries
✅ Monitoring third-party API calls
✅ Debugging CORS issues
✅ **Inspecting form submissions** (login, signup, etc.)
✅ **Viewing POST data in readable format**
✅ Checking request payloads
✅ Verifying response formats
✅ Finding slow requests
✅ Checking caching behavior

## Future Enhancements

- [ ] Export as HAR file
- [ ] Request replay
- [ ] Custom filter presets
- [ ] Dark mode
- [ ] Keyboard navigation
- [ ] Request comparison
- [ ] Response preview (images, HTML)
- [ ] WebSocket support
- [ ] Performance timing waterfall
- [ ] Request grouping by domain

