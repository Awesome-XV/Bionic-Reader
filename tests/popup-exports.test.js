const path = require('path');

describe('popup exports integration', () => {
  const originalChrome = global.chrome;

  afterEach(() => {
    global.chrome = originalChrome;
    jest.resetModules();
  });

  test('ensureInjected exported from popup uses global.chrome and returns false when scripting missing', async () => {
    // require the popup file (it should export ensureInjected when in Node)
    const popup = require('../popup');

    // simulate chrome object with no scripting
    global.chrome = {};

    const result = await popup.ensureInjected(1, 2);
    expect(result).toBe(false);
  });
});
