/**
 * Bionic Reader Background Service Worker
 * 
 * Handles secure message passing, rate limiting, origin validation,
 * per-site settings management, and context menu actions.
 * 
 * @version 1.1.0
 * @license MIT
 */

'use strict';

// Debug mode configuration (set to false for production)
const DEBUG_MODE = false;

// Import modules
importScripts('src/site-settings.js');
importScripts('src/logger.js');

// Error codes centralization (Issue #10)
const ERROR_CODES = {
  INVALID_SENDER: 'INVALID_SENDER',
  ORIGIN_BLOCKED: 'ORIGIN_BLOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  MESSAGE_TOO_LARGE: 'MESSAGE_TOO_LARGE',
  CONTENT_SCRIPT_ERROR: 'CONTENT_SCRIPT_ERROR',
  STATS_ERROR: 'STATS_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  INVALID_STATS: 'INVALID_STATS',
  UNKNOWN_ACTION: 'UNKNOWN_ACTION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NO_TAB: 'NO_TAB',
  INVALID_PARAM: 'INVALID_PARAM',
  SITE_SETTINGS_ERROR: 'SITE_SETTINGS_ERROR'
};

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

/**
 * @typedef {Object} BionicMessage
 * @property {string} action - Action to perform (toggle, setintensity, getstats, etc.)
 * @property {number} [intensity] - Intensity value (0.0-1.0) for setintensity action
 * @property {number} [coverage] - Coverage value (0.0-1.0) for setintensity action
 * @property {boolean} [statsEnabled] - Stats enabled flag for setstatsenabled action
 */

/**
 * @typedef {Object} MessageResponse
 * @property {boolean} [success] - Whether the operation was successful
 * @property {string} [error] - Error message if operation failed
 * @property {string} [code] - Error code from ERROR_CODES
 * @property {boolean} [enabled] - Current enabled state
 * @property {number} [intensity] - Current intensity value
 * @property {number} [coverage] - Current coverage value
 * @property {Object} [sessionStats] - Session statistics
 * @property {boolean} [statsEnabled] - Whether stats tracking is enabled
 * @property {number} [processedNodes] - Number of nodes processed
 */

// Rate limiting storage
const rateLimitMap = new Map();

/**
 * Security validator class providing origin, rate limit, and message validation.
 */
class SecurityValidator {
  /**
   * Validates if an origin is allowed for content script injection.
   * 
   * @param {string} origin - URL origin to validate
   * @returns {boolean} True if origin is safe
   */
  static validateOrigin(origin) {
    if (!origin) return false;
    
    // Block dangerous protocols
    for (const blocked of SECURITY_CONFIG.BLOCKED_DOMAINS) {
      if (origin.toLowerCase().startsWith(blocked)) {
        logger.warn(`[Security] Blocked dangerous origin: ${origin}`);
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
    const ALLOWED_ACTIONS = new Set([
      'toggle', 'getstatus', 'heartbeat', 'getstats', 'savestats',
      'setintensity', 'getsitesettings', 'setsitesettings',
      'clearsitesettings', 'hascustomsettings', 'updateadvancedsettings'
    ]);
    
    // Normalize action before validation
    message.action = String(message.action).toLowerCase().trim();
    
    if (!message.action || !ALLOWED_ACTIONS.has(message.action)) {
      return { valid: false, error: 'Invalid or missing action' };
    }
    
    return { valid: true };
  }
  
  /**
   * Checks if a tab has exceeded the rate limit.
   * 
   * @param {number} tabId - Tab ID to check rate limit for
   * @returns {boolean} True if within rate limit
   */
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
      logger.warn(`[Security] Rate limit exceeded for tab ${tabId}`);
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
      logger.warn('[Security] Invalid sender');
      sendResponse({ error: 'Invalid sender', code: ERROR_CODES.INVALID_SENDER });
      return false;
    }
    
    // Validate origin
    if (!SecurityValidator.validateOrigin(sender.tab.url)) {
      logger.warn(`[Security] Blocked request from: ${sender.tab.url}`);
      sendResponse({ error: 'Origin not allowed', code: ERROR_CODES.ORIGIN_BLOCKED });
      return false;
    }
    
    // Rate limiting
    if (!SecurityValidator.checkRateLimit(sender.tab.id)) {
      sendResponse({ error: 'Rate limit exceeded', code: ERROR_CODES.RATE_LIMITED });
      return false;
    }
    
    // Validate message
    const validation = SecurityValidator.validateMessage(message);
    if (!validation.valid) {
      logger.warn(`[Security] Invalid message: ${validation.error}`);
      sendResponse({ error: validation.error, code: ERROR_CODES.INVALID_MESSAGE });
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
              logger.warn('[Security] Content script communication failed:', chrome.runtime.lastError.message);
              sendResponse({ 
                error: 'Communication failed', 
                code: ERROR_CODES.CONTENT_SCRIPT_ERROR 
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
              sendResponse({ error: 'Failed to get stats', code: ERROR_CODES.STATS_ERROR });
            } else {
              sendResponse(response || { sessionStats: { wordsProcessed: 0, activeTime: 0 } });
            }
          }
        );
        return true;
        
      case 'getsitesettings':
        // Get effective settings for current site
        (async () => {
          try {
            const url = sender.tab.url;
            const settings = await SiteSettingsManager.getEffectiveSettings(url);
            sendResponse({ success: true, settings });
          } catch (error) {
            logger.error('[SiteSettings] Error getting site settings:', error);
            sendResponse({ error: 'Failed to get site settings', code: ERROR_CODES.SITE_SETTINGS_ERROR });
          }
        })();
        return true;
        
      case 'setsitesettings':
        // Set site-specific settings
        (async () => {
          try {
            const url = sender.tab.url;
            const { enabled, intensity, coverage } = message;
            
            const settingsToSave = {};
            if (enabled !== undefined) settingsToSave.enabled = Boolean(enabled);
            if (intensity !== undefined && !isNaN(intensity)) {
              settingsToSave.intensity = Math.max(0, Math.min(1, Number(intensity)));
            }
            if (coverage !== undefined && !isNaN(coverage)) {
              settingsToSave.coverage = Math.max(0, Math.min(1, Number(coverage)));
            }
            
            const success = await SiteSettingsManager.setSiteSettings(url, settingsToSave);
            
            if (success) {
              sendResponse({ success: true, settings: settingsToSave });
            } else {
              sendResponse({ error: 'Failed to save site settings', code: ERROR_CODES.SITE_SETTINGS_ERROR });
            }
          } catch (error) {
            logger.error('[SiteSettings] Error setting site settings:', error);
            sendResponse({ error: 'Failed to save site settings', code: ERROR_CODES.SITE_SETTINGS_ERROR });
          }
        })();
        return true;
        
      case 'clearsitesettings':
        // Clear site-specific settings (revert to global)
        (async () => {
          try {
            const url = sender.tab.url;
            const success = await SiteSettingsManager.clearSiteSettings(url);
            sendResponse({ success });
          } catch (error) {
            logger.error('[SiteSettings] Error clearing site settings:', error);
            sendResponse({ error: 'Failed to clear site settings', code: ERROR_CODES.SITE_SETTINGS_ERROR });
          }
        })();
        return true;
        
      case 'hascustomsettings':
        // Check if site has custom settings
        (async () => {
          try {
            const url = sender.tab.url;
            const hasCustom = await SiteSettingsManager.hasCustomSettings(url);
            sendResponse({ success: true, hasCustomSettings: hasCustom });
          } catch (error) {
            logger.error('[SiteSettings] Error checking custom settings:', error);
            sendResponse({ error: 'Failed to check settings', code: ERROR_CODES.SITE_SETTINGS_ERROR });
          }
        })();
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
                sendResponse({ error: 'Failed to save stats', code: ERROR_CODES.STORAGE_ERROR });
              } else {
                sendResponse({ success: true, stats: updatedStats });
              }
            });
          });
        } else {
          sendResponse({ error: 'Invalid stats data', code: ERROR_CODES.INVALID_STATS });
        }
        return true;
        
      default:
        sendResponse({ error: 'Unknown action', code: ERROR_CODES.UNKNOWN_ACTION });
    }
    
  } catch (error) {
    logger.error('[Security] Message handler error:', error);
    sendResponse({ 
      error: 'Internal error', 
      code: ERROR_CODES.INTERNAL_ERROR 
    });
  }
  
  return false;
}

// Installation and update handlers
chrome.runtime.onInstalled.addListener((details) => {
  logger.debug('[Security] Extension installed/updated:', details.reason);
  
  // Clear any stored data on install for security
  if (details.reason === 'install') {
    chrome.storage.sync.clear(() => {
      logger.debug('[Security] Storage cleared on fresh install');
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
  logger.debug(`[Security] Storage changed in ${namespace}:`, Object.keys(changes));
  
  // Validate critical settings
  if (changes.bionicEnabled) {
    const newValue = changes.bionicEnabled.newValue;
    if (typeof newValue !== 'boolean') {
      logger.warn('[Security] Invalid bionicEnabled value type');
      chrome.storage.sync.remove('bionicEnabled');
    }
  }
});

// Tab security monitoring
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    rateLimitMap.delete(`tab_${tabId}`);
  }
});

// Clean up rate limiting data periodically
let rateLimitCleanupInterval = null;

function startRateLimitCleanup() {
  if (rateLimitCleanupInterval) return; // Already running
  
  rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitMap.entries()) {
      if (now - data.windowStart > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
        rateLimitMap.delete(key);
      }
    }
  }, SECURITY_CONFIG.RATE_LIMIT_WINDOW);
}

function stopRateLimitCleanup() {
  if (rateLimitCleanupInterval) {
    clearInterval(rateLimitCleanupInterval);
    rateLimitCleanupInterval = null;
  }
}

// Export cleanup function for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports.clearRateLimitInterval = stopRateLimitCleanup;
}

// Start cleanup immediately
startRateLimitCleanup();

// Secure message listener
chrome.runtime.onMessage.addListener(handleSecureMessage);

// Handle external connections (none allowed)
chrome.runtime.onConnectExternal.addListener((port) => {
  logger.warn('[Security] Blocked external connection attempt');
  port.disconnect();
});

// Security audit logging
chrome.runtime.onStartup.addListener(() => {
  startRateLimitCleanup();
});

// Service worker lifecycle - cleanup on suspend
chrome.runtime.onSuspend.addListener(() => {
  logger.debug('[Security] Service worker suspending - cleaning up resources');
  stopRateLimitCleanup();
});

// Handle keyboard commands from manifest
chrome.commands.onCommand.addListener((command) => {
  logger.debug('[Security] Command received:', command);
  if (command === 'toggle-bionic') {
    // Find active tab and forward toggle
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      const tabId = tabs[0].id;
      if (!SecurityValidator.validateOrigin(tabs[0].url)) {
        logger.warn('[Security] Command origin blocked for tab:', tabs[0].url);
        return;
      }
      chrome.tabs.sendMessage(tabId, { action: 'toggle', source: 'command' }, (response) => {
        if (chrome.runtime.lastError) {
          logger.warn('[Security] Command forwarding failed:', chrome.runtime.lastError.message);
        } else {
          logger.debug('[Security] Toggle command forwarded, response:', response);
        }
      });
    });
  }
});
// ========================================
// Context Menu Management
// ========================================

/**
 * Context menu IDs
 */
const CONTEXT_MENU_IDS = {
  TOGGLE: 'bionic-toggle',
  INTENSITY_LOW: 'bionic-intensity-low',
  INTENSITY_MEDIUM: 'bionic-intensity-medium',
  INTENSITY_HIGH: 'bionic-intensity-high',
  PROCESS_SELECTION: 'bionic-process-selection',
  SITE_ENABLE: 'bionic-site-enable',
  SITE_DISABLE: 'bionic-site-disable',
  PARENT_INTENSITY: 'bionic-intensity-parent',
  PARENT_SITE: 'bionic-site-parent'
};

/**
 * Intensity presets
 */
const INTENSITY_PRESETS = {
  LOW: 0.3,
  MEDIUM: 0.5,
  HIGH: 0.7
};

/**
 * Creates context menus on extension installation
 */
function createContextMenus() {
  // Remove any existing menus first
  chrome.contextMenus.removeAll(() => {
    // Main toggle
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.TOGGLE,
      title: 'Toggle Bionic Reading',
      contexts: ['page', 'selection']
    });

    // Separator
    chrome.contextMenus.create({
      id: 'separator-1',
      type: 'separator',
      contexts: ['page', 'selection']
    });

    // Process selected text (only visible when text is selected)
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.PROCESS_SELECTION,
      title: 'Process Selected Text',
      contexts: ['selection']
    });

    // Intensity submenu parent
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.PARENT_INTENSITY,
      title: 'Set Intensity',
      contexts: ['page', 'selection']
    });

    // Intensity options
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.INTENSITY_LOW,
      parentId: CONTEXT_MENU_IDS.PARENT_INTENSITY,
      title: 'Low (30%)',
      contexts: ['page', 'selection'],
      type: 'radio'
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.INTENSITY_MEDIUM,
      parentId: CONTEXT_MENU_IDS.PARENT_INTENSITY,
      title: 'Medium (50%)',
      contexts: ['page', 'selection'],
      type: 'radio',
      checked: true
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.INTENSITY_HIGH,
      parentId: CONTEXT_MENU_IDS.PARENT_INTENSITY,
      title: 'High (70%)',
      contexts: ['page', 'selection'],
      type: 'radio'
    });

    // Separator
    chrome.contextMenus.create({
      id: 'separator-2',
      type: 'separator',
      contexts: ['page', 'selection']
    });

    // Per-site settings submenu parent
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.PARENT_SITE,
      title: 'This Site',
      contexts: ['page', 'selection']
    });

    // Per-site enable/disable
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.SITE_ENABLE,
      parentId: CONTEXT_MENU_IDS.PARENT_SITE,
      title: 'Always Enable Here',
      contexts: ['page', 'selection']
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.SITE_DISABLE,
      parentId: CONTEXT_MENU_IDS.PARENT_SITE,
      title: 'Always Disable Here',
      contexts: ['page', 'selection']
    });

    logger.debug('[ContextMenu] Context menus created');
  });
}

/**
 * Updates context menu state based on current settings
 * @param {number} intensity - Current intensity value
 */
function updateContextMenuState(intensity) {
  // Determine which intensity radio should be checked
  let checkedId = CONTEXT_MENU_IDS.INTENSITY_MEDIUM;
  
  if (intensity <= 0.35) {
    checkedId = CONTEXT_MENU_IDS.INTENSITY_LOW;
  } else if (intensity >= 0.65) {
    checkedId = CONTEXT_MENU_IDS.INTENSITY_HIGH;
  }

  // Update radio buttons
  [CONTEXT_MENU_IDS.INTENSITY_LOW, CONTEXT_MENU_IDS.INTENSITY_MEDIUM, CONTEXT_MENU_IDS.INTENSITY_HIGH].forEach(id => {
    chrome.contextMenus.update(id, {
      checked: id === checkedId
    }).catch(() => {
      // Ignore errors (menu might not exist yet)
    });
  });
}

/**
 * Handles context menu clicks
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) {
    logger.warn('[ContextMenu] No valid tab for context menu action');
    return;
  }

  if (!SecurityValidator.validateOrigin(tab.url)) {
    logger.warn('[ContextMenu] Context menu blocked for restricted origin:', tab.url);
    return;
  }

  const tabId = tab.id;
  const menuItemId = info.menuItemId;

  switch (menuItemId) {
    case CONTEXT_MENU_IDS.TOGGLE:
      // Toggle bionic reading
      chrome.tabs.sendMessage(tabId, { action: 'toggle', source: 'contextMenu' }, (response) => {
        if (chrome.runtime.lastError) {
          logger.warn('[ContextMenu] Toggle failed:', chrome.runtime.lastError.message);
        } else {
          logger.debug('[ContextMenu] Toggle successful:', response);
        }
      });
      break;

    case CONTEXT_MENU_IDS.INTENSITY_LOW:
    case CONTEXT_MENU_IDS.INTENSITY_MEDIUM:
    case CONTEXT_MENU_IDS.INTENSITY_HIGH:
      // Set intensity
      const intensityMap = {
        [CONTEXT_MENU_IDS.INTENSITY_LOW]: INTENSITY_PRESETS.LOW,
        [CONTEXT_MENU_IDS.INTENSITY_MEDIUM]: INTENSITY_PRESETS.MEDIUM,
        [CONTEXT_MENU_IDS.INTENSITY_HIGH]: INTENSITY_PRESETS.HIGH
      };
      
      const intensity = intensityMap[menuItemId];
      
      // Save to storage
      chrome.storage.sync.set({ bionicIntensity: intensity }, () => {
        if (chrome.runtime.lastError) {
          logger.error('[ContextMenu] Failed to save intensity:', chrome.runtime.lastError);
          return;
        }
        
        // Send to content script
        chrome.tabs.sendMessage(tabId, {
          action: 'setintensity',
          intensity: intensity,
          source: 'contextMenu'
        }, (response) => {
          if (chrome.runtime.lastError) {
            logger.warn('[ContextMenu] Set intensity failed:', chrome.runtime.lastError.message);
          } else {
            logger.debug('[ContextMenu] Intensity set to:', intensity);
            updateContextMenuState(intensity);
          }
        });
      });
      break;

    case CONTEXT_MENU_IDS.PROCESS_SELECTION:
      // Process only selected text
      if (info.selectionText) {
        chrome.tabs.sendMessage(tabId, {
          action: 'processSelection',
          text: info.selectionText,
          source: 'contextMenu'
        }, (response) => {
          if (chrome.runtime.lastError) {
            logger.warn('[ContextMenu] Process selection failed:', chrome.runtime.lastError.message);
          } else {
            logger.debug('[ContextMenu] Selection processed');
          }
        });
      }
      break;

    case CONTEXT_MENU_IDS.SITE_ENABLE:
      // Enable for this site
      (async () => {
        try {
          const url = tab.url;
          await SiteSettingsManager.setSiteSettings(url, { bionicEnabled: true });
          
          // Send message to content script
          chrome.tabs.sendMessage(tabId, {
            action: 'toggle',
            forceEnable: true,
            source: 'contextMenu'
          }, (response) => {
            if (chrome.runtime.lastError) {
              logger.warn('[ContextMenu] Site enable failed:', chrome.runtime.lastError.message);
            } else {
              logger.debug('[ContextMenu] Site enabled:', url);
            }
          });
        } catch (error) {
          logger.error('[ContextMenu] Error enabling site:', error);
        }
      })();
      break;

    case CONTEXT_MENU_IDS.SITE_DISABLE:
      // Disable for this site
      (async () => {
        try {
          const url = tab.url;
          await SiteSettingsManager.setSiteSettings(url, { bionicEnabled: false });
          
          // Send message to content script
          chrome.tabs.sendMessage(tabId, {
            action: 'toggle',
            forceDisable: true,
            source: 'contextMenu'
          }, (response) => {
            if (chrome.runtime.lastError) {
              logger.warn('[ContextMenu] Site disable failed:', chrome.runtime.lastError.message);
            } else {
              logger.debug('[ContextMenu] Site disabled:', url);
            }
          });
        } catch (error) {
          logger.error('[ContextMenu] Error disabling site:', error);
        }
      })();
      break;

    default:
      logger.warn('[ContextMenu] Unknown menu item:', menuItemId);
  }
});

// Create context menus on installation
chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
  
  // Load initial intensity to set correct radio button
  chrome.storage.sync.get(['bionicIntensity'], (result) => {
    const intensity = result.bionicIntensity || 0.5;
    updateContextMenuState(intensity);
  });
});

// Update context menu state when storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.bionicIntensity) {
    const newIntensity = changes.bionicIntensity.newValue;
    if (typeof newIntensity === 'number') {
      updateContextMenuState(newIntensity);
    }
  }
});