/**
 * Bionic Reader Content Script
 * 
 * Transforms web page text into bionic reading format by selectively
 * bolding the first portion of words to improve reading speed and focus.
 * 
 * @version 1.0.0
 * @license MIT
 */

'use strict';

// Debug mode flag - set to true only for development
const DEBUG_MODE = false;

/**
 * Centralized logger utility
 * Uses environment-aware logging (debug/info disabled in production)
 */
const logger = {
  debug: DEBUG_MODE ? console.log.bind(console) : () => {},
  info: DEBUG_MODE ? console.info.bind(console) : () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

/**
 * @typedef {Object} BionicConfig
 * @property {number} MAX_NODES_PER_BATCH - Maximum nodes to process in one batch
 * @property {number} MAX_TOTAL_NODES - Maximum total nodes to process per session
 * @property {number} MAX_TEXT_LENGTH - Maximum length of text to process
 * @property {number} PROCESSING_TIMEOUT - Timeout for processing in milliseconds
 * @property {number} BATCH_DELAY - Delay between batches in milliseconds
 * @property {number} CONTENT_WORD_RATIO - Bold ratio for content words (0.0-1.0)
 * @property {number} FUNCTION_WORD_RATIO - Bold ratio for function words (0.0-1.0)
 * @property {number} SHORT_WORD_THRESHOLD - Length threshold for short words
 * @property {number} INTENSITY_BASE_MULTIPLIER - Base multiplier for intensity scaling
 * @property {number} INTENSITY_RANGE - Range for intensity scaling
 * @property {number} INTENSITY_MAX_MULTIPLIER - Maximum intensity multiplier
 * @property {number} SMALL_WORD_RATIO - Bold ratio for small words
 * @property {number} SMALL_WORD_THRESHOLD - Length threshold for small words
 * @property {number} MIN_BOLD_RATIO - Minimum bold ratio allowed
 * @property {number} MAX_BOLD_RATIO - Maximum bold ratio allowed
 * @property {number} OBSERVER_MIN_DELAY - Minimum observer delay (ms)
 * @property {number} OBSERVER_MAX_DELAY - Maximum observer delay (ms)
 * @property {number} OBSERVER_DELAY_PER_NODE - Delay per node (ms)
 * @property {number} OBSERVER_CONTINUOUS_READING_GAP - Gap for continuous reading (ms)
 * @property {boolean} ENABLE_DIGRAPH_PROTECTION - Whether to protect digraphs
 * @property {boolean} ENABLE_VOWEL_OPTIMIZATION - Whether to optimize vowel positions
 */

/** @type {BionicConfig} */
const CONFIG = {
  CSS: {
    FIXATION: 'bionic-fixation',
    WRAPPER: 'bionic-wrapper',
    NOTIFICATION: 'bionic-notification',
    ENABLED: 'bionic-reading-enabled'
  },

  MAX_NODES_PER_BATCH: 100,
  MAX_TOTAL_NODES: 3000,
  MAX_TEXT_LENGTH: 25000,
  PROCESSING_TIMEOUT: 8000,
  BATCH_DELAY: 25,
  
  // Bionic Reading Parameters - CORRECTED
  CONTENT_WORD_RATIO: 0.5,     // Content words (nouns, verbs, adjectives)
  FUNCTION_WORD_RATIO: 0.35,   // Function words (articles, prepositions, etc.)
  SHORT_WORD_THRESHOLD: 2,     // Words ≤ 2 letters always bold first letter only
  
  // Bionic Reading Algorithm Constants
  INTENSITY_BASE_MULTIPLIER: 0.5,      // Maps 0 intensity to 0.5x base ratio
  INTENSITY_RANGE: 1.0,                // Maps 1 intensity to 1.5x base ratio (0.5 + 1.0)
  INTENSITY_MAX_MULTIPLIER: 2.0,       // Hard cap at 2.0x base ratio
  SMALL_WORD_RATIO: 0.66,              // Words ≤ 3 letters bold 66% of letters
  SMALL_WORD_THRESHOLD: 3,             // Threshold for "small" vs "long" words
  MIN_BOLD_RATIO: 0.05,                // Never bold less than 5% of word
  MAX_BOLD_RATIO: 0.95,                // Never bold more than 95% of word
  
  OBSERVER_MIN_DELAY: 300,             // Minimum delay before processing new nodes (ms)
  OBSERVER_MAX_DELAY: 1500,            // Maximum delay before processing new nodes (ms)
  OBSERVER_DELAY_PER_NODE: 30,         // Additional delay per new node (ms)
  OBSERVER_CONTINUOUS_READING_GAP: 30000,  // Gap to consider reading continuous (ms)
  
  ENABLE_PERFORMANCE_MONITORING: DEBUG_MODE,  // Track processing performance
  PERFORMANCE_LOG_THRESHOLD: 100,      // Only log operations taking > 100ms
  
  // Optional features
  ENABLE_DIGRAPH_PROTECTION: true,
  ENABLE_VOWEL_OPTIMIZATION: false // Disabled for more predictable results
};

let bionicIntensity = 0.5;
// Coverage (0..1) controls bolding visual weight (how heavy the bold looks)
let bionicCoverage = 0.4;

// State management
let bionicEnabled = false;
let originalTexts = new WeakMap();
let processedNodes = new Set();
let isProcessing = false;
let processedCount = 0;
let processingAbortController = null;

// Per-site settings flag
let usingSiteSpecificSettings = false;
let currentSiteOrigin = null;

const functionWordCache = new Map();

/**
 * @typedef {Object} SessionStats
 * @property {number} wordsProcessed - Total words processed in current session
 * @property {number|null} startTime - Session start timestamp
 * @property {number} activeTime - Total active reading time in milliseconds
 * @property {number} lastActiveTime - Last activity timestamp
 */

/** @type {SessionStats} */
let sessionStats = {
  wordsProcessed: 0,
  startTime: null,
  activeTime: 0,
  lastActiveTime: Date.now()
};

// Statistics preference (default enabled for enhanced user insights)
let statsTrackingEnabled = true;

/**
 * Tracks words processed in the current session for reading statistics.
 * Only tracks if statsTrackingEnabled is true.
 * 
 * @param {string} text - Text content to count words from
 * @returns {number} Number of words counted in the text
 * 
 * @example
 * trackWordsProcessed("Hello world") // Returns 2
 */
function trackWordsProcessed(text) {
  // Only track if statistics are enabled
  if (!statsTrackingEnabled || !text) return 0;
  
  const words = text.match(/\b[a-zA-Z]+\b/g) || [];
  const wordCount = words.length;
  sessionStats.wordsProcessed += wordCount;
  
  // Track active reading time
  const now = Date.now();
  if (sessionStats.startTime === null) {
    sessionStats.startTime = now;
  }
  
  // If less than 30 seconds since last activity, count as continuous reading
  if (now - sessionStats.lastActiveTime < CONFIG.OBSERVER_CONTINUOUS_READING_GAP) {
    sessionStats.activeTime += (now - sessionStats.lastActiveTime);
  }
  sessionStats.lastActiveTime = now;
  
  return wordCount;
}

/**
 * Saves current session reading statistics to Chrome local storage.
 * Merges with existing daily totals if available.
 * 
 * Only saves if statsTrackingEnabled is true and there are words processed.
 * 
 * @returns {void}
 */
function saveStatsToStorage() {
  // Only save if statistics tracking is enabled and there's data to save
  if (!statsTrackingEnabled || !chrome?.storage?.local || sessionStats.wordsProcessed === 0) return;
  
  const today = new Date().toDateString();
  const sessionData = {
    wordsProcessed: sessionStats.wordsProcessed,
    activeTime: sessionStats.activeTime,
    date: today,
    timestamp: Date.now()
  };
  
  // Get existing daily stats
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
}

// Common English digraphs that should stay together
const DIGRAPHS = new Set([
  'ch', 'sh', 'th', 'wh', 'ph', 'gh', 'ck', 'ng', 'qu', 'sc', 'sk', 'sp', 
  'st', 'sw', 'tw', 'scr', 'shr', 'spl', 'spr', 'str', 'thr'
]);

// EXPANDED Function words that get lower importance (r = 0.35)
const FUNCTION_WORDS = new Set([
  // Articles
  'a', 'an', 'the',
  // Prepositions
  'in', 'on', 'at', 'by', 'for', 'with', 'from', 'to', 'of', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down',
  'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  // Conjunctions
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'because', 'since', 'unless',
  'while', 'where', 'after', 'so', 'though', 'whether', 'if', 'when',
  // Pronouns
  'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves',
  'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  // Common verbs (to be, to have, etc.)
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'shall', 'can', 'ought',
  // Other common function words
  'not', 'no', 'yes', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'only', 'own', 'same', 'than', 'too', 'very',
  // Additional common words
  'as', 'also', 'just', 'now', 'how', 'here', 'there', 'get', 'got', 'use'
]);


/**
 * Determines if a word is a function word (articles, prepositions, etc.) 
 * or a content word (nouns, verbs, adjectives).
 * 
 * Function words receive lower bolding emphasis (35%) vs content words (50%).
 * Uses memoization cache for performance.
 * 
 * @param {string} word - Word to classify
 * @returns {boolean} True if word is a function word, false if content word
 * 
 * @example
 * isFunctionWord("the")     // true
 * isFunctionWord("reading") // false
 */
function isFunctionWord(word) {
  const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
  
  // Check cache first for performance
  if (functionWordCache.has(cleanWord)) {
    return functionWordCache.get(cleanWord);
  }
  
  const result = FUNCTION_WORDS.has(cleanWord);
  
  // Cache result for future lookups, but limit cache size to prevent memory bloat
  if (functionWordCache.size < 10000) {
    functionWordCache.set(cleanWord, result);
  }
  
  return result;
}

/**
 * Validates if text input is suitable for bionic transformation.
 * 
 * Checks that text is non-empty, has minimum length, and contains
 * sufficient letter content (>50% letters).
 * 
 * @param {string} text - Text to validate
 * @returns {boolean} True if text is valid for transformation
 * 
 * @example
 * isValidTransformInput("Hello")     // true
 * isValidTransformInput("Hi")        // false (too short)
 * isValidTransformInput("12345")     // false (not enough letters)
 */
function isValidTransformInput(text) {
  if (!text || typeof text !== 'string') return false;
  if (text.trim().length < 5) return false;
  
  // Check if text has meaningful content (>50% letters)
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
  return letterCount >= text.length * 0.5;
}

/**
 * Calculates which letter positions should be bolded in a word using the Bionic Reading algorithm.
 * 
 * Algorithm:
 * 1. Determine base ratio based on word length and type (function vs content word)
 * 2. Scale ratio by user's intensity preference (0.0 - 1.0)
 * 3. Apply ratio to word length to get number of letters to bold
 * 4. Return array of letter indices to make bold
 * 
 * @param {string} word - The word to calculate bold positions for
 * @returns {number[]} Array of letter indices (0-based) that should be bolded
 * 
 * @example
 * calculateBionicBoldPositions("reading") // Returns [0, 1, 2] for "REAding"
 * calculateBionicBoldPositions("the")     // Returns [0] for "The" (function word)
 */
function calculateBionicBoldPositions(word) {
  const letters = word.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 2) return [];
  
  const N = letters.length;
  const letterString = letters.join('');
  const isFunction = isFunctionWord(word);
  
  // Base ratio depends on word length and type
  const baseRatio = N <= CONFIG.SMALL_WORD_THRESHOLD 
    ? CONFIG.SMALL_WORD_RATIO 
    : (isFunction ? CONFIG.FUNCTION_WORD_RATIO : CONFIG.CONTENT_WORD_RATIO);
  
  // Scale by intensity: multiplier ranges from 0.5 to 1.5 (default 1.0 at intensity=0.5)
  const intensityMultiplier = Math.max(
    0, 
    Math.min(
      CONFIG.INTENSITY_MAX_MULTIPLIER,
      CONFIG.INTENSITY_BASE_MULTIPLIER + Number(bionicIntensity || 0.5) * CONFIG.INTENSITY_RANGE
    )
  );
  
  const scaled = Math.max(
    CONFIG.MIN_BOLD_RATIO,
    Math.min(CONFIG.MAX_BOLD_RATIO, baseRatio * intensityMultiplier)
  );
  
  const B = Math.min(N - 1, Math.max(1, Math.ceil(N * scaled)));
  
  return Array.from({ length: B }, (_, i) => i);
}

/**
 * Determines if a word should be processed for bionic transformation.
 * 
 * Filters out invalid text, short words, and already-processed words.
 * 
 * @param {string} word - Word to check
 * @returns {boolean} True if word should be transformed
 */
function shouldProcessWord(word) {
  if (!word || typeof word !== 'string') return false;
  if (word.trim().length <= 1) return false;
  
  const letters = word.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 2) return false;
  if (word.includes(`<span class="${CONFIG.CSS.FIXATION}"`)) return false;
  
  return true;
}

/**
 * Wrapper function for transforming a single word with error handling.
 * 
 * @param {string} word - Word to transform
 * @returns {string} Transformed HTML or original word if processing fails
 */
function transformWord(word) {
  if (!shouldProcessWord(word)) return word;
  
  if (word.includes("'")) {
    const parts = word.split("'");
    return transformSingleWord(parts[0]) + "'" + parts.slice(1).join("'");
  }
  
  return transformSingleWord(word);
}

/**
 * Transforms a single word into bionic reading format by bolding specific letters.
 * 
 * Uses single-pass algorithm for performance.
 * Preserves non-letter characters (punctuation, numbers) in their original positions.
 * 
 * @param {string} word - Word to transform
 * @returns {string} HTML string with <span> tags for bolded letters
 * 
 * @example
 * transformSingleWord("reading") // Returns "REAding" with bold HTML
 */
function transformSingleWord(word) {
  // Build char-to-letter-index map in a single pass (O(n) instead of O(n²) findIndex)
  const charToLetterIdx = new Map();
  let letterCount = 0;
  for (let i = 0; i < word.length; i++) {
    if (/[a-zA-Z]/.test(word[i])) {
      charToLetterIdx.set(i, letterCount++);
    }
  }
  
  if (letterCount < 2) return word;
  
  const boldPositions = new Set(calculateBionicBoldPositions(word));
  if (boldPositions.size === 0) return word;
  
  const weight = Math.round(300 + (bionicIntensity * 600));
  
  const parts = [];
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const letterIdx = charToLetterIdx.get(i);
    
    if (letterIdx !== undefined && boldPositions.has(letterIdx)) {
      parts.push(`<span class="${CONFIG.CSS.FIXATION}" style="font-weight:${weight}">${ch}</span>`);
    } else {
      parts.push(ch);
    }
  }
  
  return parts.join('');
}

/**
 * Transforms a text string into bionic reading format.
 * 
 * Splits text into words, transforms each word, tracks statistics,
 * and applies security limits.
 * 
 * @param {string} text - Text to transform
 * @returns {string} Transformed HTML with bionic formatting
 * 
 * @example
 * transformText("Hello world") // Returns bionic-formatted HTML
 */
function transformText(text) {
  if (!isValidTransformInput(text)) return text;
  
  if (text.length > CONFIG.MAX_TEXT_LENGTH) {
    text = text.substring(0, CONFIG.MAX_TEXT_LENGTH);
  }
  
  try {
    const parts = text.split(/(\s+)/);
    
    const result = parts.map(part => {
      if (/^\s+$/.test(part)) return part;
      try {
        return transformWord(part);
      } catch (wordError) {
        logger.warn('[Transform] Word error:', part, wordError);
        return part;
      }
    }).join('');
    
    return result;
  } catch (error) {
    logger.error('[Transform] Error:', error);
    return text;
  }
}

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TITLE', 'BUTTON', 'LABEL',
  'SELECT', 'OPTION', 'CANVAS', 'SVG', 'NAV', 'HEADER', 'FOOTER'
]);

const SKIP_ROLES = new Set(['navigation', 'banner', 'complementary', 'contentinfo', 'toolbar']);

function shouldSkipElement(element) {
  if (!element || !element.tagName) return true;
  
  if (SKIP_TAGS.has(element.tagName)) return true;
  if (element.contentEditable === 'true') return true;
  
  const className = (typeof element.className === 'string' ? element.className : element.className?.baseVal || '').toLowerCase();
  if (/\b(nav|menu|header|footer|sidebar|breadcrumb|toolbar|navigation|pagination)\b/.test(className)) return true;
  
  const role = element.getAttribute('role');
  if (role && SKIP_ROLES.has(role)) return true;
  
  // Skip short links and buttons
  if ((element.tagName === 'A' || element.tagName === 'BUTTON') && 
      element.textContent && element.textContent.trim().length < 20) return true;
  
  return false;
}

function createSelectableWrapper(transformedHTML, originalText) {
  const wrapper = document.createElement('span');
  wrapper.className = CONFIG.CSS.WRAPPER;
  wrapper.innerHTML = transformedHTML;
  
  // Ensure text is copyable
  wrapper.addEventListener('copy', function(e) {
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', originalText);
      e.preventDefault();
    }
  });
  
  // Proper text selection
  wrapper.style.userSelect = 'text';
  wrapper.style.webkitUserSelect = 'text';
  wrapper.style.mozUserSelect = 'text';
  
  return wrapper;
}

function mergeAdjacentTextNodes(textNodes) {
  const merged = [];
  let currentGroup = [];
  
  for (const node of textNodes) {
    if (currentGroup.length === 0) {
      currentGroup.push(node);
      continue;
    }
    
    const lastNode = currentGroup[currentGroup.length - 1];
    const lastParent = lastNode.parentNode;
    const currentParent = node.parentNode;
    
    // Check if nodes are adjacent siblings in same parent
    if (lastParent === currentParent && 
        lastNode.nextSibling === node) {
      currentGroup.push(node);
    } else {
      merged.push(currentGroup);
      currentGroup = [node];
    }
  }
  
  if (currentGroup.length > 0) {
    merged.push(currentGroup);
  }
  
  return merged;
}

async function processTextNodesBatch(textNodes, startIndex = 0, signal = null) {
  // Check for abort signal
  if (signal?.aborted) {
    logger.debug('[Batch] Processing aborted');
    return processedCount;
  }
  
  const endIndex = Math.min(startIndex + CONFIG.MAX_NODES_PER_BATCH, textNodes.length);
  const batch = textNodes.slice(startIndex, endIndex);
  
  logger.debug(`Processing batch ${Math.floor(startIndex / CONFIG.MAX_NODES_PER_BATCH) + 1}: nodes ${startIndex} to ${endIndex - 1}`);
  
  const mergedGroups = mergeAdjacentTextNodes(batch);
  
  for (const nodeGroup of mergedGroups) {
    // Check abort before each group
    if (signal?.aborted) {
      logger.debug('[Batch] Processing aborted mid-batch');
      return processedCount;
    }
    
    try {
      if (nodeGroup.some(node => processedNodes.has(node))) continue;
      if (!nodeGroup.every(node => document.contains(node))) continue;
      
      const combinedText = nodeGroup.map(node => node.textContent).join('');
      if (!combinedText || combinedText.trim().length < 5) continue;
      
      const letterCount = (combinedText.match(/[a-zA-Z]/g) || []).length;
      if (letterCount < combinedText.length * 0.5) continue;
      
      logger.debug(`[BATCH] Processing merged text: "${combinedText}"`);
      const transformedHTML = transformText(combinedText);
      
      // Track words processed for statistics
      trackWordsProcessed(combinedText);
      
      if (transformedHTML !== combinedText && transformedHTML.includes(`<span class="${CONFIG.CSS.FIXATION}"`)) {
        logger.debug(`[BATCH] Transformed: "${transformedHTML}"`);
        const wrapper = createSelectableWrapper(transformedHTML, combinedText);
        
        originalTexts.set(wrapper, combinedText);
        processedNodes.add(wrapper);
        
        // Replace first node with wrapper, remove others
        nodeGroup[0].parentNode.replaceChild(wrapper, nodeGroup[0]);
        for (let i = 1; i < nodeGroup.length; i++) {
          if (nodeGroup[i].parentNode) {
            nodeGroup[i].parentNode.removeChild(nodeGroup[i]);
          }
        }
        processedCount++;
      }
    } catch (error) {
      logger.error('Error processing text node group:', error);
    }
  }
  
  if (endIndex < textNodes.length && processedCount < CONFIG.MAX_TOTAL_NODES) {
    await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY));
    return processTextNodesBatch(textNodes, endIndex, signal);
  }
  
  return processedCount;
}

/**
 * Main function to process text nodes in the DOM with performance monitoring.
 * Uses batch processing with AbortController for cancellation.
 * 
 * @param {HTMLElement} element - Root element to process
 * @returns {Promise<void>}
 */
async function processTextNodes(element) {
  if (!element || shouldSkipElement(element) || isProcessing) return;
  
  isProcessing = true;
  
  // Performance monitoring stuff
  if (CONFIG.ENABLE_PERFORMANCE_MONITORING) {
    performance.mark('bionic-process-start');
  }
  
  // Create abort controller for this processing session
  processingAbortController = new AbortController();
  
  try {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (shouldSkipElement(node.parentElement)) return NodeFilter.FILTER_REJECT;
          if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
          if (node.textContent.trim().length < 5) return NodeFilter.FILTER_REJECT;
          if (node.parentElement && node.parentElement.classList.contains(CONFIG.CSS.WRAPPER)) return NodeFilter.FILTER_REJECT;
          if (processedNodes.has(node)) return NodeFilter.FILTER_REJECT;
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    const textNodes = [];
    let node;
    
    while ((node = walker.nextNode()) && textNodes.length < CONFIG.MAX_TOTAL_NODES) {
      textNodes.push(node);
    }
    
    logger.debug(`Found ${textNodes.length} text nodes to process`);
    
    if (textNodes.length === 0) {
      isProcessing = false;
      processingAbortController = null;
      return;
    }
    
    const timeoutId = setTimeout(() => {
      logger.warn('[Security] Processing timeout reached, stopping');
      if (processingAbortController) {
        processingAbortController.abort();
      }
      isProcessing = false;
    }, CONFIG.PROCESSING_TIMEOUT);
    
    const processed = await processTextNodesBatch(
      textNodes, 
      0, 
      processingAbortController.signal
    );
    clearTimeout(timeoutId);
    
    logger.debug(`Successfully processed ${processed} text nodes`);
    
  } catch (error) {
    logger.error('Error in processTextNodes:', error);
  } finally {
    isProcessing = false;
    processingAbortController = null;
    
    // More performance monitoring stuff
    if (CONFIG.ENABLE_PERFORMANCE_MONITORING) {
      performance.mark('bionic-process-end');
      performance.measure(
        'bionic-processing',
        'bionic-process-start',
        'bionic-process-end'
      );
      
      const measure = performance.getEntriesByName('bionic-processing')[0];
      if (measure && measure.duration > CONFIG.PERFORMANCE_LOG_THRESHOLD) {
        logger.debug(`[Performance] Processing took ${measure.duration.toFixed(2)}ms`);
      }
      
      // Clear marks to prevent memory leak
      performance.clearMarks('bionic-process-start');
      performance.clearMarks('bionic-process-end');
      performance.clearMeasures('bionic-processing');
    }
  }
}

async function enableBionic() {
  if (bionicEnabled || isProcessing) return;
  
  logger.debug('Enabling FULLY FIXED Bionic Reading...');
  bionicEnabled = true;
  processedCount = 0;
  processedNodes.clear();
  document.body.classList.add(CONFIG.CSS.ENABLED);
  
  showNotification('ðŸ§  Fixed Bionic Reading activated!', 'success');
  
  // Focus on main content with priority order
  const contentSelectors = [
    'article',
    'main',
    '.content',
    '.post-content',
    '.entry-content',
    '[role="main"]',
    '.article-body',
    '.text-content'
  ];
  
  let processed = false;
  
  for (const selector of contentSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      logger.debug(`Processing ${elements.length} elements with selector: ${selector}`);
      for (const element of elements) {
        await processTextNodes(element);
        if (processedCount >= CONFIG.MAX_TOTAL_NODES) break;
      }
      processed = true;
      break;
    }
  }
  
  // Fallback to quality paragraphs
  if (!processed && processedCount < CONFIG.MAX_TOTAL_NODES) {
    logger.debug('Processing quality paragraphs');
    const paragraphs = document.querySelectorAll('p');
    
    const qualityParagraphs = Array.from(paragraphs)
      .filter(p => {
        const text = p.textContent.trim();
        const wordCount = text.split(/\s+/).length;
        const meaningfulWords = text.split(/\s+/).filter(w => w.length >= 4).length;
        return text.length >= 40 && wordCount >= 6 && meaningfulWords >= 3 && !shouldSkipElement(p);
      })
      .sort((a, b) => b.textContent.length - a.textContent.length)
      .slice(0, 30);
    
    for (const element of qualityParagraphs) {
      await processTextNodes(element);
      if (processedCount >= CONFIG.MAX_TOTAL_NODES) break;
    }
  }
  
  logger.debug(`Fixed Bionic Reading enabled - processed ${processedCount} nodes total`);
  
  // Start observing for dynamic content
  startObserver();
  
  // Save stats when processing is complete
  saveStatsToStorage();
  
  if (processedCount > 0) {
    setTimeout(() => {
    showNotification(`âœ… Enhanced ${processedCount} sections â€“ enjoy faster reading!`, 'success');
    }, 800);
  } else {
  showNotification('â„¹ï¸ No suitable text found on this page', 'info');
  }
}

function disableBionic() {
  if (!bionicEnabled) return;
  
  logger.debug('Disabling Bionic Reading...');
  bionicEnabled = false;
  document.body.classList.remove(CONFIG.CSS.ENABLED);
  
  // Abort any in-progress processing
  if (processingAbortController) {
    processingAbortController.abort();
    processingAbortController = null;
  }
  
  isProcessing = false;
  stopObserver();
  
  // Clear function word cache to free memory
  functionWordCache.clear();
  
  // Save final session stats
  saveStatsToStorage();
  
  showNotification('ðŸ“– Normal reading restored', 'info');
  
  const wrappers = document.querySelectorAll(`.${CONFIG.CSS.WRAPPER}`);
  logger.debug(`Removing ${wrappers.length} bionic wrappers`);
  
  wrappers.forEach(wrapper => {
    const parent = wrapper.parentNode;
    if (parent) {
      const originalText = originalTexts.get(wrapper) || wrapper.textContent;
      const textNode = document.createTextNode(originalText);
      parent.replaceChild(textNode, wrapper);
      originalTexts.delete(wrapper);
    }
  });
  
  processedNodes.clear();
  processedCount = 0;
}

function showNotification(message, type = 'info') {
  const existing = document.querySelector(`.${CONFIG.CSS.NOTIFICATION}`);
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = `${CONFIG.CSS.NOTIFICATION} bionic-${type}`;
  notification.textContent = message;
  
  let bgColor = '#2196F3';
  if (type === 'success') bgColor = '#4CAF50';
  if (type === 'warning') bgColor = '#FF9800';
  if (type === 'error') bgColor = '#F44336';
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateX(100px);
    max-width: 350px;
  `;
  
  document.body.appendChild(notification);
  
  requestAnimationFrame(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  });
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100px)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Load site-specific settings or fall back to global settings
 */
async function loadSiteSettings() {
  try {
    currentSiteOrigin = window.location.origin;
    
    // Request settings from background script
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getsitesettings' }, resolve);
    });
    
    if (response && response.success && response.settings) {
      const settings = response.settings;
      
      bionicEnabled = Boolean(settings.enabled);
      bionicIntensity = Number(settings.intensity) || 0.5;
      bionicCoverage = Number(settings.coverage) || 0.4;
      usingSiteSpecificSettings = Boolean(settings.isCustomized);
      
      logger.debug('[SiteSettings] Loaded settings:', {
        origin: currentSiteOrigin,
        enabled: bionicEnabled,
        intensity: bionicIntensity,
        coverage: bionicCoverage,
        customized: usingSiteSpecificSettings
      });
      
      // Auto-enable if site settings say to
      if (bionicEnabled) {
        enableBionic();
      }
    } else {
      // Fallback to legacy global settings
      chrome.storage.sync.get({
        bionicIntensity: 0.5,
        bionicCoverage: 0.4
      }, (items) => {
        bionicIntensity = Number(items.bionicIntensity) || 0.5;
        bionicCoverage = Number(items.bionicCoverage) || 0.4;
        logger.debug('[SiteSettings] Using global fallback settings');
      });
    }
  } catch (error) {
    logger.error('[SiteSettings] Error loading site settings:', error);
  }
}

function toggleBionic() {
  logger.debug('Toggle called, current state:', bionicEnabled);
  if (bionicEnabled) {
    disableBionic();
  } else {
    enableBionic();
  }
  
  // Save site-specific enabled state
  if (usingSiteSpecificSettings || currentSiteOrigin) {
    chrome.runtime.sendMessage({
      action: 'setsitesettings',
      enabled: bionicEnabled,
      intensity: bionicIntensity,
      coverage: bionicCoverage
    }, (response) => {
      if (response && response.success) {
        usingSiteSpecificSettings = true;
        logger.debug('[SiteSettings] Saved enabled state for site:', bionicEnabled);
      }
    });
  }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.debug('Content script received message:', request);
  
  const action = String(request.action || '').toLowerCase().trim();
  
  switch (action) {
    case 'toggle':
      toggleBionic();
      sendResponse({ 
        success: true, 
        enabled: bionicEnabled,
        timestamp: Date.now(),
        processedNodes: processedCount
      });
      break;
      
    case 'getstatus':
      sendResponse({ 
        success: true, 
        enabled: bionicEnabled,
        timestamp: Date.now(),
        processedNodes: processedCount,
        isProcessing: isProcessing,
        sessionStats: {
          wordsProcessed: sessionStats.wordsProcessed,
          activeTime: sessionStats.activeTime,
          startTime: sessionStats.startTime
        }
      });
      break;
      
    case 'processselection':
      // Process only the selected text (from context menu)
      const selectedText = request.text;
      if (selectedText && typeof selectedText === 'string') {
        try {
          // Find the selection in the DOM and process it
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            
            // Get the text nodes within the selection
            const textNodes = [];
            const walker = document.createTreeWalker(
              container.nodeType === Node.TEXT_NODE ? container.parentNode : container,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: (node) => {
                  // Check if this text node intersects with the selection
                  if (selection.containsNode(node, true)) {
                    return NodeFilter.FILTER_ACCEPT;
                  }
                  return NodeFilter.FILTER_REJECT;
                }
              }
            );
            
            let node;
            while (node = walker.nextNode()) {
              if (node.textContent.trim() && !shouldSkipElement(node.parentElement)) {
                textNodes.push(node);
              }
            }
            
            // Process the selected text nodes
            if (textNodes.length > 0) {
              processTextNodes(textNodes);
              sendResponse({ 
                success: true, 
                nodesProcessed: textNodes.length,
                message: 'Selection processed'
              });
            } else {
              sendResponse({ 
                success: false, 
                message: 'No processable text in selection'
              });
            }
          } else {
            sendResponse({ 
              success: false, 
              message: 'No active selection'
            });
          }
        } catch (error) {
          logger.error('[Selection] Error processing selection:', error);
          sendResponse({ 
            success: false, 
            error: error.message
          });
        }
      } else {
        sendResponse({ 
          success: false, 
          message: 'No text provided'
        });
      }
      break;
      
    case 'getstats':
      sendResponse({
        success: true,
        sessionStats: sessionStats,
        statsEnabled: statsTrackingEnabled
      });
      break;
      
    case 'setstatsenabled':
      const enabled = Boolean(request.statsEnabled);
      statsTrackingEnabled = enabled;
      logger.debug(`[STATS] Statistics tracking ${enabled ? 'enabled' : 'disabled'}`);
      
      // If disabling, save current session stats before clearing
      if (!enabled && sessionStats.wordsProcessed > 0) {
        saveStatsToStorage();
      }
      
      sendResponse({ success: true, statsEnabled: statsTrackingEnabled });
      break;
      
    case 'setintensity':
      const v = Number(request.intensity);
      const c = Number(request.coverage);
      
      // Validate intensity parameter
      if (!isNaN(v) && v >= 0 && v <= 1) {
        bionicIntensity = Math.max(0, Math.min(1, v));
        logger.debug('[BIONIC] Intensity set to', bionicIntensity);
      } else {
        logger.warn('[Security] Invalid intensity value:', request.intensity);
        sendResponse({ error: 'Invalid intensity value', code: 'INVALID_PARAM' });
        return true;
      }
      
      // Validate coverage parameter separately
      if (!isNaN(c) && c >= 0 && c <= 1) {
        bionicCoverage = Math.max(0, Math.min(1, c));
        logger.debug('[BIONIC] Coverage (weight) set to', bionicCoverage);
      } else if (request.coverage !== undefined) {
        logger.warn('[Security] Invalid coverage value:', request.coverage);
        sendResponse({ error: 'Invalid coverage value', code: 'INVALID_PARAM' });
        return true;
      }

      // Compute font-weight using coverage
      const weight = Math.round(200 + (bionicCoverage * 800));
      const wrappers = document.querySelectorAll(`.${CONFIG.CSS.WRAPPER}`);
      
      wrappers.forEach(wrapper => {
        try {
          const original = originalTexts.get(wrapper) || wrapper.textContent || '';
          // Re-transform using the new intensity while preserving original text
          const transformed = transformText(original);
          
          // Replace innerHTML only if transformation produced bionic spans
          if (transformed && transformed !== original && transformed.includes(CONFIG.CSS.FIXATION)) {
            wrapper.innerHTML = transformed;
            wrapper.querySelectorAll(`.${CONFIG.CSS.FIXATION}`).forEach(s => s.style.fontWeight = weight);
          } else {
            wrapper.querySelectorAll(`.${CONFIG.CSS.FIXATION}`).forEach(s => s.style.fontWeight = weight);
          }
        } catch (err) {
          wrapper.querySelectorAll(`.${CONFIG.CSS.FIXATION}`).forEach(s => s.style.fontWeight = weight);
        }
      });

      sendResponse({ success: true, intensity: bionicIntensity, coverage: bionicCoverage });
      return true;
      
    case 'reloadsettings':
      // Reload settings from storage (used when site settings are cleared)
      loadSiteSettings().then(() => {
        if (bionicEnabled) {
          // Reprocess with new settings
          disableBionic();
          enableBionic();
        }
        sendResponse({ success: true });
      });
      return true; // Keep channel open for async response
      
    default:
      sendResponse({ error: 'Unknown action', code: 'UNKNOWN_ACTION' });
  }
  
  return false;
});

// Load saved settings from storage if available
if (chrome && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get({ 
    bionicIntensity: 0.5, 
    bionicCoverage: 0.4, 
    statsTrackingEnabled: true 
  }, (items) => {
    const v = Number(items.bionicIntensity);
    const c = Number(items.bionicCoverage);
    const stats = Boolean(items.statsTrackingEnabled);
    
    if (!isNaN(v)) {
      bionicIntensity = Math.max(0, Math.min(1, v));
      logger.debug('[BIONIC] Loaded intensity from storage:', bionicIntensity);
    }
    if (!isNaN(c)) {
      bionicCoverage = Math.max(0, Math.min(1, c));
      logger.debug('[BIONIC] Loaded coverage from storage:', bionicCoverage);
    }
    
    statsTrackingEnabled = stats;
    logger.debug('[STATS] Loaded statistics preference from storage:', statsTrackingEnabled);
  });
}

// Dynamic content observer - refactored for proper lifecycle management
let mutationObserver = null;

function startObserver() {
  if (mutationObserver) return; // Already observing
  
  mutationObserver = new MutationObserver((mutations) => {
    if (!bionicEnabled || isProcessing) return;
    
    let hasNewText = false;
    let newNodes = [];
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE || 
            (node.nodeType === Node.ELEMENT_NODE && 
             !node.classList.contains(CONFIG.CSS.WRAPPER) &&
             !node.classList.contains(CONFIG.CSS.NOTIFICATION))) {
          hasNewText = true;
          newNodes.push(node);
        }
      });
    });
    
    if (hasNewText && newNodes.length > 0) {
      clearTimeout(mutationObserver.timeout);
      
      const delay = Math.min(
        CONFIG.OBSERVER_MAX_DELAY,
        Math.max(CONFIG.OBSERVER_MIN_DELAY, newNodes.length * CONFIG.OBSERVER_DELAY_PER_NODE)
      );
      
      mutationObserver.timeout = setTimeout(async () => {
        if (processedCount >= CONFIG.MAX_TOTAL_NODES) return;
        
        logger.debug(`Processing ${newNodes.length} new nodes from dynamic content`);
        
        for (const node of newNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && 
              !node.classList.contains(CONFIG.CSS.WRAPPER) &&
              processedCount < CONFIG.MAX_TOTAL_NODES) {
            
            const textContent = node.textContent || '';
            if (textContent.trim().length > 30) {
              await processTextNodes(node);
            }
          }
        }
      }, delay);
    }
  });
  
  if (document.body) {
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

function stopObserver() {
  if (mutationObserver) {
    mutationObserver.disconnect();
    if (mutationObserver.timeout) {
      clearTimeout(mutationObserver.timeout);
    }
    mutationObserver = null;
  }
}

// Don't start observer until bionic mode enabled
// Observer will be started by enableBionic() function

// Load site-specific settings on page load
loadSiteSettings();

logger.debug('FULLY FIXED Bionic Reader content script loaded and ready');
