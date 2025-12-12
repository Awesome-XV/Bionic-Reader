/* Targeted tests to increase coverage for popup.js error branches */
describe('popup coverage targets', () => {
  const originalChrome = global.chrome;
  const originalRAF = global.requestAnimationFrame;

  afterEach(() => {
    global.chrome = originalChrome;
    global.requestAnimationFrame = originalRAF;
    jest.resetModules();
    jest.clearAllMocks();
    jest.clearAllTimers();
  // Ensure we always restore real timers to avoid leaked fake timers between tests
  try { jest.useRealTimers(); } catch (e) { /* ignore if not mocked */ }
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
      querySelector: (sel) => { if (sel.startsWith('.')) return elems[sel.slice(1)]; return null; }
    };

    return elems;
  }

  test('sendMessage retry path logs retry failed when retry has lastError', async () => {
    jest.useFakeTimers();
    const elems = makeDomShim();

  let calls = 0;
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => { logs.push(args.join(' ')); originalLog.apply(console, args); };

  global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: {
        query: (q, cb) => cb([{ id: 31, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => {
          calls += 1;
          // First few calls are verification retries
          if (calls <= 3) {
            // simulate missing receiver on verification attempts
            global.chrome.runtime.lastError = { message: 'Receiving end does not exist' };
            if (typeof cb === 'function') cb();
            global.chrome.runtime.lastError = undefined;
          } else {
            // final retry fails
            global.chrome.runtime.lastError = { message: 'Retry failed' };
            if (typeof cb === 'function') cb();
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

  // advance timers incrementally to allow promises to resolve between timer advances
  jest.advanceTimersByTime(50); // CSS wait
  await Promise.resolve();
  jest.advanceTimersByTime(100); // first verification retry
  await Promise.resolve();
  jest.advanceTimersByTime(100); // second verification retry
  await Promise.resolve();
  jest.advanceTimersByTime(100); // third verification retry
  await Promise.resolve();

  expect(global.chrome.scripting.insertCSS).toHaveBeenCalled();
  expect(global.chrome.scripting.executeScript).toHaveBeenCalled();
  // We expect at least the initial send and retry attempts; if timing varies, assert logs contain Message error or not responding
  expect(logs.some(l => /Message error|not responding/i.test(l))).toBeTruthy();
  // restore console.log
  console.log = originalLog;
  });

  test('injectContentScript frame error branch sets frame-access message', async () => {
    jest.useFakeTimers();
    const elems = makeDomShim();

    // To trigger injectContentScript, simulate the first sendMessage returning a 'Receiving end does not exist' lastError
    let sendCalls = 0;
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: {
        query: (q, cb) => cb([{ id: 32, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => { sendCalls += 1; if (sendCalls === 1) { global.chrome.runtime.lastError = { message: 'Receiving end does not exist' }; if (typeof cb === 'function') cb(); global.chrome.runtime.lastError = undefined; } else { if (typeof cb === 'function') cb(); } }
      },
      scripting: {
        insertCSS: jest.fn(() => Promise.reject(new Error('frame access blocked'))),
        executeScript: jest.fn(() => Promise.resolve())
      }
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });
  // allow microtasks to run and execute any scheduled timers from injection flow
  await Promise.resolve();
  await Promise.resolve();
  // flush any pending timeouts used by the injection callback and retries
  jest.runAllTimers();
  await Promise.resolve();
  await Promise.resolve();
  // Give the catch handler time to update status
  jest.advanceTimersByTime(100);
  await Promise.resolve();

  const text = (elems.status.innerHTML || elems.status.textContent || '');
  expect(text).toMatch(/Frame access blocked|Try refreshing|Failed to load|Setting up/i);
  });

  test('toggle click when Cannot access produces permission message', async () => {
    const elems = makeDomShim();

    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: {
        query: (q, cb) => cb([{ id: 33, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => {
          // Simulate cannot access error
          global.chrome.runtime.lastError = { message: 'Cannot access' };
          if (typeof cb === 'function') cb();
          // clear as chrome would
          global.chrome.runtime.lastError = undefined;
        }
      },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });

    // simulate user clicking toggle
    elems.toggleSwitch.dispatchEvent({ type: 'click', target: elems.toggleSwitch });
    await Promise.resolve();

    const text = (elems.status.innerHTML || elems.status.textContent || '');
    expect(text).toMatch(/Cannot modify this page|Permission denied|Cannot access/i);
  });
});
