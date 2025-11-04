// Background script for handling network requests
let attachedTabs = new Map();

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
  }
  return true;
});

function attachDebugger(tabId) {
  if (attachedTabs.has(tabId)) {
    return;
  }

  chrome.debugger.attach({ tabId }, "1.3", () => {
    if (chrome.runtime.lastError) {
      const error = chrome.runtime.lastError.message || chrome.runtime.lastError;
      
      // Handle specific error cases
      if (error.includes('Another debugger') || error.includes('already attached')) {
        // Another extension or DevTools is using the debugger
        // Try to detach first, then reattach
        chrome.debugger.detach({ tabId }, () => {
          // Retry attach after a short delay
          setTimeout(() => {
            chrome.debugger.attach({ tabId }, "1.3", enableDomains);
          }, 100);
        });
        return;
      }
      
      console.warn('Debugger attach failed for tab', tabId, ':', error);
      return;
    }

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
      console.log('Debugger attached successfully to tab:', tabId);
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
    chrome.runtime.sendMessage({
      action: 'networkEvent',
      tabId: source.tabId,
      method: method,
      params: params
    }).catch(() => {
      // Panel might not be open, ignore error
    });
  }
});

// Detach debugger when tab is closed
chrome.debugger.onDetach.addListener((source, reason) => {
  attachedTabs.delete(source.tabId);
  console.log('Debugger detached:', reason);
});

