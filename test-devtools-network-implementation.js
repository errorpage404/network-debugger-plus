/**
 * Test Implementation: chrome.devtools.network API
 * 
 * This is a test to see if we can use chrome.devtools.network instead of chrome.debugger
 * to avoid the infobar notification.
 * 
 * To test:
 * 1. Add this code to panel.js (temporarily)
 * 2. Comment out the chrome.debugger code
 * 3. Open DevTools and navigate to a page with POST requests
 * 4. Check console logs to see if request/response bodies are available
 */

// Test if chrome.devtools.network is available
if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.network) {
  console.log('✅ chrome.devtools.network API is available');
  
  // Test 1: Listen for request finished events
  chrome.devtools.network.onRequestFinished.addListener((request) => {
    console.log('📡 Request finished:', request.request.url);
    console.log('   Method:', request.request.method);
    console.log('   Status:', request.response.status);
    
    // Try to get request body (POST data)
    if (request.request.postData) {
      console.log('✅ REQUEST BODY AVAILABLE:', request.request.postData.text || request.request.postData);
    } else {
      console.log('❌ REQUEST BODY NOT AVAILABLE');
    }
    
    // Try to get response body
    request.getContent((content, encoding) => {
      if (content) {
        console.log('✅ RESPONSE BODY AVAILABLE (length:', content.length, 'encoding:', encoding, ')');
        console.log('   Preview:', content.substring(0, 200));
      } else {
        console.log('❌ RESPONSE BODY NOT AVAILABLE');
      }
    });
  });
  
  // Test 2: Get HAR data
  chrome.devtools.network.getHAR((harLog) => {
    if (harLog && harLog.entries) {
      console.log('📊 HAR Log contains', harLog.entries.length, 'entries');
      
      // Check first few entries for bodies
      harLog.entries.slice(0, 5).forEach((entry, index) => {
        console.log(`\nEntry ${index + 1}:`, entry.request.url);
        
        // Check request body
        if (entry.request.postData) {
          console.log('  ✅ Request body in HAR:', entry.request.postData.text ? 'YES' : 'NO');
        } else {
          console.log('  ❌ Request body NOT in HAR');
        }
        
        // Check response body
        if (entry.response && entry.response.content && entry.response.content.text) {
          console.log('  ✅ Response body in HAR:', entry.response.content.text.length, 'bytes');
        } else {
          console.log('  ❌ Response body NOT in HAR');
        }
      });
    }
  });
  
  console.log('🧪 Test listeners registered. Navigate to a page and make some requests to test.');
  
} else {
  console.error('❌ chrome.devtools.network API is NOT available');
  console.log('Available APIs:', Object.keys(chrome.devtools || {}));
}



