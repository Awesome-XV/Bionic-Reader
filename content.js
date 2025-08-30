// Bionic Reading Extension - COMPLETELY FIXED Implementation
'use strict';

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

// State management
let bionicEnabled = false;
let originalTexts = new WeakMap();
let processedNodes = new Set();
let isProcessing = false;
let processedCount = 0;

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
  
  // Keep the bold-letter count deterministic and independent of intensity.
  // Small words keep a larger ratio; longer words use a smaller prefix.
  const baseRatio = N <= 3 ? 0.66 : (isFunction ? CONFIG.FUNCTION_WORD_RATIO : CONFIG.CONTENT_WORD_RATIO);
  const scaled = Math.max(0.05, Math.min(0.95, baseRatio));
  const B = Math.min(N - 1, Math.ceil(N * scaled));
  
  const positions = [];
  for (let i = 0; i < B; i++) {
    positions.push(i);
  }
  
  console.log(`[BIONIC] Word: "${word}" | Letters: "${letterString}" | Length: ${N} | Function: ${isFunction} | Bold positions: [${positions.join(', ')}]`);
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
  console.log(`[TRANSFORM] Starting with word: "${word}"`);
  
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
  
  console.log(`[TRANSFORM] "${word}" -> "${result}"`);
  return result;
}

function transformText(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Security: Limit text length
  if (text.length > CONFIG.MAX_TEXT_LENGTH) {
    console.warn('[Security] Text too long, truncating for processing');
    text = text.substring(0, CONFIG.MAX_TEXT_LENGTH);
  }
  
  console.log(`[TEXT] Processing text: "${text}"`);
  
  // Split text into words while preserving all whitespace and punctuation
  const parts = text.split(/(\s+)/);
  
  const result = parts.map((part, index) => {
    // Keep whitespace exactly as-is
    if (/^\s+$/.test(part)) return part;
    
    // Transform words - each non-whitespace part is treated as a word
    return transformWord(part, index, parts);
  }).join('');
  
  console.log(`[TEXT] Result: "${result}"`);
  return result;
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

async function processTextNodesBatch(textNodes, startIndex = 0) {
  const endIndex = Math.min(startIndex + CONFIG.MAX_NODES_PER_BATCH, textNodes.length);
  const batch = textNodes.slice(startIndex, endIndex);
  
  console.log(`Processing batch ${Math.floor(startIndex / CONFIG.MAX_NODES_PER_BATCH) + 1}: nodes ${startIndex} to ${endIndex - 1}`);
  
  const mergedGroups = mergeAdjacentTextNodes(batch);
  
  mergedGroups.forEach(nodeGroup => {
    try {
      if (nodeGroup.some(node => processedNodes.has(node))) return;
      if (!nodeGroup.every(node => document.contains(node))) return;
      
      const combinedText = nodeGroup.map(node => node.textContent).join('');
      if (!combinedText || combinedText.trim().length < 5) return;
      
      const letterCount = (combinedText.match(/[a-zA-Z]/g) || []).length;
      if (letterCount < combinedText.length * 0.5) return;
      
      console.log(`[BATCH] Processing merged text: "${combinedText}"`);
      const transformedHTML = transformText(combinedText);
      
      if (transformedHTML !== combinedText && transformedHTML.includes('<span class="bionic-fixation"')) {
        console.log(`[BATCH] Transformed: "${transformedHTML}"`);
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
  });
  
  if (endIndex < textNodes.length && processedCount < CONFIG.MAX_TOTAL_NODES) {
    await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY));
    return processTextNodesBatch(textNodes, endIndex);
  }
  
  return processedCount;
}

async function processTextNodes(element) {
  if (!element || shouldSkipElement(element) || isProcessing) return;
  
  isProcessing = true;
  
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
      return;
    }
    
    const timeoutId = setTimeout(() => {
      console.warn('[Security] Processing timeout reached, stopping');
      isProcessing = false;
    }, CONFIG.PROCESSING_TIMEOUT);
    
    const processed = await processTextNodesBatch(textNodes);
    clearTimeout(timeoutId);
    
    console.log(`Successfully processed ${processed} text nodes`);
    
  } catch (error) {
    console.error('Error in processTextNodes:', error);
  } finally {
    isProcessing = false;
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
        isProcessing: isProcessing
      });
      break;
      
    default:
      sendResponse({ error: 'Unknown action', code: 'UNKNOWN_ACTION' });
  }
  
  return false;
});

// Handle runtime intensity changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'setIntensity') {
    const v = Number(request.intensity);
    if (!isNaN(v)) {
      BIONIC_INTENSITY = Math.max(0, Math.min(1, v));
      console.log('[BIONIC] Intensity set to', BIONIC_INTENSITY);
      
      // Update existing bionic spans with new font-weight
      const weight = Math.round(300 + (BIONIC_INTENSITY * 600));
      const spans = document.querySelectorAll('.bionic-fixation');
      spans.forEach(span => {
        span.style.fontWeight = weight;
      });
      
      sendResponse({ success: true, intensity: BIONIC_INTENSITY });
    } else {
      sendResponse({ error: 'Invalid intensity' });
    }
    return true;
  }
});

// Load saved intensity from storage if available
if (chrome && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get({ bionicIntensity: 0.5 }, (items) => {
    const v = Number(items.bionicIntensity);
    if (!isNaN(v)) {
      BIONIC_INTENSITY = Math.max(0, Math.min(1, v));
      console.log('[BIONIC] Loaded intensity from storage:', BIONIC_INTENSITY);
    }
  });
}

// Dynamic content observer
const observer = new MutationObserver((mutations) => {
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
    clearTimeout(observer.timeout);
    const delay = Math.min(1500, Math.max(300, newNodes.length * 30));
    
    observer.timeout = setTimeout(async () => {
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

// Start observing
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

console.log('FULLY FIXED Bionic Reader content script loaded and ready');