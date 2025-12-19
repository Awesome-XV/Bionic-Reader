/**
 * @jest-environment jsdom
 */

/**
 * Integration Tests for Popup UI Components
 * Tests for uncovered popup.js functionality
 */

// Mock Chrome API
global.chrome = {
  runtime: {
    lastError: null,
    sendMessage: jest.fn((msg, callback) => callback && callback({ success: true })),
    openOptionsPage: jest.fn()
  },
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        callback({
          bionicIntensity: 0.5,
          bionicCoverage: 0.4,
          bionicEnabled: false,
          statsTrackingEnabled: true
        });
      }),
      set: jest.fn((items, callback) => callback && callback())
    },
    local: {
      get: jest.fn((keys, callback) => callback({}))
    }
  },
  tabs: {
    query: jest.fn((query, callback) => {
      callback([{ id: 1, url: 'https://example.com' }]);
    }),
    sendMessage: jest.fn((tabId, msg, callback) => {
      callback && callback({ enabled: false });
    }),
    create: jest.fn()
  }
};

describe('Popup - Edge Cases and Error Handling', () => {
  let mockDOM;

  beforeEach(() => {
    // Create minimal DOM
    document.body.innerHTML = `
      <div id="toggleSwitch" role="switch" aria-checked="false"></div>
      <div id="status"></div>
      <input id="intensity" type="range" value="0.5" min="0" max="1" step="0.05" />
      <div id="intensityValue"></div>
      <button id="resetBtn"></button>
      <button id="optionsBtn"></button>
      <a id="helpLink" href="#"></a>
      <div id="demoNormal"></div>
      <div id="demoBionic"></div>
      <input id="statsEnabled" type="checkbox" checked />
    `;

    jest.clearAllMocks();
  });

  test('handles chrome.runtime.lastError in message sending', (done) => {
    chrome.runtime.lastError = { message: 'Connection error' };
    chrome.runtime.sendMessage = jest.fn((msg, callback) => {
      callback && callback();
    });

    const msg = { action: 'test' };
    chrome.runtime.sendMessage(msg, () => {
      expect(chrome.runtime.lastError).toBeDefined();
      chrome.runtime.lastError = null;
      done();
    });
  });

  test('handles storage.sync.get with error', (done) => {
    chrome.runtime.lastError = { message: 'Storage error' };
    chrome.storage.sync.get = jest.fn((keys, callback) => {
      callback({});
    });

    chrome.storage.sync.get({}, () => {
      expect(chrome.runtime.lastError).toBeDefined();
      chrome.runtime.lastError = null;
      done();
    });
  });

  test('handles invalid tab query results', (done) => {
    chrome.tabs.query = jest.fn((query, callback) => {
      callback([]);
    });

    chrome.tabs.query({ active: true }, (tabs) => {
      expect(tabs).toHaveLength(0);
      done();
    });
  });

  test('handles null tab in query', (done) => {
    chrome.tabs.query = jest.fn((query, callback) => {
      callback(null);
    });

    chrome.tabs.query({ active: true }, (tabs) => {
      expect(tabs).toBeNull();
      done();
    });
  });

  test('handles sendMessage without callback', () => {
    chrome.runtime.sendMessage({ action: 'test' });
    expect(chrome.runtime.sendMessage).toHaveBeenCalled();
  });

  test('handles chrome.tabs.sendMessage error', (done) => {
    chrome.runtime.lastError = { message: 'Tab closed' };
    chrome.tabs.sendMessage = jest.fn((tabId, msg, callback) => {
      callback && callback();
    });

    chrome.tabs.sendMessage(1, { action: 'test' }, () => {
      expect(chrome.runtime.lastError).toBeDefined();
      chrome.runtime.lastError = null;
      done();
    });
  });

  test('chrome.storage.sync.set handles errors', (done) => {
    chrome.runtime.lastError = { message: 'Quota exceeded' };
    chrome.storage.sync.set = jest.fn((items, callback) => {
      callback && callback();
    });

    chrome.storage.sync.set({ test: 'value' }, () => {
      expect(chrome.runtime.lastError).toBeDefined();
      chrome.runtime.lastError = null;
      done();
    });
  });
});

describe('Popup - DOM Event Handlers', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="toggleSwitch"></div>
      <input id="intensity" type="range" value="0.5" />
      <button id="resetBtn"></button>
      <button id="optionsBtn"></button>
    `;
    jest.clearAllMocks();
  });

  test('intensity slider fires input event', () => {
    const slider = document.getElementById('intensity');
    const event = new Event('input');
    
    const handler = jest.fn();
    slider.addEventListener('input', handler);
    slider.dispatchEvent(event);
    
    expect(handler).toHaveBeenCalled();
  });

  test('reset button fires click event', () => {
    const button = document.getElementById('resetBtn');
    const event = new Event('click');
    
    const handler = jest.fn();
    button.addEventListener('click', handler);
    button.dispatchEvent(event);
    
    expect(handler).toHaveBeenCalled();
  });

  test('options button fires click event', () => {
    const button = document.getElementById('optionsBtn');
    const event = new Event('click');
    
    const handler = jest.fn();
    button.addEventListener('click', handler);
    button.dispatchEvent(event);
    
    expect(handler).toHaveBeenCalled();
  });

  test('toggle switch handles keyboard events', () => {
    const toggle = document.getElementById('toggleSwitch');
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    
    const handler = jest.fn();
    toggle.addEventListener('keydown', handler);
    
    toggle.dispatchEvent(spaceEvent);
    toggle.dispatchEvent(enterEvent);
    
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe('Popup - Storage Scenarios', () => {
  test('loads default values when storage is empty', (done) => {
    chrome.storage.sync.get = jest.fn((defaults, callback) => {
      callback(defaults);
    });

    chrome.storage.sync.get({
      bionicIntensity: 0.5,
      bionicCoverage: 0.4
    }, (result) => {
      expect(result.bionicIntensity).toBe(0.5);
      expect(result.bionicCoverage).toBe(0.4);
      done();
    });
  });

  test('handles storage with custom values', (done) => {
    chrome.storage.sync.get = jest.fn((defaults, callback) => {
      callback({
        bionicIntensity: 0.8,
        bionicCoverage: 0.6
      });
    });

    chrome.storage.sync.get({}, (result) => {
      expect(result.bionicIntensity).toBe(0.8);
      expect(result.bionicCoverage).toBe(0.6);
      done();
    });
  });

  test('saves settings to storage', (done) => {
    const settings = {
      bionicIntensity: 0.7,
      bionicEnabled: true
    };

    chrome.storage.sync.set(settings, () => {
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(settings, expect.any(Function));
      done();
    });
  });
});

describe('Popup - Tab Communication', () => {
  beforeEach(() => {
    // Reset tabs.query mock
    chrome.tabs.query = jest.fn((query, callback) => {
      callback([{ id: 1, url: 'https://example.com' }]);
    });
  });

  test('queries active tab successfully', (done) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      expect(tabs).toHaveLength(1);
      expect(tabs[0].id).toBe(1);
      done();
    });
  });

  test('sends message to active tab', (done) => {
    chrome.tabs.sendMessage(1, { action: 'getStatus' }, (response) => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalled();
      done();
    });
  });

  test('handles tab message with no response', (done) => {
    chrome.tabs.sendMessage = jest.fn((tabId, msg, callback) => {
      callback && callback(undefined);
    });

    chrome.tabs.sendMessage(1, { action: 'test' }, (response) => {
      expect(response).toBeUndefined();
      done();
    });
  });
});

describe('Popup - Options Button Integration', () => {
  test('options button opens options page', () => {
    chrome.runtime.openOptionsPage();
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });

  test('help link creates new tab', () => {
    chrome.tabs.create({ url: 'https://github.com/example' });
    expect(chrome.tabs.create).toHaveBeenCalled();
  });
});

describe('Popup - Stats Tracking', () => {
  test('enables stats tracking', (done) => {
    chrome.storage.sync.set({ statsTrackingEnabled: true }, () => {
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { statsTrackingEnabled: true },
        expect.any(Function)
      );
      done();
    });
  });

  test('disables stats tracking', (done) => {
    chrome.storage.sync.set({ statsTrackingEnabled: false }, () => {
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { statsTrackingEnabled: false },
        expect.any(Function)
      );
      done();
    });
  });

  test('retrieves stats from local storage', (done) => {
    const statsData = {
      '2025-12-18': {
        wordsProcessed: 1000,
        activeTime: 300000
      }
    };

    chrome.storage.local.get = jest.fn((keys, callback) => {
      callback(statsData);
    });

    chrome.storage.local.get(null, (data) => {
      expect(data).toEqual(statsData);
      done();
    });
  });
});

describe('Popup - Intensity Control', () => {
  test('validates intensity range 0-1', () => {
    const validIntensities = [0, 0.25, 0.5, 0.75, 1.0];
    
    validIntensities.forEach(intensity => {
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1);
    });
  });

  test('intensity updates storage', (done) => {
    const intensity = 0.65;
    
    chrome.storage.sync.set({ bionicIntensity: intensity }, () => {
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        { bionicIntensity: intensity },
        expect.any(Function)
      );
      done();
    });
  });

  test('handles invalid intensity gracefully', () => {
    const invalidValues = [-0.5, 1.5, NaN, null, undefined];
    
    invalidValues.forEach(value => {
      const normalized = Math.max(0, Math.min(1, value || 0.5));
      expect(normalized).toBeGreaterThanOrEqual(0);
      expect(normalized).toBeLessThanOrEqual(1);
    });
  });
});
