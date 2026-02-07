/**
 * Jest Setup File
 * Provides global mocks for the browser extension environment
 */

// Suppress console output during tests
global.console.error = jest.fn();
global.console.log = jest.fn();
global.console.warn = jest.fn();

// Provide a global logger (loaded via importScripts in background.js)
if (!global.logger) {
  global.logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    group: jest.fn(),
    groupEnd: jest.fn(),
    table: jest.fn()
  };
}

// Provide a global SiteSettingsManager stub (loaded via importScripts in background.js)
if (!global.SiteSettingsManager) {
  global.SiteSettingsManager = {
    getEffectiveSettings: jest.fn().mockResolvedValue({ enabled: false, intensity: 0.5, coverage: 0.4 }),
    setSiteSettings: jest.fn().mockResolvedValue(true),
    clearSiteSettings: jest.fn().mockResolvedValue(true),
    hasCustomSettings: jest.fn().mockResolvedValue(false),
    getSiteSettings: jest.fn().mockResolvedValue(null),
    getGlobalSettings: jest.fn().mockResolvedValue({ enabled: false, intensity: 0.5, coverage: 0.4 }),
    getAllSiteSettings: jest.fn().mockResolvedValue([])
  };
}
