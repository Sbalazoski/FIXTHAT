// Element Inspector & Notepad - Popup Script

document.addEventListener('DOMContentLoaded', init);

let elements = [];

async function init() {
  // Load existing elements
  await loadElements();
  
  // Set up event listeners
  document.getElementById('inspect-btn').addEventListener('click', startInspect);
  document.getElementById('clear-btn').addEventListener('click', clearAll);
  document.getElementById('export-btn').addEventListener('click', exportElements);
  
  // Render elements
  renderElements();
}

async function loadElements() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_ELEMENTS' }, (response) => {
      elements = response?.elements || [];
      resolve();
    });
  });
}

function renderElements() {
  const listEl = document.getElementById('elements-list');
  const emptyState = document.getElementById('empty-state');
  const clearBtn = document.getElementById('clear-btn');
  const exportBtn = document.getElementById('export-btn');
  
  // Clear current list
  listEl.innerHTML = '';
  
  if (elements.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" id="empty-state">
        <div class="empty-icon">⌘</div>
        <p>No elements captured yet</p>
        <p class="empty-hint">Click "Start Inspecting" to begin selecting elements on the page</p>
      </div>
    `;
    clearBtn.disabled = true;
    exportBtn.disabled = true;
    return;
  }
  
  clearBtn.disabled = false;
  exportBtn.disabled = false;
  
  // Render each element card
  elements.forEach((el, index) => {
    const card = createElementCard(el, index);
    listEl.appendChild(card);
  });
}

function createElementCard(element, index) {
  const card = document.createElement('div');
  card.className = 'element-card';
  card.dataset.id = element.id;
  
  // Build classes display
  const classesHtml = element.classes 
    ? element.classes.slice(0, 5).map(c => `<span class="element-class">.${c}</span>`).join('')
    : '';
  
  // Build attributes display
  let attrsHtml = '';
  if (element.attributes && Object.keys(element.attributes).length > 0) {
    const keyAttrs = Object.entries(element.attributes).slice(0, 3);
    attrsHtml = keyAttrs.map(([key, val]) => `
      <div class="element-detail-row">
        <span class="element-detail-label">${key}:</span>
        <span class="element-detail-value" title="${val}">${val.substring(0, 40)}${val.length > 40 ? '...' : ''}</span>
      </div>
    `).join('');
  }
  
  // Source location
  let sourceHtml = '';
  if (element.sourceLocation) {
    sourceHtml = `
      <div class="element-detail-row">
        <span class="element-detail-label">Source:</span>
        <span class="element-detail-value">${element.sourceLocation.url}:${element.sourceLocation.line}</span>
      </div>
    `;
  }
  
  card.innerHTML = `
    <div class="element-header">
      <div class="element-tag">
        <span class="element-tag-name">&lt;${element.tagName}&gt;</span>
        ${element.idAttr ? `<span class="element-id">#${element.idAttr}</span>` : ''}
      </div>
      <button class="element-delete" title="Delete" data-id="${element.id}">×</button>
    </div>
    ${classesHtml ? `<div class="element-classes">${classesHtml}</div>` : ''}
    <div class="element-details">
      <div class="element-detail-row">
        <span class="element-detail-label">CSS:</span>
        <span class="element-detail-value" title="${element.cssSelector}">${truncate(element.cssSelector, 50)}</span>
      </div>
      <div class="element-detail-row">
        <span class="element-detail-label">XPath:</span>
        <span class="element-detail-value" title="${element.xpath}">${truncate(element.xpath, 50)}</span>
      </div>
      ${attrsHtml}
      ${sourceHtml}
      ${element.textContent ? `
        <div class="element-detail-row">
          <span class="element-detail-label">Text:</span>
          <span class="element-detail-value">"${truncate(element.textContent, 40)}"</span>
        </div>
      ` : ''}
    </div>
    <div class="notes-section">
      <div class="notes-label">Notes (your notes)</div>
      <textarea class="notes-textarea" placeholder="Add your notes here..." data-id="${element.id}">${element.notes || ''}</textarea>
    </div>
  `;
  
  // Add event listeners
  card.querySelector('.element-delete').addEventListener('click', (e) => {
    deleteElement(e.target.dataset.id);
  });
  
  card.querySelector('.notes-textarea').addEventListener('change', (e) => {
    updateNotes(e.target.dataset.id, e.target.value);
  });
  
  return card;
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

function startInspect() {
  // Request the content script to start inspect mode
  chrome.runtime.sendMessage({ type: 'START_INSPECT' });
  
  window.close();
}

async function deleteElement(id) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'DELETE_ELEMENT', data: { id } }, async () => {
      await loadElements();
      renderElements();
      resolve();
    });
  });
}

async function updateNotes(id, notes) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'UPDATE_NOTES', data: { id, notes } }, async () => {
      await loadElements();
      resolve();
    });
  });
}

async function clearAll() {
  if (!confirm('Are you sure you want to clear all captured elements?')) {
    return;
  }
  
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'CLEAR_ALL' }, async () => {
      elements = [];
      renderElements();
      resolve();
    });
  });
}

async function exportElements() {
  let exportText = '=== Element Inspector Export ===\n\n';
  
  elements.forEach((el, index) => {
    exportText += `--- Element ${index + 1} ---\n`;
    exportText += `Tag: <${el.tagName}>\n`;
    if (el.idAttr) exportText += `ID: #${el.idAttr}\n`;
    if (el.classes && el.classes.length > 0) {
      exportText += `Classes: .${el.classes.join('.')}\n`;
    }
    exportText += `CSS Selector: ${el.cssSelector}\n`;
    exportText += `XPath: ${el.xpath}\n`;
    
    if (el.attributes && Object.keys(el.attributes).length > 0) {
      exportText += `Attributes:\n`;
      Object.entries(el.attributes).forEach(([key, val]) => {
        exportText += `  ${key}: ${val}\n`;
      });
    }
    
    if (el.sourceLocation) {
      exportText += `Source: ${el.sourceLocation.url}:${el.sourceLocation.line}\n`;
    }
    
    if (el.textContent) {
      exportText += `Text: "${el.textContent}"\n`;
    }
    
    if (el.notes) {
      exportText += `Notes: ${el.notes}\n`;
    }
    
    exportText += '\n';
  });
  
  exportText += '========================';
  
  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(exportText);
    showToast('Copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

function showToast(message) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}