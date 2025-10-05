'use strict';

// Debounce utility function
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

// Demo text used in popup preview
const DEMO_SAMPLE = 'Reading this demo text normally.';

// Return HTML string with simple bionic-style bolding based on intensity
function updateDemoHTML(text, intensity = 0.5, coverage = undefined) {
  if (!text) return '';
  const parts = text.split(/(\s+)/);
  function calcBoldCount(word, intensity = 0.5) {
    const letters = (word.match(/[a-zA-Z]/g) || []).length;
    if (letters <= 1) return 0;
    // Small words keep a larger ratio; longer words use a smaller prefix.
    const baseRatio = letters <= 3 ? 0.66 : 0.5;
    // Scale by intensity so popup preview matches content script behavior
    const multiplier = Math.max(0, Math.min(2, 0.5 + Number(intensity || 0.5)));
    const scaled = Math.max(0.05, Math.min(0.95, baseRatio * multiplier));
    return Math.min(letters - 1, Math.ceil(letters * scaled));
  }

  // Decide weight source: if coverage is provided, use it; otherwise fall back to intensity
  const weightSource = (typeof coverage === 'undefined' || coverage === null) ? (Number(intensity) || 0.5) : (Number(coverage) || 0.4);
  const weight = Math.round(200 + (weightSource * 800));

  return parts.map((part) => {
    if (/^\s+$/.test(part)) return part;
    let letterIndex = 0;
    const chars = part.split('');
  const boldCount = calcBoldCount(part, intensity);
    return chars.map(ch => {
      if (/[a-zA-Z]/.test(ch)) {
        const out = (letterIndex < boldCount) ? `<span class="demo-bold" style="font-weight:${weight}">${ch}</span>` : ch;
        letterIndex++;
        return out;
      }
      return ch;
    }).join('');
  }).join('');
}

// Demo-only helper: allow coverage override when previewing in popup
function updateDemoHTMLWithCoverage(text, intensity = 0.5, coverage = undefined) {
  if (!text) return '';
  const parts = text.split(/(\s+)/);

  function calcBoldCountWithCoverage(word, intensity = 0.5) {
    const letters = (word.match(/[a-zA-Z]/g) || []).length;
    if (letters <= 1) return 0;
    if (coverage == null) {
      const baseRatio = letters <= 3 ? 0.66 : 0.5;
      const multiplier = Math.max(0, Math.min(2, 0.5 + Number(intensity || 0.5)));
      const scaled = Math.max(0.05, Math.min(0.95, baseRatio * multiplier));
      return Math.min(letters - 1, Math.ceil(letters * scaled));
    }
    // coverage is a fraction 0..1 representing portion to bold
    const cov = Math.max(0.05, Math.min(0.95, Number(coverage) || 0.4));
    return Math.min(letters - 1, Math.ceil(letters * cov));
  }

  const weightSource = (typeof coverage === 'undefined' || coverage === null) ? (Number(intensity) || 0.5) : (Number(coverage) || 0.4);
  const weight = Math.round(200 + (weightSource * 800));

  return parts.map((part) => {
    if (/^\s+$/.test(part)) return part;
    let letterIndex = 0;
    const chars = part.split('');
  const boldCount = calcBoldCountWithCoverage(part, intensity);
    return chars.map(ch => {
      if (/[a-zA-Z]/.test(ch)) {
        const out = (letterIndex < boldCount) ? `<span class="demo-bold" style="font-weight:${weight}">${ch}</span>` : ch;
        letterIndex++;
        return out;
      }
      return ch;
    }).join('');
  }).join('');
}
// When running in a test/Node environment, avoid running DOM code on require.
// Also try to reuse the shared `ensureInjected` helper from `src/popup-inject.js`
let importedEnsureInjected = null;
try {
  // require relative to this file
  // eslint-disable-next-line global-require, import/no-unresolved
  importedEnsureInjected = require('./src/popup-inject').ensureInjected;
} catch (err) {
  // not available in browser or when not running tests; fall back to local implementation
}
// Top-level ensureInjected used by tests or popup UI. Prefer imported helper when available.
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
        // short backoff
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  return false;
}
// Export for tests when required by Node immediately (ensureInjected is available on require)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { updateDemoHTML, ensureInjected };
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const onText = document.getElementById('onText');
  const offText = document.getElementById('offText');
  const status = document.getElementById('status');

  // Check if we're in a restricted context
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
    
    // Check for reader mode URLs (Edge's immersive reader and other reader modes)
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
    
    // Check for Edge's specific reader mode URL pattern
    if (lowerUrl.includes('microsoft.com') && lowerUrl.includes('reader')) {
      return true;
    }
    
    return restrictedPatterns.some(pattern => lowerUrl.startsWith(pattern)) ||
           readerModePatterns.some(pattern => lowerUrl.includes(pattern));
  }

  // Enhanced tab access with better error handling
  function safeTabAccess(callback) {
    try {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Tab query error:', chrome.runtime.lastError);
          status.textContent = '❌ Cannot access current tab';
          status.style.background = 'rgba(244,67,54,0.2)';
          return;
        }
        
        if (!tabs || !tabs[0]) {
          status.textContent = '❌ No active tab found';
          status.style.background = 'rgba(244,67,54,0.2)';
          return;
        }
        
        const tab = tabs[0];
        
        // Check for restricted contexts
        if (isRestrictedContext(tab.url)) {
          status.textContent = '⚠️ Not available in reader mode/browser pages';
          status.style.background = 'rgba(255,193,7,0.2)';
          toggleSwitch.style.opacity = '0.5';
          toggleSwitch.style.pointerEvents = 'none';
          
          // Add helpful tip for reader mode
          if (tab.url && (tab.url.includes('read') || tab.url.includes('reader'))) {
            status.innerHTML = '📖 Reader mode detected<br><small>Try using Bionic Reader on the original page</small>';
          }
          return;
        }
        
        callback(tab);
      });
    } catch (error) {
      console.error('Tab access error:', error);
      status.textContent = '❌ Unable to access this page';
      status.style.background = 'rgba(244,67,54,0.2)';
    }
  }

  // Enhanced content script injection with synchronization and verification
  function injectContentScript(tabId, callback) {
    status.textContent = '🔄 Setting up Bionic Reader...';
    
    // Step 1: Inject CSS
    chrome.scripting.insertCSS({
      target: { tabId: tabId, allFrames: true },
      files: ['bionic.css']
    }).then(() => {
      // Step 2: Wait for CSS to be applied (prevents FOUC)
      return new Promise(resolve => setTimeout(resolve, 50));
    }).then(() => {
      // Step 3: Inject JavaScript
      return chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        files: ['content.js']
      });
    }).then(() => {
      // Step 4: Verify content script is ready
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
      console.error('Injection failed:', error);
      
      // Check if it's a permission issue
      if (error.message.includes('Cannot access') || error.message.includes('permission')) {
        status.innerHTML = '🔒 Permission denied<br><small>This page blocks extensions</small>';
        status.style.background = 'rgba(244,67,54,0.2)';
      } else if (error.message.includes('frame')) {
        status.innerHTML = '🖼️ Frame access blocked<br><small>Try refreshing the page</small>';
        status.style.background = 'rgba(255,193,7,0.2)';
      } else if (error.message.includes('not responding')) {
        status.textContent = '⏱️ Timeout. Try refreshing the page.';
        status.style.background = 'rgba(255,193,7,0.2)';
      } else {
        status.textContent = '❌ Failed to load. Try refreshing the page.';
        status.style.background = 'rgba(244,67,54,0.2)';
      }
      
      callback(false);
    });
  }

  // Ensure content script + CSS are injected into the tab; uses top-level ensureInjected

  // Enhanced message sending with better error handling
  function sendMessageToTab(tabId, message, callback) {
    chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (response) => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message;
        console.log('Message error:', error);
        
        // Check if content script needs to be injected
        if (error.includes('Receiving end does not exist') || 
            error.includes('Could not establish connection')) {
          
          injectContentScript(tabId, (success) => {
            if (success) {
              // Retry the message after injection
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (retryResponse) => {
                  if (chrome.runtime.lastError) {
                    console.error('Retry failed:', chrome.runtime.lastError);
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

  // Statistics helper functions
  function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }
  
  function estimateTimeSaved(wordsProcessed) {
    // Research suggests bionic reading can improve speed by 10-20%
    // Average reading speed is 200-250 WPM, so time saved per word is roughly 0.01-0.02 seconds
    const secondsPerWord = 60 / 225; // 225 WPM average
    const improvementRate = 0.15; // 15% improvement estimate
    return Math.round(wordsProcessed * secondsPerWord * improvementRate);
  }
  
  // Export functions for testing
  if (typeof global !== 'undefined') {
    global.formatTime = formatTime;
    global.estimateTimeSaved = estimateTimeSaved;
  }
  
  function loadAndDisplayStats(statsEnabled = true) {
    // Skip stats loading if chrome.storage is not available (e.g., in tests)
    if (!chrome?.storage?.local) {
      return;
    }
    
    const statsContent = document.getElementById('statsContent');
    const statsDisabled = document.getElementById('statsDisabled');
    
    if (!statsEnabled) {
      if (statsContent) statsContent.style.display = 'none';
      if (statsDisabled) statsDisabled.style.display = 'block';
      return;
    }
    
    if (statsContent) statsContent.style.display = 'block';
    if (statsDisabled) statsDisabled.style.display = 'none';
    
    const today = new Date().toDateString();
    
    chrome.storage.local.get([today], (result) => {
      const todayStats = result[today] || { wordsProcessed: 0, activeTime: 0, sessions: 0 };
      
      const wordsElement = document.getElementById('wordsToday');
      const timeElement = document.getElementById('timeToday');
      const savedElement = document.getElementById('timeSaved');
      
      if (wordsElement) wordsElement.textContent = todayStats.wordsProcessed.toLocaleString();
      if (timeElement) timeElement.textContent = formatTime(todayStats.activeTime);
      if (savedElement) savedElement.textContent = formatTime(estimateTimeSaved(todayStats.wordsProcessed) * 1000);
    });
  }

  // Get current status with enhanced error handling
  safeTabAccess((tab) => {
    sendMessageToTab(tab.id, {action: 'getStatus'}, (response, error) => {
      if (error) {
        if (error.type === 'permission') {
          status.innerHTML = '🔒 Access restricted<br><small>This page blocks extensions</small>';
          status.style.background = 'rgba(244,67,54,0.2)';
        } else {
          status.textContent = '🔄 Click to activate on this page';
          status.style.background = 'rgba(33,150,243,0.2)';
        }
        return;
      }
      
      if (response && response.enabled) {
        updateUI(true);
        status.textContent = '✅ Active - Reading at light speed!';
        status.style.background = 'rgba(76,175,80,0.2)';
      } else {
        status.textContent = '💫 Ready to boost your reading!';
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

  // Enhanced toggle with better feedback
  toggleSwitch.addEventListener('click', () => {
    if (toggleSwitch.style.pointerEvents === 'none') return;
    
    // Disable the toggle temporarily to prevent double-clicks
    toggleSwitch.style.pointerEvents = 'none';
    
    safeTabAccess((tab) => {
      sendMessageToTab(tab.id, {action: 'toggle'}, (response, error) => {
        // Re-enable the toggle
        toggleSwitch.style.pointerEvents = 'auto';
        
        if (error) {
          if (error.type === 'permission') {
            status.innerHTML = '🔒 Cannot modify this page<br><small>Permission denied by browser</small>';
            status.style.background = 'rgba(244,67,54,0.2)';
          } else {
            status.innerHTML = '❌ Activation failed<br><small>Try refreshing the page</small>';
            status.style.background = 'rgba(244,67,54,0.2)';
          }
          return;
        }
        
        if (response && !response.error) {
          updateUI(response.enabled);
          
          if (response.enabled) {
            status.textContent = '🚀 Bionic mode activated!';
            status.style.background = 'rgba(76,175,80,0.2)';
            
            // Show processing info if available
            if (response.processedNodes) {
              status.innerHTML = `🚀 Active!<br><small>Processing ${response.processedNodes} text sections</small>`;
            }
          } else {
            status.textContent = 'ℹ️ Normal reading restored';
            status.style.background = 'rgba(33,150,243,0.2)';
          }
          
          // Save state
          chrome.storage.sync.set({bionicEnabled: response.enabled});
          
        } else {
          status.textContent = '❌ Something went wrong. Try again.';
          status.style.background = 'rgba(244,67,54,0.2)';
        }
      });
    });
  });
  
  // Add keyboard shortcut (Alt+B)
  document.addEventListener('keydown', (e) => {
    // Alt+B hint kept for quick access in popup
    if (e.altKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSwitch.click();
    }
    // Allow Enter/Space to toggle when the switch is focused
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === toggleSwitch) {
      e.preventDefault();
      toggleSwitch.click();
    }
  });

  // Also handle keydown directly on the switch for robustness
  toggleSwitch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSwitch.click();
    }
  });
  
  // Show keyboard shortcut hint
  setTimeout(() => {
    if (status.textContent.includes('Ready to boost')) {
      status.innerHTML = '💫 Ready to boost your reading!<br><small>Click toggle or press Alt+B</small>';
    }
  }, 2000);

  // Intensity slider wiring
  const intensity = document.getElementById('intensity');
  const intensityValue = document.getElementById('intensityValue');
  const coverage = document.getElementById('coverage');
  const coverageValue = document.getElementById('coverageValue');
  // ARIA attributes for the range control
  intensity.setAttribute('role', 'slider');
  intensity.setAttribute('aria-valuemin', '0');
  intensity.setAttribute('aria-valuemax', '1');
  intensity.setAttribute('aria-valuenow', intensity.value);
  intensity.setAttribute('aria-label', 'Highlight intensity');
  // Coverage slider ARIA
  if (coverage) {
    coverage.setAttribute('role', 'slider');
    coverage.setAttribute('aria-valuemin', '0');
    coverage.setAttribute('aria-valuemax', '1');
    coverage.setAttribute('aria-valuenow', coverage.value);
    coverage.setAttribute('aria-label', 'Highlight coverage');
  }

  function setIntensityLabel(v) {
    const pct = Math.round(v * 100);
    intensityValue.textContent = `${pct}%`;
  // Update ARIA current value for screen readers
  if (intensity) intensity.setAttribute('aria-valuenow', String(v));
  }

  function setCoverageLabel(v) {
    const pct = Math.round(v * 100);
    if (coverageValue) coverageValue.textContent = `${pct}%`;
    if (coverage) coverage.setAttribute('aria-valuenow', String(v));
  }

  // Demo element wiring
  const demoBionic = document.querySelector('.demo-bionic');
  const demoNormal = document.querySelector('.demo-normal');
  if (demoNormal) demoNormal.textContent = 'Normal: ' + DEMO_SAMPLE;
  // Use stored coverage when rendering demo preview if available
  if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTML(DEMO_SAMPLE, intensity.value || 0.5, coverage ? coverage.value : 0.4);

  // Throttled demo updater using requestAnimationFrame (with setTimeout fallback)
  const _requestRaf = (typeof requestAnimationFrame !== 'undefined') ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
  const _cancelRaf = (typeof cancelAnimationFrame !== 'undefined') ? cancelAnimationFrame : (id) => clearTimeout(id);
  let _demoRafId = null;
  let _pendingDemoValue = null;
  // Respect prefers-reduced-motion: avoid scheduling RAF-driven updates if user prefers reduced motion
  const PREFERS_REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function scheduleDemoUpdate(v) {
    _pendingDemoValue = v;
    if (PREFERS_REDUCED_MOTION) {
      // Apply immediately without animation/RAF
      if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTML(DEMO_SAMPLE, _pendingDemoValue || 0.5, coverage ? coverage.value : 0.4);
      _pendingDemoValue = null;
      return;
    }
    if (_demoRafId != null) return; // already scheduled
    _demoRafId = _requestRaf(() => {
      try {
        if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTML(DEMO_SAMPLE, _pendingDemoValue || 0.5, coverage ? coverage.value : 0.4);
      } finally {
        _demoRafId = null;
        _pendingDemoValue = null;
      }
    });
  }

  // Statistics toggle handling
  const statsEnabled = document.getElementById('statsEnabled');
  
  // Load saved settings including statistics preference
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
    
    if (coverage) {
      coverage.value = c;
      setCoverageLabel(c);
    }
    
    if (statsEnabled) {
      statsEnabled.checked = statsTracking;
      loadAndDisplayStats(statsTracking);
    }
    
    // Inform content script of current intensity/coverage for active tab
    safeTabAccess((tab) => {
      chrome.runtime.sendMessage({ 
        action: 'setIntensity', 
        intensity: v, 
        coverage: c,
        statsEnabled: statsTracking 
      }, (resp) => {
        // ignore errors - content script may not be injected yet
      });
    });
  });

  // Statistics toggle event listener
  if (statsEnabled) {
    statsEnabled.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      chrome.storage.sync.set({ statsTrackingEnabled: enabled });
      
      loadAndDisplayStats(enabled);
      
      // Notify content script about stats preference change
      safeTabAccess((tab) => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'setStatsEnabled', 
          statsEnabled: enabled 
        }, () => {
          // Ignore errors - content script may not be injected
        });
      });
    });
  }

  // Refresh stats every 30 seconds if popup is open and stats are enabled
  if (chrome?.storage?.local) {
    setInterval(() => {
      if (statsEnabled && statsEnabled.checked) {
        loadAndDisplayStats(true);
      }
    }, 30000);
  }

  // Intensity slider with immediate visual feedback but debounced network calls
  let demoUpdatePending = false;

  intensity.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    setIntensityLabel(v);
    
    // Immediate visual feedback in demo (throttled to prevent jank)
    if (!demoUpdatePending) {
      demoUpdatePending = true;
      scheduleDemoUpdate(v);
      setTimeout(() => { demoUpdatePending = false; }, 50);
    }
  });

  // Debounced save to storage and content script
  const debouncedIntensitySave = debounce((value) => {
    chrome.storage.sync.set({ bionicIntensity: value });
    
    safeTabAccess((tab) => {
      if (!tab || !tab.id) return;
      
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
    debouncedIntensitySave(Number(e.target.value));
  });

  // Coverage live preview
  if (coverage) {
    coverage.addEventListener('input', (e) => {
      const c = Number(e.target.value);
      setCoverageLabel(c);
      // Update demo preview using coverage by temporarily passing a combined param
      // Note: updateDemoHTML currently accepts intensity; we'll use a small wrapper
      if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTMLWithCoverage(DEMO_SAMPLE, Number(intensity.value || 0.5), c);
    });
  }


  // Coverage change handler
  if (coverage) {
    coverage.addEventListener('change', (e) => {
      const c = Number(e.target.value);
      chrome.storage.sync.set({ bionicCoverage: c });
      safeTabAccess((tab) => {
        if (!tab || !tab.id) return;
        // If active, send coverage update to content script
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

  // Reset button
  const resetBtn = document.getElementById('resetBtn');
  resetBtn.addEventListener('click', () => {
    const defaultVal = 0.5;
    intensity.value = defaultVal;
    setIntensityLabel(defaultVal);
    chrome.storage.sync.set({ bionicIntensity: defaultVal }, () => {
      // Notify content script
        safeTabAccess((tab) => {
        chrome.runtime.sendMessage({ action: 'setIntensity', intensity: defaultVal, coverage: Number(coverage ? coverage.value : 0.4) }, () => {});
      });
    });
    status.textContent = '✨ Reset to default intensity';
  });

  // Help link (opens Terms file in a new tab if possible)
  const helpLink = document.getElementById('helpLink');
  helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Try to open the local terms file if packaged; otherwise open repo README
    chrome.tabs.create({ url: 'https://github.com/Awesome-XV/Bionic-Reader#privacy' });
  });
});
  // Expose test-hooks when required by Node tests
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateDemoHTML, ensureInjected };
  }
}