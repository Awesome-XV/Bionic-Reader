// Minimal bionic transform core used for tests
'use strict';

function calculateBoldCount(word, intensity = 0.5) {
  if (!word || typeof word !== 'string') return 0;
  const letters = (word.match(/[a-zA-Z]/g) || []).length;
  if (letters <= 1) return 0;
  const baseRatio = letters <= 3 ? 0.66 : 0.5;
  const scaled = Math.max(0.1, Math.min(0.9, baseRatio * (0.5 + intensity)));
  return Math.min(letters - 1, Math.ceil(letters * scaled));
}

function transformWord(word, intensity = 0.5) {
  if (!word) return word;
  const letters = word.split('');
  const count = calculateBoldCount(word, intensity);
  if (count <= 0) return word;
  let letterIndex = 0;
  let out = '';
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i];
    if (/[a-zA-Z]/.test(ch)) {
      if (letterIndex < count) {
        out += `<b>${ch}</b>`;
      } else {
        out += ch;
      }
      letterIndex++;
    } else {
      out += ch;
    }
  }
  return out;
}

function transformText(text, intensity = 0.5) {
  if (!text) return text;
  return text.split(/(\s+)/).map(token => {
    if (/^\s+$/.test(token)) return token;
    return transformWord(token, intensity);
  }).join('');
}

module.exports = { calculateBoldCount, transformWord, transformText };
