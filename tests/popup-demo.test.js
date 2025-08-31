const fs = require('fs');
const path = require('path');

// Read popup.js source and extract updateDemoHTML function string
const popupSrc = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');
const match = popupSrc.match(/function updateDemoHTML\([\s\S]*?\n\}/m);
let updateDemoHTML;
if (match && match[0]) {
  // eslint-disable-next-line no-eval
  updateDemoHTML = eval('(' + match[0] + ')');
} else {
  throw new Error('Could not extract updateDemoHTML from popup.js');
}

describe('popup demo preview', () => {
  test('updateDemoHTML returns bolded prefix for words', () => {
    const html = updateDemoHTML('Reading test', 0.5);
    // Expect demo-bold spans with inline font-weight style
    expect(html).toMatch(/<span class="demo-bold" style="font-weight:\d+">R<\/span>/i);
    // strip HTML tags to check visible text
    const text = html.replace(/<[^>]+>/g, '');
    expect(text).toContain('Reading');
  });

  test('different intensities produce different outputs', () => {
    const low = updateDemoHTML('reading', 0.1);
    const high = updateDemoHTML('reading', 0.9);
    // Extract the first span's font-weight values
    const lowWeightMatch = low.match(/font-weight:(\d+)/);
    const highWeightMatch = high.match(/font-weight:(\d+)/);
    expect(lowWeightMatch && highWeightMatch).toBeTruthy();
    expect(Number(lowWeightMatch[1])).toBeLessThan(Number(highWeightMatch[1]));
  });  test('handles empty string', () => {
    expect(updateDemoHTML('', 0.5)).toBe('');
  });
});
