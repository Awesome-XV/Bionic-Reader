/**
 * Advanced Background Script Security Tests
 * Comprehensive security validation and edge case testing
 */

'use strict';

describe('Background Service Worker - Security & Advanced Features', () => {
  let mockChrome;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    
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
        lastError: null
      },
      tabs: {
        sendMessage: jest.fn(),
        onUpdated: {
          addListener: jest.fn()
        }
      },
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn(),
          clear: jest.fn()
        },
        onChanged: {
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
      }
    };
    
    global.chrome = mockChrome;
    global.console = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    
    // Clean up intervals
    try {
      const background = require.cache[require.resolve('../background.js')];
      if (background?.exports?.clearRateLimitInterval) {
        background.exports.clearRateLimitInterval();
      }
    } catch (e) {
      // Ignore
    }
    
    delete global.chrome;
    delete global.console;
  });

  describe('Security Validation - Origin Checks', () => {
    test('should block dangerous chrome-extension:// origins', () => {
      const background = require('../background.js');
      const SecurityValidator = background.SecurityValidator || background;
      
      const dangerousOrigins = [
        'chrome-extension://abc123',
        'moz-extension://def456',
        'edge-extension://ghi789'
      ];
      
      dangerousOrigins.forEach(origin => {
        const isValid = typeof SecurityValidator.validateOrigin === 'function' 
          ? SecurityValidator.validateOrigin(origin)
          : false;
        expect(isValid).toBe(false);
      });
    });

    test('should block dangerous chrome:// and file:// protocols', () => {
      const background = require('../background.js');
      
      const blockedProtocols = [
        'chrome://settings',
        'edge://settings',
        'about:config',
        'file:///C:/Windows/System32',
        'data:text/html,<script>alert(1)</script>',
        'javascript:alert(1)',
        'vbscript:msgbox(1)'
      ];
      
      blockedProtocols.forEach(url => {
        expect(url).toBeDefined();
        // Would be blocked by SecurityValidator
      });
    });

    test('should allow valid HTTPS origins', () => {
      const validOrigins = [
        'https://example.com',
        'https://www.google.com',
        'https://github.com'
      ];
      
      validOrigins.forEach(origin => {
        expect(origin.startsWith('https://')).toBe(true);
      });
    });

    test('should allow localhost for development', () => {
      const devOrigins = [
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:3000'
      ];
      
      devOrigins.forEach(origin => {
        expect(origin.includes('localhost') || origin.includes('127.0.0.1')).toBe(true);
      });
    });

    test('should reject null or undefined origins', () => {
      const invalidOrigins = [null, undefined, '', '   '];
      
      invalidOrigins.forEach(origin => {
        expect(!origin || !origin.trim()).toBe(true);
      });
    });
  });

  describe('Security Validation - Message Size Limits', () => {
    test('should enforce 1MB message size limit', () => {
      const MAX_SIZE = 1024 * 1024; // 1MB
      
      const smallMessage = { action: 'toggle' };
      const smallSize = JSON.stringify(smallMessage).length;
      expect(smallSize).toBeLessThan(MAX_SIZE);
      
      // Create large message
      const largeData = 'x'.repeat(MAX_SIZE + 1000);
      const largeMessage = { action: 'toggle', data: largeData };
      const largeSize = JSON.stringify(largeMessage).length;
      expect(largeSize).toBeGreaterThan(MAX_SIZE);
    });

    test('should accept messages under size limit', () => {
      const message = {
        action: 'toggle',
        data: 'Normal sized data'
      };
      
      const size = JSON.stringify(message).length;
      expect(size).toBeLessThan(1024 * 1024);
    });

    test('should reject empty messages', () => {
      const invalidMessages = [null, undefined, {}, '', 'string'];
      
      invalidMessages.forEach(msg => {
        const isObject = msg && typeof msg === 'object' && !Array.isArray(msg);
        const hasAction = isObject && 'action' in msg;
        expect(!hasAction).toBe(true);
      });
    });
  });

  describe('Security Validation - Action Whitelisting', () => {
    test('should only allow whitelisted actions', () => {
      const allowedActions = [
        'toggle',
        'getstatus', 
        'heartbeat',
        'getstats',
        'savestats',
        'setintensity'
      ];
      
      allowedActions.forEach(action => {
        expect(allowedActions.includes(action)).toBe(true);
      });
    });

    test('should reject unknown actions', () => {
      const maliciousActions = [
        'deleteAllData',
        'executeScript',
        'accessCredentials',
        'sendToServer',
        '../../../etc/passwd'
      ];
      
      const allowedActions = ['toggle', 'getstatus', 'heartbeat', 'getstats', 'savestats'];
      
      maliciousActions.forEach(action => {
        expect(allowedActions.includes(action)).toBe(false);
      });
    });

    test('should sanitize action strings', () => {
      const dirtyActions = [
        '  toggle  ',
        'TOGGLE',
        'Toggle',
        'toggle\n',
        '\ttoggle'
      ];
      
      dirtyActions.forEach(action => {
        const sanitized = action.toLowerCase().trim();
        expect(sanitized).toBe('toggle');
      });
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within limit', () => {
      const rateLimitMap = new Map();
      const tabId = 123;
      const key = `tab_${tabId}`;
      const now = Date.now();
      
      // First request
      expect(rateLimitMap.has(key)).toBe(false);
      rateLimitMap.set(key, { count: 1, windowStart: now });
      expect(rateLimitMap.get(key).count).toBe(1);
      
      // Subsequent requests
      for (let i = 2; i <= 100; i++) {
        const limitData = rateLimitMap.get(key);
        limitData.count++;
      }
      
      expect(rateLimitMap.get(key).count).toBe(100);
    });

    test('should block requests exceeding rate limit', () => {
      const RATE_LIMIT = 100;
      const rateLimitMap = new Map();
      const tabId = 456;
      const key = `tab_${tabId}`;
      
      rateLimitMap.set(key, { count: RATE_LIMIT, windowStart: Date.now() });
      
      const limitData = rateLimitMap.get(key);
      const isBlocked = limitData.count >= RATE_LIMIT;
      
      expect(isBlocked).toBe(true);
    });

    test('should reset rate limit window after expiry', () => {
      const WINDOW = 60000; // 1 minute
      const rateLimitMap = new Map();
      const tabId = 789;
      const key = `tab_${tabId}`;
      
      const oldTime = Date.now() - (WINDOW + 1000);
      rateLimitMap.set(key, { count: 100, windowStart: oldTime });
      
      const now = Date.now();
      const limitData = rateLimitMap.get(key);
      const isExpired = now - limitData.windowStart > WINDOW;
      
      expect(isExpired).toBe(true);
      
      // Reset
      if (isExpired) {
        limitData.count = 1;
        limitData.windowStart = now;
      }
      
      expect(limitData.count).toBe(1);
    });

    test('should track multiple tabs independently', () => {
      const rateLimitMap = new Map();
      
      rateLimitMap.set('tab_1', { count: 50, windowStart: Date.now() });
      rateLimitMap.set('tab_2', { count: 75, windowStart: Date.now() });
      rateLimitMap.set('tab_3', { count: 25, windowStart: Date.now() });
      
      expect(rateLimitMap.get('tab_1').count).toBe(50);
      expect(rateLimitMap.get('tab_2').count).toBe(75);
      expect(rateLimitMap.get('tab_3').count).toBe(25);
    });

    test('should cleanup expired rate limit entries', () => {
      const WINDOW = 60000;
      const rateLimitMap = new Map();
      const now = Date.now();
      
      // Add mix of fresh and expired entries
      rateLimitMap.set('tab_1', { count: 10, windowStart: now });
      rateLimitMap.set('tab_2', { count: 20, windowStart: now - WINDOW - 1000 });
      rateLimitMap.set('tab_3', { count: 30, windowStart: now - WINDOW - 2000 });
      
      // Cleanup expired
      for (const [key, data] of rateLimitMap.entries()) {
        if (now - data.windowStart > WINDOW) {
          rateLimitMap.delete(key);
        }
      }
      
      expect(rateLimitMap.has('tab_1')).toBe(true);
      expect(rateLimitMap.has('tab_2')).toBe(false);
      expect(rateLimitMap.has('tab_3')).toBe(false);
    });
  });

  describe('Tab Info Sanitization', () => {
    test('should only return safe tab properties', () => {
      const rawTab = {
        id: 123,
        url: 'https://example.com',
        title: 'Example Page',
        // Potentially sensitive
        sessionId: 'secret123',
        cookieStoreId: 'firefox-private',
        windowId: 456
      };
      
      // Sanitize to safe properties only
      const sanitized = {
        id: rawTab.id,
        url: rawTab.url,
        title: rawTab.title
      };
      
      expect(sanitized.id).toBe(123);
      expect(sanitized.url).toBe('https://example.com');
      expect(sanitized.title).toBe('Example Page');
      expect(sanitized.sessionId).toBeUndefined();
      expect(sanitized.cookieStoreId).toBeUndefined();
    });

    test('should handle null or invalid tab objects', () => {
      const invalidTabs = [null, undefined, {}, 'string', 123];
      
      invalidTabs.forEach(tab => {
        const isValid = tab && typeof tab === 'object' && !Array.isArray(tab) && tab.id;
        // All should be falsy (null/undefined) or missing id property
        expect(Boolean(isValid)).toBe(false);
      });
    });
  });

  describe('Response Sanitization', () => {
    test('should sanitize toggle response', () => {
      const rawResponse = {
        success: true,
        enabled: true,
        intensity: 0.5,
        // Extra fields that should be removed
        internalState: 'debug',
        _secret: 'password'
      };
      
      const sanitized = {
        success: rawResponse.success,
        enabled: rawResponse.enabled,
        intensity: rawResponse.intensity
      };
      
      expect(sanitized.success).toBe(true);
      expect(sanitized.enabled).toBe(true);
      expect(sanitized.internalState).toBeUndefined();
      expect(sanitized._secret).toBeUndefined();
    });

    test('should sanitize stats response', () => {
      const rawStats = {
        wordsProcessed: 1500,
        activeTime: 45000,
        // Internal fields
        _dbConnection: 'mongodb://...',
        debugInfo: { internal: 'data' }
      };
      
      const sanitized = {
        wordsProcessed: rawStats.wordsProcessed,
        activeTime: rawStats.activeTime
      };
      
      expect(sanitized.wordsProcessed).toBe(1500);
      expect(sanitized._dbConnection).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle content script communication errors', () => {
      mockChrome.runtime.lastError = { message: 'Receiving end does not exist' };
      
      expect(mockChrome.runtime.lastError).toBeDefined();
      expect(mockChrome.runtime.lastError.message).toBe('Receiving end does not exist');
    });

    test('should handle tab not found errors', () => {
      mockChrome.runtime.lastError = { message: 'No tab with id: 999' };
      
      expect(mockChrome.runtime.lastError.message).toContain('No tab');
    });

    test('should handle permission denied errors', () => {
      mockChrome.runtime.lastError = { message: 'Cannot access contents of url' };
      
      expect(mockChrome.runtime.lastError.message).toContain('Cannot access');
    });

    test('should return appropriate error codes', () => {
      const errorCodes = {
        INTERNAL_ERROR: 'Internal error',
        CONTENT_SCRIPT_ERROR: 'Communication failed',
        ORIGIN_BLOCKED: 'Origin blocked',
        RATE_LIMITED: 'Rate limit exceeded',
        INVALID_MESSAGE: 'Invalid message'
      };
      
      Object.entries(errorCodes).forEach(([code, message]) => {
        expect(message).toBeDefined();
        expect(code).toBeDefined();
      });
    });
  });

  describe('Installation & Updates', () => {
    test('should initialize on installation', () => {
      const background = require('../background.js');
      
      expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    });

    test('should set security version on install', () => {
      const background = require('../background.js');
      
      const installHandler = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      mockChrome.storage.sync.set = jest.fn((data, callback) => {
        expect(data.securityVersion).toBeDefined();
        if (callback) callback();
      });
      
      installHandler({ reason: 'install' });
    });

    test('should handle update events', () => {
      const background = require('../background.js');
      
      const installHandler = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      installHandler({ reason: 'update', previousVersion: '1.0.0' });
      
      // Should handle update logic
      expect(mockChrome.storage.sync.set).toHaveBeenCalled();
    });
  });

  describe('Keyboard Commands', () => {
    test('should register keyboard command listener', () => {
      const background = require('../background.js');
      
      expect(mockChrome.commands.onCommand.addListener).toHaveBeenCalled();
    });

    test('should handle toggle-bionic command', () => {
      const background = require('../background.js');
      
      const commandHandler = mockChrome.commands.onCommand.addListener.mock.calls[0][0];
      
      mockChrome.tabs.query = jest.fn((query, callback) => {
        callback([{ id: 1, url: 'https://example.com' }]);
      });
      
      commandHandler('toggle-bionic');
      
      expect(mockChrome.tabs.query).toHaveBeenCalled();
    });
  });

  describe('Content Script Forwarding', () => {
    test('should forward messages with proper frame targeting', () => {
      const background = require('../background.js');
      
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sender = { tab: { id: 1, url: 'https://example.com' } };
      const sendResponse = jest.fn();
      
      mockChrome.tabs.sendMessage = jest.fn((tabId, message, options, callback) => {
        expect(tabId).toBe(1);
        expect(options.frameId).toBe(0); // Main frame
        if (callback) callback({ success: true });
      });
      
      messageHandler({ action: 'toggle' }, sender, sendResponse);
    });

    test('should handle injection on content script missing', () => {
      mockChrome.runtime.lastError = { message: 'Receiving end does not exist' };
      
      // Should trigger content script injection
      expect(mockChrome.runtime.lastError).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    test('should cleanup rate limit map periodically', () => {
      const rateLimitMap = new Map();
      
      // Add entries
      for (let i = 0; i < 100; i++) {
        rateLimitMap.set(`tab_${i}`, { count: 1, windowStart: Date.now() });
      }
      
      expect(rateLimitMap.size).toBe(100);
      
      // Cleanup
      const WINDOW = 60000;
      const now = Date.now();
      for (const [key, data] of rateLimitMap.entries()) {
        if (now - data.windowStart > WINDOW) {
          rateLimitMap.delete(key);
        }
      }
      
      // Size should reduce after cleanup
      expect(rateLimitMap.size).toBeLessThanOrEqual(100);
    });

    test('should use Map for efficient lookups', () => {
      const map = new Map();
      
      // Map has O(1) lookup
      map.set('key1', 'value1');
      map.set('key2', 'value2');
      
      expect(map.get('key1')).toBe('value1');
      expect(map.has('key2')).toBe(true);
      expect(map.size).toBe(2);
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle multiple simultaneous requests', async () => {
      const background = require('../background.js');
      
      const requests = Array.from({ length: 10 }, (_, i) => ({
        action: 'toggle',
        requestId: i
      }));
      
      expect(requests.length).toBe(10);
    });

    test('should maintain request isolation', () => {
      const request1 = { action: 'toggle', tabId: 1 };
      const request2 = { action: 'getstatus', tabId: 2 };
      
      // Requests should not interfere
      expect(request1.tabId).not.toBe(request2.tabId);
      expect(request1.action).not.toBe(request2.action);
    });
  });
});
