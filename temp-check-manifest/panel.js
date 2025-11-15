/**
 * Main Panel Script
 * Handles UI interactions and network event processing
 */

let requestManager;
let isRecording = true;
let selectedRequestId = null;
let tabId;
let isResizing = false;
let isPanelActive = true;
let startX = 0;
let startWidth = 0;
let isResizingFormColumn = false;
let startFormX = 0;
let startKeyWidth = 0;
let isResizingHighlightColumn = false;
let startHighlightX = 0;
let startHighlightWidth = 0;
let isResizingColumn = false;
let resizingColumnName = null;
let startColumnX = 0;
let startColumnWidth = 0;
let pageStartTime = null; // Time when page navigation started
let domContentLoadedTime = null; // DOMContentLoaded event time
let loadTime = null; // Load event time

// Set up message listener function - defined as const to ensure it's available
const setupMessageListener = function() {
  try {
    if (!tabId) {
      console.warn('[Panel] Cannot set up message listener - tabId not set');
      return;
    }
    console.log('[Panel] Setting up message listener for tab:', tabId);
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Return true to indicate we will send a response asynchronously
      // This keeps the message channel open
      const willRespondAsync = true;
      
      if (message.action === 'networkEvent') {
        if (message.tabId !== tabId) {
          // Different tab, ignore
          sendResponse({ received: false, reason: 'wrongTab' });
          return willRespondAsync;
        }
        
        if (!isRecording) {
          console.log('[Skipped] Recording is paused, ignoring event:', message.method);
          sendResponse({ received: false, reason: 'paused' });
          return willRespondAsync;
        }
        
        // Log that we received the message (only for Fetch/XHR to reduce spam)
        if (message.method === 'Network.requestWillBeSent') {
          const type = message.params?.type || 'unknown';
          const url = message.params?.request?.url || 'unknown';
          const lowerType = type.toLowerCase();
          if (lowerType === 'fetch' || lowerType === 'xhr') {
            console.log('[Panel] Received', type, 'request:', url.substring(0, 60));
          }
          // Also log a count of all Network.requestWillBeSent messages received
          if (!window._requestCount) window._requestCount = 0;
          window._requestCount++;
          if (window._requestCount % 10 === 0 || lowerType === 'fetch' || lowerType === 'xhr') {
            console.log('[Panel] Total Network.requestWillBeSent messages received:', window._requestCount);
          }
        }
        
        // Handle the network event
        try {
          handleNetworkEvent(message.method, message.params);
          sendResponse({ received: true, processed: true });
        } catch (err) {
          console.error('[Panel] Error handling network event:', err);
          sendResponse({ received: true, processed: false, error: err.message });
        }
      } else {
        sendResponse({ received: false, reason: 'unknownAction' });
      }
      
      return willRespondAsync;
    });
    console.log('[Panel] Message listener set up successfully');
  } catch (err) {
    // Ignore errors if extension context is invalidated
    console.error('[Error] Setting up message listener:', err);
  }
};

// Initialize the panel
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Check if extension context is still valid
    if (typeof chrome === 'undefined' || !chrome.devtools || !chrome.devtools.inspectedWindow) {
      console.warn('Extension context not available during initialization');
      return;
    }
    
    requestManager = new RequestManager();
    tabId = chrome.devtools.inspectedWindow.tabId;
    pageStartTime = Date.now(); // Initialize page start time
    
    // CRITICAL: Set up message listener FIRST, before anything else
    // This ensures we don't miss any early requests
    // (tabId is now set, so this will work)
    setupMessageListener();
    
    // Notify background that panel is ready to receive messages
    // Use sendMessage with callback to see if queue was sent
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({ action: 'panelReady', tabId: tabId }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[Panel] Failed to notify background:', chrome.runtime.lastError.message);
          } else if (response) {
            console.log('[Panel] Background confirmed panel ready. Queued messages:', response.queuedCount || 0);
          }
        });
      }
    } catch (err) {
      console.warn('[Panel] Error notifying background:', err);
    }
    
    initializeUI();
    setupEventListeners();
    
    // Attach debugger immediately - this is critical for capturing early requests
    attachDebugger();
    
    // Also try to attach after a short delay in case the first attempt fails
    setTimeout(() => {
      console.log('[Panel] Ensuring debugger is attached...');
      ensureDebuggerAttached();
    }, 100);
    
    // Check again after a longer delay
    setTimeout(ensureDebuggerAttached, 500);
    
    updateFooterStats(); // Initialize footer
    
    // Log request count periodically to debug AND display in UI
    setInterval(() => {
      const count = requestManager.getAllRequests().length;
      const fetchXhrCount = requestManager.getAllRequests().filter(r => {
        const t = (r.type || '').toLowerCase();
        return t === 'fetch' || t === 'xhr';
      }).length;
      
             // Log summary every 5 seconds
             if (!window._lastLogTime || Date.now() - window._lastLogTime > 5000) {
               const totalCaptured = window._totalCaptured || 0;
               const skippedOwn = window._skippedOwnExtension || 0;
               const skippedOther = window._skippedExtension || 0;
               const duplicates = window._duplicateRequestIds ? window._duplicateRequestIds.size : 0;
               const redirects = window._redirectCount || 0;
               const noUrl = window._noUrlRequests || 0;
               const notAdded = window._notAddedCount || 0;
               console.log('[Panel] Summary - Total requests:', count, 'Fetch/XHR:', fetchXhrCount, 
                         '| Messages received:', window._requestCount || 0,
                         '| Frame requests:', window._frameRequestCount || 0,
                         '| Total captured (before filter):', totalCaptured,
                         '| Skipped (own extension):', skippedOwn,
                         '| Skipped (other extensions):', skippedOther,
                         '| Duplicate requestIds:', duplicates,
                         '| Redirects:', redirects,
                         '| No URL requests:', noUrl,
                         '| Not added (duplicates):', notAdded);
               window._lastLogTime = Date.now();
             }
      
      // Header text is static now - no need to update it
    }, 1000);
  } catch (err) {
    // Handle context invalidation or other initialization errors gracefully
    if (err && err.message && !err.message.includes('Extension context invalidated')) {
      console.warn('Error during panel initialization:', err.message || err);
    }
  }
});

function initializeUI() {
  // Set up initial UI state
  updateRecordingButton();
  
  // Set filter to only search by URL
  requestManager.setFilter('url', true);
  requestManager.setFilter('headers', false);
  requestManager.setFilter('method', false);
  
  // Restore filter text from localStorage
  const savedFilter = localStorage.getItem('networkInspectorFilter');
  if (savedFilter) {
    const filterInput = document.getElementById('filterInput');
    filterInput.value = savedFilter;
    requestManager.setFilter('text', savedFilter);
  }
  
  // Restore dark mode preference
  const isDarkMode = localStorage.getItem('networkInspectorDarkMode') === 'true';
  const darkModeBtn = document.getElementById('darkModeBtn');
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    updateDarkModeButton(true);
  } else {
    // Set initial moon button class
    darkModeBtn.classList.add('moon-btn');
  }
}

function setupEventListeners() {
  try {
    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        requestManager.clearRequests();
        selectedRequestId = null;
        pageStartTime = Date.now();
        domContentLoadedTime = null;
        loadTime = null;
        renderRequestList();
        updateFooterStats();
        hideRequestDetails();
      });
    }

    // Dark mode button
    const darkModeBtn = document.getElementById('darkModeBtn');
    if (darkModeBtn) {
      darkModeBtn.addEventListener('click', () => {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        localStorage.setItem('networkInspectorDarkMode', isDarkMode.toString());
        updateDarkModeButton(isDarkMode);
      });
    }

    // Record button
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => {
        isRecording = !isRecording;
        updateRecordingButton();
      });
    }

    // Reattach when panel regains focus or becomes visible
    try {
      window.addEventListener('focus', ensureDebuggerAttached);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          ensureDebuggerAttached();
        }
      });
    } catch (err) {
      // Ignore errors setting up visibility listeners
    }

    // Filter input with localStorage persistence
    const filterInput = document.getElementById('filterInput');
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        const filterValue = e.target.value;
        requestManager.setFilter('text', filterValue);
        // Save to localStorage
        localStorage.setItem('networkInspectorFilter', filterValue);
        renderRequestList();
      });
    }

    // Filter buttons (type filters)
    try {
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const filterType = e.target.getAttribute('data-filter');
          if (filterType) {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Set filter
            requestManager.setFilter('type', filterType);
            
            // Save to localStorage
            localStorage.setItem('networkInspectorTypeFilter', filterType);
            
            // Re-render list
            renderRequestList();
            updateFooterStats();
          }
        });
      });
      
      // Restore saved type filter
      const savedTypeFilter = localStorage.getItem('networkInspectorTypeFilter');
      if (savedTypeFilter) {
        const savedBtn = document.querySelector(`.filter-btn[data-filter="${savedTypeFilter}"]`);
        if (savedBtn) {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          savedBtn.classList.add('active');
          requestManager.setFilter('type', savedTypeFilter);
        }
      }
    } catch (err) {
      // Ignore errors if filter buttons don't exist yet
      if (err && err.message && !err.message.includes('Extension context invalidated')) {
        console.warn('Error setting up filter buttons:', err.message);
      }
    }

    // Close details button
    const closeDetailsBtn = document.getElementById('closeDetailsBtn');
    if (closeDetailsBtn) {
      closeDetailsBtn.addEventListener('click', () => {
        hideRequestDetails();
      });
    }

    // Details search input - highlight matching text
    const detailsSearchInput = document.getElementById('detailsSearchInput');
    const detailsSearchClear = document.getElementById('detailsSearchClear');
    
    if (detailsSearchInput) {
      // Show/hide clear button based on input value
      const updateClearButton = () => {
        if (detailsSearchClear) {
          if (detailsSearchInput.value.trim()) {
            detailsSearchClear.classList.add('visible');
          } else {
            detailsSearchClear.classList.remove('visible');
          }
        }
      };
      
      detailsSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();
        updateClearButton();
        if (searchTerm) {
          highlightTextInDetails(searchTerm);
        } else {
          clearHighlights();
        }
      });
      
      // Clear button click handler
      if (detailsSearchClear) {
        detailsSearchClear.addEventListener('click', () => {
          detailsSearchInput.value = '';
          detailsSearchClear.classList.remove('visible');
          clearHighlights();
          detailsSearchInput.focus();
        });
      }
      
      // Initial state
      updateClearButton();
    }

    // Tab buttons
    try {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          switchTab(e.target.dataset.tab);
        });
      });
    } catch (err) {
      // Ignore if tab buttons don't exist yet
    }

    // Resize handle
    try {
      setupResizeHandle();
    } catch (err) {
      // Silently fail if setupResizeHandle errors during extension reload
      if (err && err.message && !err.message.includes('Extension context invalidated')) {
        console.warn('Error setting up resize handle:', err.message);
      }
    }
  } catch (err) {
    // Handle context invalidation errors gracefully
    if (err && err.message && !err.message.includes('Extension context invalidated')) {
      console.warn('Error setting up event listeners:', err.message || err);
    }
  }
  
  // Use event delegation on request list for better reliability
  try {
    const requestListEl = document.getElementById('requestList');
    if (requestListEl) {
      requestListEl.addEventListener('click', (e) => {
        // Find the closest request item
        const requestItem = e.target.closest('.request-item');
        if (requestItem) {
          const requestId = requestItem.getAttribute('data-request-id');
          if (requestId) {
            e.preventDefault();
            e.stopPropagation();
            
            selectedRequestId = requestId;
            showRequestDetails(requestId);
            renderRequestList();
          }
        }
      });
    }
  } catch (err) {
    // Ignore errors setting up request list listener
  }

  // Message listener is already set up earlier in initialization
  
  // Listen for ESC key to cancel pending requests
  try {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        cancelPendingRequests();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Only handle arrow keys if we're not typing in an input field
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        );
        
        if (!isInputFocused && selectedRequestId) {
          e.preventDefault();
          navigateToAdjacentRequest(e.key === 'ArrowDown' ? 1 : -1);
        }
      }
    });
  } catch (err) {
    // Ignore errors if extension context is invalidated
  }
}

function updateRecordingButton() {
  const btn = document.getElementById('recordBtn');
  if (isRecording) {
    btn.textContent = '⏺ Recording';
    btn.classList.remove('recording');
    btn.classList.add('btn-primary');
  } else {
    btn.textContent = '⏸ Paused';
    btn.classList.add('recording');
    btn.classList.remove('btn-primary');
  }
}

function updateDarkModeButton(isDarkMode) {
  const btn = document.getElementById('darkModeBtn');
  btn.textContent = isDarkMode ? '☀️' : '🌙';
  btn.title = isDarkMode ? 'Toggle light mode' : 'Toggle dark mode';
  
  // Add/remove class for styling
  if (isDarkMode) {
    btn.classList.remove('moon-btn');
    btn.classList.add('sun-btn');
  } else {
    btn.classList.remove('sun-btn');
    btn.classList.add('moon-btn');
  }
}

function safeSendMessage(message, callback) {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          // Log error but don't spam console
          if (message.action === 'attachDebugger') {
            console.warn('[Panel] Failed to send attachDebugger message:', chrome.runtime.lastError.message);
          }
        }
        if (callback) callback(response);
      });
    }
  } catch (err) {
    // Happens when DevTools reloads or extension context is invalidated; ignore
    console.warn('Skipping sendMessage; extension context not available');
  }
}

function attachDebugger() {
  console.log('[Panel] Attempting to attach debugger for tab:', tabId);
  safeSendMessage({
    action: 'attachDebugger',
    tabId: tabId
  });
  
  // Log current request count after a short delay to see if we're capturing
  setTimeout(() => {
    const count = requestManager.getAllRequests().length;
    console.log('[Panel] Current request count after attach:', count);
  }, 1000);
}

async function ensureDebuggerAttached() {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;
    chrome.runtime.sendMessage({ action: 'isAttached', tabId }, (resp) => {
      // If service worker was restarted, resp may be undefined briefly; try attaching
      const attached = resp && resp.attached;
      if (!attached) {
        safeSendMessage({ action: 'attachDebugger', tabId });
      }
    });
  } catch (_) {
    // Best-effort attach
    safeSendMessage({ action: 'reattachDebugger', tabId });
  }
}

function handleNetworkEvent(method, params) {
  // Log all network events for debugging
  if (method.startsWith('Network.')) {
    console.log('[Network Event]', method, params?.requestId || params?.request?.url || '', 'Type:', params?.type || params?.request?.type || 'N/A');
  }
  
  switch (method) {
    case 'Network.requestWillBeSent':
      handleRequestWillBeSent(params);
      break;
    case 'Network.responseReceived':
      handleResponseReceived(params);
      break;
    case 'Network.loadingFinished':
      handleLoadingFinished(params);
      break;
    case 'Network.loadingFailed':
      handleLoadingFailed(params);
      break;
    case 'Network.requestWillBeSentExtraInfo':
      handleRequestExtraInfo(params);
      break;
    case 'Network.responseReceivedExtraInfo':
      handleResponseExtraInfo(params);
      break;
    case 'Network.requestServedFromCache':
      handleRequestServedFromCache(params);
      break;
    case 'Page.frameNavigated':
      handlePageNavigated(params);
      break;
    case 'Page.domContentEventFired':
      handleDOMContentLoaded(params);
      break;
    case 'Page.loadEventFired':
      handleLoadEvent(params);
      break;
    default:
      // Log unhandled events for debugging
      if (method.startsWith('Network.') || method.startsWith('Page.')) {
        console.log('[Unhandled Event]', method);
      }
      break;
  }
}

function handleRequestWillBeSent(params) {
  const { requestId, request, timestamp, type, frameId, redirectResponse } = params;
  
  // Validate that we have the required data
  if (!request || !requestId) {
    console.warn('[Panel] Invalid requestWillBeSent event - missing request or requestId:', { requestId, hasRequest: !!request });
    return;
  }
  
  // Handle redirects: if this is a redirect, the redirectResponse field will be present
  // Chrome reuses the same requestId for redirects, so we need to handle this specially
  if (redirectResponse) {
    // This is a redirect - log it for debugging
    if (!window._redirectCount) window._redirectCount = 0;
    window._redirectCount++;
    if (window._redirectCount <= 5) {
      console.log('[Redirect] RequestId:', requestId, 'From:', redirectResponse.url?.substring(0, 60), 'To:', request.url?.substring(0, 60));
    }
    // Update the existing request with redirect info, but keep the original URL in history
    const existingRequest = requestManager.getRequest(requestId);
    if (existingRequest) {
      // Update the request with the new URL (redirect destination)
      requestManager.updateRequest(requestId, {
        url: request.url, // New URL after redirect
        redirectFrom: existingRequest.url, // Original URL
        redirectResponse: redirectResponse,
        redirected: true
      });
      // Don't add as a new request - just update the existing one
      renderRequestList();
      updateFooterStats();
      return;
    }
  }
  
  // Some requests might not have a URL (e.g., data URLs, blob URLs, or internal requests)
  // But we should still capture them if they have a requestId
  if (!request.url) {
    // Log but still try to capture (some requests might not have URLs)
    if (!window._noUrlRequests) window._noUrlRequests = 0;
    window._noUrlRequests++;
    if (window._noUrlRequests <= 3) {
      console.log('[Panel] Request without URL:', { requestId, method: request.method, type });
    }
    // Continue anyway - we'll use requestId as the identifier
  }
  
  // Only skip our own extension's requests - don't filter chrome:// or devtools://
  // Chrome DevTools shows these, so we should too
  if (request.url && request.url.startsWith('chrome-extension://')) {
    try {
      const extensionId = chrome.runtime.id;
      if (request.url.includes(extensionId)) {
        // Only log first few to reduce spam
        if (!window._skippedOwnExtension) window._skippedOwnExtension = 0;
        window._skippedOwnExtension++;
        if (window._skippedOwnExtension <= 3) {
          console.log('[Skipped] Our own extension request:', request.url);
        }
        return;
      }
      // This is from another extension - we'll include it to match DevTools behavior
      // (DevTools shows all extension requests)
    } catch (e) {
      // If we can't get extension ID, skip all chrome-extension:// requests to be safe
      if (!window._skippedExtension) window._skippedExtension = 0;
      window._skippedExtension++;
      if (window._skippedExtension <= 3) {
        console.log('[Skipped] Chrome extension request (can\'t verify ID):', request.url);
      }
      return;
    }
  }
  
  // Log frame info for debugging
  if (frameId) {
    // This request is from a frame - log it to see if we're capturing iframe requests
    if (!window._frameRequestCount) window._frameRequestCount = 0;
    window._frameRequestCount++;
    if (window._frameRequestCount <= 5 || window._frameRequestCount % 20 === 0) {
      console.log('[Frame Request] Frame ID:', frameId, 'Type:', type, 'URL:', request.url?.substring(0, 60));
    }
  }
  
  // Log all captured requests for debugging (reduce spam)
  if (!window._totalCaptured) window._totalCaptured = 0;
  window._totalCaptured++;
  if (window._totalCaptured <= 10 || window._totalCaptured % 50 === 0) {
    console.log('[Captured Request #' + window._totalCaptured + ']', {
      requestId,
      url: request.url?.substring(0, 60),
      method: request.method,
      type: type,
      frameId: frameId || 'main'
    });
  }
  
  // Check if this requestId already exists (could be a redirect or retry)
  const existingRequest = requestManager.getRequest(requestId);
  if (existingRequest) {
    // This is a duplicate requestId - log it for debugging
    if (!window._duplicateRequestIds) window._duplicateRequestIds = new Set();
    if (!window._duplicateRequestIds.has(requestId)) {
      window._duplicateRequestIds.add(requestId);
      console.log('[Duplicate RequestId]', requestId, 'Existing URL:', existingRequest.url?.substring(0, 60), 'New URL:', request.url?.substring(0, 60));
    }
  }
  
  // Always add the request, even if URL is missing
  try {
    const beforeCount = requestManager.getAllRequests().length;
    requestManager.addRequest(requestId, {
      url: request.url || `(no URL) ${requestId}`,
      method: request.method || 'GET',
      requestHeaders: request.headers,
      timestamp: timestamp,
      type: type || 'other',
      status: null,
      postData: request.postData,
      hasPostData: request.hasPostData,
      frameId: frameId
    });

    const afterCount = requestManager.getAllRequests().length;
    const wasAdded = afterCount > beforeCount;
    
    // Log if request wasn't added (duplicate requestId) or for debugging
    if (!wasAdded) {
      if (!window._notAddedCount) window._notAddedCount = 0;
      window._notAddedCount++;
      if (window._notAddedCount <= 5) {
        console.log('[Not Added] Duplicate requestId:', requestId, 'URL:', request.url?.substring(0, 60), 'Type:', type);
      }
    }
    
    // Log total requests after adding (only for first 20 or every 20th, or if not added)
    if (window._totalCaptured <= 20 || window._totalCaptured % 20 === 0 || !wasAdded) {
      console.log('[After Add] Total requests in manager:', afterCount, '| Just added:', wasAdded, '| URL:', (request.url || requestId)?.substring(0, 50));
    }
  } catch (err) {
    console.error('[Panel] Error adding request to manager:', err, { requestId, url: request.url, type });
  }

  renderRequestList();
  updateFooterStats();
}

function handleResponseReceived(params) {
  const { requestId, response, timestamp, type } = params;
  
  // Update request with response data, preserving type if it wasn't set earlier
  const existingRequest = requestManager.getRequest(requestId);
  requestManager.updateRequest(requestId, {
    status: response.status,
    statusText: response.statusText,
    responseHeaders: response.headers,
    mimeType: response.mimeType,
    responseTimestamp: timestamp,
    // Preserve existing type if available, otherwise use type from response
    type: existingRequest?.type || type
  });

  renderRequestList();
  updateFooterStats();
  
  // Update details if this request is selected
  if (selectedRequestId === requestId) {
    showRequestDetails(requestId);
  }
}

function handleLoadingFinished(params) {
  const { requestId, encodedDataLength } = params;
  
  requestManager.updateRequest(requestId, {
    size: encodedDataLength,
    finished: true
  });

  // Fetch response body
  chrome.debugger.sendCommand(
    { tabId: tabId },
    'Network.getResponseBody',
    { requestId: requestId },
    (response) => {
      if (!chrome.runtime.lastError && response) {
        requestManager.updateRequest(requestId, {
          responseBody: response.body,
          responseBase64Encoded: response.base64Encoded
        });
        
        // Update details if this request is selected
        if (selectedRequestId === requestId) {
          showRequestDetails(requestId);
        }
      }
    }
  );

  renderRequestList();
  updateFooterStats();
}

function handleRequestServedFromCache(params) {
  const { requestId } = params;
  
  // Mark the request as served from cache
  const existingRequest = requestManager.getRequest(requestId);
  if (existingRequest) {
    requestManager.updateRequest(requestId, {
      servedFromCache: true,
      cached: true
    });
    
    // Update details if this request is selected
    if (selectedRequestId === requestId) {
      showRequestDetails(requestId);
    }
    
    renderRequestList();
  } else {
    // Request not found - this might be a cached request that never triggered requestWillBeSent
    // Unfortunately, we can't create a request entry without the requestWillBeSent event
    // This is a limitation of the Debugger API - cached requests don't always trigger requestWillBeSent
    if (!window._cachedWithoutRequest) window._cachedWithoutRequest = 0;
    window._cachedWithoutRequest++;
    if (window._cachedWithoutRequest <= 5) {
      console.log('[Cached Without Request] RequestId:', requestId, '- This request was served from cache but never triggered requestWillBeSent');
    }
  }
}

function handleLoadingFailed(params) {
  const { requestId, errorText } = params;
  
  // Check if request was canceled/aborted (user canceled, navigation, etc.)
  const isCanceled = errorText && (
    errorText.includes('ERR_ABORTED') || 
    errorText.includes('net::ERR_ABORTED') ||
    errorText.toLowerCase().includes('canceled') ||
    errorText.toLowerCase().includes('aborted')
  );
  
  requestManager.updateRequest(requestId, {
    failed: true,
    canceled: isCanceled,
    errorText: errorText,
    status: isCanceled ? '(canceled)' : 'Failed'
  });

  // Update details if this request is selected
  if (selectedRequestId === requestId) {
    showRequestDetails(requestId);
  }

  renderRequestList();
  updateFooterStats();
}

function cancelPendingRequests() {
  if (!isPanelActive) return;
  
  try {
    const allRequests = requestManager.getAllRequests();
    let canceledCount = 0;
    
    // Find all pending requests (not finished, not failed, not already canceled, and no status or status is 'Pending')
    allRequests.forEach(request => {
      const isPending = !request.finished && 
                       !request.failed && 
                       !request.canceled && 
                       (!request.status || request.status === 'Pending');
      
      if (isPending) {
        requestManager.updateRequest(request.requestId, {
          canceled: true,
          status: '(canceled)',
          failed: true
        });
        canceledCount++;
      }
    });
    
    // Update UI if any requests were canceled
    if (canceledCount > 0) {
      // Update details if selected request was canceled
      if (selectedRequestId) {
        const selectedRequest = requestManager.getRequest(selectedRequestId);
        if (selectedRequest && selectedRequest.canceled) {
          showRequestDetails(selectedRequestId);
        }
      }
      
      renderRequestList();
    }
  } catch (err) {
    // Silently fail if there's an error
    if (err && err.message && !err.message.includes('Extension context invalidated')) {
      console.warn('Error canceling pending requests:', err.message);
    }
  }
}

function handleRequestExtraInfo(params) {
  const { requestId, headers } = params;
  requestManager.updateRequest(requestId, {
    requestHeaders: { ...requestManager.getRequest(requestId)?.requestHeaders, ...headers }
  });
}

function handleResponseExtraInfo(params) {
  const { requestId, headers } = params;
  requestManager.updateRequest(requestId, {
    responseHeaders: { ...requestManager.getRequest(requestId)?.responseHeaders, ...headers }
  });
}

function handlePageNavigated(params) {
  const { frame } = params;
  
  // Only clear on main frame navigation (page refresh/navigation)
  // Ignore iframe navigations
  if (!frame.parentId) {
    // Clear requests on navigation to match Chrome DevTools behavior
    // This gives us a fresh count for each page load
    console.log('Page navigated, clearing requests');
    requestManager.clearRequests();
    selectedRequestId = null;
    pageStartTime = Date.now();
    domContentLoadedTime = null;
    loadTime = null;
    renderRequestList();
    updateFooterStats();
    hideRequestDetails();
    
    // Ensure debugger is attached immediately after navigation
    // This is critical to capture early requests
    setTimeout(() => {
      ensureDebuggerAttached();
    }, 10);
  }
}

function handleDOMContentLoaded(params) {
  if (!pageStartTime) {
    pageStartTime = Date.now();
  }
  domContentLoadedTime = Date.now();
  updateFooterStats();
}

function handleLoadEvent(params) {
  if (!pageStartTime) {
    pageStartTime = Date.now();
  }
  loadTime = Date.now();
  updateFooterStats();
}

function formatTime(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) {
    return Math.round(ms) + ' ms';
  } else if (ms < 60000) {
    return (Math.round(ms / 10) / 100).toFixed(2) + ' s';
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return minutes + ' min ' + seconds + ' s';
  }
}

function formatResourceType(type) {
  if (!type) return 'unknown';
  
  // Convert to lowercase for consistency, then capitalize first letter
  const lowerType = type.toLowerCase();
  
  // Map common types to display names
  const typeMap = {
    'fetch': 'fetch',
    'xhr': 'xhr',
    'document': 'doc',
    'stylesheet': 'css',
    'script': 'js',
    'image': 'img',
    'font': 'font',
    'media': 'media',
    'websocket': 'ws',
    'manifest': 'manifest',
    'texttrack': 'texttrack',
    'eventsource': 'eventsource',
    'other': 'other',
    'ping': 'ping'
  };
  
  return typeMap[lowerType] || lowerType;
}

function updateFooterStats() {
  try {
    const stats = requestManager.getStatistics();
    
    // Check if any filter is active
    const hasTextFilter = requestManager.filters?.text && requestManager.filters.text.trim().length > 0;
    const hasTypeFilter = requestManager.filters?.type && requestManager.filters.type !== 'all';
    const isFiltering = hasTextFilter || hasTypeFilter;
    
    // Get filtered and total counts
    const totalRequests = requestManager.getAllRequests().length;
    const filteredRequests = isFiltering ? requestManager.getFilteredRequests().length : totalRequests;
    
    // Update requests count - show "x / total" if filtering, otherwise just total
    const requestsEl = document.getElementById('footerRequests');
    if (requestsEl) {
      if (isFiltering) {
        requestsEl.textContent = `${filteredRequests} / ${totalRequests}`;
      } else {
        requestsEl.textContent = totalRequests;
      }
    }
    
    // Update transferred
    const transferredEl = document.getElementById('footerTransferred');
    if (transferredEl) {
      transferredEl.textContent = requestManager.formatBytes(stats.transferred);
    }
    
    // Update resources
    const resourcesEl = document.getElementById('footerResources');
    if (resourcesEl) {
      resourcesEl.textContent = requestManager.formatBytes(stats.resources);
    }
    
    // Update finish time
    const finishEl = document.getElementById('footerFinish');
    if (finishEl) {
      if (stats.finishTime !== null) {
        finishEl.textContent = formatTime(stats.finishTime);
      } else {
        finishEl.textContent = '—';
      }
    }
    
    // Update DOMContentLoaded
    const domContentLoadedEl = document.getElementById('footerDOMContentLoaded');
    if (domContentLoadedEl) {
      if (domContentLoadedTime && pageStartTime) {
        const time = domContentLoadedTime - pageStartTime;
        domContentLoadedEl.textContent = formatTime(time);
      } else {
        domContentLoadedEl.textContent = '—';
      }
    }
    
    // Update Load
    const loadEl = document.getElementById('footerLoad');
    if (loadEl) {
      if (loadTime && pageStartTime) {
        const time = loadTime - pageStartTime;
        loadEl.textContent = formatTime(time);
      } else {
        loadEl.textContent = '—';
      }
    }
  } catch (err) {
    // Silently fail if footer elements don't exist yet
    if (err && err.message && !err.message.includes('Extension context invalidated')) {
      console.warn('Error updating footer stats:', err.message);
    }
  }
}

function renderRequestList() {
  const requestListEl = document.getElementById('requestList');
  if (!requestListEl) {
    console.error('Request list element not found');
    return;
  }
  
  const filteredRequests = requestManager.getFilteredRequests();
  
  if (filteredRequests.length === 0) {
    requestListEl.innerHTML = '<div class="empty-state"><p>No requests match the current filter. Please try refreshing the page or check your spelling.</p></div>';
    return;
  }

  requestListEl.innerHTML = '';
  
  filteredRequests.forEach(request => {
    const item = createRequestItem(request);
    requestListEl.appendChild(item);
  });
  
  // Update footer stats after rendering
  updateFooterStats();
}

function createRequestItem(request) {
  const item = document.createElement('div');
  item.className = 'request-item';
  if (selectedRequestId === request.requestId) {
    item.classList.add('selected');
  }

  const method = document.createElement('span');
  method.className = `method ${request.method}`;
  method.textContent = request.method || 'GET';

  const url = document.createElement('span');
  url.className = 'url';
  if (request.canceled) {
    url.classList.add('canceled');
  }
  url.textContent = getUrlDisplayName(request.url || '');
  url.title = request.url || ''; // Full URL on hover

  const status = document.createElement('span');
  status.className = `status ${requestManager.getStatusClass(request.status, request.canceled)}`;
  status.textContent = request.canceled ? '(canceled)' : (request.status || 'Pending');

  const type = document.createElement('span');
  type.className = 'type';
  // Use the actual resource type from Network API (Fetch, XHR, Document, etc.)
  // Fall back to MIME type if resource type is not available
  if (request.type) {
    type.textContent = formatResourceType(request.type);
  } else if (request.mimeType) {
    type.textContent = requestManager.getMimeType(request.mimeType);
  } else {
    type.textContent = 'unknown';
  }

  const size = document.createElement('span');
  size.className = 'size';
  size.textContent = requestManager.formatBytes(request.size);

  // Add resize handles between columns
  const resizeHandle1 = document.createElement('div');
  resizeHandle1.className = 'column-resize-handle';
  resizeHandle1.setAttribute('data-column', 'method');
  resizeHandle1.style.pointerEvents = 'auto';
  
  const resizeHandle2 = document.createElement('div');
  resizeHandle2.className = 'column-resize-handle';
  resizeHandle2.setAttribute('data-column', 'url');
  resizeHandle2.style.pointerEvents = 'auto';
  
  const resizeHandle3 = document.createElement('div');
  resizeHandle3.className = 'column-resize-handle';
  resizeHandle3.setAttribute('data-column', 'status');
  resizeHandle3.style.pointerEvents = 'auto';
  
  const resizeHandle4 = document.createElement('div');
  resizeHandle4.className = 'column-resize-handle';
  resizeHandle4.setAttribute('data-column', 'type');
  resizeHandle4.style.pointerEvents = 'auto';
  
  const resizeHandle5 = document.createElement('div');
  resizeHandle5.className = 'column-resize-handle';
  resizeHandle5.setAttribute('data-column', 'size');
  resizeHandle5.style.pointerEvents = 'auto';

  item.appendChild(method);
  item.appendChild(resizeHandle1);
  item.appendChild(url);
  item.appendChild(resizeHandle2);
  item.appendChild(status);
  item.appendChild(resizeHandle3);
  item.appendChild(type);
  item.appendChild(resizeHandle4);
  item.appendChild(size);
  item.appendChild(resizeHandle5);

  // Shared timeout for click/double-click handling
  let clickTimeout = null;
  
  // Double-click to open URL in new tab
  item.addEventListener('dblclick', (e) => {
    // Don't trigger if clicking on a resize handle
    if (e.target.classList.contains('column-resize-handle')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Clear any pending single-click timeout
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
    }
    
    // Get the request URL - ensure it's a valid URL
    let requestUrl = request.url;
    if (!requestUrl) {
      console.warn('[Double-click] Cannot open: request has no URL');
      return;
    }
    
    console.log('[Double-click] Opening URL:', requestUrl);
    
    // Ensure URL is absolute (add protocol if missing)
    try {
      // Check if URL is relative or missing protocol
      if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://') && 
          !requestUrl.startsWith('chrome://') && !requestUrl.startsWith('chrome-extension://') &&
          !requestUrl.startsWith('data:') && !requestUrl.startsWith('blob:')) {
        // Try to make it absolute by prepending the current page's origin
        const inspectedUrl = chrome.devtools.inspectedWindow.url || '';
        if (inspectedUrl) {
          try {
            const baseUrl = new URL(inspectedUrl);
            requestUrl = new URL(requestUrl, baseUrl.origin).href;
          } catch (urlErr) {
            console.warn('Cannot resolve relative URL:', requestUrl);
            return;
          }
        } else {
          console.warn('Cannot resolve relative URL - no base URL available');
          return;
        }
      }
      
      // Validate URL format
      new URL(requestUrl); // Will throw if invalid
      
      // Try chrome.tabs.create first (works in DevTools context without tabs permission)
      if (chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: requestUrl }, (createdTab) => {
          if (chrome.runtime.lastError) {
            // If chrome.tabs.create fails, fall back to window.open
            console.log('[Double-click] chrome.tabs.create failed, using window.open:', chrome.runtime.lastError.message);
            const newWindow = window.open(requestUrl, '_blank');
            if (!newWindow) {
              console.error('[Double-click] window.open also failed - popup may be blocked');
            } else {
              console.log('[Double-click] Successfully opened URL with window.open');
            }
          } else {
            console.log('[Double-click] Successfully opened URL with chrome.tabs.create');
          }
        });
      } else {
        // Fallback to window.open if chrome.tabs is not available
        console.log('[Double-click] chrome.tabs not available, using window.open');
        const newWindow = window.open(requestUrl, '_blank');
        if (!newWindow) {
          console.error('[Double-click] window.open failed - popup may be blocked');
        } else {
          console.log('[Double-click] Successfully opened URL with window.open');
        }
      }
    } catch (urlErr) {
      // Fallback to window.open if URL parsing fails
      console.warn('Error parsing URL, trying window.open:', urlErr);
      try {
        window.open(requestUrl, '_blank');
      } catch (fallbackErr) {
        console.error('Error opening URL in new tab:', fallbackErr);
      }
    }
  });

  // Use capture phase to ensure click is caught
  // Add a small delay to distinguish between single and double clicks
  item.addEventListener('click', (e) => {
    // Don't trigger if clicking on a resize handle
    if (e.target.classList.contains('column-resize-handle')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Clear any existing timeout
    if (clickTimeout) {
      clearTimeout(clickTimeout);
    }
    
    // Delay single-click action to allow double-click to fire first
    clickTimeout = setTimeout(() => {
      console.log('Request clicked:', request.requestId, request.url);
      
      selectedRequestId = request.requestId;
      showRequestDetails(request.requestId);
      renderRequestList(); // Re-render to update selection
      
      clickTimeout = null;
    }, 200); // 200ms delay to allow double-click
  }, true);
  
  // Note: Removed mousedown handler to allow double-click to work properly
  // The click handler with timeout handles single-click selection
  
  // Also allow clicking on child elements (URL, status, etc.)
  item.style.cursor = 'pointer';
  item.style.position = 'relative';
  item.setAttribute('role', 'button');
  item.setAttribute('tabindex', '0');
  item.setAttribute('data-request-id', request.requestId);
  
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectedRequestId = request.requestId;
      showRequestDetails(request.requestId);
      renderRequestList();
    }
  });

  return item;
}

function getUrlDisplayName(url) {
  // Handle null, undefined, or empty URL
  if (!url || typeof url !== 'string') {
    return 'Unknown';
  }
  
  try {
    // Handle relative URLs or invalid URLs
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (e) {
      // If URL is relative or invalid, try to extract just the path part
      if (url.startsWith('/')) {
        // It's a relative path, just show the filename
        const parts = url.split('/').filter(part => part.length > 0);
        return parts.length > 0 ? parts[parts.length - 1] : url.substring(1);
      }
      // Return the URL as-is if we can't parse it
      return url.length > 50 ? url.substring(0, 50) + '...' : url;
    }
    
    // Ensure urlObj is valid
    if (!urlObj) {
      return url.length > 50 ? url.substring(0, 50) + '...' : url;
    }
    
    const pathname = urlObj.pathname || '';
    const search = urlObj.search || '';
    const hostname = urlObj.hostname || '';
    
    // Get the last part of the path
    const pathParts = pathname.split('/').filter(part => part.length > 0);
    let displayName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : (hostname || url);
    
    // Ensure displayName is a string
    if (!displayName || typeof displayName !== 'string') {
      displayName = hostname || url || 'Unknown';
    }
    
    // If there's a query string, add a shortened version
    if (search) {
      // Limit query string display to 30 characters
      const shortQuery = search.length > 30 ? search.substring(0, 30) + '...' : search;
      displayName = String(displayName || '') + shortQuery;
    }
    
    // If the display name is just a file extension or empty, show more context
    if (!displayName || displayName.length < 2) {
      // Show last two path segments if available
      if (pathParts.length >= 2) {
        displayName = pathParts[pathParts.length - 2] + '/' + pathParts[pathParts.length - 1];
      } else if (pathParts.length === 1) {
        displayName = pathParts[0];
      } else {
        // Root path, show hostname
        displayName = hostname || url || 'Unknown';
      }
    }
    
    // Final safety check
    return (displayName && typeof displayName === 'string') ? displayName : (url || 'Unknown');
  } catch (e) {
    // If URL parsing fails, return a safe fallback
    console.error('Error parsing URL:', url, e);
    return typeof url === 'string' && url.length > 0 ? (url.length > 50 ? url.substring(0, 50) + '...' : url) : 'Unknown';
  }
}

function showRequestDetails(requestId) {
  const request = requestManager.getRequest(requestId);
  if (!request) {
    console.warn('Request not found:', requestId);
    return;
  }

  const detailsPanel = document.getElementById('requestDetails');
  const resizeHandle = document.getElementById('resizeHandle');
  
  if (!detailsPanel || !resizeHandle) {
    console.error('Details panel elements not found');
    return;
  }
  
  detailsPanel.classList.remove('hidden');
  resizeHandle.classList.add('visible');
  
  // Restore saved width if available
  const savedWidth = localStorage.getItem('networkInspectorDetailsWidth');
  if (savedWidth) {
    detailsPanel.style.width = savedWidth;
  }

  // Clear search and highlights when showing new request
  const detailsSearchInput = document.getElementById('detailsSearchInput');
  const detailsSearchClear = document.getElementById('detailsSearchClear');
  if (detailsSearchInput) {
    detailsSearchInput.value = '';
  }
  if (detailsSearchClear) {
    detailsSearchClear.classList.remove('visible');
  }
  clearHighlights();

  // Populate general info
  populateGeneralInfo(request);
  
  // Populate headers
  populateHeaders(request);
  
  // Populate payload
  populatePayload(request);
  
  // Populate response
  populateResponse(request);
  
  // Restore last active tab preference
  const savedTab = localStorage.getItem('networkInspectorActiveTab');
  if (savedTab) {
    switchTab(savedTab);
  }
}

function navigateToAdjacentRequest(direction) {
  // direction: 1 for next (down), -1 for previous (up)
  const filteredRequests = requestManager.getFilteredRequests();
  if (filteredRequests.length === 0) {
    return;
  }
  
  // Find current selected request index
  let currentIndex = -1;
  for (let i = 0; i < filteredRequests.length; i++) {
    if (filteredRequests[i].requestId === selectedRequestId) {
      currentIndex = i;
      break;
    }
  }
  
  // If no selection, select first item
  if (currentIndex === -1) {
    if (filteredRequests.length > 0) {
      selectedRequestId = filteredRequests[0].requestId;
      showRequestDetails(selectedRequestId);
      renderRequestList();
      scrollToSelectedRequest();
    }
    return;
  }
  
  // Calculate new index
  const newIndex = currentIndex + direction;
  
  // Clamp to valid range
  if (newIndex < 0) {
    // Already at top, select first item
    selectedRequestId = filteredRequests[0].requestId;
  } else if (newIndex >= filteredRequests.length) {
    // Already at bottom, select last item
    selectedRequestId = filteredRequests[filteredRequests.length - 1].requestId;
  } else {
    // Select adjacent item
    selectedRequestId = filteredRequests[newIndex].requestId;
  }
  
  showRequestDetails(selectedRequestId);
  renderRequestList();
  scrollToSelectedRequest();
}

function scrollToSelectedRequest() {
  const requestListEl = document.getElementById('requestList');
  if (!requestListEl) return;
  
  const selectedItem = requestListEl.querySelector('.request-item.selected');
  if (selectedItem) {
    selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function hideRequestDetails() {
  selectedRequestId = null;
  const detailsPanel = document.getElementById('requestDetails');
  const resizeHandle = document.getElementById('resizeHandle');
  
  detailsPanel.classList.add('hidden');
  resizeHandle.classList.remove('visible');
  
  renderRequestList();
}

function populateGeneralInfo(request) {
  const generalInfo = document.getElementById('generalInfo');
  if (!generalInfo) {
    console.error('generalInfo element not found');
    return;
  }
  
  generalInfo.innerHTML = '';
  
  if (!request) {
    console.error('Request is null or undefined');
    return;
  }

  const info = [
    { label: 'Request URL', value: request.url || 'N/A' },
    { label: 'Request Method', value: request.method || 'GET' },
    { label: 'Status Code', value: request.canceled ? '(canceled)' : (request.status ? `${request.status} ${request.statusText || ''}`.trim() : '⏳ Pending...') },
    { label: 'Content Type', value: request.mimeType || (request.status ? 'N/A' : '⏳ Loading...') },
    { label: 'Size', value: request.size ? requestManager.formatBytes(request.size) : (request.status ? 'N/A' : '⏳ Loading...') }
  ];

  info.forEach(({ label, value }) => {
    const row = document.createElement('div');
    row.className = 'info-row';
    row.innerHTML = `
      <span class="info-label">${escapeHtml(label)}:</span>
      <span class="info-value">${escapeHtml(String(value || 'N/A'))}</span>
    `;
    generalInfo.appendChild(row);
  });
}

function populateHeaders(request) {
  if (!request) {
    console.error('Request is null or undefined');
    return;
  }
  
  // Request Headers
  const requestHeadersEl = document.getElementById('requestHeaders');
  if (!requestHeadersEl) {
    console.error('requestHeaders element not found');
    return;
  }
  requestHeadersEl.innerHTML = '';
  
  if (request.requestHeaders) {
    Object.entries(request.requestHeaders).forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'info-row';
      row.innerHTML = `
        <span class="info-label">${escapeHtml(String(key))}:</span>
        <span class="info-value">${escapeHtml(String(value))}</span>
      `;
      requestHeadersEl.appendChild(row);
    });
  } else {
    requestHeadersEl.innerHTML = '<div class="no-data">No request headers available</div>';
  }

  // Response Headers
  const responseHeadersEl = document.getElementById('responseHeaders');
  if (!responseHeadersEl) {
    console.error('responseHeaders element not found');
    return;
  }
  responseHeadersEl.innerHTML = '';
  
  if (request.responseHeaders) {
    Object.entries(request.responseHeaders).forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'info-row';
      row.innerHTML = `
        <span class="info-label">${escapeHtml(String(key))}:</span>
        <span class="info-value">${escapeHtml(String(value))}</span>
      `;
      responseHeadersEl.appendChild(row);
    });
  } else {
    responseHeadersEl.innerHTML = '<div class="no-data">No response headers available</div>';
  }
}

function populatePayload(request) {
  const payloadContent = document.getElementById('payloadContent');
  if (!payloadContent) {
    console.error('payloadContent element not found');
    return;
  }
  
  if (!request) {
    console.error('Request is null or undefined');
    payloadContent.innerHTML = '<div class="no-data">No request data</div>';
    return;
  }
  
  payloadContent.innerHTML = '';

  // First, check for query string parameters in the URL
  let hasQueryParams = false;
  let queryParams = {};
  
  if (request.url) {
    try {
      const urlObj = new URL(request.url);
      if (urlObj.search) {
        // Parse query string parameters
        const params = new URLSearchParams(urlObj.search.substring(1)); // Remove the '?'
        params.forEach((value, key) => {
          queryParams[key] = value;
        });
        hasQueryParams = Object.keys(queryParams).length > 0;
      }
    } catch (e) {
      // URL parsing failed, skip query params
      console.warn('Failed to parse URL for query params:', request.url, e);
    }
  }

  // Check if request has payload data
  if (request.hasPostData && !request.postData) {
    // Has payload but not loaded yet
    if (hasQueryParams) {
      // Show query params while loading
      renderFormData(payloadContent, queryParams, request.url || '', 'Query String Parameters');
      payloadContent.innerHTML += '<div class="loading-data">⏳ Loading payload data...</div>';
    } else {
      payloadContent.innerHTML = '<div class="loading-data">⏳ Loading payload data...</div>';
    }
    return;
  }

  // Show query string parameters first if they exist
  if (hasQueryParams) {
    renderFormData(payloadContent, queryParams, request.url || '', 'Query String Parameters');
    // Add a separator if there's also POST data
    if (request.postData || request.hasPostData) {
      const separator = document.createElement('div');
      separator.className = 'payload-separator';
      separator.innerHTML = '<h4 style="margin-top: 20px; margin-bottom: 10px;">Request Body</h4>';
      payloadContent.appendChild(separator);
    }
  }

  if (request.postData || request.hasPostData) {
    const postData = request.postData;
    const contentType = getContentType(request.requestHeaders || {});
    
    // Try to parse and display based on content type
    if (contentType && contentType.includes('application/json')) {
      // JSON data
      try {
        const parsed = JSON.parse(postData);
        const treeView = new JsonTreeView(parsed, payloadContent);
        treeView.render();
      } catch (e) {
        payloadContent.innerHTML = `<pre>${escapeHtml(postData || 'Invalid JSON')}</pre>`;
      }
    } else if (contentType && (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data'))) {
      // Form data - parse and display as table
      const formData = parseFormData(postData);
      if (formData && Object.keys(formData).length > 0) {
        renderFormData(payloadContent, formData, request.url || '');
      } else {
        payloadContent.innerHTML = `<pre>${escapeHtml(postData || 'No form data')}</pre>`;
      }
    } else {
      // Try JSON first, then form data, then plain text
      try {
        const parsed = JSON.parse(postData);
        const treeView = new JsonTreeView(parsed, payloadContent);
        treeView.render();
      } catch (e) {
        // Try form data parsing
        const formData = parseFormData(postData);
        if (formData && Object.keys(formData).length > 0) {
          renderFormData(payloadContent, formData, request.url || '');
        } else {
          // Display as plain text
          payloadContent.innerHTML = `<pre>${escapeHtml(postData || '')}</pre>`;
        }
      }
    }
  } else if (hasQueryParams) {
    // Only query params, no POST data - already rendered above
    // Do nothing, query params are already shown
  } else {
    payloadContent.innerHTML = '<div class="no-data">No payload data</div>';
  }
}

function getContentType(headers) {
  if (!headers) return null;
  
  // Check for Content-Type header (case-insensitive)
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-type') {
      return value.toLowerCase();
    }
  }
  return null;
}

function parseFormData(data) {
  if (!data) return null;
  
  try {
    const params = new URLSearchParams(data);
    const result = {};
    
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    
    return Object.keys(result).length > 0 ? result : null;
  } catch (e) {
    return null;
  }
}

function renderFormData(container, formData, requestUrl, title = 'Form Data') {
  // Add a title if provided
  if (title) {
    const titleEl = document.createElement('h4');
    titleEl.style.marginTop = '0';
    titleEl.style.marginBottom = '10px';
    titleEl.textContent = title;
    container.appendChild(titleEl);
  }
  
  const table = document.createElement('div');
  table.className = 'form-data-table';
  
  const header = document.createElement('div');
  header.className = 'form-data-header';
  
  const keyHeader = document.createElement('span');
  keyHeader.className = 'form-key-header';
  keyHeader.textContent = 'Key';
  header.appendChild(keyHeader);
  
  // Resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'form-column-resize-handle';
  header.appendChild(resizeHandle);
  
  const highlightHeader = document.createElement('span');
  highlightHeader.className = 'form-highlight-header';
  highlightHeader.textContent = 'Highlight';
  header.appendChild(highlightHeader);
  
  // Resize handle between highlight and value
  const resizeHandle2 = document.createElement('div');
  resizeHandle2.className = 'form-column-resize-handle';
  header.appendChild(resizeHandle2);
  
  const valueHeader = document.createElement('span');
  valueHeader.className = 'form-value-header';
  valueHeader.textContent = 'Value';
  header.appendChild(valueHeader);
  
  table.appendChild(header);
  
  // Restore saved column widths
  const savedKeyWidth = localStorage.getItem('networkInspectorFormKeyWidth');
  if (savedKeyWidth) {
    const keyWidth = parseFloat(savedKeyWidth);
    document.documentElement.style.setProperty('--form-key-width', `${keyWidth}%`);
  }
  
  const savedHighlightWidth = localStorage.getItem('networkInspectorFormHighlightWidth');
  if (savedHighlightWidth) {
    document.documentElement.style.setProperty('--form-highlight-width', savedHighlightWidth);
  }
  
  Object.entries(formData).forEach(([key, value]) => {
    const row = document.createElement('div');
    row.className = 'form-data-row';
    
    const keyCell = document.createElement('div');
    keyCell.className = 'form-data-key';
    keyCell.textContent = key;
    
    // Highlight checkbox column
    const highlightCell = document.createElement('div');
    highlightCell.className = 'form-data-highlight';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'highlight-checkbox';
    
    // Get storage key for this request URL + form key
    const storageKey = getHighlightStorageKey(requestUrl, key);
    
    // Restore checkbox state from localStorage
    const isHighlighted = localStorage.getItem(storageKey) === 'true';
    checkbox.checked = isHighlighted;
    
    // Apply highlighting if saved
    if (isHighlighted) {
      row.dataset.highlighted = 'true';
    }
    
    // Add change event listener
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const checked = e.target.checked;
      if (checked) {
        localStorage.setItem(storageKey, 'true');
        row.dataset.highlighted = 'true';
      } else {
        localStorage.removeItem(storageKey);
        row.dataset.highlighted = 'false';
      }
    });
    
    // Prevent checkbox clicks from bubbling
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    highlightCell.appendChild(checkbox);
    
    const valueCell = document.createElement('div');
    valueCell.className = 'form-data-value';
    
    // Check if value is JSON and render as tree view
    if (isJsonString(value)) {
      try {
        const parsed = JSON.parse(value);
        const treeView = new JsonTreeView(parsed, valueCell);
        treeView.render();
      } catch (e) {
        // Fallback to text if parsing fails
        valueCell.textContent = value;
      }
    } else {
      valueCell.textContent = value;
    }
    
    row.appendChild(keyCell);
    row.appendChild(highlightCell);
    row.appendChild(valueCell);
    table.appendChild(row);
  });
  
  container.appendChild(table);
  
  // Setup resize handlers for form data columns
  setupFormColumnResize(resizeHandle, header);
  setupHighlightColumnResize(resizeHandle2, header);
}

function getHighlightStorageKey(requestUrl, formKey) {
  // Create a unique storage key for each request URL + form key combination
  return `networkInspectorHighlight_${requestUrl}_${formKey}`;
}

function isJsonString(str) {
  if (typeof str !== 'string') return false;
  
  // Quick check for JSON-like patterns
  const trimmed = str.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

function populateResponse(request) {
  const responseContent = document.getElementById('responseContent');
  if (!responseContent) {
    console.error('responseContent element not found');
    return;
  }
  
  if (!request) {
    console.error('Request is null or undefined');
    responseContent.innerHTML = '<div class="no-data">No request data</div>';
    return;
  }
  
  responseContent.innerHTML = '';

  // Check if response is still loading
  if (request.status && !request.finished) {
    responseContent.innerHTML = '<div class="loading-data">⏳ Loading response data...</div>';
    return;
  }

  if (request.responseBody) {
    try {
      // Decode if base64
      let body = request.responseBody;
      if (request.responseBase64Encoded) {
        body = atob(body);
      }

      // Try to parse as JSON
      if (request.mimeType && request.mimeType.includes('json')) {
        const parsed = JSON.parse(body);
        const treeView = new JsonTreeView(parsed, responseContent);
        treeView.render();
      } else {
        // Display as text
        responseContent.innerHTML = `<pre>${escapeHtml(body)}</pre>`;
      }
    } catch (e) {
      // Error parsing, display raw
      responseContent.innerHTML = `<pre>${escapeHtml(request.responseBody)}</pre>`;
    }
  } else if (request.status) {
    // Has status but no body yet
    responseContent.innerHTML = '<div class="loading-data">⏳ Loading response data...</div>';
  } else {
    // Request hasn't received response yet
    responseContent.innerHTML = '<div class="no-data">⏳ Waiting for response...</div>';
  }
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}Tab`).classList.add('active');
  
  // Save preference to localStorage
  localStorage.setItem('networkInspectorActiveTab', tabName);
  
  // Re-apply highlights if there's a search term
  const detailsSearchInput = document.getElementById('detailsSearchInput');
  if (detailsSearchInput && detailsSearchInput.value.trim()) {
    // Use setTimeout to ensure the tab content is rendered before highlighting
    setTimeout(() => {
      highlightTextInDetails(detailsSearchInput.value.trim());
    }, 10);
  }
}

function escapeHtml(text) {
  if (text == null || text === undefined) {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function setupResizeHandle() {
  // Check if panel is still active before proceeding
  if (!isPanelActive) {
    return;
  }
  
  try {
    // Verify DOM is ready
    if (!document || !document.body) {
      return;
    }
    
    const resizeHandle = document.getElementById('resizeHandle');
    const detailsPanel = document.getElementById('requestDetails');
    const mainContent = document.querySelector('.main-content');

    if (!resizeHandle || !detailsPanel || !mainContent) {
      // Elements not found - this is normal if panel hasn't been shown yet
      return;
    }
    
    // Helper to check if context is still valid
    const isContextValid = () => {
      try {
        return isPanelActive && 
               typeof document !== 'undefined' && 
               typeof window !== 'undefined' &&
               document.getElementById('resizeHandle') !== null;
      } catch {
        return false;
      }
    };
    
    const mousedownHandler = (e) => {
      if (!isContextValid()) return;
      try {
        isResizing = true;
        startX = e.clientX;
        startWidth = detailsPanel.offsetWidth;
        
        resizeHandle.classList.add('active');
        if (document.body) {
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }
        
        e.preventDefault();
      } catch (err) {
        isResizing = false;
      }
    };
    
    const mousemoveHandler = (e) => {
      if (!isContextValid() || !isResizing) {
        if (isResizing) isResizing = false;
        return;
      }
      try {
        const currentMainContent = document.querySelector('.main-content');
        const currentDetailsPanel = document.getElementById('requestDetails');
        
        if (!currentDetailsPanel || !currentMainContent || !currentMainContent.offsetWidth) {
          isResizing = false;
          return;
        }
        
        const containerWidth = currentMainContent.offsetWidth;
        if (!containerWidth || containerWidth <= 0) {
          isResizing = false;
          return;
        }
        
        const delta = startX - e.clientX;
        const newWidth = startWidth + delta;
        
        // Constrain width between 300px and 80% of container
        const minWidth = 300;
        const maxWidth = containerWidth * 0.8;
        
        if (newWidth >= minWidth && newWidth <= maxWidth && currentDetailsPanel && currentDetailsPanel.style) {
          currentDetailsPanel.style.width = newWidth + 'px';
        }
      } catch (err) {
        isResizing = false;
      }
    };
    
    const mouseupHandler = () => {
      if (!isContextValid()) {
        if (isResizing) isResizing = false;
        return;
      }
      if (isResizing) {
        try {
          isResizing = false;
          
          const currentResizeHandle = document.getElementById('resizeHandle');
          const currentDetailsPanel = document.getElementById('requestDetails');
          
          if (currentResizeHandle && document.body) {
            currentResizeHandle.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
          }
          
          // Save width to localStorage
          if (currentDetailsPanel && currentDetailsPanel.style) {
            const currentWidth = currentDetailsPanel.style.width;
            if (currentWidth) {
              try {
                localStorage.setItem('networkInspectorDetailsWidth', currentWidth);
              } catch (err) {
                // localStorage might be disabled or full - ignore
              }
            }
          }
        } catch (err) {
          // Ignore all errors during context teardown
          isResizing = false;
        }
      }
    };
    
    // Only add listeners if elements exist
    try {
      resizeHandle.addEventListener('mousedown', mousedownHandler);
      document.addEventListener('mousemove', mousemoveHandler);
      document.addEventListener('mouseup', mouseupHandler);
      
      // Store references for cleanup
      resizeEventListeners.push(
        { element: resizeHandle, event: 'mousedown', handler: mousedownHandler },
        { element: document, event: 'mousemove', handler: mousemoveHandler },
        { element: document, event: 'mouseup', handler: mouseupHandler }
      );
    } catch (err) {
      // If adding listeners fails, just return silently
      return;
    }
  } catch (err) {
    // Only log if it's an unexpected error (not just missing elements)
    if (err && err.message && !err.message.includes('getElementById')) {
      console.warn('Error setting up resize handle:', err.message);
    }
  }
}

function cleanupResizeListeners() {
  try {
    resizeEventListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch (err) {
        // Ignore cleanup errors
      }
    });
    resizeEventListeners = [];
  } catch (err) {
    // Ignore cleanup errors
  }
}


function setupFormColumnResize(resizeHandle, header) {
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizingFormColumn = true;
    startFormX = e.clientX;
    
    // Get current key width percentage
    const currentWidth = getComputedStyle(document.documentElement).getPropertyValue('--form-key-width');
    startKeyWidth = currentWidth ? parseFloat(currentWidth) : 40;
    
    resizeHandle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizingFormColumn) return;
    
    const headerWidth = header.offsetWidth;
    const delta = e.clientX - startFormX;
    const deltaPercent = (delta / headerWidth) * 100;
    const newKeyWidth = startKeyWidth + deltaPercent;
    
    // Constrain between 10% and 70% (allow highlight to sit closer to key)
    const minWidth = 10;
    const maxWidth = 70;
    
    if (newKeyWidth >= minWidth && newKeyWidth <= maxWidth) {
      document.documentElement.style.setProperty('--form-key-width', `${newKeyWidth}%`);
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizingFormColumn) {
      isResizingFormColumn = false;
      resizeHandle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Save width to localStorage
      const currentWidth = getComputedStyle(document.documentElement).getPropertyValue('--form-key-width');
      if (currentWidth) {
        localStorage.setItem('networkInspectorFormKeyWidth', currentWidth);
      }
    }
  });
}

function setupHighlightColumnResize(resizeHandle, header) {
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizingHighlightColumn = true;
    startHighlightX = e.clientX;
    
    // Get current highlight width in pixels
    const currentWidth = getComputedStyle(document.documentElement).getPropertyValue('--form-highlight-width');
    startHighlightWidth = currentWidth ? parseFloat(currentWidth) : 80;
    
    resizeHandle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizingHighlightColumn) return;
    
    // When dragging the handle between highlight and value:
    // - Dragging LEFT decreases highlight width (makes it smaller/closer to key)
    // - Dragging RIGHT increases highlight width
    const delta = e.clientX - startHighlightX;
    const newWidth = startHighlightWidth + delta;
    
    // Constrain between 20px and 150px (reduced min for closer to key)
    const minWidth = 20;
    const maxWidth = 150;
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      document.documentElement.style.setProperty('--form-highlight-width', `${newWidth}px`);
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizingHighlightColumn) {
      isResizingHighlightColumn = false;
      resizeHandle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Save width to localStorage
      const currentWidth = getComputedStyle(document.documentElement).getPropertyValue('--form-highlight-width');
      if (currentWidth) {
        localStorage.setItem('networkInspectorFormHighlightWidth', currentWidth);
      }
    }
  });
}

function setupColumnResizing() {
  if (!isPanelActive) return;
  
  try {
    // Restore saved column widths
    const savedMethodWidth = localStorage.getItem('networkInspectorColMethodWidth');
    const savedStatusWidth = localStorage.getItem('networkInspectorColStatusWidth');
    const savedTypeWidth = localStorage.getItem('networkInspectorColTypeWidth');
    const savedSizeWidth = localStorage.getItem('networkInspectorColSizeWidth');
    const savedUrlMinWidth = localStorage.getItem('networkInspectorColUrlMinWidth');
    
    if (savedMethodWidth) {
      document.documentElement.style.setProperty('--col-method-width', savedMethodWidth);
    }
    if (savedStatusWidth) {
      document.documentElement.style.setProperty('--col-status-width', savedStatusWidth);
    }
    if (savedTypeWidth) {
      document.documentElement.style.setProperty('--col-type-width', savedTypeWidth);
    }
    if (savedSizeWidth) {
      document.documentElement.style.setProperty('--col-size-width', savedSizeWidth);
    }
    if (savedUrlMinWidth) {
      document.documentElement.style.setProperty('--col-url-min-width', savedUrlMinWidth);
    }
    
    // Use event delegation for resize handles (works for both header and body)
    document.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.column-resize-handle');
      if (!handle) return;
      
      const columnName = handle.getAttribute('data-column');
      if (!columnName) {
        console.warn('Resize handle missing data-column attribute');
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      isResizingColumn = true;
      resizingColumnName = columnName;
      startColumnX = e.clientX;
      
      // Get current width from the actual rendered column element
      // The handle is positioned AFTER the column, so we resize the column specified in data-column
      const header = document.querySelector('.request-list-header');
      let columnElement = null;
      let columnSelector = null;
      
      // Map column names to CSS selectors
      const columnSelectors = {
        'method': '.col-method',
        'url': '.col-url',
        'status': '.col-status',
        'type': '.col-type',
        'size': '.col-size'
      };
      
      columnSelector = columnSelectors[columnName];
      
      if (columnSelector && header) {
        columnElement = header.querySelector(columnSelector);
        if (!columnElement) {
          console.warn(`Column element not found for: ${columnName} using selector: ${columnSelector}`);
        }
      } else {
        console.warn(`Invalid column name or selector: ${columnName}`);
      }
      
      // Get the actual rendered width
      if (columnElement) {
        startColumnWidth = columnElement.offsetWidth;
        // For URL column, get min-width from CSS variable instead
        if (columnName === 'url') {
          const minWidth = getComputedStyle(document.documentElement).getPropertyValue('--col-url-min-width');
          if (minWidth) {
            startColumnWidth = parseFloat(minWidth);
          }
        }
        // For Size column, ensure we get the actual width
        if (columnName === 'size' && startColumnWidth === 0) {
          const cssVar = getColumnCssVar(columnName);
          const currentWidth = getComputedStyle(document.documentElement).getPropertyValue(cssVar);
          if (currentWidth) {
            startColumnWidth = parseFloat(currentWidth);
          }
        }
      } else {
        // Fallback to CSS variable
        const cssVar = getColumnCssVar(columnName);
        const currentWidth = getComputedStyle(document.documentElement).getPropertyValue(cssVar);
        startColumnWidth = currentWidth ? parseFloat(currentWidth) : getDefaultWidth(columnName);
      }
      
      handle.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizingColumn || !resizingColumnName) return;
      
      const delta = e.clientX - startColumnX;
      
      // The resize handle is positioned AFTER the column it resizes
      // So dragging RIGHT increases the column width, dragging LEFT decreases it
      const newWidth = startColumnWidth + delta;
      
      const constraints = getColumnConstraints(resizingColumnName);
      if (newWidth >= constraints.min && newWidth <= constraints.max) {
        const cssVar = getColumnCssVar(resizingColumnName);
        
        // Ensure we have the correct CSS variable
        if (!cssVar) {
          console.warn('No CSS variable found for column:', resizingColumnName);
          return;
        }
        
        // Set the CSS variable
        document.documentElement.style.setProperty(cssVar, `${newWidth}px`);
        
        // Special handling for URL column (min-width)
        if (resizingColumnName === 'url') {
          document.documentElement.style.setProperty('--col-url-min-width', `${newWidth}px`);
        }
        
        // Also directly set the width on the column elements to ensure they resize correctly
        const header = document.querySelector('.request-list-header');
        if (header) {
          let headerSelector = null;
          if (resizingColumnName === 'method') headerSelector = '.col-method';
          else if (resizingColumnName === 'url') headerSelector = '.col-url';
          else if (resizingColumnName === 'status') headerSelector = '.col-status';
          else if (resizingColumnName === 'type') headerSelector = '.col-type';
          else if (resizingColumnName === 'size') headerSelector = '.col-size';
          
          if (headerSelector) {
            const headerCol = header.querySelector(headerSelector);
            if (headerCol) {
              if (resizingColumnName === 'url') {
                headerCol.style.minWidth = `${newWidth}px`;
              } else {
                headerCol.style.width = `${newWidth}px`;
                headerCol.style.flexShrink = '0';
                headerCol.style.flexGrow = '0';
                headerCol.style.flexBasis = 'auto';
              }
            }
          }
        }
        
        // Update all request item columns
        const requestItems = document.querySelectorAll('.request-item');
        requestItems.forEach(item => {
          let itemSelector = null;
          if (resizingColumnName === 'method') itemSelector = '.method';
          else if (resizingColumnName === 'url') itemSelector = '.url';
          else if (resizingColumnName === 'status') itemSelector = '.status';
          else if (resizingColumnName === 'type') itemSelector = '.type';
          else if (resizingColumnName === 'size') itemSelector = '.size';
          
          if (itemSelector) {
            const itemCol = item.querySelector(itemSelector);
            if (itemCol) {
              if (resizingColumnName === 'url') {
                itemCol.style.minWidth = `${newWidth}px`;
              } else {
                itemCol.style.width = `${newWidth}px`;
                itemCol.style.flexShrink = '0';
                itemCol.style.flexGrow = '0';
                itemCol.style.flexBasis = 'auto';
              }
            }
          }
        });
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizingColumn) {
        isResizingColumn = false;
        document.querySelectorAll('.column-resize-handle').forEach(h => h.classList.remove('active'));
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // Save widths to localStorage
        if (resizingColumnName) {
          const cssVar = getColumnCssVar(resizingColumnName);
          const currentWidth = getComputedStyle(document.documentElement).getPropertyValue(cssVar);
          if (currentWidth) {
            const storageKey = getColumnStorageKey(resizingColumnName);
            localStorage.setItem(storageKey, currentWidth.trim());
            
            if (resizingColumnName === 'url') {
              const minWidth = getComputedStyle(document.documentElement).getPropertyValue('--col-url-min-width');
              if (minWidth) {
                localStorage.setItem('networkInspectorColUrlMinWidth', minWidth.trim());
              }
            }
          }
        }
        resizingColumnName = null;
      }
    });
  } catch (err) {
    console.warn('Error setting up column resizing:', err);
  }
}

function getColumnCssVar(columnName) {
  const map = {
    'method': '--col-method-width',
    'url': '--col-url-min-width',
    'status': '--col-status-width',
    'type': '--col-type-width',
    'size': '--col-size-width'
  };
  return map[columnName] || '';
}

function getDefaultWidth(columnName) {
  const map = {
    'method': 80,
    'url': 200,
    'status': 80,
    'type': 100,
    'size': 80
  };
  return map[columnName] || 80;
}

function getColumnConstraints(columnName) {
  const map = {
    'method': { min: 50, max: 200 },
    'url': { min: 100, max: 1000 },
    'status': { min: 50, max: 200 },
    'type': { min: 60, max: 300 },
    'size': { min: 50, max: 200 }
  };
  return map[columnName] || { min: 50, max: 200 };
}

function getColumnStorageKey(columnName) {
  const map = {
    'method': 'networkInspectorColMethodWidth',
    'url': 'networkInspectorColUrlMinWidth',
    'status': 'networkInspectorColStatusWidth',
    'type': 'networkInspectorColTypeWidth',
    'size': 'networkInspectorColSizeWidth'
  };
  return map[columnName] || '';
}

// Initialize column resizing on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      setupColumnResizing();
    } catch (err) {
      // Ignore errors
    }
  }, 100);
});

function highlightTextInDetails(searchTerm) {
  if (!searchTerm) {
    clearHighlights();
    return;
  }

  // Get all content areas in the details panel
  const detailsContent = document.querySelector('.details-content');
  if (!detailsContent) return;

  // Clear existing highlights first
  clearHighlights();

  // Find all text nodes and highlight matches
  const walker = document.createTreeWalker(
    detailsContent,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    // Skip text nodes inside script, style, or highlight-match elements
    let parent = node.parentElement;
    while (parent) {
      if (parent.tagName === 'SCRIPT' || 
          parent.tagName === 'STYLE' || 
          parent.classList.contains('highlight-match')) {
        break;
      }
      parent = parent.parentElement;
    }
    if (!parent && node.textContent.trim()) {
      textNodes.push(node);
    }
  }

  // Highlight matches in each text node
  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    
    if (regex.test(text)) {
      const highlightedText = text.replace(regex, '<span class="highlight-match">$1</span>');
      
      // Only replace if there's actually a match
      if (highlightedText !== text) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = highlightedText;
        
        // Replace the text node with the highlighted version
        textNode.parentNode.replaceChild(wrapper, textNode);
      }
    }
  });
}

function clearHighlights() {
  const detailsContent = document.querySelector('.details-content');
  if (!detailsContent) return;

  // Find all highlight spans and unwrap them
  const highlights = detailsContent.querySelectorAll('.highlight-match');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
    // Normalize to merge adjacent text nodes
    parent.normalize();
  });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Clean up when panel is closed
window.addEventListener('beforeunload', () => {
  // Mark panel inactive to prevent event handlers from running during teardown
  isPanelActive = false;
  cleanupResizeListeners();
  safeSendMessage({
    action: 'detachDebugger',
    tabId: tabId
  });
});

