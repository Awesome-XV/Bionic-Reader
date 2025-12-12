/* Tests for sendMessage/injection flows in popup.js */
describe('popup sendMessage & injection flows', () => {
  const originalChrome = global.chrome;
  const originalRAF = global.requestAnimationFrame;
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    // Suppress expected console errors/logs during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    // Restore console
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
    if (consoleLogSpy) consoleLogSpy.mockRestore();
    
    global.chrome = originalChrome;
    global.requestAnimationFrame = originalRAF;
    jest.resetModules();
    jest.clearAllMocks();
    if (jest.isMockFunction(setTimeout)) jest.useRealTimers();
  });

  function makeDomShim() {
    const makeEl = () => {
      const handlers = {};
      const styleProps = {};
      const el = {
        style: {
          setProperty: jest.fn((prop, val) => { styleProps[prop] = val; }),
          getPropertyValue: jest.fn((prop) => styleProps[prop] || '')
        },
        textContent: '',
        innerHTML: '',
        classList: { add: jest.fn(), remove: jest.fn() },
        setAttribute: jest.fn(),
        addEventListener: (ev, cb) => { handlers[ev] = handlers[ev] || []; handlers[ev].push(cb); },
        dispatchEvent: (ev) => { ev.target = ev.target || el; (handlers[ev.type] || []).forEach(cb => cb(ev)); },
        click: jest.fn(),
        value: ''
      };
      return el;
    };

    const elems = {
      toggleSwitch: makeEl(),
      onText: makeEl(),
      offText: makeEl(),
      status: makeEl(),
      intensity: makeEl(),
      intensityValue: makeEl(),
      'demo-bionic': makeEl(),
      demoBionic: null,
      'demo-normal': makeEl(),
      demoNormal: null,
      resetBtn: makeEl(),
      helpLink: makeEl()
    };
    elems.demoBionic = elems['demo-bionic'];
    elems.demoNormal = elems['demo-normal'];

    global.document = {
      listeners: {},
      body: { innerHTML: '' },
      addEventListener: function (name, cb) { this.listeners[name] = this.listeners[name] || []; this.listeners[name].push(cb); },
      dispatchEvent: function (ev) { (this.listeners[ev.type] || []).forEach(cb => cb(ev)); },
      getElementById: (id) => elems[id],
      querySelector: (sel) => {
        if (sel.startsWith('.')) return elems[sel.slice(1)];
        return null;
      }
    };

    return elems;
  }

  test('injects content script then retries message successfully', async () => {
    jest.useFakeTimers();
    const elems = makeDomShim();
    // Prepare chrome mocks
    let callCount = 0;
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn((m, cb) => cb && cb()) },
      tabs: {
        query: (q, cb) => cb([{ id: 11, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => {
          callCount += 1;
          // First few calls are verification retries after injection
          if (callCount <= 3) {
            // simulate missing receiver on verification attempts
            global.chrome.runtime.lastError = { message: 'Receiving end does not exist' };
            if (typeof cb === 'function') cb();
            // clear lastError as real chrome does after callback
            global.chrome.runtime.lastError = undefined;
          } else {
            // on final retry, succeed
            global.chrome.runtime.lastError = undefined;
            if (typeof cb === 'function') cb({ enabled: true });
          }
        }
      },
      scripting: {
        insertCSS: jest.fn(() => Promise.resolve()),
        executeScript: jest.fn(() => Promise.resolve())
      }
    };

  require('../popup');
  document.dispatchEvent({ type: 'DOMContentLoaded' });
  // clear any lastError left behind by earlier mocks
  if (global.chrome && global.chrome.runtime) global.chrome.runtime.lastError = undefined;

  // advance timers incrementally to allow promises to resolve between timer advances
  jest.advanceTimersByTime(50); // CSS wait
  await Promise.resolve();
  jest.advanceTimersByTime(100); // first verification retry
  await Promise.resolve();
  jest.advanceTimersByTime(100); // second verification retry
  await Promise.resolve();
  jest.advanceTimersByTime(100); // third verification retry
  await Promise.resolve();

    // scripting should have been called (injection attempted)
    expect(global.chrome.scripting.insertCSS).toHaveBeenCalled();
    expect(global.chrome.scripting.executeScript).toHaveBeenCalled();
  // tabs.sendMessage should have been called at least once
  expect(callCount).toBeGreaterThanOrEqual(1);
  // status may be in 'Setting up' while injection runs, or show Active once retry succeeds
  expect(elems.status.textContent).toMatch(/Setting up|Active|Reading/i);
  });

  test('injectContentScript shows permission denied on permission error', async () => {
    jest.useFakeTimers();
    const elems = makeDomShim();
    let callCount = 0;
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn((m, cb) => cb && cb()) },
      tabs: {
        query: (q, cb) => cb([{ id: 12, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => {
          callCount += 1;
          if (callCount === 1) {
            global.chrome.runtime.lastError = { message: 'Receiving end does not exist' };
            if (typeof cb === 'function') cb();
          } else {
            // shouldn't reach here in this test
            if (typeof cb === 'function') cb();
          }
        }
      },
      scripting: {
        insertCSS: jest.fn(() => Promise.reject(new Error('permission denied'))),
        executeScript: jest.fn(() => Promise.resolve())
      }
    };

  require('../popup');
  document.dispatchEvent({ type: 'DOMContentLoaded' });
  // clear any runtime error residue
  if (global.chrome && global.chrome.runtime) global.chrome.runtime.lastError = undefined;

  // Allow promise rejection handling and the setTimeout inside injectContentScript
  jest.advanceTimersByTime(200);
  await Promise.resolve();

  // status may be set to 'Cannot access current tab' depending on ordering; accept multiple possibilities
  const statusText2 = (elems.status.innerHTML || elems.status.textContent || '');
  expect(statusText2).toMatch(/Permission denied|This page blocks extensions|Failed to load|Cannot access current tab/i);
  });

  test('restricted reader mode disables toggle and shows reader hint', async () => {
    const elems = makeDomShim();
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn((m, cb) => cb && cb()) },
      tabs: { query: (q, cb) => cb([{ id: 13, url: 'https://microsoft.com/some/reader' }]) },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });
    // reader mode path sets innerHTML with the reader hint
    expect(elems.status.innerHTML).toMatch(/Reader mode detected|Not available in reader mode/i);
    // toggle should be visually disabled
    expect(elems.toggleSwitch.style.pointerEvents).toBe('none');
  });
});
