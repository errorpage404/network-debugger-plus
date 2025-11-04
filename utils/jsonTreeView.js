/**
 * JSON Tree View Utility
 * Renders JSON data as an interactive tree structure
 */

class JsonTreeView {
  constructor(data, container) {
    this.data = data;
    this.container = container;
  }

  render() {
    this.container.innerHTML = '';
    
    if (!this.data) {
      this.container.innerHTML = '<div class="no-data">No data available</div>';
      return;
    }

    const treeElement = this.createTree(this.data, true);
    this.container.appendChild(treeElement);
  }

  createTree(data, isRoot = false) {
    const container = document.createElement('span');
    container.className = isRoot ? 'json-tree json-tree-root' : 'json-tree';

    if (data === null) {
      container.innerHTML = '<span class="json-tree-null">null</span>';
      return container;
    }

    if (typeof data === 'undefined') {
      container.innerHTML = '<span class="json-tree-null">undefined</span>';
      return container;
    }

    if (typeof data === 'string') {
      container.innerHTML = `<span class="json-tree-string">"${this.escapeHtml(data)}"</span>`;
      return container;
    }

    if (typeof data === 'number') {
      container.innerHTML = `<span class="json-tree-number">${data}</span>`;
      return container;
    }

    if (typeof data === 'boolean') {
      container.innerHTML = `<span class="json-tree-boolean">${data}</span>`;
      return container;
    }

    if (Array.isArray(data)) {
      container.appendChild(this.createArrayTree(data));
      return container;
    }

    if (typeof data === 'object') {
      container.appendChild(this.createObjectTree(data));
      return container;
    }

    container.innerHTML = `<span class="json-tree-value">${this.escapeHtml(String(data))}</span>`;
    return container;
  }

  createObjectTree(obj) {
    const container = document.createElement('span');
    container.style.display = 'inline-block';
    const keys = Object.keys(obj);
    
    if (keys.length === 0) {
      container.innerHTML = '<span class="json-bracket">{}</span>';
      return container;
    }
    
    const wrapper = document.createElement('span');
    wrapper.style.display = 'inline';
    
    const toggle = document.createElement('span');
    toggle.className = 'json-tree-toggle';
    toggle.textContent = '▼';
    
    const openBracket = document.createElement('span');
    openBracket.className = 'json-bracket';
    openBracket.textContent = ' {';
    
    // Put toggle and bracket together inline (no line break)
    wrapper.appendChild(toggle);
    wrapper.appendChild(openBracket);
    
    toggle.onclick = (e) => {
      e.stopPropagation();
      wrapper.classList.toggle('json-tree-collapsed');
      toggle.textContent = wrapper.classList.contains('json-tree-collapsed') ? '▶' : '▼';
    };

    const children = document.createElement('div');
    children.className = 'json-tree-children json-tree-node';

    keys.forEach((key, index) => {
      const row = document.createElement('div');
      row.className = 'json-tree-row';
      
      const keySpan = document.createElement('span');
      keySpan.className = 'json-tree-key';
      keySpan.textContent = `"${key}"`;
      row.appendChild(keySpan);
      
      const colonSpan = document.createElement('span');
      colonSpan.className = 'json-colon';
      
      const valueTree = this.createTree(obj[key]);
      
      // Check if value is an object or array - make it block-level
      const isComplexValue = (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && Object.keys(obj[key]).length > 0) ||
                             (Array.isArray(obj[key]) && obj[key].length > 0);
      
      if (isComplexValue) {
        // For complex values, colon with space, value starts on same line
        colonSpan.textContent = ': ';
        valueTree.style.display = 'inline';
        valueTree.style.whiteSpace = 'nowrap';
        row.classList.add('has-block-value');
      } else {
        valueTree.style.display = 'inline';
        row.classList.add('has-inline-value');
        // Add space after colon for simple values
        colonSpan.textContent = ': ';
      }
      
      row.appendChild(colonSpan);
      row.appendChild(valueTree);
      
      if (index < keys.length - 1) {
        const commaSpan = document.createElement('span');
        commaSpan.className = 'json-comma';
        commaSpan.textContent = ', ';
        row.appendChild(commaSpan);
      }
      
      children.appendChild(row);
    });

    wrapper.appendChild(children);
    
    const closeBracket = document.createElement('span');
    closeBracket.className = 'json-bracket';
    closeBracket.textContent = '}';
    wrapper.appendChild(closeBracket);
    
    container.appendChild(wrapper);
    return container;
  }

  createArrayTree(arr) {
    const container = document.createElement('span');
    container.style.display = 'inline-block';
    
    if (arr.length === 0) {
      container.innerHTML = '<span class="json-bracket">[]</span>';
      return container;
    }

    const wrapper = document.createElement('span');
    wrapper.style.display = 'inline-block';
    const toggle = document.createElement('span');
    toggle.className = 'json-tree-toggle';
    toggle.textContent = '▼';
    toggle.onclick = (e) => {
      e.stopPropagation();
      wrapper.classList.toggle('json-tree-collapsed');
      toggle.textContent = wrapper.classList.contains('json-tree-collapsed') ? '▶' : '▼';
    };

    wrapper.appendChild(toggle);
    const openBracket = document.createElement('span');
    openBracket.className = 'json-bracket';
    openBracket.textContent = '[';
    wrapper.appendChild(openBracket);

    const children = document.createElement('div');
    children.className = 'json-tree-children json-tree-node';

    arr.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'json-tree-row';
      
      const valueTree = this.createTree(item);
      
      // Check if array item is complex (object/array)
      const isComplexItem = (typeof item === 'object' && item !== null && !Array.isArray(item) && Object.keys(item).length > 0) ||
                           (Array.isArray(item) && item.length > 0);
      
      if (isComplexItem) {
        valueTree.style.display = 'block';
        row.classList.add('has-block-value');
      } else {
        valueTree.style.display = 'inline';
        row.classList.add('has-inline-value');
      }
      
      row.appendChild(valueTree);
      
      if (index < arr.length - 1) {
        const commaSpan = document.createElement('span');
        commaSpan.className = 'json-comma';
        commaSpan.textContent = ', ';
        row.appendChild(commaSpan);
      }
      
      children.appendChild(row);
    });

    wrapper.appendChild(children);
    const closeBracket = document.createElement('span');
    closeBracket.className = 'json-bracket';
    closeBracket.textContent = ']';
    wrapper.appendChild(closeBracket);
    
    container.appendChild(wrapper);
    return container;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in other scripts
window.JsonTreeView = JsonTreeView;

