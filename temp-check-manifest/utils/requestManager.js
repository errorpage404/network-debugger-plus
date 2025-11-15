/**
 * Request Manager
 * Manages network request data collection and filtering
 */

class RequestManager {
  constructor() {
    this.requests = new Map(); // requestId -> request data
    this.requestList = []; // ordered list of request IDs
    this.filters = {
      text: '',
      url: true,
      headers: false,
      method: false,
      type: 'all' // 'all', 'fetch', 'doc', 'css', 'js', 'font', 'img', 'media', 'manifest', 'socket', 'wasm', 'other'
    };
  }

  addRequest(requestId, data) {
    if (!this.requests.has(requestId)) {
      this.requestList.push(requestId);
    }
    
    const existing = this.requests.get(requestId) || {};
    this.requests.set(requestId, { ...existing, ...data, requestId });
  }

  updateRequest(requestId, data) {
    const existing = this.requests.get(requestId);
    if (existing) {
      this.requests.set(requestId, { ...existing, ...data });
    }
  }

  getRequest(requestId) {
    return this.requests.get(requestId);
  }

  getAllRequests() {
    return this.requestList.map(id => this.requests.get(id)).filter(Boolean);
  }

  clearRequests() {
    this.requests.clear();
    this.requestList = [];
  }

  setFilter(filterType, value) {
    this.filters[filterType] = value;
  }

  /**
   * Categorize a request by its type
   * @param {Object} request - The request object
   * @returns {string} - The category: 'fetch', 'doc', 'css', 'js', 'font', 'img', 'media', 'manifest', 'socket', 'wasm', 'other'
   */
  getRequestCategory(request) {
    if (!request) return 'other';
    
    const url = (request.url || '').toLowerCase();
    const mimeType = (request.mimeType || '').toLowerCase();
    const method = (request.method || '').toUpperCase();
    
    // WebSocket
    if (url.startsWith('ws://') || url.startsWith('wss://') || 
        mimeType.includes('websocket') || url.includes('websocket')) {
      return 'socket';
    }
    
    // WebAssembly
    if (mimeType.includes('wasm') || url.endsWith('.wasm')) {
      return 'wasm';
    }
    
    // Manifest
    if (mimeType.includes('manifest') || url.includes('manifest.json') || 
        url.includes('manifest.webmanifest') || url.endsWith('.webmanifest')) {
      return 'manifest';
    }
    
    // Media (video/audio)
    if (mimeType.includes('video') || mimeType.includes('audio') || 
        mimeType.includes('mp4') || mimeType.includes('webm') || 
        mimeType.includes('ogg') || mimeType.includes('mp3') ||
        url.match(/\.(mp4|webm|ogg|mp3|wav|avi|mov|flv|mkv)$/i)) {
      return 'media';
    }
    
    // Images
    if (mimeType.includes('image') || 
        url.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|bmp|tiff)$/i)) {
      return 'img';
    }
    
    // Fonts
    if (mimeType.includes('font') || mimeType.includes('woff') || 
        mimeType.includes('ttf') || mimeType.includes('otf') ||
        url.match(/\.(woff|woff2|ttf|otf|eot)$/i)) {
      return 'font';
    }
    
    // JavaScript
    if (mimeType.includes('javascript') || mimeType.includes('ecmascript') ||
        url.match(/\.(js|mjs|jsx)$/i)) {
      return 'js';
    }
    
    // CSS
    if (mimeType.includes('css') || url.match(/\.css$/i)) {
      return 'css';
    }
    
    // HTML Documents
    if (mimeType.includes('html') || mimeType.includes('xml') ||
        (method === 'GET' && (mimeType.includes('text/html') || !mimeType || mimeType === 'text/plain'))) {
      // Check if it's likely a document (not an API endpoint)
      if (!url.includes('/api/') && !url.includes('/rest/') && 
          !url.includes('/graphql') && !mimeType.includes('json')) {
        return 'doc';
      }
    }
    
    // Fetch/XHR (API calls, JSON, XML)
    if (mimeType.includes('json') || mimeType.includes('xml') ||
        url.includes('/api/') || url.includes('/rest/') || 
        url.includes('/graphql') || url.includes('/ajax') ||
        method === 'POST' || method === 'PUT' || method === 'PATCH' ||
        (method === 'GET' && (url.includes('.json') || url.includes('.xml')))) {
      return 'fetch';
    }
    
    return 'other';
  }

  getFilteredRequests() {
    let allRequests = this.getAllRequests();
    
    // First, filter by type - use the actual Network API type field to match Chrome DevTools
    if (this.filters.type && this.filters.type !== 'all') {
      allRequests = allRequests.filter(request => {
        const requestType = (request.type || '').toLowerCase();
        const filterType = this.filters.type.toLowerCase();
        
        // Map filter types to Network API types
        if (filterType === 'fetch') {
          // Fetch/XHR filter should match both "Fetch" and "XHR" types
          return requestType === 'fetch' || requestType === 'xhr';
        } else if (filterType === 'doc') {
          return requestType === 'document';
        } else if (filterType === 'js') {
          return requestType === 'script';
        } else if (filterType === 'img') {
          return requestType === 'image';
        } else if (filterType === 'css') {
          return requestType === 'stylesheet';
        } else if (filterType === 'font') {
          return requestType === 'font';
        } else if (filterType === 'media') {
          return requestType === 'media';
        } else if (filterType === 'manifest') {
          return requestType === 'manifest';
        } else if (filterType === 'socket') {
          return requestType === 'websocket';
        } else if (filterType === 'wasm') {
          return requestType === 'wasm';
        } else if (filterType === 'other') {
          // Other should match anything that doesn't match the above categories
          const knownTypes = ['fetch', 'xhr', 'document', 'script', 'image', 'stylesheet', 'font', 'media', 'manifest', 'websocket', 'wasm'];
          return !knownTypes.includes(requestType) && requestType !== '';
        }
        
        // Fallback: try the old categorization method for any edge cases
        const category = this.getRequestCategory(request);
        return category === filterType;
      });
    }
    
    // Then, filter by text search if provided
    if (!this.filters.text) {
      return allRequests;
    }

    const searchText = this.filters.text.toLowerCase();
    
    return allRequests.filter(request => {
      // Filter by URL
      if (this.filters.url && request.url) {
        if (request.url.toLowerCase().includes(searchText)) {
          return true;
        }
      }

      // Filter by headers
      if (this.filters.headers) {
        if (request.requestHeaders) {
          const headerMatch = Object.entries(request.requestHeaders).some(([key, value]) => {
            return key.toLowerCase().includes(searchText) || 
                   (value && String(value).toLowerCase().includes(searchText));
          });
          if (headerMatch) return true;
        }

        if (request.responseHeaders) {
          const headerMatch = Object.entries(request.responseHeaders).some(([key, value]) => {
            return key.toLowerCase().includes(searchText) || 
                   (value && String(value).toLowerCase().includes(searchText));
          });
          if (headerMatch) return true;
        }
      }

      // Filter by method
      if (this.filters.method && request.method) {
        if (request.method.toLowerCase().includes(searchText)) {
          return true;
        }
      }

      return false;
    });
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  getStatusClass(status, canceled = false) {
    if (canceled || status === '(canceled)') return 'canceled';
    if (!status || status === 'Pending') return 'pending';
    if (typeof status === 'number') {
      if (status >= 200 && status < 300) return 'success';
      if (status >= 300 && status < 400) return 'redirect';
      if (status >= 400) return 'error';
    }
    if (status === 'Failed') return 'error';
    return 'pending';
  }

  getMimeType(mimeType) {
    if (!mimeType) return 'unknown';
    
    if (mimeType.includes('javascript')) return 'javascript';
    if (mimeType.includes('json')) return 'json';
    if (mimeType.includes('html')) return 'html';
    if (mimeType.includes('css')) return 'css';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('font')) return 'font';
    if (mimeType.includes('xml')) return 'xml';
    
    return mimeType.split('/')[1] || 'other';
  }

  /**
   * Get network statistics for footer
   * @returns {Object} Statistics object with requests, transferred, resources, finish time
   */
  getStatistics() {
    const allRequests = this.getAllRequests();
    const finishedRequests = allRequests.filter(r => r.finished || r.failed);
    
    let totalTransferred = 0; // Only finished requests
    let totalResources = 0; // All requests with size
    let firstRequestTime = null;
    let lastFinishTime = null;
    
    allRequests.forEach(request => {
      // Track first request time
      if (request.timestamp) {
        if (firstRequestTime === null || request.timestamp < firstRequestTime) {
          firstRequestTime = request.timestamp;
        }
      }
      
      // Track transferred (only finished requests)
      if (request.finished && request.size) {
        totalTransferred += request.size;
      }
      
      // Track resources (all requests with size, including headers)
      if (request.size) {
        totalResources += request.size;
      }
      
      // Track last finish time
      if (request.finished && request.responseTimestamp) {
        if (lastFinishTime === null || request.responseTimestamp > lastFinishTime) {
          lastFinishTime = request.responseTimestamp;
        }
      }
    });
    
    // Calculate finish time (time from first request to last finish)
    let finishTime = null;
    if (firstRequestTime !== null && lastFinishTime !== null) {
      finishTime = (lastFinishTime - firstRequestTime) * 1000; // Convert to milliseconds
    }
    
    return {
      requests: allRequests.length,
      transferred: totalTransferred,
      resources: totalResources,
      finishTime: finishTime
    };
  }
}

// Export for use in other scripts
window.RequestManager = RequestManager;

