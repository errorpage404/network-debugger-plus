// Background script for handling network requests
let attachedTabs = new Map();
// Queue to store messages if panel isn't ready yet
let messageQueue = new Map(); // tabId -> array of messages
// Store port connections from DevTools panels
let panelPorts = new Map(); // tabId -> port
// Count requests captured by background (service workers don't have window)
let bgRequestCount = 0;

// Handle action icon click (for color icon display in extensions menu)
chrome.action.onClicked.addListener((tab) => {
  // DevTools extension - just log that user should open DevTools
  console.log('[Network Debugger Plus] Open Chrome DevTools (F12) and look for the "Network Debugger Plus" tab to use this extension.');
});

// Handle persistent port connections from DevTools panels
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'devtools-panel') {
    console.log('[Background] DevTools panel connected via port');
    
    // Listen for messages from the panel
    port.onMessage.addListener((message) => {
      if (message.action === 'panelReady') {
        const tabId = message.tabId;
        console.log('[Background] Panel ready via port for tab:', tabId);
        
        // Store the port connection
        panelPorts.set(tabId, port);
        
        // Send any queued messages through the port
        if (messageQueue.has(tabId)) {
          const queue = messageQueue.get(tabId);
          console.log('[Background] Sending', queue.length, 'queued messages via port for tab', tabId);
          queue.forEach(msg => {
            try {
              port.postMessage(msg);
            } catch (err) {
              console.error('[Background] Error sending queued message via port:', err);
            }
          });
          messageQueue.delete(tabId);
        }
        
        // Send confirmation
        try {
          port.postMessage({ action: 'panelReadyConfirmed', queuedCount: messageQueue.has(tabId) ? messageQueue.get(tabId).length : 0 });
        } catch (err) {
          console.error('[Background] Error sending confirmation:', err);
        }
      }
    });
    
    // Handle port disconnect
    port.onDisconnect.addListener(() => {
      console.log('[Background] DevTools panel disconnected');
      // Remove port from map
      for (const [tabId, p] of panelPorts.entries()) {
        if (p === port) {
          panelPorts.delete(tabId);
          console.log('[Background] Removed port for tab:', tabId);
          break;
        }
      }
    });
  }
});

// Listen for messages from the panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.action, 'for tab:', message.tabId);
  
  if (message.action === 'attachDebugger') {
    console.log('[Background] Processing attachDebugger request for tab:', message.tabId);
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
      console.log('[Background] ✅✅✅ DEBUGGER FULLY CONFIGURED ✅✅✅');
      console.log('[Background] ✅ Tab ID:', tabId);
      console.log('[Background] ✅ Network domain: ENABLED');
      console.log('[Background] ✅ Page domain: ENABLED');
      console.log('[Background] ✅ Ready to capture events from ALL frames');
      console.log('[Background] ========================================');
      console.log('[Background] 📡 Now navigate to a website to see network requests');
      console.log('[Background] 📡 You should see "🔔🔔🔔 DEBUGGER EVENT RECEIVED" messages when requests are made');
      console.log('[Background] ⚠️ IMPORTANT: Make sure Chrome DevTools Network tab is NOT active');
      console.log('[Background] ⚠️ Only the "Network Debugger Plus" tab should be active/selected');
      console.log('[Background] ========================================');
      
      // Reset request counter when debugger attaches
      bgRequestCount = 0;
      globalThis._bgTotalEvents = 0; // Reset event counter
      
      // Note: Removed Runtime.evaluate test command to reduce detectability
      // Websites can detect debugger attachment through various means,
      // so we avoid running any code in the page context
      
      // Set a timeout to check if we're receiving events
      setTimeout(() => {
        if (globalThis._bgTotalEvents === 0) {
          console.error('[Background] ⚠️⚠️⚠️ NO DEBUGGER EVENTS RECEIVED AFTER 5 SECONDS ⚠️⚠️⚠️');
          console.error('[Background] This usually means:');
          console.error('[Background] 1. Chrome DevTools Network tab is active (switch to Network Debugger Plus tab)');
          console.error('[Background] 2. No network requests are being made (try navigating to a website)');
          console.error('[Background] 3. Debugger is not receiving events (check for errors above)');
        }
      }, 5000);
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
    // Clean up port connection if it exists
    if (panelPorts.has(tabId)) {
      panelPorts.delete(tabId);
      console.log('[Background] Removed port connection for tab:', tabId);
    }
    console.log('Debugger detached from tab:', tabId);
  });
}

// Listen for debugger events
chrome.debugger.onEvent.addListener((source, method, params) => {
  // Log that we received ANY event from debugger (first few only)
  // Note: Service workers don't have window, use globalThis or module-level variables
  if (!globalThis._bgTotalEvents) globalThis._bgTotalEvents = 0;
  globalThis._bgTotalEvents++;
  if (globalThis._bgTotalEvents <= 10) {
    console.log('[Background] 🔔🔔🔔 DEBUGGER EVENT RECEIVED 🔔🔔🔔');
    console.log('[Background] 📨 Event #' + globalThis._bgTotalEvents + ':', method, 'from tab:', source.tabId);
  }
  
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
        console.log('[Background] 📡 Captured request #' + bgRequestCount + ':', type, url.substring(0, 80));
      }
    }
    
    // Send message to panel - prefer port connection, fallback to sendMessage
    const message = {
      action: 'networkEvent',
      tabId: source.tabId,
      method: method,
      params: params
    };
    
    try {
      // First, try to send via port connection (more reliable for DevTools panels)
      const port = panelPorts.get(source.tabId);
      if (port) {
        try {
          port.postMessage(message);
          // Log successful sends (first few only)
          if (!globalThis._bgSuccessCount) globalThis._bgSuccessCount = 0;
          globalThis._bgSuccessCount++;
          if (globalThis._bgSuccessCount <= 5 && method === 'Network.requestWillBeSent') {
            console.log('[Background] ✅ Successfully sent network event via port:', method);
          }
          return; // Successfully sent via port, exit early
        } catch (portErr) {
          // Port might be disconnected, remove it and fall through to sendMessage
          console.warn('[Background] Port send failed, removing port:', portErr);
          panelPorts.delete(source.tabId);
        }
      }
      
      // Fallback to sendMessage if no port connection
      chrome.runtime.sendMessage(message, (response) => {
        // Check if there was an error
        if (chrome.runtime.lastError) {
          // Panel might not be open yet - queue the message
          if (!messageQueue.has(source.tabId)) {
            messageQueue.set(source.tabId, []);
          }
          messageQueue.get(source.tabId).push(message);
          
          // Log queued requests (especially Fetch/XHR)
          if (method === 'Network.requestWillBeSent') {
            const requestType = params?.type || 'unknown';
            const lowerType = requestType.toLowerCase();
            if (lowerType === 'fetch' || lowerType === 'xhr') {
              const queueSize = messageQueue.get(source.tabId)?.length || 0;
              // Log first few and then every 10th
              if (queueSize <= 3 || queueSize % 10 === 0) {
                console.log('[Background] ⏳ Queued', requestType, 'request (queue size:', queueSize, ')');
              }
            }
          }
          
          // Log first few errors to help diagnose
          if (!globalThis._bgErrorCount) globalThis._bgErrorCount = 0;
          globalThis._bgErrorCount++;
          if (globalThis._bgErrorCount <= 5) {
            console.warn('[Background] ⚠️ Failed to send network event to panel:', chrome.runtime.lastError.message, 'Event:', method);
          }
        } else {
          // Message was received successfully - panel is ready
          // Clear any queued messages since panel is now receiving directly
          if (messageQueue.has(source.tabId)) {
            const queueSize = messageQueue.get(source.tabId).length;
            if (queueSize > 0) {
              console.log('[Background] ✅ Panel is ready, clearing', queueSize, 'queued messages (panel receiving directly now)');
            }
            messageQueue.delete(source.tabId);
          }
          
          // Log successful sends (first few only)
          if (!globalThis._bgSuccessCount) globalThis._bgSuccessCount = 0;
          globalThis._bgSuccessCount++;
          if (globalThis._bgSuccessCount <= 5 && method === 'Network.requestWillBeSent') {
            console.log('[Background] ✅ Successfully sent network event to panel:', method);
          }
        }
      });
    } catch (err) {
      console.error('[Background] ❌ Error sending network event:', err);
    }
  }
});

// Detach debugger when tab is closed
chrome.debugger.onDetach.addListener((source, reason) => {
  attachedTabs.delete(source.tabId);
  console.log('Debugger detached:', reason);
});

