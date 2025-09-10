/* Tests to cover toggle branches and keyboard handlers in popup.js */
describe('popup toggle and keyboard branches', () => {
  const originalChrome = global.chrome;
  const originalRAF = global.requestAnimationFrame;

  afterEach(() => {
    global.chrome = originalChrome;
    global.requestAnimationFrame = originalRAF;
    jest.resetModules();
    jest.clearAllMocks();
    jest.clearAllTimers();
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
      querySelector: (sel) => {
        if (sel.startsWith('.')) return elems[sel.slice(1)];
        return null;
      },
      activeElement: null
    };

    return elems;
  }

  test('getStatus handles permission-type error and shows restricted message', async () => {
    const elems = makeDomShim();
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: {
        query: (q, cb) => cb([{ id: 21, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => { global.chrome.runtime.lastError = { message: 'Cannot access' }; if (typeof cb === 'function') cb(); }
      },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });
    // allow microtasks
    await Promise.resolve();

    const text = elems.status.innerHTML || elems.status.textContent;
    expect(text).toMatch(/Access restricted|blocks extensions|Cannot access/i);
  });

  test('toggle click shows processing info when processedNodes present and persists state', async () => {
    const elems = makeDomShim();
    let storageSaved = null;
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }), set: (v) => { storageSaved = v; } } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: {
        query: (q, cb) => cb([{ id: 22, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => { if (typeof cb === 'function') cb({ enabled: true, processedNodes: 3 }); }
      },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });

    // simulate user clicking the toggle
    elems.toggleSwitch.dispatchEvent({ type: 'click', target: elems.toggleSwitch });
    await Promise.resolve();

    expect(elems.status.textContent).toMatch(/Bionic mode activated|Active/i);
    // if processing info was written it will be in innerHTML
    expect(elems.status.innerHTML || '').toMatch(/Processing 3 text sections|Processing/);
    expect(storageSaved).not.toBeNull();
  });

  test('toggle click with error response shows generic failure message', async () => {
    const elems = makeDomShim();
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: {
        query: (q, cb) => cb([{ id: 23, url: 'https://example.com' }]),
        sendMessage: (id, msg, opts, cb) => { if (typeof cb === 'function') cb({ error: true }); }
      },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });

    elems.toggleSwitch.dispatchEvent({ type: 'click', target: elems.toggleSwitch });
    await Promise.resolve();

    expect(elems.status.textContent).toMatch(/Something went wrong|Try again/);
  });

  test('keyboard shortcuts trigger toggle click (Alt+B and Enter when focused)', async () => {
    const elems = makeDomShim();
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn(), lastError: undefined },
      tabs: { query: (q, cb) => cb([{ id: 24, url: 'https://example.com' }]), sendMessage: jest.fn() },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });

    // Alt+B should call the click() mock on toggleSwitch
    document.dispatchEvent({ type: 'keydown', altKey: true, key: 'b', preventDefault: () => {} });
    expect(elems.toggleSwitch.click).toHaveBeenCalled();

    // Enter/Space when focused
    document.activeElement = elems.toggleSwitch;
    document.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: () => {} });
    document.dispatchEvent({ type: 'keydown', key: ' ', preventDefault: () => {} });
    // click should have been called multiple times
    expect(elems.toggleSwitch.click.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
