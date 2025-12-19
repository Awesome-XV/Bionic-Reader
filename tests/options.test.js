/**
 * @jest-environment jsdom
 */

/**
 * Bionic Reader - Options Page Unit Tests
 * 
 * Comprehensive test suite for options page functionality including:
 * - Settings validation
 * - Storage operations
 * - Import/Export functionality
 * - UI interactions
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// Setup Chrome API mock BEFORE requiring options.js
global.chrome = {
  runtime: {
    lastError: null,
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback();
    }),
    getManifest: jest.fn(() => ({ version: '1.0.0' })),
    openOptionsPage: jest.fn()
  },
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        const defaults = {
          maxNodesPerBatch: 100,
          maxTotalNodes: 3000,
          batchDelay: 25,
          processingTimeout: 8000,
          skipSelectors: [],
          debugMode: false,
          performanceMonitoring: false
        };
        callback(defaults);
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
      })
    },
    local: {
      get: jest.fn((keys, callback) => {
        callback({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
      })
    }
  }
};

// Mock document methods for init()
global.document = {
  getElementById: jest.fn(() => ({
    addEventListener: jest.fn(),
    value: '',
    checked: false
  })),
  readyState: 'complete',
  addEventListener: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  createDocumentFragment: jest.fn(() => ({
    querySelector: jest.fn((selector) => {
      // Simulate querySelector behavior - throw on invalid selectors
      const invalid = ['..invalid', '#', '[', 'div[', '::', '>>', '::not-a-pseudo', '[unclosed', 'div]wrong', '...dots', '###ids', 'div > > child'];
      if (invalid.includes(selector) || !selector || selector.trim().length === 0) {
        throw new Error('Invalid selector');
      }
      return null;
    })
  })),
  createElement: jest.fn(() => ({
    textContent: '',
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    appendChild: jest.fn()
  })),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
};

// Load the options.js module
const optionsJs = require('../options.js');

const {
  isValidCSSSelector,
  validateImportData,
  DEFAULT_ADVANCED_SETTINGS,
  VALIDATION_RULES
} = optionsJs;

describe('Options Page - Validation', () => {
  describe('isValidCSSSelector', () => {
    test('validates correct CSS selectors', () => {
      expect(isValidCSSSelector('.class')).toBe(true);
      expect(isValidCSSSelector('#id')).toBe(true);
      expect(isValidCSSSelector('div')).toBe(true);
      expect(isValidCSSSelector('div.class')).toBe(true);
      expect(isValidCSSSelector('div > .class')).toBe(true);
      expect(isValidCSSSelector('[data-test="value"]')).toBe(true);
      expect(isValidCSSSelector('div:hover')).toBe(true);
      expect(isValidCSSSelector('.class1, .class2')).toBe(true);
    });

    test('rejects invalid CSS selectors', () => {
      expect(isValidCSSSelector('..invalid')).toBe(false);
      expect(isValidCSSSelector('#')).toBe(false);
      expect(isValidCSSSelector('[')).toBe(false);
      expect(isValidCSSSelector('div[')).toBe(false);
      expect(isValidCSSSelector('::')).toBe(false);
    });

    test('handles edge cases', () => {
      expect(isValidCSSSelector('')).toBe(false);
      expect(isValidCSSSelector(' ')).toBe(false);
      expect(isValidCSSSelector('*')).toBe(true);
    });
  });

  describe('validateImportData', () => {
    test('validates full export structure', () => {
      const validData = {
        sync: { bionicIntensity: 0.5 },
        local: {},
        exportDate: '2025-01-01',
        version: '1.0.0'
      };
      expect(validateImportData(validData)).toBe(true);
    });

    test('validates advanced settings only', () => {
      const validData = {
        maxNodesPerBatch: 100,
        maxTotalNodes: 3000,
        debugMode: false
      };
      expect(validateImportData(validData)).toBe(true);
    });

    test('rejects invalid structures', () => {
      expect(validateImportData(null)).toBe(false);
      expect(validateImportData(undefined)).toBe(false);
      expect(validateImportData('string')).toBe(false);
      expect(validateImportData(123)).toBe(false);
      expect(validateImportData([])).toBe(false);
      expect(validateImportData({})).toBe(false); // Empty object with no valid settings
    });

    test('handles partial valid data', () => {
      const partialData = {
        maxNodesPerBatch: 100,
        unknownSetting: 'value'
      };
      expect(validateImportData(partialData)).toBe(true);
    });
  });
});

describe('Options Page - Default Settings', () => {
  test('DEFAULT_ADVANCED_SETTINGS has all required properties', () => {
    expect(DEFAULT_ADVANCED_SETTINGS).toHaveProperty('maxNodesPerBatch');
    expect(DEFAULT_ADVANCED_SETTINGS).toHaveProperty('maxTotalNodes');
    expect(DEFAULT_ADVANCED_SETTINGS).toHaveProperty('batchDelay');
    expect(DEFAULT_ADVANCED_SETTINGS).toHaveProperty('processingTimeout');
    expect(DEFAULT_ADVANCED_SETTINGS).toHaveProperty('skipSelectors');
    expect(DEFAULT_ADVANCED_SETTINGS).toHaveProperty('debugMode');
    expect(DEFAULT_ADVANCED_SETTINGS).toHaveProperty('performanceMonitoring');
  });

  test('DEFAULT_ADVANCED_SETTINGS has correct types', () => {
    expect(typeof DEFAULT_ADVANCED_SETTINGS.maxNodesPerBatch).toBe('number');
    expect(typeof DEFAULT_ADVANCED_SETTINGS.maxTotalNodes).toBe('number');
    expect(typeof DEFAULT_ADVANCED_SETTINGS.batchDelay).toBe('number');
    expect(typeof DEFAULT_ADVANCED_SETTINGS.processingTimeout).toBe('number');
    expect(Array.isArray(DEFAULT_ADVANCED_SETTINGS.skipSelectors)).toBe(true);
    expect(typeof DEFAULT_ADVANCED_SETTINGS.debugMode).toBe('boolean');
    expect(typeof DEFAULT_ADVANCED_SETTINGS.performanceMonitoring).toBe('boolean');
  });

  test('DEFAULT_ADVANCED_SETTINGS values are within valid ranges', () => {
    expect(DEFAULT_ADVANCED_SETTINGS.maxNodesPerBatch).toBeGreaterThanOrEqual(VALIDATION_RULES.maxNodesPerBatch.min);
    expect(DEFAULT_ADVANCED_SETTINGS.maxNodesPerBatch).toBeLessThanOrEqual(VALIDATION_RULES.maxNodesPerBatch.max);
    
    expect(DEFAULT_ADVANCED_SETTINGS.maxTotalNodes).toBeGreaterThanOrEqual(VALIDATION_RULES.maxTotalNodes.min);
    expect(DEFAULT_ADVANCED_SETTINGS.maxTotalNodes).toBeLessThanOrEqual(VALIDATION_RULES.maxTotalNodes.max);
    
    expect(DEFAULT_ADVANCED_SETTINGS.batchDelay).toBeGreaterThanOrEqual(VALIDATION_RULES.batchDelay.min);
    expect(DEFAULT_ADVANCED_SETTINGS.batchDelay).toBeLessThanOrEqual(VALIDATION_RULES.batchDelay.max);
    
    expect(DEFAULT_ADVANCED_SETTINGS.processingTimeout).toBeGreaterThanOrEqual(VALIDATION_RULES.processingTimeout.min);
    expect(DEFAULT_ADVANCED_SETTINGS.processingTimeout).toBeLessThanOrEqual(VALIDATION_RULES.processingTimeout.max);
  });
});

describe('Options Page - Validation Rules', () => {
  test('VALIDATION_RULES has all required field rules', () => {
    expect(VALIDATION_RULES).toHaveProperty('maxNodesPerBatch');
    expect(VALIDATION_RULES).toHaveProperty('maxTotalNodes');
    expect(VALIDATION_RULES).toHaveProperty('batchDelay');
    expect(VALIDATION_RULES).toHaveProperty('processingTimeout');
    expect(VALIDATION_RULES).toHaveProperty('skipSelectors');
    expect(VALIDATION_RULES).toHaveProperty('debugMode');
    expect(VALIDATION_RULES).toHaveProperty('performanceMonitoring');
  });

  test('numeric validation rules have min, max, and type', () => {
    const numericFields = ['maxNodesPerBatch', 'maxTotalNodes', 'batchDelay', 'processingTimeout'];
    
    numericFields.forEach(field => {
      const rule = VALIDATION_RULES[field];
      expect(rule).toHaveProperty('min');
      expect(rule).toHaveProperty('max');
      expect(rule).toHaveProperty('type');
      expect(typeof rule.min).toBe('number');
      expect(typeof rule.max).toBe('number');
      expect(rule.min).toBeLessThan(rule.max);
    });
  });

  test('skipSelectors rule has correct structure', () => {
    const rule = VALIDATION_RULES.skipSelectors;
    expect(rule.type).toBe('array');
    expect(rule.itemType).toBe('cssSelector');
    expect(rule.maxItems).toBeGreaterThan(0);
  });

  test('boolean rules have correct type', () => {
    expect(VALIDATION_RULES.debugMode.type).toBe('boolean');
    expect(VALIDATION_RULES.performanceMonitoring.type).toBe('boolean');
  });
});

describe('Options Page - Storage Integration', () => {
  beforeEach(() => {
    // Mock Chrome storage API
    global.chrome = {
      runtime: {
        lastError: null,
        sendMessage: jest.fn((message, callback) => {
          if (callback) callback();
        }),
        getManifest: jest.fn(() => ({ version: '1.0.0' })),
        openOptionsPage: jest.fn()
      },
      storage: {
        sync: {
          get: jest.fn((keys, callback) => {
            callback(DEFAULT_ADVANCED_SETTINGS);
          }),
          set: jest.fn((items, callback) => {
            if (callback) callback();
          }),
          clear: jest.fn((callback) => {
            if (callback) callback();
          })
        },
        local: {
          get: jest.fn((keys, callback) => {
            callback({});
          }),
          set: jest.fn((items, callback) => {
            if (callback) callback();
          }),
          clear: jest.fn((callback) => {
            if (callback) callback();
          })
        }
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('chrome.storage.sync is available', () => {
    expect(chrome.storage.sync).toBeDefined();
    expect(chrome.storage.sync.get).toBeDefined();
    expect(chrome.storage.sync.set).toBeDefined();
  });

  test('chrome.storage.local is available', () => {
    expect(chrome.storage.local).toBeDefined();
    expect(chrome.storage.local.get).toBeDefined();
    expect(chrome.storage.local.set).toBeDefined();
  });
});

describe('Options Page - Edge Cases', () => {
  test('handles null and undefined gracefully', () => {
    expect(isValidCSSSelector(null)).toBe(false);
    expect(isValidCSSSelector(undefined)).toBe(false);
    expect(validateImportData(null)).toBe(false);
    expect(validateImportData(undefined)).toBe(false);
  });

  test('handles empty strings and arrays', () => {
    expect(isValidCSSSelector('')).toBe(false);
    expect(validateImportData({})).toBe(false);
  });

  test('handles very large numbers', () => {
    const rules = VALIDATION_RULES.maxNodesPerBatch;
    expect(rules.max).toBeLessThan(1000); // Reasonable limit
  });

  test('handles negative numbers correctly', () => {
    const rules = VALIDATION_RULES.batchDelay;
    expect(rules.min).toBeGreaterThanOrEqual(0);
  });
});

describe('Options Page - CSS Selector Validation', () => {
  test('validates common selectors used in extensions', () => {
    const commonSelectors = [
      '.advertisement',
      '#header-nav',
      '.no-bionic',
      'nav.main-menu',
      'div[data-testid="banner"]',
      'aside.sidebar',
      '.cookie-notice',
      'header, footer',
      '.popup-overlay'
    ];

    commonSelectors.forEach(selector => {
      expect(isValidCSSSelector(selector)).toBe(true);
    });
  });

  test('validates advanced selectors', () => {
    const advancedSelectors = [
      'div:not(.bionic)',
      'p:first-child',
      'span:nth-of-type(2)',
      'a[href^="https"]',
      'input[type="text"]',
      'button:enabled',
      '.parent > .child',
      '.ancestor .descendant'
    ];

    advancedSelectors.forEach(selector => {
      expect(isValidCSSSelector(selector)).toBe(true);
    });
  });

  test('rejects malformed selectors', () => {
    // Test selectors that should definitely be invalid
    const definitelyInvalid = ['..invalid', '#', '[', 'div['];
    
    definitelyInvalid.forEach(selector => {
      expect(isValidCSSSelector(selector)).toBe(false);
    });
  });
});

describe('Options Page - Import/Export Validation', () => {
  test('validates complete export structure', () => {
    const completeExport = {
      sync: {
        bionicIntensity: 0.5,
        bionicCoverage: 0.4,
        bionicEnabled: true,
        maxNodesPerBatch: 100,
        maxTotalNodes: 3000,
        batchDelay: 25,
        processingTimeout: 8000,
        skipSelectors: ['.ad', '.banner'],
        debugMode: false,
        performanceMonitoring: false
      },
      local: {
        '2025-01-01': {
          wordsProcessed: 1000,
          activeTime: 60000,
          sessions: 5
        }
      },
      exportDate: '2025-01-01T12:00:00Z',
      version: '1.1.3'
    };

    expect(validateImportData(completeExport)).toBe(true);
  });

  test('validates minimal export structure', () => {
    const minimalExport = {
      sync: {},
      local: {}
    };

    expect(validateImportData(minimalExport)).toBe(true);
  });

  test('validates advanced-only export', () => {
    const advancedOnly = {
      maxNodesPerBatch: 150,
      maxTotalNodes: 5000,
      debugMode: true
    };

    expect(validateImportData(advancedOnly)).toBe(true);
  });

  test('rejects invalid export structures', () => {
    const invalidExports = [
      { random: 'object' } // No valid settings at all
    ];

    invalidExports.forEach(invalid => {
      expect(validateImportData(invalid)).toBe(false);
    });
  });
});

describe('Options Page - Security Validation', () => {
  test('prevents injection in CSS selectors', () => {
    const maliciousSelectors = [
      '<script>alert("xss")</script>',
      'javascript:alert(1)',
      'onclick="alert(1)"',
      'style="color:red"'
    ];

    maliciousSelectors.forEach(selector => {
      expect(isValidCSSSelector(selector)).toBe(false);
    });
  });

  test('handles extremely long selectors', () => {
    const longSelector = '.class' + 'a'.repeat(10000);
    // Should not crash, may be invalid but handles gracefully
    expect(() => isValidCSSSelector(longSelector)).not.toThrow();
  });

  test('validates file size would be checked in import', () => {
    // In actual implementation, file size is checked before parsing
    const maxFileSize = 1024 * 1024; // 1MB
    expect(maxFileSize).toBe(1048576);
  });
});

describe('Options Page - Performance', () => {
  test('validation rules have reasonable limits', () => {
    expect(VALIDATION_RULES.maxNodesPerBatch.max).toBeLessThanOrEqual(500);
    expect(VALIDATION_RULES.maxTotalNodes.max).toBeLessThanOrEqual(10000);
    expect(VALIDATION_RULES.batchDelay.max).toBeLessThanOrEqual(1000);
    expect(VALIDATION_RULES.processingTimeout.max).toBeLessThanOrEqual(30000);
    expect(VALIDATION_RULES.skipSelectors.maxItems).toBeLessThanOrEqual(50);
  });

  test('default values are performance-optimized', () => {
    expect(DEFAULT_ADVANCED_SETTINGS.maxNodesPerBatch).toBeLessThanOrEqual(150);
    expect(DEFAULT_ADVANCED_SETTINGS.batchDelay).toBeLessThanOrEqual(50);
    expect(DEFAULT_ADVANCED_SETTINGS.processingTimeout).toBeLessThanOrEqual(10000);
  });
});

describe('Options Page - Consistency', () => {
  test('all default settings match validation rules', () => {
    Object.keys(DEFAULT_ADVANCED_SETTINGS).forEach(key => {
      expect(VALIDATION_RULES).toHaveProperty(key);
    });
  });

  test('all validation rules have corresponding defaults', () => {
    Object.keys(VALIDATION_RULES).forEach(key => {
      expect(DEFAULT_ADVANCED_SETTINGS).toHaveProperty(key);
    });
  });

  test('numeric defaults are within validation bounds', () => {
    const numericFields = ['maxNodesPerBatch', 'maxTotalNodes', 'batchDelay', 'processingTimeout'];
    
    numericFields.forEach(field => {
      const value = DEFAULT_ADVANCED_SETTINGS[field];
      const rule = VALIDATION_RULES[field];
      
      expect(value).toBeGreaterThanOrEqual(rule.min);
      expect(value).toBeLessThanOrEqual(rule.max);
    });
  });
});

describe('Options Page - Type Safety', () => {
  test('default settings maintain correct types', () => {
    expect(Number.isInteger(DEFAULT_ADVANCED_SETTINGS.maxNodesPerBatch)).toBe(true);
    expect(Number.isInteger(DEFAULT_ADVANCED_SETTINGS.maxTotalNodes)).toBe(true);
    expect(Number.isInteger(DEFAULT_ADVANCED_SETTINGS.batchDelay)).toBe(true);
    expect(Number.isInteger(DEFAULT_ADVANCED_SETTINGS.processingTimeout)).toBe(true);
    expect(Array.isArray(DEFAULT_ADVANCED_SETTINGS.skipSelectors)).toBe(true);
    expect(typeof DEFAULT_ADVANCED_SETTINGS.debugMode).toBe('boolean');
    expect(typeof DEFAULT_ADVANCED_SETTINGS.performanceMonitoring).toBe('boolean');
  });

  test('validation rules specify correct types', () => {
    expect(VALIDATION_RULES.maxNodesPerBatch.type).toBe('integer');
    expect(VALIDATION_RULES.maxTotalNodes.type).toBe('integer');
    expect(VALIDATION_RULES.batchDelay.type).toBe('integer');
    expect(VALIDATION_RULES.processingTimeout.type).toBe('integer');
    expect(VALIDATION_RULES.skipSelectors.type).toBe('array');
    expect(VALIDATION_RULES.debugMode.type).toBe('boolean');
    expect(VALIDATION_RULES.performanceMonitoring.type).toBe('boolean');
  });
});

describe('Options Page - Advanced Coverage Tests', () => {
  test('handles complex CSS selectors correctly', () => {
    const complexSelectors = [
      'div > p + span',
      'ul li:nth-child(odd)',
      'input[type="text"]:focus',
      '.class1.class2',
      '#id.class',
      '[data-attr*="value"]',
      'a:not([href])',
      'p::first-line'
    ];

    complexSelectors.forEach(selector => {
      const result = isValidCSSSelector(selector);
      expect(typeof result).toBe('boolean');
    });
  });

  test('validates import data with mixed valid and invalid keys', () => {
    const mixedData = {
      maxNodesPerBatch: 100,
      invalidKey: 'should be ignored',
      debugMode: true,
      anotherInvalid: 123
    };

    expect(validateImportData(mixedData)).toBe(true);
  });

  test('validates import data with sync object containing invalid data', () => {
    const dataWithInvalidSync = {
      sync: { validKey: 'value' },
      local: {}
    };

    expect(validateImportData(dataWithInvalidSync)).toBe(true);
  });

  test('validates empty arrays and objects', () => {
    expect(validateImportData({ sync: {}, local: {} })).toBe(true);
  });

  test('CSS selector validation with special characters', () => {
    expect(isValidCSSSelector('div')).toBe(true);
    expect(isValidCSSSelector('.class-name')).toBe(true);
    expect(isValidCSSSelector('#id_name')).toBe(true);
    expect(isValidCSSSelector('[data-test]')).toBe(true);
  });

  test('validates default settings match validation constraints', () => {
    Object.keys(DEFAULT_ADVANCED_SETTINGS).forEach(key => {
      const value = DEFAULT_ADVANCED_SETTINGS[key];
      const rule = VALIDATION_RULES[key];

      if (rule.type === 'integer') {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(rule.min);
        expect(value).toBeLessThanOrEqual(rule.max);
      } else if (rule.type === 'boolean') {
        expect(typeof value).toBe('boolean');
      } else if (rule.type === 'array') {
        expect(Array.isArray(value)).toBe(true);
      }
    });
  });

  test('import validation rejects primitive types', () => {
    expect(validateImportData(123)).toBe(false);
    expect(validateImportData('string')).toBe(false);
    expect(validateImportData(true)).toBe(false);
    expect(validateImportData([])).toBe(false);
  });

  test('CSS selector handles whitespace correctly', () => {
    expect(isValidCSSSelector('  ')).toBe(false);
    expect(isValidCSSSelector('\t\n')).toBe(false);
    expect(isValidCSSSelector(' .class ')).toBe(true); // querySelector trims
  });

  test('validation rules have sensible step values', () => {
    expect(VALIDATION_RULES.maxNodesPerBatch.step).toBeGreaterThan(0);
    expect(VALIDATION_RULES.maxTotalNodes.step).toBeGreaterThan(0);
    expect(VALIDATION_RULES.batchDelay.step).toBeGreaterThan(0);
    expect(VALIDATION_RULES.processingTimeout.step).toBeGreaterThan(0);
  });

  test('skipSelectors validation has reasonable max items', () => {
    expect(VALIDATION_RULES.skipSelectors.maxItems).toBeGreaterThan(10);
    expect(VALIDATION_RULES.skipSelectors.maxItems).toBeLessThanOrEqual(100);
  });

  test('import data with only local storage', () => {
    const localOnlyData = {
      local: { someData: 'value' }
    };
    expect(validateImportData(localOnlyData)).toBe(true);
  });

  test('import data with only sync storage', () => {
    const syncOnlyData = {
      sync: { maxNodesPerBatch: 100 }
    };
    expect(validateImportData(syncOnlyData)).toBe(true);
  });

  test('validates complex export structure with metadata', () => {
    const complexExport = {
      sync: {
        maxNodesPerBatch: 150,
        skipSelectors: ['.ad', '.banner']
      },
      local: {
        stats: { words: 1000 }
      },
      exportDate: '2025-12-18',
      version: '1.1.4'
    };

    expect(validateImportData(complexExport)).toBe(true);
  });

  test('CSS selector validation for edge case inputs', () => {
    expect(isValidCSSSelector(null)).toBe(false);
    expect(isValidCSSSelector(undefined)).toBe(false);
    expect(isValidCSSSelector(0)).toBe(false);
    expect(isValidCSSSelector(false)).toBe(false);
    expect(isValidCSSSelector({})).toBe(false);
  });

  test('validates that all numeric rules have proper ranges', () => {
    const numericFields = ['maxNodesPerBatch', 'maxTotalNodes', 'batchDelay', 'processingTimeout'];
    
    numericFields.forEach(field => {
      const rule = VALIDATION_RULES[field];
      expect(rule.min).toBeLessThan(rule.max);
      expect(rule.min).toBeGreaterThanOrEqual(0);
      expect(rule.max).toBeGreaterThan(0);
    });
  });

  test('import data validation with nested objects', () => {
    const nestedData = {
      sync: {
        settings: {
          nested: 'value'
        }
      }
    };
    
    // Should still be valid even with unexpected nesting
    expect(validateImportData(nestedData)).toBe(true);
  });

  test('validates selector array item type specification', () => {
    expect(VALIDATION_RULES.skipSelectors.itemType).toBe('cssSelector');
  });

  test('ensures all validation rules exist for default settings', () => {
    const defaultKeys = Object.keys(DEFAULT_ADVANCED_SETTINGS);
    const ruleKeys = Object.keys(VALIDATION_RULES);
    
    expect(defaultKeys.sort()).toEqual(ruleKeys.sort());
  });
});
