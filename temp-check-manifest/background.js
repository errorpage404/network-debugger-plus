// Background script for handling network requests
let attachedTabs = new Map();
// Queue to store messages if panel isn't ready yet
let messageQueue = new Map(); // tabId -> array of messages
// Count requests captured by background (service workers don't have window)
let bgRequestCount = 0;

// Listen for messages from the panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'attachDebugger') {
    attachDebugger(message.tabId);
    sendResponse({ success: true });
  } else if (message.action === 'detachDebugger') {
    detachDebugger(message.tabId);
    sendResponse({ success: true });
  } else if (message.action === 'isAttached') {
    const attached = attachedTabs.has(message.tabId);
    sendResponse({ attached });
  } else if (message.action === 'reattachDebugger') {
    // Force reattach by detaching first if needed
    if (attachedTabs.has(message.tabId)) {
      detachDebugger(message.tabId);
    }
    attachDebugger(message.tabId);
    sendResponse({ success: true });
  } else if (message.action === 'panelReady') {
    // Panel is ready - send any queued messages
    const tabId = message.tabId;
    if (messageQueue.has(tabId)) {
      const queue = messageQueue.get(tabId);
      console.log('[Background] Panel ready, sending', queue.length, 'queued messages for tab', tabId);
      queue.forEach(msg => {
        chrome.runtime.sendMessage(msg).catch(() => {});
      });
      messageQueue.delete(tabId);
    }
    const queuedCount = messageQueue.has(tabId) ? messageQueue.get(tabId).length : 0;
    sendResponse({ success: true, queuedCount: queuedCount });
  }
  return true;
});

function attachDebugger(tabId) {
  if (attachedTabs.has(tabId)) {
    console.log('[Background] Debugger already attached to tab:', tabId);
    return;
  }

  console.log('[Background] Attaching debugger to tab:', tabId);
  chrome.debugger.attach({ tabId }, "1.3", () => {
    if (chrome.runtime.lastError) {
      const error = chrome.runtime.lastError.message || chrome.runtime.lastError;
      
      // Handle specific error cases
      if (error.includes('Another debugger') || error.includes('already attached')) {
        console.warn('[Background] ⚠️ Another debugger attached (likely Chrome DevTools Network tab).');
        console.warn('[Background] ⚠️ Our extension cannot capture requests while DevTools Network tab is open.');
        console.warn('[Background] ⚠️ Please CLOSE the Chrome DevTools Network tab to use this extension.');
        // Don't try to detach - that would interfere with DevTools
        // Just log the warning and return
        return;
      }
      
      console.warn('[Background] Debugger attach failed for tab', tabId, ':', error);
      return;
    }

    console.log('[Background] Debugger attached successfully, enabling domains...');
    enableDomains();
  });
  
  function enableDomains() {
    // Enable Network domain
    chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
      if (chrome.runtime.lastError) {
        console.warn('Network.enable failed:', chrome.runtime.lastError.message || chrome.runtime.lastError);
        // Detach if we can't enable Network domain
        chrome.debugger.detach({ tabId }, () => {});
        return;
      }
      
      // Enable Page domain to detect navigation
      chrome.debugger.sendCommand({ tabId }, "Page.enable", {}, () => {
        if (chrome.runtime.lastError) {
          console.warn('Page.enable failed:', chrome.runtime.lastError.message || chrome.runtime.lastError);
          // Non-critical, continue anyway
        }
      });
      
      attachedTabs.set(tabId, true);
      console.log('[Background] ✅ Debugger attached successfully to tab:', tabId);
      console.log('[Background] ✅ Network and Page domains enabled. Ready to capture events from ALL frames.');
      
      // Reset request counter when debugger attaches
      bgRequestCount = 0;
    });
  }
}

function detachDebugger(tabId) {
  if (!attachedTabs.has(tabId)) {
    return;
  }

  chrome.debugger.detach({ tabId }, () => {
    if (chrome.runtime.lastError) {
      console.error('Debugger detach failed:', chrome.runtime.lastError);
    }
    attachedTabs.delete(tabId);
    console.log('Debugger detached from tab:', tabId);
  });
}

// Listen for debugger events
chrome.debugger.onEvent.addListener((source, method, params) => {
  // Forward network and page events to the panel
  if (method.startsWith('Network.') || method.startsWith('Page.')) {
    // Log for debugging - count all requests
    if (method === 'Network.requestWillBeSent') {
      const type = params?.type || 'unknown';
      const url = params?.request?.url || 'unknown';
      bgRequestCount++;
      // Log first 20, then every 50th, and all Fetch/XHR
      const lowerType = type.toLowerCase();
      if (bgRequestCount <= 20 || bgRequestCount % 50 === 0 || lowerType === 'fetch' || lowerType === 'xhr') {
        console.log('[Background] Captured request #' + bgRequestCount + ':', type, url.substring(0, 80));
      }
    }
    
    // Send message to panel - use sendMessage with error handling
    try {
      chrome.runtime.sendMessage({
        action: 'networkEvent',
        tabId: source.tabId,
        method: method,
        params: params
      }, (response) => {
        // Check if there was an error
        if (chrome.runtime.lastError) {
          // Panel might not be open yet - queue the message
          if (!messageQueue.has(source.tabId)) {
            messageQueue.set(source.tabId, []);
          }
          messageQueue.get(source.tabId).push({
            action: 'networkEvent',
            tabId: source.tabId,
            method: method,
            params: params
          });
          
          // Log queued requests (especially Fetch/XHR)
          if (method === 'Network.requestWillBeSent') {
            const requestType = params?.type || 'unknown';
            const lowerType = requestType.toLowerCase();
            if (lowerType === 'fetch' || lowerType === 'xhr') {
              const queueSize = messageQueue.get(source.tabId)?.length || 0;
              // Log first few and then every 10th
              if (queueSize <= 3 || queueSize % 10 === 0) {
                console.log('[Background] Queued', requestType, 'request (queue size:', queueSize, ')');
              }
            }
          }
        } else {
          // Message was received successfully - panel is ready
          // Clear any queued messages since panel is now receiving directly
          if (messageQueue.has(source.tabId)) {
            const queueSize = messageQueue.get(source.tabId).length;
            if (queueSize > 0) {
              console.log('[Background] Panel is ready, clearing', queueSize, 'queued messages (panel receiving directly now)');
            }
            messageQueue.delete(source.tabId);
          }
        }
      });
    } catch (err) {
      // Ignore sendMessage errors - panel might not be open
    }
  }
});

// Detach debugger when tab is closed
chrome.debugger.onDetach.addListener((source, reason) => {
  attachedTabs.delete(source.tabId);
  console.log('Debugger detached:', reason);
});

