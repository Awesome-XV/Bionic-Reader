// Bionic Reader - Secure Background Service Worker
// Enterprise-grade security implementation

'use strict';

// Security constants
const SECURITY_CONFIG = {
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1MB limit
  RATE_LIMIT_REQUESTS: 100,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  ALLOWED_ORIGINS: ['https://*', 'http://localhost:*'],
  BLOCKED_DOMAINS: [
    'chrome-extension://',
    'moz-extension://',
    'edge-extension://',
    'chrome://',
    'edge://',
    'about:',
    'file://',
    'data:',
    'javascript:',
    'vbscript:'
  ]
};

// Rate limiting storage
const rateLimitMap = new Map();

// Security validator class
class SecurityValidator {
  static validateOrigin(origin) {
    if (!origin) return false;
    
    // Block dangerous protocols
    for (const blocked of SECURITY_CONFIG.BLOCKED_DOMAINS) {
      if (origin.toLowerCase().startsWith(blocked)) {
        console.warn(`[Security] Blocked dangerous origin: ${origin}`);
        return false;
      }
    }
    
    return true;
  }
  
  static validateMessage(message) {
    if (!message || typeof message !== 'object') {
      return { valid: false, error: 'Invalid message format' };
    }
    
    // Size validation
    const messageSize = JSON.stringify(message).length;
    if (messageSize > SECURITY_CONFIG.MAX_MESSAGE_SIZE) {
      return { valid: false, error: 'Message too large' };
    }
    
    // Action validation
    const allowedActions = ['toggle', 'getStatus', 'heartbeat', 'getStats', 'saveStats'];
    if (!message.action || !allowedActions.includes(message.action)) {
      return { valid: false, error: 'Invalid or missing action' };
    }
    
    // Sanitize action
    message.action = String(message.action).toLowerCase().trim();
    
    return { valid: true };
  }
  
  static checkRateLimit(tabId) {
    const now = Date.now();
    const key = `tab_${tabId}`;
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, windowStart: now });
      return true;
    }
    
    const limitData = rateLimitMap.get(key);
    
    // Reset window if expired
    if (now - limitData.windowStart > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
      limitData.count = 1;
      limitData.windowStart = now;
      return true;
    }
    
    // Check if within limits
    if (limitData.count >= SECURITY_CONFIG.RATE_LIMIT_REQUESTS) {
      console.warn(`[Security] Rate limit exceeded for tab ${tabId}`);
      return false;
    }
    
    limitData.count++;
    return true;
  }
  
  static sanitizeTabInfo(tab) {
    if (!tab || typeof tab !== 'object') return null;
    
    // Only return essential, safe properties
    return {
      id: tab.id,
      url: this.validateOrigin(tab.url) ? tab.url : null,
      title: String(tab.title || '').substring(0, 200), // Truncate title
      active: Boolean(tab.active)
    };
  }
}

// Secure message handler
function handleSecureMessage(message, sender, sendResponse) {
  try {
    // Validate sender
    if (!sender?.tab?.id) {
      console.warn('[Security] Invalid sender');
      sendResponse({ error: 'Invalid sender', code: 'INVALID_SENDER' });
      return false;
    }
    
    // Validate origin
    if (!SecurityValidator.validateOrigin(sender.tab.url)) {
      console.warn(`[Security] Blocked request from: ${sender.tab.url}`);
      sendResponse({ error: 'Origin not allowed', code: 'ORIGIN_BLOCKED' });
      return false;
    }
    
    // Rate limiting
    if (!SecurityValidator.checkRateLimit(sender.tab.id)) {
      sendResponse({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' });
      return false;
    }
    
    // Validate message
    const validation = SecurityValidator.validateMessage(message);
    if (!validation.valid) {
      console.warn(`[Security] Invalid message: ${validation.error}`);
      sendResponse({ error: validation.error, code: 'INVALID_MESSAGE' });
      return false;
    }
    
    // Process secure actions
    switch (message.action) {
      case 'heartbeat':
        sendResponse({ 
          success: true, 
          timestamp: Date.now(),
          version: chrome.runtime.getManifest().version
        });
        break;
        
      case 'getstatus':
      case 'toggle':
      case 'setintensity':
        // Forward to content script with validation
        chrome.tabs.sendMessage(
          sender.tab.id, 
          { 
            action: message.action,
            intensity: message.intensity,
            coverage: message.coverage,
            timestamp: Date.now(),
            source: 'background'
          },
          { frameId: 0 }, // Main frame only
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn('[Security] Content script communication failed:', chrome.runtime.lastError.message);
              sendResponse({ 
                error: 'Communication failed', 
                code: 'CONTENT_SCRIPT_ERROR' 
              });
            } else {
              // Sanitize response based on action type
              if (message.action === 'setintensity') {
                sendResponse({
                  success: true,
                  intensity: response?.intensity,
                  coverage: response?.coverage,
                  timestamp: Date.now()
                });
              } else {
                // Default sanitized response for toggle/getstatus
                const sanitizedResponse = {
                  success: true,
                  enabled: Boolean(response?.enabled),
                  timestamp: Date.now()
                };
                sendResponse(sanitizedResponse);
              }
            }
          }
        );
        return true; // Keep channel open for async response
        
      case 'getstats':
        // Forward stats request to content script
        chrome.tabs.sendMessage(
          sender.tab.id,
          { action: 'getstats' },
          { frameId: 0 },
          (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: 'Failed to get stats', code: 'STATS_ERROR' });
            } else {
              sendResponse(response || { sessionStats: { wordsProcessed: 0, activeTime: 0 } });
            }
          }
        );
        return true;
        
      case 'savestats':
        // Handle stats aggregation (daily/weekly)
        if (message.stats && typeof message.stats === 'object') {
          const today = new Date().toDateString();
          
          chrome.storage.local.get([today], (result) => {
            const existingStats = result[today] || { wordsProcessed: 0, activeTime: 0, sessions: 0 };
            
            const updatedStats = {
              wordsProcessed: existingStats.wordsProcessed + (message.stats.wordsProcessed || 0),
              activeTime: existingStats.activeTime + (message.stats.activeTime || 0),
              sessions: existingStats.sessions + 1,
              lastUpdate: Date.now()
            };
            
            chrome.storage.local.set({ [today]: updatedStats }, () => {
              if (chrome.runtime.lastError) {
                sendResponse({ error: 'Failed to save stats', code: 'STORAGE_ERROR' });
              } else {
                sendResponse({ success: true, stats: updatedStats });
              }
            });
          });
        } else {
          sendResponse({ error: 'Invalid stats data', code: 'INVALID_STATS' });
        }
        return true;
        
      default:
        sendResponse({ error: 'Unknown action', code: 'UNKNOWN_ACTION' });
    }
    
  } catch (error) {
    console.error('[Security] Message handler error:', error);
    sendResponse({ 
      error: 'Internal error', 
      code: 'INTERNAL_ERROR' 
    });
  }
  
  return false;
}

// Installation and update handlers
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Security] Extension installed/updated:', details.reason);
  
  // Clear any stored data on install for security
  if (details.reason === 'install') {
    chrome.storage.sync.clear(() => {
      console.log('[Security] Storage cleared on fresh install');
    });
  }
  
  // Set security headers
  chrome.storage.sync.set({
    securityVersion: '1.0.0',
    installTimestamp: Date.now()
  });
});

// Secure storage access
chrome.storage.onChanged.addListener((changes, namespace) => {
  // Log storage changes for audit trail
  console.log(`[Security] Storage changed in ${namespace}:`, Object.keys(changes));
  
  // Validate critical settings
  if (changes.bionicEnabled) {
    const newValue = changes.bionicEnabled.newValue;
    if (typeof newValue !== 'boolean') {
      console.warn('[Security] Invalid bionicEnabled value type');
      chrome.storage.sync.remove('bionicEnabled');
    }
  }
});

// Tab security monitoring
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Clear rate limits for completed page loads
    rateLimitMap.delete(`tab_${tabId}`);
    
    // Log navigation to secure/insecure contexts
    if (tab.url.startsWith('https://')) {
      console.log(`[Security] Secure context loaded: ${new URL(tab.url).hostname}`);
    } else if (tab.url.startsWith('http://')) {
      console.warn(`[Security] Insecure context loaded: ${new URL(tab.url).hostname}`);
    }
  }
});

// Clean up rate limiting data periodically
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitMap.entries()) {
    if (now - data.windowStart > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(key);
    }
  }
}, SECURITY_CONFIG.RATE_LIMIT_WINDOW);

// Export cleanup function for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports.clearRateLimitInterval = () => clearInterval(rateLimitCleanupInterval);
}

// Secure message listener
chrome.runtime.onMessage.addListener(handleSecureMessage);

// Handle external connections (none allowed)
chrome.runtime.onConnectExternal.addListener((port) => {
  console.warn('[Security] Blocked external connection attempt');
  port.disconnect();
});

// Security audit logging
chrome.runtime.onStartup.addListener(() => {
  console.log('[Security] Extension startup - security systems active');
  
  // Verify manifest permissions
  const manifest = chrome.runtime.getManifest();
  console.log('[Security] Active permissions:', manifest.permissions);
  console.log('[Security] Host permissions:', manifest.host_permissions);
});

console.log('[Security] Background service worker initialized with enterprise security');

// Handle keyboard commands from manifest
chrome.commands.onCommand.addListener((command) => {
  console.log('[Security] Command received:', command);
  if (command === 'toggle-bionic') {
    // Find active tab and forward toggle
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      const tabId = tabs[0].id;
      if (!SecurityValidator.validateOrigin(tabs[0].url)) {
        console.warn('[Security] Command origin blocked for tab:', tabs[0].url);
        return;
      }
      chrome.tabs.sendMessage(tabId, { action: 'toggle', source: 'command' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Security] Command forwarding failed:', chrome.runtime.lastError.message);
        } else {
          console.log('[Security] Toggle command forwarded, response:', response);
        }
      });
    });
  }
});

// Accept messages for updating per-tab intensity (optional)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === 'setIntensity') {
    const intensity = Number(message.intensity) || 0.5;
    const tabId = sender?.tab?.id;
    if (!tabId) {
      sendResponse({ error: 'No tab context' });
      return false;
    }
    // Forward intensity to content script in this tab
    chrome.tabs.sendMessage(tabId, { action: 'setIntensity', intensity }, (resp) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: 'Failed to set intensity' });
      } else {
        sendResponse({ success: true, intensity });
      }
    });
    return true; // async
  }
});