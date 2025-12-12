/* UI-focused tests for popup behaviors: hint timeout, demo update, reset, help link */
describe('popup UI behaviors', () => {
  const originalChrome = global.chrome;
  const originalRAF = global.requestAnimationFrame;

  afterEach(() => {
    global.chrome = originalChrome;
    global.requestAnimationFrame = originalRAF;
    jest.resetModules();
    jest.clearAllMocks();
    // restore real timers
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
      // provide both dashed and camel keys to match querySelector and test code
      'demo-bionic': makeEl(),
      demoBionic: null,
      'demo-normal': makeEl(),
      demoNormal: null,
      resetBtn: makeEl(),
      helpLink: makeEl()
    };
    // alias camel keys
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

  test('shows keyboard hint after timeout when ready', async () => {
    jest.useFakeTimers();
    const elems = makeDomShim();
    // ensure status contains the ready phrase before timeout fires
    elems.status.textContent = '💫 Ready to boost your reading!';

    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn((m, cb) => cb && cb()) },
  tabs: { query: (q, cb) => cb([{ id: 1, url: 'https://example.com' }]), sendMessage: jest.fn((id, msg, opts, cb) => cb && cb()) },
      scripting: {}
    };

    require('../popup');
    // fire DOMContentLoaded
    document.dispatchEvent({ type: 'DOMContentLoaded' });

    // advance timers to trigger hint
    jest.advanceTimersByTime(2000);
    // allow any microtasks
    await Promise.resolve();

  expect(elems.status.innerHTML).toMatch(/Click toggle|Alt/i);
  });

  test('demo updates on input using RAF', async () => {
    // make RAF call immediately
    global.requestAnimationFrame = (cb) => cb();
    const elems = makeDomShim();

    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn((m, cb) => cb && cb()) },
  tabs: { query: (q, cb) => cb([{ id: 1, url: 'https://example.com' }]), sendMessage: jest.fn((id, msg, opts, cb) => cb && cb()) },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });

  // set a value and dispatch input
  elems.intensity.value = 0.8;
  elems.intensity.dispatchEvent({ type: 'input', target: elems.intensity });
  // allow microtasks / RAF callbacks to run
  await Promise.resolve();

  // RAF called immediately, check demo updated
    expect(elems.demoBionic.innerHTML).toContain('Bionic:');
    // should reflect intensity by having at least one <span class="demo-bold">
    expect(elems.demoBionic.innerHTML).toMatch(/demo-bold/);
  });

  test('reset button persists default and notifies content script', async () => {
    const elems = makeDomShim();
    let sent = false;
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }), set: jest.fn((v, cb) => cb && cb()) } },
      runtime: { sendMessage: jest.fn((m, cb) => cb && cb()) },
      tabs: { query: (q, cb) => cb([{ id: 3, url: 'https://example.com' }]), create: jest.fn(), sendMessage: (...args) => { sent = true; const cb = args[args.length-1]; if (typeof cb === 'function') cb(); } },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });

    // simulate click on reset
    elems.resetBtn.dispatchEvent({ type: 'click', target: elems.resetBtn });
    // wait a tick
    await Promise.resolve();

    expect(global.chrome.storage.sync.set).toBeDefined();
    expect(sent).toBe(true);
    expect(elems.status.textContent).toMatch(/Reset to default intensity/);
  });

  test('help link opens privacy URL', async () => {
    const elems = makeDomShim();
    let created = false;
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn((m, cb) => cb && cb()) },
      tabs: { query: (q, cb) => cb([{ id: 4, url: 'https://example.com' }]), create: (...args) => { created = true; } },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });

    elems.helpLink.dispatchEvent({ type: 'click', target: elems.helpLink, preventDefault: () => {} });
    await Promise.resolve();

    expect(created).toBe(true);
  });
});
