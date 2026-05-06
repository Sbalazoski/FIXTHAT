// Element Inspector & Notepad - Popup Script

let elements = [];

// Initialize - call right away if DOM is ready, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  // Load existing elements
  await loadElements();
  
  // Set up event listeners
  document.getElementById('inspect-btn').addEventListener('click', startInspect);
  document.getElementById('undo-btn').addEventListener('click', undoLast);
  document.getElementById('clear-btn').addEventListener('click', clearAll);
  document.getElementById('export-btn').addEventListener('click', exportElements);
  
  // Developer tool buttons
  document.getElementById('ai-desc-btn').addEventListener('click', getAIDescription);
  document.getElementById('coords-btn').addEventListener('click', captureCoordinates);
  document.getElementById('viewport-btn').addEventListener('click', getViewportInfo);
  document.getElementById('presets-btn').addEventListener('click', showPresets);
  document.getElementById('stacking-btn').addEventListener('click', analyzeStacking);
  
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
  const undoBtn = document.getElementById('undo-btn');
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
        <p class="empty-hint">Or press <strong>Ctrl+Shift+I</strong></p>
      </div>
    `;
    undoBtn.disabled = true;
    clearBtn.disabled = true;
    exportBtn.disabled = true;
    return;
  }
  
  undoBtn.disabled = false;
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
  card.dataset.index = index;
  
  // Build classes display
  const classesHtml = element.classes 
    ? element.classes.slice(0, 5).map(c => `<span class="element-class">.${c}</span>`).join('')
    : '';
  
  // Build attributes display
  let attrsHtml = '';
  if (element.attributes && Object.keys(element.attributes).length > 0) {
    const keyAttrs = Object.entries(element.attributes).slice(0, 4);
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
        <span class="element-detail-value" title="${element.sourceLocation.url}:${element.sourceLocation.line}">${element.sourceLocation.url}:${element.sourceLocation.line}</span>
      </div>
    `;
  }
  
  // Computed styles
  let stylesHtml = '';
  if (element.computedStyles && Object.keys(element.computedStyles).length > 0) {
    const styleEntries = Object.entries(element.computedStyles).slice(0, 5);
    stylesHtml = `
      <div class="styles-section">
        <div class="styles-label">Styles</div>
        <div class="styles-grid">
          ${styleEntries.map(([key, val]) => `
            <span class="style-item">
              <span class="style-key">${key}:</span>
              <span class="style-val">${val}</span>
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Warnings
  let warningsHtml = '';
  if (element.isInShadowDOM) {
    warningsHtml += `<span class="warning-badge">Shadow DOM</span>`;
  }
  if (element.isInIframe) {
    warningsHtml += `<span class="warning-badge">Iframe</span>`;
  }
  
  card.innerHTML = `
    <div class="element-header">
      <div class="element-tag">
        <span class="element-tag-name">&lt;${element.tagName}&gt;</span>
        ${element.idAttr ? `<span class="element-id">#${element.idAttr}</span>` : ''}
        ${warningsHtml ? `<div class="warnings">${warningsHtml}</div>` : ''}
      </div>
      <button class="element-delete" title="Delete" data-id="${element.id}">×</button>
    </div>
    ${classesHtml ? `<div class="element-classes">${classesHtml}</div>` : ''}
    <div class="element-details">
      <div class="element-detail-row">
        <span class="element-detail-label">CSS:</span>
        <span class="element-detail-value" title="${element.cssSelector}">${truncate(element.cssSelector, 40)}</span>
        <button class="copy-btn" data-copy="${element.cssSelector}" title="Copy">📋</button>
      </div>
      <div class="element-detail-row">
        <span class="element-detail-label">XPath:</span>
        <span class="element-detail-value" title="${element.xpath}">${truncate(element.xpath, 40)}</span>
        <button class="copy-btn" data-copy="${element.xpath}" title="Copy">📋</button>
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
    ${stylesHtml}
    <div class="notes-section">
      <div class="notes-label">Notes (your notes)</div>
      <textarea class="notes-textarea" placeholder="Add your notes here..." data-id="${element.id}">${element.notes || ''}</textarea>
    </div>
  `;
  
  // Add event listeners
  card.querySelector('.element-delete').addEventListener('click', (e) => {
    deleteElement(e.target.dataset.id);
  });
  
  card.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const textToCopy = e.target.dataset.copy;
      await navigator.clipboard.writeText(textToCopy);
      showToast('Copied!');
    });
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

async function startInspect() {
  try {
    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      // First inject the content script
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      });
      
      // Then send message to start inspect mode
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'START_INSPECT' });
      console.log('Started inspect mode on tab:', tabs[0].id);
      
      // Show feedback that inspection has started
      showToast('Inspect mode active - click an element to capture');
      
      // Don't close the popup immediately - user might want to read the instructions
      // The popup will close when Inspect mode captures an element (the content script handles this)
      // Or user can close manually
    }
  } catch (e) {
    console.error('Failed to start inspect:', e);
    // Try just sending message anyway
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'START_INSPECT' });
    } catch (e2) {
      console.error('Fallback also failed:', e2);
      showToast('Failed - check console for errors');
    }
  }
}

async function undoLast() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'UNDO_LAST' }, async () => {
      await loadElements();
      renderElements();
      resolve();
    });
  });
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
  let exportText = '=== Element Inspector Export ===\n';
  exportText += `Captured: ${elements.length} element(s)\n\n`;
  
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
    
    if (el.computedStyles && Object.keys(el.computedStyles).length > 0) {
      exportText += `Styles:\n`;
      Object.entries(el.computedStyles).forEach(([key, val]) => {
        exportText += `  ${key}: ${val}\n`;
      });
    }
    
    if (el.sourceLocation) {
      exportText += `Source: ${el.sourceLocation.url}:${el.sourceLocation.line}\n`;
    }
    
    if (el.isInShadowDOM) {
      exportText += `Warning: Element is in Shadow DOM\n`;
    }
    if (el.isInIframe) {
      exportText += `Warning: Element is in Iframe\n`;
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
    showToast(`Copied ${elements.length} element(s) to clipboard!`);
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

// ============ DEVELOPER TOOL FUNCTIONS ============

// Get AI description for an element
async function getAIDescription() {
  if (elements.length === 0) {
    showToast('Capture elements first with Inspect');
    return;
  }
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tabs[0].id, { 
      type: 'GET_AI_DESCRIPTION', 
      data: { index: elements.length - 1 } // Get latest captured
    });
    
    if (response && response.success) {
      // Copy to clipboard and show
      await navigator.clipboard.writeText(response.description);
      showToast('AI description copied to clipboard!');
      
      // Also show in a modal/panel
      showModal('AI Agent Description', response.description);
    }
  } catch (e) {
    console.error('Failed to get AI description:', e);
    showToast('Failed - is the page loaded?');
  }
}

// Capture click coordinates
async function captureCoordinates() {
  showToast('Click anywhere on the page...');
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tabs[0].id, { 
      type: 'GET_CLICK_COORDINATES'
    });
    
    if (response && response.success) {
      const coords = response.coordinates;
      const info = response.element;
      
      const coordText = `Position: x:${coords.x}, y:${coords.y}
Viewport: ${coords.viewportWidth}x${coords.viewportHeight}
Page: ${coords.pageWidth}x${coords.pageHeight}
Element: <${info.tagName}> ${info.cssSelector}`;
      
      await navigator.clipboard.writeText(coordText);
      showToast(`Position captured: ${coords.x}, ${coords.y}`);
    }
  } catch (e) {
    console.error('Failed to capture coordinates:', e);
    showToast('Failed to capture position');
  }
}

// Get viewport info
async function getViewportInfo() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tabs[0].id, { 
      type: 'GET_VIEWPORT_INFO'
    });
    
    if (response && response.success) {
      const info = response.info;
      const text = `Viewport: ${info.viewport.width}x${info.viewport.height}
Device: ${info.viewport.width >= 1025 ? 'Desktop' : info.viewport.width >= 769 ? 'Tablet' : 'Mobile'}
Color Scheme: ${info.colorScheme}
Breakpoint: ${Object.entries(info.breakpoints).filter(([,v]) => v)[0]?.[0] || 'unknown'}
Scroll: ${info.scrollPosition.x}, ${info.scrollPosition.y}`;
      
      await navigator.clipboard.writeText(text);
      showToast('Viewport info copied!');
      
      showModal('Viewport & Responsive Info', text);
    }
  } catch (e) {
    console.error('Failed to get viewport info:', e);
  }
}

// Show layout presets
async function showPresets() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tabs[0].id, { 
      type: 'GET_PRESETS'
    });
    
    if (response && response.success) {
      const presets = response.presets;
      let text = `## Industry Standard Layouts

## Buttons
${presets.button.height}
${presets.button.padding}
border-radius: ${presets.button.borderRadius}

## Inputs  
height: ${presets.input.height}
padding: ${presets.input.padding}
border-radius: ${presets.input.borderRadius}

## Cards
padding: ${presets.card.padding}
border-radius: ${presets.card.borderRadius}
${presets.card.shadow}

## Modals
${presets.modal.width}
${presets.modal.padding}

## Navbar
${presets.navbar.height}

## Spacing Scale (Tailwind-style)
${Object.entries(presets.spacing).map(([k, v]) => `${k}: ${v}`).join('\n')}

## Breakpoints
${Object.entries(presets.breakpoints).map(([k, v]) => `${k}: ${v}`).join('\n')}

## Typography
${Object.entries(presets.typography).map(([k, v]) => `${k}: ${v}`).join('\n')}`;
      
      await navigator.clipboard.writeText(text);
      showToast('Presets copied to clipboard!');
      
      showModal('Industry Standard Layouts', text);
    }
  } catch (e) {
    console.error('Failed to get presets:', e);
  }
}

// Analyze stacking context
async function analyzeStacking() {
  if (elements.length === 0) {
    showToast('Capture elements first with Inspect');
    return;
  }
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tabs[0].id, { 
      type: 'ANALYZE_STACKING',
      data: { selector: elements[elements.length - 1].cssSelector }
    });
    
    if (response && response.success) {
      const stack = response.stacking;
      let text = `## Stacking Context Analysis
      
Position: ${stack.position}
Z-index: ${stack.zIndex}
Opacity: ${stack.opacity}
Overflow: ${stack.overflow}
Issues: ${stack.hasStackingIssue ? 'YES ⚠️' : 'None'}`;
      
      if (stack.blockingElements.length > 0) {
        text += `\n\n## Potentially Blocking Elements\n`;
        stack.blockingElements.forEach(el => {
          text += `<${el.tagName}> ${el.id ? '#' + el.id : ''} ${el.classes.map(c => '.' + c).join('')}
  position: ${el.position}, z-index: ${el.zIndex}\n`;
        });
      }
      
      await navigator.clipboard.writeText(text);
      showToast('Stacking analysis copied!');
      
      showModal('Stacking Context Analysis', text.replace(/\n/g, '<br>'));
    } else {
      showToast('Element no longer on page');
    }
  } catch (e) {
    console.error('Failed to analyze stacking:', e);
    showToast('Failed - is the page loaded?');
  }
}

// Show modal with content
function showModal(title, content) {
  // Remove existing modal
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">${content.replace(/\n/g, '<br>').replace(/^## /gm, '<h4>').replace(/$/gm, '</h4>')}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}