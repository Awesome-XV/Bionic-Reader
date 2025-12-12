/**
 * Per-Site Settings Manager
 * 
 * Handles storage and retrieval of site-specific bionic reader settings.
 * Settings are stored in chrome.storage.sync keyed by origin.
 * 
 * @version 1.0.0
 * @license MIT
 */

'use strict';

/**
 * @typedef {Object} SiteSettings
 * @property {boolean} enabled - Whether bionic reading is enabled for this site
 * @property {number} intensity - Intensity value (0.0-1.0) for this site
 * @property {number} coverage - Coverage value (0.0-1.0) for this site
 * @property {number} lastModified - Timestamp of last modification
 */

/**
 * @typedef {Object} GlobalSettings
 * @property {boolean} enabled - Global enabled state (fallback)
 * @property {number} intensity - Global intensity (fallback)
 * @property {number} coverage - Global coverage (fallback)
 */

const SITE_SETTINGS_PREFIX = 'site_';
const GLOBAL_SETTINGS_KEY = 'globalSettings';

/**
 * Site Settings Manager class
 */
class SiteSettingsManager {
  /**
   * Extract origin from URL (protocol + hostname + port)
   * 
   * @param {string} url - Full URL
   * @returns {string|null} Origin string or null if invalid
   */
  static getOriginFromUrl(url) {
    try {
      if (!url) return null;
      const urlObj = new URL(url);
      return urlObj.origin;
    } catch (e) {
      console.warn('[SiteSettings] Invalid URL:', url);
      return null;
    }
  }

  /**
   * Get storage key for a specific origin
   * 
   * @param {string} origin - Origin string
   * @returns {string} Storage key
   */
  static getStorageKey(origin) {
    return `${SITE_SETTINGS_PREFIX}${origin}`;
  }

  /**
   * Get settings for a specific site
   * 
   * @param {string} url - URL of the site
   * @returns {Promise<SiteSettings|null>} Site settings or null if not set
   */
  static async getSiteSettings(url) {
    const origin = this.getOriginFromUrl(url);
    if (!origin) return null;

    const storageKey = this.getStorageKey(origin);
    
    return new Promise((resolve) => {
      chrome.storage.sync.get([storageKey], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[SiteSettings] Error reading settings:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(result[storageKey] || null);
      });
    });
  }

  /**
   * Set settings for a specific site
   * 
   * @param {string} url - URL of the site
   * @param {Partial<SiteSettings>} settings - Settings to save
   * @returns {Promise<boolean>} Success status
   */
  static async setSiteSettings(url, settings) {
    const origin = this.getOriginFromUrl(url);
    if (!origin) return false;

    const storageKey = this.getStorageKey(origin);
    const settingsToSave = {
      ...settings,
      lastModified: Date.now()
    };

    return new Promise((resolve) => {
      chrome.storage.sync.set({ [storageKey]: settingsToSave }, () => {
        if (chrome.runtime.lastError) {
          console.error('[SiteSettings] Error saving settings:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        console.log('[SiteSettings] Saved settings for', origin, settingsToSave);
        resolve(true);
      });
    });
  }

  /**
   * Clear settings for a specific site (revert to global defaults)
   * 
   * @param {string} url - URL of the site
   * @returns {Promise<boolean>} Success status
   */
  static async clearSiteSettings(url) {
    const origin = this.getOriginFromUrl(url);
    if (!origin) return false;

    const storageKey = this.getStorageKey(origin);

    return new Promise((resolve) => {
      chrome.storage.sync.remove([storageKey], () => {
        if (chrome.runtime.lastError) {
          console.error('[SiteSettings] Error clearing settings:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        console.log('[SiteSettings] Cleared settings for', origin);
        resolve(true);
      });
    });
  }

  /**
   * Get global default settings
   * 
   * @returns {Promise<GlobalSettings>} Global settings
   */
  static async getGlobalSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        bionicIntensity: 0.5,
        bionicCoverage: 0.4,
        bionicEnabled: false
      }, (result) => {
        if (chrome.runtime.lastError) {
          console.error('[SiteSettings] Error reading global settings:', chrome.runtime.lastError);
          resolve({ enabled: false, intensity: 0.5, coverage: 0.4 });
          return;
        }
        resolve({
          enabled: Boolean(result.bionicEnabled),
          intensity: Number(result.bionicIntensity) || 0.5,
          coverage: Number(result.bionicCoverage) || 0.4
        });
      });
    });
  }

  /**
   * Get effective settings for a site (site-specific or global fallback)
   * 
   * @param {string} url - URL of the site
   * @returns {Promise<SiteSettings>} Effective settings
   */
  static async getEffectiveSettings(url) {
    const [siteSettings, globalSettings] = await Promise.all([
      this.getSiteSettings(url),
      this.getGlobalSettings()
    ]);

    if (siteSettings) {
      return {
        enabled: siteSettings.enabled !== undefined ? siteSettings.enabled : globalSettings.enabled,
        intensity: siteSettings.intensity !== undefined ? siteSettings.intensity : globalSettings.intensity,
        coverage: siteSettings.coverage !== undefined ? siteSettings.coverage : globalSettings.coverage,
        lastModified: siteSettings.lastModified,
        isCustomized: true
      };
    }

    return {
      enabled: globalSettings.enabled,
      intensity: globalSettings.intensity,
      coverage: globalSettings.coverage,
      isCustomized: false
    };
  }

  /**
   * Check if a site has custom settings
   * 
   * @param {string} url - URL of the site
   * @returns {Promise<boolean>} True if site has custom settings
   */
  static async hasCustomSettings(url) {
    const settings = await this.getSiteSettings(url);
    return settings !== null;
  }

  /**
   * Get all sites with custom settings
   * 
   * @returns {Promise<Array<{origin: string, settings: SiteSettings}>>} Array of sites with settings
   */
  static async getAllSiteSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (items) => {
        if (chrome.runtime.lastError) {
          console.error('[SiteSettings] Error reading all settings:', chrome.runtime.lastError);
          resolve([]);
          return;
        }

        const siteSettings = [];
        for (const [key, value] of Object.entries(items)) {
          if (key.startsWith(SITE_SETTINGS_PREFIX)) {
            const origin = key.substring(SITE_SETTINGS_PREFIX.length);
            siteSettings.push({ origin, settings: value });
          }
        }
        resolve(siteSettings);
      });
    });
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SiteSettingsManager;
}
