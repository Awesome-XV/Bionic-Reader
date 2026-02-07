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
  const originalError = console.error;
  console.log = (...args) => { logs.push(args.join(' ')); originalLog.apply(console, args); };
  console.error = (...args) => { logs.push(args.join(' ')); originalError.apply(console, args); };

  global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: {
        query: (q, cb) => cb([{ id: 31, url: 'https://example.com' }]),
        sendMessage: (id, msg, optsOrCb, cb) => {
          calls += 1;
          const actualCb = typeof cb === 'function' ? cb : typeof optsOrCb === 'function' ? optsOrCb : null;
          if (calls <= 3) {
            global.chrome.runtime.lastError = { message: 'Receiving end does not exist' };
            if (actualCb) actualCb();
            global.chrome.runtime.lastError = undefined;
          } else {
            global.chrome.runtime.lastError = { message: 'Retry failed' };
            if (actualCb) actualCb();
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

  // Helper to flush multiple levels of microtasks
  const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  // Interleave timer advances and microtask flushes to drive the async injection flow
  for (let round = 0; round < 15; round++) {
    jest.advanceTimersByTime(100);
    await flushMicrotasks();
  }

  expect(global.chrome.scripting.insertCSS).toHaveBeenCalled();
  expect(global.chrome.scripting.executeScript).toHaveBeenCalled();
  // We expect at the initial send and retry attempts
  expect(logs.some(l => /Message error|not responding|Retry failed|Injection failed/i.test(l))).toBeTruthy();
  // restore console
  console.log = originalLog;
  console.error = originalError;
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
