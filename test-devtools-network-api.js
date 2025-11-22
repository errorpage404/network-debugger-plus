// Test script to check if chrome.devtools.network can access request/response bodies
// This would be added to panel.js to test the API

// Test 1: Try to get HAR data
chrome.devtools.network.getHAR((harLog) => {
  console.log('HAR Log:', harLog);
  
  if (harLog && harLog.entries && harLog.entries.length > 0) {
    const firstEntry = harLog.entries[0];
    console.log('First entry:', firstEntry);
    
    // Check if request body is available
    if (firstEntry.request && firstEntry.request.postData) {
      console.log('✅ Request body available:', firstEntry.request.postData);
    } else {
      console.log('❌ Request body NOT available');
    }
    
    // Check if response body is available
    if (firstEntry.response && firstEntry.response.content) {
      console.log('✅ Response body available:', firstEntry.response.content);
    } else {
      console.log('❌ Response body NOT available');
    }
  }
});

// Test 2: Listen for request finished events
chrome.devtools.network.onRequestFinished.addListener((request) => {
  console.log('Request finished:', request);
  
  // Try to get request body
  request.getContent((content, encoding) => {
    if (content) {
      console.log('✅ Response content available:', content.substring(0, 100));
    } else {
      console.log('❌ Response content NOT available');
    }
  });
  
  // Check if request has postData
  if (request.request && request.request.postData) {
    console.log('✅ Request postData available:', request.request.postData);
  } else {
    console.log('❌ Request postData NOT available');
  }
});



