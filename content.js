// Bionic Reading Extension - COMPLETELY FIXED Implementation
'use strict';

// Debug mode flag - set to true only for development
const DEBUG_MODE = false;

// Debug logging utility
function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

// Configuration based on official Bionic Reading research
const CONFIG = {
  MAX_NODES_PER_BATCH: 100,
  MAX_TOTAL_NODES: 3000,
  MAX_TEXT_LENGTH: 25000,
  PROCESSING_TIMEOUT: 8000,
  BATCH_DELAY: 25,
  
  // Bionic Reading Parameters - CORRECTED
  CONTENT_WORD_RATIO: 0.5,     // Content words (nouns, verbs, adjectives)
  FUNCTION_WORD_RATIO: 0.35,   // Function words (articles, prepositions, etc.)
  SHORT_WORD_THRESHOLD: 2,     // Words ≤ 2 letters always bold first letter only
  
  // Optional features
  ENABLE_DIGRAPH_PROTECTION: true,
  ENABLE_VOWEL_OPTIMIZATION: false // Disabled for more predictable results
};

// Intensity (0..1) controls how aggressive bolding is; default 0.5
let BIONIC_INTENSITY = 0.5;
// Coverage (0..1) controls bolding visual weight (how heavy the bold looks)
let BIONIC_COVERAGE = 0.4;

// State management
let bionicEnabled = false;
let originalTexts = new WeakMap();
let processedNodes = new Set();
let isProcessing = false;
let processedCount = 0;
let processingAbortController = null;

// Statistics tracking
let sessionStats = {
  wordsProcessed: 0,
  startTime: null,
  activeTime: 0,
  lastActiveTime: Date.now()
};

// Statistics preference (default enabled for existing users)
let STATS_TRACKING_ENABLED = true;

// Statistics helper functions
function trackWordsProcessed(text) {
  // Only track if statistics are enabled
  if (!STATS_TRACKING_ENABLED || !text) return 0;
  
  const words = text.match(/\b[a-zA-Z]+\b/g) || [];
  const wordCount = words.length;
  sessionStats.wordsProcessed += wordCount;
  
  // Track active reading time
  const now = Date.now();
  if (sessionStats.startTime === null) {
    sessionStats.startTime = now;
  }
  
  // If less than 30 seconds since last activity, count as continuous reading
  if (now - sessionStats.lastActiveTime < 30000) {
    sessionStats.activeTime += (now - sessionStats.lastActiveTime);
  }
  sessionStats.lastActiveTime = now;
  
  debugLog(`[STATS] Processed ${wordCount} words. Session total: ${sessionStats.wordsProcessed} words`);
  return wordCount;
}

function saveStatsToStorage() {
  // Only save if statistics tracking is enabled and there's data to save
  if (!STATS_TRACKING_ENABLED || !chrome?.storage?.local || sessionStats.wordsProcessed === 0) return;
  
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
    
    chrome.storage.local.set({ [today]: updatedStats }, () => {
      debugLog(`[STATS] Saved daily stats:`, updatedStats);
    });
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

console.log('[DEBUG] Function words set includes "and":', FUNCTION_WORDS.has('and'));

/**
 * Determines if a word is a function word (gets r = 0.35) or content word (gets r = 0.5)
 */
function isFunctionWord(word) {
  const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
  return FUNCTION_WORDS.has(cleanWord);
}

/**
 * Finds the index of the first vowel in a word
 */
function indexOfFirstVowel(word) {
  const vowels = 'aeiouAEIOU';
  for (let i = 0; i < word.length; i++) {
    if (vowels.includes(word[i])) {
      return i;
    }
  }
  return -1; // No vowel found
}

/**
 * Checks if bolding at position B would split a digraph
 */
function splitsDigraph(word, B) {
  if (!CONFIG.ENABLE_DIGRAPH_PROTECTION || B >= word.length - 1 || B < 2) return false;
  
  // Check if there's a digraph that would be split by the boundary at position B
  // Look for digraphs that span across the boundary (positions B-1 and B)
  const potentialDigraph = word.slice(B - 1, B + 1).toLowerCase();
  return DIGRAPHS.has(potentialDigraph);
}

/**
 * FIXED Core Bionic Reading Algorithm - Bold count is deterministic
 */
function calculateBionicBoldPositions(word) {
  const letters = word.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 2) return [];
  
  const N = letters.length;
  const letterString = letters.join('');
  const isFunction = isFunctionWord(word);
  
  // Base ratio depends on small/long words and function/content words.
  const baseRatio = N <= 3 ? 0.66 : (isFunction ? CONFIG.FUNCTION_WORD_RATIO : CONFIG.CONTENT_WORD_RATIO);
  // Scale baseRatio by intensity so BIONIC_INTENSITY controls how many letters are bolded.
  // Use a reasonable multiplier range: multiplier = 0.5 + BIONIC_INTENSITY (maps 0..1 -> 0.5..1.5)
  const intensityMultiplier = Math.max(0, Math.min(2, 0.5 + Number(BIONIC_INTENSITY || 0.5)));
  const scaled = Math.max(0.05, Math.min(0.95, baseRatio * intensityMultiplier));
  const B = Math.min(N - 1, Math.max(1, Math.ceil(N * scaled)));
  
  const positions = [];
  for (let i = 0; i < B; i++) {
    positions.push(i);
  }
  
  debugLog(`[BIONIC] Word: "${word}" | Letters: "${letterString}" | Length: ${N} | Function: ${isFunction} | Bold positions: [${positions.join(', ')}]`);
  return positions;
}

function shouldProcessWord(word, index, words) {
  if (!word || word.length <= 1) return false;
  
  const letters = word.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 2) return false;
  
  // Skip if already processed (has bionic spans)
  if (word.includes('<span class="bionic-fixation"')) return false;
  
  return true;
}

function transformWord(word, index, words) {
  // Skip processing if word shouldn't be processed
  if (!shouldProcessWord(word, index, words)) return word;
  
  // Handle contractions by processing the main part
  if (word.includes("'")) {
    const parts = word.split("'");
    const transformedFirst = transformSingleWord(parts[0], index, words);
    return transformedFirst + "'" + parts.slice(1).join("'");
  }
  
  return transformSingleWord(word, index, words);
}

function transformSingleWord(word, index, words) {
  debugLog(`[TRANSFORM] Starting with word: "${word}"`);
  
  const letterPositions = [];
  const letters = [];
  
  for (let i = 0; i < word.length; i++) {
    if (/[a-zA-Z]/.test(word[i])) {
      letterPositions.push(i);
      letters.push(word[i]);
    }
  }
  
  if (letters.length < 2) return word;
  
  const boldPositions = calculateBionicBoldPositions(word);
  if (boldPositions.length === 0) return word;
  
  let result = '';
  
  // Map intensity [0,1] to font-weight range [300,900] for more visible difference
  const weight = Math.round(300 + (BIONIC_INTENSITY * 600));
  
  // Build result by wrapping bold letters individually with dynamic weight
  for (let i = 0; i < word.length; i++) {
    if (/[a-zA-Z]/.test(word[i])) {
      const letterIndex = letterPositions.indexOf(i);
      if (boldPositions.includes(letterIndex)) {
        result += `<span class="bionic-fixation" style="font-weight:${weight}">${word[i]}</span>`;
      } else {
        result += word[i];
      }
    } else {
      result += word[i];
    }
  }
  
  debugLog(`[TRANSFORM] "${word}" -> "${result}"`);
  return result;
}

function transformText(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Security: Limit text length
  if (text.length > CONFIG.MAX_TEXT_LENGTH) {
    console.warn('[Security] Text too long, truncating for processing');
    text = text.substring(0, CONFIG.MAX_TEXT_LENGTH);
  }
  
  debugLog(`[TEXT] Processing text: "${text}"`);
  
  try {
    // Split text into words while preserving all whitespace and punctuation
    const parts = text.split(/(\s+)/);
    
    const result = parts.map((part, index) => {
      // Keep whitespace exactly as-is
      if (/^\s+$/.test(part)) return part;
      
      // Transform words - each non-whitespace part is treated as a word
      try {
        return transformWord(part, index, parts);
      } catch (wordError) {
        console.warn('[Transform] Failed to transform word:', part, wordError);
        return part; // Return original word on error
      }
    }).join('');
    
    debugLog(`[TEXT] Result: "${result}"`);
    return result;
  } catch (error) {
    console.error('[Transform] Critical error in transformText:', error);
    return text; // Return original text on critical error
  }
}

function shouldSkipElement(element) {
  if (!element || !element.tagName) return true;
  
  const skipTags = [
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TITLE', 'BUTTON', 'LABEL',
    'SELECT', 'OPTION', 'CANVAS', 'SVG', 'NAV', 'HEADER', 'FOOTER'
  ];
  
  if (skipTags.includes(element.tagName)) return true;
  if (element.contentEditable === 'true') return true;
  
  // Skip navigation and UI elements
  const skipClasses = ['nav', 'menu', 'header', 'footer', 'sidebar', 'breadcrumb', 'toolbar', 'navigation', 'pagination'];
  const className = (element.className || '').toLowerCase();
  if (skipClasses.some(skip => className.includes(skip))) return true;
  
  // Skip by role
  const role = element.getAttribute('role');
  if (role && ['navigation', 'banner', 'complementary', 'contentinfo', 'toolbar'].includes(role)) return true;
  
  // Skip short links and buttons
  if ((element.tagName === 'A' || element.tagName === 'BUTTON') && 
      element.textContent && element.textContent.trim().length < 20) return true;
  
  return false;
}

function createSelectableWrapper(transformedHTML, originalText) {
  const wrapper = document.createElement('span');
  wrapper.className = 'bionic-wrapper';
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
    debugLog('[Batch] Processing aborted');
    return processedCount;
  }
  
  const endIndex = Math.min(startIndex + CONFIG.MAX_NODES_PER_BATCH, textNodes.length);
  const batch = textNodes.slice(startIndex, endIndex);
  
  console.log(`Processing batch ${Math.floor(startIndex / CONFIG.MAX_NODES_PER_BATCH) + 1}: nodes ${startIndex} to ${endIndex - 1}`);
  
  const mergedGroups = mergeAdjacentTextNodes(batch);
  
  for (const nodeGroup of mergedGroups) {
    // Check abort before each group
    if (signal?.aborted) {
      debugLog('[Batch] Processing aborted mid-batch');
      return processedCount;
    }
    
    try {
      if (nodeGroup.some(node => processedNodes.has(node))) continue;
      if (!nodeGroup.every(node => document.contains(node))) continue;
      
      const combinedText = nodeGroup.map(node => node.textContent).join('');
      if (!combinedText || combinedText.trim().length < 5) continue;
      
      const letterCount = (combinedText.match(/[a-zA-Z]/g) || []).length;
      if (letterCount < combinedText.length * 0.5) continue;
      
      debugLog(`[BATCH] Processing merged text: "${combinedText}"`);
      const transformedHTML = transformText(combinedText);
      
      // Track words processed for statistics
      trackWordsProcessed(combinedText);
      
      if (transformedHTML !== combinedText && transformedHTML.includes('<span class="bionic-fixation"')) {
        debugLog(`[BATCH] Transformed: "${transformedHTML}"`);
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
      console.error('Error processing text node group:', error);
    }
  }
  
  if (endIndex < textNodes.length && processedCount < CONFIG.MAX_TOTAL_NODES) {
    await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY));
    return processTextNodesBatch(textNodes, endIndex, signal);
  }
  
  return processedCount;
}

async function processTextNodes(element) {
  if (!element || shouldSkipElement(element) || isProcessing) return;
  
  isProcessing = true;
  
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
          if (node.parentElement && node.parentElement.classList.contains('bionic-wrapper')) return NodeFilter.FILTER_REJECT;
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
    
    console.log(`Found ${textNodes.length} text nodes to process`);
    
    if (textNodes.length === 0) {
      isProcessing = false;
      processingAbortController = null;
      return;
    }
    
    const timeoutId = setTimeout(() => {
      console.warn('[Security] Processing timeout reached, stopping');
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
    
    console.log(`Successfully processed ${processed} text nodes`);
    
  } catch (error) {
    console.error('Error in processTextNodes:', error);
  } finally {
    isProcessing = false;
    processingAbortController = null;
  }
}

async function enableBionic() {
  if (bionicEnabled || isProcessing) return;
  
  console.log('Enabling FULLY FIXED Bionic Reading...');
  bionicEnabled = true;
  processedCount = 0;
  processedNodes.clear();
  document.body.classList.add('bionic-reading-enabled');
  
  showNotification('🧠 Fixed Bionic Reading activated!', 'success');
  
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
      console.log(`Processing ${elements.length} elements with selector: ${selector}`);
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
    console.log('Processing quality paragraphs');
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
  
  console.log(`Fixed Bionic Reading enabled - processed ${processedCount} nodes total`);
  
  // Start observing for dynamic content
  startObserver();
  
  // Save stats when processing is complete
  saveStatsToStorage();
  
  if (processedCount > 0) {
    setTimeout(() => {
    showNotification(`✅ Enhanced ${processedCount} sections – enjoy faster reading!`, 'success');
    }, 800);
  } else {
  showNotification('ℹ️ No suitable text found on this page', 'info');
  }
}

function disableBionic() {
  if (!bionicEnabled) return;
  
  console.log('Disabling Bionic Reading...');
  bionicEnabled = false;
  document.body.classList.remove('bionic-reading-enabled');
  
  // Abort any in-progress processing
  if (processingAbortController) {
    processingAbortController.abort();
    processingAbortController = null;
  }
  
  isProcessing = false;
  
  // Stop observing dynamic content and clear timeouts
  stopObserver();
  
  // Save final session stats
  saveStatsToStorage();
  
  showNotification('📖 Normal reading restored', 'info');
  
  const wrappers = document.querySelectorAll('.bionic-wrapper');
  console.log(`Removing ${wrappers.length} bionic wrappers`);
  
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
  const existing = document.querySelector('.bionic-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = `bionic-notification bionic-${type}`;
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

function toggleBionic() {
  console.log('Toggle called, current state:', bionicEnabled);
  if (bionicEnabled) {
    disableBionic();
  } else {
    enableBionic();
  }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
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
      
    case 'getstats':
      sendResponse({
        success: true,
        sessionStats: sessionStats,
        statsEnabled: STATS_TRACKING_ENABLED
      });
      break;
      
    case 'setstatsenabled':
      const enabled = Boolean(request.statsEnabled);
      STATS_TRACKING_ENABLED = enabled;
      debugLog(`[STATS] Statistics tracking ${enabled ? 'enabled' : 'disabled'}`);
      
      // If disabling, save current session stats before clearing
      if (!enabled && sessionStats.wordsProcessed > 0) {
        saveStatsToStorage();
      }
      
      sendResponse({ success: true, statsEnabled: STATS_TRACKING_ENABLED });
      break;
      
    case 'setintensity':
      const v = Number(request.intensity);
      const c = Number(request.coverage);
      
      // Validate intensity parameter
      if (!isNaN(v) && v >= 0 && v <= 1) {
        BIONIC_INTENSITY = Math.max(0, Math.min(1, v));
        console.log('[BIONIC] Intensity set to', BIONIC_INTENSITY);
      } else {
        console.warn('[Security] Invalid intensity value:', request.intensity);
        sendResponse({ error: 'Invalid intensity value', code: 'INVALID_PARAM' });
        return true;
      }
      
      // Validate coverage parameter separately
      if (!isNaN(c) && c >= 0 && c <= 1) {
        BIONIC_COVERAGE = Math.max(0, Math.min(1, c));
        console.log('[BIONIC] Coverage (weight) set to', BIONIC_COVERAGE);
      } else if (request.coverage !== undefined) {
        console.warn('[Security] Invalid coverage value:', request.coverage);
        sendResponse({ error: 'Invalid coverage value', code: 'INVALID_PARAM' });
        return true;
      }

      // Compute font-weight using coverage
      const weight = Math.round(200 + (BIONIC_COVERAGE * 800));
      const wrappers = document.querySelectorAll('.bionic-wrapper');
      
      wrappers.forEach(wrapper => {
        try {
          const original = originalTexts.get(wrapper) || wrapper.textContent || '';
          // Re-transform using the new intensity while preserving original text
          const transformed = transformText(original);
          
          // Replace innerHTML only if transformation produced bionic spans
          if (transformed && transformed !== original && transformed.includes('bionic-fixation')) {
            wrapper.innerHTML = transformed;
            // Update font-weight for any existing spans
            wrapper.querySelectorAll('.bionic-fixation').forEach(s => s.style.fontWeight = weight);
          } else {
            // Fallback: update font-weight of existing spans
            wrapper.querySelectorAll('.bionic-fixation').forEach(s => s.style.fontWeight = weight);
          }
        } catch (err) {
          wrapper.querySelectorAll('.bionic-fixation').forEach(s => s.style.fontWeight = weight);
        }
      });

      sendResponse({ success: true, intensity: BIONIC_INTENSITY, coverage: BIONIC_COVERAGE });
      return true;
      
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
      BIONIC_INTENSITY = Math.max(0, Math.min(1, v));
      console.log('[BIONIC] Loaded intensity from storage:', BIONIC_INTENSITY);
    }
    if (!isNaN(c)) {
      BIONIC_COVERAGE = Math.max(0, Math.min(1, c));
      console.log('[BIONIC] Loaded coverage from storage:', BIONIC_COVERAGE);
    }
    
    STATS_TRACKING_ENABLED = stats;
    console.log('[STATS] Loaded statistics preference from storage:', STATS_TRACKING_ENABLED);
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
             !node.classList.contains('bionic-wrapper') &&
             !node.classList.contains('bionic-notification'))) {
          hasNewText = true;
          newNodes.push(node);
        }
      });
    });
    
    if (hasNewText && newNodes.length > 0) {
      clearTimeout(mutationObserver.timeout);
      const delay = Math.min(1500, Math.max(300, newNodes.length * 30));
      
      mutationObserver.timeout = setTimeout(async () => {
        if (processedCount >= CONFIG.MAX_TOTAL_NODES) return;
        
        console.log(`Processing ${newNodes.length} new nodes from dynamic content`);
        
        for (const node of newNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && 
              !node.classList.contains('bionic-wrapper') &&
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

console.log('FULLY FIXED Bionic Reader content script loaded and ready');