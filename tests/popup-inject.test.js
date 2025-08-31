const { ensureInjected } = require('../src/popup-inject');

describe('ensureInjected', () => {
  const originalChrome = global.chrome;

  afterEach(() => {
    global.chrome = originalChrome;
    jest.clearAllMocks();
  });

  test('succeeds on first attempt', async () => {
    global.chrome = {
      scripting: {
        insertCSS: jest.fn(() => Promise.resolve()),
        executeScript: jest.fn(() => Promise.resolve())
      }
    };

    const result = await ensureInjected(1, 2, 1);
    expect(result).toBe(true);
    expect(global.chrome.scripting.insertCSS).toHaveBeenCalled();
    expect(global.chrome.scripting.executeScript).toHaveBeenCalled();
  });

  test('retries and then succeeds', async () => {
    let calls = 0;
    global.chrome = {
      scripting: {
        insertCSS: jest.fn(() => {
          calls++;
          if (calls === 1) return Promise.reject(new Error('transient'));
          return Promise.resolve();
        }),
        executeScript: jest.fn(() => Promise.resolve())
      }
    };

    const result = await ensureInjected(1, 3, 1);
    expect(result).toBe(true);
    expect(global.chrome.scripting.insertCSS).toHaveBeenCalledTimes(2);
  });

  test('fails after attempts exhausted', async () => {
    global.chrome = {
      scripting: {
        insertCSS: jest.fn(() => Promise.reject(new Error('fatal'))),
        executeScript: jest.fn(() => Promise.resolve())
      }
    };

    const result = await ensureInjected(1, 2, 1);
    expect(result).toBe(false);
    expect(global.chrome.scripting.insertCSS).toHaveBeenCalledTimes(2);
  });

  test('sleep waits approximately given time', async () => {
    const t0 = Date.now();
    const { sleep } = require('../src/popup-inject');
    await sleep(20);
    const dt = Date.now() - t0;
    expect(dt).toBeGreaterThanOrEqual(15);
  });

  test('returns false when chrome.scripting missing', async () => {
  // case: chrome is undefined
  global.chrome = undefined;
  let result = await ensureInjected(1, 2, 1);
  expect(result).toBe(false);

  // case: chrome object exists but scripting API missing (covers different branch)
  global.chrome = {};
  result = await ensureInjected(1, 2, 1);
  expect(result).toBe(false);
  });

  test('handles chrome.scripting getter throwing', async () => {
    let accesses = 0;
    global.chrome = {};
    Object.defineProperty(global.chrome, 'scripting', {
      get() {
        accesses += 1;
        throw new Error('access denied');
      }
    });

    const result = await ensureInjected(1, 3, 1);
    expect(result).toBe(false);
    // ensure getter was accessed for each attempt
    expect(accesses).toBe(3);
  });

  test('retries when executeScript fails then succeeds', async () => {
    let calls = 0;
    global.chrome = {
      scripting: {
        insertCSS: jest.fn(() => Promise.resolve()),
        executeScript: jest.fn(() => {
          calls += 1;
          if (calls === 1) return Promise.reject(new Error('transient-exec'));
          return Promise.resolve();
        })
      }
    };

    const result = await ensureInjected(1, 3, 1);
    expect(result).toBe(true);
    expect(global.chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
  });

  test('executeScript fails and attempts exhausted', async () => {
    global.chrome = {
      scripting: {
        insertCSS: jest.fn(() => Promise.resolve()),
        executeScript: jest.fn(() => Promise.reject(new Error('exec-fatal')))
      }
    };

    const result = await ensureInjected(1, 2, 1);
    expect(result).toBe(false);
    expect(global.chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
  });
});
