'use strict';

const DEBUG_MODE = false;

const logger = {
  debug: DEBUG_MODE ? console.log.bind(console) : () => {},
  info: DEBUG_MODE ? console.info.bind(console) : () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

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

const DEMO_SAMPLE = 'Reading this demo text normally.';

function updateDemoHTML(text, intensity = 0.5, coverage = undefined) {
  if (!text) return '';
  
  const hasCoverage = coverage != null;
  const weightSource = hasCoverage ? (Number(coverage) || 0.4) : (Number(intensity) || 0.5);
  const weight = Math.round(200 + (weightSource * 800));
  
  function calcBoldCount(word) {
    const letters = (word.match(/[a-zA-Z]/g) || []).length;
    if (letters <= 1) return 0;
    
    if (hasCoverage) {
      const cov = Math.max(0.05, Math.min(0.95, Number(coverage) || 0.4));
      return Math.min(letters - 1, Math.ceil(letters * cov));
    }
    
    const baseRatio = letters <= 3 ? 0.66 : 0.5;
    const multiplier = Math.max(0, Math.min(2, 0.5 + Number(intensity || 0.5)));
    const scaled = Math.max(0.05, Math.min(0.95, baseRatio * multiplier));
    return Math.min(letters - 1, Math.ceil(letters * scaled));
  }

  return text.split(/(\s+)/).map(part => {
    if (/^\s+$/.test(part)) return part;
    let letterIndex = 0;
    const boldCount = calcBoldCount(part);
    return part.split('').map(ch => {
      if (/[a-zA-Z]/.test(ch)) {
        const out = (letterIndex < boldCount) ? `<span class="demo-bold" style="font-weight:${weight}">${ch}</span>` : ch;
        letterIndex++;
        return out;
      }
      return ch;
    }).join('');
  }).join('');
}

const updateDemoHTMLWithCoverage = updateDemoHTML;

let importedEnsureInjected = null;
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  importedEnsureInjected = require('./src/popup-inject').ensureInjected;
} catch (err) {}

async function ensureInjected(tabId, attempts = 3, delayMs = 100) {
  if (importedEnsureInjected) return importedEnsureInjected(tabId, attempts, delayMs);
  for (let i = 0; i < attempts; i++) {
    try {
      if (!global.chrome || !global.chrome.scripting) throw new Error('scripting API not available');
      await global.chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['bionic.css'] });
      await global.chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
      return true;
    } catch (err) {
      if (i < attempts - 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  return false;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { updateDemoHTML, ensureInjected };
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
  
  const elements = {
    toggleSwitch: document.getElementById('toggleSwitch'),
    onText: document.getElementById('onText'),
    offText: document.getElementById('offText'),
    status: document.getElementById('status'),
    intensity: document.getElementById('intensity'),
    intensityValue: document.getElementById('intensityValue'),
    coverage: document.getElementById('coverage'),
    coverageValue: document.getElementById('coverageValue'),
    demoBionic: document.querySelector('.demo-bionic'),
    demoNormal: document.querySelector('.demo-normal'),
    statsEnabled: document.getElementById('statsEnabled'),
    statsContent: document.getElementById('statsContent'),
    statsDisabled: document.getElementById('statsDisabled'),
    wordsToday: document.getElementById('wordsToday'),
    timeToday: document.getElementById('timeToday'),
    timeSaved: document.getElementById('timeSaved'),
    resetBtn: document.getElementById('resetBtn'),
    helpLink: document.getElementById('helpLink'),
    siteSettings: document.getElementById('siteSettings'),
    siteName: document.getElementById('siteName'),
    clearSiteBtn: document.getElementById('clearSiteBtn'),
    themeSelector: document.getElementById('themeSelector')
  };
  
  function loadTheme() {
    chrome.storage.sync.get({ popupTheme: 'ai' }, (result) => {
      const theme = result.popupTheme || 'ai';
      applyTheme(theme);
      if (elements.themeSelector) {
        elements.themeSelector.value = theme;
      }
    });
  }

  function applyTheme(theme) {
    document.body.className = `theme-${theme}`;
  }

  function saveTheme(theme) {
    chrome.storage.sync.set({ popupTheme: theme }, () => {
      logger.debug('[Theme] Saved theme:', theme);
    });
  }

  loadTheme();

  if (elements.themeSelector) {
    elements.themeSelector.addEventListener('change', (e) => {
      const theme = e.target.value;
      applyTheme(theme);
      saveTheme(theme);
    });
  }
  
  const {
    toggleSwitch, onText, offText, status, intensity, intensityValue,
    coverage, coverageValue, demoBionic, demoNormal, statsEnabled,
    statsContent, statsDisabled, wordsToday, timeToday, timeSaved,
    resetBtn, helpLink, siteSettings, siteName, clearSiteBtn
  } = elements;

  if (toggleSwitch) {
    toggleSwitch.setAttribute('role', 'switch');
    toggleSwitch.setAttribute('aria-checked', 'false');
    toggleSwitch.setAttribute('aria-label', 'Toggle Bionic Reading mode');
    toggleSwitch.setAttribute('tabindex', '0');
  }
  
  if (status) {
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
  }
  
  if (demoBionic) {
    demoBionic.setAttribute('role', 'region');
    demoBionic.setAttribute('aria-label', 'Bionic reading preview');
  }

  function isRestrictedContext(url) {
    if (!url) return true;
    
    const restrictedPatterns = [
      'chrome://',
      'edge://',
      'chrome-extension://',
      'moz-extension://',
      'about:',
      'file://',
      'chrome-search://',
      'edge-search://',
      'microsoft-edge://',
      'devtools://'
    ];
    
    const readerModePatterns = [
      'read:',
      'reader:',
      '/reader',
      'readerview',
      'immersive-reader',
      'edge://read/',
      'chrome://read/',
      'reader-mode'
    ];
    
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('microsoft.com') && lowerUrl.includes('reader')) {
      return true;
    }
    
    return restrictedPatterns.some(pattern => lowerUrl.startsWith(pattern)) ||
           readerModePatterns.some(pattern => lowerUrl.includes(pattern));
  }

  function safeTabAccess(callback) {
    try {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (chrome.runtime.lastError) {
          logger.error('Tab query error:', chrome.runtime.lastError);
          status.textContent = 'Cannot access current tab';
          status.style.background = 'rgba(244,67,54,0.2)';
          return;
        }
        
        if (!tabs || !tabs[0]) {
          status.textContent = 'No active tab found';
          status.style.background = 'rgba(244,67,54,0.2)';
          return;
        }
        
        const tab = tabs[0];
        
        if (isRestrictedContext(tab.url)) {
          status.textContent = 'Not available in reader mode/browser pages';
          status.style.background = 'rgba(255,193,7,0.2)';
          toggleSwitch.style.opacity = '0.5';
          toggleSwitch.style.pointerEvents = 'none';
          
          if (tab.url && (tab.url.includes('read') || tab.url.includes('reader'))) {
            status.innerHTML = 'Reader mode detected<br><small>Try using Bionic Reader on the original page</small>';
          }
          return;
        }
        
        callback(tab);
      });
    } catch (error) {
      logger.error('Tab access error:', error);
      status.textContent = 'Unable to access this page';
      status.style.background = 'rgba(244,67,54,0.2)';
    }
  }

  function injectContentScript(tabId, callback) {
    status.textContent = 'Setting up Bionic Reader...';
    
    chrome.scripting.insertCSS({
      target: { tabId: tabId, allFrames: true },
      files: ['bionic.css']
    }).then(() => {
      return new Promise(resolve => setTimeout(resolve, 50));
    }).then(() => {
      return chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        files: ['content.js']
      });
    }).then(() => {
      return new Promise((resolve, reject) => {
        const maxRetries = 3;
        let retries = 0;
        
        function checkReady() {
          chrome.tabs.sendMessage(tabId, { action: 'getStatus' }, (response) => {
            if (chrome.runtime.lastError) {
              if (retries < maxRetries) {
                retries++;
                setTimeout(checkReady, 100);
              } else {
                reject(new Error('Content script not responding'));
              }
            } else {
              resolve();
            }
          });
        }
        
        checkReady();
      });
    }).then(() => {
      callback(true);
    }).catch((error) => {
      logger.error('Injection failed:', error);
      
      if (error.message.includes('Cannot access') || error.message.includes('permission')) {
        status.innerHTML = 'Permission denied<br><small>This page blocks extensions</small>';
        status.style.background = 'rgba(244,67,54,0.2)';
      } else if (error.message.includes('frame')) {
        status.innerHTML = 'Frame access blocked<br><small>Try refreshing the page</small>';
        status.style.background = 'rgba(255,193,7,0.2)';
      } else if (error.message.includes('not responding')) {
        status.textContent = 'Timeout. Try refreshing the page.';
        status.style.background = 'rgba(255,193,7,0.2)';
      } else {
        status.textContent = 'Failed to load. Try refreshing the page.';
        status.style.background = 'rgba(244,67,54,0.2)';
      }
      
      callback(false);
    });
  }

  function sendMessageToTab(tabId, message, callback) {
    chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (response) => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message;
        logger.debug('Message error:', error);
        
        if (error.includes('Receiving end does not exist') || 
            error.includes('Could not establish connection')) {
          
          injectContentScript(tabId, (success) => {
            if (success) {
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (retryResponse) => {
                  if (chrome.runtime.lastError) {
                    logger.error('Retry failed:', chrome.runtime.lastError);
                    callback(null, chrome.runtime.lastError);
                  } else {
                    callback(retryResponse, null);
                  }
                });
              }, 200);
            } else {
              callback(null, { message: 'Failed to inject content script' });
            }
          });
        } else if (error.includes('Cannot access')) {
          callback(null, { 
            message: 'Cannot access page contents', 
            type: 'permission' 
          });
        } else {
          callback(null, chrome.runtime.lastError);
        }
      } else {
        callback(response, null);
      }
    });
  }

  const AVG_WPM = 225;
  const IMPROVEMENT_RATE = 0.15;

  function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
  
  function estimateTimeSaved(wordsProcessed) {
    return Math.round(wordsProcessed * (60 / AVG_WPM) * IMPROVEMENT_RATE);
  }
  
  if (typeof global !== 'undefined') {
    global.formatTime = formatTime;
    global.estimateTimeSaved = estimateTimeSaved;
  }
  
  function loadAndDisplayStats(statsOn = true) {
    if (!chrome?.storage?.local) return;
    
    if (!statsOn) {
      if (statsContent) statsContent.style.display = 'none';
      if (statsDisabled) statsDisabled.style.display = 'block';
      return;
    }
    
    if (statsContent) statsContent.style.display = 'block';
    if (statsDisabled) statsDisabled.style.display = 'none';
    
    const today = new Date().toDateString();
    
    chrome.storage.local.get([today], (result) => {
      const todayStats = result[today] || { wordsProcessed: 0, activeTime: 0, sessions: 0 };
      if (wordsToday) wordsToday.textContent = todayStats.wordsProcessed.toLocaleString();
      if (timeToday) timeToday.textContent = formatTime(todayStats.activeTime);
      if (timeSaved) timeSaved.textContent = formatTime(estimateTimeSaved(todayStats.wordsProcessed) * 1000);
    });
  }

  safeTabAccess((tab) => {
    loadSiteSettingsUI(tab);
    
    sendMessageToTab(tab.id, {action: 'getStatus'}, (response, error) => {
      if (error) {
        if (error.type === 'permission') {
          status.innerHTML = 'Access restricted<br><small>This page blocks extensions</small>';
          status.style.background = 'rgba(244,67,54,0.2)';
        } else {
          status.textContent = 'Click to activate on this page';
          status.style.background = 'rgba(33,150,243,0.2)';
        }
        return;
      }
      
      if (response && response.enabled) {
        updateUI(true);
        status.textContent = 'Active - Reading at light speed!';
        status.style.background = 'rgba(76,175,80,0.2)';
      } else {
        status.textContent = 'Ready to boost your reading!';
        status.style.background = 'rgba(255,255,255,0.1)';
      }
    });
  });

  function updateUI(enabled) {
    if (enabled) {
      toggleSwitch.classList.add('active');
      onText.style.opacity = '1';
      offText.style.opacity = '0.5';
      toggleSwitch.setAttribute('aria-checked', 'true');
    } else {
      toggleSwitch.classList.remove('active');
      onText.style.opacity = '0.5';
      offText.style.opacity = '1';
      toggleSwitch.setAttribute('aria-checked', 'false');
    }
  }
  
  function loadSiteSettingsUI(tab) {
    if (!tab || !tab.url || !siteSettings) return;
    
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname;
      
      chrome.runtime.sendMessage({ action: 'hascustomsettings' }, (response) => {
        if (response && response.success && response.hasCustomSettings) {
          if (siteSettings) siteSettings.style.display = 'block';
          if (siteName) siteName.textContent = hostname;
        } else {
          if (siteSettings) siteSettings.style.display = 'none';
        }
      });
    } catch (e) {
      logger.error('Error loading site settings UI:', e);
      if (siteSettings) siteSettings.style.display = 'none';
    }
  }
  
  if (clearSiteBtn) {
    clearSiteBtn.addEventListener('click', () => {
      safeTabAccess((tab) => {
        chrome.runtime.sendMessage({ action: 'clearsitesettings' }, (response) => {
          if (response && response.success) {
            if (siteSettings) siteSettings.style.display = 'none';
            
            chrome.tabs.sendMessage(tab.id, { action: 'reloadsettings' }, () => {
              status.innerHTML = 'Reverted to global settings<br><small>Reload page to see changes</small>';
              status.style.background = 'rgba(76,175,80,0.2)';
            });
          } else {
            status.innerHTML = 'Failed to clear site settings';
            status.style.background = 'rgba(244,67,54,0.2)';
          }
        });
      });
    });
  }

  toggleSwitch.addEventListener('click', () => {
    if (toggleSwitch.style.pointerEvents === 'none') return;
    
    toggleSwitch.style.pointerEvents = 'none';
    
    safeTabAccess((tab) => {
      sendMessageToTab(tab.id, {action: 'toggle'}, (response, error) => {
        toggleSwitch.style.pointerEvents = 'auto';
        
        if (error) {
          if (error.type === 'permission') {
            status.innerHTML = 'Cannot modify this page<br><small>Permission denied by browser</small>';
            status.style.background = 'rgba(244,67,54,0.2)';
          } else {
            status.innerHTML = 'Activation failed<br><small>Try refreshing the page</small>';
            status.style.background = 'rgba(244,67,54,0.2)';
          }
          return;
        }
        
        if (response && !response.error) {
          updateUI(response.enabled);
          
          if (response.enabled) {
            status.textContent = 'Bionic mode activated!';
            status.style.background = 'rgba(76,175,80,0.2)';
            
            if (response.processedNodes) {
              status.innerHTML = `Active!<br><small>Processing ${response.processedNodes} text sections</small>`;
            }
          } else {
            status.textContent = 'Normal reading restored';
            status.style.background = 'rgba(33,150,243,0.2)';
          }
          
          chrome.storage.sync.set({bionicEnabled: response.enabled});
          
        } else {
          status.textContent = 'Something went wrong. Try again.';
          status.style.background = 'rgba(244,67,54,0.2)';
        }
      });
    });
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSwitch.click();
    }
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === toggleSwitch) {
      e.preventDefault();
      toggleSwitch.click();
    }
  });

  toggleSwitch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSwitch.click();
    }
  });
  
  // Show keyboard shortcut hint
  setTimeout(() => {
    if (status.textContent.includes('Ready to boost')) {
      status.innerHTML = 'Ready to boost your reading!<br><small>Click toggle or press Alt+B</small>';
    }
  }, 2000);

  intensity.setAttribute('role', 'slider');
  intensity.setAttribute('aria-valuemin', '0');
  intensity.setAttribute('aria-valuemax', '1');
  intensity.setAttribute('aria-valuenow', intensity.value);
  intensity.setAttribute('aria-valuetext', `${Math.round(intensity.value * 100)} percent`);
  intensity.setAttribute('aria-label', 'Text highlight intensity percentage');
  
  if (coverage) {
    coverage.setAttribute('role', 'slider');
    coverage.setAttribute('aria-valuemin', '0');
    coverage.setAttribute('aria-valuemax', '1');
    coverage.setAttribute('aria-valuenow', coverage.value);
    coverage.setAttribute('aria-valuetext', `${Math.round(coverage.value * 100)} percent`);
    coverage.setAttribute('aria-label', 'Text highlight coverage percentage');
  }

  function setIntensityLabel(v) {
    const pct = Math.round(v * 100);
    intensityValue.textContent = `${pct}%`;
    if (intensity) {
      intensity.setAttribute('aria-valuenow', String(v));
      intensity.setAttribute('aria-valuetext', `${pct} percent`);
    }
  }

  function setCoverageLabel(v) {
    const pct = Math.round(v * 100);
    if (coverageValue) coverageValue.textContent = `${pct}%`;
    if (coverage) {
      coverage.setAttribute('aria-valuenow', String(v));
      coverage.setAttribute('aria-valuetext', `${pct} percent`);
    }
  }

  if (demoNormal) demoNormal.textContent = 'Normal: ' + DEMO_SAMPLE;
  if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTML(DEMO_SAMPLE, intensity.value || 0.5, coverage ? coverage.value : 0.4);

  const _requestRaf = (typeof requestAnimationFrame !== 'undefined') ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
  const _cancelRaf = (typeof cancelAnimationFrame !== 'undefined') ? cancelAnimationFrame : (id) => clearTimeout(id);
  let _demoRafId = null;
  let _pendingDemoValue = null;
  const PREFERS_REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function scheduleDemoUpdate(v) {
    _pendingDemoValue = v;
    if (PREFERS_REDUCED_MOTION) {
      if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTML(DEMO_SAMPLE, _pendingDemoValue || 0.5, coverage ? coverage.value : 0.4);
      _pendingDemoValue = null;
      return;
    }
    if (_demoRafId != null) return;
    _demoRafId = _requestRaf(() => {
      try {
        if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTML(DEMO_SAMPLE, _pendingDemoValue || 0.5, coverage ? coverage.value : 0.4);
      } finally {
        _demoRafId = null;
        _pendingDemoValue = null;
      }
    });
  }

  chrome.storage.sync.get({ 
    bionicIntensity: 0.5, 
    bionicCoverage: 0.4, 
    statsTrackingEnabled: true 
  }, (items) => {
    const v = Number(items.bionicIntensity) || 0.5;
    const c = Number(items.bionicCoverage) || 0.4;
    const statsTracking = Boolean(items.statsTrackingEnabled);
    
    intensity.value = v;
    setIntensityLabel(v);
    updateSliderProgress(v);
    
    if (coverage) {
      coverage.value = c;
      setCoverageLabel(c);
    }
    
    if (statsEnabled) {
      statsEnabled.checked = statsTracking;
      loadAndDisplayStats(statsTracking);
    }
    
    safeTabAccess((tab) => {
      chrome.runtime.sendMessage({ 
        action: 'setIntensity', 
        intensity: v, 
        coverage: c,
        statsEnabled: statsTracking 
      }, (resp) => {});
    });
  });

  if (statsEnabled) {
    statsEnabled.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      chrome.storage.sync.set({ statsTrackingEnabled: enabled });
      
      loadAndDisplayStats(enabled);
      
      safeTabAccess((tab) => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'setStatsEnabled', 
          statsEnabled: enabled 
        }, () => {});
      });
    });
  }

  if (chrome?.storage?.local) {
    setInterval(() => {
      if (statsEnabled && statsEnabled.checked) {
        loadAndDisplayStats(true);
      }
    }, 30000);
  }

  function updateSliderProgress(value) {
    const percentage = value * 100;
    intensity.style.setProperty('--value', `${percentage}%`);
  }

  intensity.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    setIntensityLabel(v);
    updateSliderProgress(v);
  });

  const debouncedIntensitySave = debounce((value) => {
    chrome.storage.sync.set({ bionicIntensity: value });
    
    safeTabAccess((tab) => {
      if (!tab || !tab.id) return;
      
      chrome.runtime.sendMessage({ action: 'hascustomsettings' }, (response) => {
        if (response && response.success && response.hasCustomSettings) {
          chrome.runtime.sendMessage({
            action: 'setsitesettings',
            intensity: value,
            coverage: Number(coverage?.value || 0.4)
          });
        }
      });
      
      sendMessageToTab(tab.id, { action: 'getStatus' }, (response) => {
        if (response && response.enabled) {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'setIntensity', 
            intensity: value,
            coverage: Number(coverage?.value || 0.4)
          });
        }
      });
    });
  }, 300);

  intensity.addEventListener('change', (e) => {
    const v = Number(e.target.value);
    updateSliderProgress(v);
    
    scheduleDemoUpdate(v);
    
    debouncedIntensitySave(v);
  });

  if (coverage) {
    coverage.addEventListener('input', (e) => {
      const c = Number(e.target.value);
      setCoverageLabel(c);
      if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTMLWithCoverage(DEMO_SAMPLE, Number(intensity.value || 0.5), c);
    });
  }


  if (coverage) {
    coverage.addEventListener('change', (e) => {
      const c = Number(e.target.value);
      chrome.storage.sync.set({ bionicCoverage: c });
      safeTabAccess((tab) => {
        if (!tab || !tab.id) return;
        sendMessageToTab(tab.id, { action: 'getStatus' }, (response, error) => {
          if (response && response.enabled) {
            chrome.tabs.sendMessage(tab.id, { action: 'setIntensity', intensity: Number(intensity.value || 0.5), coverage: c }, () => {});
            status.textContent = `Highlight coverage set: ${Math.round(c * 100)}%`;
          } else {
            status.textContent = `Coverage set: ${Math.round(c * 100)}% (activate to apply)`;
          }
        });
      });
    });
  }

  resetBtn.addEventListener('click', () => {
    const defaultVal = 0.5;
    intensity.value = defaultVal;
    setIntensityLabel(defaultVal);
    updateSliderProgress(defaultVal);
    chrome.storage.sync.set({ bionicIntensity: defaultVal }, () => {
        safeTabAccess((tab) => {
        chrome.runtime.sendMessage({ action: 'setIntensity', intensity: defaultVal, coverage: Number(coverage ? coverage.value : 0.4) }, () => {});
      });
    });
    status.textContent = 'Reset to default intensity';
  });

  helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/Awesome-XV/Bionic-Reader#privacy' });
  });
  
  const optionsBtn = document.getElementById('optionsBtn');
  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
  });
}