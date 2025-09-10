# Bionic Reader Extension - AI Coding Agent Instructions

## Architecture Overview

This is a browser extension that transforms text into "bionic reading" format by bolding the first portion of words to improve reading speed and comprehension. The extension uses Manifest V3 architecture with enterprise-grade security.

### Core Components

- **`content.js`** - Main text processing engine that transforms DOM text nodes
- **`background.js`** - Secure service worker handling extension lifecycle and messaging
- **`popup.js/popup.html`** - User interface for toggle and intensity controls
- **`src/bionic-core.js`** - Simplified transform logic for testing
- **`src/popup-inject.js`** - Content script injection helper

### Data Flow

1. User clicks toggle in popup → sends message to background.js
2. Background.js validates request and forwards to content.js
3. Content.js processes text nodes using bionic algorithm
4. Intensity changes flow: popup.js → background.js → content.js

## Key Patterns & Conventions

### Bionic Reading Algorithm

The core algorithm in `content.js` uses these patterns:

```javascript
// Function words (articles, prepositions) get 35% bolding ratio
const FUNCTION_WORD_RATIO = 0.35;
// Content words (nouns, verbs) get 50% bolding ratio  
const CONTENT_WORD_RATIO = 0.5;

// Intensity (0-1) scales the base ratio with multiplier 0.5 + intensity
const intensityMultiplier = Math.max(0, Math.min(2, 0.5 + Number(BIONIC_INTENSITY)));
const scaled = Math.max(0.05, Math.min(0.95, baseRatio * intensityMultiplier));
const boldCount = Math.min(N - 1, Math.max(1, Math.ceil(N * scaled)));
```

**Critical**: Words are split by letter positions, not character positions. Always use `word.match(/[a-zA-Z]/g)` to get letter arrays.

### Security Patterns

- **Input Sanitization**: All text is validated and size-limited before processing
- **Rate Limiting**: 100 requests per minute per tab tracked in background.js
- **Origin Validation**: Blocks dangerous protocols (chrome://, file://, etc.)
- **CSP Headers**: Content Security Policy prevents script injection

### DOM Processing Patterns

```javascript
// Skip elements that shouldn't be processed
const skipTags = ['SCRIPT', 'STYLE', 'H1', 'H2', 'H3', 'NAV', 'HEADER'];
if (skipTags.includes(element.tagName)) return true;

// Process in batches to avoid blocking
const CONFIG = {
  MAX_NODES_PER_BATCH: 100,
  MAX_TOTAL_NODES: 3000,
  BATCH_DELAY: 25
};
```

**Always** use `createTreeWalker` with `NodeFilter.SHOW_TEXT` for text node traversal.

## Development Workflows

### Testing
- Run tests: `npm test` (uses Jest with coverage)
- Tests are in `/tests/` directory with comprehensive coverage
- Mock Chrome APIs using `global.chrome = { ... }` pattern
- Tests cover popup UI, bionic algorithm, injection logic, and edge cases

### Building/Packaging
- Use `package_extension.bat` to create distribution zip
- Creates both `Bionic-Reader.zip` and `Bionic-Reader1/` folder for testing
- Only packages essential runtime files (manifest, js, css, icons)

### Extension Structure
```
manifest.json          # Manifest V3 with security permissions
background.js          # Service worker (NOT persistent)
content.js            # Injected into web pages  
popup.html/popup.js   # Extension popup UI
bionic.css           # Styles for bionic text spans
src/                 # Modular code for testing
tests/               # Jest test suite
```

## Critical Implementation Details

### Message Passing Security
Background.js validates all messages with `SecurityValidator.validateMessage()`. Always include error handling:

```javascript
chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (response) => {
  if (chrome.runtime.lastError) {
    // Handle connection errors, inject content script if needed
  }
});
```

### Text Processing Rules
- Merge adjacent text nodes before processing to maintain context
- Use `WeakMap` to store original text for cleanup: `originalTexts.set(wrapper, originalText)`
- Wrap transformed HTML in `<span class="bionic-wrapper">` for proper text selection
- Process max 3000 nodes per session to prevent performance issues

### Storage Patterns
- Use `chrome.storage.sync` for user preferences (intensity, enabled state)
- Settings persist across browser sessions and sync across devices
- Always provide defaults: `chrome.storage.sync.get({ bionicIntensity: 0.5 }, callback)`

## Common Gotchas

1. **Popup Context**: Popup.js runs in extension context, not page context. Use message passing to communicate with content scripts.

2. **Dynamic Content**: Use `MutationObserver` in content.js to handle SPAs and dynamic content updates.

3. **Font Weight**: Use dynamic font-weight calculation: `Math.round(300 + (intensity * 600))` for better visual distinction.

4. **Text Selection**: Ensure bionic text remains copyable by preserving original text in copy events and using proper CSS `user-select: text`.

5. **Restricted Pages**: Extension won't work on chrome://, edge://, file:// URLs. Handle gracefully in popup with clear messaging.

When working on this extension, prioritize security validation, batch processing for performance, and comprehensive error handling for the various browser contexts and page types.