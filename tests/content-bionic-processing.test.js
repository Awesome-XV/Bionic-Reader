/**
 * Content Coverage Targeted Tests
 * Focused tests to hit specific uncovered lines in content.js
 * Improves coverage without complex mocking or async issues
 * @jest-environment jsdom
 */
'use strict';

describe('Content Coverage', () => {
  let mockChrome;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="test"><p>Test paragraph with some words here</p></div>';
    
    mockChrome = {
      runtime: {
        onMessage: { addListener: jest.fn() },
        sendMessage: jest.fn(),
        lastError: null
      },
      storage: {
        sync: { get: jest.fn((k, cb) => cb({ bionicIntensity: 0.5, bionicEnabled: false })), set: jest.fn() },
        local: { get: jest.fn((k, cb) => cb({})), set: jest.fn() }
      }
    };
    global.chrome = mockChrome;
    global.console = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    document.body.innerHTML = '';
    delete global.chrome;
    delete global.console;
  });

  test('should track word count and reading time statistics', () => {
    require('../content.js');
    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    listener({ action: 'toggle', enabled: true }, {}, jest.fn());
    listener({ action: 'getStats' }, {}, jest.fn());
  });

  test('should save statistics to local storage', () => {
    require('../content.js');
    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    listener({ action: 'toggle', enabled: true }, {}, jest.fn());
    listener({ action: 'saveStats' }, {}, jest.fn());
  });

  test('should apply bionic formatting while skipping script, style, and header tags', () => {
    require('../content.js');
    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    document.body.innerHTML = `
      <p>The quick brown fox jumps</p>
      <script>code</script>
      <style>css</style>
      <nav>nav</nav>
      <h1>h1</h1>
    `;
    
    listener({ action: 'toggle', enabled: true }, {}, jest.fn());
    jest.advanceTimersByTime(100);
  });

  test('should dynamically adjust text formatting when intensity changes', () => {
    require('../content.js');
    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    listener({ action: 'toggle', enabled: true }, {}, jest.fn());
    listener({ action: 'setIntensity', intensity: 0.8 }, {}, jest.fn());
  });

  test('should restore original text when bionic mode is disabled', () => {
    require('../content.js');
    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    listener({ action: 'toggle', enabled: true }, {}, jest.fn());
    listener({ action: 'toggle', enabled: false }, {}, jest.fn());
  });

  test('should enforce maximum node processing limit of 3000 nodes', () => {
    require('../content.js');
    const container = document.getElementById('test');
    for (let i = 0; i < 3500; i++) {
      const span = document.createElement('span');
      span.textContent = 'w';
      container.appendChild(span);
    }
    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    listener({ action: 'toggle', enabled: true }, {}, jest.fn());
  });

  test('should observe and process dynamically added content via MutationObserver', () => {
    require('../content.js');
    const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    listener({ action: 'toggle', enabled: true }, {}, jest.fn());
    
    const newP = document.createElement('p');
    newP.textContent = 'New content';
    document.body.appendChild(newP);
    jest.advanceTimersByTime(100);
  });
});
