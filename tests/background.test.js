/**
 * Background Service Worker Tests
 * Tests the secure background service worker that handles extension messaging
 */

describe('Background Service Worker', () => {
  let mockChrome;
  let background;

  beforeEach(() => {
    // Clear any previous modules
    jest.resetModules();
    
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
      storage: {
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
      success: false, 
      error: 'Invalid message format' 
    });
  });

  test('handles setIntensity action correctly', (done) => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    // Mock successful tab message
    mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      expect(tabId).toBe(1);
      expect(message.action).toBe('setIntensity');
      expect(message.intensity).toBe(0.7);
      if (callback) callback({ success: true });
    });

    const validMessage = {
      action: 'setIntensity',
      intensity: 0.7,
      coverage: 0.5
    };
    const sender = { tab: { id: 1 } };
    const sendResponse = jest.fn((response) => {
      expect(response.success).toBe(true);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
      done();
    });
    
    messageHandler(validMessage, sender, sendResponse);
  });

  test('handles toggle action correctly', (done) => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      expect(message.action).toBe('toggle');
      if (callback) callback({ success: true, enabled: true });
    });

    const toggleMessage = {
      action: 'toggle'
    };
    const sender = { tab: { id: 1 } };
    const sendResponse = jest.fn((response) => {
      expect(response.success).toBe(true);
      done();
    });
    
    messageHandler(toggleMessage, sender, sendResponse);
  });

  test('handles getStats action correctly', (done) => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      expect(message.action).toBe('getStats');
      if (callback) callback({ 
        success: true, 
        stats: { wordsProcessed: 100, timeSpent: 5000 } 
      });
    });

    const statsMessage = {
      action: 'getStats'
    };
    const sender = { tab: { id: 1 } };
    const sendResponse = jest.fn((response) => {
      expect(response.success).toBe(true);
      expect(response.stats).toBeDefined();
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
      success: false,
      error: 'Rate limit exceeded. Please try again later.'
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
      success: false,
      error: 'Access denied for this origin'
    });
  });

  test('handles chrome.tabs.sendMessage errors gracefully', (done) => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    // Mock chrome.runtime.lastError
    mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      mockChrome.runtime.lastError = { message: 'Tab not found' };
      if (callback) callback();
    });

    const validMessage = { action: 'toggle' };
    const sender = { tab: { id: 999 } }; // Non-existent tab
    const sendResponse = jest.fn((response) => {
      expect(response.success).toBe(false);
      expect(response.error).toContain('Failed to communicate');
      done();
    });
    
    messageHandler(validMessage, sender, sendResponse);
  });

  test('handles installation event correctly', () => {
    const background = require('../background.js');
    
    const installHandler = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
    
    installHandler({ reason: 'install' });
    
    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ 
      color: '#4CAF50' 
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
      success: false,
      error: 'Message too large'
    });
  });

  test('handles saveStats action correctly', (done) => {
    const background = require('../background.js');
    
    const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    mockChrome.storage.local.set.mockImplementation((data, callback) => {
      expect(data).toHaveProperty('2025-09-09');
      if (callback) callback();
    });

    const statsMessage = {
      action: 'saveStats',
      date: '2025-09-09',
      stats: { wordsProcessed: 100, timeSpent: 5000, sessions: 1 }
    };
    const sender = { tab: { id: 1 } };
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
      success: false,
      error: 'Unknown action: unknownAction'
    });
  });
});
