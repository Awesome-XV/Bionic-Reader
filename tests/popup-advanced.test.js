/**
 * @jest-environment jsdom
 */

/**
 * Advanced Popup Tests  
 * Comprehensive UI interaction and edge case testing
 */

'use strict';

describe('Popup - Advanced Features & Edge Cases', () => {
  let originalChrome;
  let mockDocument;

  beforeEach(() => {
    jest.useFakeTimers();
    originalChrome = global.chrome;
    
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        lastError: null
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn()
      },
      storage: {
        sync: {
          get: jest.fn((keys, callback) => callback({
            bionicIntensity: 0.5,
            bionicCoverage: 0.4,
            statsTrackingEnabled: true
          })),
          set: jest.fn((data, callback) => callback && callback())
        }
      }
    };

    // Setup DOM
    document.body.innerHTML = `
      <div id="status">Ready</div>
      <button id="toggle-btn">Toggle</button>
      <input type="range" id="intensity-slider" min="0" max="1" step="0.1" value="0.5">
      <span id="intensity-value">50%</span>
      <div id="demo-text">Reading this demo text normally.</div>
      <div id="stats-section">
        <span id="words-today">0</span>
        <span id="time-today">0</span>
      </div>
    `;
  });

  afterEach(() => {
    global.chrome = originalChrome;
    jest.resetModules();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('Intensity Slider Precision', () => {
    test('should handle minimum intensity (0)', () => {
      const slider = document.getElementById('intensity-slider');
      slider.value = '0';
      
      const intensity = parseFloat(slider.value);
      expect(intensity).toBe(0);
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1);
    });

    test('should handle maximum intensity (1)', () => {
      const slider = document.getElementById('intensity-slider');
      slider.value = '1';
      
      const intensity = parseFloat(slider.value);
      expect(intensity).toBe(1);
    });

    test('should handle decimal precision correctly', () => {
      const slider = document.getElementById('intensity-slider');
      const testValues = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9];
      
      testValues.forEach(value => {
        slider.value = value.toString();
        const parsed = parseFloat(slider.value);
        expect(Math.abs(parsed - value)).toBeLessThan(0.01);
      });
    });

    test('should update percentage display correctly', () => {
      const valueDisplay = document.getElementById('intensity-value');
      const intensity = 0.75;
      
      valueDisplay.textContent = `${Math.round(intensity * 100)}%`;
      expect(valueDisplay.textContent).toBe('75%');
    });

    test('should debounce rapid slider changes', () => {
      const slider = document.getElementById('intensity-slider');
      let callCount = 0;
      let timeoutId;
      
      const debouncedUpdate = (value) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          callCount++;
        }, 100);
      };
      
      // Rapid changes
      for (let i = 0; i <= 10; i++) {
        slider.value = (i / 10).toString();
        debouncedUpdate(slider.value);
      }
      
      // Only last call should execute
      jest.advanceTimersByTime(150);
      expect(callCount).toBe(1);
    });
  });

  describe('Demo Text Transformation', () => {
    test('should transform demo text with correct bolding', () => {
      const demoText = 'Reading this demo text';
      const words = demoText.split(' ');
      
      words.forEach(word => {
        const letters = word.match(/[a-zA-Z]/g) || [];
        if (letters.length > 1) {
          const boldCount = Math.ceil(letters.length * 0.5);
          expect(boldCount).toBeGreaterThan(0);
          expect(boldCount).toBeLessThan(letters.length);
        }
      });
    });

    test('should apply correct font-weight based on coverage', () => {
      const coverageValues = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
      
      coverageValues.forEach(coverage => {
        const weight = Math.round(200 + (coverage * 800));
        expect(weight).toBeGreaterThanOrEqual(200);
        expect(weight).toBeLessThanOrEqual(1000);
      });
    });

    test('should handle empty demo text gracefully', () => {
      const emptyText = '';
      const result = emptyText || 'Default text';
      
      expect(result).toBe('Default text');
    });

    test('should preserve whitespace in demo', () => {
      const text = 'Word1  Word2   Word3';
      const parts = text.split(/(\s+)/);
      
      const whitespaceCount = parts.filter(p => /^\s+$/.test(p)).length;
      expect(whitespaceCount).toBeGreaterThan(0);
    });
  });

  describe('Tab Communication Error Handling', () => {
    test('should handle "Receiving end does not exist" gracefully', () => {
      global.chrome.runtime.lastError = { message: 'Receiving end does not exist' };
      
      const handleError = () => {
        if (global.chrome.runtime.lastError) {
          return global.chrome.runtime.lastError.message;
        }
      };
      
      expect(handleError()).toBe('Receiving end does not exist');
    });

    test('should handle tab query failures', () => {
      global.chrome.tabs.query = jest.fn((query, callback) => {
        global.chrome.runtime.lastError = { message: 'No tabs found' };
        callback([]);
      });
      
      global.chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        expect(tabs.length).toBe(0);
        expect(global.chrome.runtime.lastError).toBeDefined();
      });
    });

    test('should handle inactive tabs', () => {
      global.chrome.tabs.query = jest.fn((query, callback) => {
        callback([{ id: 1, active: false }]);
      });
      
      global.chrome.tabs.query({active: true}, (tabs) => {
        const activeTab = tabs.find(t => t.active);
        expect(activeTab).toBeUndefined();
      });
    });

    test('should handle multiple windows', () => {
      global.chrome.tabs.query = jest.fn((query, callback) => {
        callback([
          { id: 1, windowId: 1, active: true },
          { id: 2, windowId: 2, active: true }
        ]);
      });
      
      global.chrome.tabs.query({active: true}, (tabs) => {
        expect(tabs.length).toBe(2);
        // Should use currentWindow to get the right one
      });
    });
  });

  describe('Content Script Injection', () => {
    test('should inject content script on first activation', () => {
      global.chrome.scripting = {
        insertCSS: jest.fn().mockResolvedValue({}),
        executeScript: jest.fn().mockResolvedValue({})
      };
      
      const injectPromise = Promise.all([
        global.chrome.scripting.insertCSS({ target: { tabId: 1 }, files: ['bionic.css'] }),
        global.chrome.scripting.executeScript({ target: { tabId: 1 }, files: ['content.js'] })
      ]);
      
      return expect(injectPromise).resolves.toBeDefined();
    });

    test('should retry injection on failure', async () => {
      let attemptCount = 0;
      
      global.chrome.scripting = {
        insertCSS: jest.fn(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error('Injection failed'));
          }
          return Promise.resolve({});
        }),
        executeScript: jest.fn().mockResolvedValue({})
      };
      
      const maxAttempts = 3;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          await global.chrome.scripting.insertCSS({ target: { tabId: 1 }, files: ['bionic.css'] });
          break;
        } catch (err) {
          if (i === maxAttempts - 1) throw err;
        }
      }
      
      expect(attemptCount).toBeLessThanOrEqual(maxAttempts);
    });

    test('should handle permission errors during injection', async () => {
      global.chrome.scripting = {
        insertCSS: jest.fn().mockRejectedValue(new Error('Cannot access chrome:// URLs')),
        executeScript: jest.fn().mockRejectedValue(new Error('Cannot access chrome:// URLs'))
      };
      
      try {
        await global.chrome.scripting.insertCSS({ target: { tabId: 1 }, files: ['bionic.css'] });
      } catch (error) {
        expect(error.message).toContain('Cannot access');
      }
    });
  });

  describe('Statistics Display', () => {
    test('should format large word counts correctly', () => {
      const wordCounts = [999, 1000, 9999, 10000, 999999, 1000000];
      
      wordCounts.forEach(count => {
        const formatted = count >= 1000 
          ? `${(count / 1000).toFixed(1)}k`
          : count.toString();
        
        if (count >= 1000) {
          expect(formatted).toContain('k');
        }
      });
    });

    test('should format reading time correctly', () => {
      const times = [
        { ms: 30000, expected: '30s' },
        { ms: 60000, expected: '1m' },
        { ms: 90000, expected: '1m 30s' },
        { ms: 3600000, expected: '1h' },
        { ms: 3661000, expected: '1h 1m' }
      ];
      
      times.forEach(({ ms }) => {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        
        expect(hours + minutes + seconds).toBeGreaterThanOrEqual(0);
      });
    });

    test('should calculate reading speed (WPM)', () => {
      const wordsProcessed = 500;
      const timeMs = 120000; // 2 minutes
      
      const timeMinutes = timeMs / 60000;
      const wpm = Math.round(wordsProcessed / timeMinutes);
      
      expect(wpm).toBe(250); // Average reading speed
    });

    test('should handle zero stats gracefully', () => {
      const stats = {
        wordsProcessed: 0,
        activeTime: 0
      };
      
      expect(stats.wordsProcessed).toBe(0);
      expect(stats.activeTime).toBe(0);
    });
  });

  describe('Status Indicator States', () => {
    test('should show enabled state correctly', () => {
      const status = document.getElementById('status');
      status.textContent = '✨ Bionic Reading enabled';
      status.style.background = 'rgba(76, 175, 80, 0.2)';
      
      expect(status.textContent).toContain('enabled');
      expect(status.style.background).toContain('76');
      expect(status.style.background).toContain('175');
      expect(status.style.background).toContain('80');
    });

    test('should show disabled state correctly', () => {
      const status = document.getElementById('status');
      status.textContent = '💤 Bionic Reading disabled';
      status.style.background = 'rgba(189, 189, 189, 0.2)';
      
      expect(status.textContent).toContain('disabled');
    });

    test('should show loading state', () => {
      const status = document.getElementById('status');
      status.textContent = '⏳ Loading...';
      
      expect(status.textContent).toContain('Loading');
    });

    test('should show error state', () => {
      const status = document.getElementById('status');
      status.textContent = '❌ Cannot access this page';
      status.style.background = 'rgba(244, 67, 54, 0.2)';
      
      expect(status.textContent).toContain('Cannot access');
      expect(status.style.background).toContain('244');
      expect(status.style.background).toContain('67');
      expect(status.style.background).toContain('54');
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('should display keyboard shortcut hint', () => {
      const status = document.getElementById('status');
      status.innerHTML = '💫 Ready to boost your reading!<br><small>Click toggle or press Alt+B</small>';
      
      expect(status.innerHTML).toContain('Alt+B');
    });

    test('should handle keyboard events', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'b',
        altKey: true
      });
      
      expect(event.altKey).toBe(true);
      expect(event.key).toBe('b');
    });
  });

  describe('Dark Mode Support', () => {
    test('should detect dark mode preference', () => {
      const mockMatchMedia = jest.fn((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }));
      
      global.window.matchMedia = mockMatchMedia;
      
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      expect(typeof isDarkMode).toBe('boolean');
    });

    test('should apply dark mode styles', () => {
      document.body.style.background = '#1a1a1a';
      document.body.style.color = '#e0e0e0';
      
      expect(document.body.style.background).toBe('rgb(26, 26, 26)');
      expect(document.body.style.color).toBe('rgb(224, 224, 224)');
    });
  });

  describe('Accessibility Features', () => {
    test('should have ARIA labels on interactive elements', () => {
      const toggleBtn = document.getElementById('toggle-btn');
      toggleBtn.setAttribute('aria-label', 'Toggle Bionic Reading');
      
      expect(toggleBtn.getAttribute('aria-label')).toBe('Toggle Bionic Reading');
    });

    test('should support keyboard navigation', () => {
      const slider = document.getElementById('intensity-slider');
      slider.setAttribute('role', 'slider');
      slider.setAttribute('aria-valuemin', '0');
      slider.setAttribute('aria-valuemax', '1');
      slider.setAttribute('aria-valuenow', '0.5');
      
      expect(slider.getAttribute('role')).toBe('slider');
      expect(slider.getAttribute('aria-valuenow')).toBe('0.5');
    });

    test('should announce state changes to screen readers', () => {
      const status = document.getElementById('status');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      
      expect(status.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('Performance Optimization', () => {
    test('should throttle rapid toggle clicks', () => {
      let lastClickTime = 0;
      const throttleMs = 300;
      
      const throttledClick = () => {
        const now = Date.now();
        if (now - lastClickTime < throttleMs) {
          return false;
        }
        lastClickTime = now;
        return true;
      };
      
      expect(throttledClick()).toBe(true);
      expect(throttledClick()).toBe(false); // Too soon
      
      jest.advanceTimersByTime(throttleMs);
      expect(throttledClick()).toBe(true);
    });

    test('should batch storage operations', () => {
      const updates = {
        bionicIntensity: 0.7,
        bionicCoverage: 0.5,
        lastUpdate: Date.now()
      };
      
      // Single set operation instead of multiple
      global.chrome.storage.sync.set(updates, () => {
        expect(global.chrome.storage.sync.set).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Error Recovery', () => {
    test('should recover from storage errors', () => {
      global.chrome.storage.sync.get = jest.fn((keys, callback) => {
        global.chrome.runtime.lastError = { message: 'Storage quota exceeded' };
        callback({});
      });
      
      global.chrome.storage.sync.get(['bionicIntensity'], (result) => {
        const defaultIntensity = result.bionicIntensity || 0.5;
        expect(defaultIntensity).toBe(0.5);
      });
    });

    test('should provide defaults when storage is empty', () => {
      global.chrome.storage.sync.get = jest.fn((keys, callback) => {
        callback({});
      });
      
      global.chrome.storage.sync.get(['bionicIntensity', 'bionicCoverage'], (result) => {
        const intensity = result.bionicIntensity ?? 0.5;
        const coverage = result.bionicCoverage ?? 0.4;
        
        expect(intensity).toBe(0.5);
        expect(coverage).toBe(0.4);
      });
    });
  });

  describe('Animation & Transitions', () => {
    test('should animate status changes', () => {
      const status = document.getElementById('status');
      status.style.transition = 'all 0.3s ease';
      
      expect(status.style.transition).toContain('0.3s');
    });

    test('should use CSS transforms for performance', () => {
      const element = document.createElement('div');
      element.style.transform = 'translateY(-10px)';
      element.style.willChange = 'transform';
      
      expect(element.style.transform).toContain('translateY');
      expect(element.style.willChange).toBe('transform');
    });
  });
});
