/* Accessibility-focused tests for popup: ARIA, keyboard, reduced-motion */
describe('popup accessibility', () => {
  const originalChrome = global.chrome;
  const originalRAF = global.requestAnimationFrame;
  const originalMatchMedia = (typeof window !== 'undefined') ? window.matchMedia : undefined;

  afterEach(() => {
    global.chrome = originalChrome;
    global.requestAnimationFrame = originalRAF;
    if (typeof window !== 'undefined') window.matchMedia = originalMatchMedia;
    jest.resetModules();
    jest.clearAllMocks();
    jest.clearAllTimers();
    if (jest.isMockFunction(setTimeout)) jest.useRealTimers();
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

  test('toggle switch keydown activates click on Enter/Space', async () => {
    const elems = makeDomShim();
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn((m, cb) => cb && cb()) },
      tabs: { query: (q, cb) => cb([{ id: 1, url: 'https://example.com' }]), sendMessage: jest.fn((id, msg, opts, cb) => cb && cb()) },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });

    // simulate keydown on the switch
  elems.toggleSwitch.dispatchEvent({ type: 'keydown', key: 'Enter', target: elems.toggleSwitch, preventDefault: () => {} });
    await Promise.resolve();
    expect(elems.toggleSwitch.click).toHaveBeenCalled();

    elems.toggleSwitch.click.mockClear();
  elems.toggleSwitch.dispatchEvent({ type: 'keydown', key: ' ', target: elems.toggleSwitch, preventDefault: () => {} });
    await Promise.resolve();
    expect(elems.toggleSwitch.click).toHaveBeenCalled();
  });

  test('intensity slider has ARIA attributes and updates aria-valuenow on input', async () => {
    const elems = makeDomShim();
    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) , set: jest.fn((v, cb) => cb && cb()) } },
      runtime: { sendMessage: jest.fn((m, cb) => cb && cb()) },
      tabs: { query: (q, cb) => cb([{ id: 2, url: 'https://example.com' }]), sendMessage: jest.fn((id, msg, opts, cb) => cb && cb()) },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });

    // The script should set ARIA attributes on the range control
    expect(elems.intensity.setAttribute).toHaveBeenCalled();
    // check for role=slider being set at some point
    const calls = elems.intensity.setAttribute.mock.calls.map(c => c[0] + '=' + c[1]);
    expect(calls.some(s => s.startsWith('role=slider'))).toBeTruthy();

    // simulate input which should update aria-valuenow via setIntensityLabel
    elems.intensity.value = 0.77;
    elems.intensity.dispatchEvent({ type: 'input', target: elems.intensity });
    await Promise.resolve();

    // ensure aria-valuenow was updated to the new value (string form)
    const updated = elems.intensity.setAttribute.mock.calls.some(c => c[0] === 'aria-valuenow' && c[1] === String(0.77));
    expect(updated).toBeTruthy();
  });

  test('prefers-reduced-motion applies demo update immediately (no RAF)', async () => {
    const elems = makeDomShim();
    // Stub matchMedia to indicate reduced motion
    if (typeof window === 'undefined') global.window = {};
    window.matchMedia = jest.fn(() => ({ matches: true }));
    global.requestAnimationFrame = jest.fn();

    global.chrome = {
      storage: { sync: { get: (d, cb) => cb({ bionicIntensity: 0.5 }) } },
      runtime: { sendMessage: jest.fn((m, cb) => cb && cb()) },
      tabs: { query: (q, cb) => cb([{ id: 3, url: 'https://example.com' }]), sendMessage: jest.fn((id, msg, opts, cb) => cb && cb()) },
      scripting: {}
    };

    require('../popup');
    document.dispatchEvent({ type: 'DOMContentLoaded' });

    // simulate sliding input; reduced motion should apply immediately and not call RAF
    elems.intensity.value = 0.9;
    elems.intensity.dispatchEvent({ type: 'input', target: elems.intensity });
    await Promise.resolve();

    expect(elems.demoBionic.innerHTML).toContain('Bionic:');
    expect(global.requestAnimationFrame).not.toHaveBeenCalled();
  });
});
