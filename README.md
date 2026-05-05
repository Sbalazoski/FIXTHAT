# Element Inspector & Notepad

A Chrome extension that combines the Inspect Element functionality with a notepad for capturing element information and notes - perfect for documenting bugs and communicating changes to developers.

## Features

- **Inspect Mode**: Click "Start Inspecting" to enter the same element selection mode as Chrome DevTools (Ctrl+Shift+C)
- **Auto-Capture**: When you click an element, automatically captures:
  - Tag name (e.g., `<button>`, `<div>`, `<a>`)
  - ID (if present)
  - Classes
  - CSS Selector
  - XPath
  - Key attributes (href, src, type, data-*, aria-*, etc.)
  - Text content
  - Source location (file + line, if available)
- **Notepad Interface**: Add your own notes to each captured element
- **Export**: Copy formatted text to clipboard for pasting into tickets, chats, or emails

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `/workspace/project` folder (where this extension files are located)
5. The extension icon should appear in your Chrome toolbar

## Usage

1. Click the extension icon in the Chrome toolbar
2. Click **"Start Inspecting"** button
3. The page enters inspect mode (cursor changes to crosshair)
4. Hover over elements to see them highlighted
5. Click an element to capture its information
6. The popup reopens with the captured element in the list
7. Add your notes in the notes textarea
8. Repeat to capture more elements
9. Click **"Export"** to copy all captured data to clipboard

## Keyboard Shortcuts

- **Escape**: Exit inspect mode
- The extension mirrors Chrome DevTools' Inspect Element (Ctrl+Shift+C) behavior

## Data Storage

All captured elements and notes are stored locally in your Chrome profile. They persist between browser sessions but are specific to each extension installation.

## Export Format

Exported text includes all captured element information formatted as:

```
--- Element 1 ---
Tag: <button>
ID: #submit-btn
Classes: .btn.primary
CSS Selector: button#submit-btn.btn.primary
XPath: //button[@id='submit-btn']
Attributes:
  type: submit
  data-action: save
Notes: This button is not working on mobile devices
```

## Files

- `manifest.json`: Extension manifest
- `background.js`: Background service worker
- `content.js`: Content script (runs on web pages)
- `content.css`: Styles for inspect mode
- `popup.html`: Extension popup UI
- `popup.css`: Popup styles
- `popup.js`: Popup logic
- `icons/`: Extension icons