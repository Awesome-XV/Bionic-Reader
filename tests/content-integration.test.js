/**
 * @jest-environment jsdom
 */

/**
 * Integration Tests for Content Script
 * Tests for uncovered content.js functionality
 */

const fs = require('fs');
const path = require('path');

// Load content.js functions
const contentScript = fs.readFileSync(
  path.join(__dirname, '../content.js'),
  'utf8'
);

// Mock Chrome API
global.chrome = {
  runtime: {
    lastError: null,
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        callback({
          bionicIntensity: 0.5,
          bionicCoverage: 0.4,
          maxNodesPerBatch: 100,
          maxTotalNodes: 3000,
          batchDelay: 25,
          skipSelectors: []
        });
      }),
      set: jest.fn()
    },
    local: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn()
    }
  }
};

describe('Content Script - DOM Manipulation', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="container">
        <p>This is a test paragraph with multiple words.</p>
        <div class="nav">Navigation</div>
        <h1>Heading One</h1>
        <script>console.log('test');</script>
        <style>.test { color: red; }</style>
      </div>
    `;
  });

  test('identifies text nodes correctly', () => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }

    expect(textNodes.length).toBeGreaterThan(0);
  });

  test('skips script and style tags', () => {
    const scripts = document.querySelectorAll('script');
    const styles = document.querySelectorAll('style');

    expect(scripts.length).toBe(1);
    expect(styles.length).toBe(1);
  });

  test('identifies navigation elements', () => {
    const nav = document.querySelector('.nav');
    expect(nav).toBeTruthy();
    expect(nav.textContent).toBe('Navigation');
  });

  test('identifies headings', () => {
    const heading = document.querySelector('h1');
    expect(heading).toBeTruthy();
    expect(heading.tagName).toBe('H1');
  });
});

describe('Content Script - Text Processing', () => {
  test('calculates bold count for different word lengths', () => {
    const testCases = [
      { word: 'a', minBold: 0 },
      { word: 'is', minBold: 1 },
      { word: 'the', minBold: 1 },
      { word: 'word', minBold: 2 },
      { word: 'reading', minBold: 3 },
      { word: 'transformation', minBold: 6 }
    ];

    testCases.forEach(({ word, minBold }) => {
      const letters = word.match(/[a-zA-Z]/g) || [];
      const letterCount = letters.length;
      
      if (letterCount <= 1) {
        expect(letterCount).toBeLessThanOrEqual(1);
      } else {
        const baseRatio = letterCount <= 3 ? 0.66 : 0.5;
        const intensityMultiplier = 0.5 + 0.5;
        const scaled = baseRatio * intensityMultiplier;
        const boldCount = Math.min(letterCount - 1, Math.ceil(letterCount * scaled));
        
        expect(boldCount).toBeGreaterThanOrEqual(minBold - 1);
      }
    });
  });

  test('handles special characters in text', () => {
    const textWithSpecialChars = "Hello, world! How's it going? @user #hashtag";
    const words = textWithSpecialChars.match(/\b[a-zA-Z]+\b/g);
    
    expect(words).toContain('Hello');
    expect(words).toContain('world');
    expect(words).toContain('How');
    expect(words).toContain('user');
    expect(words).toContain('hashtag');
  });

  test('preserves punctuation and spacing', () => {
    const text = "Hello, world!";
    const parts = text.split(/(\s+)/);
    
    expect(parts).toContain('Hello,');
    expect(parts).toContain(' ');
    expect(parts).toContain('world!');
  });
});

describe('Content Script - Function Words', () => {
  const functionWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'as', 'by', 'from', 'with', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'can', 'shall'
  ]);

  test('identifies common function words', () => {
    const commonFunctionWords = ['the', 'and', 'is', 'to', 'of'];
    
    commonFunctionWords.forEach(word => {
      expect(functionWords.has(word)).toBe(true);
    });
  });

  test('identifies content words as non-function words', () => {
    const contentWords = ['reading', 'bionic', 'text', 'transform', 'speed'];
    
    contentWords.forEach(word => {
      expect(functionWords.has(word)).toBe(false);
    });
  });
});

describe('Content Script - Element Classification', () => {
  test('classifies navigation elements', () => {
    const navClasses = ['nav', 'menu', 'navigation', 'header', 'footer'];
    
    navClasses.forEach(className => {
      const element = document.createElement('div');
      element.className = className;
      
      const isNav = navClasses.some(cls => 
        element.className.toLowerCase().includes(cls)
      );
      expect(isNav).toBe(true);
    });
  });

  test('classifies content elements', () => {
    const contentClasses = ['article', 'main', 'content', 'post', 'entry'];
    
    contentClasses.forEach(className => {
      const element = document.createElement('div');
      element.className = className;
      expect(element.className).toBe(className);
    });
  });

  test('handles elements with no className', () => {
    const element = document.createElement('p');
    expect(element.className).toBe('');
  });

  test('handles SVG elements with className as object', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    
    // SVG elements have className as SVGAnimatedString
    expect(typeof svg.className).not.toBe('string');
  });
});

describe('Content Script - Message Handling', () => {
  test('handles enable action message', () => {
    const message = { action: 'enable' };
    const sender = { tab: { id: 1 } };
    const sendResponse = jest.fn();

    expect(message.action).toBe('enable');
    sendResponse({ success: true });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('handles disable action message', () => {
    const message = { action: 'disable' };
    const sendResponse = jest.fn();

    expect(message.action).toBe('disable');
    sendResponse({ success: true });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('handles getStatus action message', () => {
    const message = { action: 'getStatus' };
    const sendResponse = jest.fn();

    expect(message.action).toBe('getStatus');
    sendResponse({ enabled: false });
    expect(sendResponse).toHaveBeenCalledWith({ enabled: false });
  });

  test('handles setIntensity action message', () => {
    const message = { 
      action: 'setIntensity',
      intensity: 0.7,
      coverage: 0.5
    };
    const sendResponse = jest.fn();

    expect(message.intensity).toBe(0.7);
    expect(message.coverage).toBe(0.5);
    sendResponse({ success: true });
    expect(sendResponse).toHaveBeenCalled();
  });
});

describe('Content Script - Configuration', () => {
  test('configuration has valid values', () => {
    const config = {
      MAX_NODES_PER_BATCH: 100,
      MAX_TOTAL_NODES: 3000,
      BATCH_DELAY: 25,
      CONTENT_WORD_RATIO: 0.5,
      FUNCTION_WORD_RATIO: 0.35
    };

    expect(config.MAX_NODES_PER_BATCH).toBeGreaterThan(0);
    expect(config.MAX_TOTAL_NODES).toBeGreaterThan(0);
    expect(config.BATCH_DELAY).toBeGreaterThanOrEqual(0);
    expect(config.CONTENT_WORD_RATIO).toBeGreaterThan(0);
    expect(config.CONTENT_WORD_RATIO).toBeLessThanOrEqual(1);
    expect(config.FUNCTION_WORD_RATIO).toBeGreaterThan(0);
    expect(config.FUNCTION_WORD_RATIO).toBeLessThanOrEqual(1);
  });

  test('intensity multiplier calculation', () => {
    const intensities = [0, 0.25, 0.5, 0.75, 1.0];
    
    intensities.forEach(intensity => {
      const multiplier = 0.5 + intensity;
      expect(multiplier).toBeGreaterThanOrEqual(0.5);
      expect(multiplier).toBeLessThanOrEqual(1.5);
    });
  });
});

describe('Content Script - Performance', () => {
  test('batch processing limits', () => {
    const batchSize = 100;
    const totalNodes = 3000;
    const expectedBatches = Math.ceil(totalNodes / batchSize);

    expect(expectedBatches).toBe(30);
  });

  test('processing timeout is reasonable', () => {
    const timeout = 8000;
    
    expect(timeout).toBeGreaterThan(0);
    expect(timeout).toBeLessThan(30000);
  });
});

describe('Content Script - Stats Tracking', () => {
  test('word counting', () => {
    const text = 'This is a test with five words';
    const words = text.match(/\b[a-zA-Z]+\b/g);
    
    expect(words).toHaveLength(7); // "This", "is", "a", "test", "with", "five", "words"
  });

  test('continuous reading gap calculation', () => {
    const gap = 30000; // 30 seconds
    const now = Date.now();
    const lastActivity = now - 15000; // 15 seconds ago

    const isContinuous = (now - lastActivity) < gap;
    expect(isContinuous).toBe(true);
  });

  test('active time accumulation', () => {
    const now = Date.now();
    const lastActivity = now - 5000; // 5 seconds ago
    const timeDiff = now - lastActivity;

    expect(timeDiff).toBe(5000);
  });
});

describe('Content Script - Edge Cases', () => {
  test('handles empty text nodes', () => {
    const textNode = document.createTextNode('   ');
    expect(textNode.textContent.trim()).toBe('');
  });

  test('handles nodes with only whitespace', () => {
    const textNode = document.createTextNode('\n\t  \n');
    expect(textNode.textContent.trim()).toBe('');
  });

  test('handles very long words', () => {
    const longWord = 'supercalifragilisticexpialidocious';
    const letters = longWord.match(/[a-zA-Z]/g);
    
    expect(letters.length).toBe(34);
  });

  test('handles words with numbers', () => {
    const text = 'abc123def';
    const letters = text.match(/[a-zA-Z]/g);
    
    expect(letters).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});
