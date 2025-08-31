// Minimal injector helper exported for tests.
/* global chrome */
'use strict';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureInjected(tabId, attempts = 3, delayMs = 100) {
  for (let i = 0; i < attempts; i++) {
    try {
      if (!global.chrome || !global.chrome.scripting) throw new Error('scripting API not available');
      await global.chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ['bionic.css'] });
      await global.chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
      return true;
    } catch (err) {
      if (i < attempts - 1) {
        // wait before retrying
        // small delay to allow transient failures to recover
        // tests can keep this small
        // eslint-disable-next-line no-await-in-loop
  await sleep(delayMs);
      }
    }
  }
  return false;
}

module.exports = { ensureInjected, sleep };
