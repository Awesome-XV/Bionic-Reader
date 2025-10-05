/**
 * Jest Setup File
 * Suppresses expected console output during tests to reduce noise
 * These console calls are part of error handling and expected test behavior
 */

// Suppress console.error globally (most tests trigger expected error paths)
global.console.error = jest.fn();

// Suppress console.log globally (debug logging in tests)
global.console.log = jest.fn();

// Suppress console.warn if needed
global.console.warn = jest.fn();

// Keep console.info for important test information
// global.console.info = jest.fn(); // Uncomment if needed
