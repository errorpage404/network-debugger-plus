# chrome.devtools.network API Analysis

## Overview

Based on the alternatives table you provided, `chrome.devtools.network` is mentioned as a way to "retrieve information about network requests displayed in the network panel (in HAR format)" without triggering the debugger infobar.

## What We Know

### chrome.devtools.network API Methods

1. **`chrome.devtools.network.getHAR(callback)`**
   - Retrieves HAR (HTTP Archive) format data
   - Returns all network requests captured by DevTools
   - Format: Standard HAR 1.2 specification

2. **`chrome.devtools.network.onRequestFinished.addListener(callback)`**
   - Fires when a network request completes
   - Provides a `request` object with methods like `getContent()`

### Key Questions

1. **Does HAR format include request/response bodies?**
   - HAR spec says: YES, it CAN include:
     - `request.postData` (request body)
     - `response.content` (response body)
   - BUT: Chrome's implementation may not always include them

2. **Does `getHAR()` return bodies?**
   - Unknown - needs testing
   - May depend on when DevTools was opened
   - May only include bodies for requests captured after DevTools opened

3. **Does `onRequestFinished.getContent()` work?**
   - This method exists and should return response content
   - But we need to verify it works for all request types

## Potential Implementation

If this API works, we could:

```javascript
// Listen for completed requests
chrome.devtools.network.onRequestFinished.addListener((request) => {
  // Get response body
  request.getContent((content, encoding) => {
    if (content) {
      // We have response body!
      console.log('Response:', content);
    }
  });
  
  // Get request body (if POST)
  if (request.request && request.request.postData) {
    const requestBody = request.request.postData.text;
    console.log('Request body:', requestBody);
  }
});

// Or get all requests as HAR
chrome.devtools.network.getHAR((harLog) => {
  harLog.entries.forEach(entry => {
    // Check for request body
    if (entry.request.postData) {
      console.log('Request body:', entry.request.postData.text);
    }
    
    // Check for response body
    if (entry.response.content && entry.response.content.text) {
      console.log('Response body:', entry.response.content.text);
    }
  });
});
```

## Advantages

✅ **No debugger infobar** - This is the main benefit
✅ **Already in DevTools context** - We're already a DevTools panel
✅ **HAR format** - Standard format, well-documented
✅ **Real-time events** - `onRequestFinished` fires as requests complete

## Potential Limitations

❓ **Request/response body availability** - Unknown if always available
❓ **Timing** - May miss requests that happened before DevTools opened
❓ **Performance** - HAR can be large for many requests
❓ **API stability** - Less commonly used than chrome.debugger

## Testing Required

We need to test:

1. Does `onRequestFinished.getContent()` return response bodies?
2. Does `getHAR()` include request.postData for POST requests?
3. Does `getHAR()` include response.content for all responses?
4. Are there any request types that don't include bodies?
5. Does it work for requests made before DevTools opened?

## Comparison with Current Implementation

### Current (chrome.debugger):
- ✅ Always has request/response bodies
- ✅ Captures all requests (even before panel opens)
- ✅ Real-time via events
- ❌ Shows debugger infobar

### Potential (chrome.devtools.network):
- ❓ May have request/response bodies (needs testing)
- ❓ May miss early requests
- ✅ Real-time via events
- ✅ No debugger infobar

## Recommendation

**We should test this API** to see if it meets our needs:

1. Create a test implementation
2. Verify it can access request/response bodies
3. Check if it captures all requests we need
4. If it works, we can switch and remove the infobar!

## Next Steps

1. Implement a test version using `chrome.devtools.network`
2. Test with various request types (GET, POST, JSON, form data)
3. Compare functionality with current implementation
4. If successful, migrate to the new API



