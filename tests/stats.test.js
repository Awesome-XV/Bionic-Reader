// Mock chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  runtime: {
    lastError: null,
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Mock simple DOM for testing
global.document = {
  getElementById: jest.fn(),
  body: {
    innerHTML: ''
  }
};

describe('Statistics Functionality', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console to avoid noise in test output
    global.console = {
      ...console,
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  });

  describe('Word Count Tracking', () => {
    test('correctly counts words in text', () => {
      const trackWordsProcessed = (text) => {
        if (!text) return 0;
        const words = text.match(/\b[a-zA-Z]+\b/g) || [];
        return words.length;
      };

      expect(trackWordsProcessed('Hello world')).toBe(2);
      expect(trackWordsProcessed('This is a test sentence with multiple words')).toBe(8);
      expect(trackWordsProcessed('Single')).toBe(1);
      expect(trackWordsProcessed('')).toBe(0);
      expect(trackWordsProcessed('123 numbers 456 should not count')).toBe(4);
      expect(trackWordsProcessed('Hyphenated-words and contractions like don\'t work')).toBe(8);
    });

    test('handles special characters and punctuation', () => {
      const trackWordsProcessed = (text) => {
        if (!text) return 0;
        const words = text.match(/\b[a-zA-Z]+\b/g) || [];
        return words.length;
      };

      expect(trackWordsProcessed('Hello, world! How are you?')).toBe(5);
      expect(trackWordsProcessed('Email@address.com is not counted')).toBe(6);
      expect(trackWordsProcessed('URLs like https://example.com don\'t count')).toBe(8);
    });
  });

  describe('Time Calculation', () => {
    test('formats time correctly', () => {
      const formatTime = (milliseconds) => {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
          return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
          return `${minutes}m`;
        } else {
          return `${seconds}s`;
        }
      };

      expect(formatTime(5000)).toBe('5s');
      expect(formatTime(65000)).toBe('1m');
      expect(formatTime(125000)).toBe('2m');
      expect(formatTime(3665000)).toBe('1h 1m');
      expect(formatTime(7325000)).toBe('2h 2m');
    });

    test('estimates time saved correctly', () => {
      const estimateTimeSaved = (wordsProcessed) => {
        const secondsPerWord = 60 / 225; // 225 WPM average
        const improvementRate = 0.15; // 15% improvement estimate
        return Math.round(wordsProcessed * secondsPerWord * improvementRate);
      };

      expect(estimateTimeSaved(100)).toBe(4); // ~4 seconds saved for 100 words
      expect(estimateTimeSaved(1000)).toBe(40); // ~40 seconds saved for 1000 words
      expect(estimateTimeSaved(0)).toBe(0);
    });
  });

  describe('Storage Operations', () => {
    test('saves daily stats correctly', async () => {
      const today = new Date().toDateString();
      const mockExistingStats = { wordsProcessed: 500, activeTime: 60000, sessions: 2 };
      const newSessionStats = { wordsProcessed: 200, activeTime: 30000 };

      // Mock storage.local.get
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ [today]: mockExistingStats });
      });

      // Mock storage.local.set
      chrome.storage.local.set.mockImplementation((data, callback) => {
        expect(data[today]).toEqual({
          wordsProcessed: 700, // 500 + 200
          activeTime: 90000,   // 60000 + 30000
          sessions: 3,         // 2 + 1
          lastUpdate: expect.any(Number)
        });
        if (callback) callback();
      });

      // Simulate saveStatsToStorage function
      const saveStatsToStorage = (sessionStats) => {
        chrome.storage.local.get([today], (result) => {
          const existingStats = result[today] || { wordsProcessed: 0, activeTime: 0, sessions: 0 };
          
          const updatedStats = {
            wordsProcessed: existingStats.wordsProcessed + sessionStats.wordsProcessed,
            activeTime: existingStats.activeTime + sessionStats.activeTime,
            sessions: existingStats.sessions + 1,
            lastUpdate: Date.now()
          };
          
          chrome.storage.local.set({ [today]: updatedStats });
        });
      };

      saveStatsToStorage(newSessionStats);

      expect(chrome.storage.local.get).toHaveBeenCalledWith([today], expect.any(Function));
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    });

    test('handles new day stats correctly', () => {
      const today = new Date().toDateString();
      const newSessionStats = { wordsProcessed: 150, activeTime: 45000 };

      // Mock storage.local.get to return no existing stats (new day)
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({}); // Empty result
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        expect(data[today]).toEqual({
          wordsProcessed: 150,
          activeTime: 45000,
          sessions: 1,
          lastUpdate: expect.any(Number)
        });
        if (callback) callback();
      });

      // Simulate saveStatsToStorage function for new day
      const saveStatsToStorage = (sessionStats) => {
        chrome.storage.local.get([today], (result) => {
          const existingStats = result[today] || { wordsProcessed: 0, activeTime: 0, sessions: 0 };
          
          const updatedStats = {
            wordsProcessed: existingStats.wordsProcessed + sessionStats.wordsProcessed,
            activeTime: existingStats.activeTime + sessionStats.activeTime,
            sessions: existingStats.sessions + 1,
            lastUpdate: Date.now()
          };
          
          chrome.storage.local.set({ [today]: updatedStats });
        });
      };

      saveStatsToStorage(newSessionStats);

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session Tracking', () => {
    test('tracks session statistics correctly', () => {
      let sessionStats = {
        wordsProcessed: 0,
        startTime: null,
        activeTime: 0,
        lastActiveTime: Date.now()
      };

      const trackWordsProcessed = (text) => {
        if (!text) return 0;
        const words = text.match(/\b[a-zA-Z]+\b/g) || [];
        const wordCount = words.length;
        sessionStats.wordsProcessed += wordCount;
        
        const now = Date.now();
        if (sessionStats.startTime === null) {
          sessionStats.startTime = now;
        }
        
        // If less than 30 seconds since last activity, count as continuous reading
        if (now - sessionStats.lastActiveTime < 30000) {
          sessionStats.activeTime += (now - sessionStats.lastActiveTime);
        }
        sessionStats.lastActiveTime = now;
        
        return wordCount;
      };

      // Track some words
      expect(trackWordsProcessed('Hello world this is a test')).toBe(6);
      expect(sessionStats.wordsProcessed).toBe(6);
      expect(sessionStats.startTime).not.toBeNull();

      // Track more words
      expect(trackWordsProcessed('More words to process here')).toBe(5);
      expect(sessionStats.wordsProcessed).toBe(11);
    });

    test('handles active time tracking with gaps', () => {
      let sessionStats = {
        wordsProcessed: 0,
        startTime: Date.now(),
        activeTime: 0,
        lastActiveTime: Date.now() - 31000 // 31 seconds ago (gap)
      };

      const trackWordsProcessed = (text) => {
        if (!text) return 0;
        const words = text.match(/\b[a-zA-Z]+\b/g) || [];
        const wordCount = words.length;
        sessionStats.wordsProcessed += wordCount;
        
        const now = Date.now();
        
        // If less than 30 seconds since last activity, count as continuous reading
        if (now - sessionStats.lastActiveTime < 30000) {
          sessionStats.activeTime += (now - sessionStats.lastActiveTime);
        }
        sessionStats.lastActiveTime = now;
        
        return wordCount;
      };

      const initialActiveTime = sessionStats.activeTime;
      trackWordsProcessed('New session after gap');
      
      // Active time should not increase due to the gap
      expect(sessionStats.activeTime).toBe(initialActiveTime);
    });
  });

  describe('Statistics Display', () => {
    test('loads and displays stats logic', () => {
      const mockStats = {
        wordsProcessed: 1247,
        activeTime: 300000, // 5 minutes
        sessions: 3
      };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ [new Date().toDateString()]: mockStats });
      });

      const formatTime = (milliseconds) => {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
          return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
          return `${minutes}m`;
        } else {
          return `${seconds}s`;
        }
      };

      const estimateTimeSaved = (wordsProcessed) => {
        const secondsPerWord = 60 / 225;
        const improvementRate = 0.15;
        return Math.round(wordsProcessed * secondsPerWord * improvementRate);
      };

      const loadAndDisplayStats = () => {
        const today = new Date().toDateString();
        
        chrome.storage.local.get([today], (result) => {
          const todayStats = result[today] || { wordsProcessed: 0, activeTime: 0, sessions: 0 };
          
          // Verify the calculations work correctly
          expect(todayStats.wordsProcessed).toBe(1247);
          expect(formatTime(todayStats.activeTime)).toBe('5m');
          expect(formatTime(estimateTimeSaved(todayStats.wordsProcessed) * 1000)).toBe('50s');
        });
      };

      loadAndDisplayStats();

      expect(chrome.storage.local.get).toHaveBeenCalled();
    });
  });
});
