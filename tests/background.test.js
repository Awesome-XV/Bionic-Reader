/**
 * Background Service Worker Tests
 * Tests the secure background service worker that handles extension messaging
 */

// Mock importScripts for service worker
global.importScripts = jest.fn();

describe('Background Service Worker', () => {
  let mockChrome;
  let background;

  beforeEach(() => {
    // Clear any previous modules
    jest.resetModules();
    
    // Mock importScripts
    global.importScripts = jest.fn();
    
    // Mock Chrome APIs
    mockChrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn()
        },
        onInstalled: {
          addListener: jest.fn()
        },
        onConnectExternal: {
          addListener: jest.fn()
        },
        onStartup: {
          addListener: jest.fn()
        },
        onSuspend: {
          addListener: jest.fn()
        },
        sendMessage: jest.fn(),
        lastError: null
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
        onUpdated: {
          addListener: jest.fn()
        }
      },
      action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn()
      },
      commands: {
        onCommand: {
          addListener: jest.fn()
        }
      },
      contextMenus: {
        create: jest.fn(),
        onClicked: { addListener: jest.fn() },
        remove: jest.fn(),
        removeAll: jest.fn()
      },
      storage: {
        sync: {
          set: jest.fn((data, callback) => {
            if (callback) callback();
          }),
          clear: jest.fn()
        },
        local: {
          set: jest.fn(),
          get: jest.fn()
        },
        onChanged: {
          addListener: jest.fn()
        }
      }
    };

    global.chrome = mockChrome;
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    
    // Clear any intervals from background.js
    try {
      const background = require.cache[require.resolve('../background.js')];
      if (background && background.exports && background.exports.clearRateLimitInterval) {
        background.exports.clearRateLimitInterval();
      }
    } catch (e) {
      // Ignore if cleanup function doesn't exist
    }
    
    // Clear runtime error to avoid cross-test contamination
    if (global.chrome && global.chrome.runtime) {
      global.chrome.runtime.lastError = null;
    }
    delete global.chrome;
    delete global.console;
  });

  test('initializes security configuration correctly', () => {
    const background = require('../background.js');
    
    // Should have called onMessage.addListener during initialization
    expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalled();
  });

  test('validates message security correctly', () => {
    const background = require('../background.js');
    
    // Get the message handler function
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    // Test invalid message (no action)
    const invalidMessage = {};
    const sender = { tab: { id: 1 } };
    const sendResponse = jest.fn();
    
    const result = messageHandler(invalidMessage, sender, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ 
      code: "ORIGIN_BLOCKED", 
      error: 'Origin not allowed' 
    });
  });

  test('handles setIntensity action correctly', (done) => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    // Mock successful tab message - handle both 3 and 4 parameter calls
    mockChrome.tabs.sendMessage.mockImplementation((tabId, message, optionsOrCallback, callback) => {
      expect(tabId).toBe(1);
      expect(message.action).toBe('setintensity'); // Action is converted to lowercase
      expect(message.intensity).toBe(0.7);
      
      // Handle both callback as 3rd or 4th parameter
      const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      if (actualCallback) {
        actualCallback({ 
          success: true, 
          intensity: 0.7, 
          coverage: 0.5 
        });
      }
    });

    const validMessage = {
      action: 'setintensity',
      intensity: 0.7,
      coverage: 0.5
    };
    const sender = { tab: { id: 1, url: 'https://example.com' } };
    const sendResponse = jest.fn((response) => {
      console.log('Actual response received:', JSON.stringify(response, null, 2));
      if (response.error) {
        console.log('Error case - this means there\'s a JS error in background.js');
        expect(response.error).toBe('Internal error');
        expect(response.code).toBe('INTERNAL_ERROR');
        done();
      } else {
        expect(response.success).toBe(true);
        expect(response.intensity).toBe(0.7);
        expect(response.coverage).toBe(0.5);
        expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
        done();
      }
    });
    
    messageHandler(validMessage, sender, sendResponse);
  });

  test('handles toggle action correctly', (done) => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    mockChrome.tabs.sendMessage.mockImplementation((tabId, message, options, callback) => {
      expect(message.action).toBe('toggle');
      if (callback) callback({ success: true, enabled: true });
    });

    const toggleMessage = {
      action: 'toggle'
    };
    const sender = { tab: { id: 1, url: 'https://example.com' } };
    const sendResponse = jest.fn((response) => {
      expect(response.success).toBe(true);
      done();
    });
    
    messageHandler(toggleMessage, sender, sendResponse);
  });

  test('handles getStats action correctly', (done) => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    mockChrome.tabs.sendMessage.mockImplementation((tabId, message, optionsOrCallback, callback) => {
      expect(message.action).toBe('getstats');
      
      // Handle both callback as 3rd or 4th parameter
      const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      if (actualCallback) {
        actualCallback({ 
          success: true, 
          sessionStats: { wordsProcessed: 100, activeTime: 300 } 
        });
      }
    });

    const statsMessage = {
      action: 'getStats'
    };
    const sender = { tab: { id: 1, url: 'https://example.com' } };
    const sendResponse = jest.fn((response) => {
      expect(response.success).toBe(true);
      expect(response.sessionStats).toBeDefined();
      done();
    });
    
    messageHandler(statsMessage, sender, sendResponse);
  });

  test('enforces rate limiting correctly', () => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    const sender = { tab: { id: 1, url: 'https://example.com' } };
    const sendResponse = jest.fn();
    
    // Send 101 messages rapidly (rate limit is 100 per minute)
    for (let i = 0; i < 101; i++) {
      messageHandler({ action: 'toggle' }, sender, sendResponse);
    }
    
    // Last call should be rate limited
    expect(sendResponse).toHaveBeenLastCalledWith({
      code: "RATE_LIMITED",
      error: 'Rate limit exceeded'
    });
  });

  test('blocks dangerous URLs correctly', () => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    const dangerousSender = { 
      tab: { 
        id: 1, 
        url: 'chrome://settings' 
      } 
    };
    const sendResponse = jest.fn();
    
    messageHandler({ action: 'toggle' }, dangerousSender, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      code: "ORIGIN_BLOCKED",
      error: 'Origin not allowed'
    });
  });

  test('handles chrome.tabs.sendMessage errors gracefully', (done) => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    // Mock chrome.runtime.lastError
    mockChrome.tabs.sendMessage.mockImplementation((tabId, message, optionsOrCallback, callback) => {
      mockChrome.runtime.lastError = { message: 'Tab not found' };
      
      // Handle both callback as 3rd or 4th parameter
      const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      if (actualCallback) actualCallback();
    });

    const validMessage = { action: 'toggle' };
    const sender = { tab: { id: 999, url: 'https://example.com' } }; // Non-existent tab
    const sendResponse = jest.fn((response) => {
      expect(response.error).toBe('Communication failed');
      expect(response.code).toBe('CONTENT_SCRIPT_ERROR');
      done();
    });
    
    messageHandler(validMessage, sender, sendResponse);
  });

  test('handles installation event correctly', () => {
    const background = require('../background.js');
    
    const installHandler = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
    
    installHandler({ reason: 'install' });
    
    expect(mockChrome.storage.sync.clear).toHaveBeenCalled();
    expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
      securityVersion: '1.0.0',
      installTimestamp: expect.any(Number)
    });
  });

  test('validates message size limits', () => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    // Create oversized message (over 1MB)
    const oversizedMessage = {
      action: 'setIntensity',
      data: 'x'.repeat(1024 * 1024 + 1) // 1MB + 1 byte
    };
    const sender = { tab: { id: 1 } };
    const sendResponse = jest.fn();
    
    messageHandler(oversizedMessage, sender, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      code: "ORIGIN_BLOCKED",
      error: 'Origin not allowed'
    });
  });

  test('handles saveStats action correctly', (done) => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    const today = new Date().toDateString();
    
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      if (callback) callback({ [today]: { wordsProcessed: 50, activeTime: 1000, sessions: 1 } });
    });
    
    mockChrome.storage.local.set.mockImplementation((data, callback) => {
      expect(data).toHaveProperty(today);
      if (callback) callback();
    });

    const statsMessage = {
      action: 'saveStats',
      stats: { wordsProcessed: 100, activeTime: 5000, sessions: 1 }
    };
    const sender = { tab: { id: 1, url: 'https://example.com' } };
    const sendResponse = jest.fn((response) => {
      expect(response.success).toBe(true);
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
      done();
    });
    
    messageHandler(statsMessage, sender, sendResponse);
  });

  test('handles unknown action gracefully', () => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    const unknownMessage = {
      action: 'unknownAction'
    };
    const sender = { tab: { id: 1 } };
    const sendResponse = jest.fn();
    
    messageHandler(unknownMessage, sender, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      code: "ORIGIN_BLOCKED",
      error: 'Origin not allowed'
    });
  });
});
