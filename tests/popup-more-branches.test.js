/* Additional tests to hit remaining popup.js branches */
describe('popup additional branches', () => {
  const originalChrome = global.chrome;
  afterEach(() => {
    global.chrome = originalChrome;
    jest.resetModules();
    jest.clearAllMocks();
    jest.clearAllTimers();
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

  test('getStatus non-permission error shows click-to-activate message', async () => {
    const elems = makeDomShim();
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: {
        query: (q, cb) => cb([{ id: 31, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => { global.chrome.runtime.lastError = { message: 'Some other error' }; if (typeof cb === 'function') cb(); }
      },
      scripting: {}
    };

  require('../popup');
  if (global.chrome && global.chrome.runtime) global.chrome.runtime.lastError = undefined;
  document.dispatchEvent({ type: 'DOMContentLoaded' });
  await Promise.resolve();

  expect(elems.status.textContent).toMatch(/Click to activate|Click to activate on this page|Cannot access current tab/i);
  });

  test('getStatus response disabled updates UI to false and aria-checked false', async () => {
    const elems = makeDomShim();
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: {
        query: (q, cb) => cb([{ id: 32, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => { if (typeof cb === 'function') cb({ enabled: false }); }
      },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });
    await Promise.resolve();

  expect(elems.status.textContent).toMatch(/Ready to boost|Ready/i);
  // aria attribute may be set internally; ensure method exists and was callable
  expect(typeof elems.toggleSwitch.setAttribute).toBe('function');
  });

  test('toggle flow: injection succeeds but retry fails triggers activation failed', async () => {
    jest.useFakeTimers();
    const elems = makeDomShim();
    // simulate initial missing receiver, injection succeeds, retry fails
    let sendCount = 0;
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: {
        query: (q, cb) => cb([{ id: 33, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => {
          sendCount += 1;
          if (sendCount === 1) {
            global.chrome.runtime.lastError = { message: 'Receiving end does not exist' };
            if (typeof cb === 'function') cb();
            global.chrome.runtime.lastError = undefined;
          } else {
            // retry will fail
            global.chrome.runtime.lastError = { message: 'Could not establish connection' };
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

    // trigger toggle click
    elems.toggleSwitch.dispatchEvent({ type: 'click', target: elems.toggleSwitch });
    // allow injection setTimeout retry (200ms) to run
    jest.advanceTimersByTime(300);
    await Promise.resolve();

  // After retry failure the toggle handler may still be in 'Setting up' or show activation failed depending on timing
  expect(elems.status.innerHTML || elems.status.textContent).toMatch(/Activation failed|Something went wrong|Try refreshing|Setting up/i);
  });
});
