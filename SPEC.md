# Element Inspector & Notepad - Chrome Extension Specification

## 1. Project Overview
- **Project Name**: Element Inspector & Notepad
- **Type**: Chrome Extension (Manifest V3)
- **Core Functionality**: Captures clicked elements with their details and provides a notepad interface to add notes for each element, useful for documenting bugs or changes for developers.
- **Target Users**: Web developers, QA testers, product managers who need to communicate element-level issues to developers.

## 2. UI/UX Specification

### Layout Structure
- **Extension Popup**: Triggered via browser action (extension icon click)
- **Inspect Mode Overlay**: Full-screen overlay when inspecting is active
- **Notepad Panel**: Side panel or popup showing captured elements and notes

### Visual Design
- **Color Palette**:
  - Primary: #2563EB (blue-600)
  - Secondary: #1E293B (slate-800)
  - Accent: #10B981 (emerald-500)
  - Background: #F8FAFC (slate-50)
  - Surface: #FFFFFF
  - Text Primary: #0F172A (slate-900)
  - Text Secondary: #64748B (slate-500)
  - Border: #E2E8F0 (slate-200)
  - Error/Highlight: #EF4444 (red-500)
  
- **Typography**:
  - Font Family: 'Segoe UI', system-ui, -apple-system, sans-serif
  - Heading: 16px, font-weight 600
  - Body: 14px, font-weight 400
  - Code/Technical: 12px, 'Consolas', 'Monaco', monospace
  
- **Spacing System**:
  - Base unit: 4px
  - Padding small: 8px
  - Padding medium: 16px
  - Padding large: 24px
  
- **Visual Effects**:
  - Box shadow (cards): 0 1px 3px rgba(0,0,0,0.1)
  - Border radius: 8px (cards), 4px (buttons/inputs)
  - Transitions: 150ms ease-in-out

### Components

#### 1. Main Popup (when clicking extension icon)
- **Header**: Title + "Start Inspecting" button
- **Content Area**: List of captured elements with notes
- **Footer**: Clear all / Export buttons

#### 2. Inspect Mode Overlay
- Semi-transparent overlay (#2563EB at 10% opacity)
- Cursor changes to crosshair
- Hover highlight on elements (border: 2px solid #2563EB)
- Click to capture element

#### 3. Element Card (in notepad)
- Element tag name and class (bold)
- CSS Selector (monospace, truncated)
- XPath (monospace, truncated)
- Attributes summary
- Line in source (if available)
- Notes textarea (expandable)
- Delete button

#### 4. States
- **Button Hover**: Background lightens 10%
- **Button Active**: Scale 0.98
- **Input Focus**: Border color changes to primary
- **Element Hover** (in inspect mode): Highlighted with border

## 3. Functionality Specification

### Core Features

1. **Inspect Mode**
   - Toggle via button click or keyboard shortcut (Ctrl+Shift+I for extension)
   - Adds overlay to page
   - Highlights elements on hover
   - Click to capture element info
   - Press Escape to exit inspect mode

2. **Element Information Capture**
   On click, capture:
   - Tag name (e.g., "button", "div", "a")
   - ID (if present)
   - Classes (array)
   - Key attributes (href, src, data-*, etc.)
   - CSS Selector (generated)
   - XPath (generated)
   - Text content (truncated to 100 chars)
   - Approximate source location (file + line, if sourcemap available)

3. **Notepad Functionality**
   - Store captured elements in extension storage
   - Each element has editable notes field
   - Auto-save notes on change
   - Reorder by drag (optional)
   - Delete individual entries
   - Clear all entries

4. **Export**
   - Export as structured text (for pasting into tickets/chat)
   - Format includes: element info + notes

### User Interactions
1. Click extension icon → Opens popup with element list
2. Click "Start Inspecting" → Enters inspect mode on current tab
3. Hover over elements → Shows highlight
4. Click element → Captures info, adds to list, exits inspect mode
5. Type in notes → Auto-saves
6. Click delete → Removes element from list
7. Click "Clear All" → Removes all elements
8. Click "Export" → Copies formatted text to clipboard

### Data Handling
- Storage: chrome.storage.local
- Data structure:
```json
{
  "elements": [
    {
      "id": "unique-id",
      "tagName": "button",
      "idAttr": "submit-btn",
      "classes": ["btn", "primary"],
      "attributes": {"type": "submit", "data-action": "save"},
      "cssSelector": "button#submit-btn.btn.primary",
      "xpath": "//button[@id='submit-btn']",
      "textContent": "Save changes",
      "sourceLocation": {"url": "index.html", "line": 42},
      "timestamp": 1234567890,
      "notes": ""
    }
  ]
}
```

### Edge Cases
- Elements inside iframes: Show warning that iframe content may be limited
- Shadow DOM: Attempt to capture, note limitations
- Very long attributes: Truncate display, full value in tooltip
- No source location: Show "Location unavailable"

## 4. Acceptance Criteria

### Visual Checkpoints
- [ ] Extension icon visible in Chrome toolbar
- [ ] Popup opens on icon click
- [ ] "Start Inspecting" button clearly visible
- [ ] Elements display as cards in list
- [ ] Notes textarea visible for each element
- [ ] Export button available
- [ ] Inspect mode highlights elements on hover
- [ ] Captured element added to list immediately

### Functional Checkpoints
- [ ] Can start inspect mode from popup
- [ ] Can click element to capture
- [ ] Element info (tag, classes, selector) captured correctly
- [ ] Can add/edit notes for each element
- [ ] Notes persist after closing/reopening popup
- [ ] Can delete individual elements
- [ ] Can clear all elements
- [ ] Can export as formatted text
- [ ] Escape exits inspect mode