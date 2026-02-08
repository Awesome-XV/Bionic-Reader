/**
 * Bionic Reader Options Page
 * 
 * Manages advanced settings, validation, import/export, and storage
 * 
 * @version 1.0.0
 * @license MIT
 */
'use strict';

/**
 * Default advanced settings configuration
 * @const {Object}
 */
const DEFAULT_ADVANCED_SETTINGS = {
  maxNodesPerBatch: 100,
  maxTotalNodes: 3000,
  batchDelay: 25,
  processingTimeout: 8000,
  skipSelectors: [],
  debugMode: false,
  performanceMonitoring: false
};

/**
 * Validation rules for settings
 * @const {Object}
 */
const VALIDATION_RULES = {
  maxNodesPerBatch: { min: 10, max: 500, step: 10, type: 'integer' },
  maxTotalNodes: { min: 500, max: 10000, step: 100, type: 'integer' },
  batchDelay: { min: 0, max: 1000, step: 5, type: 'integer' },
  processingTimeout: { min: 1000, max: 30000, step: 1000, type: 'integer' },
  skipSelectors: { type: 'array', itemType: 'cssSelector', maxItems: 50 },
  debugMode: { type: 'boolean' },
  performanceMonitoring: { type: 'boolean' }
};

/**
 * UI elements cache
 */
const elements = {
  maxNodesPerBatch: null,
  maxTotalNodes: null,
  batchDelay: null,
  processingTimeout: null,
  skipSelectors: null,
  debugMode: null,
  performanceMonitoring: null,
  
  // Buttons
  saveSettings: null,
  resetDefaults: null,
  clearStorage: null,
  exportSettings: null,
  exportAdvanced: null,
  importFile: null,
  
  // Status
  statusAlert: null,
  
  // Stats
  syncStorageUsed: null,
  localStorageUsed: null,
  settingsCount: null,
  
  // Validation
  skipSelectorsValidation: null
};

/**
 * Initialize the options page
 */
function init() {
  // Cache DOM elements
  cacheElements();
  
  // Load current settings
  loadSettings();
  
  // Update storage info
  updateStorageInfo();
  
  // Attach event listeners
  attachEventListeners();
  
  console.log('[Options] Page initialized');
}

/**
 * Cache all DOM elements for performance
 */
function cacheElements() {
  elements.maxNodesPerBatch = document.getElementById('maxNodesPerBatch');
  elements.maxTotalNodes = document.getElementById('maxTotalNodes');
  elements.batchDelay = document.getElementById('batchDelay');
  elements.processingTimeout = document.getElementById('processingTimeout');
  elements.skipSelectors = document.getElementById('skipSelectors');
  elements.debugMode = document.getElementById('debugMode');
  elements.performanceMonitoring = document.getElementById('performanceMonitoring');
  
  elements.saveSettings = document.getElementById('saveSettings');
  elements.resetDefaults = document.getElementById('resetDefaults');
  elements.clearStorage = document.getElementById('clearStorage');
  elements.exportSettings = document.getElementById('exportSettings');
  elements.exportAdvanced = document.getElementById('exportAdvanced');
  elements.importFile = document.getElementById('importFile');
  
  elements.statusAlert = document.getElementById('statusAlert');
  
  elements.syncStorageUsed = document.getElementById('syncStorageUsed');
  elements.localStorageUsed = document.getElementById('localStorageUsed');
  elements.settingsCount = document.getElementById('settingsCount');
  
  elements.skipSelectorsValidation = document.getElementById('skipSelectorsValidation');
}

/**
 * Attach event listeners to UI elements
 */
function attachEventListeners() {
  // Save settings
  elements.saveSettings.addEventListener('click', handleSaveSettings);
  
  // Reset to defaults
  elements.resetDefaults.addEventListener('click', handleResetDefaults);
  
  // Clear storage
  elements.clearStorage.addEventListener('click', handleClearStorage);
  
  // Export settings
  elements.exportSettings.addEventListener('click', () => handleExport(false));
  elements.exportAdvanced.addEventListener('click', () => handleExport(true));
  
  // Import settings
  elements.importFile.addEventListener('change', handleImport);
  
  // Real-time validation for skip selectors
  elements.skipSelectors.addEventListener('input', debounce(validateSkipSelectors, 500));
  
  // Real-time validation for numeric inputs
  elements.maxNodesPerBatch.addEventListener('input', () => validateNumericInput('maxNodesPerBatch'));
  elements.maxTotalNodes.addEventListener('input', () => validateNumericInput('maxTotalNodes'));
  elements.batchDelay.addEventListener('input', () => validateNumericInput('batchDelay'));
  elements.processingTimeout.addEventListener('input', () => validateNumericInput('processingTimeout'));
  
  // Debug mode checkbox - auto-enable performance monitoring
  elements.debugMode.addEventListener('change', (e) => {
    if (e.target.checked) {
      elements.performanceMonitoring.checked = true;
      elements.performanceMonitoring.disabled = true;
    } else {
      elements.performanceMonitoring.disabled = false;
    }
  });
}

/**
 * Load settings from storage and populate UI
 */
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_ADVANCED_SETTINGS, (items) => {
    if (chrome.runtime.lastError) {
      showAlert('Error loading settings: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    
    // Populate numeric fields
    elements.maxNodesPerBatch.value = items.maxNodesPerBatch || DEFAULT_ADVANCED_SETTINGS.maxNodesPerBatch;
    elements.maxTotalNodes.value = items.maxTotalNodes || DEFAULT_ADVANCED_SETTINGS.maxTotalNodes;
    elements.batchDelay.value = items.batchDelay || DEFAULT_ADVANCED_SETTINGS.batchDelay;
    elements.processingTimeout.value = items.processingTimeout || DEFAULT_ADVANCED_SETTINGS.processingTimeout;
    
    // Populate skip selectors
    const selectors = items.skipSelectors || [];
    elements.skipSelectors.value = Array.isArray(selectors) ? selectors.join('\n') : '';
    
    // Populate checkboxes
    elements.debugMode.checked = items.debugMode || false;
    elements.performanceMonitoring.checked = items.performanceMonitoring || false;
    
    // Handle debug mode dependency
    if (elements.debugMode.checked) {
      elements.performanceMonitoring.disabled = true;
    }
    
    // Validate loaded selectors
    validateSkipSelectors();
    
    console.log('[Options] Settings loaded:', items);
  });
}

/**
 * Validate numeric input against rules
 * @param {string} fieldName - Name of the field to validate
 * @returns {boolean} Whether the input is valid
 */
function validateNumericInput(fieldName) {
  const element = elements[fieldName];
  const errorElement = document.getElementById(`${fieldName}Error`);
  const rules = VALIDATION_RULES[fieldName];
  
  if (!element || !rules) return false;
  
  const value = parseFloat(element.value);
  
  // Check if value is a number
  if (isNaN(value)) {
    element.classList.add('input-error');
    errorElement.textContent = 'Must be a valid number';
    errorElement.classList.add('show');
    return false;
  }
  
  // Check min/max bounds
  if (value < rules.min || value > rules.max) {
    element.classList.add('input-error');
    errorElement.textContent = `Must be between ${rules.min} and ${rules.max}`;
    errorElement.classList.add('show');
    return false;
  }
  
  // Check if integer type
  if (rules.type === 'integer' && !Number.isInteger(value)) {
    element.classList.add('input-error');
    errorElement.textContent = 'Must be a whole number';
    errorElement.classList.add('show');
    return false;
  }
  
  // Valid - clear errors
  element.classList.remove('input-error');
  errorElement.classList.remove('show');
  return true;
}

/**
 * Validate CSS selectors
 * @returns {boolean} Whether all selectors are valid
 */
function validateSkipSelectors() {
  const textareaValue = elements.skipSelectors.value.trim();
  const errorElement = document.getElementById('skipSelectorsError');
  const validationList = elements.skipSelectorsValidation;
  
  // Clear previous validation
  validationList.innerHTML = '';
  elements.skipSelectors.classList.remove('input-error');
  errorElement.classList.remove('show');
  
  // If empty, it's valid
  if (!textareaValue) {
    return true;
  }
  
  const selectors = textareaValue.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  
  // Check max items
  if (selectors.length > VALIDATION_RULES.skipSelectors.maxItems) {
    elements.skipSelectors.classList.add('input-error');
    errorElement.textContent = `Maximum ${VALIDATION_RULES.skipSelectors.maxItems} selectors allowed`;
    errorElement.classList.add('show');
    return false;
  }
  
  let allValid = true;
  
  // Validate each selector
  selectors.forEach((selector, index) => {
    const isValid = isValidCSSSelector(selector);
    const li = document.createElement('li');
    li.textContent = selector;
    
    if (!isValid) {
      li.classList.add('invalid');
      allValid = false;
    }
    
    validationList.appendChild(li);
  });
  
  if (!allValid) {
    elements.skipSelectors.classList.add('input-error');
    errorElement.textContent = 'One or more selectors are invalid';
    errorElement.classList.add('show');
  }
  
  return allValid;
}

/**
 * Test if a string is a valid CSS selector
 * @param {string} selector - CSS selector to validate
 * @returns {boolean} Whether the selector is valid
 */
function isValidCSSSelector(selector) {
  // Handle null, undefined, empty
  if (!selector || typeof selector !== 'string' || selector.trim().length === 0) {
    return false;
  }
  
  try {
    // Try to query the selector (will throw if invalid)
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Validate all settings before saving
 * @returns {Object|null} Validated settings object or null if invalid
 */
function validateAllSettings() {
  let allValid = true;
  
  // Validate numeric fields
  ['maxNodesPerBatch', 'maxTotalNodes', 'batchDelay', 'processingTimeout'].forEach(field => {
    if (!validateNumericInput(field)) {
      allValid = false;
    }
  });
  
  // Validate skip selectors
  if (!validateSkipSelectors()) {
    allValid = false;
  }
  
  if (!allValid) {
    return null;
  }
  
  // Collect settings
  const textareaValue = elements.skipSelectors.value.trim();
  const skipSelectors = textareaValue ? textareaValue.split('\n').map(s => s.trim()).filter(s => s.length > 0) : [];
  
  return {
    maxNodesPerBatch: parseInt(elements.maxNodesPerBatch.value, 10),
    maxTotalNodes: parseInt(elements.maxTotalNodes.value, 10),
    batchDelay: parseInt(elements.batchDelay.value, 10),
    processingTimeout: parseInt(elements.processingTimeout.value, 10),
    skipSelectors: skipSelectors,
    debugMode: elements.debugMode.checked,
    performanceMonitoring: elements.performanceMonitoring.checked || elements.debugMode.checked
  };
}

/**
 * Handle save settings button click
 */
function handleSaveSettings() {
  const settings = validateAllSettings();
  
  if (!settings) {
    showAlert('Please fix validation errors before saving', 'error');
    return;
  }
  
  // Show loading state
  const originalText = elements.saveSettings.textContent;
  elements.saveSettings.innerHTML = '<span class="spinner"></span> Saving...';
  elements.saveSettings.disabled = true;
  
  // Save to storage
  chrome.storage.sync.set(settings, () => {
    if (chrome.runtime.lastError) {
      showAlert('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      elements.saveSettings.textContent = originalText;
      elements.saveSettings.disabled = false;
      return;
    }
    
    // Notify background script to update content scripts
    chrome.runtime.sendMessage({ 
      action: 'updateAdvancedSettings', 
      settings: settings 
    }, () => {
      // Ignore errors from tabs that don't have content scripts
      if (chrome.runtime.lastError) {
        console.log('[Options] Background message sent (some tabs may not respond)');
      }
    });
    
    showAlert('Settings saved successfully!', 'success');
    elements.saveSettings.textContent = originalText;
    elements.saveSettings.disabled = false;
    
    // Update storage info
    updateStorageInfo();
    
    console.log('[Options] Settings saved:', settings);
  });
}

/**
 * Handle reset to defaults button click
 */
function handleResetDefaults() {
  if (!confirm('Are you sure you want to reset all advanced settings to defaults? This cannot be undone.')) {
    return;
  }
  
  // Reset UI
  elements.maxNodesPerBatch.value = DEFAULT_ADVANCED_SETTINGS.maxNodesPerBatch;
  elements.maxTotalNodes.value = DEFAULT_ADVANCED_SETTINGS.maxTotalNodes;
  elements.batchDelay.value = DEFAULT_ADVANCED_SETTINGS.batchDelay;
  elements.processingTimeout.value = DEFAULT_ADVANCED_SETTINGS.processingTimeout;
  elements.skipSelectors.value = '';
  elements.debugMode.checked = DEFAULT_ADVANCED_SETTINGS.debugMode;
  elements.performanceMonitoring.checked = DEFAULT_ADVANCED_SETTINGS.performanceMonitoring;
  elements.performanceMonitoring.disabled = false;
  
  // Clear validation
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
  elements.skipSelectorsValidation.innerHTML = '';
  
  // Save defaults
  chrome.storage.sync.set(DEFAULT_ADVANCED_SETTINGS, () => {
    if (chrome.runtime.lastError) {
      showAlert('Error resetting settings: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    
    showAlert('Settings reset to defaults', 'success');
    updateStorageInfo();
    console.log('[Options] Settings reset to defaults');
  });
}

/**
 * Handle clear storage button click
 */
function handleClearStorage() {
  if (!confirm('Are you sure you want to clear ALL stored data? This includes your preferences, statistics, and per-site settings. This cannot be undone.')) {
    return;
  }
  
  // Secondary confirmation for critical action
  if (!confirm('This will permanently delete all your Bionic Reader data. Continue?')) {
    return;
  }
  
  // Clear both sync and local storage
  chrome.storage.sync.clear(() => {
    if (chrome.runtime.lastError) {
      showAlert('Error clearing sync storage: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        showAlert('Error clearing local storage: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      
      showAlert('All storage cleared. Reloading with defaults...', 'success');
      
      // Reload after a delay
      setTimeout(() => {
        loadSettings();
        updateStorageInfo();
      }, 1500);
      
      console.log('[Options] All storage cleared');
    });
  });
}

/**
 * Handle export settings
 * @param {boolean} advancedOnly - Whether to export only advanced settings
 */
function handleExport(advancedOnly) {
  const storageType = advancedOnly ? 'sync' : 'all';
  
  if (advancedOnly) {
    // Export only advanced settings
    chrome.storage.sync.get(null, (items) => {
      if (chrome.runtime.lastError) {
        showAlert('Error exporting settings: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      
      // Filter to only advanced settings
      const advancedSettings = {};
      Object.keys(DEFAULT_ADVANCED_SETTINGS).forEach(key => {
        if (items.hasOwnProperty(key)) {
          advancedSettings[key] = items[key];
        }
      });
      
      downloadSettings(advancedSettings, 'bionic-reader-advanced-settings');
    });
  } else {
    // Export all settings
    chrome.storage.sync.get(null, (syncItems) => {
      if (chrome.runtime.lastError) {
        showAlert('Error exporting settings: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      
      chrome.storage.local.get(null, (localItems) => {
        if (chrome.runtime.lastError) {
          showAlert('Error exporting settings: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        const allSettings = {
          sync: syncItems,
          local: localItems,
          exportDate: new Date().toISOString(),
          version: chrome.runtime.getManifest().version
        };
        
        downloadSettings(allSettings, 'bionic-reader-all-settings');
      });
    });
  }
}

/**
 * Download settings as JSON file
 * @param {Object} data - Settings data to export
 * @param {string} filename - Base filename (without extension)
 */
function downloadSettings(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showAlert('Settings exported successfully', 'success');
  console.log('[Options] Settings exported:', filename);
}

/**
 * Handle import settings
 * @param {Event} event - File input change event
 */
function handleImport(event) {
  const file = event.target.files[0];
  
  if (!file) {
    return;
  }
  
  // Validate file type
  if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
    showAlert('Invalid file type. Please select a JSON file.', 'error');
    return;
  }
  
  // Validate file size (max 1MB)
  if (file.size > 1024 * 1024) {
    showAlert('File too large. Maximum size is 1MB.', 'error');
    return;
  }
  
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // Validate structure
      if (!validateImportData(data)) {
        showAlert('Invalid settings file structure', 'error');
        return;
      }
      
      // Confirm import
      if (!confirm('This will overwrite your current settings. Continue?')) {
        return;
      }
      
      // Import settings
      importSettings(data);
      
    } catch (error) {
      showAlert('Error parsing JSON file: ' + error.message, 'error');
      console.error('[Options] Import error:', error);
    }
  };
  
  reader.onerror = () => {
    showAlert('Error reading file', 'error');
  };
  
  reader.readAsText(file);
  
  // Reset file input
  event.target.value = '';
}

/**
 * Validate imported data structure
 * @param {Object} data - Imported data to validate
 * @returns {boolean} Whether data is valid
 */
function validateImportData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  // Check if it's a full export (has sync/local keys) or just advanced settings
  if (data.sync || data.local) {
    return true; // Full export structure
  }
  
  // Check if it has at least some valid advanced settings
  const hasValidSettings = Object.keys(DEFAULT_ADVANCED_SETTINGS).some(key => 
    data.hasOwnProperty(key)
  );
  
  return hasValidSettings;
}

/**
 * Import settings from parsed data
 * @param {Object} data - Validated settings data
 */
function importSettings(data) {
  let settingsToImport;
  
  // Determine data structure
  if (data.sync || data.local) {
    // Full export - import sync settings
    settingsToImport = data.sync || {};
  } else {
    // Advanced settings only
    settingsToImport = data;
  }
  
  // Only import recognized setting keys
  const KNOWN_KEYS = new Set([
    ...Object.keys(DEFAULT_ADVANCED_SETTINGS),
    'bionicIntensity', 'bionicCoverage', 'bionicEnabled', 'statsTrackingEnabled'
  ]);
  
  const validatedSettings = {};
  for (const key of Object.keys(settingsToImport)) {
    if (KNOWN_KEYS.has(key)) {
      validatedSettings[key] = settingsToImport[key];
    }
  }
  
  // Save to storage
  chrome.storage.sync.set(validatedSettings, () => {
    if (chrome.runtime.lastError) {
      showAlert('Error importing settings: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    
    showAlert('Settings imported successfully. Reloading...', 'success');
    
    // Reload UI after delay
    setTimeout(() => {
      loadSettings();
      updateStorageInfo();
    }, 1000);
    
    console.log('[Options] Settings imported:', validatedSettings);
  });
}

/**
 * Update storage information display
 */
function updateStorageInfo() {
  // Get sync storage
  chrome.storage.sync.get(null, (syncItems) => {
    if (chrome.runtime.lastError) {
      console.error('[Options] Error getting sync storage:', chrome.runtime.lastError);
      return;
    }
    
    const syncSize = new Blob([JSON.stringify(syncItems)]).size;
    elements.syncStorageUsed.textContent = syncSize.toLocaleString();
    
    // Get local storage
    chrome.storage.local.get(null, (localItems) => {
      if (chrome.runtime.lastError) {
        console.error('[Options] Error getting local storage:', chrome.runtime.lastError);
        return;
      }
      
      const localSize = new Blob([JSON.stringify(localItems)]).size;
      elements.localStorageUsed.textContent = localSize.toLocaleString();
      
      // Count settings
      const settingsCount = Object.keys(syncItems).length + Object.keys(localItems).length;
      elements.settingsCount.textContent = settingsCount;
    });
  });
}

/**
 * Show status alert
 * @param {string} message - Alert message
 * @param {string} type - Alert type ('success', 'error', 'info')
 */
function showAlert(message, type = 'info') {
  elements.statusAlert.textContent = message;
  elements.statusAlert.className = `alert alert-${type} show`;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.statusAlert.classList.remove('show');
  }, 5000);
}

/**
 * Debounce utility function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function loadTheme() {
  chrome.storage.sync.get({ popupTheme: 'ai' }, (result) => {
    const theme = result.popupTheme || 'ai';
    document.body.className = `theme-${theme}`;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    init();
  });
} else {
  if (typeof jest === 'undefined') {
    loadTheme();
    init();
  }
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateNumericInput,
    validateSkipSelectors,
    isValidCSSSelector,
    validateAllSettings,
    validateImportData,
    DEFAULT_ADVANCED_SETTINGS,
    VALIDATION_RULES
  };
}
