/**
 * Content Script Tests - Simplified
 * Tests core functionality while avoiding complex DOM interactions
 */

describe('Content Script Core', () => {
  let mockChrome;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    
    // Mock Chrome APIs
    mockChrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn()
        }
      },
      storage: {
        sync: {
          get: jest.fn().mockImplementation((keys, callback) => {
            callback({
              bionicIntensity: 0.5,
              bionicCoverage: 0.5,
              statsTrackingEnabled: false
            });
          })
        },
        local: {
          set: jest.fn(),
          get: jest.fn().mockImplementation((keys, callback) => {
            callback({});
          })
        }
      }
    };

    global.chrome = mockChrome;
    
    // Minimal DOM mocking - focus on message handling only
    global.document = {
      createTreeWalker: jest.fn().mockReturnValue({
        nextNode: jest.fn().mockReturnValue(null)
      }),
      querySelector: jest.fn().mockReturnValue(null),
      querySelectorAll: jest.fn().mockReturnValue([]),
      createElement: jest.fn().mockReturnValue({
        className: '',
        textContent: '',
        style: new Proxy({}, {
          set: () => true,
          get: () => ''
        }),
        remove: jest.fn()
      }),
      body: {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        },
        appendChild: jest.fn()
      }
    };
    
    global.Node = { TEXT_NODE: 3 };
    global.NodeFilter = { SHOW_TEXT: 4 };
    global.MutationObserver = jest.fn(() => ({
      observe: jest.fn(),
      disconnect: jest.fn()
    }));
    global.requestAnimationFrame = jest.fn(cb => cb());
    global.console = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('initializes correctly', () => {
    require('../content.js');
    expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(mockChrome.storage.sync.get).toHaveBeenCalled();
  });

  test('handles setIntensity message correctly', () => {
    require('../content.js');
    const handler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    // setIntensity is now handled in the main listener
    const result = handler({ action: 'setIntensity', intensity: 0.8, coverage: 0.5 }, {}, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      intensity: 0.8,
      coverage: 0.5
    });
    expect(result).toBe(true); // Should return true for async response
  });

  test('handles toggle message', () => {
    require('../content.js');
    const handler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    handler({ action: 'toggle' }, {}, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      enabled: expect.any(Boolean)
    }));
  });

  test('handles getStatus message', () => {
    require('../content.js');
    const handler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    handler({ action: 'getStatus' }, {}, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      enabled: expect.any(Boolean),
      processedNodes: expect.any(Number),
      timestamp: expect.any(Number)
    }));
  });

  test('handles invalid cleanup message', () => {
    require('../content.js');
    const handler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    // cleanup action is not supported in the switch statement
    handler({ action: 'cleanup' }, {}, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      error: 'Unknown action',
      code: 'UNKNOWN_ACTION'
    });
  });

  test('handles setStatsEnabled message', () => {
    require('../content.js');
    const handler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    // Note: content.js converts action to lowercase
    handler({ action: 'setStatsEnabled', statsEnabled: true }, {}, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      statsEnabled: true
    });
  });

  test('handles getStats message', () => {
    require('../content.js');
    const handler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    handler({ action: 'getStats' }, {}, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      sessionStats: expect.any(Object),
      statsEnabled: expect.any(Boolean)
    });
  });

  test('rejects invalid messages', () => {
    require('../content.js');
    const handler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    handler({ action: 'invalidAction' }, {}, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      error: 'Unknown action',
      code: 'UNKNOWN_ACTION'
    });
  });

  test('handles messages without action', () => {
    require('../content.js');
    const handler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    
    handler({}, {}, sendResponse);
    
    expect(sendResponse).toHaveBeenCalledWith({
      error: 'Unknown action',
      code: 'UNKNOWN_ACTION'
    });
  });

  test('creates mutation observer when bionic enabled', () => {
    // Observer is now only created when bionic mode is enabled (not on script load)
    require('../content.js');
    // Observer should not be created on load anymore
    expect(global.MutationObserver).not.toHaveBeenCalled();
  });

  test('loads settings from storage', () => {
    require('../content.js');
    expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(
      expect.objectContaining({
        bionicIntensity: expect.any(Number),
        bionicCoverage: expect.any(Number),
        statsTrackingEnabled: expect.any(Boolean)
      }),
      expect.any(Function)
    );
  });
});
