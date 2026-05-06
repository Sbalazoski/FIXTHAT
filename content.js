// Content script for Element Inspector & Notepad
// Handles inspect mode and element information capture

let isInspecting = false;
let highlightOverlay = null;
let currentHoveredElement = null;

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_INSPECT') {
    startInspectMode();
    sendResponse({ success: true });
    return true; // Required for async response
  }
  if (message.type === 'STOP_INSPECT') {
    stopInspectMode();
    sendResponse({ success: true });
    return true; // Required for async response
  }
  if (message.type === 'GET_AI_DESCRIPTION') {
    // Get AI description - request from background
    chrome.runtime.sendMessage({ type: 'GET_ELEMENTS' }, (elements) => {
      const el = elements?.[message.data.index];
      if (el) {
        // Try to find element on page
        const found = document.querySelector(el.cssSelector);
        if (found) {
          const info = extractElementInfo(found);
          const aiDesc = generateAIDescription(found, info);
          sendResponse({ success: true, description: aiDesc });
        } else {
          sendResponse({ success: true, description: generateAIDescriptionFromStored(el) });
        }
      } else {
        sendResponse({ success: false, error: 'No elements captured yet' });
      }
    });
    return true;
  }
  if (message.type === 'GET_CLICK_COORDINATES') {
    // Enter coordinate capture mode for Point A and Point B
    isCapturingCoords = true;
    captureMode = 'pointA'; // Start with point A
    startInspectMode(); // Use inspect mode visuals
    
    const coordHandler = (event) => {
      if (!isCapturingCoords) return;
      event.preventDefault();
      event.stopPropagation();
      
      const coords = getClickCoordinates(event);
      const target = event.target;
      const elementInfo = extractElementInfo(target);
      
      if (captureMode === 'pointA') {
        // Store Point A
        window.__inspectorPointA = { coords, element: elementInfo, timestamp: Date.now() };
        isCapturingCoords = true;
        captureMode = 'pointB';
        
        showNotification(`Point A captured (${coords.x}, ${coords.y}) - Click for Point B or wait 2s...`);
        
        // Auto-capture point B after short delay if user doesn't click
        window.__pointBTimer = setTimeout(() => {
          if (captureMode === 'pointB' && window.__inspectorPointA) {
            showNotification('Now click Point B or press Escape to cancel');
          }
        }, 2000);
        
      } else if (captureMode === 'pointB') {
        // Store Point B
        clearTimeout(window.__pointBTimer);
        window.__inspectorPointB = { coords, element: elementInfo, timestamp: Date.now() };
        
        // Calculate flow/distance
        const dx = coords.x - window.__inspectorPointA.coords.x;
        const dy = coords.y - window.__inspectorPointA.coords.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        // Stop capture mode
        isCapturingCoords = false;
        captureMode = null;
        stopInspectMode();
        
        const flowInfo = {
          pointA: window.__inspectorPointA,
          pointB: window.__inspectorPointB,
          delta: { x: dx, y: dy },
          distance: Math.round(distance),
          direction: getDirectionName(dx, dy)
        };
        
        sendResponse({ success: true, flow: flowInfo });
        showNotification(`Flow captured! Distance: ${Math.round(distance)}px`);
        
        // Clear stored points after delay
        setTimeout(() => {
          window.__inspectorPointA = null;
          window.__inspectorPointB = null;
        }, 30000);
      }
    };
    
    const escapeCoordHandler = (event) => {
      if (event.key === 'Escape') {
        clearTimeout(window.__pointBTimer);
        document.removeEventListener('click', coordHandler, true);
        document.removeEventListener('keydown', escapeCoordHandler, true);
        isCapturingCoords = false;
        captureMode = null;
        stopInspectMode();
        sendResponse({ success: false, cancelled: true });
      }
    };
    
    document.addEventListener('click', coordHandler, true);
    document.addEventListener('keydown', escapeCoordHandler, true);
    return true;
  }
  if (message.type === 'GET_VIEWPORT_INFO') {
    sendResponse({ success: true, info: captureViewportInfo() });
    return true;
  }
  if (message.type === 'GET_PRESETS') {
    sendResponse({ success: true, presets: LAYOUT_PRESETS });
    return true;
  }
  if (message.type === 'ANALYZE_STACKING') {
    const found = document.querySelector(message.data.selector);
    if (found) {
      const stacking = analyzeStackingContext(found);
      sendResponse({ success: true, stacking });
    } else {
      sendResponse({ success: false, error: 'Element not found' });
    }
    return true;
  }
  if (message.type === 'GET_CAPTURED_ELEMENTS') {
    // Get all elements captured so far in this session
    sendResponse({ 
      success: true, 
      elements: capturedElements,
      count: capturedElements.length 
    });
    return true;
  }
  if (message.type === 'STORE_ELEMENT_REALTIME') {
    // Store element in real-time during inspect
    const el = message.data.element;
    capturedElements.push(el);
    sendResponse({ success: true, index: capturedElements.length - 1 });
    return true;
  }
});

// Direction helper
function getDirectionName(dx, dy) {
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > -22.5 && angle <= 22.5) return 'right';
  if (angle > 22.5 && angle <= 67.5) return 'down-right';
  if (angle > 67.5 && angle <= 112.5) return 'down';
  if (angle > 112.5 && angle <= 157.5) return 'down-left';
  if (angle > 157.5 || angle <= -157.5) return 'left';
  if (angle > -157.5 && angle <= -112.5) return 'up-left';
  if (angle > -112.5 && angle <= -67.5) return 'up';
  if (angle > -67.5 && angle <= -22.5) return 'up-right';
  return 'unknown';
}

// Session storage for elements captured in current page session
let capturedElements = [];

let isCapturingCoords = false;
let captureMode = null;

// Helper function to generate AI description from stored data
function generateAIDescriptionFromStored(elementInfo) {
  const parts = [];
  parts.push(`## Element Location`);
  parts.push(`CSS Selector: ${elementInfo.cssSelector}`);
  parts.push(`XPath: ${elementInfo.xpath}`);
  parts.push(`\n## Element Details`);
  parts.push(`Tag: <${elementInfo.tagName}>`);
  if (elementInfo.idAttr) parts.push(`ID: ${elementInfo.idAttr}`);
  if (elementInfo.classes && elementInfo.classes.length > 0) {
    parts.push(`Classes: ${elementInfo.classes.map(c => '.' + c).join(' ')}`);
  }
  if (elementInfo.attributes && Object.keys(elementInfo.attributes).length > 0) {
    parts.push(`\n## Key Attributes`);
    Object.entries(elementInfo.attributes).forEach(([key, val]) => {
      parts.push(`${key}="${val}"`);
    });
  }
  if (elementInfo.computedStyles) {
    parts.push(`\n## Styles`);
    Object.entries(elementInfo.computedStyles).forEach(([key, val]) => {
      parts.push(`${key}: ${val}`);
    });
  }
  parts.push(`\n## Suggested Fix (for AI agent)`);
  parts.push(`[Describe what you want to change here]`);
  return parts.join('\n');
}

function startInspectMode() {
  if (isInspecting) return;
  isInspecting = true;
  
  console.log('Element Inspector: Starting inspect mode');
  
  // Create overlay element
  highlightOverlay = document.createElement('div');
  highlightOverlay.id = 'element-inspector-overlay';
  document.body.appendChild(highlightOverlay);
  
  // Create visual inspector bar at top of page
  const inspectorBar = document.createElement('div');
  inspectorBar.id = 'element-inspector-bar';
  inspectorBar.innerHTML = `
    <span class="inspector-bar-title">◎ Element Inspector Active</span>
    <span class="inspector-bar-hint">Click any element to capture it</span>
    <span class="inspector-bar-hint">Press <kbd>Esc</kbd> to cancel</span>
  `;
  document.body.appendChild(inspectorBar);
  
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
  
  // Remove inspector bar
  const inspectorBar = document.getElementById('element-inspector-bar');
  if (inspectorBar) {
    inspectorBar.remove();
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
  if (!isInspecting && !isCapturingCoords) return;
  event.preventDefault();
  event.stopPropagation();
  
  const target = event.target;
  const elementInfo = extractElementInfo(target);
  
  // Add to session elements (for real-time popup UI)
  capturedElements.push(elementInfo);
  
  // Send to background script for persistent storage
  chrome.runtime.sendMessage({
    type: 'STORE_ELEMENT',
    data: elementInfo
  });
  
  // Keep inspect mode active for multiple captures
  // (don't call stopInspectMode() unless user presses Escape)
  
  // Notify user
  showNotification(`Element captured: <${target.tagName.toLowerCase()}> (${capturedElements.length} total)`);
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

// ============ NEW DEVELOPER FEATURES ============

// Stacking Context Analysis - finds all elements that might be stacking issues
function analyzeStackingContext(element) {
  const info = {
    zIndex: null,
    position: null,
    hasStackingIssue: false,
    blockingElements: []
  };
  
  try {
    const computed = window.getComputedStyle(element);
    info.position = computed.position;
    info.zIndex = computed.zIndex;
    info.opacity = computed.opacity;
    info.overflow = computed.overflow;
    
    // Check for stacking context issues
    if (info.position !== 'static' || info.zIndex !== 'auto' || info.opacity < 1 || info.overflow === 'hidden') {
      info.hasStackingIssue = true;
    }
    
    // Find potential blocking elements (positioned elements in the same container)
    const parent = element.parentElement;
    if (parent) {
      const siblings = parent.children;
      for (const sib of siblings) {
        if (sib === element) continue;
        const sibStyle = window.getComputedStyle(sib);
        if (sibStyle.position !== 'static' || sibStyle.zIndex !== 'auto') {
          info.blockingElements.push({
            tagName: sib.tagName.toLowerCase(),
            id: sib.id || null,
            classes: Array.from(sib.classList).slice(0, 3),
            position: sibStyle.position,
            zIndex: sibStyle.zIndex
          });
        }
      }
    }
  } catch (e) {
    // Accessibility restricted
  }
  
  return info;
}

// Generate AI Agent Description - prompt-ready text
function generateAIDescription(element, elementInfo) {
  const parts = [];
  
  // Location
  parts.push(`## Element Location`);
  parts.push(`Page: ${window.location.href}`);
  parts.push(`CSS Selector: ${elementInfo.cssSelector}`);
  parts.push(`XPath: ${elementInfo.xpath}`);
  
  // Element details
  parts.push(`\n## Element Details`);
  parts.push(`Tag: <${elementInfo.tagName}>`);
  if (elementInfo.idAttr) {
    parts.push(`ID: ${elementInfo.idAttr}`);
  }
  if (elementInfo.classes && elementInfo.classes.length > 0) {
    parts.push(`Classes: ${elementInfo.classes.map(c => '.' + c).join(' ')}`);
  }
  
  // Key attributes
  if (elementInfo.attributes && Object.keys(elementInfo.attributes).length > 0) {
    parts.push(`\n## Key Attributes`);
    Object.entries(elementInfo.attributes).forEach(([key, val]) => {
      parts.push(`${key}="${val}"`);
    });
  }
  
  // Dimensions & position
  const rect = element.getBoundingClientRect();
  parts.push(`\n## Layout`);
  parts.push(`Dimensions: ${Math.round(rect.width)}px × ${Math.round(rect.height)}px`);
  parts.push(`Position (viewport): x:${Math.round(rect.x)}, y:${Math.round(rect.y)}`);
  parts.push(`Margin: ${getComputedStyle(element).margin}`);
  
  // Stacking info
  const stacking = analyzeStackingContext(element);
  if (stacking.hasStackingIssue) {
    parts.push(`\n## Stacking Context`);
    parts.push(`Position: ${stacking.position}`);
    parts.push(`Z-index: ${stacking.zIndex}`);
    parts.push(`Opacity: ${stacking.opacity}`);
    parts.push(`Overflow: ${stacking.overflow}`);
  }
  
  // Text content
  if (elementInfo.textContent) {
    parts.push(`\n## Text Content`);
    parts.push(`"${elementInfo.textContent}"`);
  }
  
  // For beginners: what to tell an agent
  parts.push(`\n## Suggested Fix (for AI agent)`);
  parts.push(`[Describe what you want to change here]`);
  
  return parts.join('\n');
}

// Get element click coordinates (mapping system)
function getClickCoordinates(event) {
  return {
    x: event.clientX,
    y: event.clientY,
    pageX: event.pageX,
    pageY: event.pageY,
    screenX: event.screenX,
    screenY: event.screenY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pageWidth: document.documentElement.scrollWidth,
    pageHeight: document.documentElement.scrollHeight
  };
}

// Industry Standard Layout Presets
const LAYOUT_PRESETS = {
  button: {
    height: '40px (mobile: 36px)',
    minWidth: '120px',
    padding: '12px 24px',
    borderRadius: '6px (primary), 4px (secondary)',
    fontSize: '14px (16px for emphasis)',
    fontWeight: '500-600'
  },
  input: {
    height: '40px',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '14px',
    border: '1px solid #d1d5db'
  },
  card: {
    padding: '16px or 24px',
    borderRadius: '8px',
    shadow: '0 1px 3px rgba(0,0,0,0.1)',
    maxWidth: '360px (common)'
  },
  modal: {
    width: '90% max 500px',
    padding: '24px',
    borderRadius: '12px',
    overlay: 'rgba(0,0,0,0.5)'
  },
  navbar: {
    height: '60px (desktop), 56px (mobile)',
    padding: '0 16px or 24px'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  },
  breakpoints: {
    mobile: '320px - 480px',
    tablet: '481px - 768px',
    desktop: '769px - 1024px',
    wide: '1025px+'
  },
  typography: {
    h1: '32px / 40px line-height',
    h2: '28px / 36px',
    h3: '24px / 32px',
    h4: '20px / 28px',
    body: '16px / 24px',
    small: '14px / 20px',
    caption: '12px / 16px'
  }
};

// Capture complete responsive info
function captureViewportInfo() {
  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    document: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight
    },
    devicePixelRatio: window.devicePixelRatio,
    colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    breakpoints: {
      isMobile: window.innerWidth < 481,
      isTablet: window.innerWidth >= 481 && window.innerWidth < 769,
      isDesktop: window.innerWidth >= 769 && window.innerWidth < 1025,
      isWide: window.innerWidth >= 1025
    },
    scrollPosition: {
      x: window.scrollX,
      y: window.scrollY
    }
  };
}