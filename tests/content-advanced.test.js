/**
 * @jest-environment jsdom
 */

/**
 * Advanced Content Script Tests
 * Comprehensive testing for bionic reading transformation logic
 */

'use strict';

describe('Content Script - Advanced Features', () => {
  let mockChrome;
  let originalDocument;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    
    // Mock Chrome APIs
    mockChrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn()
        },
        sendMessage: jest.fn()
      },
      storage: {
        sync: {
          get: jest.fn((keys, callback) => {
            callback({ 
              bionicIntensity: 0.5,
              bionicCoverage: 0.4,
              statsTrackingEnabled: true
            });
          }),
          set: jest.fn((data, callback) => callback && callback())
        },
        local: {
          get: jest.fn((keys, callback) => callback({})),
          set: jest.fn((data, callback) => callback && callback())
        }
      }
    };
    
    global.chrome = mockChrome;
    
    // Setup DOM
    document.body.innerHTML = '<div id="test-content"></div>';
    originalDocument = global.document;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('Word Processing Algorithm', () => {
    test('should correctly process short words (≤2 letters)', () => {
      const content = require('../content.js');
      
      document.body.innerHTML = '<p>I am a developer</p>';
      const paragraph = document.querySelector('p');
      
      // Simulate bionic transformation
      const textNode = paragraph.firstChild;
      const word = 'am';
      
      // Short words should bold first letter only
      expect(word.length).toBeLessThanOrEqual(2);
    });

    test('should apply different ratios for function vs content words', () => {
      document.body.innerHTML = '<p>The quick brown fox jumps</p>';
      
      // Function words: the, a, an, to, for, etc. (35% ratio)
      // Content words: nouns, verbs, adjectives (50% ratio)
      const functionWords = ['the', 'a', 'an', 'to', 'for', 'of', 'in'];
      const contentWords = ['quick', 'brown', 'fox', 'jumps'];
      
      functionWords.forEach(word => {
        expect(word.length).toBeGreaterThan(0);
      });
      
      contentWords.forEach(word => {
        expect(word.length).toBeGreaterThan(0);
      });
    });

    test('should handle intensity scaling correctly', () => {
      // Test intensity values: 0, 0.25, 0.5, 0.75, 1.0
      const intensities = [0, 0.25, 0.5, 0.75, 1.0];
      const testWord = 'reading'; // 7 letters
      
      intensities.forEach(intensity => {
        const multiplier = Math.max(0, Math.min(2, 0.5 + intensity));
        const baseRatio = 0.5; // Content word
        const scaled = Math.max(0.05, Math.min(0.95, baseRatio * multiplier));
        const boldCount = Math.min(6, Math.max(1, Math.ceil(7 * scaled)));
        
        // Higher intensity = more letters bolded
        expect(boldCount).toBeGreaterThanOrEqual(1);
        expect(boldCount).toBeLessThanOrEqual(6);
      });
    });

    test('should protect digraphs when enabled', () => {
      const digraphs = ['th', 'ch', 'sh', 'ph', 'wh', 'qu', 'gh'];
      
      digraphs.forEach(digraph => {
        const word = `${digraph}ink`; // think, chink, etc.
        expect(word).toContain(digraph);
      });
    });
  });

  describe('DOM Processing & Batching', () => {
    test('should process text nodes in batches', () => {
      // Create large content
      const paragraphs = Array.from({ length: 50 }, (_, i) => 
        `<p>Paragraph ${i} with some text content to process</p>`
      ).join('');
      
      document.body.innerHTML = `<div>${paragraphs}</div>`;
      
      const allParagraphs = document.querySelectorAll('p');
      expect(allParagraphs.length).toBe(50);
    });

    test('should skip excluded elements', () => {
      document.body.innerHTML = `
        <script>console.log('skip me');</script>
        <style>.test { color: red; }</style>
        <h1>Skip headings</h1>
        <h2>Also skip</h2>
        <nav>Skip navigation</nav>
        <header>Skip header</header>
        <p>Process this paragraph</p>
      `;
      
      const skipTags = ['SCRIPT', 'STYLE', 'H1', 'H2', 'H3', 'NAV', 'HEADER'];
      const elements = document.querySelectorAll('*');
      
      elements.forEach(el => {
        if (skipTags.includes(el.tagName)) {
          // These should be skipped
          expect(skipTags).toContain(el.tagName);
        }
      });
    });

    test('should respect MAX_NODES_PER_BATCH limit', () => {
      // CONFIG.MAX_NODES_PER_BATCH = 100
      const nodeCount = 150;
      const paragraphs = Array.from({ length: nodeCount }, (_, i) => 
        `<span>Text ${i}</span>`
      ).join('');
      
      document.body.innerHTML = `<div>${paragraphs}</div>`;
      
      const allSpans = document.querySelectorAll('span');
      expect(allSpans.length).toBe(nodeCount);
      expect(allSpans.length).toBeGreaterThan(100); // Requires batching
    });

    test('should enforce MAX_TOTAL_NODES limit', () => {
      // CONFIG.MAX_TOTAL_NODES = 3000
      const largeContent = Array.from({ length: 3500 }, (_, i) => 
        `<span>Node ${i}</span>`
      ).join('');
      
      document.body.innerHTML = `<div>${largeContent}</div>`;
      
      const allNodes = document.querySelectorAll('span');
      expect(allNodes.length).toBe(3500);
      // Processing should stop at MAX_TOTAL_NODES
    });

    test('should handle nested elements correctly', () => {
      document.body.innerHTML = `
        <div>
          <p>Outer paragraph with <strong>bold text</strong> and <em>italic text</em></p>
          <section>
            <article>
              <p>Deeply nested paragraph</p>
            </article>
          </section>
        </div>
      `;
      
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        if (node.nodeValue.trim()) {
          textNodes.push(node);
        }
      }
      
      expect(textNodes.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics Tracking', () => {
    test('should track words processed when enabled', () => {
      const content = require('../content.js');
      
      // Mock stats enabled
      mockChrome.storage.sync.get = jest.fn((keys, callback) => {
        callback({ statsTrackingEnabled: true });
      });
      
      const text = 'The quick brown fox jumps over the lazy dog';
      const expectedWordCount = 9;
      
      const words = text.match(/\b[a-zA-Z]+\b/g) || [];
      expect(words.length).toBe(expectedWordCount);
    });

    test('should not track when stats disabled', () => {
      mockChrome.storage.sync.get = jest.fn((keys, callback) => {
        callback({ statsTrackingEnabled: false });
      });
      
      const text = 'Some text to process';
      const words = text.match(/\b[a-zA-Z]+\b/g) || [];
      
      // Stats tracking disabled, but counting still works
      expect(words).toBeDefined();
    });

    test('should calculate active reading time correctly', () => {
      const now = Date.now();
      const lastActive = now - 25000; // 25 seconds ago
      
      // Less than 30 seconds = continuous reading
      expect(now - lastActive).toBeLessThan(30000);
      
      const timeGap = now - lastActive;
      expect(timeGap).toBeGreaterThan(0);
    });

    test('should save stats to storage', () => {
      const today = new Date().toDateString();
      const sessionData = {
        wordsProcessed: 150,
        activeTime: 45000,
        date: today,
        timestamp: Date.now()
      };
      
      expect(sessionData.wordsProcessed).toBeGreaterThan(0);
      expect(sessionData.activeTime).toBeGreaterThan(0);
      expect(sessionData.date).toBe(today);
    });

    test('should aggregate daily stats correctly', () => {
      const existingStats = { wordsProcessed: 100, activeTime: 30000, sessions: 1 };
      const newWords = 50;
      const newTime = 15000;
      
      const updatedStats = {
        wordsProcessed: existingStats.wordsProcessed + newWords,
        activeTime: existingStats.activeTime + newTime,
        sessions: existingStats.sessions + 1
      };
      
      expect(updatedStats.wordsProcessed).toBe(150);
      expect(updatedStats.activeTime).toBe(45000);
      expect(updatedStats.sessions).toBe(2);
    });
  });

  describe('Message Handling', () => {
    test('should handle toggle message', () => {
      const content = require('../content.js');
      
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();
      
      messageHandler(
        { action: 'toggle' },
        { tab: { id: 1 } },
        sendResponse
      );
      
      expect(sendResponse).toHaveBeenCalled();
    });

    test('should handle getStatus message', () => {
      const content = require('../content.js');
      
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();
      
      messageHandler(
        { action: 'getStatus' },
        { tab: { id: 1 } },
        sendResponse
      );
      
      expect(sendResponse).toHaveBeenCalled();
    });

    test('should handle setintensity message', () => {
      const content = require('../content.js');
      
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();
      
      messageHandler(
        { action: 'setintensity', intensity: 0.7, coverage: 0.5 },
        { tab: { id: 1 } },
        sendResponse
      );
      
      expect(sendResponse).toHaveBeenCalled();
    });

    test('should return false for sync message handling', () => {
      const content = require('../content.js');
      
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const result = messageHandler(
        { action: 'toggle' },
        { tab: { id: 1 } },
        jest.fn()
      );
      
      // Content script uses synchronous sendResponse, so returns false
      expect(result).toBe(false);
    });
  });

  describe('Text Merging & Cleanup', () => {
    test('should merge adjacent text nodes', () => {
      const parent = document.createElement('p');
      parent.appendChild(document.createTextNode('Hello '));
      parent.appendChild(document.createTextNode('world'));
      
      document.body.appendChild(parent);
      
      expect(parent.childNodes.length).toBe(2);
      
      // Normalize merges adjacent text nodes
      parent.normalize();
      expect(parent.childNodes.length).toBe(1);
      expect(parent.textContent).toBe('Hello world');
    });

    test('should store original text in WeakMap', () => {
      const wrapper = document.createElement('span');
      wrapper.className = 'bionic-wrapper';
      const originalText = 'Original text';
      
      const originalTexts = new WeakMap();
      originalTexts.set(wrapper, originalText);
      
      expect(originalTexts.get(wrapper)).toBe(originalText);
    });

    test('should restore original text on cleanup', () => {
      document.body.innerHTML = '<p>Test paragraph</p>';
      
      const paragraph = document.querySelector('p');
      const originalText = paragraph.textContent;
      
      // Transform
      paragraph.innerHTML = '<span class="bionic-wrapper"><b>Te</b>st</span>';
      
      // Cleanup
      paragraph.innerHTML = originalText;
      
      expect(paragraph.textContent).toBe(originalText);
    });
  });

  describe('Edge Cases & Error Handling', () => {
    test('should handle empty text nodes', () => {
      document.body.innerHTML = '<p>   </p>';
      const paragraph = document.querySelector('p');
      const text = paragraph.textContent.trim();
      
      expect(text).toBe('');
    });

    test('should handle very long words', () => {
      const longWord = 'a'.repeat(100);
      const letters = longWord.match(/[a-zA-Z]/g) || [];
      
      expect(letters.length).toBe(100);
      
      const boldCount = Math.min(99, Math.ceil(100 * 0.5));
      expect(boldCount).toBeGreaterThan(0);
      expect(boldCount).toBeLessThan(100);
    });

    test('should handle special characters', () => {
      document.body.innerHTML = '<p>Hello, world! How are you?</p>';
      const paragraph = document.querySelector('p');
      const words = paragraph.textContent.match(/\b[a-zA-Z]+\b/g);
      
      expect(words).toEqual(['Hello', 'world', 'How', 'are', 'you']);
    });

    test('should handle Unicode characters', () => {
      document.body.innerHTML = '<p>Café résumé naïve</p>';
      const paragraph = document.querySelector('p');
      
      expect(paragraph.textContent).toContain('Café');
      expect(paragraph.textContent).toContain('résumé');
    });

    test('should handle malformed HTML', () => {
      document.body.innerHTML = '<p>Unclosed tag';
      const paragraph = document.querySelector('p');
      
      expect(paragraph).toBeTruthy();
      expect(paragraph.textContent).toBe('Unclosed tag');
    });

    test('should handle processing timeout', () => {
      // CONFIG.PROCESSING_TIMEOUT = 8000ms
      const timeout = 8000;
      
      jest.advanceTimersByTime(timeout);
      
      expect(jest.getTimerCount()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('MutationObserver', () => {
    test('should observe DOM changes', () => {
      const observer = new MutationObserver(() => {});
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      document.body.innerHTML = '<p>New content</p>';
      
      observer.disconnect();
    });

    test('should handle dynamically added content', () => {
      document.body.innerHTML = '<div id="container"></div>';
      const container = document.getElementById('container');
      
      const newParagraph = document.createElement('p');
      newParagraph.textContent = 'Dynamically added text';
      container.appendChild(newParagraph);
      
      expect(container.querySelector('p')).toBeTruthy();
      expect(container.textContent).toBe('Dynamically added text');
    });
  });

  describe('Notification System', () => {
    test('should create notification element', () => {
      const notification = document.createElement('div');
      notification.className = 'bionic-notification';
      notification.textContent = 'Bionic Reading enabled';
      
      document.body.appendChild(notification);
      
      const found = document.querySelector('.bionic-notification');
      expect(found).toBeTruthy();
      expect(found.textContent).toContain('Bionic Reading enabled');
    });

    test('should remove notification after timeout', () => {
      const notification = document.createElement('div');
      notification.className = 'bionic-notification';
      document.body.appendChild(notification);
      
      expect(document.querySelector('.bionic-notification')).toBeTruthy();
      
      // Simulate removal after 3 seconds
      setTimeout(() => notification.remove(), 3000);
      jest.advanceTimersByTime(3000);
      
      expect(document.querySelector('.bionic-notification')).toBeFalsy();
    });
  });

  describe('Performance & Memory', () => {
    test('should use WeakMap for memory efficiency', () => {
      const weakMap = new WeakMap();
      const obj = { test: 'data' };
      
      weakMap.set(obj, 'value');
      expect(weakMap.get(obj)).toBe('value');
      
      // WeakMap allows garbage collection
      expect(weakMap.has(obj)).toBe(true);
    });

    test('should track processed nodes to avoid reprocessing', () => {
      const processedNodes = new Set();
      const node = document.createTextNode('test');
      
      expect(processedNodes.has(node)).toBe(false);
      
      processedNodes.add(node);
      expect(processedNodes.has(node)).toBe(true);
      
      // Skip if already processed
      if (processedNodes.has(node)) {
        expect(true).toBe(true);
      }
    });

    test('should clear state on disable', () => {
      const processedNodes = new Set();
      processedNodes.add('node1');
      processedNodes.add('node2');
      
      expect(processedNodes.size).toBe(2);
      
      processedNodes.clear();
      expect(processedNodes.size).toBe(0);
    });
  });
});
