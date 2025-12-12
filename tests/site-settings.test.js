/**
 * Site Settings Manager Tests
 * 
 * Unit tests for per-site settings storage and retrieval
 */

const SiteSettingsManager = require('../src/site-settings');

// Mock chrome.storage API
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  runtime: {
    lastError: null
  }
};

describe('SiteSettingsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome.runtime.lastError = null;
  });

  describe('getOriginFromUrl', () => {
    it('should extract origin from valid URL', () => {
      const origin = SiteSettingsManager.getOriginFromUrl('https://example.com/path?query=1');
      expect(origin).toBe('https://example.com');
    });

    it('should handle URLs with port', () => {
      const origin = SiteSettingsManager.getOriginFromUrl('http://localhost:3000/test');
      expect(origin).toBe('http://localhost:3000');
    });

    it('should return null for invalid URL', () => {
      const origin = SiteSettingsManager.getOriginFromUrl('not-a-valid-url');
      expect(origin).toBeNull();
    });

    it('should return null for empty URL', () => {
      const origin = SiteSettingsManager.getOriginFromUrl('');
      expect(origin).toBeNull();
    });
  });

  describe('getStorageKey', () => {
    it('should generate storage key with prefix', () => {
      const key = SiteSettingsManager.getStorageKey('https://example.com');
      expect(key).toBe('site_https://example.com');
    });
  });

  describe('getSiteSettings', () => {
    it('should retrieve site settings successfully', async () => {
      const mockSettings = { enabled: true, intensity: 0.7, coverage: 0.5, lastModified: 123456 };
      global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ 'site_https://example.com': mockSettings });
      });

      const settings = await SiteSettingsManager.getSiteSettings('https://example.com/path');
      expect(settings).toEqual(mockSettings);
      expect(global.chrome.storage.sync.get).toHaveBeenCalledWith(['site_https://example.com'], expect.any(Function));
    });

    it('should return null when no settings exist', async () => {
      global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const settings = await SiteSettingsManager.getSiteSettings('https://example.com');
      expect(settings).toBeNull();
    });

    it('should handle storage errors gracefully', async () => {
      global.chrome.runtime.lastError = { message: 'Storage error' };
      global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const settings = await SiteSettingsManager.getSiteSettings('https://example.com');
      expect(settings).toBeNull();
    });
  });

  describe('setSiteSettings', () => {
    it('should save site settings successfully', async () => {
      global.chrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      const success = await SiteSettingsManager.setSiteSettings('https://example.com', {
        enabled: true,
        intensity: 0.8,
        coverage: 0.6
      });

      expect(success).toBe(true);
      expect(global.chrome.storage.sync.set).toHaveBeenCalled();
      const setCall = global.chrome.storage.sync.set.mock.calls[0][0];
      expect(setCall['site_https://example.com']).toMatchObject({
        enabled: true,
        intensity: 0.8,
        coverage: 0.6,
        lastModified: expect.any(Number)
      });
    });

    it('should handle storage errors', async () => {
      global.chrome.runtime.lastError = { message: 'Storage error' };
      global.chrome.storage.sync.set.mockImplementation((data, callback) => {
        callback();
      });

      const success = await SiteSettingsManager.setSiteSettings('https://example.com', {
        enabled: true
      });

      expect(success).toBe(false);
    });
  });

  describe('clearSiteSettings', () => {
    it('should clear site settings successfully', async () => {
      global.chrome.storage.sync.remove.mockImplementation((keys, callback) => {
        callback();
      });

      const success = await SiteSettingsManager.clearSiteSettings('https://example.com');
      expect(success).toBe(true);
      expect(global.chrome.storage.sync.remove).toHaveBeenCalledWith(['site_https://example.com'], expect.any(Function));
    });

    it('should handle removal errors', async () => {
      global.chrome.runtime.lastError = { message: 'Removal error' };
      global.chrome.storage.sync.remove.mockImplementation((keys, callback) => {
        callback();
      });

      const success = await SiteSettingsManager.clearSiteSettings('https://example.com');
      expect(success).toBe(false);
    });
  });

  describe('getEffectiveSettings', () => {
    it('should return site settings when they exist', async () => {
      const mockSiteSettings = { enabled: true, intensity: 0.7, coverage: 0.5, lastModified: 123456 };
      const mockGlobalSettings = { enabled: false, intensity: 0.5, coverage: 0.4 };
      
      global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
        const keysArray = Array.isArray(keys) ? keys : Object.keys(keys || {});
        if (keysArray.includes('site_https://example.com')) {
          callback({ 'site_https://example.com': mockSiteSettings });
        } else {
          callback({ bionicIntensity: 0.5, bionicCoverage: 0.4, bionicEnabled: false });
        }
      });

      const settings = await SiteSettingsManager.getEffectiveSettings('https://example.com');
      expect(settings.enabled).toBe(true);
      expect(settings.intensity).toBe(0.7);
      expect(settings.coverage).toBe(0.5);
      expect(settings.isCustomized).toBe(true);
    });

    it('should return global settings as fallback', async () => {
      global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
        if (Array.isArray(keys) && keys[0].startsWith('site_')) {
          callback({});
        } else {
          callback({ bionicIntensity: 0.5, bionicCoverage: 0.4, bionicEnabled: false });
        }
      });

      const settings = await SiteSettingsManager.getEffectiveSettings('https://example.com');
      expect(settings.enabled).toBe(false);
      expect(settings.intensity).toBe(0.5);
      expect(settings.coverage).toBe(0.4);
      expect(settings.isCustomized).toBe(false);
    });
  });

  describe('hasCustomSettings', () => {
    it('should return true when site has custom settings', async () => {
      global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ 'site_https://example.com': { enabled: true } });
      });

      const hasCustom = await SiteSettingsManager.hasCustomSettings('https://example.com');
      expect(hasCustom).toBe(true);
    });

    it('should return false when site has no custom settings', async () => {
      global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const hasCustom = await SiteSettingsManager.hasCustomSettings('https://example.com');
      expect(hasCustom).toBe(false);
    });
  });

  describe('getAllSiteSettings', () => {
    it('should return all site-specific settings', async () => {
      const mockStorage = {
        'site_https://example.com': { enabled: true, intensity: 0.7 },
        'site_https://test.com': { enabled: false, intensity: 0.5 },
        'bionicIntensity': 0.5,
        'otherKey': 'value'
      };

      global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback(mockStorage);
      });

      const allSettings = await SiteSettingsManager.getAllSiteSettings();
      expect(allSettings).toHaveLength(2);
      expect(allSettings[0].origin).toBe('https://example.com');
      expect(allSettings[1].origin).toBe('https://test.com');
    });

    it('should return empty array when no site settings exist', async () => {
      global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
        callback({ bionicIntensity: 0.5 });
      });

      const allSettings = await SiteSettingsManager.getAllSiteSettings();
      expect(allSettings).toEqual([]);
    });
  });
});
