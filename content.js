// Content script for Element Inspector & Notepad
// Handles inspect mode and element information capture

let isInspecting = false;
let highlightOverlay = null;
let currentHoveredElement = null;

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_INSPECT') {
    startInspectMode();
  }
  if (message.type === 'STOP_INSPECT') {
    stopInspectMode();
  }
});

function startInspectMode() {
  if (isInspecting) return;
  isInspecting = true;
  
  console.log('Element Inspector: Starting inspect mode');
  
  // Create overlay element
  highlightOverlay = document.createElement('div');
  highlightOverlay.id = 'element-inspector-overlay';
  document.body.appendChild(highlightOverlay);
  
  // Add event listeners
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  
  // Change cursor
  document.body.style.cursor = 'crosshair';
}

function stopInspectMode() {
  if (!isInspecting) return;
  isInspecting = false;
  
  console.log('Element Inspector: Stopping inspect mode');
  
  // Remove overlay
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
  
  // Remove highlight from current element
  if (currentHoveredElement) {
    currentHoveredElement.classList.remove('element-inspector-highlight');
    currentHoveredElement = null;
  }
  
  // Remove event listeners
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  
  // Reset cursor
  document.body.style.cursor = '';
}

function handleMouseOver(event) {
  if (!isInspecting) return;
  
  const target = event.target;
  if (target === highlightOverlay || target.tagName === 'BODY') return;
  
  // Remove highlight from previous
  if (currentHoveredElement && currentHoveredElement !== target) {
    currentHoveredElement.classList.remove('element-inspector-highlight');
  }
  
  // Add highlight to current
  target.classList.add('element-inspector-highlight');
  currentHoveredElement = target;
}

function handleMouseOut(event) {
  if (!isInspecting) return;
  
  const target = event.target;
  if (currentHoveredElement === target) {
    target.classList.remove('element-inspector-highlight');
    currentHoveredElement = null;
  }
}

function handleClick(event) {
  if (!isInspecting) return;
  event.preventDefault();
  event.stopPropagation();
  
  const target = event.target;
  const elementInfo = extractElementInfo(target);
  
  // Send to background script
  chrome.runtime.sendMessage({
    type: 'STORE_ELEMENT',
    data: elementInfo
  });
  
  // Stop inspect mode after捕获
  stopInspectMode();
  
  // Notify user
  showNotification(`Element captured: <${target.tagName.toLowerCase()}>`);
}

function handleKeyDown(event) {
  if (event.key === 'Escape') {
    stopInspectMode();
  }
}

function extractElementInfo(element) {
  const info = {
    tagName: element.tagName.toLowerCase(),
    idAttr: element.id || null,
    classes: element.className ? Array.from(element.classList).filter(c => c) : [],
    attributes: {},
    cssSelector: generateCSSSelector(element),
    xpath: generateXPath(element),
    textContent: element.textContent ? element.textContent.trim().substring(0, 100) : '',
    sourceLocation: null,
    computedStyles: extractComputedStyles(element),
    isInShadowDOM: isElementInShadowDOM(element),
    isInIframe: isElementInIframe(element)
  };
  
  // Capture key attributes
  const importantAttrs = ['href', 'src', 'type', 'name', 'value', 'placeholder', 'alt', 'title', 'data-*', 'aria-*'];
  for (const attr of importantAttrs) {
    if (attr.startsWith('data-')) {
      // Capture all data attributes
      Array.from(element.attributes).forEach(att => {
        if (att.name.startsWith('data-')) {
          info.attributes[att.name] = att.value;
        }
      });
    } else if (attr.startsWith('aria-')) {
      // Capture all aria attributes
      Array.from(element.attributes).forEach(att => {
        if (att.name.startsWith('aria-')) {
          info.attributes[att.name] = att.value;
        }
      });
    } else if (element.hasAttribute(attr)) {
      info.attributes[attr] = element.getAttribute(attr);
    }
  }
  
  // Attempt to get source location
  if (element.sourceURL) {
    info.sourceLocation = {
      url: element.sourceURL,
      line: element.startLine || 0
    };
  }
  
  return info;
}

function extractComputedStyles(element) {
  const styles = {};
  try {
    const computed = window.getComputedStyle(element);
    if (!computed) return styles;
    
    // Key style properties to capture
    const styleKeys = [
      'color', 'backgroundColor', 'background', 'fontSize', 'fontFamily', 'fontWeight',
      'display', 'position', 'visibility', 'opacity',
      'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
      'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
      'borderColor', 'borderWidth', 'borderRadius',
      'boxShadow', 'textAlign', 'lineHeight', 'zIndex', 'overflow'
    ];
    
    styleKeys.forEach(key => {
      const value = computed.getPropertyValue(key);
      if (value && value !== 'auto' && value !== 'none' && value !== '0px' && value !== 'normal') {
        styles[key] = value;
      }
    });
  } catch (e) {
    // Styles not accessible
  }
  return styles;
}

function isElementInShadowDOM(element) {
  return !!element.closest && !!element.getRootNode && element.getRootNode() !== document;
}

function isElementInIframe(element) {
  try {
    return window.location !== window.parent.location;
  } catch (e) {
    return true;
  }
}

function generateCSSSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className && element.classList.length > 0) {
    const classes = Array.from(element.classList).filter(c => c).slice(0, 3).join('.');
    return `${element.tagName.toLowerCase()}.${classes}`;
  }
  
  // Generate path-based selector
  let selector = element.tagName.toLowerCase();
  let parent = element.parentElement;
  let index = 1;
  
  while (parent) {
    const siblings = Array.from(parent.children).filter(
      child => child.tagName === element.tagName
    );
    
    if (siblings.length > 1) {
      const idx = siblings.indexOf(element) + 1;
      selector = `${parent.tagName.toLowerCase()} > ${selector}:nth-of-type(${idx})`;
    } else {
      selector = `${parent.tagName.toLowerCase()} > ${selector}`;
    }
    
    if (parent.id || parent.tagName === 'BODY') break;
    element = parent;
    parent = parent.parentElement;
  }
  
  return selector;
}

function generateXPath(element) {
  if (element.id) {
    return `//*[@id='${element.id}']`;
  }
  
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    let tag = current.tagName.toLowerCase();
    
    if (current.id) {
      path.unshift(`*[@id='${current.id}']`);
      break;
    }
    
    // Calculate index
    let index = 1;
    let sibling = current.previousElementSibling;
    
    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }
    
    if (index > 1) {
      path.unshift(`${tag}[${index}]`);
    } else {
      path.unshift(tag);
    }
    
    current = current.parentElement;
  }
  
  path.unshift('*');
  return '//' + path.join('/');
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.id = 'element-inspector-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}