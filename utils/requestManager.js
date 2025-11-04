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
      method: false
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

  getFilteredRequests() {
    const allRequests = this.getAllRequests();
    
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
}

// Export for use in other scripts
window.RequestManager = RequestManager;

