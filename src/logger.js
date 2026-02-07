/**
 * Centralized Logging Utility for Bionic Reader Extension
 * 
 * Provides environment-aware logging that disables debug/info logs in production
 * while keeping warnings and errors always visible.
 * 
 * @version 1.0.0
 * @license MIT
 */

'use strict';

/**
 * Determines if debug mode is enabled
 * Can be controlled via chrome.storage or hardcoded for production builds
 * 
 * @returns {boolean} True if debug logging should be enabled
 */
function isDebugMode() {
  // In production, this should return false
  // Can be overridden by storage setting for runtime debugging
  if (typeof DEBUG_MODE !== 'undefined') {
    return DEBUG_MODE;
  }
  return false; // Default to false in production
}

/**
 * Logger object with environment-aware methods
 * 
 * Usage:
 *   logger.debug('[Component] Debug message', data);
 *   logger.info('[Component] Info message');
 *   logger.warn('[Component] Warning message', error);
 *   logger.error('[Component] Error message', error);
 */
const logger = {
  /**
   * Debug level logging - only outputs when DEBUG_MODE is true
   * Use for detailed development/troubleshooting information
   */
  debug: isDebugMode() ? console.log.bind(console) : () => {},
  
  /**
   * Info level logging - only outputs when DEBUG_MODE is true
   * Use for general informational messages
   */
  info: isDebugMode() ? console.info.bind(console) : () => {},
  
  /**
   * Warning level logging - ALWAYS outputs
   * Use for recoverable issues that should be visible to developers
   */
  warn: console.warn.bind(console),
  
  /**
   * Error level logging - ALWAYS outputs
   * Use for critical errors that need immediate attention
   */
  error: console.error.bind(console),
  
  /**
   * Group start - only when DEBUG_MODE is true
   */
  group: isDebugMode() && console.group ? console.group.bind(console) : () => {},
  
  /**
   * Group end - only when DEBUG_MODE is true
   */
  groupEnd: isDebugMode() && console.groupEnd ? console.groupEnd.bind(console) : () => {},
  
  /**
   * Table logging - only when DEBUG_MODE is true
   */
  table: isDebugMode() && console.table ? console.table.bind(console) : () => {}
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    logger,
    isDebugMode
  };
}
