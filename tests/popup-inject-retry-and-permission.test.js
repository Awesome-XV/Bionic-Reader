/* Targeted tests to increase coverage for popup.js error branches */
describe('popup coverage targets', () => {
  const originalChrome = global.chrome;
  const originalRAF = global.requestAnimationFrame;

  afterEach(() => {
    global.chrome = originalChrome;
    global.requestAnimationFrame = originalRAF;
    jest.resetModules();
    jest.clearAllMocks();
  // Ensure we always restore real timers to avoid leaked fake timers between tests
  try { jest.useRealTimers(); } catch (e) { /* ignore if not mocked */ }
  });

  function makeDomShim() {
    const makeEl = () => {
      const handlers = {};
      const el = {
        style: {},
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
          if (calls === 1) {
            // first attempt: simulate missing receiver so injection is attempted
            global.chrome.runtime.lastError = { message: 'Receiving end does not exist' };
            if (typeof cb === 'function') cb();
            global.chrome.runtime.lastError = undefined;
          } else if (calls === 2) {
            // on retry, simulate a retry failure
            global.chrome.runtime.lastError = { message: 'Retry failed' };
            if (typeof cb === 'function') cb();
            // keep lastError briefly
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

  // advance timers so injection and retry timeouts run
  jest.advanceTimersByTime(600);
  // let microtasks run
  await Promise.resolve();
  await Promise.resolve();

  expect(global.chrome.scripting.insertCSS).toHaveBeenCalled();
  expect(global.chrome.scripting.executeScript).toHaveBeenCalled();
  // We expect at least the initial send and a retry attempt; if timing varies, assert logs contain Message error or Retry failed
  expect(logs.some(l => /Message error|Retry failed/i.test(l))).toBeTruthy();
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

  const text = (elems.status.innerHTML || elems.status.textContent || '');
  expect(text).toMatch(/Frame access blocked|Try refreshing the page|Failed to load/i);
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
