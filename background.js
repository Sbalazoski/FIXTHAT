// Background service worker for Element Inspector & Notepad

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'start-inspect') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'START_INSPECT' });
      }
    });
  }
});

// Initialize badge on install
chrome.runtime.onInstalled.addListener(() => {
  updateBadge(0);
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STORE_ELEMENT') {
    storeElement(message.data).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'GET_ELEMENTS') {
    getElements().then(elements => {
      sendResponse({ elements });
    });
    return true;
  }
  
  if (message.type === 'UPDATE_NOTES') {
    updateNotes(message.data.id, message.data.notes).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'DELETE_ELEMENT') {
    deleteElement(message.data.id).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'CLEAR_ALL') {
    clearAllElements().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'UNDO_LAST') {
    undoLastElement().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'UPDATE_BADGE') {
    updateBadge(message.data.count);
    return true;
  }
  
  if (message.type === 'START_INSPECT') {
    // Send message to content script to start inspect mode
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'START_INSPECT' });
      }
    });
    return true;
  }
});

// Storage functions
async function storeElement(element) {
  const data = await getElements();
  element.id = generateId();
  element.timestamp = Date.now();
  data.elements.push(element);
  await chrome.storage.local.set(data);
  updateBadge(data.elements.length);
}

async function getElements() {
  const defaultData = { elements: [] };
  const data = await chrome.storage.local.get(defaultData);
  return data.elements || [];
}

async function updateNotes(id, notes) {
  const data = await chrome.storage.local.get({ elements: [] });
  const elements = data.elements || [];
  const index = elements.findIndex(el => el.id === id);
  if (index !== -1) {
    elements[index].notes = notes;
    await chrome.storage.local.set({ elements });
  }
}

async function deleteElement(id) {
  const data = await chrome.storage.local.get({ elements: [] });
  const elements = data.elements || [];
  const filtered = elements.filter(el => el.id !== id);
  await chrome.storage.local.set({ elements: filtered });
  updateBadge(filtered.length);
}

async function undoLastElement() {
  const data = await chrome.storage.local.get({ elements: [] });
  const elements = data.elements || [];
  if (elements.length > 0) {
    elements.pop();
    await chrome.storage.local.set({ elements });
    updateBadge(elements.length);
  }
}

async function clearAllElements() {
  await chrome.storage.local.set({ elements: [] });
  updateBadge(0);
}

function generateId() {
  return 'el_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#2563EB' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}