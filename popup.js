'use strict';

// Demo text used in popup preview
const DEMO_SAMPLE = 'Reading this demo text normally.';

// Return HTML string with simple bionic-style bolding based on intensity
function updateDemoHTML(text, intensity = 0.5) {
  if (!text) return '';
  const parts = text.split(/(\s+)/);
  function calcBoldCount(word) {
    const letters = (word.match(/[a-zA-Z]/g) || []).length;
    if (letters <= 1) return 0;
    const baseRatio = letters <= 3 ? 0.66 : 0.5;
    const scaled = Math.max(0.05, Math.min(0.95, baseRatio * (0.5 + (Number(intensity) || 0.5))));
    return Math.min(letters - 1, Math.ceil(letters * scaled));
  }

  return parts.map((part) => {
    if (/^\s+$/.test(part)) return part;
    let letterIndex = 0;
    const chars = part.split('');
    const boldCount = calcBoldCount(part);
    return chars.map(ch => {
      if (/[a-zA-Z]/.test(ch)) {
        const out = (letterIndex < boldCount) ? `<span class="demo-bold">${ch}</span>` : ch;
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

  // Enhanced content script injection with fallbacks
  function injectContentScript(tabId, callback) {
    status.textContent = '🔄 Setting up Bionic Reader...';
    
    // First try to inject the CSS
    chrome.scripting.insertCSS({
      target: { tabId: tabId, allFrames: true },
      files: ['bionic.css']
    }).then(() => {
      // Then inject the JavaScript
      return chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        files: ['content.js']
      });
    }).then(() => {
      // Give it a moment to initialize
      setTimeout(() => callback(true), 100);
    }).catch((error) => {
      console.error('Injection failed:', error);
      
      // Check if it's a permission issue
      if (error.message.includes('Cannot access') || error.message.includes('permission')) {
        status.innerHTML = '🔒 Permission denied<br><small>This page blocks extensions</small>';
        status.style.background = 'rgba(244,67,54,0.2)';
      } else if (error.message.includes('frame')) {
        status.innerHTML = '🖼️ Frame access blocked<br><small>Try refreshing the page</small>';
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
  
  // Show keyboard shortcut hint
  setTimeout(() => {
    if (status.textContent.includes('Ready to boost')) {
      status.innerHTML = '💫 Ready to boost your reading!<br><small>Click toggle or press Alt+B</small>';
    }
  }, 2000);

  // Intensity slider wiring
  const intensity = document.getElementById('intensity');
  const intensityValue = document.getElementById('intensityValue');

  function setIntensityLabel(v) {
    const pct = Math.round(v * 100);
    intensityValue.textContent = `${pct}%`;
  }

  // Demo element wiring
  const demoBionic = document.querySelector('.demo-bionic');
  const demoNormal = document.querySelector('.demo-normal');
  if (demoNormal) demoNormal.textContent = 'Normal: ' + DEMO_SAMPLE;
  if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTML(DEMO_SAMPLE, intensity.value || 0.5);

  // Load saved intensity
  chrome.storage.sync.get({ bionicIntensity: 0.5 }, (items) => {
    const v = Number(items.bionicIntensity) || 0.5;
    intensity.value = v;
    setIntensityLabel(v);
    // Inform content script of current intensity for active tab
    safeTabAccess((tab) => {
      chrome.runtime.sendMessage({ action: 'setIntensity', intensity: v }, (resp) => {
        // ignore errors - content script may not be injected yet
      });
    });
  });

  intensity.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    setIntensityLabel(v);
  // Live preview while sliding
  if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTML(DEMO_SAMPLE, v);
  });

  // Updated intensity change handler (call this in place of your previous handler)
  intensity.addEventListener('change', (e) => {
    const v = Number(e.target.value);
    // Persist the preference
    chrome.storage.sync.set({ bionicIntensity: v });

    // Ensure active tab is available and inject before messaging
    safeTabAccess((tab) => {
      if (!tab || !tab.id) return;
      ensureInjected(tab.id, 3, 150).then((injected) => {
          if (!injected) {
            console.warn('Could not inject content script; intensity will apply when page is toggled');
            // Friendly user-facing fallback
            status.innerHTML = '⚠️ Could not apply instantly<br><small>Will apply when you enable Bionic Reader or try again</small>';
            status.style.background = 'rgba(255,193,7,0.2)';
            return;
          }

        // Send intensity directly to the content script in that tab
        chrome.tabs.sendMessage(tab.id, { action: 'setIntensity', intensity: v }, (resp) => {
          if (chrome.runtime.lastError) {
            console.warn('Failed to send intensity to content script:', chrome.runtime.lastError.message);
          } else {
            // friendly feedback
            status.textContent = `Highlight intensity set: ${Math.round(v * 100)}%`;
            // update demo to reflect final value
            if (demoBionic) demoBionic.innerHTML = 'Bionic: ' + updateDemoHTML(DEMO_SAMPLE, v);
          }
        });
      });
    });
  });

  // Reset button
  const resetBtn = document.getElementById('resetBtn');
  resetBtn.addEventListener('click', () => {
    const defaultVal = 0.5;
    intensity.value = defaultVal;
    setIntensityLabel(defaultVal);
    chrome.storage.sync.set({ bionicIntensity: defaultVal }, () => {
      // Notify content script
      safeTabAccess((tab) => {
        chrome.runtime.sendMessage({ action: 'setIntensity', intensity: defaultVal }, () => {});
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